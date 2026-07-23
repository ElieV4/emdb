import Redis from 'ioredis';

/**
 * Nom de la queue BullMQ utilisée par le worker pour les jobs cron.
 * Doit correspondre à CRON_QUEUE_NAME dans apps/worker/src/worker.ts.
 */
export const CRON_QUEUE_NAME = 'tmdb-cron';

/**
 * Construit une connexion Redis à partir d'une URL.
 *
 * Même logique que buildRedisConnection() dans apps/worker/src/worker.ts
 * pour garantir la compatibilité.
 *
 * @param redisUrl - URL Redis (redis://localhost:6379)
 * @returns Instance ioredis
 */
export function buildRedisConnection(redisUrl: string): Redis {
  return new Redis(redisUrl);
}

