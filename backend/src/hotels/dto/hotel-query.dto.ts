import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

import { BOOKING_STATUSES } from '../../bookings/booking-status';
import type { BookingStatus } from '../../bookings/booking-status';
import { PaginationQueryDto } from '../../common/pagination-query.dto';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MESSAGE = 'must be a date in YYYY-MM-DD format';

/** HTL-15 and the optional dates on HTL-02. */
export class StayQueryDto {
  @ApiProperty({ example: '2026-12-20' })
  @Matches(DAY, { message: `checkIn ${DAY_MESSAGE}` })
  checkIn!: string;

  @ApiProperty({ example: '2026-12-23' })
  @Matches(DAY, { message: `checkOut ${DAY_MESSAGE}` })
  checkOut!: string;
}

export class OptionalStayQueryDto {
  @ApiPropertyOptional({ example: '2026-12-20', description: 'With checkOut, lists free rooms' })
  @IsOptional()
  @Matches(DAY, { message: `checkIn ${DAY_MESSAGE}` })
  checkIn?: string;

  @ApiPropertyOptional({ example: '2026-12-23' })
  @ValidateIf((o: OptionalStayQueryDto) => o.checkIn !== undefined || o.checkOut !== undefined)
  @Matches(DAY, { message: `checkOut ${DAY_MESSAGE}` })
  checkOut?: string;
}

export const HOTEL_SORT_FIELDS = ['price', 'rating'] as const;
export const SORT_ORDERS = ['asc', 'desc'] as const;

/** HTL-11 search + HTL-12 filters and sorting. */
export class SearchHotelsDto extends PaginationQueryDto {
  @ApiPropertyOptional({ example: 'Cairo', description: 'City or country is required' })
  @ValidateIf((o: SearchHotelsDto) => !o.country)
  @IsString()
  @MaxLength(100)
  city?: string;

  @ApiPropertyOptional({ example: 'Egypt' })
  @ValidateIf((o: SearchHotelsDto) => !o.city)
  @IsString()
  @MaxLength(100)
  country?: string;

  @ApiProperty({ example: '2026-12-20' })
  @Matches(DAY, { message: `checkIn ${DAY_MESSAGE}` })
  checkIn!: string;

  @ApiProperty({ example: '2026-12-23' })
  @Matches(DAY, { message: `checkOut ${DAY_MESSAGE}` })
  checkOut!: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(50)
  guests!: number;

  @ApiPropertyOptional({ example: 1, default: 1, minimum: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(20)
  rooms?: number = 1;

  @ApiPropertyOptional({ example: 50, description: 'Inclusive, per night (cheapest qualifying room)' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({ example: 300 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({ example: 4, description: '1-5; unrated hotels are excluded when set' })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(1)
  @Max(5)
  minRating?: number;

  @ApiPropertyOptional({ enum: HOTEL_SORT_FIELDS, default: 'price' })
  @IsOptional()
  @IsIn([...HOTEL_SORT_FIELDS])
  sortBy?: (typeof HOTEL_SORT_FIELDS)[number] = 'price';

  @ApiPropertyOptional({ enum: SORT_ORDERS, default: 'asc' })
  @IsOptional()
  @IsIn([...SORT_ORDERS])
  order?: (typeof SORT_ORDERS)[number] = 'asc';
}

/** HTL-08: room status calendar. `to` is exclusive, max 62 nights. */
export class AvailabilityCalendarQueryDto {
  @ApiProperty({ example: '2026-12-01' })
  @Matches(DAY, { message: `from ${DAY_MESSAGE}` })
  from!: string;

  @ApiProperty({ example: '2026-12-15', description: 'Exclusive' })
  @Matches(DAY, { message: `to ${DAY_MESSAGE}` })
  to!: string;
}

/** HTL-22 */
export class ListReservationsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: BOOKING_STATUSES })
  @IsOptional()
  @IsIn([...BOOKING_STATUSES])
  status?: BookingStatus;

  @ApiPropertyOptional({ example: '2026-12-01', description: 'Stays ending after this day' })
  @IsOptional()
  @Matches(DAY, { message: `from ${DAY_MESSAGE}` })
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-31', description: 'Stays starting before this day' })
  @IsOptional()
  @Matches(DAY, { message: `to ${DAY_MESSAGE}` })
  to?: string;
}
