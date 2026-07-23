import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { RatingsService } from './ratings.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaServiceMock = {
  titles: {
    findUnique: jest.fn(),
  },
  episodes: {
    findUnique: jest.fn(),
  },
  user_ratings: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    count: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
};

describe('RatingsService', () => {
  let service: RatingsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RatingsService,
        { provide: PrismaService, useValue: prismaServiceMock },
      ],
    }).compile();

    service = module.get<RatingsService>(RatingsService);
    jest.clearAllMocks();
  });

  const userId = 'user-uuid';
  const titleId = 'title-uuid';
  const episodeId = 'episode-uuid';
  const ratingId = 'rating-uuid';

  const mockInclude = {
    titles: {
      select: {
        id: true,
        tmdb_id: true,
        titre_vo: true,
        titre_vf: true,
        affiche_url: true,
        type: true,
      },
    },
    episodes: {
      select: {
        id: true,
        numero: true,
        titre: true,
        seasons: { select: { numero: true } },
      },
    },
  };

  // Helper to build a raw Prisma rating response
  const buildRawRating = (overrides: any = {}) => ({
    id: overrides.id ?? ratingId,
    user_id: overrides.user_id ?? userId,
    title_id: overrides.title_id ?? titleId,
    episode_id: overrides.episode_id ?? null,
    note_perso: overrides.note_perso ?? 7.5,
    commentaire: overrides.commentaire ?? 'Super film !',
    created_at: overrides.created_at ?? new Date('2026-07-23'),
    updated_at: overrides.updated_at ?? new Date('2026-07-23'),
    titles: overrides.titles ?? {
      id: titleId,
      tmdb_id: 123,
      titre_vo: 'Test Movie',
      titre_vf: 'Film Test',
      affiche_url: '/poster.jpg',
      type: 'film',
    },
    episodes: overrides.episodes ?? null,
  });

  // ======================================================================
  // upsertRating
  // ======================================================================
  describe('upsertRating', () => {
    it('crée un rating (title_id fourni, aucun existant)', async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue({ id: titleId });
      prismaServiceMock.user_ratings.findUnique.mockResolvedValue(null);
      prismaServiceMock.user_ratings.create.mockResolvedValue(
        buildRawRating({}),
      );

      const result = await service.upsertRating(userId, {
        title_id: titleId,
        note_perso: 7.5,
        commentaire: 'Super film !',
      });

      expect(result.id).toBe(ratingId);
      expect(result.note_perso).toBe(7.5);
      expect(prismaServiceMock.titles.findUnique).toHaveBeenCalledWith({
        where: { id: titleId },
        select: { id: true },
      });
      expect(prismaServiceMock.user_ratings.create).toHaveBeenCalledWith({
        data: {
          user_id: userId,
          title_id: titleId,
          episode_id: null,
          note_perso: 7.5,
          commentaire: 'Super film !',
        },
        include: mockInclude,
      });
    });

    it('met à jour un rating existant (même user_id + title_id)', async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue({ id: titleId });
      prismaServiceMock.user_ratings.findUnique.mockResolvedValue(
        buildRawRating({}),
      );
      prismaServiceMock.user_ratings.update.mockResolvedValue(
        buildRawRating({ note_perso: 8.0, commentaire: 'Encore mieux !' }),
      );

      const result = await service.upsertRating(userId, {
        title_id: titleId,
        note_perso: 8.0,
        commentaire: 'Encore mieux !',
      });

      expect(result.note_perso).toBe(8.0);
      expect(result.commentaire).toBe('Encore mieux !');
      expect(prismaServiceMock.user_ratings.update).toHaveBeenCalledWith({
        where: { id: ratingId },
        data: { note_perso: 8.0, commentaire: 'Encore mieux !' },
        include: mockInclude,
      });
    });

    it('crée un rating pour un épisode', async () => {
      prismaServiceMock.episodes.findUnique.mockResolvedValue({
        id: episodeId,
      });
      prismaServiceMock.user_ratings.findUnique.mockResolvedValue(null);
      prismaServiceMock.user_ratings.create.mockResolvedValue(
        buildRawRating({
          title_id: null,
          episode_id: episodeId,
          note_perso: 8.0,
          titles: null,
          episodes: {
            id: episodeId,
            numero: 3,
            titre: 'Episode 3',
            seasons: { numero: 1 },
          },
        }),
      );

      const result = await service.upsertRating(userId, {
        episode_id: episodeId,
        note_perso: 8.0,
        commentaire: 'Excellent épisode',
      });

      expect(result.id).toBe(ratingId);
      expect(result.note_perso).toBe(8.0);
      expect(result.episode).toBeDefined();
      expect(result.episode?.numero).toBe(3);
      expect(prismaServiceMock.episodes.findUnique).toHaveBeenCalledWith({
        where: { id: episodeId },
        select: { id: true },
      });
    });

    it('met à jour note_perso seulement', async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue({ id: titleId });
      prismaServiceMock.user_ratings.findUnique.mockResolvedValue(
        buildRawRating({}),
      );
      prismaServiceMock.user_ratings.update.mockResolvedValue(
        buildRawRating({ note_perso: 9.0 }),
      );

      const result = await service.upsertRating(userId, {
        title_id: titleId,
        note_perso: 9.0,
      });

      expect(result.note_perso).toBe(9.0);
      expect(prismaServiceMock.user_ratings.update).toHaveBeenCalledWith({
        where: { id: ratingId },
        data: { note_perso: 9.0 },
        include: mockInclude,
      });
    });

    it('met à jour commentaire seulement', async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue({ id: titleId });
      prismaServiceMock.user_ratings.findUnique.mockResolvedValue(
        buildRawRating({}),
      );
      prismaServiceMock.user_ratings.update.mockResolvedValue(
        buildRawRating({ commentaire: 'Nouveau commentaire' }),
      );

      const result = await service.upsertRating(userId, {
        title_id: titleId,
        commentaire: 'Nouveau commentaire',
      });

      expect(result.commentaire).toBe('Nouveau commentaire');
      expect(prismaServiceMock.user_ratings.update).toHaveBeenCalledWith({
        where: { id: ratingId },
        data: { commentaire: 'Nouveau commentaire' },
        include: mockInclude,
      });
    });

    it("lève BadRequest si ni title_id ni episode_id", async () => {
      await expect(
        service.upsertRating(userId, {
          note_perso: 7.0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it('lève BadRequest si les deux sont fournis', async () => {
      await expect(
        service.upsertRating(userId, {
          title_id: titleId,
          episode_id: episodeId,
          note_perso: 7.0,
        }),
      ).rejects.toThrow(BadRequestException);
    });

    it("lève BadRequest si aucun champ optionnel fourni", async () => {
      await expect(
        service.upsertRating(userId, {
          title_id: titleId,
        }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ======================================================================
  // deleteRating
  // ======================================================================
  describe('deleteRating', () => {
    it('supprime un rating existant', async () => {
      prismaServiceMock.user_ratings.findUnique.mockResolvedValue({
        id: ratingId,
        user_id: userId,
      });
      prismaServiceMock.user_ratings.delete.mockResolvedValue({});

      await service.deleteRating(ratingId, userId);

      expect(prismaServiceMock.user_ratings.delete).toHaveBeenCalledWith({
        where: { id: ratingId },
      });
    });

    it("lève NotFound si le rating n'existe pas", async () => {
      prismaServiceMock.user_ratings.findUnique.mockResolvedValue(null);

      await expect(
        service.deleteRating('nonexistent', userId),
      ).rejects.toThrow(NotFoundException);
    });

    it('lève Forbidden si le rating appartient à un autre user', async () => {
      prismaServiceMock.user_ratings.findUnique.mockResolvedValue({
        id: ratingId,
        user_id: 'other-user',
      });

      await expect(
        service.deleteRating(ratingId, userId),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ======================================================================
  // listUserRatings
  // ======================================================================
  describe('listUserRatings', () => {
    it('retourne la liste paginée des notes de l\'utilisateur', async () => {
      const rawData = [buildRawRating({})];
      prismaServiceMock.user_ratings.findMany.mockResolvedValue(rawData);
      prismaServiceMock.user_ratings.count.mockResolvedValue(1);

      const result = await service.listUserRatings(userId, {});

      expect(result.data).toHaveLength(1);
      expect(result.data[0].id).toBe(ratingId);
      expect(result.total).toBe(1);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
    });

    it('filtre par type (film)', async () => {
      prismaServiceMock.user_ratings.findMany.mockResolvedValue([]);
      prismaServiceMock.user_ratings.count.mockResolvedValue(0);

      await service.listUserRatings(userId, { type: 'film' });

      expect(prismaServiceMock.user_ratings.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            titles: { type: 'film' },
          }),
        }),
      );
    });

    it('filtre par type (serie)', async () => {
      prismaServiceMock.user_ratings.findMany.mockResolvedValue([]);
      prismaServiceMock.user_ratings.count.mockResolvedValue(0);

      await service.listUserRatings(userId, { type: 'serie' });

      expect(prismaServiceMock.user_ratings.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            titles: { type: 'serie' },
          }),
        }),
      );
    });

    it('verifie la jointure titles.type pour le filtre', async () => {
      prismaServiceMock.user_ratings.findMany.mockResolvedValue([]);
      prismaServiceMock.user_ratings.count.mockResolvedValue(0);

      await service.listUserRatings(userId, { type: 'film' });

      const callArgs =
        prismaServiceMock.user_ratings.findMany.mock.calls[0][0];
      expect(callArgs.where.titles).toBeDefined();
      expect(callArgs.where.titles.type).toBe('film');
    });
  });

  // ======================================================================
  // getTitleRatingsSummary
  // ======================================================================
  describe('getTitleRatingsSummary', () => {
    it('retourne moyenne + count + répartition pour un titre existant', async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue({
        id: titleId,
      });
      prismaServiceMock.user_ratings.findMany.mockResolvedValue([
        { note_perso: 8 },
        { note_perso: 7 },
        { note_perso: 9 },
        { note_perso: 8 },
        { note_perso: 10 },
      ]);

      const result = await service.getTitleRatingsSummary(titleId);

      expect(result.title_id).toBe(titleId);
      expect(result.count).toBe(5);
      expect(result.moyenne).toBe(8.4); // (8+7+9+8+10)/5 = 42/5 = 8.4
      expect(result.repartition[8]).toBe(2);
      expect(result.repartition[7]).toBe(1);
      expect(result.repartition[9]).toBe(1);
      expect(result.repartition[10]).toBe(1);
      expect(result.repartition[1]).toBe(0);
    });

    it('retourne moyenne=null, count=0 si aucune note', async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue({
        id: titleId,
      });
      prismaServiceMock.user_ratings.findMany.mockResolvedValue([]);

      const result = await service.getTitleRatingsSummary(titleId);

      expect(result.title_id).toBe(titleId);
      expect(result.moyenne).toBeNull();
      expect(result.count).toBe(0);
      // Vérifie que la répartition est vide (1-10 → 0)
      for (let i = 1; i <= 10; i++) {
        expect(result.repartition[i]).toBe(0);
      }
    });

    it("lève NotFound si le titre n'existe pas", async () => {
      prismaServiceMock.titles.findUnique.mockResolvedValue(null);

      await expect(
        service.getTitleRatingsSummary('nonexistent'),
      ).rejects.toThrow(NotFoundException);
    });
  });
});

