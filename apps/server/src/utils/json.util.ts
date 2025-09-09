/**
 * Utilitários para lidar com JSON de forma compatível entre SQLite e PostgreSQL
 */

import { Prisma } from '@prisma/client';

/**
 * Verifica se estamos usando PostgreSQL (suporta JSON nativo)
 */
export function isPostgreSQL(): boolean {
  const provider = process.env.DB_PROVIDER?.toLowerCase();
  return provider === 'postgresql';
}

/**
 * Converte objeto para formato compatível com o banco
 */
export function toJsonValue(obj: any): string {
  // Para compatibilidade máxima, sempre serializar como string
  return JSON.stringify(obj);
}

/**
 * Converte valor do banco para objeto JavaScript
 */
export function fromJsonValue<T = any>(value: Prisma.JsonValue | string | null): T | null {
  if (value === null || value === undefined) {
    return null;
  }

  if (isPostgreSQL()) {
    return value as T;
  } else {
    // SQLite: deserializar string
    try {
      return typeof value === 'string' ? JSON.parse(value) : value as T;
    } catch {
      return null;
    }
  }
}

/**
 * Helper para criar dados com meta JSON compatível
 */
export function createWithMeta<T extends Record<string, any>>(
  data: T,
  meta?: any
): T & { meta?: string } {
  if (!meta) {
    return data;
  }

  return {
    ...data,
    meta: toJsonValue(meta),
  };
}

/**
 * Helper para ler dados com meta JSON compatível
 */
export function readWithMeta<T extends { meta?: Prisma.JsonValue | string | null }>(
  record: T
): T & { metaParsed?: any } {
  return {
    ...record,
    metaParsed: fromJsonValue(record.meta),
  };
}
