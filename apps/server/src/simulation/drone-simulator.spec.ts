import type { Mission } from '@fleet-tracker/shared';
import { LOW_BATTERY_THRESHOLD, TICK_INTERVAL_MS } from '@fleet-tracker/shared';
import { DroneSimulator } from './drone-simulator';
import { distanceM } from './geo';

const START = { lat: 50.45, lon: 30.52 };

/** A long loop: the drone never reaches a waypoint during a short test. */
const LONG_MISSION: Mission = {
  droneId: 'test-long',
  name: 'Long',
  colour: '#000000',
  waypoints: [START, { lat: 50.55, lon: 30.52 }, { lat: 50.55, lon: 30.72 }],
};

/** Waypoints 20 m apart — inside WAYPOINT_RADIUS_M, so arrival happens on the first tick. */
const TIGHT_MISSION: Mission = {
  droneId: 'test-tight',
  name: 'Tight',
  colour: '#000000',
  waypoints: [
    { lat: 50.45, lon: 30.52 },
    { lat: 50.450179, lon: 30.52 },
    { lat: 50.450358, lon: 30.52 },
  ],
};

const T0 = 1_700_000_000_000;

function tickTimes(sim: DroneSimulator, count: number) {
  let point = sim.snapshot(T0);
  for (let i = 1; i <= count; i += 1) {
    point = sim.tick(TICK_INTERVAL_MS, T0 + i * TICK_INTERVAL_MS);
  }
  return point;
}

describe('DroneSimulator', () => {
  it('starts parked on the first waypoint with a full battery', () => {
    const point = new DroneSimulator(LONG_MISSION, T0).snapshot(T0);
    expect(point.lat).toBeCloseTo(START.lat, 6);
    expect(point.lon).toBeCloseTo(START.lon, 6);
    expect(point.battery).toBe(100);
    expect(point.status).toBe('FLYING');
  });

  it('moves towards the next waypoint', () => {
    const sim = new DroneSimulator(LONG_MISSION, T0);
    const before = distanceM(START, LONG_MISSION.waypoints[1]!);
    const point = tickTimes(sim, 5);
    const after = distanceM({ lat: point.lat, lon: point.lon }, LONG_MISSION.waypoints[1]!);
    expect(after).toBeLessThan(before);
  });

  it('heads due north when the next waypoint is due north', () => {
    const point = tickTimes(new DroneSimulator(LONG_MISSION, T0), 1);
    expect(point.heading).toBeCloseTo(0, 1);
  });

  it('drains the battery monotonically', () => {
    const sim = new DroneSimulator(LONG_MISSION, T0);
    let previous = 100;
    for (let i = 1; i <= 20; i += 1) {
      const point = sim.tick(TICK_INTERVAL_MS, T0 + i * TICK_INTERVAL_MS);
      expect(point.battery).toBeLessThan(previous);
      previous = point.battery;
    }
  });

  it('advances through waypoints and wraps around', () => {
    const sim = new DroneSimulator(TIGHT_MISSION, T0);
    expect(sim.targetIndex).toBe(1);
    sim.tick(TICK_INTERVAL_MS, T0 + TICK_INTERVAL_MS);
    expect(sim.targetIndex).toBe(2);
    sim.tick(TICK_INTERVAL_MS, T0 + 2 * TICK_INTERVAL_MS);
    expect(sim.targetIndex).toBe(0);
  });

  it('switches to RTB once the battery falls to the threshold', () => {
    const sim = new DroneSimulator(LONG_MISSION, T0);
    sim.setBatteryForTest(LOW_BATTERY_THRESHOLD + 0.01);
    const point = sim.tick(TICK_INTERVAL_MS, T0 + TICK_INTERVAL_MS);
    expect(point.status).toBe('RTB');
  });

  it('lands with zero speed once the battery is empty', () => {
    const sim = new DroneSimulator(LONG_MISSION, T0);
    sim.setBatteryForTest(0.01);
    const point = sim.tick(TICK_INTERVAL_MS, T0 + TICK_INTERVAL_MS);
    expect(point.status).toBe('LANDED');
    expect(point.battery).toBe(0);
    expect(point.speed).toBe(0);
    expect(point.alt).toBe(0);
  });

  it('holds position and battery while paused', () => {
    const sim = new DroneSimulator(LONG_MISSION, T0);
    const before = sim.tick(TICK_INTERVAL_MS, T0 + TICK_INTERVAL_MS);
    sim.pause();
    const after = sim.tick(TICK_INTERVAL_MS, T0 + 2 * TICK_INTERVAL_MS);
    expect(after.status).toBe('PAUSED');
    expect(after.lat).toBeCloseTo(before.lat, 9);
    expect(after.battery).toBe(before.battery);
    expect(after.speed).toBe(0);
  });

  it('resumes into the status it was paused from', () => {
    const sim = new DroneSimulator(LONG_MISSION, T0);
    sim.returnToBase();
    sim.pause();
    sim.resume();
    expect(sim.tick(TICK_INTERVAL_MS, T0 + TICK_INTERVAL_MS).status).toBe('RTB');
  });

  it('keeps altitude within the configured envelope while flying', () => {
    const sim = new DroneSimulator(LONG_MISSION, T0);
    for (let i = 1; i <= 100; i += 1) {
      const point = sim.tick(TICK_INTERVAL_MS, T0 + i * TICK_INTERVAL_MS);
      expect(point.alt).toBeGreaterThanOrEqual(80);
      expect(point.alt).toBeLessThanOrEqual(140);
    }
  });
});
