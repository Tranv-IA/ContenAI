// Tipos para el análisis de tendencias

export interface HistoricalPoint {
  date: string;
  value: number;
}

export interface AnalyzeNicheDto {
  niche: string;
  keywords: string[];
  competitorUrls?: string[];
}

export interface TrendOpportunity {
  id: number;
  title: string;
  justification: string;
  growth?: number;
  suggestedTitles: string[];
  approach?: string;
}

export interface TrendsResponse {
  niche: string;
  keywords: string[];
  trendingKeywords: Array<{ keyword: string; growth: number }>;
  opportunities: TrendOpportunity[];
  recentArticles?: string[];
}

export interface PredictionDetail {
  keyword: string;
  currentValue: number;
  predictedValues: number[];
  explanation: string;
}

export interface InterventionPoint {
  timestamp: string;
  action: string;
  keywords: string[];
}

export interface TrendPredictionResponse {
  niche: string;
  keywords: string[];
  predictions: PredictionDetail[];
  interventionPoints: InterventionPoint[];
  nextActions: string[];
  confidenceScore: number;
}

export interface PredictionInput {
  niche: string;
  keywords: string[];
  historicalData: Record<string, HistoricalPoint[]>;
  recentArticles?: string[];
}