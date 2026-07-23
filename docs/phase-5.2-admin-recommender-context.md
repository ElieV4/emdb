# Contexte — Phase 5.2 : Module API recommandations + BullMQ

## Décisions stratégiques (tranchées)

| Question | Décision | Justification |
|----------|----------|---------------|
| 1. Auth admin | **(b) Email fixe dans .env** | Pas de champ `is_admin` dans le schéma actuel → migration lourde. Un email fixe via `ADMIN_EMAILS` est immédiat, réversible, et suffisant pour une app à 2 utilisateurs. |
| 2. Exécution | **(b) BullMQ uniquement** | Le calcul peut prendre plusieurs minutes pour 10 000 titres. Synchrone = timeout HTTP, mauvaise UX. BullMQ permet de lancer le job et suivre le statut (pattern async classique). |
| 3. Module NestJS | **(a) `apps/api/src/recommender/`** | Cohérent avec la structure existante (1 module = 1 fonctionnalité). Pas besoin d'une abstraction `admin` prématurée. |
| 4. BullMQ | **(a) Installer BullMQ** | Déjà prévu dans la roadmap (Phase 2.4). Sans BullMQ, pas de file d'attente, pas de cron, pas de suivi de job. À installer dans `apps/worker` pour les jobs, dans `apps/api` pour le déclenchement. |
| 5. Stats endpoint | **(a) Oui, dans 5.2** | Simple endpoint GET qui lit `tmdb_sync_log` pour les actions `import*` et donne la date du dernier run, le nombre de recommandations. Utile pour le debug. |

## Dépendances

### Packages
- `@emdb/recommender` (Phase 5.1) — `computeTitleRecommendations()` et `computePersonRecommendations()` 
- `@emdb/db` — Prisma, pour les stats (tmdb_sync_log, title_recommendations, person_recommendations)
- `@nestjs/bullmq` + `bullmq` — queue de jobs (nouvelle dépendance)
- `ioredis` — Redis client (déjà présent via tmdb-client)
- `auth` — `JwtAuthGuard`, `@CurrentUser()`

### BullMQ setup
```typescript
// apps/worker/package.json
{
  "dependencies": {
    "@emdb/db": "*",
    "@emdb/recommender": "*",
    "@nestjs/bullmq": "^10.x",
    "bullmq": "^5.x",
    "ioredis": "^5.x"
  }
}

// apps/api/package.json — ajouter
{
  "dependencies": {
    "@nestjs/bullmq": "^10.x",
    "bullmq": "^5.x"
  }
}
```

### Queue `recommendations`
| Configuration | Valeur | Justification |
|--------------|--------|---------------|
| Queue name | `recommendations` | — |
| Concurrency | **1** | Calcul lourd, pas parallélisable sans risque de conflit sur les écritures |
| Timeout | **30 min** | Évite le kill du worker pour les longs calculs (10 000 titres = ~5 min) |
| Retry | **0** | Inutile de retry : le calcul est déterministe, si ça échoue c'est un bug |

### Jobs
```typescript
type ComputeRecommendationsJob = {
  mode: 'titles' | 'people' | 'all';
};
```

### Worker
```typescript
// apps/worker/src/recommendations.worker.ts
import { Worker } from 'bullmq';
import { computeTitleRecommendations, computePersonRecommendations } from '@emdb/recommender';

const worker = new Worker<ComputeRecommendationsJob>(
  'recommendations',
  async (job) => {
    const { mode } = job.data;
    let titlesComputed = 0;
    let peopleComputed = 0;

    if (mode === 'titles' || mode === 'all') {
      titlesComputed = await computeTitleRecommendations();
    }
    if (mode === 'people' || mode === 'all') {
      peopleComputed = await computePersonRecommendations();
    }

    return { titlesComputed, peopleComputed };
  },
  {
    connection: { host: process.env.REDIS_HOST ?? 'localhost' },
    concurrency: 1,
    lockDuration: 30 * 60 * 1000, // 30 min
  },
);
```

### Cron mensuel (BullMQ QueueScheduler)
```typescript
// apps/worker/src/cron.ts
import { Queue } from 'bullmq';

async function scheduleMonthlyRecs() {
  const queue = new Queue('recommendations', {
    connection: { host: process.env.REDIS_HOST ?? 'localhost' },
  });

  // Planifier le 1er de chaque mois à 03:00
  await queue.upsertJobScheduler(
    'compute-recommendations-cron',
    { pattern: '0 3 1 * *' },  // cron: 1er du mois à 3h
    { data: { mode: 'all' }, opts: { jobId: 'compute-recommendations-cron' } },
  );
}
```

