import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { PrismaService } from '../prisma/prisma.service';
import { RECOMMENDATIONS_QUEUE_NAME, buildRedisConnection } from './recommender.config';

export type RecomputeMode = 'titles' | 'people' | 'all';

@Injectable()
export class RecommenderService {
  private readonly logger = new Logger(RecommenderService.name);
  private queue: Queue | null = null;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  private getQueue(): Queue {
    if (!this.queue) {
      const redisUrl = this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
      this.queue = new Queue(RECOMMENDATIONS_QUEUE_NAME, {
        connection: buildRedisConnection(redisUrl),
      });
    }
    return this.queue;
  }

  async startRecommendations(mode: RecomputeMode = 'all'): Promise<{
    jobId: string | undefined;
    status: string;
    message: string;
  }> {
    const queue = this.getQueue();
    this.logger.log(
      `Ajout d'un job compute-recommendations à la queue ${RECOMMENDATIONS_QUEUE_NAME}`,
    );

    const job = await queue.add(
      'compute-recommendations',
      { mode },
      {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 0,
      },
    );

    this.logger.log(`Job compute-recommendations créé : jobId=${job.id}`);

    return {
      jobId: job.id,
      status: 'queued',
      message: 'Calcul des recommandations planifié',
    };
  }

  async getJobStatus(jobId: string) {
    const queue = this.getQueue();
    const job = await queue.getJob(jobId);

    if (!job) {
      return {
        jobId,
        status: 'not_found',
      };
    }

    const state = await job.getState();
    const progress = job.progress;
    const result = job.returnvalue;
    const processedOn = job.processedOn;
    const finishedOn = job.finishedOn;

    let durationMs: number | null = null;
    if (processedOn && finishedOn) {
      durationMs = (finishedOn - processedOn) * 1000;
    }

    const response: Record<string, any> = {
      jobId: job.id!,
      status: state,
      progress,
      duration_ms: durationMs,
    };

    if (result) {
      response.result = result;
    }

    return response;
  }

  async getStats() {
    const [totalTitleRecs, totalPersonRecs, titlesWithRecs, peopleWithRecs] = await Promise.all([
      this.countTitleRecommendations(),
      this.countPersonRecommendations(),
      this.countTitlesWithRecs(),
      this.countPeopleWithRecs(),
    ]);

    const lastRun = await this.getLastRun();

    return {
      total_title_recommendations: totalTitleRecs,
      total_person_recommendations: totalPersonRecs,
      titles_with_recs: titlesWithRecs,
      people_with_recs: peopleWithRecs,
      last_run: lastRun,
    };
  }

  private async countTitleRecommendations(): Promise<number> {
    const result = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
      'SELECT COUNT(*) as count FROM title_recommendations',
    );
    return Number(result[0]?.count ?? 0);
  }

  private async countPersonRecommendations(): Promise<number> {
    const result = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
      'SELECT COUNT(*) as count FROM person_recommendations',
    );
    return Number(result[0]?.count ?? 0);
  }

  private async countTitlesWithRecs(): Promise<number> {
    const result = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
      'SELECT COUNT(DISTINCT title_id) as count FROM title_recommendations',
    );
    return Number(result[0]?.count ?? 0);
  }

  private async countPeopleWithRecs(): Promise<number> {
    const result = await this.prisma.$queryRawUnsafe<{ count: bigint }[]>(
      'SELECT COUNT(DISTINCT person_id) as count FROM person_recommendations',
    );
    return Number(result[0]?.count ?? 0);
  }

  private async getLastRun() {
    const queue = this.getQueue();
    const jobs = await queue.getJobs(['completed', 'failed'], 0, 0);
    if (jobs.length === 0) return null;

    const lastJob = jobs[0];
    return {
      started_at: lastJob.processedOn ? new Date(lastJob.processedOn * 1000).toISOString() : null,
      completed_at: lastJob.finishedOn ? new Date(lastJob.finishedOn * 1000).toISOString() : null,
      duration_ms:
        lastJob.processedOn && lastJob.finishedOn
          ? (lastJob.finishedOn - lastJob.processedOn) * 1000
          : null,
      status: lastJob.returnvalue ? 'completed' : 'failed',
      titles_computed: (lastJob.returnvalue as any)?.titlesComputed ?? null,
      people_computed: (lastJob.returnvalue as any)?.peopleComputed ?? null,
    };
  }
}
