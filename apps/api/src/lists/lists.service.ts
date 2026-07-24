import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateListDto } from './dto/create-list.dto';
import { UpdateListDto } from './dto/update-list.dto';
import { ReorderDto } from './dto/reorder.dto';
import { ShareListDto } from './dto/share-list.dto';

/**
 * Service métier pour le module lists (Phase 4.3).
 *
 * Gère :
 * - Les listes utilisateur (user_lists) : CRUD
 * - Les items de liste (list_items) : ajout, retrait, réordonnancement
 * - Les partages de liste (list_shares) : partage, consultation, retrait
 * - Les listes partagées avec l'utilisateur (shared-lists)
 *
 * Logique d'accès :
 * - Propriétaire = userId associé à la liste (user_lists.user_id)
 * - Partagé édition = partagé avec permission='edition'
 * - Partagé lecture = partagé avec permission='lecture'
 */
@Injectable()
export class ListsService {
  constructor(private readonly prisma: PrismaService) {}

  // ======================================================================
  // UTILITAIRES D'ACCÈS
  // ======================================================================

  /**
   * Vérifie qu'une liste existe et retourne ses informations de base.
   * Lance NotFound si la liste n'existe pas.
   *
   * @param listId - UUID de la liste
   * @returns La liste brute
   */
  private async findListOrThrow(listId: string) {
    const list = await this.prisma.user_lists.findUnique({
      where: { id: listId },
      select: {
        id: true,
        user_id: true,
        nom: true,
        type: true,
        description: true,
        created_at: true,
      },
    });

    if (!list) {
      throw new NotFoundException('Liste introuvable.');
    }

    return list;
  }

  /**
   * Vérifie l'accès à une liste.
   *
   * @param listId - UUID de la liste
   * @param userId - UUID de l'utilisateur connecté
   * @param requireEdit - Si true, vérifie que l'utilisateur a accès en édition
   * @returns La liste avec ses infos d'accès
   * @throws NotFoundException si la liste n'existe pas
   * @throws ForbiddenException si l'utilisateur n'a pas accès
   */
  private async checkListAccess(listId: string, userId: string, requireEdit = false) {
    const list = await this.prisma.user_lists.findUnique({
      where: { id: listId },
      select: {
        id: true,
        user_id: true,
        nom: true,
        type: true,
        description: true,
        created_at: true,
      },
    });

    if (!list) {
      throw new NotFoundException('Liste introuvable.');
    }

    // Propriétaire => accès total
    if (list.user_id === userId) {
      return { ...list, access: 'owner' as const };
    }

    // Non propriétaire => vérifier les partages
    const share = await this.prisma.list_shares.findUnique({
      where: {
        list_id_shared_with_user_id: {
          list_id: listId,
          shared_with_user_id: userId,
        },
      },
      select: { permission: true },
    });

    if (!share) {
      throw new ForbiddenException("Vous n'avez pas accès à cette liste.");
    }

    if (requireEdit && share.permission !== 'edition') {
      throw new ForbiddenException("Vous n'avez pas les droits d'édition sur cette liste.");
    }

    return { ...list, access: share.permission as 'lecture' | 'edition' };
  }

  // ======================================================================
  // USER_LISTS
  // ======================================================================

  /**
   * POST /lists
   * Crée une nouvelle liste pour l'utilisateur connecté.
   *
   * @param userId - UUID de l'utilisateur connecté
   * @param dto - Données de la liste
   * @returns La liste créée
   */
  async createList(userId: string, dto: CreateListDto) {
    return this.prisma.user_lists.create({
      data: {
        user_id: userId,
        nom: dto.nom,
        type: dto.type,
        description: dto.description ?? null,
      },
    });
  }

  /**
   * GET /lists
   * Liste des listes de l'utilisateur connecté.
   *
   * @param userId - UUID de l'utilisateur connecté
   * @returns Tableau des listes
   */
  async getUserLists(userId: string) {
    return this.prisma.user_lists.findMany({
      where: { user_id: userId },
      include: {
        _count: {
          select: { list_items: true },
        },
      },
      orderBy: { created_at: 'desc' },
    });
  }

  /**
   * GET /lists/:id
   * Détail d'une liste avec ses items (titles).
   * Accessible au propriétaire et aux utilisateurs avec qui la liste est partagée.
   *
   * @param listId - UUID de la liste
   * @param userId - UUID de l'utilisateur connecté
   * @returns La liste avec ses items
   */
  async getListDetail(listId: string, userId: string) {
    const list = await this.checkListAccess(listId, userId, false);

    const items = await this.prisma.list_items.findMany({
      where: { list_id: listId },
      orderBy: { position: 'asc' },
      include: {
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
      },
    });

    return {
      id: list.id,
      nom: list.nom,
      type: list.type,
      description: list.description,
      created_at: list.created_at,
      items: items.map((item) => ({
        title_id: item.title_id,
        position: item.position,
        added_at: item.added_at,
        title: item.titles,
      })),
    };
  }

