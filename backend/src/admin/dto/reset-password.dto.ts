import { ApiProperty } from '@nestjs/swagger';
import { IsString, Matches } from 'class-validator';

import {
  PASSWORD_REGEX,
  PASSWORD_RULE_MESSAGE,
} from '../../common/password-policy';

/** ACC-07a */
export class AdminResetPasswordDto {
  @ApiProperty({
    example: 'TempPass123',
    format: 'password',
    description:
      'Temporary password set by the admin. The account must change it at its next login.',
  })
  @IsString()
  @Matches(PASSWORD_REGEX, { message: PASSWORD_RULE_MESSAGE })
  temporaryPassword!: string;
}
