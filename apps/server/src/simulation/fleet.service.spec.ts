import { MISSIONS, TICK_INTERVAL_MS } from '@fleet-tracker/shared';
import type { ServerMessage, Telemetry } from '@fleet-tracker/shared';
import type { FlightSummaryInput } from './flight-summary';
import { FleetService } from './fleet.service';

const repository = {
  record: jest.fn<Promise<{ id: string }>, [FlightSummaryInput, Telemetry[]]>(async () => ({
    id: 'flight-1',
  })),
};

function createFleet(): FleetService {
  return new FleetService(repository as never);
}

describe('FleetService', () => {
  beforeEach(() => {
    repository.record.mockClear();
  });

  it('starts one simulator per mission', () => {
    expect(createFleet().roster()).toHaveLength(MISSIONS.length);
  });

  it('emits one tick message covering every drone', () => {
    const fleet = createFleet();
    const messages: ServerMessage[] = [];
    fleet.stream$.subscribe((message) => messages.push(message));

    fleet.tickOnce();

    expect(messages).toHaveLength(1);
    expect(messages[0]!.type).toBe('tick');
    expect(messages[0]!.type === 'tick' && messages[0]!.points).toHaveLength(MISSIONS.length);
  });

  it('accumulates track history per drone', () => {
    const fleet = createFleet();
    fleet.tickOnce();
    fleet.tickOnce();

    const history = fleet.history();
    expect(history['alpha']).toHaveLength(2);
    expect(history['bravo']).toHaveLength(2);
  });

  it('caps track history at the configured limit', () => {
    const fleet = createFleet();
    for (let i = 0; i < 2_050; i += 1) {
      fleet.tickOnce();
    }
    expect(fleet.history()['alpha']!.length).toBeLessThanOrEqual(2_000);
  });

  it('pauses and resumes a drone by command', () => {
    const fleet = createFleet();
    fleet.tickOnce();
    expect(fleet.command('alpha', 'PAUSE').status).toBe('PAUSED');
    expect(fleet.command('alpha', 'RESUME').status).toBe('FLYING');
  });

  it('rejects commands for an unknown drone', () => {
    expect(() => createFleet().command('zulu', 'PAUSE')).toThrow('zulu');
  });

  it('records a flight and restarts the drone on RESET', async () => {
    const fleet = createFleet();
    fleet.tickOnce();
    fleet.tickOnce();

    fleet.command('alpha', 'RESET');
    await Promise.resolve();

    expect(repository.record).toHaveBeenCalledTimes(1);
    expect(repository.record.mock.calls[0]![0]).toMatchObject({
      droneId: 'alpha',
      endedReason: 'OPERATOR_RESET',
    });
    expect(fleet.history()['alpha']).toHaveLength(0);
    expect(fleet.command('alpha', 'RESUME').battery).toBe(100);
  });

  it('advances every simulator by exactly one interval per tick', () => {
    const fleet = createFleet();
    fleet.tickOnce();
    const first = fleet.history()['alpha']![0]!;
    fleet.tickOnce();
    const second = fleet.history()['alpha']![1]!;
    expect(second.ts - first.ts).toBeGreaterThanOrEqual(0);
    expect(second.battery).toBeLessThan(first.battery);
    expect(TICK_INTERVAL_MS).toBe(200);
  });
});
