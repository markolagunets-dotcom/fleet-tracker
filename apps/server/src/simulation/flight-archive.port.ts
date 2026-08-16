import type { Telemetry } from '@fleet-tracker/shared';
import type { FlightSummaryInput } from './flight-summary';

/**
 * What the simulation needs from storage — nothing more.
 *
 * The core depends on this interface, and the Prisma-backed repository is bound to
 * it in the module, so the dependency points inward rather than at the database.
 */
export interface FlightArchive {
  record(summary: FlightSummaryInput, track: Telemetry[]): Promise<{ id: string }>;
}

export const FLIGHT_ARCHIVE = Symbol('FLIGHT_ARCHIVE');
