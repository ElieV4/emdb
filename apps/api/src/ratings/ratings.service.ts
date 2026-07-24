import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UpsertRatingDto } from './dto/upsert-rating.dto';
import { ListRatingsFilterDto } from './dto/list-ratings-filter.dto';

/**
 * Interface pour le retour paginé des notes.
 */
export interface PaginatedRatings {
  data: Array<{
    id: string;
    note_perso: number | null;
    commentaire: string | null;
    created_at: Date;
    updated_at: Date;
    title?: {
      id: string;
      tmdb_id: number | null;
      titre_vo: string;
      titre_vf: string | null;
      affiche_url: string | null;
      type: string;
    };
    episode?: {
      id: string;
      numero: number;
      titre: string | null;
      season?: { numero: number };
    };
  }>;
  total: number;
  page: number;
  limit: number;
}

/**
 * Interface pour le résumé public des notes d'un titre.
 */
export interface TitleRatingsSummary {
  title_id: string;
  moyenne: number | null;
  count: number;
  repartition: Record<number, number>;
}

/**
 * Type helper pour mapper un rating Prisma vers le format attendu.
 */
interface RawRating {
  id: string;
  note_perso: any; // Decimal | null
  commentaire: string | null;
  created_at: Date;
  updated_at: Date;
  titles: {
    id: string;
    tmdb_id: number | null;
    titre_vo: string;
    titre_vf: string | null;
    affiche_url: string | null;
    type: string;
  } | null;
  episodes: {
    id: string;
    numero: number;
    titre: string | null;
    seasons: { numero: number } | null;
  } | null;
}

/**
 * Service métier pour le module ratings (Phase 4.2).
 *
 * Gère :
 * - L'upsert d'une note (PUT /ratings) via contrainte UNIQUE Prisma
 * - La suppression avec vérification d'appartenance (DELETE /ratings/:id)
 * - La liste paginée des notes de l'utilisateur (GET /ratings)
 * - Le résumé public des notes d'un titre (GET /titles/:id/ratings)
 */
