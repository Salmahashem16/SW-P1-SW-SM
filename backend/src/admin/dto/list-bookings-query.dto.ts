import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsIn, IsOptional } from 'class-validator';

import { BOOKING_STATUSES, BOOKING_TYPES } from '../../bookings/booking-status';
import type {
  BookingStatus,
  BookingType,
} from '../../bookings/booking-status';
import { PaginationQueryDto } from '../../common/pagination-query.dto';

/** ACC-17 */
export class ListBookingsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: BOOKING_TYPES })
  @IsOptional()
  @IsIn([...BOOKING_TYPES])
  type?: BookingType;

  @ApiPropertyOptional({ enum: BOOKING_STATUSES })
  @IsOptional()
  @IsIn([...BOOKING_STATUSES])
  status?: BookingStatus;

  @ApiPropertyOptional({
    description:
      'Travel date from (flight departure / hotel check-in), inclusive. YYYY-MM-DD or ISO date-time.',
    example: '2026-12-01',
  })
  @IsOptional()
  @IsDateString()
  from?: string;

  @ApiPropertyOptional({
    description:
      'Travel date to, inclusive (a plain date includes the whole day). YYYY-MM-DD or ISO date-time.',
    example: '2026-12-31',
  })
  @IsOptional()
  @IsDateString()
  to?: string;
}
