import { ArgumentsHost, Catch, NotFoundException } from '@nestjs/common';
import { BaseExceptionFilter } from '@nestjs/core';
import { UnknownDroneError } from '../simulation/errors';

/**
 * Translates domain errors into HTTP at the edge, so the simulation core never has
 * to import a transport type to report that a drone does not exist.
 */
@Catch(UnknownDroneError)
export class DomainExceptionFilter extends BaseExceptionFilter {
  override catch(error: UnknownDroneError, host: ArgumentsHost): void {
    super.catch(new NotFoundException(error.message), host);
  }
}
