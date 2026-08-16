import { Injectable } from '@nestjs/common';
import type {
  FlightDetailDto,
  FlightEndReason,
  FlightSummaryDto,
  Telemetry,
} from '@fleet-tracker/shared';
import type { FlightSummaryInput } from '../simulation/flight-summary';
import { PrismaService } from '../prisma/prisma.service';

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

  async list(): Promise<FlightSummaryDto[]> {
    const flights = await this.prisma.flight.findMany({
      orderBy: { endedAt: 'desc' },
      include: { _count: { select: { points: true } } },
    });

    return flights.map((flight) => ({
      id: flight.id,
      droneId: flight.droneId,
      startedAt: flight.startedAt.toISOString(),
      endedAt: flight.endedAt.toISOString(),
      distanceM: flight.distanceM,
      maxAltM: flight.maxAltM,
      endedReason: flight.endedReason as FlightEndReason,
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
      endedReason: flight.endedReason as FlightEndReason,
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
