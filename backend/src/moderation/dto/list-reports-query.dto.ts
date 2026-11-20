import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional } from 'class-validator';

import { PaginationQueryDto } from '../../common/pagination-query.dto';
import { REPORTABLE_TYPES } from '../moderation.constants';
import type { ReportableType } from '../moderation.constants';
import { REPORT_STATUSES } from '../schemas/report.schema';
import type { ReportStatus } from '../schemas/report.schema';

/** GEN-10 */
export class ListReportsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: REPORT_STATUSES, default: 'open' })
  @IsOptional()
  @IsIn([...REPORT_STATUSES])
  status?: ReportStatus = 'open';

  @ApiPropertyOptional({ enum: REPORTABLE_TYPES })
  @IsOptional()
  @IsIn([...REPORTABLE_TYPES])
  targetType?: ReportableType;
}
