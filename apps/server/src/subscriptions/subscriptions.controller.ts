import { Controller, Get, Post, Put, Delete, Param, Body } from '@nestjs/common';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get('user/:userId')
  async findByUser(@Param('userId') userId: string) {
    return this.subscriptionsService.findByUser(userId);
  }

  @Post()
  async create(@Body() createDto: any) {
    return this.subscriptionsService.create(createDto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateDto: any) {
    return this.subscriptionsService.update(id, updateDto);
  }

  @Delete(':id')
  async delete(@Param('id') id: string) {
    return this.subscriptionsService.delete(id);
  }
}
