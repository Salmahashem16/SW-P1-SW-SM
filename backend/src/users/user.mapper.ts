import type { UserDocument } from './schemas/user.schema';

/**
 * The only shape of a user that is ever sent to the frontend.
 * Never includes passwordHash, refreshTokenHash or lockout fields.
 */
export function toPublicUser(user: UserDocument) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    role: user.role,
    status: user.status,
    phone: user.phone ?? null,
    preferredCurrency: user.preferredCurrency,
    mustChangePassword: Boolean(user.mustChangePassword),
    providerType: user.providerType ?? null,
    providerId: user.providerId ? user.providerId.toString() : null,
    createdAt: user.createdAt ?? null,
  };
}

export type PublicUser = ReturnType<typeof toPublicUser>;
