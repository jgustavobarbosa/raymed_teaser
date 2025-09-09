/**
 * Utilitário para deduplicação de registros quando skipDuplicates não está disponível (SQLite)
 */

export interface DedupeRecord {
  medicationId: string;
  labId?: string | null;
  capturedAt: Date;
  value: number;
}

/**
 * Remove duplicatas de array baseado em chave composta
 * Usado como fallback para skipDuplicates no SQLite
 */
export function dedupeRecords<T extends DedupeRecord>(records: T[]): T[] {
  const seen = new Map<string, T>();
  
  for (const record of records) {
    const key = [
      record.medicationId,
      record.labId ?? '',
      record.capturedAt.toISOString(),
      record.value.toString()
    ].join('|');
    
    if (!seen.has(key)) {
      seen.set(key, record);
    }
  }
  
  return Array.from(seen.values());
}

/**
 * Verifica se estamos usando SQLite baseado na configuração
 */
export function isSqliteDatabase(): boolean {
  const dbClient = process.env.DB_CLIENT?.toLowerCase();
  const databaseUrl = process.env.DATABASE_URL?.toLowerCase();
  
  return dbClient === 'sqlite' || databaseUrl?.includes('file:') || false;
}

/**
 * Executa createMany com opções condicionais baseado no tipo de banco
 */
export async function createManyWithOptions<T>(
  prismaModel: any,
  data: T[]
) {
  const isSqlite = isSqliteDatabase();
  
  if (isSqlite) {
    // Para SQLite: usar dedupe manual e createMany simples
    const deduplicatedData = dedupeRecords(data as any);
    return prismaModel.createMany({
      data: deduplicatedData,
    });
  } else {
    // Para PostgreSQL: usar skipDuplicates
    return prismaModel.createMany({
      data,
      skipDuplicates: true,
    });
  }
}
