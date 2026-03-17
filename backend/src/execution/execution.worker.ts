import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { ExecutionService } from './execution.service';

/**
 * BullMQ worker that processes step execution jobs from the workflow_queue.
 *
 * Execution flow:
 * 1. Queue receives a job with { executionId, stepId, context }
 * 2. Worker calls executionService.processStep()
 * 3. processStep evaluates rules via RuleEngineService
 * 4. If a next step is determined, a new job is enqueued
 * 5. If no next step, the workflow is marked COMPLETED
 * 6. On failure, the step is logged as FAILED and execution is marked FAILED
 */
@Processor('workflow_queue')
export class ExecutionWorker extends WorkerHost {
  private readonly logger = new Logger(ExecutionWorker.name);

  constructor(private readonly executionService: ExecutionService) {
    super();
  }

  async process(job: Job<{ executionId: string; stepId: string; context: Record<string, any> }>) {
    const { executionId, stepId } = job.data;

    this.logger.log(`Processing job ${job.id}: execution=${executionId}, step=${stepId}`);

    try {
      await this.executionService.processStep(executionId, stepId);
      this.logger.log(`Job ${job.id} completed successfully`);
    } catch (error) {
      this.logger.error(
        `Job ${job.id} failed: ${error.message}`,
        error.stack,
      );
      throw error; // Re-throw so BullMQ can handle retries
    }
  }
}
