import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { RuleEngineService } from '../rule-engine/rule-engine.service';
import { SchemaValidationService } from './schema-validation.service';
import { CreateExecutionDto } from './dto/create-execution.dto';
import { Role } from '@prisma/client';

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
    const { workflowId, context, actorRole } = createExecutionDto;

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
        data: {
          ...(context as any),
          ...(actorRole ? { __actorRole: actorRole } : {}),
        } as any,
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
    this.logger.log(
      `[NOTIFY] Execution ${execution.id}: starting at step ${startStepId}`,
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
      // Role guard: if step has a role, caller must match it
      if (step.role) {
        const actor = context.__actorRole as Role | undefined;
        if (!actor) {
          throw new ForbiddenException(
            `Role required to execute step "${step.name}". Expected ${step.role}.`,
          );
        }
        if (actor !== step.role) {
          throw new ForbiddenException(
            `Insufficient role for step "${step.name}". Expected ${step.role}, got ${actor}.`,
          );
        }
      }

      this.logger.log(`Executing step: ${step.name} (${step.id})`);
      this.logger.log(
        `[NOTIFY] Execution ${executionId}: entered step "${step.name}" (${step.id})`,
      );

      // Notification step email logic (console-only unless an email sender exists)
      const emailAuditEvents: any[] = [];
      if (step.stepType === 'NOTIFICATION') {
        const meta = (step.metadata || {}) as Record<string, any>;
        const emailTo = meta.emailTo as string | undefined;
        const subjectTmpl = (meta.subject as string | undefined) ?? 'Workflow Update';
        const messageTmpl =
          (meta.message as string | undefined) ??
          'Your request of ₹{amount} is {status}';

        const derivedStatus =
          (context.status as string | undefined) ??
          (context.__workflowStatus as string | undefined) ??
          undefined;

        const important = new Set(['APPROVED', 'REJECTED', 'COMPLETED']);
        const statusForEmail =
          typeof derivedStatus === 'string'
            ? derivedStatus.toUpperCase()
            : undefined;

        const amount =
          context.amount ??
          context.totalAmount ??
          context.requestAmount ??
          undefined;

        const interpolate = (tmpl: string) =>
          tmpl
            .replaceAll('{amount}', amount === undefined ? '' : String(amount))
            .replaceAll('{status}', statusForEmail ?? '');

        if (!emailTo) {
          emailAuditEvents.push({
            type: 'email',
            status: 'skipped',
            reason: 'metadata.emailTo not configured',
          });
        } else if (!statusForEmail || !important.has(statusForEmail)) {
          emailAuditEvents.push({
            type: 'email',
            status: 'skipped',
            to: emailTo,
            reason: `status not important (${statusForEmail ?? 'unknown'})`,
          });
        } else {
          const subject = interpolate(subjectTmpl) || 'Workflow Update';
          const message = interpolate(messageTmpl);

          // Existing email setup not found in this repo; console log is used as the send mechanism.
          this.logger.log(
            `[EMAIL] to=${emailTo} subject="${subject}" message="${message}"`,
          );

          emailAuditEvents.push({
            type: 'email',
            status: 'sent',
            to: emailTo,
            subject,
            message,
          });
        }
      }

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

      // If this is an approval step, capture APPROVED into context so a later NOTIFICATION step can email.
      if (step.stepType === 'APPROVAL') {
        context.__workflowStatus = 'APPROVED';
      }
      // If this is a task step that represents a rejection, allow workflow builders to set it explicitly.
      if (typeof context.status === 'string' && context.status.toUpperCase() === 'REJECTED') {
        context.__workflowStatus = 'REJECTED';
      }

      // Log SUCCESS
      await this.prisma.executionLog.create({
        data: {
          executionId,
          stepId,
          stepName: step.name,
          status: 'completed', // lowercase per user example
          evaluatedRules: [
            ...(matchedRule ? [{ rule: matchedRule.condition, result: true }] : []),
            ...emailAuditEvents,
          ],
          selectedNextStep: matchedRule?.nextStepId ? (await this.prisma.step.findUnique({ where: { id: matchedRule.nextStepId } }))?.name : null,
          startedAt,
          endedAt: new Date(),
        },
      });

      // Persist any context mutations (e.g., __workflowStatus) after step finishes
      await this.prisma.execution.update({
        where: { id: executionId },
        data: { data: context },
      });

      // 7. Update execution state
      if (matchedRule?.nextStepId) {
        const nextStep = await this.prisma.step.findUnique({
          where: { id: matchedRule.nextStepId },
          select: { id: true, name: true },
        });

        this.logger.log(
          `[NOTIFY] Execution ${executionId}: step "${step.name}" → next "${nextStep?.name ?? matchedRule.nextStepId}" (${matchedRule.nextStepId})`,
        );

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
        // Mark completion in context so terminal NOTIFICATION steps (if any) can use it.
        context.__workflowStatus = 'COMPLETED';
        this.logger.log(
          `[NOTIFY] Execution ${executionId}: step "${step.name}" has no next step (ending workflow)`,
        );

        // Workflow completes — no next step
        await this.prisma.execution.update({
          where: { id: executionId },
          data: { status: 'COMPLETED', endedAt: new Date() },
        });

        this.logger.log(`Execution ${executionId} completed.`);
      }
    } catch (error) {
      const isForbidden =
        error instanceof ForbiddenException ||
        (typeof error?.message === 'string' && error.message.toLowerCase().includes('role'));

      // Log FAILED step
      await this.prisma.executionLog.create({
        data: {
          executionId,
          stepId,
          stepName: step.name,
          status: isForbidden ? 'rejected' : 'failed',
          errorMessage: error.message || 'Execution rejected',
          startedAt,
          endedAt: new Date(),
        },
      });

      // Mark execution as REJECTED or FAILED
      await this.prisma.execution.update({
        where: { id: executionId },
        data: { status: isForbidden ? 'REJECTED' : 'FAILED', currentStepId: stepId },
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
