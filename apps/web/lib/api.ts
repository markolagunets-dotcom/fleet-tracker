import type {
  DroneCommand,
  DroneSummary,
  FlightDetailDto,
  FlightSummaryDto,
  Mission,
  Telemetry,
  TrackHistory,
} from '@fleet-tracker/shared';
import { API_URL } from './config';

async function get<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`GET ${path} failed with ${response.status}`);
  }
  return (await response.json()) as T;
}

export const fetchMissions = (): Promise<Mission[]> => get<Mission[]>('/missions');
export const fetchDrones = (): Promise<DroneSummary[]> => get<DroneSummary[]>('/drones');
export const fetchHistory = (): Promise<TrackHistory> => get<TrackHistory>('/telemetry/history');
export const fetchLatest = (): Promise<Telemetry[]> => get<Telemetry[]>('/telemetry/latest');
export const fetchFlights = (): Promise<FlightSummaryDto[]> => get<FlightSummaryDto[]>('/flights');
export const fetchFlight = (id: string): Promise<FlightDetailDto> =>
  get<FlightDetailDto>(`/flights/${id}`);

export async function sendCommand(droneId: string, command: DroneCommand): Promise<DroneSummary> {
  const response = await fetch(`${API_URL}/drones/${droneId}/command`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ command }),
  });
  if (!response.ok) {
    throw new Error(`command ${command} failed with ${response.status}`);
  }
  return (await response.json()) as DroneSummary;
}
