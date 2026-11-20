import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** ACC-15 / ACC-16: optional reason, stored in the audit log (GEN-07). */
export class SuspendAccountDto {
  @ApiPropertyOptional({ example: 'Abusive content in blog comments' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
