import { Controller, Get, NotFoundException, Param } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { FlightDetailDto, FlightSummaryDto } from '@fleet-tracker/shared';
import { FlightsRepository } from './flights.repository';

@ApiTags('flights')
@Controller('flights')
export class FlightsController {
  constructor(private readonly flights: FlightsRepository) {}

  @Get()
  @ApiOkResponse({ description: 'Completed flights, newest first' })
  list(): Promise<FlightSummaryDto[]> {
    return this.flights.list();
  }

  @Get(':id')
  @ApiOkResponse({ description: 'One flight with its full track' })
  async findOne(@Param('id') id: string): Promise<FlightDetailDto> {
    const flight = await this.flights.findOne(id);
    if (!flight) {
      throw new NotFoundException(`unknown flight: ${id}`);
    }
    return flight;
  }
}
