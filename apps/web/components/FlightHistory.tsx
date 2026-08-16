'use client';

import type { FlightSummaryDto } from '@fleet-tracker/shared';
import { Panel } from './Panel';

export function FlightHistory({
  flights,
  selectedFlightId,
  onSelect,
  isError = false,
  trackError = false,
}: {
  flights: FlightSummaryDto[];
  selectedFlightId: string | null;
  onSelect(flightId: string | null): void;
  /** The flight list query failed — do not render "no flights yet" instead. */
  isError?: boolean;
  /** The selected flight's full track failed to load, so nothing was drawn. */
  trackError?: boolean;
}): React.JSX.Element {
  return (
    <Panel
      title="Flight log"
      header={
        <div className="flex items-center gap-2">
          {selectedFlightId && (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="text-[11px] text-slate-400 hover:text-slate-200"
            >
              clear
            </button>
          )}
          <span className="rounded-full bg-slate-800 px-2 py-0.5 font-mono text-[11px] text-slate-400">
            {isError ? '—' : flights.length}
          </span>
        </div>
      }
    >
      {trackError && (
        <p className="mb-2 rounded-md bg-rose-500/10 p-2 text-xs text-rose-300">
          The selected flight&apos;s track could not be loaded.
        </p>
      )}

      {isError ? (
        <p className="rounded-md bg-rose-500/10 p-2 text-xs text-rose-300">
          Flight log unavailable — the completed flights could not be loaded.
        </p>
      ) : flights.length === 0 ? (
        <p className="text-sm text-slate-400">
          No completed flights yet — one is recorded when a drone lands or is reset.
        </p>
      ) : (
        // A fixed cap rather than flex-1: this panel sits inside a scrolling column,
        // where flex-1 has no definite height and collapses the list to a sliver.
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {flights.map((flight) => (
            <li key={flight.id}>
              <button
                type="button"
                onClick={() => onSelect(flight.id === selectedFlightId ? null : flight.id)}
                aria-pressed={flight.id === selectedFlightId}
                className={`w-full rounded-md px-2 py-1.5 text-left text-xs ${
                  flight.id === selectedFlightId
                    ? 'bg-slate-700/70 text-slate-100'
                    : 'text-slate-300 hover:bg-slate-800/70'
                }`}
              >
                <div className="flex justify-between">
                  <span>{flight.droneId}</span>
                  <span className="font-mono text-slate-400">
                    {(flight.distanceM / 1000).toFixed(2)} km
                  </span>
                </div>
                <div className="text-[11px] text-slate-500">
                  {new Date(flight.endedAt).toLocaleTimeString()} · {flight.endedReason}
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
}
