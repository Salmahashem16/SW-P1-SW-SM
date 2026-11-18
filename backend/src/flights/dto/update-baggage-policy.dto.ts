
import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  IsPositive,
  Min,
} from 'class-validator';

export class UpdateBaggagePolicyDto {
  @ApiProperty({ example: 50 })
  @IsNumber()
  @IsPositive()
  extraBagPrice!: number;

  @ApiProperty({ example: 2 })
  @IsInt()
  @Min(0)
  maxExtraBags!: number;
}
