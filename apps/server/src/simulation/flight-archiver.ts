import { Inject, Injectable, Logger } from '@nestjs/common';
import type { FlightEndReason, Telemetry } from '@fleet-tracker/shared';
import { FLIGHT_ARCHIVE, type FlightArchive } from './flight-archive.port';
import { summariseTrack } from './flight-summary';

export interface ArchivedFlight {
  droneId: string;
  flightId: string;
}

/**
 * Turns a finished track into a persisted flight.
 *
 * Writes are deliberately not awaited by the tick loop — a slow disk must never
 * stall telemetry — so every in-flight promise is tracked and can be drained on
 * shutdown instead of being lost with the process.
 */
@Injectable()
export class FlightArchiver {
  private readonly logger = new Logger(FlightArchiver.name);
  private readonly pending = new Set<Promise<unknown>>();

  constructor(@Inject(FLIGHT_ARCHIVE) private readonly archive: FlightArchive) {}

  /**
   * Starts persisting the track. Resolves with the archived flight, or null if the
   * track was empty or the write failed; failures are logged, never thrown at the
   * caller, because the caller is a timer.
   */
  archiveFlight(
    droneId: string,
    track: Telemetry[],
    reason: FlightEndReason,
  ): Promise<ArchivedFlight | null> {
    if (track.length === 0) {
      return Promise.resolve(null);
    }

    const summary = summariseTrack(droneId, track, reason);

    const write = this.archive
      .record(summary, track)
      .then(({ id }): ArchivedFlight => ({ droneId, flightId: id }))
      .catch((error: unknown) => {
        this.logger.error(`failed to persist flight for ${droneId}`, error);
        return null;
      })
      .finally(() => {
        this.pending.delete(write);
      });

    this.pending.add(write);
    return write;
  }

  /** Lets shutdown wait for writes that are already in flight. */
  async drain(): Promise<void> {
    await Promise.allSettled([...this.pending]);
  }
}
