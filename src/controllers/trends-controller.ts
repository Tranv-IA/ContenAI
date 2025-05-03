// src/controllers/trends.controller.ts
import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TrendsService } from '../services/trends.service';

@Controller('trends')
@UseGuards(JwtAuthGuard)
export class TrendsController {
  constructor(private readonly trendsService: TrendsService) {}

  @Get('niche')
  async getTrendsForNiche(
    @Query('niche') niche: string,
    @Query('keywords') keywords: string,
  ) {
    const keywordsArray = keywords.split(',').map(k => k.trim());
    return this.trendsService.getTrendsForNiche(niche, keywordsArray);
  }

  @Post('analyze')
  async analyzeNiche(@Body() analysisData: {
    niche: string;
    keywords: string[];
    competitorUrls?: string[];
  }) {
    const { niche, keywords, competitorUrls = [] } = analysisData;
    
    // Obtener datos de tendencias para el nicho
    const trendsData = await this.trendsService.getTrendsForNiche(niche, keywords);
    
    // Si se proporcionaron URLs de competidores, analizarlas
    let competitorData = [];
    if (competitorUrls.length > 0) {
      competitorData = await this.trendsService.analyzeCompetitors(competitorUrls);
    }
    
    // Devolver los resultados combinados
    return {
      trends: trendsData,
      competitors: competitorData
    };
  }
}
