import { IsString, IsOptional, IsNumber, Min } from 'class-validator';

export class GetMedicationsQueryDto {
  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @IsString()
  category?: string;

  @IsOptional()
  @IsString()
  labId?: string;

  @IsOptional()
  @IsString()
  sortBy?: 'name' | 'price' | 'variation24h' | 'variation30d';

  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc';

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number = 1;

  @IsOptional()
  @IsNumber()
  @Min(1)
  limit?: number = 20;

  @IsOptional()
  @IsNumber()
  minPrice?: number;

  @IsOptional()
  @IsNumber()
  maxPrice?: number;
}

export class MedicationResponseDto {
  id: string;
  code: string;
  name: string;
  activeIngredient?: string;
  category?: string;
  createdAt: Date;
  currentPrice?: {
    value: number;
    labName: string;
    labId: string;
    capturedAt: Date;
  };
  variation24h?: number;
  variation30d?: number;
  lowestPriceLab?: {
    labId: string;
    labName: string;
    price: number;
  };
}

export class MedicationDetailDto {
  id: string;
  code: string;
  name: string;
  activeIngredient?: string;
  category?: string;
  createdAt: Date;
  priceHistory: Array<{
    date: Date;
    price: number;
    labName?: string;
    labId?: string;
  }>;
  labPrices: Array<{
    labId: string;
    labName: string;
    currentPrice: number;
    lastUpdate: Date;
    variation24h?: number;
  }>;
  statistics: {
    minPrice: number;
    maxPrice: number;
    avgPrice: number;
    medianPrice: number;
    lastUpdate: Date;
  };
  projection?: Array<{
    date: Date;
    predictedPrice: number;
    confidence: number;
  }>;
}
