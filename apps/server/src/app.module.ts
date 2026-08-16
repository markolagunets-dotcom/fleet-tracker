import { Module } from '@nestjs/common';
import { DronesController } from './drones/drones.controller';
import { FlightsController } from './flights/flights.controller';
import { FlightsRepository } from './flights/flights.repository';
import { HealthController } from './health/health.controller';
import { MissionsController } from './missions/missions.controller';
import { PrismaService } from './prisma/prisma.service';
import { FleetService } from './simulation/fleet.service';
import { TelemetryController } from './telemetry/telemetry.controller';
import { TelemetryGateway } from './telemetry/telemetry.gateway';

@Module({
  controllers: [
    HealthController,
    MissionsController,
    DronesController,
    TelemetryController,
    FlightsController,
  ],
  providers: [PrismaService, FlightsRepository, FleetService, TelemetryGateway],
})
export class AppModule {}
