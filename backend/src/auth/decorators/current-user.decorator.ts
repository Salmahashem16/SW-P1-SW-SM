import { createParamDecorator } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';

import type { AuthUser } from '../auth.types';

/**
 * Injects the authenticated user set by JwtStrategy.
 *
 * @example
 * @UseGuards(JwtAuthGuard)
 * @Get('mine')
 * findMine(@CurrentUser() user: AuthUser) { ... }
 */
export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const request = context.switchToHttp().getRequest<{ user: AuthUser }>();
    return request.user;
  },
);
