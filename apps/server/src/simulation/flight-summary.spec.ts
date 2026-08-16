import type { Telemetry } from '@fleet-tracker/shared';
import { summariseTrack } from './flight-summary';

const base: Omit<Telemetry, 'lat' | 'lon' | 'alt' | 'ts'> = {
  droneId: 'alpha',
  battery: 90,
  speed: 15,
  heading: 0,
  status: 'FLYING',
};

const track: Telemetry[] = [
  { ...base, ts: 1_000, lat: 0, lon: 0, alt: 100 },
  { ...base, ts: 2_000, lat: 0, lon: 0.001, alt: 130 },
  { ...base, ts: 3_000, lat: 0, lon: 0.002, alt: 110 },
];

describe('summariseTrack', () => {
  it('sums the distance between consecutive points', () => {
    const summary = summariseTrack('alpha', track, 'BATTERY_DEPLETED');
    expect(summary.distanceM).toBeCloseTo(222.39, 1);
  });

  it('reports the highest altitude reached', () => {
    expect(summariseTrack('alpha', track, 'BATTERY_DEPLETED').maxAltM).toBe(130);
  });

  it('takes start and end timestamps from the track ends', () => {
    const summary = summariseTrack('alpha', track, 'BATTERY_DEPLETED');
    expect(summary.startedAt.getTime()).toBe(1_000);
    expect(summary.endedAt.getTime()).toBe(3_000);
  });

  it('carries the end reason through', () => {
    expect(summariseTrack('alpha', track, 'OPERATOR_RESET').endedReason).toBe('OPERATOR_RESET');
  });

  it('returns a zeroed summary for an empty track', () => {
    const summary = summariseTrack('alpha', [], 'OPERATOR_RESET');
    expect(summary.distanceM).toBe(0);
    expect(summary.maxAltM).toBe(0);
  });
});
