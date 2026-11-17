import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

import { PaginationQueryDto } from '../../common/pagination-query.dto';
import { USER_ROLES, USER_STATUSES } from '../../users/schemas/user.schema';
import type { UserRole, UserStatus } from '../../users/schemas/user.schema';

/** ACC-14: search by name or email, filter by role and status. */
export class ListAccountsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ description: 'Matches name or email' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;

  @ApiPropertyOptional({ enum: USER_ROLES })
  @IsOptional()
  @IsIn([...USER_ROLES])
  role?: UserRole;

  @ApiPropertyOptional({ enum: USER_STATUSES })
  @IsOptional()
  @IsIn([...USER_STATUSES])
  status?: UserStatus;
}
