/** The flight model. Server-only: none of this crosses the wire. */

export const TICK_HZ = 5;
export const TICK_INTERVAL_MS = 1000 / TICK_HZ;

export const CRUISE_SPEED_MPS = 15;
export const WAYPOINT_RADIUS_M = 40;
export const LOW_BATTERY_THRESHOLD = 15;
export const BATTERY_DRAIN_PER_SECOND = 1 / 30;

export const ALT_MIN_M = 80;
export const ALT_MAX_M = 140;
export const ALT_PERIOD_MS = 60_000;
