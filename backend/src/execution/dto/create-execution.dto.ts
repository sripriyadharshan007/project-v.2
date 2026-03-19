import { IsEnum, IsObject, IsOptional, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { Role } from '@prisma/client';

export class CreateExecutionDto {
  @ApiProperty({ example: 'uuid-string' })
  @IsUUID()
  workflowId: string;

  @ApiProperty({ example: { userId: 123, email: 'user@example.com' } })
  @IsObject()
  context: Record<string, any>;

  @ApiProperty({ enum: Role, required: false, example: 'EMPLOYEE' })
  @IsEnum(Role, {
    message: `actorRole must be one of: ${Object.values(Role).join(', ')}`,
  })
  @IsOptional()
  actorRole?: Role;
}
