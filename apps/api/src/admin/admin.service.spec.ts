import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { AdminService } from './admin.service';
import { Queue } from 'bullmq';

// Mock de Queue BullMQ
const mockQueueAdd = jest.fn();
const mockQueueClose = jest.fn();

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    close: mockQueueClose,
  })),
}));

// Mock de ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    status: 'ready',
    on: jest.fn(),
  }));
});

describe('AdminService', () => {
  let service: AdminService;
  let configService: ConfigService;

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AdminService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string, defaultValue?: string) => {
              if (key === 'REDIS_URL') return 'redis://localhost:6379';
              return defaultValue;
            }),
          },
        },
      ],
    }).compile();

    service = module.get<AdminService>(AdminService);
    configService = module.get<ConfigService>(ConfigService);
  });

  describe('refreshMaterializedViews', () => {
    it('ajoute un job à la queue tmdb-cron et retourne jobId', async () => {
      const mockJob = { id: 'job-123' };
      mockQueueAdd.mockResolvedValue(mockJob);

      const result = await service.refreshMaterializedViews();

      expect(result).toEqual({
        jobId: 'job-123',
        status: 'queued',
        message: 'Rafraîchissement des vues matérialisées planifié',
      });

      expect(Queue).toHaveBeenCalledWith('tmdb-cron', {
        connection: expect.any(Object),
      });

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'refresh-materialized-views',
        { type: 'refresh-materialized-views' },
        expect.objectContaining({
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 3,
        }),
      );
    });

    it('utilise REDIS_URL de ConfigService', async () => {
      const configGetSpy = jest.spyOn(configService, 'get');
      mockQueueAdd.mockResolvedValue({ id: 'job-456' });

      await service.refreshMaterializedViews();

      expect(configGetSpy).toHaveBeenCalledWith('REDIS_URL');
      expect(configGetSpy).toHaveReturnedWith('redis://localhost:6379');
    });

    it('retourne les infos même si le job est ajouté sans Redis (fallback)', async () => {
      jest.spyOn(configService, 'get').mockReturnValue(undefined);
      mockQueueAdd.mockResolvedValue({ id: 'job-fallback' });

      const result = await service.refreshMaterializedViews();

      expect(result.status).toBe('queued');
      expect(result.jobId).toBe('job-fallback');
    });

    it('gère les erreurs de connexion Redis', async () => {
      mockQueueAdd.mockRejectedValue(new Error('Redis connection refused'));

      await expect(service.refreshMaterializedViews()).rejects.toThrow('Redis connection refused');
    });
  });
});
