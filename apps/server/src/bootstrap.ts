import { INestApplication, ValidationPipe } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { WsAdapter } from '@nestjs/platform-ws';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { DomainExceptionFilter } from './common/domain-exception.filter';

/**
 * Everything that shapes request handling, in one place.
 *
 * Tests call this too, so a pipe or filter added here is actually exercised by the
 * e2e suite instead of silently diverging from production.
 */
export function configureApp(app: INestApplication, corsOrigin: string): void {
  app.enableShutdownHooks();
  app.setGlobalPrefix('api');
  app.enableCors({ origin: corsOrigin });
  app.useWebSocketAdapter(new WsAdapter(app));
  app.useGlobalPipes(
    new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true }),
  );
  app.useGlobalFilters(new DomainExceptionFilter(app.get(HttpAdapterHost).httpAdapter));
}

export function setupSwagger(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('FleetTracker API')
    .setDescription('Drone fleet telemetry and flight log')
    .setVersion('0.1.0')
    .build();
  SwaggerModule.setup('api/docs', app, SwaggerModule.createDocument(app, config));
}
