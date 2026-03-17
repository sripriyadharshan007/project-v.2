import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class RulesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.RuleUncheckedCreateInput) {
    return this.prisma.rule.create({ data });
  }

  async findAllByStep(stepId: string) {
    return this.prisma.rule.findMany({
      where: { stepId },
      orderBy: { priority: 'desc' },
    });
  }

  async findById(id: string) {
    return this.prisma.rule.findUnique({
      where: { id },
    });
  }

  async update(id: string, data: Prisma.RuleUpdateInput) {
    return this.prisma.rule.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.rule.delete({
      where: { id },
    });
  }

  async stepExists(stepId: string): Promise<boolean> {
    const step = await this.prisma.step.findUnique({
      where: { id: stepId },
      select: { id: true },
    });
    return !!step;
  }

  async findDefaultByStep(stepId: string) {
    return this.prisma.rule.findFirst({
      where: { stepId, isDefault: true },
    });
  }

  async countByStep(stepId: string): Promise<number> {
    return this.prisma.rule.count({ where: { stepId } });
  }
}
