import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { ProxyService } from './proxy.service';

@Controller('proxy/ray')
@UseGuards(ThrottlerGuard)
export class ProxyController {
  constructor(private readonly proxyService: ProxyService) {}

  @Get('medications')
  async getMedications(@Query() params: any) {
    return this.proxyService.getMedications(params);
  }

  @Get('labs')
  async getLabs() {
    return this.proxyService.getLabs();
  }

  @Get('medications/:code/prices')
  async getMedicationPrices(
    @Param('code') code: string,
    @Query() options: any
  ) {
    return this.proxyService.getMedicationPrices(code, options);
  }
}
