import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

function loadEnv(filePath: string): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) continue;
    const key = trimmed.slice(0, equalIndex).trim();
    const value = trimmed.slice(equalIndex + 1);
    if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
      process.env[key] = value;
    }
  }
}

loadEnv(path.resolve(__dirname, '../../../.env'));

const { prisma } = require('@emdb/db') as typeof import('@emdb/db');

describe('PL/pgSQL functions', () => {
  const userId = randomUUID();
  const titleId = randomUUID();
  const seasonId = randomUUID();
  const episode1Id = randomUUID();
  const episode2Id = randomUUID();

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.users.create({
      data: {
        id: userId,
        email: `plpgsql-${userId}@example.com`,
        password_hash: 'testhash',
        pseudo: `plpgsql-${userId}`,
      },
    });
    await prisma.titles.create({
      data: {
        id: titleId,
        type: 'serie',
        titre_vo: 'Serie PL/pgSQL VO',
        titre_vf: 'Serie PL/pgSQL VF',
      },
    });
    await prisma.seasons.create({
      data: {
        id: seasonId,
        title_id: titleId,
        numero: 1,
        titre: 'Saison 1',
      },
    });
    await prisma.episodes.createMany({
      data: [
        {
          id: episode1Id,
          season_id: seasonId,
          numero: 1,
          titre: 'Episode 1',
          date_sortie: new Date('2026-01-01'),
        },
        {
          id: episode2Id,
          season_id: seasonId,
          numero: 2,
          titre: 'Episode 2',
          date_sortie: new Date('2026-01-02'),
        },
      ],
    });
    await prisma.user_watches.create({
      data: {
        user_id: userId,
        episode_id: episode1Id,
        date_vue: new Date('2026-07-23'),
      },
    });
  });

  afterAll(async () => {
    await prisma.user_watches.deleteMany({ where: { user_id: userId } });
    await prisma.user_ratings.deleteMany({ where: { user_id: userId } });
    await prisma.episodes.deleteMany({ where: { season_id: seasonId } });
    await prisma.seasons.deleteMany({ where: { id: seasonId } });
    await prisma.titles.deleteMany({ where: { id: titleId } });
    await prisma.users.deleteMany({ where: { id: userId } });
    await prisma.$disconnect();
  });

  it('fn_episodes_non_vus retourne le nombre correct d’épisodes non vus', async () => {
    const result = await prisma.$queryRaw`
      SELECT fn_episodes_non_vus(${userId}::uuid, ${titleId}::uuid) AS count;
    `;
    const count = (result as Array<{ count: number }>)[0]?.count;
    expect(count).toBe(1);
  });

  it('fn_progress_serie retourne la progression par saison', async () => {
    const result = await prisma.$queryRaw`
      SELECT * FROM fn_progress_serie(${userId}::uuid, ${titleId}::uuid);
    `;
    const row = (result as Array<{ saison: number; vus: number; total: number }>)[0];
    expect(row).toBeDefined();
    expect(row.saison).toBe(1);
    expect(row.vus).toBe(1);
    expect(row.total).toBe(2);
  });
});
