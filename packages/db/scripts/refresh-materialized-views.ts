/**
 * Script pour rafraîchir les vues matérialisées — Phase 1.4
 *
 * Exécute `REFRESH MATERIALIZED VIEW CONCURRENTLY` pour chacune des 5 vues
 * dataviz définies dans packages/db/sql/db_init.sql.
 *
 * **À exécuter** :
 * - En cron nocturne (ex: toutes les nuits à 3h)
 * - Après un gros import de données
 * - Manuellement si nécessaire
 *
 * Usage :
 *   npm run refresh:materialized-views
 */

import { prisma } from '../';

// Liste des vues matérialisées à rafraîchir (Phase 1.4)
// 5 vues initiales (v2) + 3 vues supplémentaires (v3) = 8 vues au total
const MATERIALIZED_VIEWS = [
  // Vues "watch_time" (durée de visionnage)
  'mv_watch_time_by_period',
  'mv_watch_time_by_genre',
  'mv_watch_time_by_country',
  'mv_watch_time_by_animation',
  // Vues "watch_count" (nombre de visionnages)
  'mv_watch_count_by_genre',
  'mv_watch_count_by_period',
  'mv_watch_count_by_country',
  'mv_watch_count_by_animation',
];

/**
 * Rafraîchit une vue matérialisée avec CONCURRENTLY.
 *
 * **Note** : CONCURRENTLY nécessite un index UNIQUE sur la vue (déjà présent dans db_init.sql).
 * Cela permet de rafraîchir sans bloquer les lectures.
 *
 * @param viewName - Nom de la vue matérialisée
 * @returns Promesse résolue lorsque le rafraîchissement est terminé
 */
async function refreshView(viewName: string): Promise<void> {
  console.log(`[refresh-materialized-views] → Rafraîchissement de ${viewName}...`);

  try {
    await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName};`);
    console.log(`[refresh-materialized-views] ✓ ${viewName} rafraîchie avec succès.`);
  } catch (error) {
    console.error(`[refresh-materialized-views] ✗ Échec pour ${viewName} :`, error);
    throw error;
  }
}

/**
 * Rafraîchit toutes les vues matérialisées.
 *
 * **Durée estimée** : Dépend de la taille des données, généralement < 1 minute.
 * **Idempotent** : Peut être relancé sans problème.
 */
async function refreshAllMaterializedViews(): Promise<void> {
  console.log(
    `[refresh-materialized-views] Début du rafraîchissement de ${MATERIALIZED_VIEWS.length} vues...`,
  );

  for (const viewName of MATERIALIZED_VIEWS) {
    await refreshView(viewName);
  }

  console.log('[refresh-materialized-views] ✓ Toutes les vues matérialisées rafraîchies.');
}

/**
 * Point d'entrée principal.
 *
 * **Exemple de cron** (à configurer dans votre orchestrateur) :
 * ```bash
 * # Tous les jours à 3h du matin
 * 0 3 * * * npm run refresh:materialized-views
 * ```
 */
async function main() {
  try {
    await refreshAllMaterializedViews();
  } catch (error) {
    console.error('[refresh-materialized-views] Erreur fatale:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
