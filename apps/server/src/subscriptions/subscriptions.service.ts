import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class SubscriptionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findByUser(userId: string) {
    return this.prisma.subscription.findMany({
      where: { userId },
      include: {
        medication: true,
        lab: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async create(data: any) {
    return this.prisma.subscription.create({
      data,
      include: {
        medication: true,
        lab: true,
      },
    });
  }

  async update(id: string, data: any) {
    return this.prisma.subscription.update({
      where: { id },
      data,
      include: {
        medication: true,
        lab: true,
      },
    });
  }

  async delete(id: string) {
    return this.prisma.subscription.delete({
      where: { id },
    });
  }
}
