import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import cookieParser from 'cookie-parser';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Matches the API list in the project description (/api/auth/..., /api/admin/...).
  app.setGlobalPrefix('api');

  app.use(cookieParser());

  // Cookies only work cross-origin with credentials: true and an exact origin.
  app.enableCors({
    origin: process.env.FRONTEND_URL ?? 'http://localhost:3000',
    credentials: true,
  });

  // GEN-13: validation is always enforced on the backend.
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  const swaggerConfig = new DocumentBuilder()
    .setTitle('SW-P1 API')
    .setDescription('API documentation for the SW-P1 project')
    .setVersion('1.0')
    .addCookieAuth('access_token')
    .build();

  const document = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('docs', app, document);

  // Next.js uses port 3000 by default, so the API runs on 4000.
  await app.listen(process.env.PORT ?? 4000);
}

void bootstrap();
