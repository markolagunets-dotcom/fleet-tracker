import { Module } from '@nestjs/common';
import { SimulationModule } from '../simulation/simulation.module';
import { DronesController } from './drones.controller';

@Module({
  imports: [SimulationModule],
  controllers: [DronesController],
})
export class DronesModule {}
