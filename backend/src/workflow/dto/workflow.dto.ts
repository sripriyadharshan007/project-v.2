import {
  IsString,
  IsOptional,
  IsBoolean,
  IsObject,
  IsInt,
  Min,
  Max,
} from 'class-validator';
import { PartialType } from '@nestjs/swagger';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

// ─── Create ─────────────────────────────────────────────

export class CreateWorkflowDto {
  @ApiProperty({ example: 'Onboarding Workflow' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ example: true })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;

  @ApiPropertyOptional({
    example: { type: 'object', properties: { email: { type: 'string' } } },
    description: 'JSON Schema describing the expected workflow input. Must be an object or null.',
  })
  @IsObject()
  @IsOptional()
  inputSchema?: Record<string, any> | null;
}

// ─── Update ─────────────────────────────────────────────

export class UpdateWorkflowDto extends PartialType(CreateWorkflowDto) {}

// ─── Pagination ─────────────────────────────────────────

export class PaginationQueryDto {
  @ApiPropertyOptional({ example: 1, default: 1 })
  @IsInt()
  @Min(1)
  @IsOptional()
  @Type(() => Number)
  page?: number = 1;

  @ApiPropertyOptional({ example: 10, default: 10 })
  @IsInt()
  @Min(1)
  @Max(100)
  @IsOptional()
  @Type(() => Number)
  limit?: number = 10;
}

export class PaginatedResultDto<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;

  constructor(data: T[], total: number, page: number, limit: number) {
    this.data = data;
    this.total = total;
    this.page = page;
    this.limit = limit;
    this.totalPages = Math.ceil(total / limit);
  }
}
