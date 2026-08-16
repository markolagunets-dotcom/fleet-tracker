import { bearingDeg, destination, distanceM } from './geo';

const ORIGIN = { lat: 0, lon: 0 };
const ONE_DEGREE_M = 111_194.93;

describe('distanceM', () => {
  it('is zero for identical points', () => {
    expect(distanceM(ORIGIN, ORIGIN)).toBeCloseTo(0, 6);
  });

  it('measures one degree of longitude at the equator', () => {
    expect(distanceM(ORIGIN, { lat: 0, lon: 1 })).toBeCloseTo(ONE_DEGREE_M, 0);
  });

  it('is symmetric', () => {
    const a = { lat: 50.45, lon: 30.52 };
    const b = { lat: 50.47, lon: 30.55 };
    expect(distanceM(a, b)).toBeCloseTo(distanceM(b, a), 6);
  });
});

describe('bearingDeg', () => {
  it('returns 0 due north', () => {
    expect(bearingDeg(ORIGIN, { lat: 1, lon: 0 })).toBeCloseTo(0, 3);
  });

  it('returns 90 due east', () => {
    expect(bearingDeg(ORIGIN, { lat: 0, lon: 1 })).toBeCloseTo(90, 3);
  });

  it('returns 180 due south', () => {
    expect(bearingDeg(ORIGIN, { lat: -1, lon: 0 })).toBeCloseTo(180, 3);
  });

  it('normalises west to 270 rather than -90', () => {
    expect(bearingDeg(ORIGIN, { lat: 0, lon: -1 })).toBeCloseTo(270, 3);
  });
});

describe('destination', () => {
  it('walks one degree east from the origin', () => {
    const result = destination(ORIGIN, 90, ONE_DEGREE_M);
    expect(result.lat).toBeCloseTo(0, 6);
    expect(result.lon).toBeCloseTo(1, 4);
  });

  it('round-trips with distanceM', () => {
    const start = { lat: 50.45, lon: 30.52 };
    const moved = destination(start, 42, 1000);
    expect(distanceM(start, moved)).toBeCloseTo(1000, 3);
  });

  it('round-trips with bearingDeg', () => {
    const start = { lat: 50.45, lon: 30.52 };
    const moved = destination(start, 42, 1000);
    expect(bearingDeg(start, moved)).toBeCloseTo(42, 3);
  });
});
