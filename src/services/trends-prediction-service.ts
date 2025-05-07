import { Injectable, Logger } from '@nestjs/common';
import { CohereService } from './cohere.service';
import { DeepseekService } from './deepseek.service';
import { TrendPredictionResponse, HistoricalPoint } from '../dto/trends-dto';

@Injectable()
export class TrendsPredictionService {
  private readonly logger = new Logger(TrendsPredictionService.name);

  constructor(
    private readonly cohereService: CohereService,
    private readonly deepseekService: DeepseekService,
  ) {}

  /**
   * Predice tendencias futuras basadas en datos históricos y análisis contextual
   */
  async predictTrends(
    niche: string,
    keywords: string[],
    historicalData: Record<string, HistoricalPoint[]>,
    recentArticles: string[],
  ): Promise<TrendPredictionResponse> {
    try {
      // 1. Analizar tendencias históricas usando regresión simple
      const keywordPredictions = await this.analyzeHistoricalTrends(keywords, historicalData);
      
      // 2. Enriquecer con análisis de contenido reciente
      const contentInsights = await this.analyzeContent(niche, recentArticles);
      
      // 3. Generar predicción unificada con IA
      const combinedPrediction = await this.generateCombinedPrediction(
        niche,
        keywords,
        keywordPredictions,
        contentInsights
      );
      
      // 4. Calcular puntos de intervención óptimos
      const interventionPoints = this.calculateInterventionPoints(combinedPrediction);
      
      return {
        niche,
        keywords,
        predictions: combinedPrediction,
        interventionPoints,
        nextActions: await this.suggestNextActions(niche, keywords, combinedPrediction),
        confidenceScore: this.calculateConfidenceScore(keywordPredictions),
      };
    } catch (error) {
      this.logger.error(`Error en predicción de tendencias: ${error.message}`);
      return this.generateFallbackPrediction(niche, keywords);
    }
  }
  
  /**
   * Analiza datos históricos para proyectar tendencias futuras
   */
  private async analyzeHistoricalTrends(
    keywords: string[],
    historicalData: Record<string, HistoricalPoint[]>,
  ): Promise<Record<string, number[]>> {
    const predictions: Record<string, number[]> = {};
    
    for (const keyword of keywords) {
      const data = historicalData[keyword] || [];
      
      if (data.length >= 3) {
        // Usar regresión lineal simple para predecir próximos 3 valores
        const predictedValues = this.linearRegression(data);
        predictions[keyword] = predictedValues;
      } else {
        // Datos insuficientes, usar estimación básica
        predictions[keyword] = [50, 55, 60]; // Valores por defecto con tendencia ascendente
      }
    }
    
    return predictions;
  }
  
  /**
   * Implementa una regresión lineal simple para proyectar valores futuros
   */
  private linearRegression(data: HistoricalPoint[]): number[] {
    try {
      // Convertir fechas a números (x) y obtener valores (y)
      const points = data.map((point, index) => ({
        x: index, // Usar índice en lugar de tiempo para simplificar
        y: point.value
      }));
      
      if (points.length < 2) return [50, 55, 60];
      
      // Calcular pendiente y intersección usando el método de mínimos cuadrados
      let sumX = 0;
      let sumY = 0;
      let sumXY = 0;
      let sumXX = 0;
      
      for (const point of points) {
        sumX += point.x;
        sumY += point.y;
        sumXY += point.x * point.y;
        sumXX += point.x * point.x;
      }
      
      const n = points.length;
      const slope = (n * sumXY - sumX * sumY) / (n * sumXX - sumX * sumX);
      const intercept = (sumY - slope * sumX) / n;
      
      // Predecir los próximos 3 valores
      const lastX = points[points.length - 1].x;
      const predictions = [];
      
      for (let i = 1; i <= 3; i++) {
        const predictedX = lastX + i;
        let predictedY = slope * predictedX + intercept;
        
        // Normalizar entre 0 y 100
        predictedY = Math.max(0, Math.min(100, predictedY));
        predictions.push(Math.round(predictedY));
      }
      
      return predictions;
    } catch (error) {
      this.logger.error(`Error en regresión lineal: ${error.message}`);
      return [50, 55, 60]; // Valores por defecto
    }
  }
  
  /**
   * Analiza el contenido reciente para extraer insights relevantes
   */
  private async analyzeContent(niche: string, recentArticles: string[]): Promise<string> {
    if (!recentArticles || recentArticles.length === 0) {
      return "No hay datos de contenido suficientes para el análisis.";
    }
    
    const prompt = `
      Analiza los siguientes títulos de artículos recientes sobre "${niche}" e identifica patrones
      emergentes, cambios en el interés del público, y posibles oportunidades futuras.
      
      Artículos recientes:
      ${recentArticles.join('\n')}
      
      Proporciona un análisis conciso (máximo 3 párrafos) sobre:
      1. Patrones temáticos emergentes
      2. Problemas o preocupaciones recurrentes
      3. Predicciones sobre hacia dónde se dirige el interés en este nicho
    `;
    
    try {
      return await this.cohereService.generateCompletion(prompt);
    } catch (error) {
      this.logger.error(`Error al analizar contenido: ${error.message}`);
      return "No se pudo completar el análisis de contenido.";
    }
  }
  
