import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { StepsService } from './steps.service';
import { CreateStepDto, UpdateStepDto } from './dto/steps.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('steps')
@Controller('steps')
export class StepsController {
  constructor(private readonly stepsService: StepsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new step in a workflow' })
  @ApiResponse({ status: 201, description: 'Step created successfully' })
  @ApiResponse({ status: 404, description: 'Workflow not found' })
  @ApiResponse({ status: 409, description: 'Step order conflict' })
  create(@Body() createStepDto: CreateStepDto) {
    return this.stepsService.create(createStepDto);
  }

  @Get('workflow/:workflowId')
  @ApiOperation({ summary: 'Get all steps for a workflow (ordered)' })
  @ApiResponse({ status: 200, description: 'List of steps' })
  findAllByWorkflow(@Param('workflowId') workflowId: string) {
    return this.stepsService.findAllByWorkflow(workflowId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a step by id' })
  @ApiResponse({ status: 200, description: 'Step found' })
  @ApiResponse({ status: 404, description: 'Step not found' })
  findOne(@Param('id') id: string) {
    return this.stepsService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a step' })
  @ApiResponse({ status: 200, description: 'Step updated' })
  @ApiResponse({ status: 404, description: 'Step not found' })
  update(@Param('id') id: string, @Body() updateStepDto: UpdateStepDto) {
    return this.stepsService.update(id, updateStepDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a step' })
  @ApiResponse({ status: 200, description: 'Step deleted' })
  @ApiResponse({ status: 404, description: 'Step not found' })
  remove(@Param('id') id: string) {
    return this.stepsService.remove(id);
  }
}
