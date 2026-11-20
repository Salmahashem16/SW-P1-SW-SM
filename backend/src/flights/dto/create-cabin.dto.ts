
import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsInt,
  IsNumber,
  IsPositive,
  Min,
} from 'class-validator';

import { CABIN_CLASSES } from '../schemas/flight.schema';
import type { CabinClass } from '../schemas/flight.schema';

export class CreateCabinDto {
  @ApiProperty({ enum: CABIN_CLASSES, example: 'Economy' })
  @IsIn([...CABIN_CLASSES])
  cabinClass!: CabinClass;

  @ApiProperty({ example: 150 })
  @IsInt()
  @Min(1)
  capacity!: number;

  @ApiProperty({ example: 350 })
  @IsNumber()
  @IsPositive()
  price!: number;

  @ApiProperty({ example: 'USD' })
  @IsIn(['USD'])
  currency!: string;

  @ApiProperty({ example: 1 })
  @IsInt()
  @Min(0)
  freeBaggageCount!: number;

  @ApiProperty({ example: 23 })
  @IsNumber()
  @IsPositive()
  maxBagWeightKg!: number;
}
