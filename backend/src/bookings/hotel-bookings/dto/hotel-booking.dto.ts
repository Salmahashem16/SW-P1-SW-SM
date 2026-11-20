import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  Equals,
  IsArray,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

import { PaginationQueryDto } from '../../../common/pagination-query.dto';
import { BOOKING_GROUPS, MAX_CHILD_AGE } from '../hotel-booking.rules';
import type { BookingGroup } from '../hotel-booking.rules';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MESSAGE = 'must be a date in YYYY-MM-DD format';

/** One room and the guests staying in it (HTL-16). */
export class BookingRoomDto {
  @ApiProperty({ example: '665f1c2e9b1d8a0012345678' })
  @IsMongoId()
  roomId!: string;

  @ApiProperty({ example: 2, minimum: 0 })
  @IsInt()
  @Min(0)
  @Max(20)
  adults!: number;

  @ApiPropertyOptional({
    example: [7],
    description: `Ages of children in this room (0-${MAX_CHILD_AGE})`,
    type: [Number],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsInt({ each: true })
  @Min(0, { each: true })
  @Max(MAX_CHILD_AGE, { each: true })
  children?: number[];
}

/**
 * HTL-16 + HTL-18: proceeding to payment creates a Pending Payment
 * reservation that holds every selected room for 10 minutes.
 */
export class CreateHotelBookingDto {
  @ApiProperty({ example: '665f1c2e9b1d8a0012345670' })
  @IsMongoId()
  hotelId!: string;

  @ApiProperty({ example: '2026-12-01' })
  @Matches(DAY, { message: `checkIn ${DAY_MESSAGE}` })
  checkIn!: string;

  @ApiProperty({ example: '2026-12-04' })
  @Matches(DAY, { message: `checkOut ${DAY_MESSAGE}` })
  checkOut!: string;

  @ApiProperty({ type: [BookingRoomDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(10)
  @ValidateNested({ each: true })
  @Type(() => BookingRoomDto)
  rooms!: BookingRoomDto[];
}

/** PAY-02: the user ticks the policy checkbox. */
export class AcceptPoliciesDto {
  @ApiProperty({ example: true, description: 'Must be true' })
  @Equals(true, { message: 'You must accept the policies to continue' })
  accepted!: boolean;
}

/** HTL-20 */
export class ListMyHotelBookingsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: BOOKING_GROUPS, description: 'Leave out for all' })
  @IsOptional()
  @IsIn([...BOOKING_GROUPS])
  group?: BookingGroup;
}

/**
 * Development only: stands in for the payment service's verified-payment
 * callback so the flow can be shown in Swagger before PAY-01 exists.
 */
export class TestConfirmPaymentDto {
  @ApiPropertyOptional({ example: 'pi_test_123' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  paymentId?: string;
}
