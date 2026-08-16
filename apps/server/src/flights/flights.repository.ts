import { Injectable } from '@nestjs/common';
import type {
  FlightDetailDto,
  FlightEndReason,
  FlightSummaryDto,
  Telemetry,
} from '@fleet-tracker/shared';
import type { FlightSummaryInput } from '../simulation/flight-summary';
import { PrismaService } from '../prisma/prisma.service';

export const FLIGHTS_PAGE_SIZE = 50;

const END_REASONS: readonly FlightEndReason[] = ['BATTERY_DEPLETED', 'OPERATOR_RESET'];

/**
 * SQLite has no enums, so the column is a string. Validating on read beats casting:
 * a row written by an older version or by hand surfaces here instead of reaching the
 * client as a value its union says is impossible.
 */
function toEndReason(value: string, flightId: string): FlightEndReason {
  if (!(END_REASONS as readonly string[]).includes(value)) {
    throw new Error(`flight ${flightId} has an unknown endedReason: ${value}`);
  }
  return value as FlightEndReason;
}

@Injectable()
export class FlightsRepository {
  constructor(private readonly prisma: PrismaService) {}

  /** Writes the whole track in one statement — never one row per tick. */
  async record(summary: FlightSummaryInput, track: Telemetry[]): Promise<{ id: string }> {
    return this.prisma.flight.create({
      select: { id: true },
      data: {
        droneId: summary.droneId,
        startedAt: summary.startedAt,
        endedAt: summary.endedAt,
        distanceM: summary.distanceM,
        maxAltM: summary.maxAltM,
        endedReason: summary.endedReason,
        points: {
          createMany: {
            data: track.map((point) => ({
              ts: new Date(point.ts),
              lat: point.lat,
              lon: point.lon,
              alt: point.alt,
              battery: point.battery,
            })),
          },
        },
      },
    });
  }

  /** Capped: the log grows for as long as the simulation runs. */
  async list(limit = FLIGHTS_PAGE_SIZE): Promise<FlightSummaryDto[]> {
    const flights = await this.prisma.flight.findMany({
      orderBy: { endedAt: 'desc' },
      take: Math.min(Math.max(limit, 1), FLIGHTS_PAGE_SIZE),
      include: { _count: { select: { points: true } } },
    });

    return flights.map((flight) => ({
      id: flight.id,
      droneId: flight.droneId,
      startedAt: flight.startedAt.toISOString(),
      endedAt: flight.endedAt.toISOString(),
      distanceM: flight.distanceM,
      maxAltM: flight.maxAltM,
      endedReason: toEndReason(flight.endedReason, flight.id),
      pointCount: flight._count.points,
    }));
  }

  async findOne(id: string): Promise<FlightDetailDto | null> {
    const flight = await this.prisma.flight.findUnique({
      where: { id },
      include: { points: { orderBy: { ts: 'asc' } } },
    });

    if (!flight) {
      return null;
    }

    return {
      id: flight.id,
      droneId: flight.droneId,
      startedAt: flight.startedAt.toISOString(),
      endedAt: flight.endedAt.toISOString(),
      distanceM: flight.distanceM,
      maxAltM: flight.maxAltM,
      endedReason: toEndReason(flight.endedReason, flight.id),
      pointCount: flight.points.length,
      points: flight.points.map((point) => ({
        ts: point.ts.getTime(),
        lat: point.lat,
        lon: point.lon,
        alt: point.alt,
        battery: point.battery,
      })),
    };
  }
}
