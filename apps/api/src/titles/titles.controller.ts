import {
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  Param,
  Patch,
  Query,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TitlesService } from './titles.service';
import { SearchTitlesDto } from './dto/search-titles.dto';
import { ListTitlesFilterDto } from './dto/list-titles-filter.dto';

@Controller('titles')
export class TitlesController {
  constructor(private readonly titlesService: TitlesService) {}

  @Get('search')
  async search(@Query() query: SearchTitlesDto) {
    return this.titlesService.searchTitles(query.q, query.type);
  }

  @Get('tmdb/:tmdbId')
  async getOrImport(@Param('tmdbId') tmdbId: string, @Query('type') type: 'film' | 'serie') {
    const id = parseInt(tmdbId, 10);
    if (isNaN(id) || id < 1) {
      throw new NotFoundException('ID TMDB invalide.');
    }
    const titleType = type ?? 'film';
    return this.titlesService.getOrImportByTmdbId(id, titleType);
  }

  @Get(':id')
  async getDetail(@Param('id') id: string) {
    return this.titlesService.getTitleDetail(id);
  }

  @Get()
  async list(@Query() filters: ListTitlesFilterDto) {
    return this.titlesService.listTitles(filters);
  }

  @Get(':id/recommendations')
  async getRecommendations(@Param('id') id: string) {
    return this.titlesService.getRecommendations(id);
  }

  @Patch(':id/refresh')
  @UseGuards(JwtAuthGuard)
  async refresh(@Param('id') id: string) {
    return this.titlesService.refreshTitle(id);
  }

  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async delete(@Param('id') id: string): Promise<void> {
    await this.titlesService.deleteIfOrphan(id);
  }
}
