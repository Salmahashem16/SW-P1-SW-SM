import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthUser } from '../auth/auth.types';
import { DomainEvents } from '../common/events/domain-events';
import { isProviderActive } from '../common/provider-status';
import { Airline } from '../flights/schemas/airline.schema';
import { Hotel } from '../hotels/schemas/hotel.schema';
import type { ProviderType } from '../users/schemas/user.schema';
import { UsersService } from '../users/users.service';

type ProviderFields = {
  name: string;
  isActive: boolean;
  deactivatedAt: Date | null;
  deactivatedBy: Types.ObjectId | null;
};

const LABELS: Record<ProviderType, string> = {
  hotel: 'Hotel',
  airline: 'Airline',
};

/**
 * ACC-15: deactivating a hotel or airline is separate from suspending its
 * moderator. The provider is hidden from search and can't be booked
 * (enforced by search/booking via activeProviderFilter / isProviderActive);
 * existing Confirmed bookings stay valid. Moderator accounts are untouched.
 */
@Injectable()
export class ProvidersAdminService {
  constructor(
    @InjectModel(Hotel.name) private readonly hotelModel: Model<Hotel>,
    @InjectModel(Airline.name) private readonly airlineModel: Model<Airline>,
    private readonly usersService: UsersService,
    private readonly auditLogs: AuditLogsService,
    private readonly events: DomainEvents,
  ) {}

  async deactivate(
    admin: AuthUser,
    type: ProviderType,
    id: string,
    reason?: string,
  ) {
    const provider = await this.getProviderOrThrow(type, id);

    if (!isProviderActive(provider)) {
      throw new ConflictException(`${LABELS[type]} is already deactivated`);
    }

    // The isActive condition stops two admins racing on the same provider.
    const updated = await this.updateIfActiveIs(type, id, true, {
      isActive: false,
      deactivatedAt: new Date(),
      deactivatedBy: new Types.ObjectId(admin.userId),
    });

    if (!updated) {
      throw new ConflictException(`${LABELS[type]} is already deactivated`);
    }

    const moderatorIds = await this.usersService.findModeratorIdsForProvider(
      type,
      id,
    );

    await this.auditLogs.record({
      actorId: admin.userId,
      action: 'provider.deactivated',
      targetType: type,
      targetId: id,
      details: { name: provider.name, reason: reason ?? null },
    });

    await this.events.emit('provider.deactivated', {
      providerType: type,
      providerId: id,
      providerName: provider.name,
      moderatorIds,
      reason: reason ?? null,
    });

    return {
      message: `${LABELS[type]} deactivated. It is hidden from search and cannot be booked; existing confirmed bookings remain valid.`,
      provider: this.toResponse(type, updated),
    };
  }

  async reactivate(admin: AuthUser, type: ProviderType, id: string) {
    const provider = await this.getProviderOrThrow(type, id);

    if (isProviderActive(provider)) {
      throw new ConflictException(`${LABELS[type]} is already active`);
    }

    const updated = await this.updateIfActiveIs(type, id, false, {
      isActive: true,
      deactivatedAt: null,
      deactivatedBy: null,
    });

    if (!updated) {
      throw new ConflictException(`${LABELS[type]} is already active`);
    }

    const moderatorIds = await this.usersService.findModeratorIdsForProvider(
      type,
      id,
    );

    await this.auditLogs.record({
      actorId: admin.userId,
      action: 'provider.reactivated',
      targetType: type,
      targetId: id,
      details: { name: provider.name },
    });

    await this.events.emit('provider.reactivated', {
      providerType: type,
      providerId: id,
      providerName: provider.name,
      moderatorIds,
    });

    return {
      message: `${LABELS[type]} reactivated`,
      provider: this.toResponse(type, updated),
    };
  }

  private model(type: ProviderType): Model<ProviderFields> {
    return (
      type === 'hotel' ? this.hotelModel : this.airlineModel
    ) as unknown as Model<ProviderFields>;
  }

  private async getProviderOrThrow(type: ProviderType, id: string) {
    const provider = await this.model(type).findById(id).lean().exec();

    if (!provider) {
      throw new NotFoundException(`${LABELS[type]} not found`);
    }

    return provider;
  }

  private updateIfActiveIs(
    type: ProviderType,
    id: string,
    currentlyActive: boolean,
    set: Partial<ProviderFields>,
  ) {
    const condition = currentlyActive
      ? { isActive: { $ne: false } }
      : { isActive: false };

    return this.model(type)
      .findOneAndUpdate(
        { _id: new Types.ObjectId(id), ...condition },
        { $set: set },
        { returnDocument: 'after' },
      )
      .lean()
      .exec();
  }

  private toResponse(
    type: ProviderType,
    provider: ProviderFields & { _id: Types.ObjectId },
  ) {
    return {
      id: provider._id.toString(),
      type,
      name: provider.name,
      isActive: provider.isActive,
      deactivatedAt: provider.deactivatedAt,
      deactivatedBy: provider.deactivatedBy
        ? provider.deactivatedBy.toString()
        : null,
    };
  }
}
