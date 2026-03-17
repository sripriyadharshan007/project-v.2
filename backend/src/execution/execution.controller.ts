import { Controller, Post, Body, Get, Param, Patch } from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { CreateExecutionDto } from './dto/create-execution.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('executions')
@Controller('executions')
export class ExecutionController {
  constructor(private readonly executionService: ExecutionService) {}

  @Post('start')
  @ApiOperation({ summary: 'Start a new workflow execution' })
  @ApiResponse({ status: 201, description: 'Execution started' })
  @ApiResponse({ status: 404, description: 'Workflow or start step not found' })
  @ApiResponse({ status: 400, description: 'Invalid input context' })
  startExecution(@Body() createExecutionDto: CreateExecutionDto) {
    return this.executionService.startExecution(createExecutionDto);
  }

  @Patch(':id/cancel')
  @ApiOperation({ summary: 'Cancel an ongoing workflow execution' })
  @ApiResponse({ status: 200, description: 'Execution cancelled' })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  cancelExecution(@Param('id') id: string) {
    return this.executionService.cancelExecution(id);
  }

  @Post(':id/retry/:stepId')
  @ApiOperation({ summary: 'Retry a failed step in an execution' })
  @ApiResponse({ status: 200, description: 'Step retried' })
  @ApiResponse({ status: 400, description: 'Execution not in FAILED state' })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  retryStep(@Param('id') id: string, @Param('stepId') stepId: string) {
    return this.executionService.retryStep(id, stepId);
  }

  @Get()
  @ApiOperation({ summary: 'Get all executions' })
  @ApiResponse({ status: 200, description: 'List of executions' })
  findAll() {
    return this.executionService.findAll();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a specific execution by ID' })
  @ApiResponse({ status: 200, description: 'Execution found' })
  @ApiResponse({ status: 404, description: 'Execution not found' })
  findOne(@Param('id') id: string) {
    return this.executionService.findOne(id);
  }
}
