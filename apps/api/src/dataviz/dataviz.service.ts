import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { WatchTimeQueryDto } from './dto/watch-time-query.dto';
import { WatchCountQueryDto } from './dto/watch-count-query.dto';

/**
 * Service métier pour le module dataviz (Phase 6.1).
 *
 * Expose les 8 vues matérialisées de la Phase 1.4 via 2 méthodes :
 * - getWatchTime(userId, query) : temps total de visionnage groupé par critère
 * - getWatchCount(userId, query) : nombre de visionnages groupé par critère
 *
 * Les vues matérialisées ne sont pas dans le schéma Prisma (elles vivent en SQL pur).
 * Toute la logique utilise donc prisma.$queryRawUnsafe.
 */
@Injectable()
export class DatavizService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Récupère le temps de visionnage (en minutes) groupé par le critère demandé.
   *
   * Filtrage année :
   * - Vues 'period' : WHERE EXTRACT(YEAR FROM periode_semaine) BETWEEN yearFrom AND yearTo
   * - Vues 'genre', 'country', 'animation' : sous-requête EXISTS sur user_watches
   *   (les MV n'ont pas de colonne date)
   *
   * @param userId - UUID de l'utilisateur connecté
   * @param query - DTO avec groupBy et filtres optionnels
   * @returns Tableau de résultats (dépend du groupBy)
   */
  async getWatchTime(userId: string, query: WatchTimeQueryDto): Promise<any[]> {
    switch (query.groupBy) {
      case 'period':
        return this.getWatchTimeByPeriod(userId, query.yearFrom, query.yearTo);
      case 'genre':
        return this.getWatchTimeByGenre(userId, query.yearFrom, query.yearTo);
      case 'country':
        return this.getWatchTimeByCountry(userId, query.yearFrom, query.yearTo);
      case 'animation':
        return this.getWatchTimeByAnimation(userId, query.yearFrom, query.yearTo);
      default:
        return [];
    }
  }

  /**
   * Récupère le nombre de visionnages groupé par le critère demandé.
   * Même logique de filtrage année que getWatchTime.
   *
   * @param userId - UUID de l'utilisateur connecté
   * @param query - DTO avec groupBy et filtres optionnels
   * @returns Tableau de résultats (dépend du groupBy)
   */
  async getWatchCount(userId: string, query: WatchCountQueryDto): Promise<any[]> {
    switch (query.groupBy) {
      case 'period':
        return this.getWatchCountByPeriod(userId, query.yearFrom, query.yearTo);
      case 'genre':
        return this.getWatchCountByGenre(userId, query.yearFrom, query.yearTo);
      case 'country':
        return this.getWatchCountByCountry(userId, query.yearFrom, query.yearTo);
      case 'animation':
        return this.getWatchCountByAnimation(userId, query.yearFrom, query.yearTo);
      default:
        return [];
    }
  }

  /**
   * Construit une clause ORDER BY sécurisée.
   * Les noms de colonnes sont validés pour éviter les injections SQL.
   */
  private orderBy(col: string): string {
    const whitelist = ['periode_semaine', 'genre_id', 'country_id', 'is_animation'];
    if (whitelist.includes(col)) {
      return ` ORDER BY ${col}`;
    }
    return '';
  }

  // ======================================================================
  // Watch Time
  // ======================================================================

  /**
   * Temps de visionnage groupé par période (semaine).
   * Filtre année via EXTRACT(YEAR) direct sur la MV.
   */
  private async getWatchTimeByPeriod(
    userId: string,
    yearFrom?: number,
    yearTo?: number,
  ): Promise<any[]> {
    let sql = `SELECT * FROM mv_watch_time_by_period WHERE user_id='${userId}'::UUID`;
    if (yearFrom !== undefined || yearTo !== undefined) {
      const from = yearFrom ?? 1900;
      const toVal = yearTo ?? 2100;
      sql += ` AND EXTRACT(YEAR FROM periode_semaine) BETWEEN ${from} AND ${toVal}`;
    }
    sql += this.orderBy('periode_semaine');
    const results = await this.prisma.$queryRawUnsafe<any[]>(sql);
    return results || [];
  }

  /**
   * Temps de visionnage groupé par genre.
   * Filtre année via sous-requête EXISTS sur user_watches → titles → title_genres.
   */
  private async getWatchTimeByGenre(
    userId: string,
    yearFrom?: number,
    yearTo?: number,
  ): Promise<any[]> {
    let sql = `SELECT wtg.* FROM mv_watch_time_by_genre wtg WHERE wtg.user_id='${userId}'::UUID`;
    if (yearFrom !== undefined || yearTo !== undefined) {
      const from = yearFrom ?? 1900;
      const toVal = yearTo ?? 2100;
      sql += ` AND EXISTS (
        SELECT 1 FROM user_watches uw
        JOIN titles t ON t.id = uw.title_id
        JOIN title_genres tg ON tg.title_id = t.id
        WHERE uw.user_id='${userId}'::UUID
        AND tg.genre_id = wtg.genre_id
        AND EXTRACT(YEAR FROM uw.date_vue) BETWEEN ${from} AND ${toVal}
      )`;
    }
    sql += this.orderBy('genre_id');
    const results = await this.prisma.$queryRawUnsafe<any[]>(sql);
    return results || [];
  }

  /**
   * Temps de visionnage groupé par pays.
   * Filtre année via sous-requête EXISTS sur user_watches → titles → title_countries.
   */
  private async getWatchTimeByCountry(
    userId: string,
    yearFrom?: number,
    yearTo?: number,
  ): Promise<any[]> {
    let sql = `SELECT wtc.* FROM mv_watch_time_by_country wtc WHERE wtc.user_id='${userId}'::UUID`;
    if (yearFrom !== undefined || yearTo !== undefined) {
      const from = yearFrom ?? 1900;
      const toVal = yearTo ?? 2100;
      sql += ` AND EXISTS (
        SELECT 1 FROM user_watches uw
        JOIN titles t ON t.id = uw.title_id
        JOIN title_countries tc ON tc.title_id = t.id
        WHERE uw.user_id='${userId}'::UUID
        AND tc.country_id = wtc.country_id
        AND EXTRACT(YEAR FROM uw.date_vue) BETWEEN ${from} AND ${toVal}
      )`;
    }
    sql += this.orderBy('country_id');
    const results = await this.prisma.$queryRawUnsafe<any[]>(sql);
    return results || [];
  }

  /**
   * Temps de visionnage groupé par is_animation.
   * Filtre année via sous-requête EXISTS sur user_watches → titles.
   */
  private async getWatchTimeByAnimation(
    userId: string,
    yearFrom?: number,
    yearTo?: number,
  ): Promise<any[]> {
    let sql = `SELECT wta.* FROM mv_watch_time_by_animation wta WHERE wta.user_id='${userId}'::UUID`;
    if (yearFrom !== undefined || yearTo !== undefined) {
      const from = yearFrom ?? 1900;
      const toVal = yearTo ?? 2100;
      sql += ` AND EXISTS (
        SELECT 1 FROM user_watches uw
        JOIN titles t ON t.id = uw.title_id
        WHERE uw.user_id='${userId}'::UUID
        AND t.is_animation = wta.is_animation
        AND EXTRACT(YEAR FROM uw.date_vue) BETWEEN ${from} AND ${toVal}
      )`;
    }
    sql += this.orderBy('is_animation');
    const results = await this.prisma.$queryRawUnsafe<any[]>(sql);
    return results || [];
  }

  // ======================================================================
  // Watch Count
  // ======================================================================

  /**
   * Nombre de visionnages groupé par période.
   */
  private async getWatchCountByPeriod(
    userId: string,
    yearFrom?: number,
    yearTo?: number,
  ): Promise<any[]> {
    let sql = `SELECT * FROM mv_watch_count_by_period WHERE user_id='${userId}'::UUID`;
    if (yearFrom !== undefined || yearTo !== undefined) {
      const from = yearFrom ?? 1900;
      const toVal = yearTo ?? 2100;
      sql += ` AND EXTRACT(YEAR FROM periode_semaine) BETWEEN ${from} AND ${toVal}`;
    }
    sql += this.orderBy('periode_semaine');
    const results = await this.prisma.$queryRawUnsafe<any[]>(sql);
    return results || [];
  }

  /**
   * Nombre de visionnages groupé par genre.
   */
  private async getWatchCountByGenre(
    userId: string,
    yearFrom?: number,
    yearTo?: number,
  ): Promise<any[]> {
    let sql = `SELECT wcg.* FROM mv_watch_count_by_genre wcg WHERE wcg.user_id='${userId}'::UUID`;
    if (yearFrom !== undefined || yearTo !== undefined) {
      const from = yearFrom ?? 1900;
      const toVal = yearTo ?? 2100;
      sql += ` AND EXISTS (
        SELECT 1 FROM user_watches uw
        JOIN titles t ON t.id = uw.title_id
        JOIN title_genres tg ON tg.title_id = t.id
        WHERE uw.user_id='${userId}'::UUID
        AND tg.genre_id = wcg.genre_id
        AND EXTRACT(YEAR FROM uw.date_vue) BETWEEN ${from} AND ${toVal}
      )`;
    }
    sql += this.orderBy('genre_id');
    const results = await this.prisma.$queryRawUnsafe<any[]>(sql);
    return results || [];
  }

  /**
   * Nombre de visionnages groupé par pays.
   */
  private async getWatchCountByCountry(
    userId: string,
    yearFrom?: number,
    yearTo?: number,
  ): Promise<any[]> {
    let sql = `SELECT wcc.* FROM mv_watch_count_by_country wcc WHERE wcc.user_id='${userId}'::UUID`;
    if (yearFrom !== undefined || yearTo !== undefined) {
      const from = yearFrom ?? 1900;
      const toVal = yearTo ?? 2100;
      sql += ` AND EXISTS (
        SELECT 1 FROM user_watches uw
        JOIN titles t ON t.id = uw.title_id
        JOIN title_countries tc ON tc.title_id = t.id
        WHERE uw.user_id='${userId}'::UUID
        AND tc.country_id = wcc.country_id
        AND EXTRACT(YEAR FROM uw.date_vue) BETWEEN ${from} AND ${toVal}
      )`;
    }
    sql += this.orderBy('country_id');
    const results = await this.prisma.$queryRawUnsafe<any[]>(sql);
    return results || [];
  }

  /**
   * Nombre de visionnages groupé par is_animation.
   */
  private async getWatchCountByAnimation(
    userId: string,
    yearFrom?: number,
    yearTo?: number,
  ): Promise<any[]> {
    let sql = `SELECT wca.* FROM mv_watch_count_by_animation wca WHERE wca.user_id='${userId}'::UUID`;
    if (yearFrom !== undefined || yearTo !== undefined) {
      const from = yearFrom ?? 1900;
      const toVal = yearTo ?? 2100;
      sql += ` AND EXISTS (
        SELECT 1 FROM user_watches uw
        JOIN titles t ON t.id = uw.title_id
        WHERE uw.user_id='${userId}'::UUID
        AND t.is_animation = wca.is_animation
        AND EXTRACT(YEAR FROM uw.date_vue) BETWEEN ${from} AND ${toVal}
      )`;
    }
    sql += this.orderBy('is_animation');
    const results = await this.prisma.$queryRawUnsafe<any[]>(sql);
    return results || [];
  }
}

