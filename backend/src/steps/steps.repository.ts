import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class StepsRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.StepUncheckedCreateInput) {
    return this.prisma.step.create({ data });
  }

  async findAllByWorkflow(workflowId: string) {
    return this.prisma.step.findMany({
      where: { workflowId },
      include: { rules: true },
      orderBy: { order: 'asc' },
    });
  }

  async findById(id: string) {
    return this.prisma.step.findUnique({
      where: { id },
      include: { rules: true },
    });
  }

  async update(id: string, data: Prisma.StepUpdateInput) {
    return this.prisma.step.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.step.delete({
      where: { id },
    });
  }

  async findByWorkflowAndOrder(workflowId: string, order: number) {
    return this.prisma.step.findFirst({
      where: { workflowId, order },
    });
  }

  async getMaxOrder(workflowId: string): Promise<number> {
    const result = await this.prisma.step.aggregate({
      where: { workflowId },
      _max: { order: true },
    });
    return result._max.order ?? -1;
  }

  async workflowExists(workflowId: string): Promise<boolean> {
    const workflow = await this.prisma.workflow.findUnique({
      where: { id: workflowId },
      select: { id: true },
    });
    return !!workflow;
  }

  async updateWorkflowStartStep(workflowId: string, stepId: string) {
    return this.prisma.workflow.update({
      where: { id: workflowId },
      data: { startStepId: stepId },
    });
  }
}
