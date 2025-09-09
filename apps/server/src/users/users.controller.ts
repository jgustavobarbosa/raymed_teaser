import { Controller, Get, Post, Put, Param, Body, Query } from '@nestjs/common';
import { UsersService } from './users.service';

@Controller('users')
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Get('by-email')
  async findByEmail(@Query('email') email: string) {
    if (!email) {
      return { error: 'Email é obrigatório' };
    }
    
    const user = await this.usersService.findByEmail(email);
    if (!user) {
      return { error: 'Usuário não encontrado' };
    }
    
    return user;
  }

  @Post()
  async create(@Body() createDto: any) {
    return this.usersService.create(createDto);
  }

  @Put(':id')
  async update(@Param('id') id: string, @Body() updateDto: any) {
    return this.usersService.update(id, updateDto);
  }
}
