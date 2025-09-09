import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    logger: ['error', 'warn', 'log', 'debug', 'verbose'],
  });

  const configService = app.get(ConfigService);

  // Configurar CORS
  app.enableCors({
    origin: [
      'http://localhost:3000',
      'https://raymed.vercel.app',
      configService.get('FRONTEND_URL'),
    ].filter(Boolean),
    credentials: true,
  });

  // Configurar pipes globais
  app.useGlobalPipes(
    new ValidationPipe({
      transform: true,
      whitelist: true,
      forbidNonWhitelisted: true,
    }),
  );

  // Prefixo global para API
  app.setGlobalPrefix('api');

  const port = configService.get('PORT', 3001);
  
  await app.listen(port);
  
  console.log(`🚀 Servidor rodando em http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/api/health`);
  console.log(`📋 Swagger: http://localhost:${port}/api/docs`);
}

bootstrap();
