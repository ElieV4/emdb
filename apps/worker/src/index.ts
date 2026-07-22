/**
 * Point d'entrée du worker.
 * Phase 0 : placeholder qui confirme juste la connexion Redis au démarrage.
 * Les queues BullMQ (tmdb-import, tmdb-cron) seront ajoutées en Phase 2.4.
 */
import Redis from 'ioredis';

async function main() {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';
  const redis = new Redis(redisUrl);

  redis.on('connect', () => {
    // eslint-disable-next-line no-console
    console.log('[worker] connecté à Redis, en attente des queues BullMQ (Phase 2.4)');
  });

  redis.on('error', (err) => {
    // eslint-disable-next-line no-console
    console.error('[worker] erreur Redis :', err.message);
  });
}

main();
