import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Queue } from 'bullmq';
import { CRON_QUEUE_NAME, buildRedisConnection } from './bullmq.config';

/**
 * Service admin – Phase 6.2
 *
 * Responsable de l'ajout de jobs à la queue BullMQ `tmdb-cron`
 * pour le rafraîchissement des vues matérialisées.
 *
 * La queue `tmdb-cron` existe déjà dans apps/worker/src/worker.ts
 * et le worker `createCronWorker` traite déjà le job `refresh-materialized-views`.
 * Ce service se contente d'y ajouter un job depuis l'API.
 */
@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);
  private cronQueue: Queue | null = null;

  constructor(private readonly configService: ConfigService) {}

  /**
   * Retourne (et cache) une instance de Queue BullMQ pointant sur la
   * queue `tmdb-cron` existante.
   */
  private getCronQueue(): Queue {
    if (!this.cronQueue) {
      const redisUrl =
        this.configService.get<string>('REDIS_URL') ?? 'redis://localhost:6379';
      const connection = buildRedisConnection(redisUrl);
      this.cronQueue = new Queue(CRON_QUEUE_NAME, { connection });
    }
    return this.cronQueue;
  }

  /**
   * Ajoute un job de rafraîchissement des vues matérialisées à la queue
   * `tmdb-cron`. Le worker le traitera dès que possible.
   *
   * @returns Les infos du job créé (jobId, status)
   */
  async refreshMaterializedViews(): Promise<{
    jobId: string | undefined;
    status: string;
    message: string;
  }> {
    const queue = this.getCronQueue();

    this.logger.log(
      'Ajout d’un job refresh-materialized-views à la queue tmdb-cron',
    );

    const job = await queue.add(
      'refresh-materialized-views',
      { type: 'refresh-materialized-views' },
      {
        removeOnComplete: true,
        removeOnFail: false,
        attempts: 3,
        backoff: {
          type: 'exponential',
          delay: 10_000,
        },
      },
    );

    this.logger.log(`Job refresh-materialized-views créé : jobId=${job.id}`);

    return {
      jobId: job.id,
      status: 'queued',
      message: 'Rafraîchissement des vues matérialisées planifié',
    };
  }
}

