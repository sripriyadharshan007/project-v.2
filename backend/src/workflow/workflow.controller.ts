import { Controller, Get, Post, Body, Patch, Param, Delete, Query } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { CreateWorkflowDto, UpdateWorkflowDto, PaginationQueryDto } from './dto/workflow.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('workflows')
@Controller('workflow')
export class WorkflowController {
  constructor(private readonly workflowService: WorkflowService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new workflow schema' })
  @ApiResponse({ status: 201, description: 'Workflow created successfully' })
  create(@Body() createWorkflowDto: CreateWorkflowDto) {
    return this.workflowService.create(createWorkflowDto);
  }

  @Get()
  @ApiOperation({ summary: 'Get all workflows with pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of workflows' })
  findAll(@Query() query: PaginationQueryDto) {
    return this.workflowService.findAll(query.page, query.limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific workflow by id' })
  @ApiResponse({ status: 200, description: 'Workflow found' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  findOne(@Param('id') id: string) {
    return this.workflowService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a workflow (auto-increments version)' })
  @ApiResponse({ status: 200, description: 'Workflow updated' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  update(@Param('id') id: string, @Body() updateWorkflowDto: UpdateWorkflowDto) {
    return this.workflowService.update(id, updateWorkflowDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a workflow' })
  @ApiResponse({ status: 200, description: 'Workflow deleted' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  remove(@Param('id') id: string) {
    return this.workflowService.remove(id);
  }
}
