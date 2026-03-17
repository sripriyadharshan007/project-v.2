import { StepType } from '@prisma/client';

/**
 * Step entity mirroring the Prisma Step model.
 * Steps belong to a Workflow and are ordered within it.
 */
export class StepEntity {
  id: string;
  workflowId: string;
  name: string;
  stepType: StepType;
  order: number;
  metadata: Record<string, any> | null;
  createdAt: Date;
  updatedAt: Date;
}
