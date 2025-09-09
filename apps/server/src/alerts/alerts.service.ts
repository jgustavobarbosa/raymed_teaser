import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AlertsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUser(userId: string, limit: number = 20) {
    return this.prisma.alert.findMany({
      where: { userId },
      include: {
        medication: true,
        price: {
          include: {
            lab: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async findById(id: string) {
    return this.prisma.alert.findUnique({
      where: { id },
      include: {
        user: true,
        medication: true,
        price: {
          include: {
            lab: true,
          },
        },
      },
    });
  }
}
