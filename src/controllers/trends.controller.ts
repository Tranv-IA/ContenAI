import { Controller, Get, Post, Body, UseGuards, Query } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { TrendsService } from '../services/trends.service';
import { TrendsPredictionService } from '../services/trends-prediction.service';
import { AnalyzeNicheDto, TrendsResponse, PredictionInput, TrendPredictionResponse } from '../dto/trends-dto';

@Controller('trends')
@UseGuards(JwtAuthGuard)
export class TrendsController {
  constructor(
    private readonly trendsService: TrendsService,
    private readonly trendsPredictionService: TrendsPredictionService
  ) {}

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

  @Post('predict')
  async predictTrends(@Body() predictionData: PredictionInput): Promise<TrendPredictionResponse> {
    const { niche, keywords, historicalData, recentArticles = [] } = predictionData;
    return this.trendsPredictionService.predictTrends(niche, keywords, historicalData, recentArticles);
  }

  @Get('predict/demo')
  async getDemoPrediction(
    @Query('niche') niche: string,
    @Query('keywords') keywords: string,
  ): Promise<TrendPredictionResponse> {
    const keywordsArray = keywords.split(',').map(k => k.trim());
    
    // Crear datos históricos de demostración
    const historicalData: Record<string, any> = {};
    const now = new Date();
    
    keywordsArray.forEach(keyword => {
      const points = [];
      // Crear 12 puntos de datos históricos para los últimos 3 meses
      for (let i = 11; i >= 0; i--) {
        const date = new Date(now);
        date.setDate(date.getDate() - (i * 7)); // Datos semanales
        
        // Generar valores con tendencia pseudoaleatoria según la palabra clave
        const baseValue = 40 + (keyword.length % 10) * 3;
        const trend = (i / 3) * (keyword.length % 2 === 0 ? 1 : -1);
        const noise = Math.random() * 10 - 5;
        
        points.push({
          date: date.toISOString(),
          value: Math.max(0, Math.min(100, Math.round(baseValue + trend + noise)))
        });
      }
      historicalData[keyword] = points;
    });
    
    // Generar artículos recientes de demostración
    const demoArticles = [
      `Nuevas tendencias en ${niche} para 2025`,
      `Cómo ${keywordsArray[0]} está transformando el mercado`,
      `Los expertos predicen el auge de ${keywordsArray[1] || niche}`,
      `5 estrategias para aprovechar ${niche} en tu negocio`,
      `Por qué ${keywordsArray[0]} será clave en los próximos meses`
    ];
    
    return this.trendsPredictionService.predictTrends(niche, keywordsArray, historicalData, demoArticles);
  }
}