import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { Types } from 'mongoose';

import type { AuthUser } from '../auth/auth.types';
import { isModeratorOf } from '../auth/ownership';

/** Invalid ids are treated as "not found" instead of a 500 CastError. */
export function toObjectId(id: string, label = 'Resource'): Types.ObjectId {
  if (!Types.ObjectId.isValid(id) || String(new Types.ObjectId(id)) !== id.toLowerCase()) {
    throw new NotFoundException(`${label} not found`);
  }

  return new Types.ObjectId(id);
}

/**
 * Hotel management: the moderator of this exact hotel (ACC-13), or an admin
 * when `allowAdmin` is set. Hotels are public, so a wrong hotel is 403.
 */
export function assertCanManageHotel(
  user: AuthUser,
  hotelId: string,
  options: { allowAdmin?: boolean } = {},
): void {
  if (options.allowAdmin && user.role === 'admin') {
    return;
  }

  if (!isModeratorOf(user, 'hotel', hotelId)) {
    throw new ForbiddenException('You can only manage your assigned hotel');
  }
}

export function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Exact, case-insensitive match (city / country names). */
export function exactInsensitive(value: string): RegExp {
  return new RegExp(`^${escapeRegex(value.trim())}$`, 'i');
}
