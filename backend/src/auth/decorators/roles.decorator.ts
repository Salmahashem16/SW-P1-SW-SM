import { SetMetadata } from '@nestjs/common';

import type { UserRole } from '../../users/schemas/user.schema';

export const ROLES_KEY = 'roles';

/**
 * Restrict a route or controller to specific roles. Use together with
 * @UseGuards(JwtAuthGuard, RolesGuard).
 *
 * @example @Roles('admin')
 * @example @Roles('hotelModerator', 'admin')
 */
export const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);
