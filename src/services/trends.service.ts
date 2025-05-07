import axios from 'axios';
import * as cheerio from 'cheerio';
import { Injectable, Logger } from '@nestjs/common';
import { DeepseekService } from './deepseek.service';
import { CohereService } from './cohere.service';
import { TrendsResponse, TrendOpportunity } from '../dto/trends-dto';

@Injectable()
export class TrendsService {
  private readonly logger = new Logger(TrendsService.name);

  constructor(
    private readonly deepseekService: DeepseekService,
    private readonly cohereService: CohereService
  ) {}

  async getTrendsForNiche(niche: string, keywords: string[]): Promise<TrendsResponse> {
    try {
      // Obtener datos de múltiples fuentes para un análisis más completo
      const googleTrendsData = await this.getGoogleTrends(keywords);
      const redditData = await this.getRedditTrends(niche);
      const articles = await this.getRecentArticles(niche, 8); // Incrementar el número de artículos
      
      // Combinar datos para un análisis más robusto
      const combinedData = {
        googleTrends: googleTrendsData,
        redditTrends: redditData,
        articles
      };
      
      return this.analyzeOpportunities(niche, keywords, combinedData);
    } catch (error: unknown) {
      this.logger.error(`Error al obtener tendencias: ${(error as Error).message}`);
      throw new Error('No se pudieron obtener las tendencias en este momento');
    }
  }

  private async getGoogleTrends(keywords: string[]): Promise<any> {
    try {
      // Hacer múltiples solicitudes para diferentes períodos de tiempo
      const timeRanges = ['today 3-m', 'today 1-m', 'today 1-w'];
      const results = await Promise.all(
        timeRanges.map(async (timeRange) => {
          try {
            // Solicitar datos para cada palabra clave individualmente para mayor precisión
            const keywordPromises = keywords.map(async (keyword) => {
              const response = await axios.get(
                `https://trends.google.com/trends/api/exploreovertime?hl=es&req={"comparisonItem":[{"keyword":"${keyword}","geo":"","time":"${timeRange}"}],"category":0,"property":""}`,
                { headers: { 'User-Agent': 'Mozilla/5.0' } },
              );
              const cleanData = response.data.substring(response.data.indexOf('{'));
              return { keyword, data: JSON.parse(cleanData) };
            });
            
            const keywordResults = await Promise.all(keywordPromises);
            return { timeRange, keywordData: keywordResults };
          } catch (error) {
            this.logger.warn(`Error en obtener datos para ${timeRange}: ${error.message}`);
            return { timeRange, error: true };
          }
        })
      );
      
      // Filtrar resultados fallidos
      const successfulResults = results.filter(result => !result.error);
      
      if (successfulResults.length === 0) {
        return this.getSimulatedTrendsData(keywords);
      }
      
      return successfulResults;
    } catch (error: unknown) {
      this.logger.error(`Error en getGoogleTrends: ${(error as Error).message}`);
      return this.getSimulatedTrendsData(keywords);
    }
  }

  private async getRedditTrends(niche: string): Promise<any> {
    try {
      // Obtener tendencias de Reddit para el nicho
      const response = await axios.get(
        `https://www.reddit.com/search.json?q=${encodeURIComponent(niche)}&sort=top&t=month&limit=15`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } }
      );
      
      const posts = response.data.data.children.map(post => ({
        title: post.data.title,
        subreddit: post.data.subreddit,
        score: post.data.score,
        num_comments: post.data.num_comments,
        created_utc: post.data.created_utc
      }));
      
