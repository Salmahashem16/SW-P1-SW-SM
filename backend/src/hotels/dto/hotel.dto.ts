import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayUnique,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';

/** HTL-01 (admin creates). Photos are uploaded separately (GEN-08). */
export class CreateHotelDto {
  @ApiProperty({ example: 'Nile View Hotel' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  name!: string;

  @ApiProperty({ example: '12 Corniche El Nil' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  address!: string;

  @ApiProperty({ example: 'Cairo', description: 'City name from the seeded reference data' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  city!: string;

  @ApiProperty({ example: 'Egypt', description: 'Country name from the seeded reference data' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  country!: string;

  @ApiPropertyOptional({ example: 'Riverside hotel in downtown Cairo.' })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  description?: string;

  @ApiPropertyOptional({ example: 4, minimum: 1, maximum: 5 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(5)
  starClass?: number;

  @ApiPropertyOptional({ example: ['wifi', 'pool', 'parking'] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ArrayUnique()
  @IsString({ each: true })
  @MaxLength(50, { each: true })
  amenities?: string[];
}

/** HTL-01 (moderator or admin edits). */
export class UpdateHotelDto extends PartialType(CreateHotelDto) {}

export class CancellationTierDto {
  @ApiProperty({ example: 7, description: 'Days before check-in (integer >= 0)' })
  @IsInt()
  @Min(0)
  daysBeforeCheckIn!: number;

  @ApiProperty({ example: 50, description: 'Refund percentage (0-100)' })
  @IsNumber()
  @Min(0)
  @Max(100)
  refundPercentage!: number;
}

const TIME_PATTERN = /^([01]\d|2[0-3]):[0-5]\d$/;

/** HTL-09 and HTL-10. */
export class UpdateHotelPoliciesDto {
  @ApiProperty({ example: '14:00', description: 'HH:mm (24h)' })
  @Matches(TIME_PATTERN, { message: 'checkInTime must be HH:mm' })
  checkInTime!: string;

  @ApiProperty({ example: '12:00', description: 'HH:mm (24h)' })
  @Matches(TIME_PATTERN, { message: 'checkOutTime must be HH:mm' })
  checkOutTime!: string;

  @ApiProperty({
    type: [CancellationTierDto],
    example: [
      { daysBeforeCheckIn: 30, refundPercentage: 100 },
      { daysBeforeCheckIn: 7, refundPercentage: 50 },
      { daysBeforeCheckIn: 0, refundPercentage: 0 },
    ],
  })
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => CancellationTierDto)
  cancellationTiers!: CancellationTierDto[];
}
