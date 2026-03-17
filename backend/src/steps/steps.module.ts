import { Module } from '@nestjs/common';
import { StepsService } from './steps.service';
import { StepsController } from './steps.controller';
import { StepsRepository } from './steps.repository';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  controllers: [StepsController],
  providers: [StepsService, StepsRepository],
  exports: [StepsService, StepsRepository],
})
export class StepsModule {}
