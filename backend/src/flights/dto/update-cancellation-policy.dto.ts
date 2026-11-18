
import { ApiProperty } from '@nestjs/swagger';
import {
  IsInt,
  IsNumber,
  Min,
  Max,
} from 'class-validator';

export class UpdateCancellationPolicyDto {
  @ApiProperty({
    example: 24,
    description:
      'Minimum number of hours before departure to cancel',
  })
  @IsInt()
  @Min(0)
  cancellationDeadlineHours!: number;

  @ApiProperty({
    example: 80,
    description:
      'Percentage of the booking amount refunded',
  })
  @IsNumber()
  @Min(0)
  @Max(100)
  refundPercentage!: number;
}
