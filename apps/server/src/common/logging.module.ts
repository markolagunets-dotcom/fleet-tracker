import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { LoggerModule } from 'nestjs-pino';
import type { EnvConfig } from '../config/env.config';

/**
 * Structured logging.
 *
 * JSON in production so a log shipper can index the fields; pretty-printed in
 * development because nobody greps their own terminal. Every line carries the
 * request id, which is what makes a 500 traceable back through the handlers that
 * produced it.
 */
@Module({
  imports: [
    LoggerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvConfig, true>) => {
        const isProduction = config.get('NODE_ENV', { infer: true }) === 'production';

        return {
          pinoHttp: {
            level: isProduction ? 'info' : 'debug',
            transport: isProduction
              ? undefined
              : { target: 'pino-pretty', options: { singleLine: true, translateTime: 'HH:MM:ss' } },

            // Health probes hit every few seconds and say nothing when they pass.
            autoLogging: {
              ignore: (req) => (req.url ?? '').startsWith('/api/health'),
            },

            customLogLevel: (_req, res, error) => {
              if (error || res.statusCode >= 500) return 'error';
              if (res.statusCode >= 400) return 'warn';
              return 'info';
            },

            // The defaults dump every header and both full objects per request.
            serializers: {
              req: (req: { id: unknown; method: string; url: string }) => ({
                id: req.id,
                method: req.method,
                url: req.url,
              }),
              res: (res: { statusCode: number }) => ({ statusCode: res.statusCode }),
            },

            redact: {
              paths: ['req.headers.authorization', 'req.headers.cookie'],
              remove: true,
            },
          },
        };
      },
    }),
  ],
})
export class LoggingModule {}
