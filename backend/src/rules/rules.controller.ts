import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { RulesService } from './rules.service';
import { CreateRuleDto, UpdateRuleDto } from './dto/rules.dto';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';

@ApiTags('rules')
@Controller('rules')
export class RulesController {
  constructor(private readonly rulesService: RulesService) {}

  @Post()
  @ApiOperation({ summary: 'Create a new rule for a step' })
  @ApiResponse({ status: 201, description: 'Rule created successfully' })
  @ApiResponse({ status: 404, description: 'Step not found' })
  @ApiResponse({ status: 409, description: 'Duplicate default rule' })
  create(@Body() createRuleDto: CreateRuleDto) {
    return this.rulesService.create(createRuleDto);
  }

  @Get('step/:stepId')
  @ApiOperation({ summary: 'Get all rules for a step (sorted by priority desc)' })
  @ApiResponse({ status: 200, description: 'List of rules' })
  findAllByStep(@Param('stepId') stepId: string) {
    return this.rulesService.findAllByStep(stepId);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a rule by id' })
  @ApiResponse({ status: 200, description: 'Rule found' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  findOne(@Param('id') id: string) {
    return this.rulesService.findOne(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update a rule' })
  @ApiResponse({ status: 200, description: 'Rule updated' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  update(@Param('id') id: string, @Body() updateRuleDto: UpdateRuleDto) {
    return this.rulesService.update(id, updateRuleDto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a rule' })
  @ApiResponse({ status: 200, description: 'Rule deleted' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  remove(@Param('id') id: string) {
    return this.rulesService.remove(id);
  }
}
