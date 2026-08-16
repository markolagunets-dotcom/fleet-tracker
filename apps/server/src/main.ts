import 'reflect-metadata';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configureApp, setupSwagger } from './bootstrap';
import type { EnvConfig } from './config/env.config';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService<EnvConfig, true>);

  configureApp(app, config.get('CORS_ORIGIN', { infer: true }));
  setupSwagger(app);

  await app.listen(config.get('PORT', { infer: true }));
}

void bootstrap();
