import { ConflictException, Injectable } from '@nestjs/common';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { RegisterDto } from './dto/register.dto';

@Injectable()
export class AuthService {
  constructor(private readonly usersService: UsersService) {}

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();

    if (await this.usersService.findByEmail(email)) {
      throw new ConflictException('An account with this email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, 12);

    try {
      const user = await this.usersService.create({
        name: dto.name.trim(),
        email,
        passwordHash,
        role: 'registeredUser',
        status: 'active',
        termsAcceptedAt: new Date(),
      });

      // Return safe fields only; never return the password hash.
      return {
        id: user._id.toString(),
        name: user.name,
        email: user.email,
        role: user.role,
      };
    } catch (error) {
      // The unique database index also protects against two simultaneous
      // registrations using the same email.
      if ((error as { code?: number }).code === 11000) {
        throw new ConflictException('An account with this email already exists');
      }

      throw error;
    }
  }
}