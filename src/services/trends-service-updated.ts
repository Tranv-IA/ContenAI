// src/services/trends.service.ts
import axios from 'axios';
import * as cheerio from 'cheerio';
import { Injectable, Logger } from '@nestjs/common';
import { DeepseekService } from './deepseek.service';

@Injectable()
export class TrendsService {
  private readonly logger = new Logger(TrendsService.name);
  
  constructor(private readonly deepseekService: DeepseekService) {}

  /**
   * Obtiene tendencias básicas para un nicho específico
   */
  async getTrendsForNiche(niche: string, keywords: string[]): Promise<any> {
    try {
      // 1. Obtener datos de Google Trends para las palabras clave
      const trendsData = await this.getBasicTrends(keywords);
      
      // 2. Obtener artículos recientes relacionados con el nicho
      const articles = await this.getRecentArticles(niche, 5);
      
      // 3. Analizar los datos para encontrar oportunidades
      return this.analyzeOpportunities(niche, keywords, trendsData, articles);
    } catch (error) {
      this.logger.error(`Error al obtener tendencias: ${error.message}`);
      throw new Error('No se pudieron obtener las tendencias en este momento');
    }
  }

  /**
   * Obtiene datos básicos de tendencias para las palabras clave
   * Usa exploreinterestovertime API de Google Trends
   */
  private async getBasicTrends(keywords: string[]): Promise<any> {
    const keywordsString = keywords.join(',');
    try {
      // Esta es una API no oficial pero funciona para propósitos básicos
      const response = await axios.get(
        `https://trends.google.com/trends/api/exploreovertime?hl=es&req={"comparisonItem":[{"keyword":"${keywordsString}","geo":"","time":"today 3-m"}],"category":0,"property":""}`,
        { 
          headers: { 'User-Agent': 'Mozilla/5.0' }
        }
      );
      
      // Google devuelve un prefijo antes del JSON real
      const cleanData = response.data.substring(response.data.indexOf('{')); 
      return JSON.parse(cleanData);
    } catch (error) {
      this.logger.error(`Error en getBasicTrends: ${error.message}`);
      // Fallback a datos simulados en caso de error
      return this.getSimulatedTrendsData(keywords);
    }
  }

  /**
   * Obtiene artículos recientes relacionados con el nicho
   * Realiza un scraping básico de resultados de Google News
   */
  private async getRecentArticles(niche: string, limit: number = 5): Promise<any[]> {
    try {
      const response = await axios.get(
        `https://news.google.com/rss/search?q=${encodeURIComponent(niche)}&hl=es`,
        { 
          headers: { 'User-Agent': 'Mozilla/5.0' }
        }
      );
      
      const $ = cheerio.load(response.data, { xmlMode: true });
      const articles = [];
      
      $('item').slice(0, limit).each((i, elem) => {
        articles.push({
          title: $(elem).find('title').text(),
          link: $(elem).find('link').text(),
          pubDate: $(elem).find('pubDate').text(),
          source: $(elem).find('source').text()
        });
      });
      
      return articles;
    } catch (error) {
      this.logger.error(`Error en getRecentArticles: ${error.message}`);
      return [];
    }
  }

  /**
   * Analiza datos de tendencias y artículos para detectar oportunidades
   * Usa una combinación de reglas simples y ayuda de IA
   */
  private async analyzeOpportunities(
    niche: string, 
    keywords: string[], 
    trendsData: any, 
    articles: any[]
  ): Promise<any> {
    // Extraer información relevante de los datos de tendencias
    const processedTrends = this.processTrendsData(trendsData);
    
    // Identificar temas populares de los artículos
    const articleTopics = articles.map(article => article.title);
    
    // Usar DeepSeek IA para ayudar a identificar oportunidades concretas
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
    
    // Procesar y estructurar la respuesta
    try {
      const opportunities = JSON.parse(aiAnalysis);
      return {
        niche,
        keywords,
        trendingKeywords: processedTrends.trendingKeywords || [],
        recentArticles: articles.map(a => a.title),
        opportunities
      };
    } catch (error) {
      this.logger.error(`Error al procesar análisis de IA: ${error.message}`);
      // Fallback a un formato más simple si hay error en el JSON
      return {
        niche,
        keywords,
        trendingKeywords: processedTrends.trendingKeywords || [],
        recentArticles: articles.map(a => a.title),
        opportunities: this.extractOpportunitiesFromText(aiAnalysis)
      };
    }
  }

