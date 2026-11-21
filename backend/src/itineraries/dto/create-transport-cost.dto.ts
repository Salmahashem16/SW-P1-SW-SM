import { IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CreateTransportCostDto {
  @IsString() @IsNotEmpty()
  fromCityId: string;
  @IsString() @IsNotEmpty()
  toCityId: string;
  @IsNumber({ allowNaN: false, allowInfinity: false }) @Min(0)
  amount: number;
  @IsString() @Matches(/^[A-Z]{3}$/)
  currency: string;
  @IsOptional() @IsString()
  description?: string;
}
