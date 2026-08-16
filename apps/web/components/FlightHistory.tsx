'use client';

import type { FlightSummaryDto } from '@fleet-tracker/shared';

export function FlightHistory({
  flights,
  selectedFlightId,
  onSelect,
}: {
  flights: FlightSummaryDto[];
  selectedFlightId: string | null;
  onSelect(flightId: string | null): void;
}): React.JSX.Element {
  return (
    <section className="flex min-h-0 flex-1 flex-col rounded-lg border border-slate-800 bg-slate-900/60 p-4">
      <header className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-200">Flight log</h2>
        {selectedFlightId && (
          <button
            type="button"
            onClick={() => onSelect(null)}
            className="text-[11px] text-slate-400 hover:text-slate-200"
          >
            clear
          </button>
        )}
      </header>

      {flights.length === 0 ? (
        <p className="text-sm text-slate-400">
          No completed flights yet — one is recorded when a drone lands or is reset.
        </p>
      ) : (
        <ul className="min-h-0 flex-1 space-y-1 overflow-y-auto">
          {flights.map((flight) => (
            <li key={flight.id}>
              <button
                type="button"
                onClick={() => onSelect(flight.id === selectedFlightId ? null : flight.id)}
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
    </section>
  );
}
