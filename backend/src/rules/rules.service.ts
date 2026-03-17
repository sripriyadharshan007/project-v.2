import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { RulesRepository } from './rules.repository';
import { CreateRuleDto, UpdateRuleDto } from './dto/rules.dto';
import * as jexl from 'jexl';

@Injectable()
export class RulesService {
  constructor(private readonly repository: RulesRepository) {}

  /**
   * Validates that a condition string is non-empty and is valid JEXL syntax.
   */
  private async validateConditionSyntax(condition: string): Promise<void> {
    if (!condition || !condition.trim()) {
      throw new BadRequestException('Rule condition must not be empty');
    }

    try {
      // Compile the expression to check syntax without evaluating
      const expr = jexl.createExpression(condition);
      // Attempt a dry-run evaluation with empty context to catch syntax errors
      await expr.eval({});
    } catch {
      throw new BadRequestException(
        `Invalid rule condition syntax: "${condition}"`,
      );
    }
  }

  async create(createRuleDto: CreateRuleDto) {
    // Validate condition syntax
    await this.validateConditionSyntax(createRuleDto.condition);

    // Verify parent step exists
    const exists = await this.repository.stepExists(createRuleDto.stepId);
    if (!exists) {
      throw new NotFoundException(
        `Step with ID ${createRuleDto.stepId} not found`,
      );
    }

    // Enforce single default rule per step
    if (createRuleDto.isDefault) {
      const existingDefault = await this.repository.findDefaultByStep(
        createRuleDto.stepId,
      );
      if (existingDefault) {
        throw new ConflictException(
          `Step ${createRuleDto.stepId} already has a default rule (${existingDefault.id})`,
        );
      }
    }

    return this.repository.create({
      stepId: createRuleDto.stepId,
      condition: createRuleDto.condition,
      ...(createRuleDto.nextStepId !== undefined && {
        nextStepId: createRuleDto.nextStepId,
      }),
      ...(createRuleDto.priority !== undefined && {
        priority: createRuleDto.priority,
      }),
      ...(createRuleDto.isDefault !== undefined && {
        isDefault: createRuleDto.isDefault,
      }),
    });
  }

  async findAllByStep(stepId: string) {
    return this.repository.findAllByStep(stepId);
  }

  async findOne(id: string) {
    const rule = await this.repository.findById(id);
    if (!rule) {
      throw new NotFoundException(`Rule with ID ${id} not found`);
    }
    return rule;
  }

  async update(id: string, updateRuleDto: UpdateRuleDto) {
    if (updateRuleDto.condition !== undefined) {
      await this.validateConditionSyntax(updateRuleDto.condition);
    }

    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Rule with ID ${id} not found`);
    }

    // If setting as default, check for existing default on the same step
    if (updateRuleDto.isDefault && !existing.isDefault) {
      const existingDefault = await this.repository.findDefaultByStep(
        existing.stepId,
      );
      if (existingDefault && existingDefault.id !== id) {
        throw new ConflictException(
          `Step ${existing.stepId} already has a default rule (${existingDefault.id})`,
        );
      }
    }

    const { condition, nextStepId, priority, isDefault } = updateRuleDto;

    return this.repository.update(id, {
      ...(condition !== undefined && { condition }),
      ...(nextStepId !== undefined && { nextStepId }),
      ...(priority !== undefined && { priority }),
      ...(isDefault !== undefined && { isDefault }),
    });
  }

  async remove(id: string) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Rule with ID ${id} not found`);
    }

    return this.repository.delete(id);
  }
}
