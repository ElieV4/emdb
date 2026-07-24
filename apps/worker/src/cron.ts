import { Queue } from 'bullmq';
import { RECOMMENDATIONS_QUEUE_NAME } from './recommendations.worker';
import { buildRedisConnection } from './worker';

export async function scheduleMonthlyRecs(redisUrl: string) {
  const queue = new Queue(RECOMMENDATIONS_QUEUE_NAME, {
    connection: buildRedisConnection(redisUrl),
  });

  await queue.upsertJobScheduler(
    'compute-recommendations-cron',
    { pattern: '0 3 1 * *' },
    { data: { mode: 'all' } },
  );
}
