import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsMongoId,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
  ValidateIf,
} from 'class-validator';

const DAY = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MESSAGE = 'must be a date in YYYY-MM-DD format';

/** HTL-03 */
export class CreateRoomDto {
  @ApiProperty({ example: '101', description: 'Room number/name, unique within the hotel' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  name!: string;

  @ApiProperty({ example: 'Double' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  type!: string;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  beds!: number;

  @ApiProperty({ example: 2, minimum: 1 })
  @IsInt()
  @Min(1)
  maxOccupancy!: number;

  @ApiProperty({ example: 120, description: 'Price per night (> 0)' })
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  pricePerNight!: number;
}

/** HTL-05 (beds, occupancy, price) and HTL-06 (deactivate). */
export class UpdateRoomDto {
  @ApiPropertyOptional({ example: 'Deluxe Double' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(50)
  type?: string;

  @ApiPropertyOptional({ example: 2, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  beds?: number;

  @ApiPropertyOptional({ example: 3, minimum: 1 })
  @IsOptional()
  @IsInt()
  @Min(1)
  maxOccupancy?: number;

  @ApiPropertyOptional({
    example: 140,
    description: 'Existing reservations keep the price they were booked at',
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  pricePerNight?: number;

  @ApiPropertyOptional({
    example: false,
    description: 'false deactivates the room (rejected if it has active reservations)',
  })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;
}

/** HTL-04: a night range. `to` is exclusive, like a check-out date. */
export class RoomDateRangeDto {
  @ApiProperty({ example: '2026-12-01' })
  @Matches(DAY, { message: `from ${DAY_MESSAGE}` })
  from!: string;

  @ApiProperty({ example: '2027-03-01', description: 'Exclusive (first night not included)' })
  @Matches(DAY, { message: `to ${DAY_MESSAGE}` })
  to!: string;
}

export const AVAILABILITY_ACTIONS = [
  'updateRange',
  'removeRange',
  'block',
  'unblock',
] as const;
export type AvailabilityAction = (typeof AVAILABILITY_ACTIONS)[number];

/**
 * PATCH availability:
 *  - updateRange (HTL-05): rangeId + from + to
 *  - removeRange (HTL-05): rangeId
 *  - block       (HTL-06): from + to (+ reason)
 *  - unblock     (HTL-06): rangeId (a block id)
 */
export class UpdateRoomAvailabilityDto {
  @ApiProperty({ enum: AVAILABILITY_ACTIONS, example: 'block' })
  @IsIn([...AVAILABILITY_ACTIONS])
  action!: AvailabilityAction;

  @ApiPropertyOptional({ description: 'Availability range id or block id' })
  @ValidateIf((o: UpdateRoomAvailabilityDto) =>
    ['updateRange', 'removeRange', 'unblock'].includes(o.action),
  )
  @IsMongoId()
  rangeId?: string;

  @ApiPropertyOptional({ example: '2026-12-24' })
  @ValidateIf((o: UpdateRoomAvailabilityDto) =>
    ['updateRange', 'block'].includes(o.action),
  )
  @Matches(DAY, { message: `from ${DAY_MESSAGE}` })
  from?: string;

  @ApiPropertyOptional({ example: '2026-12-27', description: 'Exclusive' })
  @ValidateIf((o: UpdateRoomAvailabilityDto) =>
    ['updateRange', 'block'].includes(o.action),
  )
  @Matches(DAY, { message: `to ${DAY_MESSAGE}` })
  to?: string;

  @ApiPropertyOptional({ example: 'Maintenance' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  reason?: string;
}
