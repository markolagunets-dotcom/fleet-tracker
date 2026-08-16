import { Injectable, Logger, OnApplicationShutdown, OnModuleInit } from '@nestjs/common';
import { FleetService } from './fleet.service';
import { TICK_INTERVAL_MS } from './simulation.constants';

/**
 * Owns the cadence and nothing else.
 *
 * Separating the timer from the fleet means tests can step the simulation by hand,
 * and it gives shutdown a single place to stop the clock before draining writes.
 */
@Injectable()
export class TelemetryScheduler implements OnModuleInit, OnApplicationShutdown {
  private readonly logger = new Logger(TelemetryScheduler.name);
  private timer?: NodeJS.Timeout;

  constructor(private readonly fleet: FleetService) {}

  onModuleInit(): void {
    this.fleet.start();
    this.timer = setInterval(() => this.tick(), TICK_INTERVAL_MS);
  }

  async onApplicationShutdown(): Promise<void> {
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
