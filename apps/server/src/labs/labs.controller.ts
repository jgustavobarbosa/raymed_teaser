import { Controller, Get, Param, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { LabsService } from './labs.service';

@Controller('labs')
@UseGuards(ThrottlerGuard)
export class LabsController {
  constructor(private readonly labsService: LabsService) {}

  @Get()
  async findAll() {
    return this.labsService.findAll();
  }

  @Get('ranking')
  async getRanking() {
    return this.labsService.getLabRanking();
  }

  @Get(':id')
  async findById(@Param('id') id: string) {
    const lab = await this.labsService.findById(id);
    
    if (!lab) {
      return { error: 'Laboratório não encontrado' };
    }
    
    return lab;
  }
}
