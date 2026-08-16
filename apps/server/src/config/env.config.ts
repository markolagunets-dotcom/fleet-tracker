import { plainToInstance } from 'class-transformer';
import { IsIn, IsInt, IsString, Max, Min, validateSync } from 'class-validator';

/**
 * Validated at boot rather than read ad hoc.
 *
 * The previous `process.env.X ?? 'localhost'` fallbacks meant a production container
 * missing CORS_ORIGIN or DATABASE_URL started happily, trusting localhost and writing
 * to an ephemeral database. Now it refuses to start.
 */
export class EnvConfig {
  @IsIn(['development', 'test', 'production'])
  NODE_ENV: 'development' | 'test' | 'production' = 'development';

  @IsInt()
  @Min(1)
  @Max(65_535)
  PORT = 3001;

  @IsString()
  CORS_ORIGIN = 'http://localhost:3000';

  @IsString()
  DATABASE_URL = 'file:./dev.db';
}

export function validateEnv(raw: Record<string, unknown>): EnvConfig {
  // Defaults applied explicitly rather than through class-transformer's
  // exposeDefaultValues, which does not fire reliably for a plain class.
  const config = plainToInstance(
    EnvConfig,
    {
      NODE_ENV: raw.NODE_ENV ?? 'development',
      // Environment variables are always strings; class-transformer's implicit
      // conversion does not fire reliably here, so coerce explicitly.
      PORT: raw.PORT === undefined ? 3001 : Number(raw.PORT),
      CORS_ORIGIN: raw.CORS_ORIGIN ?? 'http://localhost:3000',
      DATABASE_URL: raw.DATABASE_URL ?? 'file:./dev.db',
    },
    { enableImplicitConversion: true },
  );

  const errors = validateSync(config, { skipMissingProperties: false });
  if (errors.length > 0) {
    throw new Error(`invalid environment:\n${errors.map((error) => error.toString()).join('\n')}`);
  }

  // Defaults are a developer convenience; in production they hide misconfiguration.
  if (config.NODE_ENV === 'production') {
    for (const key of ['CORS_ORIGIN', 'DATABASE_URL'] as const) {
      if (raw[key] === undefined) {
        throw new Error(`${key} must be set explicitly when NODE_ENV=production`);
      }
    }
  }

  return config;
}
