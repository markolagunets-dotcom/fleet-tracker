/**
 * Only constants both ends must agree on live here.
 *
 * Simulation internals (speed, battery drain, altitude envelope) belong to the
 * server, and client pacing (panel throttle, reconnect backoff) belongs to the web
 * app. Shipping either through the contract package would put them in the browser
 * bundle and invite a second source of truth.
 */

/** Points a track is trimmed back to once it exceeds the ceiling below. */
export const TRACK_POINT_LIMIT = 2000;

/**
 * Slack allowed above TRACK_POINT_LIMIT before a track is trimmed.
 *
 * Dropping one point per tick reallocates a 2000-entry array five times a second
 * per drone; trimming in blocks amortises that to once every TRACK_TRIM_BLOCK ticks.
 */
export const TRACK_TRIM_BLOCK = 200;
