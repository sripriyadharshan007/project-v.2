import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class WorkflowRepository {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: Prisma.WorkflowCreateInput) {
    return this.prisma.workflow.create({ data });
  }

  async findAll(skip: number, take: number) {
    return this.prisma.workflow.findMany({
      skip,
      take,
      include: { steps: true },
      orderBy: { createdAt: 'desc' },
    });
  }

  async count(filter?: Prisma.WorkflowWhereInput) {
    return this.prisma.workflow.count({ where: filter });
  }

  async findById(id: string) {
    return this.prisma.workflow.findUnique({
      where: { id },
      include: {
        steps: {
          include: { rules: true },
          orderBy: { order: 'asc' },
        },
      },
    });
  }

  async update(id: string, data: Prisma.WorkflowUpdateInput) {
    return this.prisma.workflow.update({
      where: { id },
      data,
    });
  }

  async delete(id: string) {
    return this.prisma.workflow.delete({
      where: { id },
    });
  }
}
