import { ArrayNotEmpty, IsArray, IsBoolean, IsDateString, IsOptional, IsString } from 'class-validator';

export class CreateItineraryDto {
  @IsString()
  title: string;

  @IsArray()
  @ArrayNotEmpty()
  @IsString({ each: true })
  countries: string[];

  @IsDateString()
  startDate: string;

  @IsOptional()
  @IsBoolean()
  isPublic?: boolean;
}
