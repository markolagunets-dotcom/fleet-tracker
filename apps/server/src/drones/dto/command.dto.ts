import { ApiProperty } from '@nestjs/swagger';
import type { DroneCommand } from '@fleet-tracker/shared';
import { IsIn } from 'class-validator';

const COMMANDS: DroneCommand[] = ['PAUSE', 'RESUME', 'RTB', 'RESET'];

export class CommandDto {
  @ApiProperty({ enum: COMMANDS })
  @IsIn(COMMANDS)
  command!: DroneCommand;
}
