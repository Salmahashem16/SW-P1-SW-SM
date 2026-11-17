import type { Request } from 'express';

import type { ProviderType, UserRole } from '../users/schemas/user.schema';

/** What JwtStrategy puts on req.user for every authenticated request. */
export interface AuthUser {
  userId: string;
  email: string;
  role: UserRole;
  mustChangePassword: boolean;
  providerType: ProviderType | null;
  providerId: string | null;
}

export interface JwtPayload {
  sub: string;
  email: string;
  role: UserRole;
}

export type RequestWithCookies = Request & {
  cookies?: Record<string, string | undefined>;
};

export type AuthRequest = RequestWithCookies & {
  user: AuthUser;
};
