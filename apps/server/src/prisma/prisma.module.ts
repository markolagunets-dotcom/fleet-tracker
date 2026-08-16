import { Global, Module } from '@nestjs/common';
import { PrismaService } from './prisma.service';

/** Global: the database client is infrastructure every feature may need. */
@Global()
@Module({
  providers: [PrismaService],
  exports: [PrismaService],
})
export class PrismaModule {}
