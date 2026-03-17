import {
  Injectable,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { WorkflowRepository } from './workflow.repository';
import { CreateWorkflowDto, UpdateWorkflowDto, PaginatedResultDto } from './dto/workflow.dto';

@Injectable()
export class WorkflowService {
  constructor(private readonly repository: WorkflowRepository) {}

  /**
   * Validates that inputSchema is a plain object or null/undefined.
   * Rejects strings, numbers, arrays, and other non-object types.
   */
  private validateInputSchema(inputSchema: any): void {
    if (inputSchema === undefined || inputSchema === null) {
      return;
    }
    if (
      typeof inputSchema !== 'object' ||
      Array.isArray(inputSchema)
    ) {
      throw new BadRequestException(
        'inputSchema must be a valid JSON object or null',
      );
    }
  }

  async create(createWorkflowDto: CreateWorkflowDto) {
    this.validateInputSchema(createWorkflowDto.inputSchema);

    return this.repository.create({
      name: createWorkflowDto.name,
      ...(createWorkflowDto.isActive !== undefined && {
        isActive: createWorkflowDto.isActive,
      }),
      ...(createWorkflowDto.inputSchema !== undefined && {
        inputSchema: createWorkflowDto.inputSchema,
      }),
    });
  }

  async findAll(page: number = 1, limit: number = 10) {
    const skip = (page - 1) * limit;

    const [data, total] = await Promise.all([
      this.repository.findAll(skip, limit),
      this.repository.count(),
    ]);

    return new PaginatedResultDto(data, total, page, limit);
  }

  async findOne(id: string) {
    const workflow = await this.repository.findById(id);

    if (!workflow) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    return workflow;
  }

  async update(id: string, updateWorkflowDto: UpdateWorkflowDto) {
    this.validateInputSchema(updateWorkflowDto.inputSchema);

    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    const { inputSchema, isActive, name } = updateWorkflowDto;

    return this.repository.update(id, {
      ...(name !== undefined && { name }),
      ...(isActive !== undefined && { isActive }),
      ...(inputSchema !== undefined && { inputSchema }),
      version: { increment: 1 },
    });
  }

  async remove(id: string) {
    const existing = await this.repository.findById(id);
    if (!existing) {
      throw new NotFoundException(`Workflow with ID ${id} not found`);
    }

    return this.repository.delete(id);
  }
}
