import { Module } from '@nestjs/common';
import { SimulationModule } from '../simulation/simulation.module';
import { TelemetryController } from './telemetry.controller';
import { TelemetryGateway } from './telemetry.gateway';

@Module({
  imports: [SimulationModule],
  controllers: [TelemetryController],
  providers: [TelemetryGateway],
})
export class TelemetryModule {}