## Endpoints

| Method | Path | Auth | DTO | Description |
|--------|------|------|-----|-------------|
| `POST` | `/admin/compute-recommendations` | ✅ JWT + admin | `ComputeRecsDto` | Lance le calcul via BullMQ, retourne { jobId } |
| `GET` | `/admin/compute-recommendations/:jobId/status` | ✅ JWT + admin | — | Statut du job (waiting/active/completed/failed) + résultat |
| `GET` | `/admin/recommendations/stats` | ✅ JWT + admin | — | Stats globales (total recs, dernier run, durée) |

### DTOs
```typescript
// ComputeRecsDto
class ComputeRecsDto {
  @IsOptional()
  @IsEnum(['titles', 'people', 'all'])
  mode?: 'titles' | 'people' | 'all' = 'all';
}

// JobStatusResponse (retourné par GET /status)
class JobStatusResponse {
  @IsString()
  jobId!: string;

  @IsEnum(['waiting', 'active', 'completed', 'failed', 'delayed'])
  status!: string;

  @IsOptional()
  @ValidateNested()
  result?: {
    titles_computed: number;
    people_computed: number;
  };

  @IsOptional()
  @IsNumber()
  progress?: number;

  @IsOptional()
  @IsNumber()
  duration_ms?: number;
}
```

### Auth admin guard
```typescript
// apps/api/src/auth/admin.guard.ts
import { Injectable, ForbiddenException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class AdminGuard extends AuthGuard('jwt') {
  handleRequest(err: any, user: any) {
    if (err || !user) throw err || new ForbiddenException();

    const adminEmails = (process.env.ADMIN_EMAILS ?? '')
      .split(',')
      .map((e: string) => e.trim().toLowerCase());

    if (!adminEmails.includes(user.email?.toLowerCase())) {
      throw new ForbiddenException('Accès administrateur requis.');
    }

    return user;
  }
}
```

### Stats format
```typescript
// GET /admin/recommendations/stats → response
{
  total_title_recommendations: number,      // COUNT(title_recommendations)
  total_person_recommendations: number,     // COUNT(person_recommendations)
  titles_with_recs: number,                 // COUNT(DISTINCT title_id)
  people_with_recs: number,                 // COUNT(DISTINCT person_id)
  last_run: {
    started_at: string | null,              // Date du dernier job 'compute-recommendations'
    completed_at: string | null,
    duration_ms: number | null,
    status: string | null,
    titles_computed: number | null,
    people_computed: number | null,
  } | null,
}
```

## Dépendances npm à ajouter

### apps/api
```
npm install @nestjs/bullmq bullmq
```

### apps/worker
```
npm install @nestjs/bullmq bullmq ioredis
```

Et ajouter `@emdb/recommender` en dépendance workspace dans les deux.

## Structure prévue

```
apps/api/src/recommender/
├── recommender.module.ts       // NestJS Module
├── recommender.controller.ts   // 3 endpoints
├── recommender.service.ts      // logique métier (lancer job, stats)
├── dto/
│   ├── compute-recs.dto.ts
│   └── job-status.dto.ts
├── guards/
│   └── admin.guard.ts          // AdminGuard (vérifie ADMIN_EMAILS)
└── recommender.service.spec.ts // tests

apps/worker/src/
├── recommendations.worker.ts   // BullMQ Worker
└── cron.ts                     // Planification mensuelle
```

## Plan de tests

### admin.guard.ts
- Autorise l'accès si l'email de l'utilisateur est dans ADMIN_EMAILS
- Refuse avec ForbiddenException si l'email n'est pas dans ADMIN_EMAILS
- Refuse si ADMIN_EMAILS est vide ou non défini

### recommender.service.ts
- `startRecommendations(mode)` : ajoute un job BullMQ et retourne un jobId
- `getJobStatus(jobId)` : retourne le statut complet du job
- `getStats()` : retourne les stats formatées correctement

### recomender.controller.ts
- POST /admin/compute-recommendations → 201 + jobId
- GET /admin/compute-recommendations/:jobId/status → 200 + statut
- GET /admin/recommendations/stats → 200 + stats
- Tous les endpoints admin retournent 403 si l'utilisateur n'est pas admin
- Tous les endpoints admin retournent 401 si non authentifié

