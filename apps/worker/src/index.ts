/**
 * Point d'entrée du worker.
 * Phase 2.4 : queues BullMQ pour import TMDB et tâches cron.
 */
import {
  createCronQueue,
  createImportWorker,
  createCronWorker,
  ensureRepeatableCronJobs,
} from './worker';
import { createRecommendationsWorker } from './recommendations.worker';
import { scheduleMonthlyRecs } from './cron';

async function main() {
  const redisUrl = process.env.REDIS_URL ?? 'redis://localhost:6379';

  const cronQueue = createCronQueue(redisUrl);

  createImportWorker(redisUrl);
  createCronWorker(redisUrl);
  createRecommendationsWorker(redisUrl);

  await ensureRepeatableCronJobs(cronQueue);
  await scheduleMonthlyRecs(redisUrl);

  console.log('[worker] BullMQ démarré : queues tmdb-import, tmdb-cron et recommendations actives');
}

main().catch((error) => {
  // eslint-disable-next-line no-console
  console.error('[worker] erreur fatale :', error);
  process.exit(1);
});
