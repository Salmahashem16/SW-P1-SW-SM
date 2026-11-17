import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

/** ACC-12: the user re-enters their password to confirm deactivation. */
export class DeactivateAccountDto {
  @ApiProperty({ example: 'Password123', format: 'password' })
  @IsString()
  @IsNotEmpty()
  password!: string;
}
