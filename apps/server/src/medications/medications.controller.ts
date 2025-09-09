import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { MedicationsService } from './medications.service';
import { GetMedicationsQueryDto } from './dto/medication.dto';

@Controller('medications')
@UseGuards(ThrottlerGuard)
export class MedicationsController {
  constructor(private readonly medicationsService: MedicationsService) {}

  @Get()
  async findAll(@Query() query: GetMedicationsQueryDto) {
    return this.medicationsService.findAll(query);
  }

  @Get('categories')
  async getCategories() {
    return this.medicationsService.getCategories();
  }

  @Get('recent-drops')
  async getRecentDrops(@Query('limit') limit?: string) {
    const parsedLimit = limit ? parseInt(limit, 10) : 10;
    return this.medicationsService.getRecentDrops(parsedLimit);
  }

  @Get(':code')
  async findByCode(@Param('code') code: string) {
    const medication = await this.medicationsService.findByCode(code);
    
    if (!medication) {
      return { error: 'Medicamento não encontrado' };
    }
    
    return medication;
  }
}
