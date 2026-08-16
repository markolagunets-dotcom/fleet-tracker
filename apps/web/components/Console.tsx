'use client';

import type { Telemetry } from '@fleet-tracker/shared';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { MapHandle } from './MapView';
import { FleetList } from './FleetList';
import { FlightHistory } from './FlightHistory';
import { StatusPanel } from './StatusPanel';
import {
  useDrones,
  useFlight,
  useFlights,
  useLatestTelemetry,
  useMissions,
  useTrackHistory,
} from '@/hooks/useQueries';
import { useTelemetryStream } from '@/hooks/useTelemetryStream';

// Leaflet touches `window` at import time, so the map can never be server-rendered.
const MapView = dynamic(() => import('./MapView').then((module) => module.MapView), {
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-900" />,
});

export function Console(): React.JSX.Element {
  const [selectedDroneId, setSelectedDroneId] = useState('alpha');
  const [selectedFlightId, setSelectedFlightId] = useState<string | null>(null);
  const [follow, setFollow] = useState(true);

  const mapRef = useRef<MapHandle>(null);

  const missions = useMissions();
  const drones = useDrones();
  const history = useTrackHistory();
  const latest = useLatestTelemetry();
  const flights = useFlights();
  const flight = useFlight(selectedFlightId);

  const pushPoints = useCallback((points: Telemetry[]) => {
    mapRef.current?.pushPoints(points);
  }, []);

  const connection = useTelemetryStream(pushPoints);

  const selectFlight = useCallback((flightId: string | null) => {
    setSelectedFlightId(flightId);
    if (flightId === null) {
      mapRef.current?.showFlight(null);
    }
  }, []);

  // Draw the archived track as a side effect, never during render.
  useEffect(() => {
    if (flight.data && flight.data.id === selectedFlightId) {
      mapRef.current?.showFlight(flight.data);
    }
  }, [flight.data, selectedFlightId]);

  const selectedTelemetry = latest.data?.find((point) => point.droneId === selectedDroneId);
  const trackPoints = history.data?.[selectedDroneId]?.length ?? 0;

  return (
    <main className="flex h-dvh flex-col">
      <header className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
        <div>
          <h1 className="text-base font-semibold">FleetTracker</h1>
          <p className="text-xs text-slate-400">Simulated drone fleet · live telemetry</p>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-xs text-slate-300">
          <input
            type="checkbox"
            checked={follow}
            onChange={(event) => setFollow(event.target.checked)}
            className="accent-sky-400"
          />
          Follow selected drone
        </label>
      </header>

      <div className="flex min-h-0 flex-1">
        <div className="min-w-0 flex-1">
          <MapView
            ref={mapRef}
            missions={missions.data ?? []}
            history={history.data}
            selectedDroneId={selectedDroneId}
            follow={follow}
            onSelect={setSelectedDroneId}
          />
        </div>

        <aside className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l border-slate-800 p-3">
          {missions.isError && (
            <p className="rounded-md bg-rose-500/10 p-3 text-xs text-rose-300">
              Cannot reach the API at {process.env.NEXT_PUBLIC_API_URL ?? 'localhost:3001'}.
            </p>
          )}
          <FleetList
            drones={drones.data ?? []}
            selectedDroneId={selectedDroneId}
            onSelect={setSelectedDroneId}
          />
          <StatusPanel
            telemetry={selectedTelemetry}
            connection={connection}
            trackPoints={trackPoints}
          />
          <FlightHistory
            flights={flights.data ?? []}
            selectedFlightId={selectedFlightId}
            onSelect={selectFlight}
          />
        </aside>
      </div>
    </main>
  );
}
