import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TrendsService } from '../services/trends.service';
import { AnalyzeNicheDto, TrendsResponse } from '../dto/trends-dto';

@Controller('trends')
@UseGuards(JwtAuthGuard)
export class TrendsController {
  constructor(private readonly trendsService: TrendsService) {}

  @Get('niche')
  async getTrendsForNiche(
    @Query('niche') niche: string,
    @Query('keywords') keywords: string,
  ): Promise<TrendsResponse> {
    const keywordsArray = keywords.split(',').map(k => k.trim());
    return this.trendsService.getTrendsForNiche(niche, keywordsArray);
  }

  @Post('analyze')
  async analyzeNiche(@Body() analysisData: AnalyzeNicheDto): Promise<{ trends: TrendsResponse; competitors: { url: string; titles: string[]; error?: string }[] }> {
    const { niche, keywords, competitorUrls = [] } = analysisData;
    const trendsData = await this.trendsService.getTrendsForNiche(niche, keywords);
    let competitorData: { url: string; titles: string[]; error?: string }[] = [];
    if (competitorUrls.length > 0) {
      competitorData = await this.trendsService.analyzeCompetitors(competitorUrls);
    }
    return {
      trends: trendsData,
      competitors: competitorData,
    };
  }
}