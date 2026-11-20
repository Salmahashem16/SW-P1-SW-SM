import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsMongoId, IsOptional } from 'class-validator';

import { AUDIT_ACTIONS } from '../../audit-logs/schemas/audit-log.schema';
import type { AuditAction } from '../../audit-logs/schemas/audit-log.schema';
import { PaginationQueryDto } from '../../common/pagination-query.dto';

/** GEN-07 */
export class ListAuditLogsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: AUDIT_ACTIONS })
  @IsOptional()
  @IsIn([...AUDIT_ACTIONS])
  action?: AuditAction;

  @ApiPropertyOptional({ description: 'Only actions by this admin' })
  @IsOptional()
  @IsMongoId()
  actorId?: string;
}
