export const TICK_HZ = 5;
export const TICK_INTERVAL_MS = 1000 / TICK_HZ;

export const PANEL_HZ = 2;
export const PANEL_INTERVAL_MS = 1000 / PANEL_HZ;

export const TRACK_POINT_LIMIT = 2000;

/**
 * Slack allowed above TRACK_POINT_LIMIT before a track is trimmed back.
 *
 * Dropping one point per tick reallocates a 2000-entry array five times a second
 * per drone; trimming in blocks amortises that to once every TRACK_TRIM_BLOCK ticks.
 */
export const TRACK_TRIM_BLOCK = 200;

export const CRUISE_SPEED_MPS = 15;
export const WAYPOINT_RADIUS_M = 40;
export const LOW_BATTERY_THRESHOLD = 15;
export const BATTERY_DRAIN_PER_SECOND = 1 / 30;

export const ALT_MIN_M = 80;
export const ALT_MAX_M = 140;
export const ALT_PERIOD_MS = 60_000;

export const WS_RECONNECT_MIN_MS = 1_000;
export const WS_RECONNECT_MAX_MS = 10_000;
