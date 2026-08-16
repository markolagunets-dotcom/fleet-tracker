import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { ApiOkResponse, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { PrismaService } from '../prisma/prisma.service';

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  /** Liveness: the process is up. Deliberately touches nothing. */
  @Get()
  @ApiOkResponse({ description: 'Liveness probe' })
  check(): { status: string; uptimeSeconds: number } {
    return { status: 'ok', uptimeSeconds: Math.round(process.uptime()) };
  }

  /**
   * Readiness: the process can actually serve. Liveness returning `ok` while the
   * database is unreachable is the failure mode this exists to catch.
   */
  @Get('ready')
  @ApiOkResponse({ description: 'Dependencies reachable' })
  @ApiServiceUnavailableResponse({ description: 'A dependency is unreachable' })
  async ready(): Promise<{ status: string; database: string }> {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
    } catch {
      throw new ServiceUnavailableException({ status: 'degraded', database: 'unreachable' });
    }
    return { status: 'ok', database: 'reachable' };
  }
}
