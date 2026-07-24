import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateWatchDto } from './dto/create-watch.dto';
import { ListWatchesFilterDto } from './dto/list-watches-filter.dto';
import { countEpisodesNonVus, getSerieProgress } from '@emdb/db';

/**
 * Service métier pour le module watches (Phase 4.1).
 *
 * Gère :
 * - Les visionnages (user_watches) : créer, supprimer, lister
 * - Le suivi de séries (user_follows_serie) : suivre, ne plus suivre, lister
 * - La progression (fn_progress_serie, fn_episodes_non_vus)
 * - Le calendrier des épisodes non vus
 */
@Injectable()
export class WatchesService {
  constructor(private readonly prisma: PrismaService) {}

  // ======================================================================
  // WATCHES
  // ======================================================================

  /**
   * Marque un titre ou un épisode comme vu.
   *
   * Validation :
   * - Soit title_id, soit episode_id doit être fourni (pas les deux, pas aucun)
   * - Si episode_id fourni, l'épisode doit exister
   * - Si title_id fourni (et pas episode_id), le titre doit exister
   *
   * @param userId - UUID de l'utilisateur connecté
   * @param dto - Données du watch
   * @returns Le watch créé
   */
  async createWatch(userId: string, dto: CreateWatchDto) {
    const { title_id, episode_id, date_vue } = dto;

    // Validation : soit title_id, soit episode_id, pas les deux, pas aucun
    if (!title_id && !episode_id) {
      throw new BadRequestException("Vous devez fournir 'title_id' ou 'episode_id'.");
    }

    if (title_id && episode_id) {
      throw new BadRequestException(
        "Vous ne pouvez pas fournir 'title_id' et 'episode_id' en même temps.",
      );
    }

    // Vérifier que le titre ou l'épisode existe
    if (title_id) {
      const title = await this.prisma.titles.findUnique({
        where: { id: title_id },
        select: { id: true },
      });
      if (!title) {
        throw new NotFoundException('Titre introuvable.');
      }
    }

    if (episode_id) {
      const episode = await this.prisma.episodes.findUnique({
        where: { id: episode_id },
        select: { id: true },
      });
      if (!episode) {
        throw new NotFoundException('Épisode introuvable.');
      }
    }

    return this.prisma.user_watches.create({
      data: {
        user_id: userId,
        title_id: title_id ?? null,
        episode_id: episode_id ?? null,
        date_vue: date_vue ?? new Date(),
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
        episodes: {
          select: {
            id: true,
            numero: true,
            titre: true,
            seasons: { select: { numero: true } },
          },
        },
      },
    });
  }

  /**
   * Supprime un watch (visionnage).
   *
   * @param id - UUID du watch
   * @param userId - UUID de l'utilisateur connecté (vérification d'appartenance)
   */
  async deleteWatch(id: string, userId: string): Promise<void> {
    const watch = await this.prisma.user_watches.findUnique({
      where: { id },
      select: { id: true, user_id: true },
    });

    if (!watch) {
      throw new NotFoundException('Visionnage introuvable.');
    }

    if (watch.user_id !== userId) {
      throw new ForbiddenException('Ce visionnage ne vous appartient pas.');
    }

    await this.prisma.user_watches.delete({ where: { id } });
  }

  /**
   * Liste paginée des visionnages de l'utilisateur.
   *
   * Filtres optionnels : type (film/serie), date_from, date_to, title_id.
   *
   * @param userId - UUID de l'utilisateur connecté
   * @param filters - Filtres et pagination
   * @returns Liste paginée des watches
   */
  async listWatches(userId: string, filters: ListWatchesFilterDto) {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { user_id: userId };

    if (filters.date_from || filters.date_to) {
      where.date_vue = {};
      if (filters.date_from) where.date_vue.gte = filters.date_from;
      if (filters.date_to) where.date_vue.lte = filters.date_to;
    }

    if (filters.title_id) {
      where.title_id = filters.title_id;
    }

    if (filters.type) {
      // Filtrer par type nécessite une jointure avec titles
      where.titles = { type: filters.type };
    }

    const [data, total] = await Promise.all([
      this.prisma.user_watches.findMany({
        where,
        orderBy: { date_vue: 'desc' },
        skip,
        take: limit,
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
          episodes: {
            select: {
              id: true,
              numero: true,
              titre: true,
              seasons: { select: { numero: true } },
            },
          },
        },
      }),
      this.prisma.user_watches.count({ where }),
    ]);

