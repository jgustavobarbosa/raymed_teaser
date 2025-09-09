import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class PricesService {
  constructor(private readonly prisma: PrismaService) {}

  async findByMedication(medicationId: string, limit: number = 50) {
    return this.prisma.price.findMany({
      where: { medicationId },
      include: {
        lab: true,
        medication: true,
      },
      orderBy: { capturedAt: 'desc' },
      take: limit,
    });
  }
}
