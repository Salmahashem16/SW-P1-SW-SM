import { IsIn, IsNotEmpty, IsNumber, IsOptional, IsString, Matches, Min } from 'class-validator';

export class CreateBudgetDto {
  @IsIn(['food', 'accommodation', 'localTransportation', 'activities'])
  category: string;

  @IsNumber({ allowNaN: false, allowInfinity: false })
  @Min(0)
  amount: number;

  @IsString()
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a three-letter uppercase code' })
  currency: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  description?: string;
}
