import { IsObject, IsUUID } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class CreateExecutionDto {
  @ApiProperty({ example: 'uuid-string' })
  @IsUUID()
  workflowId: string;

  @ApiProperty({ example: { userId: 123, email: 'user@example.com' } })
  @IsObject()
  context: Record<string, any>;
}
