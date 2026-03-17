import { IsString, IsOptional, IsUUID, IsArray } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateLogDto {
  @ApiProperty({ example: 'uuid-execution' })
  @IsUUID()
  executionId: string;

  @ApiProperty({ example: 'uuid-step' })
  @IsUUID()
  stepId: string;

  @ApiProperty({ example: 'Manager Approval' })
  @IsString()
  stepName: string;

  @ApiProperty({ example: 'approval' })
  @IsString()
  stepType: string;

  @ApiProperty({ example: [{ rule: 'amount > 100', result: true }] })
  @IsArray()
  @IsOptional()
  evaluatedRules?: any[] | null;

  @ApiProperty({ example: 'Finance Notification', required: false })
  @IsString()
  @IsOptional()
  selectedNextStep?: string | null;

  @ApiProperty({ example: 'completed' })
  @IsString()
  status: string;

  @ApiProperty({ example: 'Optional error trace', required: false })
  @IsString()
  @IsOptional()
  errorMessage?: string;
}
