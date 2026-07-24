import { Controller, Post, Get, Param, UseGuards, Logger, Body } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { AdminGuard } from '../admin/admin.guard';
import { RecommenderService } from './recommender.service';
import { ComputeRecsDto } from './dto/compute-recs.dto';

@UseGuards(JwtAuthGuard, AdminGuard)
@Controller('admin')
export class RecommenderController {
  private readonly logger = new Logger(RecommenderController.name);

  constructor(private readonly recommenderService: RecommenderService) {}

  @Post('compute-recommendations')
  async computeRecommendations(@Body() dto: ComputeRecsDto) {
    this.logger.log(`Déclenchement calcul recommandations mode=${dto.mode}`);
    return this.recommenderService.startRecommendations(dto.mode);
  }

  @Get('compute-recommendations/:jobId/status')
  async getJobStatus(@Param('jobId') jobId: string) {
    return this.recommenderService.getJobStatus(jobId);
  }

  @Get('recommendations/stats')
  async getStats() {
    return this.recommenderService.getStats();
  }
}
