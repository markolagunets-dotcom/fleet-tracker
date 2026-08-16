import type { DroneStatus, ServerMessage, Telemetry } from './types';

const STATUSES: readonly DroneStatus[] = ['FLYING', 'RTB', 'LANDED', 'PAUSED'];

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null;

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

function isTelemetry(value: unknown): value is Telemetry {
  if (!isRecord(value)) {
    return false;
  }

  return (
    typeof value.droneId === 'string' &&
    isFiniteNumber(value.ts) &&
    isFiniteNumber(value.lat) &&
    isFiniteNumber(value.lon) &&
    isFiniteNumber(value.alt) &&
    isFiniteNumber(value.battery) &&
    isFiniteNumber(value.speed) &&
    isFiniteNumber(value.heading) &&
    STATUSES.includes(value.status as DroneStatus)
  );
}

/**
 * The single entry point for anything arriving over the socket.
 *
 * A cast (`JSON.parse(raw) as ServerMessage`) is a promise, not a check: a renamed
 * or missing field would reach the renderer and take it down. This returns null
 * instead, so the caller can drop the frame and keep the connection.
 */
export function parseServerMessage(raw: string): ServerMessage | null {
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return null;
  }

  if (!isRecord(value)) {
    return null;
  }

  if (value.type === 'tick') {
    return Array.isArray(value.points) && value.points.every(isTelemetry)
      ? { type: 'tick', points: value.points as Telemetry[] }
      : null;
  }

  if (value.type === 'flightEnded') {
    return typeof value.droneId === 'string' && typeof value.flightId === 'string'
      ? { type: 'flightEnded', droneId: value.droneId, flightId: value.flightId }
      : null;
  }

  return null;
}
