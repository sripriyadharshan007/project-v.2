import { Controller, Get, Param } from '@nestjs/common';
import { LogsService } from './logs.service';
import { ApiTags, ApiOperation } from '@nestjs/swagger';

@ApiTags('logs')
@Controller('logs')
export class LogsController {
  constructor(private readonly logsService: LogsService) {}

  @Get('execution/:executionId')
  @ApiOperation({ summary: 'Get all logs for an execution' })
  findAllByExecution(@Param('executionId') executionId: string) {
    return this.logsService.findAllByExecution(executionId);
  }
}
