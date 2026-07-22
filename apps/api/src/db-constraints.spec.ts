import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';

function loadEnv(filePath: string): void {
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) {
      continue;
    }

    const equalIndex = trimmed.indexOf('=');
    if (equalIndex === -1) {
      continue;
    }

    const key = trimmed.slice(0, equalIndex).trim();
    const value = trimmed.slice(equalIndex + 1);
    if (!Object.prototype.hasOwnProperty.call(process.env, key)) {
      process.env[key] = value;
    }
  }
}

loadEnv(path.resolve(__dirname, '../../../.env'));

const { prisma } = require('@emdb/db') as typeof import('@emdb/db');

describe('Phase 1.5 - cohérence base de données', () => {
  const userId = randomUUID();
  const titleFilmId = randomUUID();
  const titleSerieId = randomUUID();
  const seasonId = randomUUID();
  const episodeId = randomUUID();
  const listId = randomUUID();
  const titleListItemA = randomUUID();
  const titleListItemB = randomUUID();
  const followFilmId = randomUUID();

  beforeAll(async () => {
    await prisma.$connect();
    await prisma.users.create({
      data: {
        id: userId,
        email: `test-${userId}@example.com`,
        password_hash: 'testhash',
        pseudo: `tester-${userId}`,
      },
    });
  });

  afterAll(async () => {
    await prisma.$transaction([
      prisma.user_follows_serie.deleteMany({ where: { user_id: userId } }),
      prisma.list_items.deleteMany({ where: { list_id: listId } }),
      prisma.user_lists.deleteMany({ where: { id: listId } }),
      prisma.user_ratings.deleteMany({ where: { user_id: userId } }),
      prisma.episodes.deleteMany({ where: { id: episodeId } }),
      prisma.seasons.deleteMany({ where: { id: seasonId } }),
      prisma.titles.deleteMany({ where: { id: titleFilmId } }),
      prisma.titles.deleteMany({ where: { id: titleSerieId } }),
      prisma.users.deleteMany({ where: { id: userId } }),
    ]);
    await prisma.$disconnect();
  });

  it('doit refuser deux ratings identiques pour un même titre', async () => {
    await prisma.titles.create({
      data: {
        id: titleFilmId,
        type: 'film',
        titre_vo: 'Test Film VO',
        titre_vf: 'Test Film VF',
      },
    });

    await prisma.user_ratings.create({
      data: {
        user_id: userId,
        title_id: titleFilmId,
        note_perso: 8.5,
      },
    });

    await expect(
      prisma.user_ratings.create({
        data: {
          user_id: userId,
          title_id: titleFilmId,
          note_perso: 9.0,
        },
      }),
    ).rejects.toThrow(/P2002|unique constraint|duplicate key/i);
  });

  it('doit refuser deux ratings identiques pour un même épisode', async () => {
    await prisma.titles.create({
      data: {
        id: titleSerieId,
        type: 'serie',
        titre_vo: 'Test Série VO',
        titre_vf: 'Test Série VF',
      },
    });

    await prisma.seasons.create({
      data: {
        id: seasonId,
        title_id: titleSerieId,
        numero: 1,
        titre: 'Saison 1',
      },
    });

    await prisma.episodes.create({
      data: {
        id: episodeId,
        season_id: seasonId,
        numero: 1,
        titre: 'Épisode 1',
      },
    });

    await prisma.user_ratings.create({
      data: {
        user_id: userId,
        episode_id: episodeId,
        note_perso: 7.0,
      },
    });

    await expect(
      prisma.user_ratings.create({
        data: {
          user_id: userId,
          episode_id: episodeId,
          note_perso: 7.5,
        },
      }),
    ).rejects.toThrow(/P2002|unique constraint|duplicate key/i);
  });

  it('doit autoriser des positions dupliquées dans une même liste', async () => {
    await prisma.user_lists.create({
      data: {
        id: listId,
        user_id: userId,
        nom: 'Liste de test',
        type: 'personnalisee',
      },
    });

    await prisma.titles.createMany({
      data: [
        {
          id: titleListItemA,
          type: 'film',
          titre_vo: 'Lista Item A VO',
          titre_vf: 'Lista Item A VF',
        },
        {
          id: titleListItemB,
          type: 'film',
          titre_vo: 'Lista Item B VO',
          titre_vf: 'Lista Item B VF',
        },
      ],
    });

    await prisma.list_items.createMany({
      data: [
        {
          list_id: listId,
          title_id: titleListItemA,
          position: 1,
        },
        {
          list_id: listId,
          title_id: titleListItemB,
          position: 1,
        },
      ],
    });

    const items = await prisma.list_items.findMany({ where: { list_id: listId } });
    expect(items).toHaveLength(2);
    expect(items.every((item) => item.position === 1)).toBe(true);
  });

  it("montre que le CHECK 'user_follows_serie' est actuellement un placeholder", async () => {
    await prisma.titles.create({
      data: {
        id: followFilmId,
        type: 'film',
        titre_vo: 'Test Film Follow VO',
        titre_vf: 'Test Film Follow VF',
      },
    });

    const follow = await prisma.user_follows_serie.create({
      data: {
        user_id: userId,
        title_id: followFilmId,
      },
    });

    expect(follow.user_id).toBe(userId);
    expect(follow.title_id).toBe(followFilmId);
  });
});