  /**
   * PATCH /lists/:id
   * Modifie le nom et/ou la description d'une liste.
   * Seul le propriétaire peut modifier les métadonnées.
   *
   * @param listId - UUID de la liste
   * @param userId - UUID de l'utilisateur connecté
   * @param dto - Données de modification
   * @returns La liste modifiée
   */
  async updateList(listId: string, userId: string, dto: UpdateListDto) {
    const list = await this.checkListAccess(listId, userId, false);

    // Seul le propriétaire peut modifier les métadonnées
    if (list.user_id !== userId) {
      throw new ForbiddenException('Seul le propriétaire peut modifier cette liste.');
    }

    const data: any = {};
    if (dto.nom !== undefined) data.nom = dto.nom;
    if (dto.description !== undefined) data.description = dto.description;

    return this.prisma.user_lists.update({
      where: { id: listId },
      data,
    });
  }

  /**
   * DELETE /lists/:id
   * Supprime une liste (cascade sur list_items et list_shares).
   * Seul le propriétaire peut supprimer.
   *
   * @param listId - UUID de la liste
   * @param userId - UUID de l'utilisateur connecté
   */
  async deleteList(listId: string, userId: string): Promise<void> {
    const list = await this.findListOrThrow(listId);

    if (list.user_id !== userId) {
      throw new ForbiddenException('Seul le propriétaire peut supprimer cette liste.');
    }

    await this.prisma.user_lists.delete({
      where: { id: listId },
    });
  }

  // ======================================================================
  // LIST_ITEMS
  // ======================================================================

  /**
   * POST /lists/:listId/items
   * Ajoute un titre à une liste.
   * La position est auto-incrémentée (max(position) + 1).
   * Accessible au propriétaire ou à un utilisateur avec permission 'edition'.
   *
   * @param listId - UUID de la liste
   * @param userId - UUID de l'utilisateur connecté
   * @param titleId - UUID du titre à ajouter
   * @returns L'item créé
   */
  async addItem(listId: string, userId: string, titleId: string) {
    // Vérifier l'accès édition
    await this.checkListAccess(listId, userId, true);

    // Vérifier que le titre existe
    const title = await this.prisma.titles.findUnique({
      where: { id: titleId },
      select: { id: true },
    });

    if (!title) {
      throw new NotFoundException('Titre introuvable.');
    }

    // Trouver la position max actuelle
    const lastItem = await this.prisma.list_items.findFirst({
      where: { list_id: listId },
      orderBy: { position: 'desc' },
      select: { position: true },
    });
    const nextPosition = (lastItem?.position ?? -1) + 1;

    return this.prisma.list_items.create({
      data: {
        list_id: listId,
        title_id: titleId,
        position: nextPosition,
      },
      include: {
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
      },
    });
  }

  /**
   * DELETE /lists/:listId/items/:titleId
   * Retire un titre d'une liste.
   * Accessible au propriétaire ou à un utilisateur avec permission 'edition'.
   *
   * @param listId - UUID de la liste
   * @param userId - UUID de l'utilisateur connecté
   * @param titleId - UUID du titre à retirer
   */
  async removeItem(listId: string, userId: string, titleId: string): Promise<void> {
    // Vérifier l'accès édition
    await this.checkListAccess(listId, userId, true);

    // Vérifier que l'item existe dans la liste
    const item = await this.prisma.list_items.findUnique({
      where: {
        list_id_title_id: { list_id: listId, title_id: titleId },
      },
    });

    if (!item) {
      throw new NotFoundException('Cet item ne fait pas partie de la liste.');
    }

    await this.prisma.list_items.delete({
      where: {
        list_id_title_id: { list_id: listId, title_id: titleId },
      },
    });
  }

  /**
   * PATCH /lists/:listId/items/reorder
   * Réordonnancement batch des items d'une liste.
   * Accessible au propriétaire ou à un utilisateur avec permission 'edition'.
   *
   * @param listId - UUID de la liste
   * @param userId - UUID de l'utilisateur connecté
   * @param dto - Données de réordonnancement
   */
  async reorderItems(listId: string, userId: string, dto: ReorderDto): Promise<void> {
    // Vérifier l'accès édition
    await this.checkListAccess(listId, userId, true);

    // Vérifier que tous les title_id appartiennent bien à la liste
    const existingItems = await this.prisma.list_items.findMany({
      where: { list_id: listId },
      select: { title_id: true },
    });

    const existingTitleIds = new Set(existingItems.map((i) => i.title_id));
    const dtoTitleIds = dto.items.map((i) => i.title_id);

    for (const tid of dtoTitleIds) {
      if (!existingTitleIds.has(tid)) {
        throw new NotFoundException(`Le titre ${tid} ne fait pas partie de la liste.`);
      }
    }

    // Mettre à jour les positions dans une transaction
    await this.prisma.$transaction(
      dto.items.map((item) =>
        this.prisma.list_items.update({
          where: {
            list_id_title_id: { list_id: listId, title_id: item.title_id },
          },
          data: { position: item.position },
        }),
      ),
    );
  }

