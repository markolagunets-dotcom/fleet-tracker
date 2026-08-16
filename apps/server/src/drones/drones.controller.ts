import { Body, Controller, Get, Param, Post } from '@nestjs/common';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';
import type { DroneSummary } from '@fleet-tracker/shared';
import { FleetService } from '../simulation/fleet.service';
import { CommandDto } from './dto/command.dto';

@ApiTags('drones')
@Controller('drones')
export class DronesController {
  constructor(private readonly fleet: FleetService) {}

  @Get()
  @ApiOkResponse({ description: 'Current fleet roster' })
  list(): DroneSummary[] {
    return this.fleet.roster();
  }

  @Post(':droneId/command')
  @ApiOkResponse({ description: 'Drone state after applying the command' })
  command(@Param('droneId') droneId: string, @Body() body: CommandDto): DroneSummary {
    return this.fleet.command(droneId, body.command);
  }
}
