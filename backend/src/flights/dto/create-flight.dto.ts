
import { ApiProperty } from '@nestjs/swagger';
import {
  IsMongoId,
  IsNotEmpty,
  IsString,
  Matches,
} from 'class-validator';

export class CreateFlightDto {
  @ApiProperty({ example: 'MS700' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/)
  flightNumber!: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439011' })
  @IsMongoId()
  departureAirportId!: string;

  @ApiProperty({ example: '507f1f77bcf86cd799439012' })
  @IsMongoId()
  arrivalAirportId!: string;

  @ApiProperty({
    example: '2026-12-15T08:00:00',
    description: 'Departure airport local date and time',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
  departureLocalTime!: string;

  @ApiProperty({
    example: '2026-12-15T13:30:00',
    description: 'Arrival airport local date and time',
  })
  @IsString()
  @Matches(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}$/)
  arrivalLocalTime!: string;
}
