import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { SeasonsEpisodesController } from './seasons-episodes.controller';
import { SeasonsEpisodesService } from './seasons-episodes.service';

@Module({
  imports: [PrismaModule],
  controllers: [SeasonsEpisodesController],
  providers: [SeasonsEpisodesService],
  exports: [SeasonsEpisodesService],
})
export class SeasonsEpisodesModule {}
