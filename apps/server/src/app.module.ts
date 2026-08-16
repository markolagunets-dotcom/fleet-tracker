import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { LoggingModule } from './common/logging.module';
import { validateEnv } from './config/env.config';
import { DronesModule } from './drones/drones.module';
import { FlightsModule } from './flights/flights.module';
import { HealthModule } from './health/health.module';
import { MissionsModule } from './missions/missions.module';
import { PrismaModule } from './prisma/prisma.module';
import { SimulationModule } from './simulation/simulation.module';
import { TelemetryModule } from './telemetry/telemetry.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true, cache: true, validate: validateEnv }),
    LoggingModule,
    PrismaModule,
    FlightsModule,
    SimulationModule,
    TelemetryModule,
    DronesModule,
    MissionsModule,
    HealthModule,
  ],
})
export class AppModule {}
