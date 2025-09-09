import { Injectable } from '@nestjs/common';
import { CacheService } from '../cache/cache.service';
import { createRayClient } from '@raymed/shared';

@Injectable()
export class ProxyService {
  private rayClient = createRayClient();

  constructor(private readonly cache: CacheService) {}

  async getMedications(params?: any) {
    const cacheKey = `ray:medications:${JSON.stringify(params || {})}`;
    
    return this.cache.getOrSet(
      cacheKey,
      () => this.rayClient.listMedications(params),
      900 // 15 minutos
    );
  }

  async getLabs() {
    const cacheKey = 'ray:labs';
    
    return this.cache.getOrSet(
      cacheKey,
      () => this.rayClient.listLabs(),
      1800 // 30 minutos
    );
  }

  async getMedicationPrices(code: string, options?: any) {
    const cacheKey = `ray:prices:${code}:${JSON.stringify(options || {})}`;
    
    return this.cache.getOrSet(
      cacheKey,
      () => this.rayClient.getMedicationPrices(code, options),
      300 // 5 minutos
    );
  }
}
