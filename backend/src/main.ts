import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module.js';
import {
  assertConfiguredOrigins,
  configuredOrigins,
} from './shared/http/allowed-origins.js';

async function bootstrap() {
  assertConfiguredOrigins();

  const app = await NestFactory.create(AppModule);
  app.enableCors({ origin: configuredOrigins(), credentials: true });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true }));
  await app.listen(process.env.PORT ?? 3000);
}
await bootstrap();
