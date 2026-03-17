import {
  IsString,
  IsOptional,
  IsBoolean,
  IsUUID,
  IsInt,
  Min,
  IsNotEmpty,
} from 'class-validator';
import { PartialType, OmitType } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Create ─────────────────────────────────────────────

export class CreateRuleDto {
  @ApiProperty({ example: 'uuid-step-id' })
  @IsUUID()
  stepId: string;

  @ApiProperty({ example: 'data.status == "SUCCESS"' })
  @IsString()
  @IsNotEmpty({ message: 'condition must not be empty' })
  condition: string;

  @ApiPropertyOptional({ example: 'uuid-next-step-id' })
  @IsUUID()
  @IsOptional()
  nextStepId?: string;

  @ApiPropertyOptional({ example: 10, default: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  priority?: number;

  @ApiPropertyOptional({ example: false, default: false })
  @IsBoolean()
  @IsOptional()
  isDefault?: boolean;
}

// ─── Update (stepId is not updatable) ───────────────────

export class UpdateRuleDto extends PartialType(
  OmitType(CreateRuleDto, ['stepId'] as const),
) {}
