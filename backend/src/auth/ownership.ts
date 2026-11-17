import { NotFoundException } from '@nestjs/common';

import type { ProviderType, UserRole } from '../users/schemas/user.schema';
import type { AuthUser } from './auth.types';

/**
 * ACC-11 helpers for the bookings and itineraries members.
 *
 * Unauthorised access returns 404 (not 403) so other users cannot tell
 * whether a booking or private itinerary with that id exists.
 */

type IdLike = { toString(): string } | null | undefined;

export function isOwner(user: AuthUser, ownerId: IdLike): boolean {
  return Boolean(ownerId) && ownerId!.toString() === user.userId;
}

/** True if the user is the moderator of this exact hotel or airline. */
export function isModeratorOf(
  user: AuthUser,
  providerType: ProviderType,
  providerId: IdLike,
): boolean {
  const expectedRole: UserRole =
    providerType === 'hotel' ? 'hotelModerator' : 'airlineModerator';

  return (
    user.role === expectedRole &&
    user.providerType === providerType &&
    Boolean(providerId) &&
    user.providerId === providerId!.toString()
  );
}

/**
 * Throws 404 unless the user owns the resource or has one of allowedRoles.
 *
 * @example
 * // booking detail: owner or any admin (ACC-17)
 * assertOwnerOrRole(user, booking.userId, ['admin']);
 *
 * // private itinerary: owner only
 * assertOwnerOrRole(user, itinerary.ownerId);
 */
export function assertOwnerOrRole(
  user: AuthUser,
  ownerId: IdLike,
  allowedRoles: UserRole[] = [],
  notFoundMessage = 'Resource not found',
): void {
  if (isOwner(user, ownerId) || allowedRoles.includes(user.role)) {
    return;
  }

  throw new NotFoundException(notFoundMessage);
}
