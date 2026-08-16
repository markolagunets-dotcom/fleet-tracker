import type { FlightEndReason, Telemetry } from '@fleet-tracker/shared';
import { distanceM } from './geo';

export interface FlightSummaryInput {
  droneId: string;
  startedAt: Date;
  endedAt: Date;
  distanceM: number;
  maxAltM: number;
  endedReason: FlightEndReason;
}

/** Aggregates a finished track into the row we persist. Pure; no clock, no I/O. */
export function summariseTrack(
  droneId: string,
  track: Telemetry[],
  endedReason: FlightEndReason,
): FlightSummaryInput {
  const first = track[0];
  const last = track[track.length - 1];

  let travelled = 0;
  let maxAlt = 0;

  for (let i = 0; i < track.length; i += 1) {
    const point = track[i]!;
    maxAlt = Math.max(maxAlt, point.alt);
    const previous = track[i - 1];
    if (previous) {
      travelled += distanceM(
        { lat: previous.lat, lon: previous.lon },
        { lat: point.lat, lon: point.lon },
      );
    }
  }

  return {
    droneId,
    startedAt: new Date(first?.ts ?? 0),
    endedAt: new Date(last?.ts ?? 0),
    distanceM: Math.round(travelled * 100) / 100,
    maxAltM: maxAlt,
    endedReason,
  };
}