  // ======================================================================
  // LIST_SHARES
  // ======================================================================

  /**
   * POST /lists/:listId/shares
   * Partage une liste avec un autre utilisateur.
   * Seul le propriétaire peut partager.
   *
   * @param listId - UUID de la liste
   * @param userId - UUID de l'utilisateur connecté (propriétaire)
   * @param dto - Données du partage
   * @returns Le partage créé
   */
  async shareList(listId: string, userId: string, dto: ShareListDto) {
    // Vérifier que la liste existe et appartient à l'utilisateur
    const list = await this.findListOrThrow(listId);
    if (list.user_id !== userId) {
      throw new ForbiddenException('Seul le propriétaire peut partager cette liste.');
    }

    // Vérifier que l'utilisateur destinataire existe
    const targetUser = await this.prisma.users.findUnique({
      where: { id: dto.shared_with_user_id },
      select: { id: true },
    });

    if (!targetUser) {
      throw new NotFoundException('Utilisateur destinataire introuvable.');
    }

    return this.prisma.list_shares.create({
      data: {
        list_id: listId,
        shared_with_user_id: dto.shared_with_user_id,
        permission: dto.permission,
      },
      include: {
        users: {
          select: {
            id: true,
            pseudo: true,
            avatar_url: true,
          },
        },
      },
    });
  }

  /**
   * GET /lists/:listId/shares
   * Liste des partages d'une liste.
   * Seul le propriétaire peut voir les partages.
   *
   * @param listId - UUID de la liste
   * @param userId - UUID de l'utilisateur connecté
   * @returns Tableau des partages
   */
  async getShares(listId: string, userId: string) {
    const list = await this.findListOrThrow(listId);
    if (list.user_id !== userId) {
      throw new ForbiddenException('Seul le propriétaire peut voir les partages.');
    }

    return this.prisma.list_shares.findMany({
      where: { list_id: listId },
      include: {
        users: {
          select: {
            id: true,
            pseudo: true,
            avatar_url: true,
          },
        },
      },
      orderBy: { shared_at: 'desc' },
    });
  }

  /**
   * DELETE /lists/:listId/shares/:sharedWithUserId
   * Retire un partage d'une liste.
   * Seul le propriétaire peut retirer un partage.
   *
   * @param listId - UUID de la liste
   * @param userId - UUID de l'utilisateur connecté (propriétaire)
   * @param sharedWithUserId - UUID de l'utilisateur dont on retire l'accès
   */
  async removeShare(listId: string, userId: string, sharedWithUserId: string): Promise<void> {
    const list = await this.findListOrThrow(listId);
    if (list.user_id !== userId) {
      throw new ForbiddenException('Seul le propriétaire peut retirer un partage.');
    }

    const share = await this.prisma.list_shares.findUnique({
      where: {
        list_id_shared_with_user_id: {
          list_id: listId,
          shared_with_user_id: sharedWithUserId,
        },
      },
    });

    if (!share) {
      throw new NotFoundException('Partage introuvable.');
    }

    await this.prisma.list_shares.delete({
      where: {
        list_id_shared_with_user_id: {
          list_id: listId,
          shared_with_user_id: sharedWithUserId,
        },
      },
    });
  }

  /**
   * GET /shared-lists
   * Liste des listes partagées avec l'utilisateur connecté.
   *
   * @param userId - UUID de l'utilisateur connecté
   * @returns Tableau des listes partagées
   */
  async getSharedLists(userId: string) {
    const shares = await this.prisma.list_shares.findMany({
      where: { shared_with_user_id: userId },
      include: {
        user_lists: {
          include: {
            users: {
              select: {
                id: true,
                pseudo: true,
                avatar_url: true,
              },
            },
            _count: {
              select: { list_items: true },
            },
          },
        },
      },
      orderBy: { shared_at: 'desc' },
    });

    return shares.map((share) => ({
      list_id: share.list_id,
      permission: share.permission,
      shared_at: share.shared_at,
      list: {
        id: share.user_lists.id,
        nom: share.user_lists.nom,
        type: share.user_lists.type,
        description: share.user_lists.description,
        created_at: share.user_lists.created_at,
        item_count: share.user_lists._count.list_items,
        owner: share.user_lists.users,
      },
    }));
  }
}
