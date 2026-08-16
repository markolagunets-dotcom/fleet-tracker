'use client';

import type { Telemetry } from '@fleet-tracker/shared';
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useRef, useState } from 'react';
import { PANEL_INTERVAL_MS } from '@/lib/constants';
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
import { API_URL } from '@/lib/config';

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
  const [trackPoints, setTrackPoints] = useState(0);
  const lastCountPublish = useRef(0);
  const selectedDroneIdRef = useRef(selectedDroneId);

  useEffect(() => {
    selectedDroneIdRef.current = selectedDroneId;
  }, [selectedDroneId]);

  const missions = useMissions();
  const drones = useDrones();
  const history = useTrackHistory();
  const latest = useLatestTelemetry();
  const flights = useFlights();
  const flight = useFlight(selectedFlightId);

  // The live count lives in Leaflet, not in the query cache — the REST seed freezes
  // at connect time. Sampled here rather than read during render, and throttled to
  // the same cadence as the status panel so it costs no extra re-renders.
  const pushPoints = useCallback((points: Telemetry[]) => {
    mapRef.current?.pushPoints(points);

    const now = Date.now();
    if (now - lastCountPublish.current < PANEL_INTERVAL_MS) {
      return;
    }
    lastCountPublish.current = now;
    setTrackPoints(mapRef.current?.trackLength(selectedDroneIdRef.current) ?? 0);
  }, []);

  const connection = useTelemetryStream(pushPoints);

  const disengageFollow = useCallback(() => setFollow(false), []);

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
            onFollowDisengage={disengageFollow}
          />
        </div>

        <aside className="flex w-80 shrink-0 flex-col gap-3 overflow-y-auto border-l border-slate-800 p-3">
          {missions.isError && (
            <p className="rounded-md bg-rose-500/10 p-3 text-xs text-rose-300">
              Cannot reach the API at {API_URL}.
            </p>
          )}
          <FleetList
            drones={drones.data ?? []}
            selectedDroneId={selectedDroneId}
            onSelect={setSelectedDroneId}
            isError={drones.isError}
          />
          <StatusPanel
            telemetry={selectedTelemetry}
            connection={connection}
            trackPoints={trackPoints}
            historyError={history.isError}
          />
          <FlightHistory
            flights={flights.data ?? []}
            selectedFlightId={selectedFlightId}
            onSelect={selectFlight}
            isError={flights.isError}
            trackError={flight.isError}
          />
        </aside>
      </div>
    </main>
  );
}
