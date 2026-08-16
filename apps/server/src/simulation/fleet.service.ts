import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import type {
  DroneCommand,
  DroneSummary,
  FlightEndReason,
  ServerMessage,
  Telemetry,
  TrackHistory,
} from '@fleet-tracker/shared';
import { MISSIONS, TICK_INTERVAL_MS, TRACK_POINT_LIMIT, findMission } from '@fleet-tracker/shared';
import { Observable, Subject } from 'rxjs';
import { FlightsRepository } from '../flights/flights.repository';
import { DroneSimulator } from './drone-simulator';
import { summariseTrack } from './flight-summary';

@Injectable()
export class FleetService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(FleetService.name);
  private readonly messages = new Subject<ServerMessage>();
  private readonly simulators = new Map<string, DroneSimulator>();
  private readonly tracks = new Map<string, Telemetry[]>();
  private timer?: NodeJS.Timeout;

  readonly stream$: Observable<ServerMessage> = this.messages.asObservable();

  constructor(private readonly flights: FlightsRepository) {
    for (const mission of MISSIONS) {
      this.spawn(mission.droneId);
    }
  }

  onModuleInit(): void {
    this.timer = setInterval(() => this.tickOnce(), TICK_INTERVAL_MS);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
    }
    this.messages.complete();
  }

  /** One simulation step for the whole fleet. Public so tests can drive it without timers. */
  tickOnce(): void {
    const ts = Date.now();
    const points: Telemetry[] = [];

    for (const [droneId, simulator] of this.simulators) {
      const point = simulator.tick(TICK_INTERVAL_MS, ts);
      points.push(point);
      this.appendToTrack(droneId, point);

      if (point.status === 'LANDED') {
        this.endFlight(droneId, 'BATTERY_DEPLETED');
      }
    }

    this.messages.next({ type: 'tick', points });
  }

  roster(): DroneSummary[] {
    return [...this.simulators.keys()].map((droneId) => this.summaryOf(droneId));
  }

  history(): TrackHistory {
    return Object.fromEntries(this.tracks);
  }

  latest(): Telemetry[] {
    const ts = Date.now();
    return [...this.simulators.values()].map((simulator) => simulator.snapshot(ts));
  }

  command(droneId: string, command: DroneCommand): DroneSummary {
    const simulator = this.require(droneId);

    switch (command) {
      case 'PAUSE':
        simulator.pause();
        break;
      case 'RESUME':
        simulator.resume();
        break;
      case 'RTB':
        simulator.returnToBase();
        break;
      case 'RESET':
        this.endFlight(droneId, 'OPERATOR_RESET');
        break;
    }

    return this.summaryOf(droneId);
  }

  /**
   * Archives the current track and puts a fresh drone in the air immediately, so the
   * fleet keeps flying while the write completes off the tick loop.
   */
  private endFlight(droneId: string, reason: FlightEndReason): void {
    const track = this.tracks.get(droneId) ?? [];
    const summary = summariseTrack(droneId, track, reason);

    this.spawn(droneId);

    if (track.length === 0) {
      return;
    }

    this.flights
      .record(summary, track)
      .then(({ id }) => this.messages.next({ type: 'flightEnded', droneId, flightId: id }))
      .catch((error: unknown) =>
        this.logger.error(`failed to persist flight for ${droneId}`, error),
      );
  }

  private spawn(droneId: string): void {
    const mission = findMission(droneId);
    if (!mission) {
      throw new NotFoundException(`unknown drone: ${droneId}`);
    }
    this.simulators.set(droneId, new DroneSimulator(mission, Date.now()));
    this.tracks.set(droneId, []);
  }

  private appendToTrack(droneId: string, point: Telemetry): void {
    const track = this.tracks.get(droneId);
    if (!track) {
      return;
    }
    track.push(point);
    if (track.length > TRACK_POINT_LIMIT) {
      track.splice(0, track.length - TRACK_POINT_LIMIT);
    }
  }

  private require(droneId: string): DroneSimulator {
    const simulator = this.simulators.get(droneId);
    if (!simulator) {
      throw new NotFoundException(`unknown drone: ${droneId}`);
    }
    return simulator;
  }

  private summaryOf(droneId: string): DroneSummary {
    const simulator = this.require(droneId);
    const mission = findMission(droneId);
    return {
      droneId,
      name: mission?.name ?? droneId,
      colour: mission?.colour ?? '#94a3b8',
      status: simulator.currentStatus,
      battery: Math.round(simulator.currentBattery * 10) / 10,
    };
  }
}
