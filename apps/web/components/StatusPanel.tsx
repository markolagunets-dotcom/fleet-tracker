'use client';

import type { Telemetry } from '@fleet-tracker/shared';
import type { ConnectionState } from '@/hooks/useTelemetryStream';
import { Panel } from './Panel';

const CONNECTION_LABEL: Record<ConnectionState, { text: string; className: string }> = {
  connecting: { text: 'connecting', className: 'bg-amber-500/20 text-amber-300' },
  connected: { text: 'connected', className: 'bg-emerald-500/20 text-emerald-300' },
  reconnecting: { text: 'reconnecting', className: 'bg-amber-500/20 text-amber-300' },
  offline: { text: 'offline', className: 'bg-rose-500/20 text-rose-300' },
  outdated: { text: 'outdated', className: 'bg-violet-500/20 text-violet-300' },
};

function Metric({ label, value }: { label: string; value: string }): React.JSX.Element {
  return (
    <div className="rounded-md bg-slate-800/60 px-3 py-2">
      <div className="text-[11px] uppercase tracking-wide text-slate-400">{label}</div>
      <div className="font-mono text-lg text-slate-100">{value}</div>
    </div>
  );
}

export function StatusPanel({
  telemetry,
  connection,
  trackPoints,
  historyError = false,
}: {
  telemetry: Telemetry | undefined;
  connection: ConnectionState;
  trackPoints: number;
  /** The seeded track history failed to load, so the point count is not real. */
  historyError?: boolean;
}): React.JSX.Element {
  const badge = CONNECTION_LABEL[connection];

  return (
    <Panel
      title="Status"
      header={
        // Announced on change: the socket state is the one thing an operator must
        // not have to be looking at the badge to notice.
        <span
          aria-live="polite"
          className={`rounded-full px-2 py-0.5 text-[11px] ${badge.className}`}
        >
          <span className="sr-only">Telemetry link </span>
          {badge.text}
        </span>
      }
    >
      {historyError && (
        <p className="mb-2 rounded-md bg-rose-500/10 p-2 text-xs text-rose-300">
          Track history unavailable — the map shows live points only.
        </p>
      )}

      {telemetry ? (
        <div className="grid grid-cols-2 gap-2">
          <Metric label="Altitude" value={`${telemetry.alt.toFixed(1)} m`} />
          <Metric label="Battery" value={`${telemetry.battery.toFixed(1)} %`} />
          <Metric label="Speed" value={`${telemetry.speed.toFixed(1)} m/s`} />
          <Metric label="Heading" value={`${telemetry.heading.toFixed(0)}°`} />
          <Metric label="State" value={telemetry.status} />
          <Metric label="Track" value={historyError ? '—' : `${trackPoints} pts`} />
        </div>
      ) : (
        <p className="text-sm text-slate-400">Waiting for the first frame…</p>
      )}
    </Panel>
  );
}
