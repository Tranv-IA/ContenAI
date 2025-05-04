import axios from 'axios';
import * as cheerio from 'cheerio';
import { Injectable, Logger } from '@nestjs/common';
import { DeepseekService } from './deepseek.service';
import { TrendsResponse, TrendOpportunity } from '../dto/trends-dto';

@Injectable()
export class TrendsService {
  private readonly logger = new Logger(TrendsService.name);

  constructor(private readonly deepseekService: DeepseekService) {}

  async getTrendsForNiche(niche: string, keywords: string[]): Promise<TrendsResponse> {
    try {
      const trendsData = await this.getBasicTrends(keywords);
      const articles = await this.getRecentArticles(niche, 5);
      return this.analyzeOpportunities(niche, keywords, trendsData, articles);
    } catch (error: unknown) {
      this.logger.error(`Error al obtener tendencias: ${(error as Error).message}`);
      throw new Error('No se pudieron obtener las tendencias en este momento');
    }
  }

  private async getBasicTrends(keywords: string[]): Promise<any> {
    const keywordsString = keywords.join(',');
    try {
      const response = await axios.get(
        `https://trends.google.com/trends/api/exploreovertime?hl=es&req={"comparisonItem":[{"keyword":"${keywordsString}","geo":"","time":"today 3-m"}],"category":0,"property":""}`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } },
      );
      const cleanData = response.data.substring(response.data.indexOf('{'));
      return JSON.parse(cleanData);
    } catch (error: unknown) {
      this.logger.error(`Error en getBasicTrends: ${(error as Error).message}`);
      return this.getSimulatedTrendsData(keywords);
    }
  }

  private async getRecentArticles(
    niche: string,
    limit: number = 5,
  ): Promise<{ title: string; link: string; pubDate: string; source: string }[]> {
    try {
      const response = await axios.get(
        `https://news.google.com/rss/search?q=${encodeURIComponent(niche)}&hl=es`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } },
      );
      const $ = cheerio.load(response.data, { xmlMode: true });
      const articles: { title: string; link: string; pubDate: string; source: string }[] = [];

      $('item').slice(0, limit).each((i, elem) => {
        const title = $(elem).find('title').text();
        if (title) {
          articles.push({
            title,
            link: $(elem).find('link').text(),
            pubDate: $(elem).find('pubDate').text(),
            source: $(elem).find('source').text(),
          });
        }
      });
      return articles;
    } catch (error: unknown) {
      this.logger.error(`Error en getRecentArticles: ${(error as Error).message}`);
      return [];
    }
  }

  private async analyzeOpportunities(
    niche: string,
    keywords: string[],
    trendsData: any,
    articles: { title: string; link: string; pubDate: string; source: string }[],
  ): Promise<TrendsResponse> {
    const processedTrends = this.processTrendsData(trendsData);
    const articleTopics = articles.map(article => article.title);
    const opportunitiesPrompt = `
      Analiza estas tendencias recientes para el nicho "${niche}":
      Palabras clave analizadas: ${keywords.join(', ')}
      Datos de tendencias: ${JSON.stringify(processedTrends)}
      Artículos recientes sobre el tema:
      ${articleTopics.map(title => `- ${title}`).join('\n')}
      Basándote SOLO en estos datos reales:
      1. Identifica 3-5 oportunidades concretas de contenido
      2. Para cada oportunidad, sugiere 2-3 títulos de artículos
      3. Proporciona una breve justificación basada en los datos de tendencias
      4. Formato de respuesta: JSON
    `;
    const aiAnalysis = await this.deepseekService.generateCompletion(opportunitiesPrompt);
    try {
      const opportunities: TrendOpportunity[] = JSON.parse(aiAnalysis);
      return {
        niche,
        keywords,
        trendingKeywords: processedTrends.trendingKeywords || [],
        recentArticles: articles.map(a => a.title),
        opportunities,
      };
    } catch (error: unknown) {
      this.logger.error(`Error al procesar análisis de IA: ${(error as Error).message}`);
      return {
        niche,
        keywords,
        trendingKeywords: processedTrends.trendingKeywords || [],
        recentArticles: articles.map(a => a.title),
        opportunities: this.extractOpportunitiesFromText(aiAnalysis),
      };
    }
  }

  private processTrendsData(trendsData: any): { trendingKeywords: { keyword: string; growth: number }[]; timelineData: any[] } {
    try {
      const timelineData = trendsData?.default?.timelineData || [];
      const trendingKeywords: { keyword: string; growth: number }[] = [];
      if (timelineData.length > 0) {
        const firstDataPoints = timelineData[0]?.value || [];
        const lastDataPoints = timelineData[timelineData.length - 1]?.value || [];
        firstDataPoints.forEach((value: number, index: number) => {
          if (lastDataPoints[index] > value) {
            trendingKeywords.push({
              keyword: trendsData?.default?.comparisonItem?.[index]?.keyword || `keyword_${index}`,
              growth: ((lastDataPoints[index] - value) / value) * 100,
            });
          }
        });
      }
      return {
        trendingKeywords,
        timelineData,
      };
    } catch (error: unknown) {
      this.logger.error(`Error al procesar datos de tendencias: ${(error as Error).message}`);
      return { trendingKeywords: [], timelineData: [] };
    }
  }

  private extractOpportunitiesFromText(text: string): TrendOpportunity[] {
    const opportunities: TrendOpportunity[] = [];
    const opportunityMatches = text.match(/oportunidad.*?(?=oportunidad|$)/gi) || [];
    opportunityMatches.forEach((match: string, index: number) => {
      opportunities.push({
        id: index + 1,
        title: match.split('\n')[0].replace(/oportunidad\s*\d+:\s*/i, '').trim(),
        justification: match,
        suggestedTitles: [`Título sugerido para oportunidad ${index + 1}`],
      });
    });
    return opportunities;
  }

  private getSimulatedTrendsData(keywords: string[]): any {
    return {
      default: {
        timelineData: [
          { value: keywords.map(() => Math.floor(Math.random() * 50)) },
          { value: keywords.map(() => Math.floor(Math.random() * 100)) },
        ],
        comparisonItem: keywords.map(keyword => ({ keyword })),
      },
    };
  }

  async analyzeCompetitors(urls: string[]): Promise<{ url: string; titles: string[]; error?: string }[]> {
    const competitorData: { url: string; titles: string[]; error?: string }[] = [];
    for (const url of urls.slice(0, 3)) {
      try {
        const response = await axios.get(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const $ = cheerio.load(response.data);
        const titles: string[] = [];
        $('h1, h2, h3').each((_, elem) => {
          const text = $(elem).text().trim();
          if (text && text.length > 10) {
            titles.push(text);
          }
        });
        competitorData.push({
          url,
          titles: titles.slice(0, 10),
        });
      } catch (error: unknown) {
        this.logger.error(`Error al analizar competidor ${url}: ${(error as Error).message}`);
        competitorData.push({
          url,
          error: 'No se pudo analizar este sitio',
          titles: [],
        });
      }
    }
    return competitorData;
  }
}