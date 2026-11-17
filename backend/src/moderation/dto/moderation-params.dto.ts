import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsMongoId } from 'class-validator';

import { REPORTABLE_TYPES } from '../moderation.constants';
import type { ReportableType } from '../moderation.constants';

export class ContentParamsDto {
  @ApiProperty({ enum: REPORTABLE_TYPES })
  @IsIn([...REPORTABLE_TYPES])
  type!: ReportableType;

  @ApiProperty({ example: '665f1b2c9a1e4c0012345678' })
  @IsMongoId()
  id!: string;
}

export class ReportIdParamsDto {
  @ApiProperty({ example: '665f1b2c9a1e4c0012345678' })
  @IsMongoId()
  id!: string;
}
