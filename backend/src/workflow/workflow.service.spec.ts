import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowRepository } from './workflow.repository';

describe('WorkflowService', () => {
  let service: WorkflowService;
  let repository: jest.Mocked<Record<keyof WorkflowRepository, jest.Mock>>;

  const mockWorkflow = {
    id: 'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
    name: 'Onboarding Workflow',
    version: 1,
    isActive: true,
    inputSchema: null,
    startStepId: null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      findAll: jest.fn(),
      count: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        WorkflowService,
        {
          provide: WorkflowRepository,
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<WorkflowService>(WorkflowService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── Test 1: Create ──────────────────────────────────────

  describe('create', () => {
    it('should create workflow', async () => {
      const dto = { name: 'Onboarding Workflow' };
      repository.create.mockResolvedValue(mockWorkflow);

      const result = await service.create(dto);

      expect(repository.create).toHaveBeenCalledWith({
        name: 'Onboarding Workflow',
      });
      expect(result).toEqual(mockWorkflow);
      expect(result.id).toBeDefined();
      expect(result.version).toBe(1);
    });
  });

  // ─── Test 2: Paginated List ──────────────────────────────

  describe('findAll', () => {
    it('should return workflows list with pagination', async () => {
      const workflows = [mockWorkflow, { ...mockWorkflow, id: 'second-id', name: 'Second WF' }];
      repository.findAll.mockResolvedValue(workflows);
      repository.count.mockResolvedValue(25);

      const result = await service.findAll(2, 10);

      expect(repository.findAll).toHaveBeenCalledWith(10, 10); // skip = (page-1)*limit
      expect(repository.count).toHaveBeenCalled();
      expect(result.data).toHaveLength(2);
      expect(result.total).toBe(25);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(3); // ceil(25/10)
    });
  });

  // ─── Test 3: Get by ID ───────────────────────────────────

  describe('findOne', () => {
    it('should get workflow by id', async () => {
      repository.findById.mockResolvedValue(mockWorkflow);

      const result = await service.findOne(mockWorkflow.id);

      expect(repository.findById).toHaveBeenCalledWith(mockWorkflow.id);
      expect(result).toEqual(mockWorkflow);
      expect(result.name).toBe('Onboarding Workflow');
    });

    it('should throw NotFoundException for non-existent id', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.findOne('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Test 4: Update with Version Increment ───────────────

  describe('update', () => {
    it('should update workflow and increment version', async () => {
      const updatedWorkflow = { ...mockWorkflow, name: 'Updated WF', version: 2 };
      repository.findById.mockResolvedValue(mockWorkflow);
      repository.update.mockResolvedValue(updatedWorkflow);

      const result = await service.update(mockWorkflow.id, { name: 'Updated WF' });

      expect(repository.findById).toHaveBeenCalledWith(mockWorkflow.id);
      expect(repository.update).toHaveBeenCalledWith(mockWorkflow.id, {
        name: 'Updated WF',
        version: { increment: 1 },
      });
      expect(result.version).toBe(2);
    });

    it('should throw NotFoundException when updating non-existent workflow', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update('non-existent-id', { name: 'Updated' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Test 5: Delete ──────────────────────────────────────

  describe('remove', () => {
    it('should delete workflow', async () => {
      repository.findById.mockResolvedValue(mockWorkflow);
      repository.delete.mockResolvedValue(mockWorkflow);

      const result = await service.remove(mockWorkflow.id);

      expect(repository.findById).toHaveBeenCalledWith(mockWorkflow.id);
      expect(repository.delete).toHaveBeenCalledWith(mockWorkflow.id);
      expect(result).toEqual(mockWorkflow);
    });

    it('should throw NotFoundException when deleting non-existent workflow', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove('non-existent-id')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Test 6: Input Schema Validation ─────────────────────

  describe('inputSchema validation', () => {
    it('should validate input schema JSON', async () => {
      // Valid object schema — should succeed
      const validDto = {
        name: 'Schema WF',
        inputSchema: { type: 'object', properties: { email: { type: 'string' } } },
      };
      repository.create.mockResolvedValue({ ...mockWorkflow, inputSchema: validDto.inputSchema });

      const validResult = await service.create(validDto);
      expect(validResult.inputSchema).toEqual(validDto.inputSchema);

      // Null schema — should succeed
      const nullDto = { name: 'No Schema WF', inputSchema: null };
      repository.create.mockResolvedValue({ ...mockWorkflow, inputSchema: null });

      const nullResult = await service.create(nullDto);
      expect(nullResult.inputSchema).toBeNull();

      // Invalid schema (string) — should throw
      await expect(
        service.create({ name: 'Bad Schema', inputSchema: 'not-an-object' as any }),
      ).rejects.toThrow(BadRequestException);

      // Invalid schema (number) — should throw
      await expect(
        service.create({ name: 'Bad Schema', inputSchema: 42 as any }),
      ).rejects.toThrow(BadRequestException);

      // Invalid schema (array) — should throw
      await expect(
        service.create({ name: 'Bad Schema', inputSchema: [1, 2, 3] as any }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
