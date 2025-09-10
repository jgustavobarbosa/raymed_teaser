import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller()
export class HealthController {
  constructor(private readonly healthService: HealthService) {}

  @Get('health')
  async getHealth() {
    return this.healthService.getHealthStatus();
  }

  @Get('healthz')
  async getHealthZ() {
    return this.healthService.getHealthStatus();
  }

  @Get('detailed')
  async getDetailedHealth() {
    return this.healthService.getDetailedHealthStatus();
  }
}
