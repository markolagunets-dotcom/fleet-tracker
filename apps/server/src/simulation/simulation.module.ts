import { Module } from '@nestjs/common';
import { Clock, SystemClock } from '../common/clock';
import { FlightsModule } from '../flights/flights.module';
import { FleetService } from './fleet.service';
import { FlightArchiver } from './flight-archiver';
import { TelemetryScheduler } from './telemetry.scheduler';
import { TrackStore } from './track-store';

@Module({
  imports: [FlightsModule],
  providers: [
    FleetService,
    FlightArchiver,
    TrackStore,
    TelemetryScheduler,
    { provide: Clock, useClass: SystemClock },
  ],
  exports: [FleetService],
})
export class SimulationModule {}
