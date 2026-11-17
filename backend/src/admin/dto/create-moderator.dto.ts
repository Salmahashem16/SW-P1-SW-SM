import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsIn,
  IsMongoId,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

import {
  PASSWORD_REGEX,
  PASSWORD_RULE_MESSAGE,
} from '../../common/password-policy';

export const MODERATOR_ROLES = ['hotelModerator', 'airlineModerator'] as const;
export type ModeratorRole = (typeof MODERATOR_ROLES)[number];

/** ACC-13 */
export class CreateModeratorDto {
  @ApiProperty({ example: 'Nile Hotel Moderator' })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'Name cannot be blank' })
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'moderator@nilehotel.com' })
  @IsString()
  @IsEmail()
  email!: string;

  @ApiProperty({ enum: MODERATOR_ROLES, example: 'hotelModerator' })
  @IsIn([...MODERATOR_ROLES])
  role!: ModeratorRole;

  @ApiProperty({
    description:
      'Id of the hotel (for hotelModerator) or airline (for airlineModerator)',
    example: '665f1b2c9a1e4c0012345678',
  })
  @IsMongoId()
  providerId!: string;

  @ApiProperty({
    example: 'TempPass123',
    format: 'password',
    description:
      'Temporary password set by the admin. The moderator must change it at first login.',
  })
  @IsString()
  @Matches(PASSWORD_REGEX, { message: PASSWORD_RULE_MESSAGE })
  temporaryPassword!: string;
}
