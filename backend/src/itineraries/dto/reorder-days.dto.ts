import { ArrayNotEmpty, IsArray, IsMongoId } from 'class-validator';

export class ReorderDaysDto {
  @IsArray()
  @ArrayNotEmpty()
  @IsMongoId({ each: true })
  dayIds: string[];
}
