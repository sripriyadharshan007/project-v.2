import { Module } from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { ExecutionController } from './execution.controller';
import { ExecutionWorker } from './execution.worker';
import { SchemaValidationService } from './schema-validation.service';
import { QueueModule } from '../queue/queue.module';
import { RuleEngineModule } from '../rule-engine/rule-engine.module';
import { PrismaModule } from '../prisma/prisma.module';

@Module({
  imports: [PrismaModule, QueueModule, RuleEngineModule],
  controllers: [ExecutionController],
  providers: [ExecutionService, ExecutionWorker, SchemaValidationService],
  exports: [ExecutionService],
})
export class ExecutionModule {}
