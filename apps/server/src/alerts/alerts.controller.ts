import { Controller, Get, Param, Query } from '@nestjs/common';
import { AlertsService } from './alerts.service';

@Controller('alerts')
export class AlertsController {
  constructor(private readonly alertsService: AlertsService) {}

  @Get('user/:userId')
  async findByUser(
    @Param('userId') userId: string,
    @Query('limit') limit?: string
  ) {
    const parsedLimit = limit ? parseInt(limit, 10) : 20;
    return this.alertsService.findByUser(userId, parsedLimit);
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const alert = await this.alertsService.findById(id);
    if (!alert) {
      return { error: 'Alerta não encontrado' };
    }
    return alert;
  }
}
