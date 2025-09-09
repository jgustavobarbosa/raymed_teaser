import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';
import { LlmService } from './llm.service';

@Controller('llm')
@UseGuards(ThrottlerGuard)
export class LlmController {
  constructor(private readonly llmService: LlmService) {}

  @Post('query')
  async processQuery(@Body() body: { question: string }) {
    if (!body.question?.trim()) {
      return { error: 'Pergunta é obrigatória' };
    }

    try {
      return await this.llmService.processQuery(body.question);
    } catch (error) {
      return {
        error: 'Erro ao processar pergunta',
        message: error instanceof Error ? error.message : 'Erro desconhecido',
      };
    }
  }
}
