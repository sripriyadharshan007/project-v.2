import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { PrismaModule } from './prisma/prisma.module';
import { WorkflowModule } from './workflow/workflow.module';
import { StepsModule } from './steps/steps.module';
import { RulesModule } from './rules/rules.module';
import { ExecutionModule } from './execution/execution.module';
import { LogsModule } from './logs/logs.module';
import { AppController } from './app.controller';

@Module({
  imports: [
    BullModule.forRoot({
      connection: {
        host: process.env.REDIS_HOST || 'localhost',
        port: parseInt(process.env.REDIS_PORT || '6379', 10),
      },
    }),
    BullModule.registerQueue({
      name: 'workflow_queue',
    }),
    PrismaModule,
    WorkflowModule,
    StepsModule,
    RulesModule,
    ExecutionModule,
    LogsModule,
  ],
  controllers: [AppController],
})
export class AppModule {}
