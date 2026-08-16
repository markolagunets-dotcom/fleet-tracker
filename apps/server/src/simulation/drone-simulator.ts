import type { DroneStatus, LatLon, Mission, Telemetry } from '@fleet-tracker/shared';
import {
  ALT_MAX_M,
  ALT_MIN_M,
  ALT_PERIOD_MS,
  BATTERY_DRAIN_PER_SECOND,
  CRUISE_SPEED_MPS,
  LOW_BATTERY_THRESHOLD,
  WAYPOINT_RADIUS_M,
} from '@fleet-tracker/shared';
import { bearingDeg, destination, distanceM } from './geo';

const round = (value: number, decimals: number): number => {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
};

/**
 * Simulates a single drone flying a closed waypoint loop.
 *
 * Deliberately free of Nest, I/O and clock access: every time value arrives as a
 * parameter, which is what makes the flight model testable without fake timers.
 */
export class DroneSimulator {
  private position: LatLon;
  private status: DroneStatus = 'FLYING';
  private statusBeforePause: DroneStatus = 'FLYING';
  private battery = 100;
  private heading: number;
  private speed = 0;
  private elapsedMs = 0;
  private waypointIndex = 1;
  /** True once the drone has cleared the waypoint radius around base. */
  private hasDeparted = false;

  constructor(
    private readonly mission: Mission,
    readonly startedAt: number,
  ) {
    this.position = { ...this.waypointAt(0) };
    this.heading = bearingDeg(this.position, this.waypointAt(1));
  }

  get droneId(): string {
    return this.mission.droneId;
  }

  get currentStatus(): DroneStatus {
    return this.status;
  }

  get currentBattery(): number {
    return this.battery;
  }

  /** Index of the waypoint currently being flown to. Exposed for tests. */
  get targetIndex(): number {
    return this.waypointIndex;
  }

  pause(): void {
    if (this.status === 'FLYING' || this.status === 'RTB') {
      this.statusBeforePause = this.status;
      this.status = 'PAUSED';
    }
  }

  resume(): void {
    if (this.status === 'PAUSED') {
      this.status = this.statusBeforePause;
    }
  }

  returnToBase(): void {
    if (this.status === 'FLYING') {
      this.status = 'RTB';
    }
  }

  /** Test seam: fast-forward the battery instead of ticking for twenty minutes. */
  setBatteryForTest(value: number): void {
    this.battery = value;
  }

  tick(dtMs: number, ts: number): Telemetry {
    if (this.status === 'PAUSED' || this.status === 'LANDED') {
      this.speed = 0;
      return this.snapshot(ts);
    }

    const dtSeconds = dtMs / 1000;
    this.elapsedMs += dtMs;

    const target = this.status === 'RTB' ? this.waypointAt(0) : this.waypointAt(this.waypointIndex);
    this.heading = bearingDeg(this.position, target);
    this.speed = CRUISE_SPEED_MPS;

    const step = CRUISE_SPEED_MPS * dtSeconds;
    if (distanceM(this.position, target) <= Math.max(step, WAYPOINT_RADIUS_M)) {
      this.position = { ...target };
      this.arriveAtWaypoint();
    } else {
      this.position = destination(this.position, this.heading, step);
    }

    if (!this.hasDeparted && distanceM(this.position, this.waypointAt(0)) > WAYPOINT_RADIUS_M) {
      this.hasDeparted = true;
    }

    // Thresholds are compared with one tick of drain as tolerance, so a drone that will
    // cross the line before the next tick reacts now rather than a tick late.
    const drain = BATTERY_DRAIN_PER_SECOND * dtSeconds;
    this.battery = Math.max(0, this.battery - drain);
    if (this.battery <= drain) {
      this.land();
    } else if (this.battery <= LOW_BATTERY_THRESHOLD + drain && this.status === 'FLYING') {
      this.status = 'RTB';
    }

    return this.snapshot(ts);
  }

  snapshot(ts: number): Telemetry {
    return {
      droneId: this.mission.droneId,
      ts,
      lat: this.position.lat,
      lon: this.position.lon,
      alt: this.status === 'LANDED' ? 0 : round(this.altitude(), 1),
      battery: round(this.battery, 3),
      speed: round(this.speed, 1),
      heading: round(this.heading, 1),
      status: this.status,
    };
  }

  private arriveAtWaypoint(): void {
    if (this.status === 'RTB') {
      // A drone that has not yet left base cannot land back at it.
      if (this.hasDeparted) {
        this.land();
      }
      return;
    }
    this.waypointIndex = (this.waypointIndex + 1) % this.mission.waypoints.length;
  }

  private land(): void {
    this.status = 'LANDED';
    this.battery = 0;
    this.speed = 0;
  }

  private altitude(): number {
    const phase = (2 * Math.PI * this.elapsedMs) / ALT_PERIOD_MS;
    return ALT_MIN_M + ((ALT_MAX_M - ALT_MIN_M) / 2) * (1 - Math.cos(phase));
  }

  private waypointAt(index: number): LatLon {
    const waypoint = this.mission.waypoints[index];
    if (!waypoint) {
      throw new Error(`mission ${this.mission.droneId} has no waypoint at index ${index}`);
    }
    return waypoint;
  }
}
