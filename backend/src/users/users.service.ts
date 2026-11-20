import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  Optional,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import * as bcrypt from 'bcryptjs';

import { User } from './schemas/user.schema';
import type {
  ProviderType,
  UserDocument,
  UserRole,
  UserStatus,
} from './schemas/user.schema';
import { UPCOMING_BOOKINGS_CHECKER } from './upcoming-bookings.checker';
import type { UpcomingBookingsChecker } from './upcoming-bookings.checker';

type ProfileUpdate = Partial<
  Pick<User, 'name' | 'phone' | 'preferredCurrency'>
>;

export type AccountFilters = {
  search?: string;
  role?: UserRole;
  status?: UserStatus;
  page?: number;
  limit?: number;
};

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @InjectModel(User.name)
    private readonly userModel: Model<User>,
    @Optional()
    @Inject(UPCOMING_BOOKINGS_CHECKER)
    private readonly bookingsChecker?: UpcomingBookingsChecker,
  ) {}

  findByEmail(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.trim().toLowerCase() })
      .exec();
  }

  findByEmailForLogin(email: string): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ email: email.trim().toLowerCase() })
      .select('+passwordHash')
      .exec();
  }

  findById(userId: string): Promise<UserDocument | null> {
    return this.userModel.findById(userId).exec();
  }

  findByIdForPasswordChange(
    userId: string,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findById(userId)
      .select('+passwordHash')
      .exec();
  }

  create(data: Partial<User>): Promise<UserDocument> {
    return this.userModel.create(data);
  }

  updateLoginState(
    userId: string,
    failedLoginAttempts: number,
    lockUntil: Date | null,
  ) {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        { $set: { failedLoginAttempts, lockUntil } },
        { new: true, runValidators: true },
      )
      .exec();
  }

  /** Also revokes the refresh token, so every session must log in again. */
  updatePassword(
    userId: string,
    passwordHash: string,
    mustChangePassword = false,
  ) {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $set: {
            passwordHash,
            mustChangePassword,
            failedLoginAttempts: 0,
            lockUntil: null,
          },
          $unset: { refreshTokenHash: 1 },
        },
        { new: true, runValidators: true },
      )
      .exec();
  }

  /** ACC-09 */
  updateProfile(
    userId: string,
    data: ProfileUpdate,
  ): Promise<UserDocument | null> {
    const update: ProfileUpdate = {};

    if (data.name !== undefined) {
      update.name = data.name.trim();
    }

    if (data.phone !== undefined) {
      update.phone = data.phone.trim();
    }

    if (data.preferredCurrency !== undefined) {
      update.preferredCurrency = data.preferredCurrency.toUpperCase();
    }

    return this.userModel
      .findOneAndUpdate(
        { _id: userId, status: 'active' },
        { $set: update },
        { new: true, runValidators: true },
      )
      .exec();
  }

  /** ACC-15 / ACC-16. Suspending also revokes the refresh token. */
  updateStatus(
    userId: string,
    status: UserStatus,
  ): Promise<UserDocument | null> {
    const update =
      status === 'active'
        ? { $set: { status } }
        : {
            $set: { status },
            $unset: { refreshTokenHash: 1 },
          };

    return this.userModel
      .findByIdAndUpdate(userId, update, {
        new: true,
        runValidators: true,
      })
      .exec();
  }

  /** ACC-15: ids of the moderator accounts linked to a hotel or airline. */
  async findModeratorIdsForProvider(
    providerType: ProviderType,
    providerId: string,
  ): Promise<string[]> {
    const moderators = await this.userModel
      .find({ providerType, providerId: new Types.ObjectId(providerId) })
      .select('_id')
      .lean()
      .exec();

    return moderators.map((moderator) => moderator._id.toString());
  }

  /** ACC-14 */
  async listAccounts(filters: AccountFilters) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, Math.max(1, filters.limit ?? 10));
    const search = filters.search?.trim();
    const escapedSearch = search?.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const query = {
      ...(escapedSearch
        ? {
            $or: [
              { name: new RegExp(escapedSearch, 'i') },
              { email: new RegExp(escapedSearch, 'i') },
            ],
          }
        : {}),
      ...(filters.role ? { role: filters.role } : {}),
      ...(filters.status ? { status: filters.status } : {}),
    };

    const [accounts, total] = await Promise.all([
      this.userModel
        .find(query)
        .select('name email role status providerType providerId createdAt')
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.userModel.countDocuments(query).exec(),
    ]);

    return {
      items: accounts.map((account) => ({
        id: account._id.toString(),
        name: account.name,
        email: account.email,
        role: account.role,
        status: account.status,
        providerType: account.providerType ?? null,
        providerId: account.providerId ? account.providerId.toString() : null,
        registeredAt: account.createdAt ?? null,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  saveRefreshTokenHash(
    userId: string,
    refreshTokenHash: string | null,
  ) {
    const update = refreshTokenHash
      ? {
          $set: {
            refreshTokenHash,
            lastActivityAt: new Date(),
          },
        }
      : {
          $unset: { refreshTokenHash: 1 },
        };

    return this.userModel
      .findByIdAndUpdate(userId, update, {
        new: true,
        runValidators: true,
      })
      .exec();
  }

  findByRefreshTokenHash(
    refreshTokenHash: string,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOne({ refreshTokenHash })
      .select('+refreshTokenHash')
      .exec();
  }

  /**
   * ACC-06: succeeds only if the account is active and the last
   * authenticated request was within the idle window. Refreshes the timer.
   */
  touchActiveSession(
    userId: string,
    activeAfter: Date,
  ): Promise<UserDocument | null> {
    return this.userModel
      .findOneAndUpdate(
        {
          _id: userId,
          status: 'active',
          lastActivityAt: { $gt: activeAfter },
        },
        { $set: { lastActivityAt: new Date() } },
        { new: true },
      )
      .exec();
  }

  deactivateUser(userId: string) {
    return this.userModel
      .findByIdAndUpdate(
        userId,
        {
          $set: { status: 'deactivated', deactivatedAt: new Date() },
          $unset: { refreshTokenHash: 1 },
        },
        { new: true, runValidators: true },
      )
      .exec();
  }

  /**
   * ACC-12: a registered user deactivates their own account.
   * The password is the server-side confirmation step.
   */
  async deactivateOwnAccount(userId: string, password: string) {
    const user = await this.findByIdForPasswordChange(userId);

    if (!user || user.status !== 'active') {
      throw new NotFoundException('Account not found');
    }

    if (user.role !== 'registeredUser') {
      throw new ForbiddenException(
        'Only registered users can deactivate their own account',
      );
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      throw new BadRequestException('Password is incorrect');
    }

    if (this.bookingsChecker) {
      const hasUpcoming =
        await this.bookingsChecker.hasUpcomingConfirmedBookings(userId);

      if (hasUpcoming) {
        throw new ConflictException(
          'You cannot deactivate your account while you have upcoming confirmed bookings',
        );
      }
    } else {
      this.logger.warn(
        'No UPCOMING_BOOKINGS_CHECKER provider is registered; skipping the ACC-12 upcoming-booking check.',
      );
    }

    await this.deactivateUser(userId);

    return { message: 'Your account has been deactivated' };
  }
}