@Injectable()
export class RatingsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Formate un rating Prisma brut en sortie normalisée.
   */
  private formatRating(rating: RawRating) {
    return {
      id: rating.id,
      note_perso: rating.note_perso ? Number(rating.note_perso) : null,
      commentaire: rating.commentaire,
      created_at: rating.created_at,
      updated_at: rating.updated_at,
      title: rating.titles ?? undefined,
      episode: rating.episodes
        ? {
            id: rating.episodes.id,
            numero: rating.episodes.numero,
            titre: rating.episodes.titre,
            season: rating.episodes.seasons ?? undefined,
          }
        : undefined,
    };
  }

  // ======================================================================
  // UPSERT
  // ======================================================================

  /**
   * Crée ou met à jour une note (upsert).
   *
   * Validation :
   * - Soit title_id, soit episode_id (pas les deux, pas aucun)
   * - Au moins un champ optionnel (note_perso, commentaire) doit être présent
   * - Si title_id fourni, le titre doit exister
   * - Si episode_id fourni, l'épisode doit exister
   *
   * Stratégie : recherche d'un existant via (user_id, title_id) ou (user_id, episode_id),
   * puis UPDATE ou CREATE selon le résultat.
   *
   * @param userId - UUID de l'utilisateur connecté
   * @param dto - Données de la note
   * @returns La note créée ou mise à jour
   */
  async upsertRating(userId: string, dto: UpsertRatingDto) {
    const { title_id, episode_id, note_perso, commentaire } = dto;

    // Validation : soit title_id, soit episode_id, pas les deux, pas aucun
    if (!title_id && !episode_id) {
      throw new BadRequestException("Vous devez fournir 'title_id' ou 'episode_id'.");
    }

    if (title_id && episode_id) {
      throw new BadRequestException(
        "Vous ne pouvez pas fournir 'title_id' et 'episode_id' en même temps.",
      );
    }

    // Au moins un champ optionnel doit être présent
    if (note_perso === undefined && commentaire === undefined) {
      throw new BadRequestException("Vous devez fournir au moins 'note_perso' ou 'commentaire'.");
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

    // Chercher un existant
    let existing: any = null;
    if (title_id) {
      existing = await this.prisma.user_ratings.findUnique({
        where: { user_id_title_id: { user_id: userId, title_id } },
      });
    } else if (episode_id) {
      existing = await this.prisma.user_ratings.findUnique({
        where: { user_id_episode_id: { user_id: userId, episode_id } },
      });
    }

    const data: any = {};

    if (note_perso !== undefined) {
      data.note_perso = note_perso;
    }

    if (commentaire !== undefined) {
      data.commentaire = commentaire;
    }

    const include = {
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
    } as const;

    if (existing) {
      // UPDATE
      const updated = await this.prisma.user_ratings.update({
        where: { id: existing.id },
        data,
        include,
      });
      return this.formatRating(updated as unknown as RawRating);
    }

    // CREATE
    const created = await this.prisma.user_ratings.create({
      data: {
        user_id: userId,
        title_id: title_id ?? null,
        episode_id: episode_id ?? null,
        note_perso: note_perso ?? null,
        commentaire: commentaire ?? null,
      },
      include,
    });
    return this.formatRating(created as unknown as RawRating);
  }

  // ======================================================================
  // DELETE
  // ======================================================================

  /**
   * Supprime une note (hard delete).
   *
   * Vérifie que la note existe et appartient à l'utilisateur connecté.
   *
   * @param id - UUID de la note
   * @param userId - UUID de l'utilisateur connecté
   */
  async deleteRating(id: string, userId: string): Promise<void> {
    const rating = await this.prisma.user_ratings.findUnique({
      where: { id },
      select: { id: true, user_id: true },
    });

    if (!rating) {
      throw new NotFoundException('Note introuvable.');
    }

    if (rating.user_id !== userId) {
      throw new ForbiddenException('Cette note ne vous appartient pas.');
    }

    await this.prisma.user_ratings.delete({ where: { id } });
  }

  // ======================================================================
  // LIST USER RATINGS
  // ======================================================================

  /**
   * Liste paginée des notes de l'utilisateur connecté.
   *
   * Filtre optionnel par type (film/serie) via jointure avec titles.
   *
   * @param userId - UUID de l'utilisateur connecté
   * @param filters - Filtres et pagination
   * @returns Liste paginée des notes
   */
  async listUserRatings(userId: string, filters: ListRatingsFilterDto): Promise<PaginatedRatings> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const where: any = { user_id: userId };

    if (filters.type) {
      // Filtrer par type nécessite une jointure avec titles
      where.titles = { type: filters.type };
    }

    const include = {
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
    } as const;

    const [rawData, total] = await Promise.all([
      this.prisma.user_ratings.findMany({
        where,
        orderBy: { updated_at: 'desc' },
        skip,
        take: limit,
        include,
      }),
      this.prisma.user_ratings.count({ where }),
    ]);

    const data = (rawData as unknown as RawRating[]).map((r) => this.formatRating(r));

    return { data, total, page, limit };
  }

  // ======================================================================
  // TITLE RATINGS SUMMARY (PUBLIC)
  // ======================================================================

  /**
   * Résumé public des notes d'un titre.
   *
   * Accessible sans authentification.
   * Retourne la moyenne, le nombre total de notes, et la répartition
   * des notes de 1 à 10.
   *
   * @param titleId - UUID du titre
   * @returns Résumé des notes
   */
  async getTitleRatingsSummary(titleId: string): Promise<TitleRatingsSummary> {
    // Vérifier que le titre existe
    const title = await this.prisma.titles.findUnique({
      where: { id: titleId },
      select: { id: true },
    });

    if (!title) {
      throw new NotFoundException('Titre introuvable.');
    }

    // Récupérer toutes les notes pour ce titre
    const ratings = await this.prisma.user_ratings.findMany({
      where: { title_id: titleId },
      select: { note_perso: true },
    });

    const count = ratings.length;

    if (count === 0) {
      return {
        title_id: titleId,
        moyenne: null,
        count: 0,
        repartition: this.buildEmptyRepartition(),
      };
    }

    // Calculer la moyenne
    const sum = ratings.reduce((acc, r) => acc + Number(r.note_perso), 0);
    const moyenne = parseFloat((sum / count).toFixed(1));

    // Calculer la répartition (1-10)
    const repartition: Record<number, number> = this.buildEmptyRepartition();
    for (const r of ratings) {
      const note = Math.round(Number(r.note_perso));
      if (note >= 1 && note <= 10) {
        repartition[note]++;
      }
    }

    return {
      title_id: titleId,
      moyenne,
      count,
      repartition,
    };
  }

  /**
   * Construit un objet de répartition vide (1-10 → 0).
   */
  private buildEmptyRepartition(): Record<number, number> {
    const rep: Record<number, number> = {};
    for (let i = 1; i <= 10; i++) {
      rep[i] = 0;
    }
    return rep;
  }
}
