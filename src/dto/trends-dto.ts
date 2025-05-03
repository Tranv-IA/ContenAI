// src/dto/trends.dto.ts
import { IsString, IsArray, IsOptional, IsUrl, ArrayMaxSize, ArrayMinSize } from 'class-validator';

export class AnalyzeNicheDto {
  @IsString()
  niche: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsString({ each: true })
  keywords: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsUrl({}, { each: true })
  competitorUrls?: string[];
}

export class TrendOpportunity {
  id: number;
  title: string;
  justification: string;
  growth?: number;
  suggestedTitles: string[];
  approach?: string;
}

export class TrendsResponse {
  niche: string;
  keywords: string[];
  trendingKeywords: Array<{keyword: string, growth: number}>;
  opportunities: TrendOpportunity[];
  recentArticles?: string[];
}
