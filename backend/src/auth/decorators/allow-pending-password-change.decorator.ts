import { SetMetadata } from '@nestjs/common';

export const ALLOW_PENDING_PASSWORD_CHANGE_KEY = 'allowPendingPasswordChange';

/**
 * ACC-07a / ACC-13: accounts with mustChangePassword = true can only reach
 * routes marked with this decorator (e.g. /auth/me and /auth/change-password).
 * Everything else returns 403 with code PASSWORD_CHANGE_REQUIRED.
 */
export const AllowPendingPasswordChange = () =>
  SetMetadata(ALLOW_PENDING_PASSWORD_CHANGE_KEY, true);
