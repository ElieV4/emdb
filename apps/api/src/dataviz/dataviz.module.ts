import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { DatavizController } from './dataviz.controller';
import { DatavizService } from './dataviz.service';

@Module({
  imports: [PrismaModule],
  controllers: [DatavizController],
  providers: [DatavizService],
  exports: [DatavizService],
})
export class DatavizModule {}
