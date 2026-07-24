# Phase Frontend 0.0 — Socle technique

> **Objectif** : Poser le socle technique du frontend `apps/web` pour permettre les développements métier ultérieurs.

**Contexte source** : `docs/emdb_roadmap_frontend.md` (Phase 0) + `docs/phase_0_setup.md` (backend) + mapping API backend existant.

---


## Objectifs
- Initialiser le workspace Next.js 14+ (App Router, TypeScript, Tailwind).
- Ajouter shadcn/ui + thème sombre/light par défaut dark.
- Mettre en place React Query, un client API typé, et les types/base url.
- Créer le store d’authentification (Zustand) + hooks auth de base.
- Construire un layout minimal (header/footer, navigation publique vs protégée).
- Ajouter composants communs utilitaires (LoadingSpinner, Error, Pagination).
- Configurer les tests unitaires (Jest + RTL) et Cypress (config + fixtures).
- Documenter le mapping endpoints backend ↔ frontend pour la phase 0.

---


## Pages à créer
- Aucune page métier spécifique en phase 0.
- Pages structurelles uniquement : layout global `(frontend)` avec haut/bas de page.
- Pages d’auth vides prêtes pour Phase 1 : `(auth)/login`, `(auth)/register`.

## Décisions prises (points à trancher résolus)
- Authentification : `(auth)/` séparé du layout app + middleware sur routes protégées.
- Rafraîchissement token : cookie httpOnly + endpoint `/auth/refresh` explicite (standard, sécurisé).
- Pagination : composant générique `components/common/Pagination` (réutilisable).
- Dépendances Phase 0 : strict minimum `next`, `react`, `react-dom`, `@tanstack/react-query`, `zustand`, `lucide-react`, `class-variance-authority`, `clsx`, `tailwind-merge`. `framer-motion` et `@dnd-kit/core` ajoutés aux phases concernées.

---


## Composants à créer
- `components/layout/Header.tsx` — navigation responsive
- `components/layout/Footer.tsx`
- `components/common/LoadingSpinner.tsx`
- `components/common/ErrorBoundary.tsx`
- `components/common/Pagination.tsx`

---


## Hooks à créer
- `hooks/auth/useAuth.ts`
- `hooks/auth/useLogin.ts`
- `hooks/auth/useRegister.ts`
- `hooks/auth/useLogout.ts`

---


## Endpoints API consommés (backend existants)
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/logout`
- `GET /auth/me`
- `POST /auth/refresh`
- `GET /users/me`
- `GET /users/search`

---


## Gestion des états (loading/error/empty)
- React Query fournit loading/error par hook.
- `LoadingSpinner` utilisé pour les états pending.
- `ErrorBoundary` pour erreurs render.
- Empty states génériques centralisés si besoin.

---


## Tests
- Jest config + setup, RTL installé.
- Tests unitaires pour :
  - hooks auth
  - composants LoadingSpinner/ErrorBoundary/Pagination
- Cypress configuré (non exécuté en CI) avec fixtures d’exemple.

---


## Critères d’acceptation
- `npm run build` passe.
- `npm run lint` et `npm run format` passent.
- Tests unitaires passent.
- Routing App Router opérationnel, layout public/protégé délimité.
- Auth store + hooks fonctionnels (connexion, inscription, logout, refresh).
- Header/footer visibles et responsive.
- shadcn/ui initialisé + thème dark par défaut.

## Erreurs connues à résorber avant build
- ~~`apps/web/tailwind.config.ts` : TS errors type declarations manquants~~ ✅ Résolu par l'import direct de `design-tokens.ts`.
- ~~`asChild` sur composants base-ui~~ ✅ Résolu : `@base-ui/react` ne supporte pas `asChild` ; les composants enfants sont rendus directement.

---


## Plan d’implémentation
1. Création du projet Next.js dans `apps/web`.
2. Tailwind + shadcn/ui + thème dark par défaut.
3. Configuration alias `@/`, eslint/prettier.
4. React Query + client API (types, intercepteurs 401/403/404).
5. Zustand auth store + hooks.
6. Layout + composants communs.
7. Tests + Cypress config.

## Arborescence cible Phase 0
- `apps/web/src/app/(frontend)/layout.tsx`
- `apps/web/src/app/(auth)/login/page.tsx`
- `apps/web/src/app/(auth)/register/page.tsx`
- `apps/web/src/app/(auth)/layout.tsx`
- `apps/web/src/app/layout.tsx`
- `apps/web/src/app/page.tsx`
- `apps/web/src/app/error.tsx`
- `apps/web/src/app/not-found.tsx`
- `apps/web/src/components/layout/Header.tsx`
- `apps/web/src/components/layout/Footer.tsx`
- `apps/web/src/components/common/LoadingSpinner.tsx`
- `apps/web/src/components/common/ErrorBoundary.tsx`
- `apps/web/src/components/common/Pagination.tsx`
- `apps/web/src/hooks/auth/useAuth.ts`
- `apps/web/src/hooks/auth/useLogin.ts`
- `apps/web/src/hooks/auth/useRegister.ts`
- `apps/web/src/hooks/auth/useLogout.ts`
- `apps/web/src/lib/api/apiClient.ts`
- `apps/web/src/lib/api/queryClient.ts`
- `apps/web/src/lib/types/api.ts`
- `apps/web/src/store/authStore.ts`
- `apps/web/middleware.ts`
- `apps/web/src/styles/globals.css`
- `apps/web/__tests__/unit/hooks/auth/*.test.tsx`
- `apps/web/__tests__/unit/components/*.test.tsx`

## Décisions finales Phase 0

| Décision | Choix retenu | Justification |
|----------|-------------|---------------|
| UI primitives | `@base-ui/react` (via shadcn/ui) | Remplace Radix UI ; pas de support `asChild` |
| Theme | Dark par défaut (`className="dark"` sur `<html>`) | Cohérent avec design tokens |
| Alias | `@/*` → `./src/*` | Standard Next.js monorepo |
| Auth store | Zustand (global) + React Context non utilisé pour l'instant | Léger, pas de boilerplate |
| API client | Fetch wrapper + React Query | Pas d'Axios ; intercepteur 401/403/404 centralisé |
| Tests | Jest + RTL (unit) ; Cypress configuré mais non exécuté en CI | Couverture unitaire suffisante pour Phase 0 |

## Validation Phase 0

- [x] `npm run build` passe
- [x] `npm run lint` passe (0 erreur, 0 warning)
- [x] `npm run format:check` passe
- [x] Tests unitaires Jest/RTL passent (7 tests, 9 assertions)
- [ ] Cypress exécuté manuellement (scénarios listés dans `TECHNICAL_DETAILS.md`)

## Endpoints API consommés (vérifiés côté backend)

| Endpoint | Méthode | Auth | Status backend |
|----------|---------|------|----------------|
| `/auth/register` | POST | ❌ | ✅ Existe |
| `/auth/login` | POST | ❌ | ✅ Existe |
| `/auth/logout` | POST | ✅ | ✅ Existe |
| `/auth/me` | GET | ✅ | ✅ Existe |
| `/auth/refresh` | POST | ❌ | ✅ Existe |
| `/users/me` | GET | ✅ | ✅ Existe |
| `/users/search` | GET | ✅ | ✅ Existe |
