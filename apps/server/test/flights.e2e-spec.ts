import { INestApplication } from '@nestjs/common';
import { WsAdapter } from '@nestjs/platform-ws';
import { Test } from '@nestjs/testing';
import type { Telemetry } from '@fleet-tracker/shared';
import { AppModule } from '../src/app.module';
import { FlightsRepository } from '../src/flights/flights.repository';
import { PrismaService } from '../src/prisma/prisma.service';

const point = (ts: number, lon: number): Telemetry => ({
  droneId: 'alpha',
  ts,
  lat: 50.45,
  lon,
  alt: 120,
  battery: 50,
  speed: 15,
  heading: 90,
  status: 'FLYING',
});

describe('FlightsRepository (e2e)', () => {
  let app: INestApplication;
  let repository: FlightsRepository;
  let prisma: PrismaService;

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();
    app = moduleRef.createNestApplication();
    app.useWebSocketAdapter(new WsAdapter(app));
    await app.init();
    repository = app.get(FlightsRepository);
    prisma = app.get(PrismaService);
  });

  beforeEach(async () => {
    await prisma.trackPoint.deleteMany();
    await prisma.flight.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  it('persists a flight with its track and reads it back', async () => {
    const track = [point(1_000, 30.52), point(2_000, 30.53)];
    const created = await repository.record(
      {
        droneId: 'alpha',
        startedAt: new Date(1_000),
        endedAt: new Date(2_000),
        distanceM: 710.2,
        maxAltM: 120,
        endedReason: 'BATTERY_DEPLETED',
      },
      track,
    );

    const detail = await repository.findOne(created.id);
    expect(detail).not.toBeNull();
    expect(detail!.droneId).toBe('alpha');
    expect(detail!.distanceM).toBeCloseTo(710.2, 2);
    expect(detail!.points).toHaveLength(2);
    expect(detail!.points[0]!.ts).toBe(1_000);
  });

  it('lists flights newest first with a point count', async () => {
    await repository.record(
      {
        droneId: 'alpha',
        startedAt: new Date(1_000),
        endedAt: new Date(2_000),
        distanceM: 1,
        maxAltM: 100,
        endedReason: 'BATTERY_DEPLETED',
      },
      [point(1_000, 30.52)],
    );
    await repository.record(
      {
        droneId: 'bravo',
        startedAt: new Date(3_000),
        endedAt: new Date(4_000),
        distanceM: 2,
        maxAltM: 110,
        endedReason: 'OPERATOR_RESET',
      },
      [point(3_000, 30.55), point(4_000, 30.56)],
    );

    const flights = await repository.list();
    expect(flights[0]!.droneId).toBe('bravo');
    expect(flights[0]!.pointCount).toBe(2);
    expect(flights[1]!.droneId).toBe('alpha');
  });

  it('returns null for an unknown flight id', async () => {
    expect(await repository.findOne('does-not-exist')).toBeNull();
  });
});
