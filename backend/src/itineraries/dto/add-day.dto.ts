import { IsNotEmpty, IsString } from 'class-validator';

export class AddDayDto {
  @IsString()
  @IsNotEmpty()
  cityId: string;
}
