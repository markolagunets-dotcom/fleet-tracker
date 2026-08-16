import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';
import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './bootstrap';
import type { EnvConfig } from './config/env.config';

async function bootstrap(): Promise<void> {
  // bufferLogs so bootstrap output goes through pino too, not the default writer.
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  const config = app.get(ConfigService<EnvConfig, true>);

  configureApp(app, config.get('CORS_ORIGIN', { infer: true }));
  setupSwagger(app);

  await app.listen(config.get('PORT', { infer: true }));
}

void bootstrap();
