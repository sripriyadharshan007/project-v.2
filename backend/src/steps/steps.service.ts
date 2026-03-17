import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { StepsRepository } from './steps.repository';
import { CreateStepDto, UpdateStepDto } from './dto/steps.dto';
import { StepType } from '@prisma/client';

const VALID_STEP_TYPES = Object.values(StepType);

@Injectable()
export class StepsService {
  constructor(private readonly repository: StepsRepository) {}

  /**
   * Validates that the stepType is a valid enum value.
   */
  private validateStepType(stepType: string): void {
    if (!VALID_STEP_TYPES.includes(stepType as StepType)) {
      throw new BadRequestException(
        `stepType must be one of: ${VALID_STEP_TYPES.join(', ')}`,
      );
    }
  }

  async create(createStepDto: CreateStepDto) {
    this.validateStepType(createStepDto.stepType);

    // Verify parent workflow exists
    const exists = await this.repository.workflowExists(createStepDto.workflowId);
    if (!exists) {
      throw new NotFoundException(
        `Workflow with ID ${createStepDto.workflowId} not found`,
      );
    }

    let order: number;

    if (createStepDto.order !== undefined) {
      // Explicit order: check for conflicts
      const conflict = await this.repository.findByWorkflowAndOrder(
        createStepDto.workflowId,
        createStepDto.order,
      );
      if (conflict) {
        throw new ConflictException(
          `Step with order ${createStepDto.order} already exists in workflow ${createStepDto.workflowId}`,
        );
      }
      order = createStepDto.order;
    } else {
      // Auto-assign next order
      const maxOrder = await this.repository.getMaxOrder(createStepDto.workflowId);
      order = maxOrder + 1;
    }

    const step = await this.repository.create({
      workflowId: createStepDto.workflowId,
      name: createStepDto.name,
      stepType: createStepDto.stepType,
      order,
      ...(createStepDto.metadata !== undefined && {
        metadata: createStepDto.metadata,
      }),
    });

    // If this is the very first step, make it the workflow's start step
    if (order === 1) {
      await this.repository.updateWorkflowStartStep(createStepDto.workflowId, step.id);
    }

    return step;
  }

  async findAllByWorkflow(workflowId: string) {
    return this.repository.findAllByWorkflow(workflowId);
  }

  async findOne(id: string) {
    const step = await this.repository.findById(id);
    if (!step) {
      throw new NotFoundException(`Step with ID ${id} not found`);
    }
    return step;
  }

  async update(id: string, updateStepDto: UpdateStepDto) {
    if (updateStepDto.stepType) {
      this.validateStepType(updateStepDto.stepType);
    }

    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Step with ID ${id} not found`);
    }

    const { name, stepType, order, metadata } = updateStepDto;

    return this.repository.update(id, {
      ...(name !== undefined && { name }),
      ...(stepType !== undefined && { stepType }),
      ...(order !== undefined && { order }),
      ...(metadata !== undefined && { metadata }),
    });
  }

  async remove(id: string) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Step with ID ${id} not found`);
    }

    return this.repository.delete(id);
  }
}
