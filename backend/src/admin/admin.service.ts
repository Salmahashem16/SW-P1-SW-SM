import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthUser } from '../auth/auth.types';
import { DomainEvents } from '../common/events/domain-events';
import { isDuplicateKeyError } from '../common/mongo-errors';
import type {
  ProviderType,
  UserDocument,
} from '../users/schemas/user.schema';
import { toPublicUser } from '../users/user.mapper';
import { UsersService } from '../users/users.service';
import { CreateModeratorDto } from './dto/create-moderator.dto';
import { ListAccountsQueryDto } from './dto/list-accounts-query.dto';
import { ListAuditLogsQueryDto } from './dto/list-audit-logs-query.dto';

const BCRYPT_ROUNDS = 12;

// Mongoose model names the hotels/flights members register.
// Change these if your teammates named their classes differently.
const PROVIDER_MODEL_NAMES: Record<ProviderType, string> = {
  hotel: 'Hotel',
  airline: 'Airline',
};

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly usersService: UsersService,
    private readonly auditLogs: AuditLogsService,
    private readonly events: DomainEvents,
    @InjectConnection() private readonly connection: Connection,
  ) {}

  /** ACC-13 */
  async createModerator(admin: AuthUser, dto: CreateModeratorDto) {
    const email = dto.email.trim().toLowerCase();

    if (await this.usersService.findByEmail(email)) {
      throw new ConflictException('Email is already registered');
    }

    const providerType: ProviderType =
      dto.role === 'hotelModerator' ? 'hotel' : 'airline';

    await this.assertProviderExists(providerType, dto.providerId);

    const passwordHash = await bcrypt.hash(
      dto.temporaryPassword,
      BCRYPT_ROUNDS,
    );

    let moderator: UserDocument;

    try {
      moderator = await this.usersService.create({
        name: dto.name.trim(),
        email,
        passwordHash,
        role: dto.role,
        status: 'active',
        providerType,
        providerId: new Types.ObjectId(dto.providerId),
        mustChangePassword: true,
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException('Email is already registered');
      }

      throw error;
    }

    await this.auditLogs.record({
      actorId: admin.userId,
      action: 'moderator.created',
      targetType: 'user',
      targetId: moderator._id.toString(),
      details: { role: dto.role, providerType, providerId: dto.providerId },
    });

    return {
      message: 'Moderator account created',
      user: toPublicUser(moderator),
    };
  }

  /** ACC-14 */
  listAccounts(query: ListAccountsQueryDto) {
    return this.usersService.listAccounts(query);
  }

  /** ACC-15 (moderators) and ACC-16 (registered users) */
  async suspendAccount(admin: AuthUser, targetId: string, reason?: string) {
    const target = await this.getAccountOrThrow(targetId);

    if (target._id.toString() === admin.userId) {
      throw new BadRequestException('You cannot suspend your own account');
    }

    if (target.role === 'admin') {
      throw new ForbiddenException('Admin accounts cannot be suspended');
    }

    if (target.status === 'suspended') {
      throw new ConflictException('Account is already suspended');
    }

    if (target.status === 'deactivated') {
      throw new ConflictException(
        'This account was deactivated by its owner and cannot be suspended',
      );
    }

    // Revokes the refresh token. The access token stops working on the next
    // request because JwtStrategy only accepts active accounts.
    const updated = await this.usersService.updateStatus(
      targetId,
      'suspended',
    );

    await this.auditLogs.record({
      actorId: admin.userId,
      action: 'account.suspended',
      targetType: 'user',
      targetId,
      details: { role: target.role, reason: reason ?? null },
    });

    // GEN-01: the notifications module listens for this.
    await this.events.emit('account.suspended', {
      userId: targetId,
      role: target.role,
      reason: reason ?? null,
    });

    return {
      message: 'Account suspended',
      user: toPublicUser(updated ?? target),
    };
  }

  /** ACC-15 / ACC-16 */
  async reactivateAccount(admin: AuthUser, targetId: string) {
    const target = await this.getAccountOrThrow(targetId);

    if (target.status !== 'suspended') {
      throw new ConflictException('Only suspended accounts can be reactivated');
    }

    const updated = await this.usersService.updateStatus(targetId, 'active');

    await this.auditLogs.record({
      actorId: admin.userId,
      action: 'account.reactivated',
      targetType: 'user',
      targetId,
      details: { role: target.role },
    });

    // GEN-01: the notifications module listens for this.
    await this.events.emit('account.reactivated', {
      userId: targetId,
      role: target.role,
    });

    return {
      message: 'Account reactivated',
      user: toPublicUser(updated ?? target),
    };
  }

  /** GEN-07 */
  listAuditLogs(query: ListAuditLogsQueryDto) {
    return this.auditLogs.list(query);
  }

  private async getAccountOrThrow(id: string): Promise<UserDocument> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException('Account not found');
    }

    const user = await this.usersService.findById(id);

    if (!user) {
      throw new NotFoundException('Account not found');
    }

    return user;
  }

  private async assertProviderExists(type: ProviderType, id: string) {
    const modelName = PROVIDER_MODEL_NAMES[type];
    const model = this.connection.models[modelName];

    if (!model) {
      // The hotels/flights module isn't merged yet.
      this.logger.warn(
        `Model "${modelName}" is not registered; skipping the ${type} existence check for moderator creation.`,
      );
      return;
    }

    const exists = await model.exists({ _id: id });

    if (!exists) {
      throw new NotFoundException(
        `${type === 'hotel' ? 'Hotel' : 'Airline'} not found`,
      );
    }
  }
}
