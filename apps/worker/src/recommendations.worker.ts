import { Worker, JobScheduler } from 'bullmq';
import { computeTitleRecommendations, computePersonRecommendations } from '@emdb/recommender';
import { buildRedisConnection } from './worker';

export type ComputeRecommendationsJobData = {
  mode: 'titles' | 'people' | 'all';
};

export const RECOMMENDATIONS_QUEUE_NAME = 'recommendations';

export function createRecommendationsWorker(redisUrl: string) {
  const connection = buildRedisConnection(redisUrl);
  new JobScheduler(RECOMMENDATIONS_QUEUE_NAME, { connection });

  return new Worker<ComputeRecommendationsJobData>(
    RECOMMENDATIONS_QUEUE_NAME,
    async (job) => {
      const { mode } = job.data;
      let titlesComputed = 0;
      let peopleComputed = 0;

      if (mode === 'titles' || mode === 'all') {
        titlesComputed = await computeTitleRecommendations();
      }
      if (mode === 'people' || mode === 'all') {
        peopleComputed = await computePersonRecommendations();
      }

      return { titlesComputed, peopleComputed };
    },
    {
      connection,
      concurrency: 1,
      lockDuration: 30 * 60 * 1000,
    },
  );
}
