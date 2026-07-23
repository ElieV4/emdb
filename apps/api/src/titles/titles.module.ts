import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { TitlesController } from './titles.controller';
import { TitlesService } from './titles.service';

@Module({
  imports: [PrismaModule],
  controllers: [TitlesController],
  providers: [TitlesService],
  exports: [TitlesService],
})
export class TitlesModule {}
