import { Controller, Get } from '@nestjs/common';
import type { Mission } from '@fleet-tracker/shared';
import { MISSIONS } from '@fleet-tracker/shared';
import { ApiOkResponse, ApiTags } from '@nestjs/swagger';

@ApiTags('missions')
@Controller('missions')
export class MissionsController {
  @Get()
  @ApiOkResponse({ description: 'Planned routes for every drone in the fleet' })
  list(): readonly Mission[] {
    return MISSIONS;
  }
}
