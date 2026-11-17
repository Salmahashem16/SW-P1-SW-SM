import { ApiProperty } from '@nestjs/swagger';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'User name',
    example: 'Salma Hashem',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/\S/, { message: 'Name cannot be blank' })
  @MinLength(2)
  @MaxLength(100)
  name!: string;

  @ApiProperty({ example: 'salma@example.com' })
  @IsString()
  @IsEmail()
  @IsNotEmpty()
  email!: string;

  @ApiProperty({
    example: 'Password123',
    format: 'password',
    description: 'Must be at least 8 characters and include a letter and a digit',
  })
  @IsString()
  @IsNotEmpty()
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,}$/, {
    message: 'Password must be at least 8 characters and include a letter and a digit',
  })
  password!: string;

  @ApiProperty({
    example: true,
    description: 'Accept the terms and privacy policy',
  })
  @IsBoolean()
  @Equals(true, {
    message: 'You must accept the terms and privacy policy',
  })
  termsAccepted!: boolean;
}