/** Client pacing. Server-side cadence is the server's business. */

/** How often the status panel is allowed to re-render, in Hz. */
export const PANEL_HZ = 2;
export const PANEL_INTERVAL_MS = 1000 / PANEL_HZ;

export const WS_RECONNECT_MIN_MS = 1_000;
export const WS_RECONNECT_MAX_MS = 10_000;