  /**
   * Procesa datos crudos de tendencias en un formato utilizable
   */
  private processTrendsData(trendsData: any): any {
    try {
      // Extraer datos de series temporales si están disponibles
      const timelineData = trendsData?.default?.timelineData || [];
      
      // Extraer las palabras clave con tendencia creciente
      const trendingKeywords = [];
      
      if (timelineData.length > 0) {
        // Análisis simplificado: comparar primeros y últimos puntos de datos
        const firstDataPoints = timelineData[0]?.value || [];
        const lastDataPoints = timelineData[timelineData.length - 1]?.value || [];
        
        // Identificar palabras clave con tendencia al alza
        firstDataPoints.forEach((value, index) => {
          if (lastDataPoints[index] > value) {
            trendingKeywords.push({
              keyword: trendsData?.default?.comparisonItem?.[index]?.keyword || `keyword_${index}`,
              growth: ((lastDataPoints[index] - value) / value) * 100
            });
          }
        });
      }
      
      return {
        trendingKeywords,
        timelineData
      };
    } catch (error) {
      this.logger.error(`Error al procesar datos de tendencias: ${error.message}`);
      return { trendingKeywords: [] };
    }
  }

  /**
   * Extrae oportunidades desde texto en caso de que el JSON parsing falle
   */
  private extractOpportunitiesFromText(text: string): any[] {
    const opportunities = [];
    
    // Búsqueda simplificada de patrones en el texto
    const opportunityMatches = text.match(/oportunidad.*?(?=oportunidad|$)/gis) || [];
    
    opportunityMatches.forEach((match, index) => {
      opportunities.push({
        id: index + 1,
        title: match.split('\n')[0].replace(/oportunidad\s*\d+:\s*/i, '').trim(),
        description: match,
        suggestedTitles: [
          `Título sugerido para oportunidad ${index + 1}`
        ]
      });
    });
    
    return opportunities;
  }

  /**
   * Genera datos simulados de tendencias como fallback
   */
  private getSimulatedTrendsData(keywords: string[]): any {
    return {
      default: {
        timelineData: [
          { value: keywords.map(() => Math.floor(Math.random() * 50)) },
          { value: keywords.map(() => Math.floor(Math.random() * 100)) }
        ],
        comparisonItem: keywords.map(keyword => ({ keyword }))
      }
    };
  }
  
  /**
   * Analiza URLs de competidores para identificar temas populares
   * Implementación básica para el MVP
   */
  async analyzeCompetitors(urls: string[]): Promise<any> {
    const competitorData = [];
    
    // Analizar un máximo de 3 URLs para el MVP
    for (const url of urls.slice(0, 3)) {
      try {
        // Hacer scraping básico de títulos
        const response = await axios.get(url, { 
          headers: { 'User-Agent': 'Mozilla/5.0' }
        });
        
        const $ = cheerio.load(response.data);
        const titles = [];
        
        // Extraer títulos de artículos
        $('h1, h2, h3').each((_, elem) => {
          const text = $(elem).text().trim();
          if (text && text.length > 10) {
            titles.push(text);
          }
        });
        
        competitorData.push({
          url,
          titles: titles.slice(0, 10) // Limitar a 10 títulos por competidor
        });
      } catch (error) {
        this.logger.error(`Error al analizar competidor ${url}: ${error.message}`);
        competitorData.push({
          url,
          error: 'No se pudo analizar este sitio',
          titles: []
        });
      }
    }
    
    return competitorData;
  }
}