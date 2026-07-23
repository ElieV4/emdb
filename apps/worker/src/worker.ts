import Redis from 'ioredis';
import { Queue, Worker, JobScheduler, JobsOptions } from 'bullmq';
import { prisma } from '@emdb/db';
import {
  importTitleByTmdbId,
  importSeasonsForSerie,
  refreshTitleData,
  dailySyncNewEpisodes,
  weeklyResyncChanges,
} from '@emdb/tmdb-sync';

export type ImportJobData =
  | { type: 'import-title'; tmdb_id: number; title_type: 'film' | 'serie' }
  | { type: 'import-seasons'; title_id: string }
  | { type: 'refresh-title'; title_id: string };

export type CronJobData =
  | { type: 'daily-sync-new-episodes' }
  | { type: 'weekly-resync-changes'; startDate?: string; endDate?: string }
  | { type: 'refresh-materialized-views' };

export const IMPORT_QUEUE_NAME = 'tmdb-import';
export const CRON_QUEUE_NAME = 'tmdb-cron';

export const DEFAULT_WORKER_CONCURRENCY = 5;

const MATERIALIZED_VIEWS = [
  'mv_watch_time_by_period',
  'mv_watch_time_by_genre',
  'mv_watch_time_by_country',
  'mv_watch_time_by_animation',
  'mv_watch_count_by_genre',
  'mv_watch_count_by_period',
  'mv_watch_count_by_country',
  'mv_watch_count_by_animation',
];

export function buildRedisConnection(redisUrl: string) {
  return new Redis(redisUrl);
}

export function getWeeklyResyncRange() {
  const endDate = new Date();
  const startDate = new Date(endDate);
  startDate.setDate(startDate.getDate() - 7);

  return {
    startDate: startDate.toISOString().split('T')[0],
    endDate: endDate.toISOString().split('T')[0],
  };
}

export async function refreshMaterializedViews() {
  for (const viewName of MATERIALIZED_VIEWS) {
    await prisma.$executeRawUnsafe(`REFRESH MATERIALIZED VIEW CONCURRENTLY ${viewName};`);
  }
}

export function getCronRepeatJobs() {
  return [
    {
      name: 'daily-sync-new-episodes',
      data: {},
      options: {
        jobId: 'daily-sync-new-episodes',
        repeat: { cron: '0 2 * * *' },
        removeOnComplete: true,
        removeOnFail: true,
      } as JobsOptions,
    },
    {
      name: 'weekly-resync-changes',
      data: {},
      options: {
        jobId: 'weekly-resync-changes',
        repeat: { cron: '0 3 * * 1' },
        removeOnComplete: true,
        removeOnFail: true,
      } as JobsOptions,
    },
    {
      name: 'refresh-materialized-views',
      data: {},
      options: {
        jobId: 'refresh-materialized-views',
        repeat: { cron: '0 4 * * *' },
        removeOnComplete: true,
        removeOnFail: true,
      } as JobsOptions,
    },
  ];
}

export function createImportQueue(redisUrl: string) {
  return new Queue(IMPORT_QUEUE_NAME, {
    connection: buildRedisConnection(redisUrl),
  });
}

export function createCronQueue(redisUrl: string) {
  return new Queue(CRON_QUEUE_NAME, {
    connection: buildRedisConnection(redisUrl),
  });
}

export function createImportWorker(redisUrl: string) {
  const connection = buildRedisConnection(redisUrl);
  new JobScheduler(IMPORT_QUEUE_NAME, { connection });

  return new Worker(
    IMPORT_QUEUE_NAME,
    async (job) => {
      const data = job.data as ImportJobData;

      switch (data.type) {
        case 'import-title':
          return importTitleByTmdbId(data.tmdb_id, data.title_type);
        case 'import-seasons':
          return importSeasonsForSerie(data.title_id);
        case 'refresh-title':
          return refreshTitleData(data.title_id);
        default:
          throw new Error(`Unsupported import job type: ${(data as any).type}`);
      }
    },
    {
      connection,
      concurrency: DEFAULT_WORKER_CONCURRENCY,
      lockDuration: 600_000,
    },
  );
}

export function createCronWorker(redisUrl: string) {
  const connection = buildRedisConnection(redisUrl);
  new JobScheduler(CRON_QUEUE_NAME, { connection });

  return new Worker(
    CRON_QUEUE_NAME,
    async (job) => {
      const data = job.data as CronJobData;

      switch (data.type) {
        case 'daily-sync-new-episodes':
          return dailySyncNewEpisodes();
        case 'weekly-resync-changes': {
          const { startDate, endDate } = data;
          if (startDate && endDate) {
            return weeklyResyncChanges(startDate, endDate);
          }
          const range = getWeeklyResyncRange();
          return weeklyResyncChanges(range.startDate, range.endDate);
        }
        case 'refresh-materialized-views':
          return refreshMaterializedViews();
        default:
          throw new Error(`Unsupported cron job type: ${(data as any).type}`);
      }
    },
    {
      connection,
      concurrency: 1,
      lockDuration: 600_000,
    },
  );
}

export async function ensureRepeatableCronJobs(cronQueue: Queue) {
  const repeatJobs = getCronRepeatJobs();

  for (const job of repeatJobs) {
    await cronQueue.add(job.name, job.data, job.options);
  }
}
