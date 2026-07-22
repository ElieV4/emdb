/**
 * Module des fonctions PL/pgSQL — Phase 1.3
 *
 * Ce module expose les fonctions stockées PostgreSQL définies dans packages/db/sql/db_init.sql.
 * Ces fonctions sont optimisées pour des calculs complexes et doivent être appelées
 * via Prisma.$queryRaw plutôt que réimplémentées côté application.
 *
 * @module db/functions
 */

import { prisma } from '../';

// ============================================================================
// TYPES
// ============================================================================

/**
 * Résultat de fn_episodes_non_vus : nombre d'épisodes non vus
 */
export type EpisodesNonVusResult = number;

/**
 * Résultat de fn_progress_serie : progrès par saison
 */
export interface ProgressSerieResult {
  saison: number; // Numéro de la saison
  vus: number; // Nombre d'épisodes vus dans cette saison
  total: number; // Nombre total d'épisodes dans cette saison
}

// ============================================================================
// FONCTIONS PL/pgSQL
// ============================================================================

/**
 * Compte le nombre d'épisodes **sortis et non vus** par un utilisateur pour une série.
 *
 * **Fonction SQL** : `fn_episodes_non_vus(p_user_id UUID, p_title_id UUID) RETURNS INT`
 *
 * **Utilisation** :
 * - Affichage dans le calendrier (Phase 4)
 * - Notification de nouveaux épisodes
 *
 * @param userId - UUID de l'utilisateur
 * @param titleId - UUID du titre (doit être de type 'serie')
 * @returns Promesse résolue avec le nombre d'épisodes non vus
 *
 * @example
 * ```typescript
 * const count = await countEpisodesNonVus('user-uuid-here', 'title-uuid-here');
 * // => 3 (l'utilisateur a 3 épisodes non vus)
 * ```
 */
export async function countEpisodesNonVus(
  userId: string,
  titleId: string,
): Promise<EpisodesNonVusResult> {
  // PostgreSQL retourne les scalaires sous forme { fn_name: value }
  const result = await prisma.$queryRawUnsafe<{ fn_episodes_non_vus: number }[]>(
    `SELECT fn_episodes_non_vus('${userId}'::UUID, '${titleId}'::UUID) AS fn_episodes_non_vus`,
  );

  if (!result || result.length === 0 || result[0]?.fn_episodes_non_vus === undefined) {
    return 0;
  }

  return result[0].fn_episodes_non_vus;
}

/**
 * Récupère le progrès de visionnage par saison pour une série.
 *
 * **Fonction SQL** : `fn_progress_serie(p_user_id UUID, p_title_id UUID)
 * RETURNS TABLE(saison INT, vus INT, total INT)`
 *
 * **Utilisation** :
 * - Affichage du progrès sur la page détail d'une série (Phase 4)
 * - Calcul du pourcentage de visionnage
 *
 * @param userId - UUID de l'utilisateur
 * @param titleId - UUID du titre (doit être de type 'serie')
 * @returns Promesse résolue avec un tableau de progrès par saison
 *
 * @example
 * ```typescript
 * const progress = await getSerieProgress('user-uuid-here', 'title-uuid-here');
 * // => [{ saison: 1, vus: 10, total: 12 }, { saison: 2, vus: 5, total: 12 }]
 * ```
 */
export async function getSerieProgress(
  userId: string,
  titleId: string,
): Promise<ProgressSerieResult[]> {
  const results = await prisma.$queryRawUnsafe<ProgressSerieResult[]>(
    `SELECT * FROM fn_progress_serie('${userId}'::UUID, '${titleId}'::UUID)`,
  );

  return results || [];
}

export interface WatchTimeByPeriodResult {
  user_id: string;
  periode_semaine: Date;
  periode_mois: Date;
  periode_annee: Date;
  minutes: number;
}

export interface WatchTimeByGenreResult {
  user_id: string;
  genre_id: string;
  minutes: number;
}

export interface WatchTimeByCountryResult {
  user_id: string;
  country_id: string;
  minutes: number;
}

export interface WatchTimeByAnimationResult {
  user_id: string;
  is_animation: boolean;
  minutes: number;
}

export interface WatchCountByGenreResult {
  user_id: string;
  genre_id: string;
  nb_items: number;
}

export interface WatchCountByPeriodResult {
  user_id: string;
  periode_semaine: Date;
  periode_mois: Date;
  periode_annee: Date;
  nb_items: number;
}

export interface WatchCountByCountryResult {
  user_id: string;
  country_id: string;
  nb_items: number;
}

export interface WatchCountByAnimationResult {
  user_id: string;
  is_animation: boolean;
  nb_items: number;
}

