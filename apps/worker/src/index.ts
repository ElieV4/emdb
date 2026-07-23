/**
 * Point d'entrée du worker.
 * Phase 2.4 : queues BullMQ pour import TMDB et tâches cron.
 */
import { createImportQueue, createCronQueue, createImportWorker, createCronWorker, ensureRepeatableCronJobs } from './worker';

async function main() {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

  const importQueue = createImportQueue(redisUrl);
  const cronQueue = createCronQueue(redisUrl);

  createImportWorker(redisUrl);
  createCronWorker(redisUrl);

  await ensureRepeatableCronJobs(cronQueue);

  // eslint-disable-next-line no-console
  console.log('[worker] BullMQ démarré : queues tmdb-import et tmdb-cron actives');
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[worker] erreur fatale :', error);
  process.exit(1);
});
