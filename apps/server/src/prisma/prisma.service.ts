import { Injectable, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { PrismaClient } from '@prisma/client';
import type { EnvConfig } from '../config/env.config';

/**
 * Prisma 7 requires an explicit driver adapter — constructing PrismaClient with no
 * options throws at runtime rather than falling back to a bundled engine.
 */
@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnApplicationShutdown {
  constructor(config: ConfigService<EnvConfig, true>) {
    super({
      adapter: new PrismaBetterSqlite3({ url: config.get('DATABASE_URL', { infer: true }) }),
    });
  }

  async onModuleInit(): Promise<void> {
    await this.$connect();
  }

  /**
   * The last shutdown phase, so the simulation has already drained its pending
   * writes. Disconnecting in onModuleDestroy — the first phase — would kill them.
   */
  async onApplicationShutdown(): Promise<void> {
    await this.$disconnect();
  }
}
