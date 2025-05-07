import { IsString, IsArray, IsOptional, IsNumber, IsObject, IsDate, IsDateString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

// Agregar a trends-dto.ts

export class HistoricalPoint {
  @IsDateString()
  date!: string;

  @IsNumber()
  value!: number;
}

export class PredictionInput {
  @IsString()
  niche!: string;

  @IsArray()
  @IsString({ each: true })
  keywords!: string[];

  @IsObject()
  historicalData!: Record<string, HistoricalPoint[]>;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  recentArticles?: string[];
}

export class PredictionDetail {
  @IsString()
  keyword!: string;

  @IsNumber()
  currentValue!: number;

  @IsArray()
  @IsNumber({}, { each: true })
  predictedValues!: number[];

  @IsString()
  explanation!: string;
}

export class InterventionPoint {
  @IsDateString()
  timestamp!: string;

  @IsString()
  action!: string;

  @IsArray()
  @IsString({ each: true })
  keywords!: string[];
}

export class TrendPredictionResponse {
  @IsString()
  niche!: string;

  @IsArray()
  @IsString({ each: true })
  keywords!: string[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => PredictionDetail)
  predictions!: PredictionDetail[];

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => InterventionPoint)
  interventionPoints!: InterventionPoint[];

  @IsArray()
  @IsString({ each: true })
  nextActions!: string[];

  @IsNumber()
  confidenceScore!: number;
}