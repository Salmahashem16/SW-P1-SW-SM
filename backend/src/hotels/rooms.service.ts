import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import type { AuthUser } from '../auth/auth.types';
import { isDuplicateKeyError } from '../common/mongo-errors';
import { formatDay, parseRange, rangesCover, rangesOverlap } from './date-range.util';
import type { DayRange } from './date-range.util';
import { CreateRoomDto, UpdateRoomAvailabilityDto, UpdateRoomDto } from './dto/room.dto';
import type { RoomDateRangeDto } from './dto/room.dto';
import { assertCanManageHotel, toObjectId } from './hotel-access';
import { HotelInventoryService } from './hotel-inventory.service';
import type { RoomView } from './hotel-inventory.service';
import { Hotel } from './schemas/hotel.schema';
import { Room } from './schemas/room.schema';

/** HTL-03, HTL-04, HTL-05, HTL-06. Hotel moderators of the room's hotel only. */
@Injectable()
export class RoomsService {
  constructor(
    @InjectModel(Hotel.name) private readonly hotelModel: Model<Hotel>,
    @InjectModel(Room.name) private readonly roomModel: Model<Room>,
    private readonly inventory: HotelInventoryService,
  ) {}

  async create(user: AuthUser, hotelId: string, dto: CreateRoomDto) {
    const hotelOid = await this.getManagedHotelId(user, hotelId);

    try {
      const room = await this.roomModel.create({ ...dto, hotelId: hotelOid });
      return toRoomResponse(room.toObject() as RoomView);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException(
          `A room named "${dto.name}" already exists in this hotel`,
        );
      }
      throw error;
    }
  }

  async listForManager(user: AuthUser, hotelId: string) {
    const hotelOid = await this.getManagedHotelId(user, hotelId, true);
    const rooms = await this.roomModel
      .find({ hotelId: hotelOid })
      .sort({ name: 1 })
      .lean<RoomView[]>()
      .exec();
    return rooms.map(toRoomResponse);
  }

  /** HTL-05 edits; HTL-06 deactivation via isActive=false. */
  async update(user: AuthUser, hotelId: string, roomId: string, dto: UpdateRoomDto) {
    const room = await this.getManagedRoom(user, hotelId, roomId);

    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Nothing to update');
    }

    const deactivating = dto.isActive === false && room.isActive !== false;
    if (deactivating && (await this.inventory.hasActiveReservations(room._id))) {
      throw new ConflictException(
        'This room has Confirmed or Pending Payment reservations and cannot be deactivated',
      );
    }

    const updated = await this.roomModel
      .findByIdAndUpdate(room._id, { $set: dto }, { returnDocument: 'after', runValidators: true })
      .lean<RoomView>()
      .exec();

    // Write-then-verify: a hold created between the check and the update.
    if (deactivating && (await this.inventory.hasActiveReservations(room._id))) {
      await this.roomModel.updateOne({ _id: room._id }, { $set: { isActive: true } }).exec();
      throw new ConflictException(
        'A reservation was just made for this room; it was not deactivated',
      );
    }

    return toRoomResponse(updated!);
  }

  /** HTL-06: only rooms that have never been reserved can be deleted. */
  async remove(user: AuthUser, hotelId: string, roomId: string) {
    const room = await this.getManagedRoom(user, hotelId, roomId);

    if (await this.inventory.wasEverReserved(room._id)) {
      throw new ConflictException(
        'This room has reservations and cannot be deleted. Deactivate it instead.',
      );
    }

    await this.roomModel.deleteOne({ _id: room._id }).exec();
    return { message: 'Room deleted' };
  }

  /** HTL-04: add a bookable range that does not overlap existing ones. */
  async addAvailability(
    user: AuthUser,
    hotelId: string,
    roomId: string,
    dto: RoomDateRangeDto,
  ) {
    const room = await this.getManagedRoom(user, hotelId, roomId);
    const range = parseRange(dto.from, dto.to);

    // Atomic: only pushes if no existing range overlaps.
    const updated = await this.roomModel
      .findOneAndUpdate(
        {
          _id: room._id,
          availability: {
            $not: { $elemMatch: { from: { $lt: range.to }, to: { $gt: range.from } } },
          },
        },
        { $push: { availability: { $each: [range], $sort: { from: 1 } } } },
        { returnDocument: 'after' },
      )
      .lean<RoomView>()
      .exec();

    if (!updated) {
      throw new ConflictException('This range overlaps an existing availability range');
    }

    return toRoomResponse(updated);
  }

  /** HTL-05 (update/remove ranges) and HTL-06 (block/unblock). */
  async updateAvailability(
    user: AuthUser,
    hotelId: string,
    roomId: string,
    dto: UpdateRoomAvailabilityDto,
  ) {
    const room = await this.getManagedRoom(user, hotelId, roomId);

    switch (dto.action) {
      case 'updateRange':
      case 'removeRange':
        return this.changeRange(room, dto);
      case 'block':
        return this.block(room, parseRange(dto.from!, dto.to!), dto.reason);
      case 'unblock':
        return this.unblock(room, dto.rangeId!);
    }
  }

  private async changeRange(room: RoomView, dto: UpdateRoomAvailabilityDto) {
    const rangeId = dto.rangeId!;
    const existing = room.availability.find((r) => String(r._id) === rangeId);
    if (!existing) {
      throw new NotFoundException('Availability range not found');
    }

    const others = room.availability.filter((r) => String(r._id) !== rangeId);
    let next: DayRange[] = others;
    let replacement: DayRange | null = null;

    if (dto.action === 'updateRange') {
      replacement = parseRange(dto.from!, dto.to!);
      if (others.some((r) => rangesOverlap(r, replacement!))) {
        throw new ConflictException('This range overlaps another availability range');
      }
      next = [...others, replacement];
    }

    // HTL-05: availability cannot be removed for dates with reservations.
    const stays = await this.inventory.activeFutureStays(room._id);
    const uncovered = stays.find(
      (stay) => !rangesCover(next, { from: stay.checkIn, to: stay.checkOut }),
    );
    if (uncovered) {
      throw new ConflictException(
        `Availability is needed for an existing reservation (${formatDay(uncovered.checkIn)} to ${formatDay(uncovered.checkOut)})`,
      );
    }

    // Optimistic concurrency: fail if the room changed since we read it.
    const update =
      replacement === null
        ? { $pull: { availability: { _id: existing._id } } }
        : {
            $set: {
              'availability.$[r].from': replacement.from,
              'availability.$[r].to': replacement.to,
            },
          };

    const updated = await this.roomModel
      .findOneAndUpdate({ _id: room._id, updatedAt: room.updatedAt }, update, {
        returnDocument: 'after',
        arrayFilters: replacement ? [{ 'r._id': existing._id }] : undefined,
      })
      .lean<RoomView>()
      .exec();

    if (!updated) {
      throw new ConflictException('The room was changed by someone else; please retry');
    }

    return toRoomResponse(updated);
  }

  private async block(room: RoomView, range: DayRange, reason?: string) {
    if (await this.inventory.hasActiveReservations(room._id, range)) {
      throw new ConflictException(
        'These dates overlap a Confirmed or Pending Payment reservation',
      );
    }

    const blockId = new Types.ObjectId();
    const updated = await this.roomModel
      .findByIdAndUpdate(
        room._id,
        {
          $push: {
            blocks: { $each: [{ _id: blockId, ...range, reason: reason ?? null }], $sort: { from: 1 } },
          },
        },
        { returnDocument: 'after' },
      )
      .lean<RoomView>()
      .exec();

    // Write-then-verify against a hold made between the check and the push.
    if (await this.inventory.hasActiveReservations(room._id, range)) {
      await this.roomModel.updateOne({ _id: room._id }, { $pull: { blocks: { _id: blockId } } }).exec();
      throw new ConflictException('A reservation was just made for these dates; nothing was blocked');
    }

    return toRoomResponse(updated!);
  }

  private async unblock(room: RoomView, blockId: string) {
    const updated = await this.roomModel
      .findOneAndUpdate(
        { _id: room._id, 'blocks._id': toObjectId(blockId, 'Block') },
        { $pull: { blocks: { _id: new Types.ObjectId(blockId) } } },
        { returnDocument: 'after' },
      )
      .lean<RoomView>()
      .exec();

    if (!updated) {
      throw new NotFoundException('Block not found');
    }

    return toRoomResponse(updated);
  }

  private async getManagedHotelId(user: AuthUser, hotelId: string, allowAdmin = false) {
    const hotelOid = toObjectId(hotelId, 'Hotel');
    assertCanManageHotel(user, hotelId, { allowAdmin });

    if (!(await this.hotelModel.exists({ _id: hotelOid }).exec())) {
      throw new NotFoundException('Hotel not found');
    }

    return hotelOid;
  }

  private async getManagedRoom(user: AuthUser, hotelId: string, roomId: string) {
    const hotelOid = toObjectId(hotelId, 'Hotel');
    assertCanManageHotel(user, hotelId);

    const room = await this.roomModel
      .findOne({ _id: toObjectId(roomId, 'Room'), hotelId: hotelOid })
      .lean<RoomView>()
      .exec();

    if (!room) {
      throw new NotFoundException('Room not found');
    }

    return room;
  }
}

export function toRoomResponse(room: RoomView) {
  const range = (r: { _id: Types.ObjectId; from: Date; to: Date }) => ({
    id: String(r._id),
    from: formatDay(r.from),
    to: formatDay(r.to),
  });

  return {
    id: String(room._id),
    hotelId: String(room.hotelId),
    name: room.name,
    type: room.type,
    beds: room.beds,
    maxOccupancy: room.maxOccupancy,
    pricePerNight: room.pricePerNight,
    isActive: room.isActive !== false,
    availability: (room.availability ?? []).map(range),
    blocks: (room.blocks ?? []).map((b) => ({ ...range(b), reason: b.reason ?? null })),
  };
}
