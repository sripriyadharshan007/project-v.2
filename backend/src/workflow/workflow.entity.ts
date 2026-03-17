/**
 * Workflow entity mirroring the Prisma Workflow model.
 * Used as the return type across the service and repository layers.
 */
export class WorkflowEntity {
  id: string;
  name: string;
  version: number;
  isActive: boolean;
  inputSchema: Record<string, any> | null;
  startStepId: string | null;
  createdAt: Date;
  updatedAt: Date;
}
