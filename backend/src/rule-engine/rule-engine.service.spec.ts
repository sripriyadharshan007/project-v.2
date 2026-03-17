import { Test, TestingModule } from '@nestjs/testing';
import { RuleEngineService } from './rule-engine.service';
import { BadRequestException } from '@nestjs/common';

// Helper to create a mock Rule object
function createRule(overrides: Partial<{
  id: string; stepId: string; condition: string; priority: number;
  isDefault: boolean; nextStepId: string | null;
}>) {
  return {
    id: overrides.id ?? 'rule-id',
    stepId: overrides.stepId ?? 'step-1',
    condition: overrides.condition ?? 'true',
    priority: overrides.priority ?? 0,
    isDefault: overrides.isDefault ?? false,
    nextStepId: overrides.nextStepId ?? null,
    createdAt: new Date('2026-01-01'),
    updatedAt: new Date('2026-01-01'),
  };
}

describe('RuleEngineService', () => {
  let service: RuleEngineService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RuleEngineService],
    }).compile();

    service = module.get<RuleEngineService>(RuleEngineService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ─── Test 1: Numeric Comparison ─────────────────────────

  describe('numeric comparison', () => {
    it('should evaluate numeric comparison', async () => {
      const context = { order: { amount: 150, quantity: 5 } };

      // ==
      expect(await service.evaluateCondition('order.amount == 150', context)).toBe(true);
      expect(await service.evaluateCondition('order.amount == 200', context)).toBe(false);

      // !=
      expect(await service.evaluateCondition('order.amount != 0', context)).toBe(true);

      // < >
      expect(await service.evaluateCondition('order.amount > 100', context)).toBe(true);
      expect(await service.evaluateCondition('order.amount < 200', context)).toBe(true);
      expect(await service.evaluateCondition('order.amount > 200', context)).toBe(false);

      // <= >=
      expect(await service.evaluateCondition('order.amount >= 150', context)).toBe(true);
      expect(await service.evaluateCondition('order.amount <= 150', context)).toBe(true);
      expect(await service.evaluateCondition('order.quantity >= 10', context)).toBe(false);
    });
  });

  // ─── Test 2: Logical Conditions ─────────────────────────

  describe('logical conditions', () => {
    it('should evaluate logical conditions', async () => {
      const context = { user: { age: 25, status: 'ACTIVE', tier: 'GOLD' } };

      // && (AND)
      expect(
        await service.evaluateCondition('user.age > 18 && user.status == "ACTIVE"', context),
      ).toBe(true);
      expect(
        await service.evaluateCondition('user.age > 30 && user.status == "ACTIVE"', context),
      ).toBe(false);

      // || (OR)
      expect(
        await service.evaluateCondition('user.tier == "PLATINUM" || user.tier == "GOLD"', context),
      ).toBe(true);
      expect(
        await service.evaluateCondition('user.tier == "PLATINUM" || user.age < 18', context),
      ).toBe(false);

      // Combined && and ||
      expect(
        await service.evaluateCondition(
          '(user.age > 18 && user.status == "ACTIVE") || user.tier == "PLATINUM"',
          context,
        ),
      ).toBe(true);
    });
  });

  // ─── Test 3: String Operators ───────────────────────────

  describe('string operators', () => {
    it('should evaluate string operators', async () => {
      const context = {
        user: { email: 'admin@example.com', name: 'John Doe' },
      };

      // contains (via JEXL transform)
      expect(
        await service.evaluateCondition('user.email|contains("example.com")', context),
      ).toBe(true);
      expect(
        await service.evaluateCondition('user.email|contains("gmail.com")', context),
      ).toBe(false);

      // startsWith
      expect(
        await service.evaluateCondition('user.email|startsWith("admin")', context),
      ).toBe(true);
      expect(
        await service.evaluateCondition('user.email|startsWith("user")', context),
      ).toBe(false);

      // endsWith
      expect(
        await service.evaluateCondition('user.name|endsWith("Doe")', context),
      ).toBe(true);
      expect(
        await service.evaluateCondition('user.name|endsWith("Smith")', context),
      ).toBe(false);
    });
  });

  // ─── Test 4: First Matching Rule ────────────────────────

  describe('evaluateRules - first matching', () => {
    it('should return first matching rule', async () => {
      const rules = [
        createRule({ id: 'r-low', condition: 'order.amount > 100', priority: 1, nextStepId: 'step-low' }),
        createRule({ id: 'r-high', condition: 'order.amount > 500', priority: 10, nextStepId: 'step-high' }),
        createRule({ id: 'r-mid', condition: 'order.amount > 200', priority: 5, nextStepId: 'step-mid' }),
      ];

      // amount = 1000 → all match, but r-high has highest priority (10)
      const result1 = await service.evaluateRules(rules, { order: { amount: 1000 } });
      expect(result1).not.toBeNull();
      expect(result1!.id).toBe('r-high');

      // amount = 300 → r-low (pri 1) and r-mid (pri 5) match; r-mid wins
      const result2 = await service.evaluateRules(rules, { order: { amount: 300 } });
      expect(result2).not.toBeNull();
      expect(result2!.id).toBe('r-mid');

      // amount = 150 → only r-low matches
      const result3 = await service.evaluateRules(rules, { order: { amount: 150 } });
      expect(result3).not.toBeNull();
      expect(result3!.id).toBe('r-low');
    });
  });

  // ─── Test 5: Fallback to DEFAULT ────────────────────────

  describe('evaluateRules - DEFAULT fallback', () => {
    it('should fallback to DEFAULT rule', async () => {
      const rules = [
        createRule({ id: 'r1', condition: 'order.amount > 1000', priority: 10, nextStepId: 'step-big' }),
        createRule({ id: 'r-default', condition: 'true', priority: 0, isDefault: true, nextStepId: 'step-default' }),
      ];

      // amount = 50 → r1 doesn't match, falls back to default
      const result = await service.evaluateRules(rules, { order: { amount: 50 } });

      expect(result).not.toBeNull();
      expect(result!.id).toBe('r-default');
      expect(result!.isDefault).toBe(true);
      expect(result!.nextStepId).toBe('step-default');
    });

    it('should return null when no rules match and no default exists', async () => {
      const rules = [
        createRule({ id: 'r1', condition: 'order.amount > 1000', priority: 10 }),
      ];

      const result = await service.evaluateRules(rules, { order: { amount: 50 } });
      expect(result).toBeNull();
    });
  });

  // ─── Test 6: Invalid Syntax ─────────────────────────────

  describe('invalid syntax', () => {
    it('should throw error for invalid syntax', async () => {
      const rules = [
        createRule({ id: 'r-bad', condition: '>>>invalid<<<', priority: 10 }),
      ];

      await expect(
        service.evaluateRules(rules, { order: { amount: 100 } }),
      ).rejects.toThrow(BadRequestException);
    });

    it('should throw for malformed expressions', async () => {
      const badConditions = ['(((', '== ==', '|||'];

      for (const condition of badConditions) {
        const rules = [createRule({ id: 'r-bad', condition, priority: 10 })];

        await expect(
          service.evaluateRules(rules, {}),
        ).rejects.toThrow(BadRequestException);
      }
    });
  });
});
