import { Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, RedisClientType } from 'redis';
import { SimpleCache } from '@raymed/shared';

@Injectable()
export class CacheService implements OnModuleInit {
  private redisClient: RedisClientType | null = null;
  private memoryCache = new SimpleCache<any>();
  private useRedis = false;

  constructor(private readonly config: ConfigService) {}

  async onModuleInit() {
    const redisUrl = this.config.get('REDIS_URL');
    
    if (redisUrl) {
      try {
        this.redisClient = createClient({ url: redisUrl });
        
        this.redisClient.on('error', (err) => {
          console.warn('Redis connection error, fallback to memory cache:', err);
          this.useRedis = false;
        });

        await this.redisClient.connect();
        this.useRedis = true;
        console.log('🔴 Redis cache conectado');
      } catch (error) {
        console.warn('Falha ao conectar Redis, usando cache em memória:', error);
        this.useRedis = false;
      }
    } else {
      console.log('💾 Usando cache em memória');
    }
  }

  async get<T>(key: string): Promise<T | null> {
    try {
      if (this.useRedis && this.redisClient) {
        const value = await this.redisClient.get(key);
        return value ? JSON.parse(value) : null;
      } else {
        return this.memoryCache.get(key);
      }
    } catch (error) {
      console.warn(`Cache get error for key ${key}:`, error);
      return null;
    }
  }

  async set(key: string, value: any, ttlSeconds: number = 300): Promise<void> {
    try {
      if (this.useRedis && this.redisClient) {
        await this.redisClient.setEx(key, ttlSeconds, JSON.stringify(value));
      } else {
        this.memoryCache.set(key, value, ttlSeconds * 1000);
      }
    } catch (error) {
      console.warn(`Cache set error for key ${key}:`, error);
    }
  }

  async del(key: string): Promise<void> {
    try {
      if (this.useRedis && this.redisClient) {
        await this.redisClient.del(key);
      } else {
        this.memoryCache.delete(key);
      }
    } catch (error) {
      console.warn(`Cache delete error for key ${key}:`, error);
    }
  }

  async has(key: string): Promise<boolean> {
    try {
      if (this.useRedis && this.redisClient) {
        const exists = await this.redisClient.exists(key);
        return exists === 1;
      } else {
        return this.memoryCache.has(key);
      }
    } catch (error) {
      console.warn(`Cache has error for key ${key}:`, error);
      return false;
    }
  }

  async clear(): Promise<void> {
    try {
      if (this.useRedis && this.redisClient) {
        await this.redisClient.flushAll();
      } else {
        this.memoryCache.clear();
      }
    } catch (error) {
      console.warn('Cache clear error:', error);
    }
  }

  async keys(pattern: string = '*'): Promise<string[]> {
    try {
      if (this.useRedis && this.redisClient) {
        return await this.redisClient.keys(pattern);
      } else {
        // Memory cache não suporta patterns, retorna todas as chaves
        return [];
      }
    } catch (error) {
      console.warn(`Cache keys error for pattern ${pattern}:`, error);
      return [];
    }
  }

  // Método helper para cache com fallback
  async getOrSet<T>(
    key: string,
    fetchFn: () => Promise<T>,
    ttlSeconds: number = 300
  ): Promise<T> {
    const cached = await this.get<T>(key);
    
    if (cached !== null) {
      return cached;
    }

    const value = await fetchFn();
    await this.set(key, value, ttlSeconds);
    
    return value;
  }

  // Invalidar cache por padrão
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      if (this.useRedis && this.redisClient) {
        const keys = await this.redisClient.keys(pattern);
        if (keys.length > 0) {
          await this.redisClient.del(keys);
        }
      } else {
        // Para memory cache, limpar tudo (não temos pattern matching)
        this.memoryCache.clear();
      }
    } catch (error) {
      console.warn(`Cache invalidate pattern error for ${pattern}:`, error);
    }
  }
}
