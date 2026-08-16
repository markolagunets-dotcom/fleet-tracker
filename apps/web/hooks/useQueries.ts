'use client';

import type { DroneCommand } from '@fleet-tracker/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  fetchDrones,
  fetchFlight,
  fetchFlights,
  fetchHistory,
  fetchLatest,
  fetchMissions,
  sendCommand,
} from '@/lib/api';

export const queryKeys = {
  missions: ['missions'] as const,
  drones: ['drones'] as const,
  history: ['telemetry', 'history'] as const,
  latest: ['telemetry', 'latest'] as const,
  flights: ['flights'] as const,
  flight: (id: string) => ['flights', id] as const,
};

/** Missions never change while the server is up, so they are cached indefinitely. */
export const useMissions = () =>
  useQuery({ queryKey: queryKeys.missions, queryFn: fetchMissions, staleTime: Infinity });

export const useDrones = () =>
  useQuery({ queryKey: queryKeys.drones, queryFn: fetchDrones, refetchInterval: 5_000 });

/** Seeds the map once; live points arrive over the socket, not through this query. */
export const useTrackHistory = () =>
  useQuery({ queryKey: queryKeys.history, queryFn: fetchHistory, staleTime: Infinity });

/**
 * Fetched once for the initial paint, then kept current by `setQueryData` from the
 * socket at PANEL_HZ. This is the only telemetry that flows through React Query.
 */
export const useLatestTelemetry = () =>
  useQuery({ queryKey: queryKeys.latest, queryFn: fetchLatest, staleTime: Infinity });

export const useFlights = () => useQuery({ queryKey: queryKeys.flights, queryFn: fetchFlights });

export const useFlight = (id: string | null) =>
  useQuery({
    queryKey: queryKeys.flight(id ?? ''),
    queryFn: () => fetchFlight(id as string),
    enabled: id !== null,
  });

export function useDroneCommand() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ droneId, command }: { droneId: string; command: DroneCommand }) =>
      sendCommand(droneId, command),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: queryKeys.drones });
      await queryClient.invalidateQueries({ queryKey: queryKeys.flights });
    },
  });
}
