/// <reference types="jest" />

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

import {
  createImportQueue,
  createCronQueue,
  getCronRepeatJobs,
  IMPORT_QUEUE_NAME,
  CRON_QUEUE_NAME,
  cleanOldNotifications,
  cleanStaleNotifications,
} from './worker';

jest.mock('@emdb/db', () => ({
  prisma: {
    notifications: {
      deleteMany: jest.fn(),
    },
  },
}));

const mockPrisma = jest.requireMock('@emdb/db').prisma;

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
    jest.clearAllMocks();
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
        expect.objectContaining({ name: 'clean-notifications' }),
      ]),
    );
  });
});

describe('notification cleanup functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('cleanOldNotifications should delete read notifications older than 30 days', async () => {
    mockPrisma.notifications.deleteMany.mockResolvedValue({ count: 5 });

    const result = await cleanOldNotifications();

    expect(result).toBe(5);
    expect(mockPrisma.notifications.deleteMany).toHaveBeenCalledWith({
      where: {
        lu: true,
        created_at: { lt: expect.any(Date) },
      },
    });
  });

  it('cleanOldNotifications should return 0 if no notifications to delete', async () => {
    mockPrisma.notifications.deleteMany.mockResolvedValue({ count: 0 });

    const result = await cleanOldNotifications();

    expect(result).toBe(0);
  });

  it('cleanStaleNotifications should delete unread notifications older than 90 days', async () => {
    mockPrisma.notifications.deleteMany.mockResolvedValue({ count: 3 });

    const result = await cleanStaleNotifications();

    expect(result).toBe(3);
    expect(mockPrisma.notifications.deleteMany).toHaveBeenCalledWith({
      where: {
        lu: false,
        created_at: { lt: expect.any(Date) },
      },
    });
  });

  it('cleanStaleNotifications should return 0 if no notifications to delete', async () => {
    mockPrisma.notifications.deleteMany.mockResolvedValue({ count: 0 });

    const result = await cleanStaleNotifications();

    expect(result).toBe(0);
  });
});
