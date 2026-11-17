import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

import { PROVIDER_TYPES } from '../../users/schemas/user.schema';
import type { ProviderType } from '../../users/schemas/user.schema';

/** ACC-15: /admin/providers/:type/:id */
export class ProviderParamsDto {
  @ApiProperty({ enum: PROVIDER_TYPES })
  @IsIn([...PROVIDER_TYPES])
  type!: ProviderType;

  @ApiProperty({ example: '665f1b2c9a1e4c0012345678' })
  @IsMongoId()
  id!: string;
}

export class DeactivateProviderDto {
  @ApiPropertyOptional({
    example: 'Repeated customer complaints',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  reason?: string;
}
