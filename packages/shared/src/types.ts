export type DroneStatus = 'FLYING' | 'RTB' | 'LANDED' | 'PAUSED';

export type DroneCommand = 'PAUSE' | 'RESUME' | 'RTB' | 'RESET';

export type FlightEndReason = 'BATTERY_DEPLETED' | 'OPERATOR_RESET';

export interface LatLon {
  lat: number;
  lon: number;
}

export interface Telemetry {
  droneId: string;
  ts: number;
  lat: number;
  lon: number;
  alt: number;
  battery: number;
  speed: number;
  heading: number;
  status: DroneStatus;
}

export interface Mission {
  droneId: string;
  name: string;
  colour: string;
  waypoints: LatLon[];
}

export interface DroneSummary {
  droneId: string;
  name: string;
  colour: string;
  status: DroneStatus;
  battery: number;
}

export interface TrackPointDto {
  ts: number;
  lat: number;
  lon: number;
  alt: number;
  battery: number;
}

export interface FlightSummaryDto {
  id: string;
  droneId: string;
  startedAt: string;
  endedAt: string;
  distanceM: number;
  maxAltM: number;
  endedReason: FlightEndReason;
  pointCount: number;
}

export interface FlightDetailDto extends FlightSummaryDto {
  points: TrackPointDto[];
}

export type TrackHistory = Record<string, Telemetry[]>;

export type ServerMessage =
  | { type: 'tick'; points: Telemetry[] }
  | { type: 'flightEnded'; droneId: string; flightId: string };
