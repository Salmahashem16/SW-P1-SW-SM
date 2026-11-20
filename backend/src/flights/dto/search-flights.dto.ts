
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsIn,
  IsInt,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  Min,
} from 'class-validator';

import { CABIN_CLASSES } from '../schemas/flight.schema';
import type { CabinClass } from '../schemas/flight.schema';

export class SearchFlightsDto {
  @ApiProperty({
    description: 'Departure airport MongoDB ID',
    example: '507f1f77bcf86cd799439011',
  })
  @IsMongoId()
  departureAirportId!: string;

  @ApiProperty({
    description: 'Arrival airport MongoDB ID',
    example: '507f1f77bcf86cd799439012',
  })
  @IsMongoId()
  arrivalAirportId!: string;

  @ApiProperty({
    example: '2026-12-15',
    description: 'Departure date in YYYY-MM-DD format',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  departureDate!: string;

  @ApiPropertyOptional({
    example: 'one-way',
    enum: ['one-way', 'round-trip'],
  })
  @IsOptional()
  @IsIn(['one-way', 'round-trip'])
  tripType?: 'one-way' | 'round-trip';

  @ApiPropertyOptional({
    example: '2026-12-22',
    description: 'Return date in YYYY-MM-DD format',
  })
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  returnDate?: string;

  @ApiPropertyOptional({
    example: 'Economy',
    enum: CABIN_CLASSES,
  })
  @IsOptional()
  @IsIn([...CABIN_CLASSES])
  cabinClass?: CabinClass;

  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  adults?: number;

  @ApiPropertyOptional({
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  children?: number;

  @ApiPropertyOptional({
    example: 0,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  infants?: number;

  @ApiPropertyOptional({
    example: 100,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    example: 1000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  maxPrice?: number;

  @ApiPropertyOptional({
    example: 'price',
    enum: ['price', 'departure', 'arrival'],
  })
  @IsOptional()
  @IsIn(['price', 'departure', 'arrival'])
  sortBy?: 'price' | 'departure' | 'arrival';

  @ApiPropertyOptional({
    example: 'asc',
    enum: ['asc', 'desc'],
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  sortOrder?: 'asc' | 'desc';

  @ApiPropertyOptional({
    example: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number;

  @ApiPropertyOptional({
    example: 10,
    minimum: 1,
    maximum: 100,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