export async function getWatchTimeByPeriod(
  userId: string,
): Promise<WatchTimeByPeriodResult[]> {
  const results = await prisma.$queryRawUnsafe<WatchTimeByPeriodResult[]>(
    `SELECT * FROM mv_watch_time_by_period WHERE user_id='${userId}'::UUID ORDER BY periode_semaine`,
  );
  return results || [];
}

export async function getWatchTimeByGenre(
  userId: string,
): Promise<WatchTimeByGenreResult[]> {
  const results = await prisma.$queryRawUnsafe<WatchTimeByGenreResult[]>(
    `SELECT * FROM mv_watch_time_by_genre WHERE user_id='${userId}'::UUID ORDER BY genre_id`,
  );
  return results || [];
}

export async function getWatchTimeByCountry(
  userId: string,
): Promise<WatchTimeByCountryResult[]> {
  const results = await prisma.$queryRawUnsafe<WatchTimeByCountryResult[]>(
    `SELECT * FROM mv_watch_time_by_country WHERE user_id='${userId}'::UUID ORDER BY country_id`,
  );
  return results || [];
}

export async function getWatchTimeByAnimation(
  userId: string,
): Promise<WatchTimeByAnimationResult[]> {
  const results = await prisma.$queryRawUnsafe<WatchTimeByAnimationResult[]>(
    `SELECT * FROM mv_watch_time_by_animation WHERE user_id='${userId}'::UUID ORDER BY is_animation`,
  );
  return results || [];
}

export async function getWatchCountByGenre(
  userId: string,
): Promise<WatchCountByGenreResult[]> {
  const results = await prisma.$queryRawUnsafe<WatchCountByGenreResult[]>(
    `SELECT * FROM mv_watch_count_by_genre WHERE user_id='${userId}'::UUID ORDER BY genre_id`,
  );
  return results || [];
}

export async function getWatchCountByPeriod(
  userId: string,
): Promise<WatchCountByPeriodResult[]> {
  const results = await prisma.$queryRawUnsafe<WatchCountByPeriodResult[]>(
    `SELECT * FROM mv_watch_count_by_period WHERE user_id='${userId}'::UUID ORDER BY periode_semaine`,
  );
  return results || [];
}

export async function getWatchCountByCountry(
  userId: string,
): Promise<WatchCountByCountryResult[]> {
  const results = await prisma.$queryRawUnsafe<WatchCountByCountryResult[]>(
    `SELECT * FROM mv_watch_count_by_country WHERE user_id='${userId}'::UUID ORDER BY country_id`,
  );
  return results || [];
}

export async function getWatchCountByAnimation(
  userId: string,
): Promise<WatchCountByAnimationResult[]> {
  const results = await prisma.$queryRawUnsafe<WatchCountByAnimationResult[]>(
    `SELECT * FROM mv_watch_count_by_animation WHERE user_id='${userId}'::UUID ORDER BY is_animation`,
  );
  return results || [];
}

// ============================================================================
// UTILITAIRES
// ============================================================================

/**
 * Calcule le pourcentage de visionnage global pour une série.
 *
 * @param progress - Résultat de getSerieProgress()
 * @returns Pourcentage (0-100) ou 0 si aucune donnée
 *
 * @example
 * ```typescript
 * const progress = await getSerieProgress(userId, titleId);
 * const percentage = calculateSerieCompletion(progress);
 * // => 75 (75% de la série vue)
 * ```
 */
export function calculateSerieCompletion(progress: ProgressSerieResult[]): number {
  if (!progress || progress.length === 0) {
    return 0;
  }

  const totalVus = progress.reduce((sum, s) => sum + s.vus, 0);
  const totalEpisodes = progress.reduce((sum, s) => sum + s.total, 0);

  if (totalEpisodes === 0) {
    return 0;
  }

  return Math.round((totalVus / totalEpisodes) * 100);
}

/**
 * Calcule le nombre total d'épisodes non vus à partir du progrès.
 * Alternative à countEpisodesNonVus si on a déjà le progrès.
 *
 * @param progress - Résultat de getSerieProgress()
 * @returns Nombre total d'épisodes non vus
 */
export function calculateTotalNonVus(progress: ProgressSerieResult[]): number {
  if (!progress || progress.length === 0) {
    return 0;
  }

  return progress.reduce((sum, s) => sum + (s.total - s.vus), 0);
}

// ============================================================================
// EXPORT
// ============================================================================

export default {
  countEpisodesNonVus,
  getSerieProgress,
  calculateSerieCompletion,
  calculateTotalNonVus,
};
