import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { Telemetry, TrackHistory } from '@fleet-tracker/shared';
import { FleetService } from '../simulation/fleet.service';

@ApiTags('telemetry')
@Controller('telemetry')
export class TelemetryController {
  constructor(private readonly fleet: FleetService) {}

  @Get('history')
  @ApiOkResponse({ description: 'Track flown so far, keyed by drone id' })
  history(): TrackHistory {
    return this.fleet.history();
  }

  @Get('latest')
  @ApiOkResponse({ description: 'Most recent point for each drone' })
  latest(): Telemetry[] {
    return this.fleet.latest();
  }
}
