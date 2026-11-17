import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { createHash, randomBytes } from 'crypto';
import * as bcrypt from 'bcryptjs';

import { isDuplicateKeyError } from '../common/mongo-errors';
import type { UserDocument } from '../users/schemas/user.schema';
import { toPublicUser } from '../users/user.mapper';
import { UsersService } from '../users/users.service';
import type { JwtPayload } from './auth.types';
import { ChangePasswordDto } from './dto/change-password.dto';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';

const BCRYPT_ROUNDS = 12;
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000;
const IDLE_TIMEOUT_MS = 30 * 60 * 1000;

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  /** ACC-01 */
  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    const existingUser = await this.usersService.findByEmail(email);

    if (existingUser) {
      throw new ConflictException('Email is already registered');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_ROUNDS);

    let user: UserDocument;

    try {
      user = await this.usersService.create({
        name: dto.name.trim(),
        email,
        passwordHash,
        role: 'registeredUser',
        status: 'active',
        termsAcceptedAt: new Date(),
      });
    } catch (error) {
      // Two registrations with the same email at the same moment.
      if (isDuplicateKeyError(error)) {
        throw new ConflictException('Email is already registered');
      }

      throw error;
    }

    return {
      message: 'Registration successful',
      user: toPublicUser(user),
    };
  }

  /** ACC-04 + ACC-05 */
  async login(dto: LoginDto) {
    const user = await this.usersService.findByEmailForLogin(dto.email);

    if (!user) {
      throw new UnauthorizedException('Invalid email or password');
    }

    const now = Date.now();

    if (user.lockUntil && user.lockUntil.getTime() > now) {
      throw new UnauthorizedException(
        'Account is temporarily locked after too many failed attempts. Try again in 15 minutes.',
      );
    }

    // An expired lock starts a fresh count.
    const previousAttempts =
      user.lockUntil && user.lockUntil.getTime() <= now
        ? 0
        : user.failedLoginAttempts;

    const passwordMatches = await bcrypt.compare(
      dto.password,
      user.passwordHash,
    );

    if (!passwordMatches) {
      const attempts = previousAttempts + 1;
      const locked = attempts >= MAX_FAILED_ATTEMPTS;

      await this.usersService.updateLoginState(
        user._id.toString(),
        attempts,
        locked ? new Date(now + LOCKOUT_MS) : null,
      );

      if (locked) {
        throw new UnauthorizedException(
          'Account locked for 15 minutes after 5 failed login attempts.',
        );
      }

      throw new UnauthorizedException('Invalid email or password');
    }

    if (user.status === 'suspended') {
      throw new UnauthorizedException('Account suspended');
    }

    // Deactivated accounts get the generic message (ACC-12).
    if (user.status !== 'active') {
      throw new UnauthorizedException('Invalid email or password');
    }

    await this.usersService.updateLoginState(user._id.toString(), 0, null);

    const tokens = await this.issueTokenPair(user);

    // The frontend uses role to pick the home page and mustChangePassword to
    // force the change-password screen (ACC-07a / ACC-13).
    return {
      ...tokens,
      user: toPublicUser(user),
    };
  }

  /** ACC-19: rotate the refresh token on every refresh. */
  async refresh(refreshToken?: string) {
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token is missing');
    }

    const user = await this.usersService.findByRefreshTokenHash(
      this.hashToken(refreshToken),
    );

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('Session is invalid');
    }

    const activeAfter = new Date(Date.now() - IDLE_TIMEOUT_MS);

    if (!user.lastActivityAt || user.lastActivityAt <= activeAfter) {
      await this.usersService.saveRefreshTokenHash(user._id.toString(), null);

      throw new UnauthorizedException(
        'Session expired. Please log in again.',
      );
    }

    // Issuing a new pair replaces the stored refresh-token hash.
    const tokens = await this.issueTokenPair(user);

    return {
      ...tokens,
      user: toPublicUser(user),
    };
  }

  /** ACC-06 */
  async logout(refreshToken?: string) {
    if (refreshToken) {
      const user = await this.usersService.findByRefreshTokenHash(
        this.hashToken(refreshToken),
      );

      if (user) {
        await this.usersService.saveRefreshTokenHash(
          user._id.toString(),
          null,
        );
      }
    }

    return { message: 'Logged out successfully' };
  }

  /**
   * ACC-06: called by JwtStrategy on every authenticated request.
   * Rejects inactive accounts and sessions idle for more than 30 minutes.
   */
  async validateSession(userId: string): Promise<UserDocument> {
    const activeAfter = new Date(Date.now() - IDLE_TIMEOUT_MS);
    const user = await this.usersService.touchActiveSession(
      userId,
      activeAfter,
    );

    if (!user) {
      await this.usersService.saveRefreshTokenHash(userId, null);
      throw new UnauthorizedException(
        'Session expired or account is not active',
      );
    }

    return user;
  }

  /** ACC-19: /auth/me always reads the current user from the database. */
  async getCurrentUser(userId: string) {
    const user = await this.usersService.findById(userId);

    if (!user || user.status !== 'active') {
      throw new UnauthorizedException('User is not active');
    }

    return { user: toPublicUser(user) };
  }

  /** ACC-08 */
  async changePassword(userId: string, dto: ChangePasswordDto) {
    const user = await this.usersService.findByIdForPasswordChange(userId);

    if (!user) {
      throw new UnauthorizedException('User not found');
    }

    const currentPasswordMatches = await bcrypt.compare(
      dto.currentPassword,
      user.passwordHash,
    );

    if (!currentPasswordMatches) {
      throw new UnauthorizedException('Current password is incorrect');
    }

    const passwordHash = await bcrypt.hash(dto.newPassword, BCRYPT_ROUNDS);

    // Clears mustChangePassword and revokes the refresh token.
    await this.usersService.updatePassword(userId, passwordHash, false);

    return { message: 'Password changed. Please log in again.' };
  }

  private async issueTokenPair(user: UserDocument) {
    const userId = user._id.toString();
    const refreshToken = randomBytes(32).toString('hex');

    await this.usersService.saveRefreshTokenHash(
      userId,
      this.hashToken(refreshToken),
    );

    const payload: JwtPayload = {
      sub: userId,
      email: user.email,
      role: user.role,
    };

    const accessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
    });

    return { accessToken, refreshToken };
  }

  private hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
