import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { StepsService } from './steps.service';
import { StepsRepository } from './steps.repository';
import { StepType } from '@prisma/client';

describe('StepsService', () => {
  let service: StepsService;
  let repository: jest.Mocked<Record<keyof StepsRepository, jest.Mock>>;

  const mockStep = {
    id: 'step-uuid-1',
    workflowId: 'wf-uuid-1',
    name: 'Send Email',
    stepType: 'TASK' as StepType,
    order: 0,
    metadata: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
    rules: [],
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      findAllByWorkflow: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      findByWorkflowAndOrder: jest.fn(),
      getMaxOrder: jest.fn(),
      workflowExists: jest.fn(),
      updateWorkflowStartStep: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        StepsService,
        {
          provide: StepsRepository,
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<StepsService>(StepsService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── Test 1: Create Step ────────────────────────────────

  describe('create', () => {
    it('should create step', async () => {
      const dto = { workflowId: 'wf-uuid-1', name: 'Send Email', stepType: 'TASK' as StepType };
      repository.workflowExists.mockResolvedValue(true);
      repository.getMaxOrder.mockResolvedValue(-1);
      repository.create.mockResolvedValue(mockStep);

      const result = await service.create(dto);

      expect(repository.workflowExists).toHaveBeenCalledWith('wf-uuid-1');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          workflowId: 'wf-uuid-1',
          name: 'Send Email',
          stepType: 'TASK',
          order: 0, // auto-assigned: maxOrder(-1) + 1
        }),
      );
      expect(result).toEqual(mockStep);
    });

    it('should throw NotFoundException if workflow does not exist', async () => {
      const dto = { workflowId: 'invalid-wf', name: 'Step', stepType: 'TASK' as StepType };
      repository.workflowExists.mockResolvedValue(false);

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Test 2: List Steps by Workflow ─────────────────────

  describe('findAllByWorkflow', () => {
    it('should list steps by workflow', async () => {
      const steps = [
        { ...mockStep, order: 0, name: 'Step 1' },
        { ...mockStep, id: 'step-uuid-2', order: 1, name: 'Step 2' },
        { ...mockStep, id: 'step-uuid-3', order: 2, name: 'Step 3' },
      ];
      repository.findAllByWorkflow.mockResolvedValue(steps);

      const result = await service.findAllByWorkflow('wf-uuid-1');

      expect(repository.findAllByWorkflow).toHaveBeenCalledWith('wf-uuid-1');
      expect(result).toHaveLength(3);
      // Verify order is ascending
      expect(result[0].order).toBe(0);
      expect(result[1].order).toBe(1);
      expect(result[2].order).toBe(2);
    });
  });

  // ─── Test 3: Update Step ────────────────────────────────

  describe('update', () => {
    it('should update step', async () => {
      const updatedStep = { ...mockStep, name: 'Updated Step' };
      repository.findById.mockResolvedValue(mockStep);
      repository.update.mockResolvedValue(updatedStep);

      const result = await service.update('step-uuid-1', { name: 'Updated Step' });

      expect(repository.findById).toHaveBeenCalledWith('step-uuid-1');
      expect(repository.update).toHaveBeenCalledWith('step-uuid-1', { name: 'Updated Step' });
      expect(result.name).toBe('Updated Step');
    });

    it('should throw NotFoundException for non-existent step', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Test 4: Delete Step ────────────────────────────────

  describe('remove', () => {
    it('should delete step', async () => {
      repository.findById.mockResolvedValue(mockStep);
      repository.delete.mockResolvedValue(mockStep);

      const result = await service.remove('step-uuid-1');

      expect(repository.findById).toHaveBeenCalledWith('step-uuid-1');
      expect(repository.delete).toHaveBeenCalledWith('step-uuid-1');
      expect(result).toEqual(mockStep);
    });

    it('should throw NotFoundException for non-existent step', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Test 5: Enforce Step Order ─────────────────────────

  describe('step order enforcement', () => {
    it('should enforce step order', async () => {
      // When no order is specified, auto-assigns next order
      const dto = { workflowId: 'wf-uuid-1', name: 'Auto-ordered', stepType: 'TASK' as StepType };
      repository.workflowExists.mockResolvedValue(true);
      repository.getMaxOrder.mockResolvedValue(2); // Steps at 0, 1, 2 exist

      const expectedStep = { ...mockStep, name: 'Auto-ordered', order: 3 };
      repository.create.mockResolvedValue(expectedStep);

      const result = await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({ order: 3 }),
      );
      expect(result.order).toBe(3);
    });

    it('should reject duplicate order within same workflow', async () => {
      const dto = { workflowId: 'wf-uuid-1', name: 'Dup Order', stepType: 'TASK' as StepType, order: 0 };
      repository.workflowExists.mockResolvedValue(true);
      repository.findByWorkflowAndOrder.mockResolvedValue(mockStep); // order 0 already taken

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });

    it('should allow explicit order when not taken', async () => {
      const dto = { workflowId: 'wf-uuid-1', name: 'Explicit Order', stepType: 'TASK' as StepType, order: 5 };
      repository.workflowExists.mockResolvedValue(true);
      repository.findByWorkflowAndOrder.mockResolvedValue(null); // order 5 is free

      const expectedStep = { ...mockStep, name: 'Explicit Order', order: 5 };
      repository.create.mockResolvedValue(expectedStep);

      const result = await service.create(dto);
      expect(result.order).toBe(5);
    });
  });

  // ─── Test 6: Validate step_type Enum ────────────────────

  describe('stepType enum validation', () => {
    it('should validate step_type enum', async () => {
      repository.workflowExists.mockResolvedValue(true);
      repository.getMaxOrder.mockResolvedValue(-1);

      // Valid types should succeed
      for (const validType of ['TASK', 'APPROVAL', 'NOTIFICATION'] as StepType[]) {
        const dto = { workflowId: 'wf-uuid-1', name: `${validType} Step`, stepType: validType };
        repository.create.mockResolvedValue({ ...mockStep, stepType: validType });

        const result = await service.create(dto);
        expect(result.stepType).toBe(validType);
      }

      // Invalid type should throw
      const invalidDto = {
        workflowId: 'wf-uuid-1',
        name: 'Bad Type',
        stepType: 'INVALID_TYPE' as any,
      };

      await expect(service.create(invalidDto)).rejects.toThrow(BadRequestException);
    });
  });
});