  /**
   * Genera una predicción unificada combinando datos históricos y análisis de contenido
   */
  private async generateCombinedPrediction(
    niche: string,
    keywords: string[],
    keywordPredictions: Record<string, number[]>,
    contentInsights: string
  ): Promise<Array<{keyword: string, currentValue: number, predictedValues: number[], explanation: string}>> {
    try {
      // Formato para la IA
      const predictionData = Object.entries(keywordPredictions).map(([keyword, values]) => {
        return {
          keyword,
          currentValue: values[0],
          forecastValues: values.slice(1).join(', ')
        };
      });
      
      const prompt = `
        Como modelo de predicción de tendencias, analiza los siguientes datos para "${niche}":
        
        PREDICCIONES CUANTITATIVAS:
        ${predictionData.map(p => `"${p.keyword}": valor actual ${p.currentValue}, predicción futura [${p.forecastValues}]`).join('\n')}
        
        ANÁLISIS CUALITATIVO DE CONTENIDO RECIENTE:
        ${contentInsights}
        
        INSTRUCCIONES:
        Genera un JSON con predicciones refinadas que combinen datos numéricos y contextuales.
        Para cada palabra clave, proporciona:
        1. Valores numéricos ajustados (considerando el contexto cualitativo)
        2. Una breve explicación del "por qué" de la predicción
        
        Responde SOLO con un JSON válido siguiendo exactamente esta estructura:
        [
          {
            "keyword": "palabra clave",
            "currentValue": 45,
            "predictedValues": [50, 55, 60],
            "explanation": "Explicación de la predicción"
          }
        ]
      `;
      
      const response = await this.deepseekService.generateCompletion(prompt);
      
      try {
        // Intentar parsear la respuesta JSON
        const parsedResponse = JSON.parse(response);
        
        // Validar la estructura esperada
        if (Array.isArray(parsedResponse)) {
          return parsedResponse.map(item => ({
            keyword: String(item.keyword || ''),
            currentValue: Number(item.currentValue || 0),
            predictedValues: Array.isArray(item.predictedValues) ? 
              item.predictedValues.map(v => Number(v)) : [50, 55, 60],
            explanation: String(item.explanation || '')
          }));
        }
      } catch (error) {
        this.logger.error(`Error al parsear respuesta JSON: ${error.message}`);
      }
      
      // Si falló el parsing, crear una respuesta estructurada por defecto
      return keywords.map(keyword => {
        const predictions = keywordPredictions[keyword] || [50, 55, 60];
        return {
          keyword,
          currentValue: predictions[0] || 50,
          predictedValues: predictions.slice(1) || [55, 60],
          explanation: `Predicción basada en análisis de tendencias históricas para "${keyword}".`
        };
      });
    } catch (error) {
      this.logger.error(`Error en generación de predicción combinada: ${error.message}`);
      
      // Respuesta de emergencia
      return keywords.map(keyword => {
        const predictions = keywordPredictions[keyword] || [50, 55, 60];
        return {
          keyword,
          currentValue: predictions[0] || 50,
          predictedValues: predictions.slice(1) || [55, 60],
          explanation: `Predicción automática basada en datos históricos.`
        };
      });
    }
  }
  
  /**
   * Calcula los puntos óptimos para intervenciones de marketing
   */
  private calculateInterventionPoints(
    predictions: Array<{keyword: string, currentValue: number, predictedValues: number[], explanation: string}>
  ): Array<{timestamp: string, action: string, keywords: string[]}> {
    // Identificar palabras clave con mayor potencial
    const growingKeywords = predictions
      .filter(p => p.predictedValues[p.predictedValues.length - 1] > p.currentValue)
      .sort((a, b) => {
        const aGrowth = p.predictedValues[p.predictedValues.length - 1] - p.currentValue;
        const bGrowth = p.predictedValues[p.predictedValues.length - 1] - p.currentValue;
        return bGrowth - aGrowth;
      })
      .map(p => p.keyword);
    
    // Crear recomendaciones de intervención
    const now = new Date();
    const interventions = [];
    
    if (growingKeywords.length > 0) {
      // Primera intervención: a corto plazo (1 semana)
      const shortTerm = new Date(now);
      shortTerm.setDate(shortTerm.getDate() + 7);
      
      interventions.push({
        timestamp: shortTerm.toISOString(),
        action: "Crear contenido optimizado para conversión",
        keywords: growingKeywords.slice(0, 2)
      });
      
      // Segunda intervención: a medio plazo (2 semanas)
      const midTerm = new Date(now);
      midTerm.setDate(midTerm.getDate() + 14);
      
      interventions.push({
        timestamp: midTerm.toISOString(),
        action: "Lanzar campaña de marketing focalizada",
        keywords: growingKeywords.slice(0, 3)
      });
      
      // Tercera intervención: a más largo plazo (1 mes)
      const longTerm = new Date(now);
      longTerm.setDate(longTerm.getDate() + 30);
      
      interventions.push({
        timestamp: longTerm.toISOString(),
        action: "Desarrollar productos/servicios relacionados",
        keywords: growingKeywords
      });
    }
    
    return interventions;
  }
  
