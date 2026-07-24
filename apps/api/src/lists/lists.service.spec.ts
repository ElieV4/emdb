import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { ListsService } from './lists.service';
import { PrismaService } from '../prisma/prisma.service';

const prismaServiceMock = {
  user_lists: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  list_items: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findFirst: jest.fn(),
    findMany: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  },
  list_shares: {
    create: jest.fn(),
    findUnique: jest.fn(),
    findMany: jest.fn(),
    delete: jest.fn(),
  },
  titles: {
    findUnique: jest.fn(),
  },
  users: {
    findUnique: jest.fn(),
  },
  $transaction: jest.fn(),
};

describe('ListsService', () => {
  let service: ListsService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [ListsService, { provide: PrismaService, useValue: prismaServiceMock }],
    }).compile();

    service = module.get<ListsService>(ListsService);
    jest.clearAllMocks();
  });

  const userId = 'user-uuid';
  const listId = 'list-uuid';
  const titleId = 'title-uuid';
  const sharedWithUserId = 'shared-user-uuid';

  // Helpers pour construire les réponses Prisma mock
  const buildList = (overrides: any = {}) => ({
    id: overrides.id ?? listId,
    user_id: overrides.user_id ?? userId,
    nom: overrides.nom ?? 'Ma liste',
    type: overrides.type ?? 'watchlist',
    description: overrides.description ?? null,
    created_at: overrides.created_at ?? new Date('2026-07-23'),
  });

  const buildListItem = (overrides: any = {}) => ({
    list_id: overrides.list_id ?? listId,
    title_id: overrides.title_id ?? titleId,
    position: overrides.position ?? 0,
    added_at: overrides.added_at ?? new Date('2026-07-23'),
    titles: overrides.titles ?? {
      id: titleId,
      tmdb_id: 123,
      titre_vo: 'Test Movie',
      titre_vf: 'Film Test',
      affiche_url: '/poster.jpg',
      type: 'film',
    },
  });

  const buildShare = (overrides: any = {}) => ({
    list_id: overrides.list_id ?? listId,
    shared_with_user_id: overrides.shared_with_user_id ?? sharedWithUserId,
    permission: overrides.permission ?? 'lecture',
    shared_at: overrides.shared_at ?? new Date('2026-07-23'),
    users: overrides.users ?? {
      id: sharedWithUserId,
      pseudo: 'user2',
      avatar_url: null,
    },
  });

  // ======================================================================
  // createList
  // ======================================================================
  describe('createList', () => {
    it('crée une liste de type watchlist', async () => {
      const expected = buildList({ type: 'watchlist' });
      prismaServiceMock.user_lists.create.mockResolvedValue(expected);

      const result = await service.createList(userId, {
        nom: 'Ma liste',
        type: 'watchlist',
      });

      expect(result).toEqual(expected);
      expect(prismaServiceMock.user_lists.create).toHaveBeenCalledWith({
        data: {
          user_id: userId,
          nom: 'Ma liste',
          type: 'watchlist',
          description: null,
        },
      });
    });

    it('crée une liste de type custom avec description', async () => {
      const expected = buildList({
        type: 'custom',
        nom: 'Films préférés',
        description: 'Mes films préférés de 2026',
      });
      prismaServiceMock.user_lists.create.mockResolvedValue(expected);

      const result = await service.createList(userId, {
        nom: 'Films préférés',
        type: 'custom',
        description: 'Mes films préférés de 2026',
      });

      expect(result).toEqual(expected);
      expect(prismaServiceMock.user_lists.create).toHaveBeenCalledWith({
        data: {
          user_id: userId,
          nom: 'Films préférés',
          type: 'custom',
          description: 'Mes films préférés de 2026',
        },
      });
    });

    it('crée une liste (le type est validé par class-validator dans le DTO)', async () => {
      // La validation du type enum est faite par class-validator au niveau du DTO.
      // Le service reçoit le type déjà validé et le passe à Prisma.
      const expected = buildList({ type: 'watchlist', nom: 'Test' });
      prismaServiceMock.user_lists.create.mockResolvedValue(expected);

      const result = await service.createList(userId, {
        nom: 'Test',
        type: 'watchlist',
      });

      expect(result.nom).toBe('Test');
      expect(result.type).toBe('watchlist');
    });
  });

  // ======================================================================
  // getUserLists
  // ======================================================================
  describe('getUserLists', () => {
    it("retourne les listes de l'utilisateur", async () => {
      const lists = [
        buildList({ id: 'list-1', nom: 'Liste 1' }),
        buildList({ id: 'list-2', nom: 'Liste 2' }),
      ];
      prismaServiceMock.user_lists.findMany.mockResolvedValue(lists);

      const result = await service.getUserLists(userId);

      expect(result).toEqual(lists);
      expect(prismaServiceMock.user_lists.findMany).toHaveBeenCalledWith({
        where: { user_id: userId },
        include: { _count: { select: { list_items: true } } },
        orderBy: { created_at: 'desc' },
      });
    });

    it('retourne un tableau vide si aucune liste', async () => {
      prismaServiceMock.user_lists.findMany.mockResolvedValue([]);

      const result = await service.getUserLists(userId);

      expect(result).toEqual([]);
    });
  });

  // ======================================================================
  // getListDetail
  // ======================================================================
  describe('getListDetail', () => {
    it('retourne la liste avec ses items si propriétaire', async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(buildList({ user_id: userId }));
      prismaServiceMock.list_items.findMany.mockResolvedValue([
        buildListItem({ position: 0 }),
        buildListItem({ title_id: 'title-2', position: 1 }),
      ]);

      const result = await service.getListDetail(listId, userId);

      expect(result.id).toBe(listId);
      expect(result.items).toHaveLength(2);
      expect(result.items[0].title_id).toBe(titleId);
      expect(result.items[0].position).toBe(0);
    });

    it('retourne la liste si partagée en lecture', async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(
        buildList({ user_id: 'other-user' }),
      );
      prismaServiceMock.list_shares.findUnique.mockResolvedValue(
        buildShare({ permission: 'lecture' }),
      );
      prismaServiceMock.list_items.findMany.mockResolvedValue([]);

      const result = await service.getListDetail(listId, sharedWithUserId);

      expect(result.id).toBe(listId);
      expect(result.items).toHaveLength(0);
    });

    it('retourne la liste si partagée en édition', async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(
        buildList({ user_id: 'other-user' }),
      );
      prismaServiceMock.list_shares.findUnique.mockResolvedValue(
        buildShare({ permission: 'edition' }),
      );
      prismaServiceMock.list_items.findMany.mockResolvedValue([]);

      const result = await service.getListDetail(listId, sharedWithUserId);

      expect(result.id).toBe(listId);
    });

    it("lève NotFound si la liste n'existe pas", async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(null);

      await expect(service.getListDetail('nonexistent', userId)).rejects.toThrow(NotFoundException);
    });

    it('lève Forbidden si non propriétaire et non partagée', async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(
        buildList({ user_id: 'other-user' }),
      );
      prismaServiceMock.list_shares.findUnique.mockResolvedValue(null);

      await expect(service.getListDetail(listId, userId)).rejects.toThrow(ForbiddenException);
    });
  });

  // ======================================================================
  // updateList
  // ======================================================================
  describe('updateList', () => {
    it('met à jour le nom si propriétaire', async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(buildList({ user_id: userId }));
      prismaServiceMock.user_lists.update.mockResolvedValue(buildList({ nom: 'Nouveau nom' }));

      const result = await service.updateList(listId, userId, {
        nom: 'Nouveau nom',
      });

      expect(result.nom).toBe('Nouveau nom');
      expect(prismaServiceMock.user_lists.update).toHaveBeenCalledWith({
        where: { id: listId },
        data: { nom: 'Nouveau nom' },
      });
    });

    it('met à jour la description si propriétaire', async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(buildList({ user_id: userId }));
      prismaServiceMock.user_lists.update.mockResolvedValue(
        buildList({ description: 'Nouvelle description' }),
      );

      const result = await service.updateList(listId, userId, {
        description: 'Nouvelle description',
      });

      expect(result.description).toBe('Nouvelle description');
    });

    it('lève Forbidden si non propriétaire', async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(
        buildList({ user_id: 'other-user' }),
      );

      await expect(service.updateList(listId, userId, { nom: 'Nouveau nom' })).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ======================================================================
  // deleteList
  // ======================================================================
  describe('deleteList', () => {
    it('supprime la liste si propriétaire', async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(buildList({ user_id: userId }));
      prismaServiceMock.user_lists.delete.mockResolvedValue({});

      await service.deleteList(listId, userId);

      expect(prismaServiceMock.user_lists.delete).toHaveBeenCalledWith({
        where: { id: listId },
      });
    });

    it('lève Forbidden si non propriétaire', async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(
        buildList({ user_id: 'other-user' }),
      );

      await expect(service.deleteList(listId, userId)).rejects.toThrow(ForbiddenException);
    });

    it("lève NotFound si la liste n'existe pas", async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(null);

      await expect(service.deleteList('nonexistent', userId)).rejects.toThrow(NotFoundException);
    });
  });

  // ======================================================================
  // addItem
  // ======================================================================
  describe('addItem', () => {
    it('ajoute un item avec la bonne position (max+1)', async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(buildList({ user_id: userId }));
      prismaServiceMock.titles.findUnique.mockResolvedValue({ id: titleId });
      prismaServiceMock.list_items.findFirst.mockResolvedValue({
        position: 5,
      });
      prismaServiceMock.list_items.create.mockResolvedValue(buildListItem({ position: 6 }));

      const result = await service.addItem(listId, userId, titleId);

      expect(result.position).toBe(6);
      expect(prismaServiceMock.list_items.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ position: 6 }),
        }),
      );
    });

    it('ajoute le premier item (position=0)', async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(buildList({ user_id: userId }));
      prismaServiceMock.titles.findUnique.mockResolvedValue({ id: titleId });
      prismaServiceMock.list_items.findFirst.mockResolvedValue(null);
      prismaServiceMock.list_items.create.mockResolvedValue(buildListItem({ position: 0 }));

      const result = await service.addItem(listId, userId, titleId);

      expect(result.position).toBe(0);
    });

    it("lève Forbidden si pas le droit d'édition (partagé lecture)", async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(
        buildList({ user_id: 'other-user' }),
      );
      prismaServiceMock.list_shares.findUnique.mockResolvedValue(
        buildShare({ permission: 'lecture' }),
      );

      await expect(service.addItem(listId, sharedWithUserId, titleId)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it("lève NotFound si le titre n'existe pas", async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(buildList({ user_id: userId }));
      prismaServiceMock.titles.findUnique.mockResolvedValue(null);

      await expect(service.addItem(listId, userId, 'nonexistent-title')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ======================================================================
  // removeItem
  // ======================================================================
  describe('removeItem', () => {
    it('retire un item existant', async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(buildList({ user_id: userId }));
      prismaServiceMock.list_items.findUnique.mockResolvedValue(buildListItem({}));
      prismaServiceMock.list_items.delete.mockResolvedValue({});

      await service.removeItem(listId, userId, titleId);

      expect(prismaServiceMock.list_items.delete).toHaveBeenCalledWith({
        where: {
          list_id_title_id: { list_id: listId, title_id: titleId },
        },
      });
    });

    it("lève NotFound si l'item n'existe pas dans la liste", async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(buildList({ user_id: userId }));
      prismaServiceMock.list_items.findUnique.mockResolvedValue(null);

      await expect(service.removeItem(listId, userId, 'nonexistent-title')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ======================================================================
  // reorderItems
  // ======================================================================
  describe('reorderItems', () => {
    it('met à jour les positions dans une transaction', async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(buildList({ user_id: userId }));
      prismaServiceMock.list_items.findMany.mockResolvedValue([
        { title_id: 'title-1' },
        { title_id: 'title-2' },
      ]);
      prismaServiceMock.list_items.update.mockReturnValue(Promise.resolve({}));
      prismaServiceMock.$transaction.mockImplementation(async (ops: any[]) => {
        // Vérifie que 2 opérations sont passées à la transaction
        expect(ops).toHaveLength(2);
        return Promise.all(ops);
      });

      await service.reorderItems(listId, userId, {
        items: [
          { title_id: 'title-1', position: 1 },
          { title_id: 'title-2', position: 0 },
        ],
      });

      // Vérifie que list_items.update a été appelé pour chaque item
      expect(prismaServiceMock.list_items.update).toHaveBeenCalledTimes(2);
      // Vérifie les appels avec les bonnes positions
      expect(prismaServiceMock.list_items.update).toHaveBeenCalledWith({
        where: { list_id_title_id: { list_id: listId, title_id: 'title-1' } },
        data: { position: 1 },
      });
      expect(prismaServiceMock.list_items.update).toHaveBeenCalledWith({
        where: { list_id_title_id: { list_id: listId, title_id: 'title-2' } },
        data: { position: 0 },
      });
    });

    it("lève Forbidden si pas le droit d'édition", async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(
        buildList({ user_id: 'other-user' }),
      );
      prismaServiceMock.list_shares.findUnique.mockResolvedValue(
        buildShare({ permission: 'lecture' }),
      );

      await expect(
        service.reorderItems(listId, sharedWithUserId, {
          items: [{ title_id: titleId, position: 0 }],
        }),
      ).rejects.toThrow(ForbiddenException);
    });

    it("lève NotFound si un title_id n'appartient pas à la liste", async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(buildList({ user_id: userId }));
      prismaServiceMock.list_items.findMany.mockResolvedValue([{ title_id: 'title-1' }]);

      await expect(
        service.reorderItems(listId, userId, {
          items: [
            { title_id: 'title-1', position: 0 },
            { title_id: 'title-2', position: 1 },
          ],
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ======================================================================
  // shareList
  // ======================================================================
  describe('shareList', () => {
    it('ajoute un partage', async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(buildList({ user_id: userId }));
      prismaServiceMock.users.findUnique.mockResolvedValue({
        id: sharedWithUserId,
      });
      prismaServiceMock.list_shares.create.mockResolvedValue(buildShare({ permission: 'edition' }));

      const result = await service.shareList(listId, userId, {
        shared_with_user_id: sharedWithUserId,
        permission: 'edition',
      });

      expect(result.permission).toBe('edition');
      expect(prismaServiceMock.list_shares.create).toHaveBeenCalledWith({
        data: {
          list_id: listId,
          shared_with_user_id: sharedWithUserId,
          permission: 'edition',
        },
        include: {
          users: { select: { id: true, pseudo: true, avatar_url: true } },
        },
      });
    });

    it("lève NotFound si shared_with_user_id n'existe pas", async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(buildList({ user_id: userId }));
      prismaServiceMock.users.findUnique.mockResolvedValue(null);

      await expect(
        service.shareList(listId, userId, {
          shared_with_user_id: 'nonexistent',
          permission: 'lecture',
        }),
      ).rejects.toThrow(NotFoundException);
    });

    it('lève Forbidden si non propriétaire', async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(
        buildList({ user_id: 'other-user' }),
      );

      await expect(
        service.shareList(listId, userId, {
          shared_with_user_id: sharedWithUserId,
          permission: 'lecture',
        }),
      ).rejects.toThrow(ForbiddenException);
    });
  });

  // ======================================================================
  // getShares
  // ======================================================================
  describe('getShares', () => {
    it('liste les partages si propriétaire', async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(buildList({ user_id: userId }));
      const shares = [
        buildShare({ shared_with_user_id: 'user-2' }),
        buildShare({ shared_with_user_id: 'user-3' }),
      ];
      prismaServiceMock.list_shares.findMany.mockResolvedValue(shares);

      const result = await service.getShares(listId, userId);

      expect(result).toHaveLength(2);
      expect(prismaServiceMock.list_shares.findMany).toHaveBeenCalledWith({
        where: { list_id: listId },
        include: {
          users: { select: { id: true, pseudo: true, avatar_url: true } },
        },
        orderBy: { shared_at: 'desc' },
      });
    });

    it('lève Forbidden si non propriétaire', async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(
        buildList({ user_id: 'other-user' }),
      );

      await expect(service.getShares(listId, userId)).rejects.toThrow(ForbiddenException);
    });
  });

  // ======================================================================
  // removeShare
  // ======================================================================
  describe('removeShare', () => {
    it('retire un partage si propriétaire', async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(buildList({ user_id: userId }));
      prismaServiceMock.list_shares.findUnique.mockResolvedValue(buildShare({}));
      prismaServiceMock.list_shares.delete.mockResolvedValue({});

      await service.removeShare(listId, userId, sharedWithUserId);

      expect(prismaServiceMock.list_shares.delete).toHaveBeenCalledWith({
        where: {
          list_id_shared_with_user_id: {
            list_id: listId,
            shared_with_user_id: sharedWithUserId,
          },
        },
      });
    });

    it("lève NotFound si le partage n'existe pas", async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(buildList({ user_id: userId }));
      prismaServiceMock.list_shares.findUnique.mockResolvedValue(null);

      await expect(service.removeShare(listId, userId, sharedWithUserId)).rejects.toThrow(
        NotFoundException,
      );
    });

    it('lève Forbidden si non propriétaire', async () => {
      prismaServiceMock.user_lists.findUnique.mockResolvedValue(
        buildList({ user_id: 'other-user' }),
      );

      await expect(service.removeShare(listId, userId, sharedWithUserId)).rejects.toThrow(
        ForbiddenException,
      );
    });
  });

  // ======================================================================
  // getSharedLists
  // ======================================================================
  describe('getSharedLists', () => {
    it("retourne les listes partagées avec l'utilisateur", async () => {
      const shares = [
        {
          list_id: listId,
          permission: 'lecture',
          shared_at: new Date('2026-07-23'),
          user_lists: {
            id: listId,
            nom: 'Liste partagée',
            type: 'watchlist',
            description: null,
            created_at: new Date('2026-07-22'),
            users: { id: 'owner-id', pseudo: 'owner', avatar_url: null },
            _count: { list_items: 3 },
          },
        },
      ];
      prismaServiceMock.list_shares.findMany.mockResolvedValue(shares);

      const result = await service.getSharedLists(sharedWithUserId);

      expect(result).toHaveLength(1);
      expect(result[0].list.nom).toBe('Liste partagée');
      expect(result[0].list.item_count).toBe(3);
      expect(result[0].list.owner.pseudo).toBe('owner');
    });

    it('retourne un tableau vide si aucun partage', async () => {
      prismaServiceMock.list_shares.findMany.mockResolvedValue([]);

      const result = await service.getSharedLists(userId);

      expect(result).toEqual([]);
    });
  });
});
