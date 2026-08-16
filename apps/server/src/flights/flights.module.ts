import { Module } from '@nestjs/common';
import { FLIGHT_ARCHIVE } from '../simulation/flight-archive.port';
import { FlightsController } from './flights.controller';
import { FlightsRepository } from './flights.repository';

@Module({
  controllers: [FlightsController],
  providers: [
    FlightsRepository,
    // Binds the concrete repository to the port the simulation depends on, so the
    // core never imports Prisma.
    { provide: FLIGHT_ARCHIVE, useExisting: FlightsRepository },
  ],
  exports: [FlightsRepository, FLIGHT_ARCHIVE],
})
export class FlightsModule {}
