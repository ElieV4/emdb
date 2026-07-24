/**
 * Recommender Module - BullMQ Configuration
 * Phase 5.2: Module API recommandations + BullMQ
 *
 * Configuration partagée entre l'API (déclenchement) et le worker (traitement)
 * pour la queue de recommandations.
 */
import { buildRedisConnection as buildRedisConnectionFromAdmin } from '../admin/bullmq.config';

/**
 * Nom de la queue BullMQ utilisée pour les jobs de calcul de recommandations.
 * Doit correspondre à RECOMMENDATIONS_QUEUE_NAME dans apps/worker/src/recommendations.worker.ts.
 */
export const RECOMMENDATIONS_QUEUE_NAME = 'recommendations';

/**
 * Réutilise la fonction buildRedisConnection du module admin pour éviter la duplication.
 * Même logique que buildRedisConnection() dans apps/worker/src/worker.ts.
 */
export const buildRedisConnection = buildRedisConnectionFromAdmin;
