import { Injectable } from '@nestjs/common';
import type { Telemetry, TrackHistory } from '@fleet-tracker/shared';
import { TRACK_POINT_LIMIT, TRACK_TRIM_BLOCK } from '@fleet-tracker/shared';

/**
 * The in-memory track buffer, one bounded array per drone.
 *
 * Split out of FleetService so the buffering policy — the cap and the amortised
 * trim — lives in one place with its own tests, and so callers cannot reach the
 * underlying arrays.
 */
@Injectable()
export class TrackStore {
  private readonly tracks = new Map<string, Telemetry[]>();

  reset(droneId: string): void {
    this.tracks.set(droneId, []);
  }

  append(droneId: string, point: Telemetry): void {
    const track = this.tracks.get(droneId);
    if (!track) {
      return;
    }

    track.push(point);

    // Trim in blocks: dropping a single point from a 2000-entry array reallocates
    // the whole thing, and at 5 Hz across the fleet that is the dominant cost.
    if (track.length > TRACK_POINT_LIMIT + TRACK_TRIM_BLOCK) {
      track.splice(0, track.length - TRACK_POINT_LIMIT);
    }
  }

  /** A copy — callers must not be able to mutate the buffer. */
  snapshot(droneId: string): Telemetry[] {
    return [...(this.tracks.get(droneId) ?? [])];
  }

  /** Copies of every track, keyed by drone. */
  all(): TrackHistory {
    return Object.fromEntries([...this.tracks].map(([droneId, track]) => [droneId, [...track]]));
  }

  /** Hands the finished track to the caller and starts a fresh one. */
  take(droneId: string): Telemetry[] {
    const track = this.snapshot(droneId);
    this.reset(droneId);
    return track;
  }

  size(droneId: string): number {
    return this.tracks.get(droneId)?.length ?? 0;
  }
}
