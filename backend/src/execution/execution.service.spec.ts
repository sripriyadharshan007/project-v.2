import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { PrismaService } from '../prisma/prisma.service';
import { QueueService } from '../queue/queue.service';
import { RuleEngineService } from '../rule-engine/rule-engine.service';
import { SchemaValidationService } from './schema-validation.service';

describe('ExecutionService', () => {
  let service: ExecutionService;
  let prisma: any;
  let queueService: any;
  let ruleEngineService: any;
  let schemaValidation: any;

  const mockWorkflow = {
    id: 'wf-uuid-1',
    name: 'Onboarding',
    version: 2,
    isActive: true,
    inputSchema: { type: 'object', properties: { email: { type: 'string' } } },
    startStepId: 'step-start',
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockExecution = {
    id: 'exec-uuid-1',
    workflowId: 'wf-uuid-1',
    workflowVersion: 2,
    status: 'RUNNING',
    data: { email: 'user@example.com' },
    currentStepId: 'step-start',
    retries: 0,
    triggeredBy: null,
    startedAt: new Date(),
    endedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  const mockStep = {
    id: 'step-start',
    workflowId: 'wf-uuid-1',
    name: 'Send Welcome Email',
    stepType: 'TASK',
    order: 0,
    metadata: null,
    rules: [
      {
        id: 'rule-1',
        stepId: 'step-start',
        condition: 'email|contains("@")',
        nextStepId: 'step-2',
        priority: 10,
        isDefault: false,
      },
      {
        id: 'rule-default',
        stepId: 'step-start',
        condition: 'true',
        nextStepId: null,
        priority: 0,
        isDefault: true,
      },
    ],
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  beforeEach(async () => {
    prisma = {
      workflow: { findUnique: jest.fn() },
      execution: {
        create: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      step: { findUnique: jest.fn(), findFirst: jest.fn() },
      executionLog: { create: jest.fn() },
    };

    queueService = {
      enqueueStep: jest.fn().mockResolvedValue({ id: 'job-1' }),
      cancelWorkflowExecution: jest.fn().mockResolvedValue(undefined),
    };

    ruleEngineService = {
      evaluateRules: jest.fn(),
    };

    schemaValidation = {
      validate: jest.fn(), // no-op by default — passes all schemas
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ExecutionService,
        { provide: PrismaService,           useValue: prisma },
        { provide: QueueService,            useValue: queueService },
        { provide: RuleEngineService,       useValue: ruleEngineService },
        { provide: SchemaValidationService, useValue: schemaValidation },
      ],
    }).compile();

    service = module.get<ExecutionService>(ExecutionService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── Test 1: Start Workflow Execution ───────────────────

  describe('startExecution', () => {
    it('should start workflow execution', async () => {
      prisma.workflow.findUnique.mockResolvedValue(mockWorkflow);
      prisma.execution.create.mockResolvedValue(mockExecution);

      const result = await service.startExecution({
        workflowId: 'wf-uuid-1',
        context: { email: 'user@example.com' },
      });

      // Should fetch workflow to get startStepId and version
      expect(prisma.workflow.findUnique).toHaveBeenCalledWith({
        where: { id: 'wf-uuid-1' },
      });

      // Should create execution record
      expect(prisma.execution.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          workflowId: 'wf-uuid-1',
          workflowVersion: 2,
          status: 'RUNNING',
          currentStepId: 'step-start',
        }),
      });

      // Should enqueue the start step
      expect(queueService.enqueueStep).toHaveBeenCalledWith(
        'exec-uuid-1',
        'step-start',
        { email: 'user@example.com' },
      );

      expect(result.id).toBe('exec-uuid-1');
      expect(result.status).toBe('RUNNING');
    });

    it('should throw if workflow has no start step', async () => {
      prisma.workflow.findUnique.mockResolvedValue({ ...mockWorkflow, startStepId: null });
      prisma.step.findFirst.mockResolvedValue(null);

      await expect(
        service.startExecution({ workflowId: 'wf-uuid-1', context: {} }),
      ).rejects.toThrow(NotFoundException);
    });

    it('should validate input against workflow schema', async () => {
      prisma.workflow.findUnique.mockResolvedValue(mockWorkflow);

      // Invalid input (number instead of object) should throw
      await expect(
        service.startExecution({ workflowId: 'wf-uuid-1', context: 'not-an-object' as any }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should call schemaValidation.validate with workflow inputSchema', async () => {
      prisma.workflow.findUnique.mockResolvedValue(mockWorkflow);
      prisma.execution.create.mockResolvedValue(mockExecution);

      await service.startExecution({
        workflowId: 'wf-uuid-1',
        context: { email: 'user@example.com' },
      });

      expect(schemaValidation.validate).toHaveBeenCalledWith(
        mockWorkflow.inputSchema,
        { email: 'user@example.com' },
      );
    });

    it('should not create execution if schemaValidation throws', async () => {
      prisma.workflow.findUnique.mockResolvedValue(mockWorkflow);
      schemaValidation.validate.mockImplementation(() => {
        throw new BadRequestException({
          message: 'Input schema validation failed',
          errors: ['"email" must be string'],
        });
      });

      await expect(
        service.startExecution({ workflowId: 'wf-uuid-1', context: { email: 123 } }),
      ).rejects.toThrow(BadRequestException);

      // Execution must NOT be created in DB
      expect(prisma.execution.create).not.toHaveBeenCalled();
    });
  });

  // ─── Test 2: Execute First Step ─────────────────────────

  describe('processStep - execute first step', () => {
    it('should execute first step', async () => {
      prisma.execution.findUnique.mockResolvedValue(mockExecution);
      prisma.step.findUnique.mockResolvedValue(mockStep);
      ruleEngineService.evaluateRules.mockResolvedValue(mockStep.rules[0]); // matches rule-1

      await service.processStep('exec-uuid-1', 'step-start');

      // Should load execution
      expect(prisma.execution.findUnique).toHaveBeenCalledWith({
        where: { id: 'exec-uuid-1' },
      });

      // Should load step with rules
      expect(prisma.step.findUnique).toHaveBeenCalledWith({
        where: { id: 'step-start' },
        include: { rules: true },
      });

      // Should call rule engine
      expect(ruleEngineService.evaluateRules).toHaveBeenCalledWith(
        mockStep.rules,
        mockExecution.data,
      );
    });
  });

  // ─── Test 3: Evaluate Rules and Select Next Step ────────

  describe('processStep - rule evaluation', () => {
    it('should evaluate rules and select next step', async () => {
      prisma.execution.findUnique.mockResolvedValue(mockExecution);
      prisma.step.findUnique.mockResolvedValue(mockStep);
      ruleEngineService.evaluateRules.mockResolvedValue({
        id: 'rule-1',
        nextStepId: 'step-2',
      });

      await service.processStep('exec-uuid-1', 'step-start');

      // Should enqueue the next step
      expect(queueService.enqueueStep).toHaveBeenCalledWith(
        'exec-uuid-1',
        'step-2',
        mockExecution.data,
      );

      // Should update current step
      expect(prisma.execution.update).toHaveBeenCalledWith({
        where: { id: 'exec-uuid-1' },
        data: { currentStepId: 'step-2' },
      });
    });
  });

  // ─── Test 4: End Workflow When next_step_id Is Null ─────

  describe('processStep - completion', () => {
    it('should end workflow when next_step_id null', async () => {
      prisma.execution.findUnique.mockResolvedValue(mockExecution);
      prisma.step.findUnique.mockResolvedValue(mockStep);
      ruleEngineService.evaluateRules.mockResolvedValue(null); // no next step

      await service.processStep('exec-uuid-1', 'step-start');

      // Should NOT enqueue another step
      expect(queueService.enqueueStep).not.toHaveBeenCalled();

      // Should mark execution as COMPLETED
      expect(prisma.execution.update).toHaveBeenCalledWith({
        where: { id: 'exec-uuid-1' },
        data: expect.objectContaining({
          status: 'COMPLETED',
          endedAt: expect.any(Date),
        }),
      });
    });

    it('should complete when matched rule has null nextStepId', async () => {
      prisma.execution.findUnique.mockResolvedValue(mockExecution);
      prisma.step.findUnique.mockResolvedValue(mockStep);
      ruleEngineService.evaluateRules.mockResolvedValue({
        id: 'rule-default',
        nextStepId: null,
      });

      await service.processStep('exec-uuid-1', 'step-start');

      expect(queueService.enqueueStep).not.toHaveBeenCalled();
      expect(prisma.execution.update).toHaveBeenCalledWith({
        where: { id: 'exec-uuid-1' },
        data: expect.objectContaining({ status: 'COMPLETED' }),
      });
    });
  });

  // ─── Test 5: Retry Failed Step ──────────────────────────

  describe('retryStep', () => {
    it('should retry failed step', async () => {
      const failedExecution = { ...mockExecution, status: 'FAILED', retries: 1 };
      prisma.execution.findUnique.mockResolvedValue(failedExecution);
      prisma.execution.update.mockResolvedValue({
        ...failedExecution,
        status: 'RUNNING',
        retries: 2,
      });

      await service.retryStep('exec-uuid-1', 'step-start');

      // Should update status back to RUNNING and increment retries
      expect(prisma.execution.update).toHaveBeenCalledWith({
        where: { id: 'exec-uuid-1' },
        data: {
          status: 'RUNNING',
          retries: { increment: 1 },
        },
      });

      // Should re-enqueue the step
      expect(queueService.enqueueStep).toHaveBeenCalledWith(
        'exec-uuid-1',
        'step-start',
        failedExecution.data,
      );
    });

    it('should throw NotFoundException for non-existent execution', async () => {
      prisma.execution.findUnique.mockResolvedValue(null);

      await expect(
        service.retryStep('non-existent', 'step-start'),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw if execution is not in FAILED state', async () => {
      prisma.execution.findUnique.mockResolvedValue(mockExecution); // status is RUNNING

      await expect(
        service.retryStep('exec-uuid-1', 'step-start'),
      ).rejects.toThrow(BadRequestException);
    });
  });

  // ─── Test 6: Cancel Execution ───────────────────────────

  describe('cancelExecution', () => {
    it('should cancel execution', async () => {
      prisma.execution.findUnique.mockResolvedValue(mockExecution);
      prisma.execution.update.mockResolvedValue({
        ...mockExecution,
        status: 'CANCELLED',
      });

      const result = await service.cancelExecution('exec-uuid-1');

      // Should cancel queue jobs
      expect(queueService.cancelWorkflowExecution).toHaveBeenCalledWith('exec-uuid-1');

      // Should update status
      expect(prisma.execution.update).toHaveBeenCalledWith({
        where: { id: 'exec-uuid-1' },
        data: expect.objectContaining({
          status: 'CANCELLED',
          endedAt: expect.any(Date),
        }),
      });
    });

    it('should throw NotFoundException for non-existent execution', async () => {
      prisma.execution.findUnique.mockResolvedValue(null);

      await expect(service.cancelExecution('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  // ─── Test 7: Loop Detection ─────────────────────────────

  describe('processStep - loop detection', () => {
    it('should allow step within iteration limit', async () => {
      // Mock execution with exactly 10 visits (the limit)
      const executionWithVisits = {
        ...mockExecution,
        data: { __loopCounters: { 'step-start': 9 } },
      };
      prisma.execution.findUnique.mockResolvedValue(executionWithVisits);
      prisma.step.findUnique.mockResolvedValue(mockStep);
      ruleEngineService.evaluateRules.mockResolvedValue(null); // finish

      await service.processStep('exec-uuid-1', 'step-start');

      // Should complete normally without throwing loop error
      expect(prisma.executionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'completed',
        }),
      });
    });

    it('should fail execution when a step is visited more than MAX_LOOP_ITERATIONS times', async () => {
      // Mock execution where this step has already been visited 10 times
      const executionWithMaxVisits = {
        ...mockExecution,
        data: { __loopCounters: { 'step-start': 10 } },
      };
      prisma.execution.findUnique.mockResolvedValue(executionWithMaxVisits);
      prisma.step.findUnique.mockResolvedValue(mockStep);

      await service.processStep('exec-uuid-1', 'step-start');

      // Should log FAILED status with Loop detected message
      expect(prisma.executionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'failed',
          errorMessage: expect.stringContaining('Loop detected: Step "Send Welcome Email" executed 11 times'),
        }),
      });

      // Should mark the execution as FAILED
      expect(prisma.execution.update).toHaveBeenCalledWith({
        where: { id: 'exec-uuid-1' },
        data: expect.objectContaining({ status: 'FAILED' }),
      });
    });
  });

  // ─── Test 8: Log Step Execution ─────────────────────────

  describe('processStep - logging', () => {
    it('should log step execution', async () => {
      prisma.execution.findUnique.mockResolvedValue(mockExecution);
      prisma.step.findUnique.mockResolvedValue(mockStep);
      ruleEngineService.evaluateRules.mockResolvedValue({
        id: 'rule-1',
        nextStepId: 'step-2',
        condition: 'email|contains("@")',
      });

      // Mock finding the next step by ID for logging.
      prisma.step.findUnique = jest.fn()
        .mockResolvedValueOnce(mockStep)
        .mockResolvedValueOnce({ id: 'step-2', name: 'Step 2' });

      await service.processStep('exec-uuid-1', 'step-start');

      // Should create execution log
      expect(prisma.executionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          executionId: 'exec-uuid-1',
          stepId: 'step-start',
          stepName: 'Send Welcome Email',
          status: 'completed',
          evaluatedRules: [{ rule: 'email|contains("@")', result: true }],
          selectedNextStep: 'Step 2',
          startedAt: expect.any(Date),
          endedAt: expect.any(Date),
        }),
      });
    });

    it('should log FAILED status when step processing throws', async () => {
      prisma.execution.findUnique.mockResolvedValue(mockExecution);
      prisma.step.findUnique.mockResolvedValue(mockStep);
      ruleEngineService.evaluateRules.mockRejectedValue(new Error('JEXL eval failed'));

      await service.processStep('exec-uuid-1', 'step-start');

      // Should log FAILED
      expect(prisma.executionLog.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          executionId: 'exec-uuid-1',
          stepId: 'step-start',
          status: 'failed',
          errorMessage: expect.stringContaining('JEXL eval failed'),
        }),
      });

      // Should update execution to FAILED
      expect(prisma.execution.update).toHaveBeenCalledWith({
        where: { id: 'exec-uuid-1' },
        data: expect.objectContaining({ status: 'FAILED' }),
      });
    });
  });
});
