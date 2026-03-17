import { Test, TestingModule } from '@nestjs/testing';
import { NotFoundException, BadRequestException, ConflictException } from '@nestjs/common';
import { RulesService } from './rules.service';
import { RulesRepository } from './rules.repository';

describe('RulesService', () => {
  let service: RulesService;
  let repository: jest.Mocked<Record<keyof RulesRepository, jest.Mock>>;

  const mockRule = {
    id: 'rule-uuid-1',
    stepId: 'step-uuid-1',
    condition: 'order.amount > 1000',
    nextStepId: 'step-uuid-2',
    priority: 10,
    isDefault: false,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };

  const mockDefaultRule = {
    ...mockRule,
    id: 'rule-uuid-default',
    condition: 'true',
    priority: 0,
    isDefault: true,
    nextStepId: 'step-uuid-3',
  };

  beforeEach(async () => {
    repository = {
      create: jest.fn(),
      findAllByStep: jest.fn(),
      findById: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
      stepExists: jest.fn(),
      findDefaultByStep: jest.fn(),
      countByStep: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RulesService,
        {
          provide: RulesRepository,
          useValue: repository,
        },
      ],
    }).compile();

    service = module.get<RulesService>(RulesService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── Test 1: Create Rule ────────────────────────────────

  describe('create', () => {
    it('should create rule', async () => {
      const dto = {
        stepId: 'step-uuid-1',
        condition: 'order.amount > 1000',
        nextStepId: 'step-uuid-2',
        priority: 10,
      };
      repository.stepExists.mockResolvedValue(true);
      repository.findDefaultByStep.mockResolvedValue(null);
      repository.create.mockResolvedValue(mockRule);

      const result = await service.create(dto);

      expect(repository.stepExists).toHaveBeenCalledWith('step-uuid-1');
      expect(repository.create).toHaveBeenCalledWith(
        expect.objectContaining({
          stepId: 'step-uuid-1',
          condition: 'order.amount > 1000',
          priority: 10,
        }),
      );
      expect(result).toEqual(mockRule);
    });

    it('should throw NotFoundException if step does not exist', async () => {
      const dto = { stepId: 'invalid-step', condition: 'true' };
      repository.stepExists.mockResolvedValue(false);

      await expect(service.create(dto)).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Test 2: Update Rule ────────────────────────────────

  describe('update', () => {
    it('should update rule', async () => {
      const updatedRule = { ...mockRule, condition: 'order.amount > 500', priority: 5 };
      repository.findById.mockResolvedValue(mockRule);
      repository.update.mockResolvedValue(updatedRule);

      const result = await service.update('rule-uuid-1', {
        condition: 'order.amount > 500',
        priority: 5,
      });

      expect(repository.findById).toHaveBeenCalledWith('rule-uuid-1');
      expect(repository.update).toHaveBeenCalledWith('rule-uuid-1', {
        condition: 'order.amount > 500',
        priority: 5,
      });
      expect(result.condition).toBe('order.amount > 500');
      expect(result.priority).toBe(5);
    });

    it('should throw NotFoundException for non-existent rule', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(
        service.update('non-existent', { condition: 'true' }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Test 3: Delete Rule ────────────────────────────────

  describe('remove', () => {
    it('should delete rule', async () => {
      repository.findById.mockResolvedValue(mockRule);
      repository.delete.mockResolvedValue(mockRule);

      const result = await service.remove('rule-uuid-1');

      expect(repository.findById).toHaveBeenCalledWith('rule-uuid-1');
      expect(repository.delete).toHaveBeenCalledWith('rule-uuid-1');
      expect(result).toEqual(mockRule);
    });

    it('should throw NotFoundException for non-existent rule', async () => {
      repository.findById.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(NotFoundException);
    });
  });

  // ─── Test 4: Sort Rules by Priority ─────────────────────

  describe('findAllByStep', () => {
    it('should sort rules by priority', async () => {
      const rules = [
        { ...mockRule, id: 'r1', priority: 10, condition: 'amount > 1000' },
        { ...mockRule, id: 'r2', priority: 5, condition: 'amount > 500' },
        { ...mockDefaultRule, id: 'r3', priority: 0 },
      ];
      repository.findAllByStep.mockResolvedValue(rules);

      const result = await service.findAllByStep('step-uuid-1');

      expect(repository.findAllByStep).toHaveBeenCalledWith('step-uuid-1');
      expect(result).toHaveLength(3);
      // Repository returns sorted by priority desc
      expect(result[0].priority).toBe(10);
      expect(result[1].priority).toBe(5);
      expect(result[2].priority).toBe(0);
    });
  });

  // ─── Test 5: Require DEFAULT Rule ───────────────────────

  describe('default rule enforcement', () => {
    it('should require DEFAULT rule', async () => {
      // Creating a default rule should succeed
      const defaultDto = {
        stepId: 'step-uuid-1',
        condition: 'true',
        isDefault: true,
        nextStepId: 'step-uuid-3',
      };
      repository.stepExists.mockResolvedValue(true);
      repository.findDefaultByStep.mockResolvedValue(null); // no default exists yet
      repository.create.mockResolvedValue(mockDefaultRule);

      const result = await service.create(defaultDto);
      expect(result.isDefault).toBe(true);
    });

    it('should reject duplicate default rule for same step', async () => {
      const dto = {
        stepId: 'step-uuid-1',
        condition: 'true',
        isDefault: true,
        nextStepId: 'step-uuid-4',
      };
      repository.stepExists.mockResolvedValue(true);
      repository.findDefaultByStep.mockResolvedValue(mockDefaultRule); // default already exists

      await expect(service.create(dto)).rejects.toThrow(ConflictException);
    });
  });

  // ─── Test 6: Validate Rule Syntax ───────────────────────

  describe('rule syntax validation', () => {
    it('should validate rule syntax', async () => {
      repository.stepExists.mockResolvedValue(true);
      repository.findDefaultByStep.mockResolvedValue(null);

      // Valid JEXL expressions should succeed
      const validConditions = [
        'order.amount > 1000',
        'user.status == "ACTIVE"',
        'cart.total >= 100 && user.tier == "GOLD"',
        'true',
      ];

      for (const condition of validConditions) {
        const dto = { stepId: 'step-uuid-1', condition };
        repository.create.mockResolvedValue({ ...mockRule, condition });

        const result = await service.create(dto);
        expect(result.condition).toBe(condition);
      }

      // Invalid/empty conditions should throw
      const invalidConditions = ['', '   '];

      for (const condition of invalidConditions) {
        const dto = { stepId: 'step-uuid-1', condition };

        await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      }
    });

    it('should reject syntactically invalid JEXL expressions', async () => {
      repository.stepExists.mockResolvedValue(true);
      repository.findDefaultByStep.mockResolvedValue(null);

      const invalidExpressions = [
        '>>>invalid<<<',
        '== ==',
        '(((',
      ];

      for (const condition of invalidExpressions) {
        const dto = { stepId: 'step-uuid-1', condition };

        await expect(service.create(dto)).rejects.toThrow(BadRequestException);
      }
    });
  });
});
