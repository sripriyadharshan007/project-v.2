import {
  IsString,
  IsOptional,
  IsObject,
  IsUUID,
  IsInt,
  IsEnum,
  Min,
} from 'class-validator';
import { PartialType, OmitType } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StepType } from '@prisma/client';

// ─── Create ─────────────────────────────────────────────

export class CreateStepDto {
  @ApiProperty({ example: 'uuid-workflow-id' })
  @IsUUID()
  workflowId: string;

  @ApiProperty({ example: 'Send Email' })
  @IsString()
  name: string;

  @ApiProperty({ enum: StepType, example: 'TASK' })
  @IsEnum(StepType, {
    message: `stepType must be one of: ${Object.values(StepType).join(', ')}`,
  })
  stepType: StepType;

  @ApiPropertyOptional({ example: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  order?: number;

  @ApiPropertyOptional({ example: { endpoint: '/send', method: 'POST' } })
  @IsObject()
  @IsOptional()
  metadata?: Record<string, any> | null;
}

// ─── Update (workflowId is not updatable) ───────────────

export class UpdateStepDto extends PartialType(
  OmitType(CreateStepDto, ['workflowId'] as const),
) {}