      return posts;
    } catch (error: unknown) {
      this.logger.error(`Error en getRedditTrends: ${(error as Error).message}`);
      return [];
    }
  }

  private async getRecentArticles(
    niche: string,
    limit: number = 8,
  ): Promise<{ title: string; link: string; pubDate: string; source: string; summary?: string }[]> {
    try {
      const response = await axios.get(
        `https://news.google.com/rss/search?q=${encodeURIComponent(niche)}&hl=es`,
        { headers: { 'User-Agent': 'Mozilla/5.0' } },
      );
      const $ = cheerio.load(response.data, { xmlMode: true });
      const articles: { title: string; link: string; pubDate: string; source: string; summary?: string }[] = [];

      const items = $('item').slice(0, limit).toArray();
      
      // Extraer metadata y generar resúmenes
      for (const elem of items) {
        const $elem = $(elem);
        const title = $elem.find('title').text();
        
        if (title) {
          const article = {
            title,
            link: $elem.find('link').text(),
            pubDate: $elem.find('pubDate').text(),
            source: $elem.find('source').text(),
          };
          
          try {
            // Intentar extraer y resumir el contenido del artículo
            const content = await this.extractArticleContent(article.link);
            if (content) {
              const summary = await this.summarizeContent(content);
              article.summary = summary;
            }
          } catch (err) {
            // Continuar aunque falle la extracción de contenido
          }
          
          articles.push(article);
        }
      }
      
      return articles;
    } catch (error: unknown) {
      this.logger.error(`Error en getRecentArticles: ${(error as Error).message}`);
      return [];
    }
  }

  private async extractArticleContent(url: string): Promise<string | null> {
    try {
      const response = await axios.get(url, { 
        headers: { 'User-Agent': 'Mozilla/5.0' },
        timeout: 5000
      });
      
      const $ = cheerio.load(response.data);
      
      // Eliminar elementos que probablemente no sean contenido principal
      $('header, footer, nav, script, style, iframe, .ads, .sidebar, #sidebar, .menu, .nav, .navigation, .comments').remove();
      
      // Extraer el texto del artículo desde diversos selectores potenciales
      const selectors = ['article', '.article', '.post-content', '.entry-content', '.content', 'main'];
      
      let content = '';
      for (const selector of selectors) {
        const element = $(selector);
        if (element.length) {
          content = element.text().trim();
          if (content.length > 200) break;
        }
      }
      
      // Si no encontramos contenido con los selectores, tomar párrafos
      if (content.length < 200) {
        content = $('p').slice(0, 10).map((_, el) => $(el).text().trim()).get().join(' ');
      }
      
      return content.length > 100 ? content : null;
    } catch (error) {
      return null;
    }
  }

  private async summarizeContent(content: string): Promise<string> {
    const prompt = `Resumir el siguiente contenido en 2-3 frases clave:
    
    ${content.substring(0, 2000)}
    
    Resumen:`;
    
    try {
      return await this.cohereService.generateCompletion(prompt);
    } catch (error) {
      return '';
    }
  }

  private async analyzeOpportunities(
    niche: string,
    keywords: string[],
    combinedData: any,
  ): Promise<TrendsResponse> {
    // Preprocesar y analizar datos de Google Trends
    const processedTrends = this.processTrendsData(combinedData.googleTrends);
    
    // Extraer títulos de artículos
    const articleTopics = combinedData.articles.map(article => article.title);
    
    // Extraer información de Reddit
    const redditInsights = this.extractRedditInsights(combinedData.redditTrends);
    
    // Detectar palabras clave emergentes
    const emergingKeywords = await this.detectEmergingKeywords(niche, keywords, articleTopics);
    
    // Usar IA para analizar oportunidades
    const opportunitiesPrompt = `
      Análisis estratégico de tendencias para el nicho "${niche}":
      
      DATOS DE TENDENCIAS:
      Palabras clave analizadas: ${keywords.join(', ')}
      Palabras clave emergentes detectadas: ${emergingKeywords.join(', ')}
      
      DATOS DE GOOGLE TRENDS:
      ${JSON.stringify(processedTrends)}
      
      CONVERSACIONES EN REDDIT:
      ${redditInsights}
      
      ARTÍCULOS RECIENTES (con fecha de publicación):
      ${combinedData.articles.map(article => 
        `- ${article.title} (${new Date(article.pubDate).toLocaleDateString()})`
      ).join('\n')}
      
      INSTRUCCIONES PARA EL ANÁLISIS:
      
      1. Identifica 4-6 oportunidades ESPECÍFICAS de contenido basadas en las tendencias observadas
      2. Para cada oportunidad:
         - Asigna un ID único
         - Crea un título descriptivo de la oportunidad
         - Proporciona una justificación clara basada en datos concretos de tendencias (menciona cifras cuando sea posible)
         - Sugiere 3 títulos de artículos atractivos para esta oportunidad
         - Recomienda un enfoque estratégico para desarrollar el contenido
         - Estima el potencial de crecimiento como número entre 0-100
      
      3. Responde EXCLUSIVAMENTE en formato JSON válido con la siguiente estructura:
      [
        {
          "id": 1,
          "title": "Título de la oportunidad",
          "justification": "Justificación basada en datos",
          "suggestedTitles": ["Título 1", "Título 2", "Título 3"],
          "approach": "Enfoque estratégico para desarrollar el contenido",
          "growth": 85
        },
        ...
      ]
    `;
    
    // Obtener análisis de IA y procesarlo
    try {
      const aiAnalysis = await this.deepseekService.generateCompletion(opportunitiesPrompt);
      let opportunities: TrendOpportunity[];
      
      try {
        opportunities = JSON.parse(aiAnalysis);
        
        // Validar y limpiar los resultados
        opportunities = opportunities.map(opp => ({
          id: typeof opp.id === 'number' ? opp.id : Math.floor(Math.random() * 1000),
          title: opp.title || "Oportunidad sin título",
          justification: opp.justification || "Sin justificación disponible",
          suggestedTitles: Array.isArray(opp.suggestedTitles) ? opp.suggestedTitles : ["Sin títulos sugeridos"],
          approach: opp.approach || undefined,
          growth: typeof opp.growth === 'number' ? opp.growth : undefined
        }));
      } catch (error) {
        this.logger.error(`Error al parsear análisis de IA: ${(error as Error).message}`);
        opportunities = this.extractOpportunitiesFromText(aiAnalysis);
      }
      
      // Clasificar y priorizar oportunidades usando Cohere
      opportunities = await this.rankOpportunities(opportunities, niche);
      
      return {
        niche,
        keywords,
        trendingKeywords: processedTrends.trendingKeywords || [],
        recentArticles: articleTopics,
        opportunities,
      };
    } catch (error: unknown) {
      this.logger.error(`Error en análisis de oportunidades: ${(error as Error).message}`);
      
      // Fallback a análisis más simple
      return {
        niche,
        keywords,
        trendingKeywords: processedTrends.trendingKeywords || [],
        recentArticles: articleTopics,
        opportunities: this.generateBasicOpportunities(niche, keywords),
      };
    }
  }

  private extractRedditInsights(redditData: any[]): string {
    if (!redditData || redditData.length === 0) {
      return "No hay datos disponibles de Reddit.";
    }
    
    // Ordenar posts por engagement (votos + comentarios)
    const sortedPosts = [...redditData].sort((a, b) => 
      (b.score + b.num_comments) - (a.score + a.num_comments)
    );
    
    // Tomar los 5 posts más relevantes
    const topPosts = sortedPosts.slice(0, 5);
    
    return topPosts.map(post => 
      `- ${post.title} (${post.score} votos, ${post.num_comments} comentarios en r/${post.subreddit})`
    ).join('\n');
  }

  private async detectEmergingKeywords(niche: string, baseKeywords: string[], articleTitles: string[]): Promise<string[]> {
    try {
      const prompt = `
        Analiza los siguientes títulos de artículos recientes sobre "${niche}" e identifica 5-7 palabras clave emergentes 
        que NO estén en esta lista de palabras clave establecidas: ${baseKeywords.join(', ')}.
        
        Títulos de artículos:
        ${articleTitles.join('\n')}
        
        Devuelve SOLO las palabras clave separadas por comas (sin explicaciones ni formato adicional).
      `;
      
      const response = await this.cohereService.generateCompletion(prompt);
      const keywords = response.split(',').map(k => k.trim()).filter(k => k.length > 0);
      
      // Filtrar para eliminar las que ya están en baseKeywords
      return keywords.filter(k => !baseKeywords.includes(k));
    } catch (error) {
      this.logger.error(`Error al detectar palabras clave emergentes: ${error.message}`);
      return [];
    }
  }

  private async rankOpportunities(opportunities: TrendOpportunity[], niche: string): Promise<TrendOpportunity[]> {
    try {
      // Si hay menos de 3 oportunidades, devolver tal cual
      if (opportunities.length < 3) {
        return opportunities;
      }
      
      // Preparar ejemplos para la clasificación
      const examples = [
        {
          text: `Oportunidad específica con datos concretos y alineada con el nicho ${niche}, con enfoque práctico`,
          label: "alta_prioridad"
        },
        {
          text: `Tendencia genérica relacionada con ${niche} sin datos concretos para respaldarla`,
          label: "baja_prioridad"
        },
        {
          text: `Oportunidad bien definida con justificación parcial y relevante para ${niche}`,
          label: "prioridad_media"
        }
      ];
      
      // Preparar textos para clasificar
      const inputs = opportunities.map(opp => 
        `${opp.title}. ${opp.justification.substring(0, 200)}`
      );
      
      // Clasificar usando Cohere
      const classification = await this.cohereService.classifyTrends(inputs, examples);
      
      // Asignar puntuaciones basadas en la clasificación
      const scoredOpps = opportunities.map((opp, index) => {
        const result = classification.classifications[index];
        let priorityScore = 0;
        
        if (result.prediction === "alta_prioridad") {
          priorityScore = 100;
        } else if (result.prediction === "prioridad_media") {
          priorityScore = 70;
        } else {
          priorityScore = 30;
        }
        
        // Ajustar con la confianza de la predicción
        const finalScore = priorityScore * result.confidence;
        
        return {
          ...opp,
          growth: Math.round(finalScore)
        };
      });
      
      // Ordenar por puntuación
      return scoredOpps.sort((a, b) => (b.growth || 0) - (a.growth || 0));
    } catch (error) {
      this.logger.error(`Error al clasificar oportunidades: ${error.message}`);
      return opportunities;
    }
  }

  private processTrendsData(trendsData: any): { trendingKeywords: { keyword: string; growth: number }[]; timelineData: any[] } {
    try {
      // Si estamos usando datos simulados
      if (trendsData?.default?.timelineData) {
        const timelineData = trendsData.default.timelineData || [];
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
      }
      
      // Si estamos usando el nuevo formato más detallado
      if (Array.isArray(trendsData)) {
        const trendingKeywords: { keyword: string; growth: number }[] = [];
        let aggregatedTimelineData: any[] = [];
        
        trendsData.forEach(timeRangeData => {
          if (timeRangeData.keywordData) {
            timeRangeData.keywordData.forEach(keywordItem => {
              const keyword = keywordItem.keyword;
              const timelineData = keywordItem.data?.default?.timelineData || [];
              
              if (timelineData.length > 0) {
                const firstValue = timelineData[0]?.value?.[0] || 0;
                const lastValue = timelineData[timelineData.length - 1]?.value?.[0] || 0;
                
                if (lastValue > firstValue) {
                  const growth = ((lastValue - firstValue) / Math.max(1, firstValue)) * 100;
                  
                  // Buscar si ya tenemos esta keyword
                  const existingIndex = trendingKeywords.findIndex(k => k.keyword === keyword);
                  
                  if (existingIndex >= 0) {
                    // Promedio ponderado con más peso al período más reciente
                    const weight = timeRangeData.timeRange === 'today 1-w' ? 0.6 : 
                                   timeRangeData.timeRange === 'today 1-m' ? 0.3 : 0.1;
                                   
                    trendingKeywords[existingIndex].growth = 
                      trendingKeywords[existingIndex].growth * (1 - weight) + growth * weight;
                  } else {
                    trendingKeywords.push({
                      keyword,
                      growth
                    });
                  }
                }
              }
              
              // Agregamos los datos de timeline para visualización
              if (timeRangeData.timeRange === 'today 1-m') {
                aggregatedTimelineData = this.transformTimelineData(keywordItem);
              }
            });
          }
        });
        
        // Ordenar por crecimiento
        trendingKeywords.sort((a, b) => b.growth - a.growth);
        
        return {
          trendingKeywords,
          timelineData: aggregatedTimelineData,
        };
      }
      
      // En caso de formato inesperado
      return { trendingKeywords: [], timelineData: [] };
    } catch (error: unknown) {
      this.logger.error(`Error al procesar datos de tendencias: ${(error as Error).message}`);
      return { trendingKeywords: [], timelineData: [] };
    }
  }

  private transformTimelineData(keywordData: any): any[] {
    try {
      const timelineData = keywordData.data?.default?.timelineData || [];
      const keyword = keywordData.keyword;
      
      return timelineData.map((point: any) => {
        const transformed: any = {
          date: new Date(point.time * 1000).toISOString().split('T')[0],
          name: new Date(point.time * 1000).toLocaleDateString(),
        };
        
        transformed[keyword] = point.value[0];
        return transformed;
      });
    } catch (error) {
      return [];
    }
  }

  private extractOpportunitiesFromText(text: string): TrendOpportunity[] {
    // Expresión para detectar oportunidades en diversos formatos
    const opportunityRegex = /(?:oportunidad|opportunity).*?(?=(?:oportunidad|opportunity)|$)/gis;
    const titleRegex = /(?:título|title)[^\n:]*?:[\s]*(.*?)(?:\n|$)/i;
    const suggestedRegex = /(?:suger|suggest)[^\n:]*?:[\s]*(.*?)(?:\n|$)/i;
    
    const opportunities: TrendOpportunity[] = [];
    const matches = text.match(opportunityRegex) || [];
    
    matches.forEach((match: string, index: number) => {
      // Intentar extraer un título más específico
      const titleMatch = match.match(titleRegex);
      const title = titleMatch ? titleMatch[1].trim() : 
                    match.split('\n')[0].replace(/(?:oportunidad|opportunity)\s*\d*\s*:?\s*/i, '').trim();
      
      // Intentar extraer títulos sugeridos
      const suggestedMatch = match.match(suggestedRegex);
      const suggestedTitles = suggestedMatch ? 
        suggestedMatch[1].split(/[,;]/).map(t => t.trim()).filter(t => t.length > 0) :
        [`Título sugerido para oportunidad ${index + 1}`];
      
      opportunities.push({
        id: index + 1,
        title: title || `Oportunidad ${index + 1}`,
        justification: match.trim(),
        suggestedTitles,
        growth: Math.floor(Math.random() * 40) + 60 // Valor aleatorio entre 60-100
      });
    });
    
    return opportunities;
  }

  private generateBasicOpportunities(niche: string, keywords: string[]): TrendOpportunity[] {
    const opportunities: TrendOpportunity[] = [];
    
    // Generar al menos 3 oportunidades básicas
    opportunities.push({
      id: 1,
      title: `Guía completa de ${niche} para principiantes`,
      justification: `Las búsquedas de información básica sobre ${niche} tienen un crecimiento sostenido. Una guía completa puede atraer tráfico consistente.`,
      suggestedTitles: [
        `Guía Definitiva de ${niche}: Todo lo que Necesitas Saber`,
        `${niche} para Principiantes: La Guía Paso a Paso`,
        `Cómo Iniciarse en ${niche}: Consejos Fundamentales`
      ],
      approach: `Crear una guía estructurada que cubra todos los aspectos básicos de ${niche}. Incluir infografías y videos tutoriales.`,
      growth: 85
    });
    
    if (keywords.length > 0) {
      opportunities.push({
        id: 2,
        title: `Tendencias emergentes en ${keywords[0]}`,
        justification: `El término "${keywords[0]}" muestra un crecimiento reciente en las búsquedas. Hay una oportunidad para analizar las nuevas tendencias.`,
        suggestedTitles: [
          `5 Tendencias Emergentes en ${keywords[0]} que Revolucionarán el 2025`,
          `El Futuro de ${keywords[0]}: Tendencias que Debes Conocer`,
          `Cómo Aprovechar las Nuevas Tendencias en ${keywords[0]}`
        ],
        approach: `Investigar las últimas innovaciones y cambios en ${keywords[0]}. Entrevistar a expertos del sector.`,
        growth: 75
      });
    }
    
    if (keywords.length > 1) {
      opportunities.push({
        id: 3,
        title: `Comparativa: ${keywords[0]} vs ${keywords[1]}`,
        justification: `Las comparativas entre ${keywords[0]} y ${keywords[1]} son búsquedas frecuentes. Una análisis detallado puede generar tráfico cualificado.`,
        suggestedTitles: [
          `${keywords[0]} vs ${keywords[1]}: ¿Cuál es Mejor y Por Qué?`,
          `Comparativa Completa: ${keywords[0]} o ${keywords[1]} - Ventajas y Desventajas`,
          `Cómo Elegir Entre ${keywords[0]} y ${keywords[1]}: Análisis Exhaustivo`
        ],
        approach: `Realizar una comparativa objetiva basada en criterios relevantes. Incluir tablas comparativas y ejemplos prácticos.`,
        growth: 70
      });
    }
    
    return opportunities;
  }

  private getSimulatedTrendsData(keywords: string[]): any {
    // Versión mejorada de datos simulados con más puntos y variación
    const timelinePoints = 12; // 12 semanas
    const timelineData = [];
    
    for (let i = 0; i < timelinePoints; i++) {
      // Crear tendencias con patrones más realistas
      const values = keywords.map((_, idx) => {
        // Base value
        let baseValue = 30 + Math.floor(Math.random() * 40);
        
        // Add trend component - different for each keyword
        if (idx % 3 === 0) {
          // Upward trend
          baseValue += i * 2;
        } else if (idx % 3 === 1) {
          // Fluctuating trend
          baseValue += Math.sin(i * 0.5) * 15;
        } else {
          // Spike trend
          if (i === Math.floor(timelinePoints / 2)) {
            baseValue += 30;
          }
        }
        
        return Math.max(5, Math.min(100, Math.floor(baseValue)));
      });