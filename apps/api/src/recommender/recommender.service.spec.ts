import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { RecommenderService } from './recommender.service';
import { Queue } from 'bullmq';

const mockQueueAdd = jest.fn();
const mockQueueGetJob = jest.fn();
const mockQueueGetJobs = jest.fn();

const mockPrismaService = {
  $queryRawUnsafe: jest.fn(),
};

jest.mock('bullmq', () => ({
  Queue: jest.fn().mockImplementation(() => ({
    add: mockQueueAdd,
    getJob: mockQueueGetJob,
    getJobs: mockQueueGetJobs,
    close: jest.fn(),
  })),
}));

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    status: 'ready',
    on: jest.fn(),
  }));
});

describe('RecommenderService', () => {
  let service: RecommenderService;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockPrismaService.$queryRawUnsafe.mockReset();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RecommenderService,
        { provide: ConfigService, useValue: { get: jest.fn(() => 'redis://localhost:6379') } },
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<RecommenderService>(RecommenderService);
  });

  describe('startRecommendations', () => {
    it('ajoute un job à la queue recommendations et retourne jobId', async () => {
      const mockJob = { id: 'job-123' };
      mockQueueAdd.mockResolvedValue(mockJob);

      const result = await service.startRecommendations('all');

      expect(result).toEqual({
        jobId: 'job-123',
        status: 'queued',
        message: 'Calcul des recommandations planifié',
      });

      expect(Queue).toHaveBeenCalledWith('recommendations', {
        connection: expect.any(Object),
      });

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'compute-recommendations',
        { mode: 'all' },
        expect.objectContaining({
          removeOnComplete: true,
          removeOnFail: false,
          attempts: 0,
        }),
      );
    });

    it('utilise le mode titles', async () => {
      mockQueueAdd.mockResolvedValue({ id: 'job-456' });

      await service.startRecommendations('titles');

      expect(mockQueueAdd).toHaveBeenCalledWith(
        'compute-recommendations',
        { mode: 'titles' },
        expect.any(Object),
      );
    });
  });

  describe('getJobStatus', () => {
    it('retourne not_found si le job n existe pas', async () => {
      mockQueueGetJob.mockResolvedValue(null);

      const result = await service.getJobStatus('unknown-job');

      expect(result).toEqual({
        jobId: 'unknown-job',
        status: 'not_found',
      });
    });

    it('retourne le statut complet du job', async () => {
      const mockJob = {
        id: 'job-123',
        getState: jest.fn().mockResolvedValue('completed'),
        progress: 100,
        returnvalue: { titlesComputed: 500, peopleComputed: 200 },
        processedOn: 1000000,
        finishedOn: 1000500,
      };
      mockQueueGetJob.mockResolvedValue(mockJob);

      const result = await service.getJobStatus('job-123');

      expect(result.status).toBe('completed');
      expect(result.progress).toBe(100);
      expect(result.result).toEqual({ titlesComputed: 500, peopleComputed: 200 });
      expect(result.duration_ms).toBe(500000);
    });
  });
});