  /**
   * Sugiere acciones concretas basadas en las predicciones
   */
  private async suggestNextActions(
    niche: string,
    keywords: string[],
    predictions: Array<{keyword: string, currentValue: number, predictedValues: number[], explanation: string}>
  ): Promise<string[]> {
    try {
      // Identificar las keywords con mayor potencial
      const topKeywords = predictions
        .sort((a, b) => {
          const aGrowth = a.predictedValues[a.predictedValues.length - 1] - a.currentValue;
          const bGrowth = b.predictedValues[b.predictedValues.length - 1] - b.currentValue;
          return bGrowth - aGrowth;
        })
        .slice(0, 3)
        .map(p => p.keyword);
      
      const prompt = `
        Como experto en marketing de contenidos y SEO para el nicho de "${niche}", 
        sugiere 5 acciones concretas y accionables que se deberían tomar 
        considerando que estas palabras clave tienen una tendencia al alza:
        ${topKeywords.join(', ')}
        
        Cada acción debe ser específica, práctica y orientada a resultados.
        Devuelve solo las 5 acciones, una por línea, sin introducción ni conclusión.
      `;
      
      const response = await this.cohereService.generateCompletion(prompt);
      const actions = response.split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .slice(0, 5);
      
      return actions.length > 0 ? actions : this.getDefaultActions(niche, topKeywords);
    } catch (error) {
      this.logger.error(`Error al sugerir acciones: ${error.message}`);
      return this.getDefaultActions(niche, keywords.slice(0, 2));
    }
  }
  
  /**
   * Calcula una puntuación de confianza para las predicciones
   */
  private calculateConfidenceScore(predictions: Record<string, number[]>): number {
    // Más datos = mayor confianza
    const dataPoints = Object.values(predictions).reduce((acc, val) => acc + val.length, 0);
    const baseConfidence = Math.min(70, dataPoints * 5);
    
    // Ajustar por volatilidad (menos varianza = más confianza)
    let volatilityPenalty = 0;
    for (const values of Object.values(predictions)) {
      if (values.length > 1) {
        const variance = this.calculateVariance(values);
        volatilityPenalty += variance / 10;
      }
    }
    
    // Calcular confianza final (limitada entre 30-95%)
    return Math.max(30, Math.min(95, baseConfidence - volatilityPenalty));
  }
  
  /**
   * Calcula la varianza de un conjunto de valores
   */
  private calculateVariance(values: number[]): number {
    const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
  }
  
  /**
   * Genera una lista predeterminada de acciones recomendadas
   */
  private getDefaultActions(niche: string, keywords: string[]): string[] {
    return [
      `Crear contenido optimizado para SEO enfocado en ${keywords[0] || niche}`,
      `Desarrollar una guía completa sobre ${niche} incluyendo las últimas tendencias`,
      `Lanzar una campaña en redes sociales destacando ${keywords.join(' y ')}`,
      `Optimizar las páginas existentes para mejorar el posicionamiento en ${keywords.join(', ')}`,
      `Crear una serie de videos educativos sobre ${niche} para aumentar el engagement`
    ];
  }
  
  /**
   * Genera una predicción de emergencia cuando falla el análisis principal
   */
  private generateFallbackPrediction(niche: string, keywords: string[]): TrendPredictionResponse {
    const predictions = keywords.map(keyword => ({
      keyword,
      currentValue: 50,
      predictedValues: [55, 60, 65],
      explanation: `Estimación basada en tendencias generales para "${keyword}".`
    }));
    
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    
    return {
      niche,
      keywords,
      predictions,
      interventionPoints: [
        {
          timestamp: nextMonth.toISOString(),
          action: "Desarrollar contenido optimizado",
          keywords: keywords.slice(0, 2)
        }
      ],
      nextActions: this.getDefaultActions(niche, keywords),
      confidenceScore: 35, // Baja confianza para predicciones de emergencia
    };
  }
}