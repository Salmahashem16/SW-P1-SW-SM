import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

/**
 * ACC-09. With the global ValidationPipe (whitelist + forbidNonWhitelisted),
 * the whole request is rejected if any field is invalid, so nothing is saved
 * unless every field passes.
 */
export class UpdateProfileDto {
  @ApiPropertyOptional({ example: 'Salma Hashem' })
  @IsOptional()
  @IsString()
  @Matches(/\S/, { message: 'Name cannot be blank' })
  @MinLength(2)
  @MaxLength(100)
  name?: string;

  @ApiPropertyOptional({ example: '+201001234567' })
  @IsOptional()
  @IsString()
  @Matches(/^\+?[0-9][0-9\s-]{6,19}$/, {
    message: 'Phone number must contain 7 to 20 digits and may start with +',
  })
  phone?: string;

  // TODO (GEN-12): once the Countries.csv seed is in, also check this code
  // against the supported currency list in the service.
  @ApiPropertyOptional({
    example: 'EGP',
    description: 'Three-letter ISO currency code from the supported list',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Za-z]{3}$/, {
    message: 'Preferred currency must be a 3-letter currency code',
  })
  preferredCurrency?: string;
}
