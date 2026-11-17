import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import type { Request } from 'express';

import { ACCESS_COOKIE_NAME } from './auth.cookies';
import { AuthService } from './auth.service';
import type { AuthUser, JwtPayload } from './auth.types';

function accessTokenFromCookie(req: Request): string | null {
  const cookies = (req as Request & { cookies?: Record<string, string> })
    .cookies;

  return cookies?.[ACCESS_COOKIE_NAME] ?? null;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    config: ConfigService,
    private readonly authService: AuthService,
  ) {
    super({
      // ACC-19: read the token from the httpOnly cookie, not the Authorization header.
      jwtFromRequest: ExtractJwt.fromExtractors([accessTokenFromCookie]),
      ignoreExpiration: false,
      secretOrKey: config.getOrThrow<string>('JWT_SECRET'),
    });
  }

  /**
   * Runs on every authenticated request after the JWT signature is verified.
   * validateSession() rejects suspended/deactivated accounts and sessions idle
   * for more than 30 minutes (ACC-06), and resets the idle timer.
   */
  async validate(payload: JwtPayload): Promise<AuthUser> {
    const user = await this.authService.validateSession(payload.sub);

    return {
      userId: user._id.toString(),
      email: user.email,
      role: user.role,
      mustChangePassword: Boolean(user.mustChangePassword),
      providerType: user.providerType ?? null,
      providerId: user.providerId ? user.providerId.toString() : null,
    };
  }
}
