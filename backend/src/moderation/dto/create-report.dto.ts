import { ApiProperty } from '@nestjs/swagger';
import {
  IsIn,
  IsMongoId,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

import { REPORTABLE_TYPES } from '../moderation.constants';
import type { ReportableType } from '../moderation.constants';

/** GEN-09 */
export class CreateReportDto {
  @ApiProperty({ enum: REPORTABLE_TYPES, example: 'post' })
  @IsIn([...REPORTABLE_TYPES])
  targetType!: ReportableType;

  @ApiProperty({ example: '665f1b2c9a1e4c0012345678' })
  @IsMongoId()
  targetId!: string;

  @ApiProperty({ example: 'Spam links in the post body', maxLength: 500 })
  @IsString()
  @Matches(/\S/, { message: 'Reason cannot be blank' })
  @MaxLength(500)
  reason!: string;
}
