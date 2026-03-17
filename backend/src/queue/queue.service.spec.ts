import { Test, TestingModule } from '@nestjs/testing';
import { QueueService } from './queue.service';
import { getQueueToken } from '@nestjs/bullmq';
import { Job } from 'bullmq';

describe('QueueService', () => {
  let service: QueueService;
  let mockQueue: any;

  beforeEach(async () => {
    mockQueue = {
      add: jest.fn().mockResolvedValue({ id: 'job-123' } as any),
      getJob: jest.fn(),
      getJobs: jest.fn().mockResolvedValue([]),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        QueueService,
        {
          provide: getQueueToken('workflow_queue'),
          useValue: mockQueue,
        },
      ],
    }).compile();

    service = module.get<QueueService>(QueueService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('enqueueStep', () => {
    it('should add a step execution job to the queue', async () => {
      const executionId = 'exec-1';
      const stepId = 'step-1';
      const context = { userId: 123 };

      const result = await service.enqueueStep(executionId, stepId, context);
      
      expect(mockQueue.add).toHaveBeenCalledWith(
        'execute-step',
        { executionId, stepId, context },
        expect.objectContaining({
          attempts: 3,
          backoff: { type: 'exponential', delay: 1000 },
          removeOnComplete: true,
        }),
      );
      expect(result).toBeDefined();
      expect(result.id).toBe('job-123');
    });

    it('allows overriding retry options', async () => {
      await service.enqueueStep('exec-1', 'step-1', {}, { attempts: 5, delay: 5000 });
      expect(mockQueue.add).toHaveBeenCalledWith(
        'execute-step',
        expect.any(Object),
        expect.objectContaining({ attempts: 5, delay: 5000 }),
      );
    });
  });

  describe('cancelWorkflowExecution', () => {
    it('cancels pending jobs for an execution by checking active/waiting jobs', async () => {
      const mockJobs = [
        { id: '1', data: { executionId: 'exec-cancel' }, remove: jest.fn() },
        { id: '2', data: { executionId: 'other-exec' }, remove: jest.fn() },
      ];
      mockQueue.getJobs.mockResolvedValue(mockJobs);

      await service.cancelWorkflowExecution('exec-cancel');
      
      expect(mockQueue.getJobs).toHaveBeenCalledWith(['waiting', 'delayed']);
      expect(mockJobs[0].remove).toHaveBeenCalled();
      expect(mockJobs[1].remove).not.toHaveBeenCalled();
    });
  });
});
