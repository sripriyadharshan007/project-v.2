import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateLogDto } from './dto/create-log.dto';

@Injectable()
export class LogsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createLogDto: CreateLogDto) {
    return this.prisma.executionLog.create({
      data: {
        executionId: createLogDto.executionId,
        stepId: createLogDto.stepId,
        stepName: createLogDto.stepName,
        status: createLogDto.status,
        evaluatedRules: createLogDto.evaluatedRules,
        selectedNextStep: createLogDto.selectedNextStep,
        errorMessage: createLogDto.errorMessage,
        endedAt: new Date(),
      },
    });
  }

  async findAllByExecution(executionId: string) {
    return this.prisma.executionLog.findMany({
      where: { executionId },
      orderBy: { startedAt: 'asc' },
    });
  }
}
