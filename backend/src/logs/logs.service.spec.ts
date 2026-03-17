import { Test, TestingModule } from '@nestjs/testing';
import { LogsService } from './logs.service';
import { PrismaService } from '../prisma/prisma.service';

describe('LogsService', () => {
  let service: LogsService;
  let prisma: any;

  beforeEach(async () => {
    prisma = {
      executionLog: {
        create: jest.fn(),
        findMany: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        LogsService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
      ],
    }).compile();

    service = module.get<LogsService>(LogsService);
  });

  describe('create', () => {
    it('creates an execution log', async () => {
      const dto = {
        executionId: 'exec-1',
        stepId: 'step-1',
        stepName: 'Manager Approval',
        stepType: 'approval',
        status: 'completed',
        evaluatedRules: [],
        selectedNextStep: 'step-2',
        errorMessage: undefined,
      };
      prisma.executionLog.create.mockResolvedValue({ id: 'log-1', ...dto });

      const result = await service.create(dto);
      expect(prisma.executionLog.create).toHaveBeenCalledWith({
        data: {
          executionId: 'exec-1',
          stepId: 'step-1',
          stepName: 'Manager Approval',
          status: 'completed',
          evaluatedRules: [],
          selectedNextStep: 'step-2',
          errorMessage: undefined,
          endedAt: expect.any(Date),
        },
      });
      expect(result.id).toBe('log-1');
    });
  });

  describe('findAllByExecution', () => {
    it('returns logs for an execution ordered by creation', async () => {
      prisma.executionLog.findMany.mockResolvedValue([{ id: 'log-1' }]);
      await service.findAllByExecution('exec-1');
      expect(prisma.executionLog.findMany).toHaveBeenCalledWith({
        where: { executionId: 'exec-1' },
        orderBy: { startedAt: 'asc' },
      });
    });
  });
});
