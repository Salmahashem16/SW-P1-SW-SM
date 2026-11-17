import type { CookieOptions, Response } from 'express';

// ACC-19: tokens only ever travel in httpOnly cookies, never in the JSON body.
export const ACCESS_COOKIE_NAME = 'access_token';
export const REFRESH_COOKIE_NAME = 'refresh_token';

// Must match the global prefix in main.ts + the auth controller path, so the
// refresh cookie is only sent to /api/auth/refresh and /api/auth/logout.
export const REFRESH_COOKIE_PATH = '/api/auth';

const ACCESS_TOKEN_MAX_AGE_MS = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function baseCookieOptions(): CookieOptions {
  // Secure is on in production. Set COOKIE_SECURE=true to force it locally
  // (Chrome and Firefox accept Secure cookies on http://localhost).
  const secure =
    process.env.COOKIE_SECURE !== undefined
      ? process.env.COOKIE_SECURE === 'true'
      : process.env.NODE_ENV === 'production';

  return {
    httpOnly: true,
    secure,
    sameSite: 'lax',
  };
}

export function setAuthCookies(
  res: Response,
  tokens: { accessToken: string; refreshToken: string },
) {
  res.cookie(ACCESS_COOKIE_NAME, tokens.accessToken, {
    ...baseCookieOptions(),
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE_MS,
  });

  res.cookie(REFRESH_COOKIE_NAME, tokens.refreshToken, {
    ...baseCookieOptions(),
    path: REFRESH_COOKIE_PATH,
    maxAge: REFRESH_TOKEN_MAX_AGE_MS,
  });
}

export function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE_NAME, {
    ...baseCookieOptions(),
    path: '/',
  });

  res.clearCookie(REFRESH_COOKIE_NAME, {
    ...baseCookieOptions(),
    path: REFRESH_COOKIE_PATH,
  });
}
