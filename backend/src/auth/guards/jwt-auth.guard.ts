import { ForbiddenException, Injectable } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';

import type { AuthUser } from '../auth.types';
import { ALLOW_PENDING_PASSWORD_CHANGE_KEY } from '../decorators/allow-pending-password-change.decorator';

/**
 * Authenticates the request using the access_token cookie (see JwtStrategy).
 * Returns 401 if the cookie is missing/invalid/expired, the account is not
 * active, or the session has been idle for over 30 minutes.
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const authenticated = await (super.canActivate(
      context,
    ) as Promise<boolean>);

    if (!authenticated) {
      return false;
    }

    const allowPending = this.reflector.getAllAndOverride<boolean>(
      ALLOW_PENDING_PASSWORD_CHANGE_KEY,
      [context.getHandler(), context.getClass()],
    );

    const request = context.switchToHttp().getRequest<{ user?: AuthUser }>();

    if (request.user?.mustChangePassword && !allowPending) {
      throw new ForbiddenException({
        statusCode: 403,
        code: 'PASSWORD_CHANGE_REQUIRED',
        message: 'You must change your password before continuing',
      });
    }

    return true;
  }
}
