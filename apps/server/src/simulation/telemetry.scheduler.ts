import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { FleetService } from './fleet.service';
import { TICK_INTERVAL_MS } from './simulation.constants';

/**
 * Owns the cadence and nothing else.
 *
 * Separating the timer from the fleet means tests can step the simulation by hand,
 * and it gives shutdown a single place to stop the clock before draining writes.
 */
@Injectable()
export class TelemetryScheduler implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(TelemetryScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly fleet: FleetService) {}

  onModuleInit(): void {
    this.fleet.start();
    this.timer = setInterval(() => this.tick(), TICK_INTERVAL_MS);
  }

  /**
   * Runs in the first shutdown phase, on purpose.
   *
   * Nest's order is onModuleDestroy -> beforeApplicationShutdown ->
   * onApplicationShutdown. Draining any later would hand pending writes to a Prisma
   * client that has already disconnected, and the interval would keep producing
   * flights against it. PrismaService disconnects in the last phase to match.
   */
  async onModuleDestroy(): Promise<void> {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
    await this.fleet.shutdown();
  }

  /** A throw here would otherwise be an unhandled exception and kill the process. */
  private tick(): void {
    try {
      this.fleet.tickOnce();
    } catch (error) {
      this.logger.error('simulation tick failed', error);
    }
  }
}
