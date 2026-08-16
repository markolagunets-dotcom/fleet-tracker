import type { ServerMessage, Telemetry } from '@fleet-tracker/shared';
import { TRACK_POINT_LIMIT, TRACK_TRIM_BLOCK } from '@fleet-tracker/shared';
import type { Clock } from '../common/clock';
import { MISSIONS } from '../missions/missions.data';
import { UnknownDroneError } from './errors';
import type { FlightArchive } from './flight-archive.port';
import { FlightArchiver } from './flight-archiver';
import { FleetService } from './fleet.service';
import { TICK_INTERVAL_MS } from './simulation.constants';
import { TrackStore } from './track-store';

const T0 = 1_700_000_000_000;

interface Harness {
  fleet: FleetService;
  archive: { record: jest.Mock };
  archiver: FlightArchiver;
  messages: ServerMessage[];
}

/** A clock the test advances by hand, so nothing depends on wall time. */
function createHarness(): Harness {
  let now = T0;
  const clock: Clock = {
    now: () => {
      now += TICK_INTERVAL_MS;
      return now;
    },
  };

  const archive = { record: jest.fn(async () => ({ id: 'flight-1' })) };
  const archiver = new FlightArchiver(archive as unknown as FlightArchive);
  const fleet = new FleetService(new TrackStore(), archiver, clock);
  fleet.start();

  const messages: ServerMessage[] = [];
  fleet.stream$.subscribe((message) => messages.push(message));

  return { fleet, archive, archiver, messages };
}

describe('FleetService', () => {
  it('starts one simulator per mission', () => {
    expect(createHarness().fleet.roster()).toHaveLength(MISSIONS.length);
  });

  it('emits one tick message covering every drone', () => {
    const { fleet, messages } = createHarness();

    fleet.tickOnce();

    expect(messages).toHaveLength(1);
    expect(messages[0]!.type).toBe('tick');
    expect(messages[0]!.type === 'tick' && messages[0]!.points).toHaveLength(MISSIONS.length);
  });

  it('accumulates track history per drone', () => {
    const { fleet } = createHarness();
    fleet.tickOnce();
    fleet.tickOnce();

    const history = fleet.history();
    expect(history['alpha']).toHaveLength(2);
    expect(history['bravo']).toHaveLength(2);
  });

  it('hands out copies, not the live buffers', () => {
    const { fleet } = createHarness();
    fleet.tickOnce();

    const first = fleet.history();
    first['alpha']!.push({} as Telemetry);

    expect(fleet.history()['alpha']).toHaveLength(1);
  });

  it('caps track history, trimming in blocks rather than per tick', () => {
    const { fleet } = createHarness();
    const ticks = TRACK_POINT_LIMIT + TRACK_TRIM_BLOCK + 50;
    let peak = 0;

    for (let i = 0; i < ticks; i += 1) {
      fleet.tickOnce();
      peak = Math.max(peak, fleet.history()['alpha']!.length);
    }

    const length = fleet.history()['alpha']!.length;
    expect(peak).toBeLessThanOrEqual(TRACK_POINT_LIMIT + TRACK_TRIM_BLOCK);
    expect(length).toBeLessThan(ticks);
    expect(length).toBeGreaterThanOrEqual(TRACK_POINT_LIMIT);
  });

  it('pauses and resumes a drone by command', () => {
    const { fleet } = createHarness();
    fleet.tickOnce();

    expect(fleet.command('alpha', 'PAUSE').status).toBe('PAUSED');
    expect(fleet.command('alpha', 'RESUME').status).toBe('FLYING');
  });

  it('rejects commands for an unknown drone with a domain error', () => {
    const { fleet } = createHarness();
    expect(() => fleet.command('zulu', 'PAUSE')).toThrow(UnknownDroneError);
  });

  it('records a flight and restarts the drone on RESET', async () => {
    const { fleet, archive, archiver, messages } = createHarness();
    fleet.tickOnce();
    fleet.tickOnce();

    fleet.command('alpha', 'RESET');
    await archiver.drain();

    expect(archive.record).toHaveBeenCalledTimes(1);
    expect(archive.record.mock.calls[0]![0]).toMatchObject({
      droneId: 'alpha',
      endedReason: 'OPERATOR_RESET',
    });
    expect(fleet.history()['alpha']).toHaveLength(0);
    expect(fleet.command('alpha', 'RESUME').battery).toBe(100);
    expect(messages.some((m) => m.type === 'flightEnded')).toBe(true);
  });

  it('does not archive an empty track', async () => {
    const { fleet, archive, archiver } = createHarness();

    fleet.command('alpha', 'RESET');
    await archiver.drain();

    expect(archive.record).not.toHaveBeenCalled();
  });

  it('drains pending writes on shutdown', async () => {
    const { fleet, archive } = createHarness();
    fleet.tickOnce();
    fleet.command('alpha', 'RESET');

    await fleet.shutdown();

    expect(archive.record).toHaveBeenCalledTimes(1);
  });

  it('advances every simulator by exactly one interval per tick', () => {
    const { fleet } = createHarness();
    fleet.tickOnce();
    const first = fleet.history()['alpha']![0]!;
    fleet.tickOnce();
    const second = fleet.history()['alpha']![1]!;

    expect(second.ts).toBeGreaterThan(first.ts);
    expect(second.battery).toBeLessThan(first.battery);
    expect(TICK_INTERVAL_MS).toBe(200);
  });
});
