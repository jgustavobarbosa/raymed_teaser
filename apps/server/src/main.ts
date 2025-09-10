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
  const webOrigin = configService.get('WEB_ORIGIN', 'http://localhost:3000');
  app.enableCors({
    origin: webOrigin.split(','),
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

  const port = configService.get('PORT', 3333);
  
  await app.listen(port);
  
  console.log(`🚀 Servidor rodando em http://localhost:${port}`);
  console.log(`📊 Health check: http://localhost:${port}/api/health`);
  console.log(`📋 Swagger: http://localhost:${port}/api/docs`);
}

bootstrap();