    return { data, total, page, limit };
  }

  // ======================================================================
  // PROGRESSION (PL/pgSQL)
  // ======================================================================

  /**
   * Progression de visionnage par saison pour une série.
   *
   * Appelle la fonction PL/pgSQL fn_progress_serie via @emdb/db.
   *
   * @param userId - UUID de l'utilisateur connecté
   * @param titleId - UUID du titre (doit être une série)
   * @returns Progression par saison
   */
  async getSerieProgress(userId: string, titleId: string) {
    const title = await this.prisma.titles.findUnique({
      where: { id: titleId },
      select: { id: true, type: true },
    });

    if (!title) {
      throw new NotFoundException('Titre introuvable.');
    }

    if (title.type !== 'serie') {
      throw new BadRequestException('La progression est uniquement disponible pour les séries.');
    }

    return getSerieProgress(userId, titleId);
  }

  /**
   * Calendrier des épisodes non vus.
   *
   * Pour chaque série suivie par l'utilisateur, calcule le nombre d'épisodes
   * non vus (fn_episodes_non_vus) et retourne les infos de la série.
   *
   * @param userId - UUID de l'utilisateur connecté
   * @returns Liste des séries suivies avec nb_non_vus
   */
  async getCalendar(userId: string) {
    const followedSeries = await this.prisma.user_follows_serie.findMany({
      where: { user_id: userId },
      include: {
        titles: {
          select: {
            id: true,
            tmdb_id: true,
            titre_vo: true,
            titre_vf: true,
            affiche_url: true,
            next_episode_air_date: true,
          },
        },
      },
    });

    if (followedSeries.length === 0) {
      return [];
    }

    const results = [];

    for (const follow of followedSeries) {
      const nbNonVus = await countEpisodesNonVus(userId, follow.title_id);

      results.push({
        title_id: follow.title_id,
        titre_vo: follow.titles.titre_vo,
        titre_vf: follow.titles.titre_vf,
        affiche_url: follow.titles.affiche_url,
        next_episode_air_date: follow.titles.next_episode_air_date,
        nb_non_vus: nbNonVus,
      });
    }

    // Trier par nb_non_vus décroissant
    results.sort((a, b) => b.nb_non_vus - a.nb_non_vus);

    return results;
  }

  // ======================================================================
  // FOLLOWS
  // ======================================================================

  /**
   * Suivre une série.
   *
   * Vérification applicative : le titre doit être de type 'serie'.
   * La contrainte UNIQUE(user_id, title_id) empêche les doublons.
   *
   * @param userId - UUID de l'utilisateur connecté
   * @param titleId - UUID du titre (doit être une série)
   * @returns Le follow créé
   */
  async follow(userId: string, titleId: string) {
    const title = await this.prisma.titles.findUnique({
      where: { id: titleId },
      select: { id: true, type: true },
    });

    if (!title) {
      throw new NotFoundException('Titre introuvable.');
    }

    if (title.type !== 'serie') {
      throw new BadRequestException('Seules les séries peuvent être suivies.');
    }

    return this.prisma.user_follows_serie.create({
      data: {
        user_id: userId,
        title_id: titleId,
      },
      include: {
        titles: {
          select: {
            id: true,
            tmdb_id: true,
            titre_vo: true,
            titre_vf: true,
            affiche_url: true,
          },
        },
      },
    });
  }

  /**
   * Ne plus suivre une série.
   *
   * @param userId - UUID de l'utilisateur connecté
   * @param titleId - UUID du titre
   */
  async unfollow(userId: string, titleId: string): Promise<void> {
    const follow = await this.prisma.user_follows_serie.findUnique({
      where: {
        user_id_title_id: { user_id: userId, title_id: titleId },
      },
    });

    if (!follow) {
      throw new NotFoundException('Vous ne suivez pas cette série.');
    }

    await this.prisma.user_follows_serie.delete({
      where: {
        user_id_title_id: { user_id: userId, title_id: titleId },
      },
    });
  }

  /**
   * Liste des séries suivies par l'utilisateur.
   *
   * @param userId - UUID de l'utilisateur connecté
   * @returns Liste des séries suivies
   */
  async getFollowedSeries(userId: string) {
    const follows = await this.prisma.user_follows_serie.findMany({
      where: { user_id: userId },
      include: {
        titles: {
          select: {
            id: true,
            tmdb_id: true,
            titre_vo: true,
            titre_vf: true,
            affiche_url: true,
            type: true,
            next_episode_air_date: true,
          },
        },
      },
      orderBy: { followed_at: 'desc' },
    });

    return follows.map((f) => ({
      ...f.titles,
      followed_at: f.followed_at,
    }));
  }
}
