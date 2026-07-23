import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { ListTitlesFilterDto } from './dto/list-titles-filter.dto';
import {
  getMovieRecommendations,
  getMovieSimilar,
  getTvRecommendations,
  getTvSimilar,
  searchMovie,
  searchTv,
  TmdbSearchResult,
} from '@emdb/tmdb-client';
import { importTitleByTmdbId, refreshTitleData } from '@emdb/tmdb-sync';

/**
 * Résultat fusionné d'une recherche TMDB + résultats locaux.
 */
export interface TitleSearchResult {
  tmdb_id: number;
  titre_vo: string;
  titre_vf: string | null;
  poster_path: string | null;
  type: 'film' | 'serie';
  local: boolean;
  local_id?: string;
}

/**
 * Résultat paginé d'une liste de titres.
 */
export interface PaginatedTitles {
  data: any[];
  total: number;
  page: number;
  limit: number;
}

/**
 * Service métier pour le module titles (Phase 3.3).
 *
 * Gère la recherche (TMDB + local), l'import "get or import", le détail
 * complet, la liste paginée avec filtres, les recommandations, le rafraîchissement
 * et la suppression conditionnelle (orphan check).
 */
@Injectable()
export class TitlesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Recherche un titre via TMDB + résultats locaux, fusionnés.
   *
   * Appelle tmdb-client.searchMovie/searchTv selon le type, puis recherche
   * localement (titre_vo/titre_vf ILIKE). Marque les résultats déjà présents
   * localement via tmdb_id.
   *
   * @param query - Texte de recherche
   * @param type - 'film' | 'serie' | undefined (recherche les deux si absent)
   * @returns Liste fusionnée de résultats
   */
  async searchTitles(query: string, type?: 'film' | 'serie'): Promise<TitleSearchResult[]> {
    // 1. Appels TMDB
    let tmdbResults: Array<TmdbSearchResult & { type: 'film' | 'serie' }> = [];

    if (type === 'film' || !type) {
      const movieResults = await searchMovie(query);
      tmdbResults = [...tmdbResults, ...movieResults.map((r) => ({ ...r, type: 'film' as const }))];
    }

    if (type === 'serie' || !type) {
      const tvResults = await searchTv(query);
      tmdbResults = [...tmdbResults, ...tvResults.map((r) => ({ ...r, type: 'serie' as const }))];
    }

    // 2. Recherche locale (ILIKE sur titre_vo / titre_vf)
    const localResults = await this.prisma.titles.findMany({
      where: {
        OR: [
          { titre_vo: { contains: query, mode: 'insensitive' } },
          { titre_vf: { contains: query, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        tmdb_id: true,
        titre_vo: true,
        titre_vf: true,
        affiche_url: true,
        type: true,
      },
    });

    // 3. Index local par tmdb_id pour le merge
    const localByTmdbId = new Map<number, any>();
    for (const local of localResults) {
      if (local.tmdb_id) {
        localByTmdbId.set(local.tmdb_id, local);
      }
    }

    // 4. Fusion : marquer les résultats TMDB déjà présents localement
    const merged: TitleSearchResult[] = [];

    for (const tmdb of tmdbResults) {
      const local = localByTmdbId.get(tmdb.id);
      const titreVo = tmdb.title ?? tmdb.name ?? '';
      merged.push({
        tmdb_id: tmdb.id,
        titre_vo: titreVo,
        titre_vf: titreVo || null,
        poster_path: tmdb.poster_path ?? null,
        type: tmdb.type,
        local: !!local,
        local_id: local?.id,
      });
    }

    // 5. Ajouter les résultats locaux sans tmdb_id (import manuel)
    for (const local of localResults) {
      if (!local.tmdb_id) {
        merged.push({
          tmdb_id: 0,
          titre_vo: local.titre_vo,
          titre_vf: local.titre_vf,
          poster_path: local.affiche_url,
          type: local.type as 'film' | 'serie',
          local: true,
          local_id: local.id,
        });
      }
    }

    return merged;
  }

  /**
   * "Get or import" : cherche un titre par tmdb_id, sinon déclenche l'import.
   *
   * @param tmdbId - ID TMDB du titre
   * @param type - 'film' | 'serie'
   * @returns Le titre importé ou existant
   */
  async getOrImportByTmdbId(tmdbId: number, type: 'film' | 'serie') {
    const existing = await this.prisma.titles.findUnique({
      where: { tmdb_id: tmdbId },
    });

    if (existing) {
      return existing;
    }

    // Déclenche l'import via tmdb-sync
    return importTitleByTmdbId(tmdbId, type);
  }

  /**
   * Détail complet d'un titre : titre + genres + pays + studios + saisons (si série).
   *
   * @param id - UUID du titre
   * @returns Le titre avec ses relations
   * @throws NotFoundException si le titre n'existe pas
   */
  async getTitleDetail(id: string) {
    const title = await this.prisma.titles.findUnique({
      where: { id },
      include: {
        title_genres: {
          include: {
            genres: {
              select: { id: true, nom: true, tmdb_id: true },
            },
          },
        },
        title_countries: {
          include: {
            countries: {
              select: { id: true, code: true, nom: true },
            },
          },
        },
        title_studios: {
          include: {
            studios: {
              select: { id: true, nom: true, logo_url: true },
            },
          },
        },
        seasons: {
          orderBy: { numero: 'asc' },
          include: {
            episodes: {
              orderBy: { numero: 'asc' },
            },
          },
        },
      },
    });

    if (!title) {
      throw new NotFoundException('Titre introuvable.');
    }

    return title;
  }

  /**
   * Liste/pagination de titres avec filtres.
   *
   * Filtres : type, genre_id, country_id, is_animation, note_imdb_min
   * Tri : date_sortie | note_imdb (asc/desc)
   *
   * @param filters - DTO de filtres + pagination
   * @returns Résultat paginé
   */
  async listTitles(filters: ListTitlesFilterDto): Promise<PaginatedTitles> {
    const page = filters.page ?? 1;
    const limit = filters.limit ?? 20;
    const skip = (page - 1) * limit;

    const sortBy = filters.sort_by ?? 'date_sortie';
    const sortOrder = filters.sort_order ?? 'desc';

    const where: any = {};

    if (filters.type) {
      where.type = filters.type;
    }

    if (filters.is_animation !== undefined) {
      where.is_animation = filters.is_animation;
    }

    if (filters.note_imdb_min !== undefined) {
      where.note_imdb = { gte: filters.note_imdb_min };
    }

    if (filters.genre_id) {
      where.title_genres = {
        some: { genre_id: filters.genre_id },
      };
    }

    if (filters.country_id) {
      where.title_countries = {
        some: { country_id: filters.country_id },
      };
    }

    const [data, total] = await Promise.all([
      this.prisma.titles.findMany({
        where,
        orderBy: { [sortBy]: sortOrder },
        skip,
        take: limit,
        include: {
          title_genres: {
            include: { genres: { select: { id: true, nom: true } } },
          },
          title_countries: {
            include: { countries: { select: { id: true, code: true, nom: true } } },
          },
        },
      }),
      this.prisma.titles.count({ where }),
    ]);

    return {
      data,
      total,
      page,
      limit,
    };
  }

  /**
   * Recommandations d'un titre.
   *
   * Lit la table title_recommendations. Si vide, fallback sur l'API TMDB
   * (getMovieRecommendations/getMovieSimilar ou getTvRecommendations/getTvSimilar).
   *
   * @param id - UUID du titre
   * @returns Liste de titres recommandés
   * @throws NotFoundException si le titre n'existe pas
   */
  async getRecommendations(id: string) {
    const title = await this.prisma.titles.findUnique({
      where: { id },
      select: { id: true, tmdb_id: true, type: true },
    });

    if (!title) {
      throw new NotFoundException('Titre introuvable.');
    }

    // 1. Vérifier les recommandations locales
    const localRecs = await this.prisma.title_recommendations.findMany({
      where: { title_id: id },
      include: {
        titles_title_recommendations_recommended_idTotitles: {
          select: {
            id: true,
            tmdb_id: true,
            titre_vo: true,
            titre_vf: true,
            affiche_url: true,
            type: true,
            note_imdb: true,
          },
        },
      },
      orderBy: { score: 'desc' },
    });

    if (localRecs.length > 0) {
      return localRecs.map((rec) => rec.titles_title_recommendations_recommended_idTotitles);
    }

    // 2. Fallback TMDB si pas de recommandations locales
    if (!title.tmdb_id) {
      return [];
    }

    let tmdbRecs: any[] = [];
    let tmdbSimilar: any[] = [];

    if (title.type === 'film') {
      const [recs, similar] = await Promise.all([
        getMovieRecommendations(title.tmdb_id),
        getMovieSimilar(title.tmdb_id),
      ]);
      tmdbRecs = recs.results || [];
      tmdbSimilar = similar.results || [];
    } else {
      const [recs, similar] = await Promise.all([
        getTvRecommendations(title.tmdb_id),
        getTvSimilar(title.tmdb_id),
      ]);
      tmdbRecs = recs.results || [];
      tmdbSimilar = similar.results || [];
    }

    // 3. Fusionner et mapper vers titres locaux si présents
    const allRecs = [...tmdbRecs, ...tmdbSimilar];
    const seenIds = new Set<number>();
    const uniqueRecs: any[] = [];

    for (const rec of allRecs) {
      if (rec.id && !seenIds.has(rec.id)) {
        seenIds.add(rec.id);
        uniqueRecs.push(rec);
      }
    }

    const results: any[] = [];
    for (const rec of uniqueRecs) {
      const localTitle = await this.prisma.titles.findUnique({
        where: { tmdb_id: rec.id },
        select: {
          id: true,
          tmdb_id: true,
          titre_vo: true,
          titre_vf: true,
          affiche_url: true,
          type: true,
          note_imdb: true,
        },
      });

      if (localTitle) {
        results.push(localTitle);
      } else {
        // Titre pas encore en local — retourner les infos TMDB de base
        results.push({
          tmdb_id: rec.id,
          titre_vo: rec.title ?? rec.name ?? null,
          titre_vf: rec.title ?? rec.name ?? null,
          affiche_url: rec.poster_path ? `https://image.tmdb.org/t/p/w500${rec.poster_path}` : null,
          type: title.type,
          note_imdb: rec.vote_average ?? null,
        });
      }
    }

    return results;
  }

  /**
   * Rafraîchit les données d'un titre depuis TMDB.
   *
   * Appelle tmdb-sync.refreshTitleData (note, statut, next_episode, etc.)
   * sans ré-importer les credits.
   *
   * @param id - UUID du titre
   * @returns Le titre mis à jour
   */
  async refreshTitle(id: string) {
    const title = await this.prisma.titles.findUnique({
      where: { id },
      select: { id: true, tmdb_id: true },
    });

    if (!title) {
      throw new NotFoundException('Titre introuvable.');
    }

    if (!title.tmdb_id) {
      throw new BadRequestException("Le titre n'a pas de tmdb_id, impossible de rafraîchir.");
    }

    return refreshTitleData(id);
  }

  /**
   * Supprime un titre uniquement s'il est orphelin
   * (aucune user_ratings, user_watches ou list_items ne le référence).
   *
   * @param id - UUID du titre
   * @throws NotFoundException si le titre n'existe pas
   * @throws BadRequestException si le titre a des références
   */
  async deleteIfOrphan(id: string): Promise<void> {
    const title = await this.prisma.titles.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!title) {
      throw new NotFoundException('Titre introuvable.');
    }

    // Vérifier les références
    const [ratingsCount, watchesCount, listItemsCount] = await Promise.all([
      this.prisma.user_ratings.count({ where: { title_id: id } }),
      this.prisma.user_watches.count({ where: { title_id: id } }),
      this.prisma.list_items.count({ where: { title_id: id } }),
    ]);

    const totalRefs = ratingsCount + watchesCount + listItemsCount;

    if (totalRefs > 0) {
      throw new BadRequestException(
        `Le titre ne peut pas être supprimé : il est référencé par ${ratingsCount} note(s), ${watchesCount} visionnage(s) et ${listItemsCount} item(s) de liste.`,
      );
    }

    await this.prisma.titles.delete({ where: { id } });
  }
}
