import { Injectable, Logger } from '@nestjs/common';
import { Queue, Job } from 'bullmq';
import { InjectQueue } from '@nestjs/bullmq';

@Injectable()
export class QueueService {
  private readonly logger = new Logger(QueueService.name);

  constructor(
    @InjectQueue('workflow_queue') private workflowQueue: Queue,
  ) {}

  /**
   * Enqueues a step to be processed by the execution engine runner.
   */
  async enqueueStep(
    executionId: string,
    stepId: string,
    context: Record<string, any>,
    options?: { attempts?: number; delay?: number }
  ): Promise<Job> {
    const job = await this.workflowQueue.add(
      'execute-step',
      { executionId, stepId, context },
      {
        attempts: options?.attempts || 3,
        backoff: { type: 'exponential', delay: 1000 },
        removeOnComplete: true,
        delay: options?.delay || 0,
      }
    );
    this.logger.log(`Enqueued job ${job.id} for execution ${executionId}, step ${stepId}`);
    return job;
  }

  /**
   * Cancels all pending or delayed jobs associated with a specific workflow execution.
   */
  async cancelWorkflowExecution(executionId: string): Promise<void> {
    const jobs = await this.workflowQueue.getJobs(['waiting', 'delayed']);
    const executionJobs = jobs.filter(job => job.data?.executionId === executionId);
    
    for (const job of executionJobs) {
      await job.remove();
      this.logger.log(`Removed job ${job.id} from queue as execution ${executionId} was cancelled.`);
    }
  }
}
