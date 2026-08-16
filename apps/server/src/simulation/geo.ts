import type { LatLon } from '@fleet-tracker/shared';

/** IUGG mean Earth radius, in metres. */
const EARTH_RADIUS_M = 6_371_008.8;

const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;
const toDegrees = (radians: number): number => (radians * 180) / Math.PI;

/** Great-circle distance between two points, in metres (haversine). */
export function distanceM(from: LatLon, to: LatLon): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLat = toRadians(to.lat - from.lat);
  const deltaLon = toRadians(to.lon - from.lon);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;

  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

/** Initial great-circle bearing from one point to another, in degrees clockwise from north. */
export function bearingDeg(from: LatLon, to: LatLon): number {
  const lat1 = toRadians(from.lat);
  const lat2 = toRadians(to.lat);
  const deltaLon = toRadians(to.lon - from.lon);

  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

  return (toDegrees(Math.atan2(y, x)) + 360) % 360;
}

/** The point reached by travelling `distance` metres from `from` along `bearing`. */
export function destination(from: LatLon, bearing: number, distance: number): LatLon {
  const angularDistance = distance / EARTH_RADIUS_M;
  const theta = toRadians(bearing);
  const lat1 = toRadians(from.lat);
  const lon1 = toRadians(from.lon);

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angularDistance) +
      Math.cos(lat1) * Math.sin(angularDistance) * Math.cos(theta),
  );
  const lon2 =
    lon1 +
    Math.atan2(
      Math.sin(theta) * Math.sin(angularDistance) * Math.cos(lat1),
      Math.cos(angularDistance) - Math.sin(lat1) * Math.sin(lat2),
    );

  return { lat: toDegrees(lat2), lon: ((toDegrees(lon2) + 540) % 360) - 180 };
}
