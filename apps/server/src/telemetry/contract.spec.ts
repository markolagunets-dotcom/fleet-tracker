import type { ServerMessage } from '@fleet-tracker/shared';
import {
  parseServerMessage,
  PROTOCOL_MISMATCH_CODE,
  PROTOCOL_VERSION,
} from '@fleet-tracker/shared';
import { DroneSimulator } from '../simulation/drone-simulator';
import { MISSIONS } from '../missions/missions.data';

/**
 * The contract test docs/design.md promises: what the gateway puts on the wire has
 * to survive a JSON round trip and be accepted by the shared parser the client uses.
 * If either end drifts, this fails rather than the browser.
 */
describe('ServerMessage wire contract', () => {
  const mission = MISSIONS[0]!;
  const simulator = new DroneSimulator(mission, 1_700_000_000_000);

  it('accepts a tick frame produced by the simulator', () => {
    const point = simulator.tick(200, 1_700_000_000_200);
    const frame: ServerMessage = { type: 'tick', points: [point] };

    const parsed = parseServerMessage(JSON.stringify(frame));

    expect(parsed).not.toBeNull();
    expect(parsed).toEqual(frame);
  });

  it('accepts a flightEnded frame', () => {
    const frame: ServerMessage = { type: 'flightEnded', droneId: 'alpha', flightId: 'abc' };
    expect(parseServerMessage(JSON.stringify(frame))).toEqual(frame);
  });

  it.each([
    ['malformed JSON', '{not json'],
    ['unknown type', '{"type":"nope"}'],
    ['tick without points', '{"type":"tick"}'],
    ['flightEnded without flightId', '{"type":"flightEnded","droneId":"alpha"}'],
    ['a JSON primitive', '"tick"'],
  ])('rejects %s', (_label, raw) => {
    expect(parseServerMessage(raw)).toBeNull();
  });

  it('rejects a telemetry point with a renamed field', () => {
    const { heading, ...withoutHeading } = simulator.tick(200, 1_700_000_000_400);
    void heading;

    const raw = JSON.stringify({ type: 'tick', points: [withoutHeading] });
    expect(parseServerMessage(raw)).toBeNull();
  });

  it('rejects a telemetry point with an unknown status', () => {
    const point = { ...simulator.tick(200, 1_700_000_000_600), status: 'HOVERING' };
    expect(parseServerMessage(JSON.stringify({ type: 'tick', points: [point] }))).toBeNull();
  });
});

describe('protocol version', () => {
  it('is a positive integer the client can send verbatim', () => {
    expect(Number.isInteger(PROTOCOL_VERSION)).toBe(true);
    expect(PROTOCOL_VERSION).toBeGreaterThan(0);
  });

  it('uses 1008 (policy violation) for a mismatch, not a generic error code', () => {
    expect(PROTOCOL_MISMATCH_CODE).toBe(1008);
  });
});
