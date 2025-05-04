import { IsString, IsArray, IsOptional, IsUrl, ArrayMaxSize, ArrayMinSize, IsNumber } from 'class-validator';

export class AnalyzeNicheDto {
  @IsString()
  niche!: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(7)
  @IsString({ each: true })
  keywords!: string[];

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(4)
  @IsUrl({}, { each: true })
  competitorUrls?: string[];
}

export class TrendOpportunity {
  @IsNumber()
  id!: number;

  @IsString()
  title!: string;

  @IsString()
  justification!: string;

  @IsOptional()
  @IsNumber()
  growth?: number;

  @IsArray()
  @IsString({ each: true })
  suggestedTitles!: string[];

  @IsOptional()
  @IsString()
  approach?: string;
}

export class TrendsResponse {
  @IsString()
  niche!: string;

  @IsArray()
  @IsString({ each: true })
  keywords!: string[];

  @IsArray()
  trendingKeywords!: Array<{ keyword: string; growth: number }>;

  @IsArray()
  opportunities!: TrendOpportunity[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recentArticles?: string[];
}