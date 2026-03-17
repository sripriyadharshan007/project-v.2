/**
 * Rule entity mirroring the Prisma Rule model.
 * Rules belong to Steps and define conditional branching logic.
 */
export class RuleEntity {
  id: string;
  stepId: string;
  condition: string;
  nextStepId: string | null;
  priority: number;
  isDefault: boolean;
  createdAt: Date;
  updatedAt: Date;
}
