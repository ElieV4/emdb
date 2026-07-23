jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    on: jest.fn(),
    disconnect: jest.fn(),
    duplicate: jest.fn().mockReturnThis(),
  }));
});

jest.mock('bullmq', () => {
  class MockQueue {
    name: string;

    constructor(name: string) {
      this.name = name;
    }

    async close() {
      return undefined;
    }
  }

  class MockWorker {}
  class MockJobScheduler {}

  return {
    Queue: MockQueue,
    Worker: MockWorker,
    JobScheduler: MockJobScheduler,
  };
});

import { createImportQueue, createCronQueue, getCronRepeatJobs, IMPORT_QUEUE_NAME, CRON_QUEUE_NAME } from './worker';

describe('worker queue helpers', () => {
  const redisUrl = 'redis://localhost:6379';
  let importQueue: ReturnType<typeof createImportQueue> | null = null;
  let cronQueue: ReturnType<typeof createCronQueue> | null = null;

  afterEach(async () => {
    if (importQueue) {
      await importQueue.close();
      importQueue = null;
    }
    if (cronQueue) {
      await cronQueue.close();
      cronQueue = null;
    }
  });

  it('should create import and cron queue objects', async () => {
    importQueue = createImportQueue(redisUrl);
    cronQueue = createCronQueue(redisUrl);

    expect(importQueue.name).toBe(IMPORT_QUEUE_NAME);
    expect(cronQueue.name).toBe(CRON_QUEUE_NAME);
  });

  it('should expose cron repeat jobs', () => {
    const jobs = getCronRepeatJobs();

    expect(jobs).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'daily-sync-new-episodes' }),
        expect.objectContaining({ name: 'weekly-resync-changes' }),
        expect.objectContaining({ name: 'refresh-materialized-views' }),
      ]),
    );
  });
});
