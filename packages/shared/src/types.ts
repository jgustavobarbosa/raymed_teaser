import { z } from 'zod';

// Schemas de validação Zod
export const MedicationSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  activeIngredient: z.string().optional(),
  category: z.string().optional(),
  createdAt: z.date(),
});

export const LabSchema = z.object({
  id: z.string(),
  name: z.string(),
  cnpj: z.string().optional(),
  createdAt: z.date(),
});

export const PriceSchema = z.object({
  id: z.string(),
  medicationId: z.string(),
  labId: z.string().optional(),
  source: z.string(),
  currency: z.string().default('BRL'),
  value: z.number(),
  capturedAt: z.date(),
  receivedAt: z.date(),
  meta: z.record(z.any()).optional(),
});

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  name: z.string().optional(),
  role: z.enum(['user', 'admin']).default('user'),
  createdAt: z.date(),
  preferences: z.record(z.any()).optional(),
});

export const SubscriptionSchema = z.object({
  id: z.string(),
  userId: z.string(),
  medicationId: z.string(),
  labId: z.string().optional(),
  minDropPct: z.number().min(0).max(1).optional(),
  targetPrice: z.number().positive().optional(),
  createdAt: z.date(),
  isActive: z.boolean().default(true),
});

export const AlertSchema = z.object({
  id: z.string(),
  userId: z.string(),
  medicationId: z.string(),
  priceId: z.string(),
  reason: z.enum(['DROP_PCT', 'TARGET_PRICE', 'SPIKE']),
  diffPct: z.number().optional(),
  snapshot: z.record(z.any()).optional(),
  sentAt: z.date().optional(),
  createdAt: z.date(),
});

// Tipos TypeScript inferidos dos schemas
export type Medication = z.infer<typeof MedicationSchema>;
export type Lab = z.infer<typeof LabSchema>;
export type Price = z.infer<typeof PriceSchema>;
export type User = z.infer<typeof UserSchema>;
export type Subscription = z.infer<typeof SubscriptionSchema>;
export type Alert = z.infer<typeof AlertSchema>;

// Tipos para API Ray
export interface RayMedication {
  codigo: string;
  nome: string;
  principioAtivo?: string;
  categoria?: string;
  laboratorio?: string;
  precoAtual?: number;
  dataUltimaAtualizacao?: string;
}

export interface RayLab {
  id: string;
  nome: string;
  cnpj?: string;
}

export interface RayPrice {
  medicamentoCodigo: string;
  laboratorioId?: string;
  preco: number;
  moeda: string;
  dataCaptura: string;
  fonte: string;
  metadados?: Record<string, any>;
}

export interface RayPriceHistory {
  medicamentoCodigo: string;
  laboratorioId?: string;
  historico: Array<{
    data: string;
    preco: number;
    laboratorio?: string;
  }>;
}

// Tipos para respostas da API
export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
  message?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Tipos para alertas
export interface AlertTrigger {
  type: 'DROP_PCT' | 'TARGET_PRICE' | 'SPIKE';
  medicationId: string;
  currentPrice: number;
  previousPrice?: number;
  targetPrice?: number;
  dropPercentage?: number;
  labId?: string;
  labName?: string;
}

// Tipos para projeções
export interface PriceProjection {
  medicationId: string;
  labId?: string;
  projections: Array<{
    date: string;
    predictedPrice: number;
    confidence: number;
    trend: 'up' | 'down' | 'stable';
  }>;
  method: 'EWMA' | 'PROPHET' | 'LINEAR';
  accuracy?: number;
}

// Tipos para LLM
export interface LLMMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

export interface LLMResponse {
  content: string;
  sources?: Array<{
    type: 'medication' | 'lab' | 'price' | 'trend';
    id: string;
    name: string;
    url: string;
    relevantData?: Record<string, any>;
  }>;
  confidence?: number;
}

export interface LLMProvider {
  name: 'openai' | 'anthropic' | 'gemini';
  model: string;
  apiKey: string;
}

// Tipos para cache
export interface CacheEntry<T> {
  data: T;
  timestamp: number;
  ttl: number;
}

// Tipos para métricas e admin
export interface SystemMetrics {
  totalMedications: number;
  totalLabs: number;
  totalUsers: number;
  totalSubscriptions: number;
  alertsSentLast24h: number;
  avgResponseTime: number;
  apiCallsLast24h: number;
  cacheHitRate: number;
  lastIngestRun?: Date;
  lastAnalysisRun?: Date;
  lastNotificationRun?: Date;
}

export interface JobStatus {
  name: string;
  status: 'running' | 'completed' | 'failed' | 'pending';
  lastRun?: Date;
  nextRun?: Date;
  duration?: number;
  error?: string;
}

// Tipos para filtros e buscas
export interface MedicationFilters {
  search?: string;
  category?: string;
  labId?: string;
  priceRange?: {
    min?: number;
    max?: number;
  };
  variationRange?: {
    min?: number;
    max?: number;
  };
  sortBy?: 'name' | 'price' | 'variation24h' | 'variation30d';
  sortOrder?: 'asc' | 'desc';
}

export interface AlertFilters {
  userId?: string;
  medicationId?: string;
  reason?: Alert['reason'];
  dateRange?: {
    start: Date;
    end: Date;
  };
  sent?: boolean;
}

// Constantes
export const ALERT_REASONS = {
  DROP_PCT: 'Queda percentual significativa',
  TARGET_PRICE: 'Preço alvo atingido',
  SPIKE: 'Variação diária elevada',
} as const;

export const USER_ROLES = {
  user: 'Usuário',
  admin: 'Administrador',
} as const;

export const PRICE_SOURCES = {
  RAY_API: 'Ray API',
  MANUAL: 'Manual',
  IMPORT: 'Importação',
} as const;
