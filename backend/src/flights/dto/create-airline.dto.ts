
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class CreateAirlineDto {
  @ApiProperty({ example: 'EgyptAir' })
  @IsString()
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'MS' })
  @IsString()
  @Matches(/^[A-Za-z0-9]{2,3}$/)
  code!: string;

  @ApiPropertyOptional({ example: 'https://example.com/logo.png' })
  @IsOptional()
  @IsString()
  logo?: string;
}
