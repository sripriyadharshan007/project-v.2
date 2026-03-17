import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import * as jexl from 'jexl';
import { Rule } from '@prisma/client';

export interface RuleEvaluationLog {
  ruleId: string;
  condition: string;
  priority: number;
  isDefault: boolean;
  matched: boolean;
}

export interface EvaluationResult {
  matchedRule: Rule | null;
  logs: RuleEvaluationLog[];
}

@Injectable()
export class RuleEngineService {
  private readonly logger = new Logger(RuleEngineService.name);

  constructor() {
    this.registerTransforms();
  }

  /**
   * Registers JEXL transforms for supported string operators:
   * contains, startsWith, endsWith, toUpperCase, toLowerCase
   */
  private registerTransforms() {
    jexl.addTransform('contains', (val: any, search: string) =>
      typeof val === 'string' ? val.includes(search) : false,
    );
    jexl.addTransform('startsWith', (val: any, search: string) =>
      typeof val === 'string' ? val.startsWith(search) : false,
    );
    jexl.addTransform('endsWith', (val: any, search: string) =>
      typeof val === 'string' ? val.endsWith(search) : false,
    );
    jexl.addTransform('toUpperCase', (val: any) =>
      typeof val === 'string' ? val.toUpperCase() : val,
    );
    jexl.addTransform('toLowerCase', (val: any) =>
      typeof val === 'string' ? val.toLowerCase() : val,
    );
  }

  /**
   * Evaluates a single JEXL condition against input data.
   *
   * Supported operators: == != < > <= >= && ||
   * Supported transforms: contains, startsWith, endsWith
   *
   * @throws BadRequestException if the condition has invalid syntax
   */
  async evaluateCondition(
    condition: string,
    inputData: Record<string, any>,
  ): Promise<boolean> {
    try {
      const result = await jexl.eval(condition, inputData);
      return Boolean(result);
    } catch (error) {
      throw new BadRequestException(
        `Invalid rule condition syntax: "${condition}" — ${error.message}`,
      );
    }
  }

  /**
   * Evaluates a list of rules against input data.
   *
   * Logic:
   * 1. Sort rules by priority (descending)
   * 2. Evaluate each non-default rule's condition
   * 3. Return the first matching rule
   * 4. If no rule matches, fall back to the DEFAULT rule
   * 5. Log evaluation results for each rule
   *
   * @throws BadRequestException if any rule has invalid JEXL syntax
   */
  async evaluateRules(
    rules: Rule[],
    inputData: Record<string, any>,
  ): Promise<Rule | null> {
    // 1. Sort rules by priority descending
    const sortedRules = [...rules].sort((a, b) => b.priority - a.priority);

    // Separate conditional rules from default
    const conditionalRules = sortedRules.filter((r) => !r.isDefault);
    const defaultRule = sortedRules.find((r) => r.isDefault) ?? null;

    const logs: RuleEvaluationLog[] = [];

    // 2 & 3. Evaluate each conditional rule, return first match
    for (const rule of conditionalRules) {
      const matched = await this.evaluateCondition(rule.condition, inputData);

      logs.push({
        ruleId: rule.id,
        condition: rule.condition,
        priority: rule.priority,
        isDefault: false,
        matched,
      });

      if (matched) {
        // 5. Log evaluation results
        this.logEvaluation(logs, rule);
        return rule;
      }
    }

    // 4. Fallback to DEFAULT rule
    if (defaultRule) {
      logs.push({
        ruleId: defaultRule.id,
        condition: defaultRule.condition,
        priority: defaultRule.priority,
        isDefault: true,
        matched: true,
      });

      this.logEvaluation(logs, defaultRule);
      return defaultRule;
    }

    // No match at all
    this.logEvaluation(logs, null);
    return null;
  }

  /**
   * Logs the evaluation results for debugging and auditing.
   */
  private logEvaluation(
    logs: RuleEvaluationLog[],
    matchedRule: Rule | null,
  ): void {
    const summary = logs
      .map(
        (l) =>
          `[${l.matched ? '✓' : '✗'}] Rule ${l.ruleId} (pri=${l.priority}${l.isDefault ? ', DEFAULT' : ''}): "${l.condition}"`,
      )
      .join('\n  ');

    if (matchedRule) {
      this.logger.log(
        `Rule evaluation complete. Matched: ${matchedRule.id} → nextStep: ${matchedRule.nextStepId}\n  ${summary}`,
      );
    } else {
      this.logger.warn(
        `Rule evaluation complete. No rule matched.\n  ${summary}`,
      );
    }
  }
}
