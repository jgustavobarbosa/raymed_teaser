/**
 * Utilitários para conversão entre Decimal e Number
 * Resolve problemas de compatibilidade entre SQLite/PostgreSQL e Prisma.Decimal
 */

import { Prisma } from '@prisma/client';

/**
 * Converte qualquer valor para number, tratando Prisma.Decimal adequadamente
 */
export function asNumber(x: unknown): number {
  // Se já é um Prisma.Decimal, usar toNumber()
  if (x instanceof Prisma.Decimal) {
    return x.toNumber();
  }
  
  // Se é string ou number, converter diretamente
  if (typeof x === 'string' || typeof x === 'number') {
    return Number(x);
  }
  
  // Fallback: tentar criar Decimal e converter
  try {
    return Number(new Prisma.Decimal(x as any));
  } catch {
    return 0; // Valor padrão seguro
  }
}

/**
 * Converte number para Prisma.Decimal
 */
export function asDecimal(x: number | string): Prisma.Decimal {
  return new Prisma.Decimal(x);
}

/**
 * Converte valor para Decimal com precisão específica
 */
export function asDecimalWithPrecision(x: number | string, precision: number = 2): Prisma.Decimal {
  const decimal = new Prisma.Decimal(x);
  return decimal.toDecimalPlaces(precision);
}

/**
 * Compara dois valores que podem ser Decimal ou number
 */
export function compareValues(a: unknown, b: unknown): number {
  const numA = asNumber(a);
  const numB = asNumber(b);
  return numA - numB;
}

/**
 * Formata valor como moeda brasileira
 */
export function formatCurrency(value: unknown): string {
  const num = asNumber(value);
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num);
}

/**
 * Calcula porcentagem entre dois valores
 */
export function calculatePercentageChange(oldValue: unknown, newValue: unknown): number {
  const oldNum = asNumber(oldValue);
  const newNum = asNumber(newValue);
  
  if (oldNum === 0) return newNum > 0 ? 100 : 0;
  return ((newNum - oldNum) / oldNum) * 100;
}
