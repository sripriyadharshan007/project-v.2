import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { RuleEngineService } from '../rule-engine/rule-engine.service';
import { SchemaValidationService } from './schema-validation.service';
import { CreateExecutionDto } from './dto/create-execution.dto';

const MAX_LOOP_ITERATIONS = 10;

@Injectable()
export class ExecutionService {
  private readonly logger = new Logger(ExecutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly queueService: QueueService,
    private readonly ruleEngineService: RuleEngineService,
    private readonly schemaValidation: SchemaValidationService,
  ) {}

  // ─── 1. Start Workflow Execution ────────────────────────

  async startExecution(createExecutionDto: CreateExecutionDto) {
    const { workflowId, context } = createExecutionDto;

    // 1. Validate input is an object
    if (!context || typeof context !== 'object' || Array.isArray(context)) {
      throw new BadRequestException('Execution context must be a valid JSON object');
    }

    // Fetch workflow with its start step
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
    });

    if (!workflow) {
      throw new NotFoundException(`Workflow ${workflowId} not found`);
    }

    let startStepId = workflow.startStepId;

    // Resilient fallback: If startStepId is null, try to find the step with order: 1
    if (!startStepId) {
      const firstStep = await this.prisma.step.findFirst({
        where: { workflowId, order: 1 },
      });

      if (!firstStep) {
        throw new NotFoundException(`No initial step found for workflow ${workflowId}`);
      }

      // Automatically fix the workflow
      await this.prisma.workflow.update({
        where: { id: workflowId },
        data: { startStepId: firstStep.id },
      });
      
      startStepId = firstStep.id;
    }

    // 2. Validate context against workflow input schema (Ajv)
    if (workflow.inputSchema) {
      this.schemaValidation.validate(
        workflow.inputSchema as Record<string, any>,
        context,
      );
    }

    // 2. Create execution record
    const execution = await this.prisma.execution.create({
      data: {
        workflowId,
        workflowVersion: workflow.version,
        data: context as any,
        status: 'RUNNING',
        currentStepId: startStepId, // 3. current_step = start_step
        startedAt: new Date(),
      },
    });

    // 4. Enqueue first step job
    await this.queueService.enqueueStep(
      execution.id,
      startStepId,
      context,
    );

    this.logger.log(
      `Execution ${execution.id} started for workflow ${workflowId} v${workflow.version}`,
    );

    return execution;
  }

  // ─── 5. Process Step (called by worker) ─────────────────

  async processStep(executionId: string, stepId: string) {
    const execution = await this.prisma.execution.findUnique({
      where: { id: executionId },
    });

    if (!execution || execution.status !== 'RUNNING') {
      this.logger.warn(
        `Execution ${executionId} is not running. Status: ${execution?.status}`,
      );
      return;
    }

    const step = await this.prisma.step.findUnique({
      where: { id: stepId },
      include: { rules: true },
    });

    if (!step) {
      throw new NotFoundException(`Step ${stepId} not found`);
    }

    const context = (execution.data || {}) as Record<string, any>;
    const startedAt = new Date();

    try {
      this.logger.log(`Executing step: ${step.name} (${step.id})`);

      // Loop Detection
      const counters = (context.__loopCounters || {}) as Record<string, number>;
      const visits = (counters[stepId] || 0) + 1;
      counters[stepId] = visits;
      context.__loopCounters = counters;

      if (visits > MAX_LOOP_ITERATIONS) {
        throw new Error(`Loop detected: Step "${step.name}" executed ${visits} times, exceeding limit of ${MAX_LOOP_ITERATIONS}.`);
      }

      // Persist updated loop counters
      await this.prisma.execution.update({
        where: { id: executionId },
        data: { data: context },
      });

      // 6. Rule engine decides next step
      const matchedRule = await this.ruleEngineService.evaluateRules(
        step.rules,
        context,
      );

      // Log SUCCESS
      await this.prisma.executionLog.create({
        data: {
          executionId,
          stepId,
          stepName: step.name,
          status: 'completed', // lowercase per user example
          evaluatedRules: matchedRule ? [{ rule: matchedRule.condition, result: true }] : [], // mock evaluated rule array as per user example
          selectedNextStep: matchedRule?.nextStepId ? (await this.prisma.step.findUnique({ where: { id: matchedRule.nextStepId } }))?.name : null,
          startedAt,
          endedAt: new Date(),
        },
      });

      // 7. Update execution state
      if (matchedRule?.nextStepId) {
        // Move to next step
        await this.prisma.execution.update({
          where: { id: executionId },
          data: { currentStepId: matchedRule.nextStepId },
        });

        await this.queueService.enqueueStep(
          executionId,
          matchedRule.nextStepId,
          context,
        );
      } else {
        // Workflow completes — no next step
        await this.prisma.execution.update({
          where: { id: executionId },
          data: { status: 'COMPLETED', endedAt: new Date() },
        });

        this.logger.log(`Execution ${executionId} completed.`);
      }
    } catch (error) {
      // Log FAILED step
      await this.prisma.executionLog.create({
        data: {
          executionId,
          stepId,
          stepName: step.name,
          status: 'failed',
          errorMessage: error.message,
          startedAt,
          endedAt: new Date(),
        },
      });

      // Mark execution as FAILED
      await this.prisma.execution.update({
        where: { id: executionId },
        data: { status: 'FAILED', currentStepId: stepId },
      });

      this.logger.error(
        `Step ${step.name} failed in execution ${executionId}: ${error.message}`,
      );
    }
  }

  // ─── Retry Failed Step ──────────────────────────────────

  async retryStep(executionId: string, stepId: string) {
    const execution = await this.prisma.execution.findUnique({
      where: { id: executionId },
    });

    if (!execution) {
      throw new NotFoundException(
        `Execution with ID ${executionId} not found`,
      );
    }

    if (execution.status !== 'FAILED') {
      throw new BadRequestException(
        `Execution ${executionId} is not in FAILED state (current: ${execution.status})`,
      );
    }

    // Reset to RUNNING and increment retry counter
    await this.prisma.execution.update({
      where: { id: executionId },
      data: {
        status: 'RUNNING',
        retries: { increment: 1 },
      },
    });

    // Re-enqueue the failed step
    const context = execution.data as Record<string, any>;
    await this.queueService.enqueueStep(executionId, stepId, context);

    this.logger.log(
      `Retrying step ${stepId} for execution ${executionId} (retry #${execution.retries + 1})`,
    );
  }

  // ─── Cancel Execution ───────────────────────────────────

  async cancelExecution(executionId: string) {
    const execution = await this.prisma.execution.findUnique({
      where: { id: executionId },
    });

    if (!execution) {
      throw new NotFoundException(
        `Execution with ID ${executionId} not found`,
      );
    }

    await this.queueService.cancelWorkflowExecution(executionId);

    return this.prisma.execution.update({
      where: { id: executionId },
      data: { status: 'CANCELLED', endedAt: new Date() },
    });
  }

  // ─── Query Methods ─────────────────────────────────────

  async findAll() {
    return this.prisma.execution.findMany({
      orderBy: { createdAt: 'desc' },
      include: { 
        logs: true,
        workflow: { select: { name: true } }
      },
    });
  }

  async findOne(id: string) {
    const execution = await this.prisma.execution.findUnique({
      where: { id },
      include: { 
        logs: true,
        workflow: { select: { name: true } }
      },
    });

    if (!execution) {
      throw new NotFoundException(`Execution with ID ${id} not found`);
    }

    return execution;
  }
}
