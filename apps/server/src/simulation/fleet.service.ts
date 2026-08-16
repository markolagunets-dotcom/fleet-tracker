import { Injectable } from '@nestjs/common';
import type {
  DroneCommand,
  DroneSummary,
  FlightEndReason,
  ServerMessage,
  Telemetry,
  TrackHistory,
} from '@fleet-tracker/shared';
import { Observable, Subject } from 'rxjs';
import { Clock } from '../common/clock';
import { MISSIONS, findMission } from '../missions/missions.data';
import { DroneSimulator } from './drone-simulator';
import { UnknownDroneError } from './errors';
import { FlightArchiver } from './flight-archiver';
import { TICK_INTERVAL_MS } from './simulation.constants';
import { TrackStore } from './track-store';

/**
 * Coordinates the fleet: owns the simulators, applies operator commands, and turns
 * each simulation step into an outbound message.
 *
 * Buffering lives in TrackStore, persistence in FlightArchiver, and the interval in
 * TelemetryScheduler — this class only decides what happens, not when or where it
 * is stored.
 */
@Injectable()
export class FleetService {
  private readonly messages = new Subject<ServerMessage>();
  private readonly simulators = new Map<string, DroneSimulator>();

  readonly stream$: Observable<ServerMessage> = this.messages.asObservable();

  constructor(
    private readonly tracks: TrackStore,
    private readonly archiver: FlightArchiver,
    private readonly clock: Clock,
  ) {}

  /** Called by the scheduler; spawns the fleet on first use. */
  start(): void {
    if (this.simulators.size === 0) {
      for (const mission of MISSIONS) {
        this.spawn(mission.droneId);
      }
    }
  }

  /** One simulation step for the whole fleet. Public so tests can drive it. */
  tickOnce(): void {
    const ts = this.clock.now();
    const points: Telemetry[] = [];

    for (const [droneId, simulator] of this.simulators) {
      const point = simulator.tick(TICK_INTERVAL_MS, ts);
      points.push(point);
      this.tracks.append(droneId, point);

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
    return this.tracks.all();
  }

  latest(): Telemetry[] {
    const ts = this.clock.now();
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

  /** Closes the stream and lets pending writes finish. */
  async shutdown(): Promise<void> {
    await this.archiver.drain();
    this.messages.complete();
  }

  /**
   * Archives the current track and puts a fresh drone in the air immediately, so the
   * fleet keeps flying while the write completes off the tick loop.
   */
  private endFlight(droneId: string, reason: FlightEndReason): void {
    const track = this.tracks.take(droneId);
    this.spawn(droneId);

    void this.archiver.archiveFlight(droneId, track, reason).then((archived) => {
      if (archived) {
        this.messages.next({ type: 'flightEnded', ...archived });
      }
    });
  }

  private spawn(droneId: string): void {
    const mission = findMission(droneId);
    if (!mission) {
      throw new UnknownDroneError(droneId);
    }
    this.simulators.set(droneId, new DroneSimulator(mission, this.clock.now()));
    this.tracks.reset(droneId);
  }

  private require(droneId: string): DroneSimulator {
    const simulator = this.simulators.get(droneId);
    if (!simulator) {
      throw new UnknownDroneError(droneId);
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
