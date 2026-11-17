import { ApiProperty } from '@nestjs/swagger';
import {
  IsNotEmpty,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class ChangePasswordDto {
  @ApiProperty({
    example: 'CurrentPassword123',
    format: 'password',
  })
  @IsString()
  @IsNotEmpty()
  currentPassword!: string;

  @ApiProperty({
    example: 'NewPassword123',
    format: 'password',
    description: 'At least 8 characters, including a letter and a digit',
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(8)
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, {
    message: 'Password must be at least 8 characters and include a letter and a digit',
  })
  newPassword!: string;
}