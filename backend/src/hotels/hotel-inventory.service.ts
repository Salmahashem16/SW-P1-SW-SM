import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { HotelBooking } from '../bookings/schemas/hotel-booking.schema';
import { isProviderActive } from '../common/provider-status';
import { rangesCover, rangesOverlap } from './date-range.util';
import type { DayRange } from './date-range.util';
import {
  occupyingOverlapFilter,
  occupyingStatusFilter,
  ROOM_ID_PATH,
} from './hotel-booking-contract';
import type { HotelBookingView } from './hotel-booking-contract';
import { Hotel } from './schemas/hotel.schema';
import { Room } from './schemas/room.schema';

export type RoomView = Room & { _id: Types.ObjectId };

/**
 * One place that decides whether a room is free for a night range:
 * active, inside its bookable ranges (HTL-04), not blocked (HTL-06), and not
 * occupied by a Confirmed reservation or an unexpired hold (HTL-18).
 *
 * Member 5 (HTL-16/18): call assertRoomsBookable() when creating a hold. For
 * race safety, insert the Pending Payment booking and then call
 * findOccupying() again excluding it; if another occupying booking overlaps,
 * delete yours and reject. Room blocks here use the same write-then-verify
 * pattern, so a block and a hold can never both succeed.
 */
@Injectable()
export class HotelInventoryService {
  constructor(
    @InjectModel(Hotel.name) private readonly hotelModel: Model<Hotel>,
    @InjectModel(Room.name) private readonly roomModel: Model<Room>,
    @InjectModel(HotelBooking.name)
    private readonly bookingModel: Model<HotelBooking>,
  ) {}

  /** Static checks that don't need bookings. */
  isRoomOpen(room: RoomView, range: DayRange): boolean {
    return (
      room.isActive !== false &&
      rangesCover(room.availability ?? [], range) &&
      !(room.blocks ?? []).some((block) => rangesOverlap(block, range))
    );
  }

  /** Occupying reservations (Confirmed or unexpired hold) on these rooms. */
  async findOccupying(
    roomIds: Types.ObjectId[],
    range: DayRange,
    excludeBookingId?: Types.ObjectId,
  ): Promise<HotelBookingView[]> {
    if (roomIds.length === 0) {
      return [];
    }

    const filter: Record<string, unknown> = occupyingOverlapFilter(
      roomIds,
      range.from,
      range.to,
    );
    if (excludeBookingId) {
      filter._id = { $ne: excludeBookingId };
    }

    return this.bookingModel
      .find(filter)
      .lean<HotelBookingView[]>()
      .exec();
  }

  /** Ids of rooms (from `roomIds`) taken by an occupying reservation. */
  async occupiedRoomIds(
    roomIds: Types.ObjectId[],
    range: DayRange,
  ): Promise<Set<string>> {
    const wanted = new Set(roomIds.map(String));
    const bookings = await this.findOccupying(roomIds, range);
    const taken = new Set<string>();

    for (const booking of bookings) {
      for (const room of booking.rooms ?? []) {
        const id = String(room.roomId);
        if (wanted.has(id)) {
          taken.add(id);
        }
      }
    }

    return taken;
  }

  /** Free rooms among `rooms` for the range (HTL-11, HTL-15). */
  async filterFreeRooms(rooms: RoomView[], range: DayRange): Promise<RoomView[]> {
    const open = rooms.filter((room) => this.isRoomOpen(room, range));
    const taken = await this.occupiedRoomIds(
      open.map((room) => room._id),
      range,
    );

    return open.filter((room) => !taken.has(String(room._id)));
  }

  /**
   * For Member 5 (HTL-16, HTL-18): every room must belong to the hotel and be
   * free for the whole stay, otherwise the whole request is rejected.
   * Returns the rooms with their current price (store it on the booking).
   */
  async assertRoomsBookable(
    hotelId: Types.ObjectId,
    roomIds: Types.ObjectId[],
    range: DayRange,
  ): Promise<RoomView[]> {
    const hotel = await this.hotelModel.findById(hotelId).lean().exec();
    if (!hotel) {
      throw new NotFoundException('Hotel not found');
    }
    if (!isProviderActive(hotel)) {
      throw new BadRequestException('This hotel is not accepting bookings');
    }

    const uniqueIds = [...new Set(roomIds.map(String))].map(
      (id) => new Types.ObjectId(id),
    );
    const rooms = await this.roomModel
      .find({ _id: { $in: uniqueIds }, hotelId })
      .lean<RoomView[]>()
      .exec();

    if (rooms.length !== uniqueIds.length) {
      throw new NotFoundException('One or more rooms were not found in this hotel');
    }

    const free = await this.filterFreeRooms(rooms, range);
    if (free.length !== rooms.length) {
      const freeIds = new Set(free.map((r) => String(r._id)));
      const unavailable = rooms
        .filter((r) => !freeIds.has(String(r._id)))
        .map((r) => r.name);
      throw new ConflictException(
        `These rooms are not available for the selected dates: ${unavailable.join(', ')}`,
      );
    }

    return rooms;
  }

  /** HTL-05/06: Confirmed or Pending Payment reservations overlapping range. */
  async hasActiveReservations(
    roomId: Types.ObjectId,
    range?: DayRange,
  ): Promise<boolean> {
    const filter: Record<string, unknown> = {
      [ROOM_ID_PATH]: roomId,
      ...occupyingStatusFilter(),
    };
    if (range) {
      filter.checkIn = { $lt: range.to };
      filter.checkOut = { $gt: range.from };
    } else {
      filter.checkOut = { $gt: new Date() };
    }

    return Boolean(await this.bookingModel.exists(filter).exec());
  }

  /** HTL-06: a room can be deleted only if it was never reserved. */
  async wasEverReserved(roomId: Types.ObjectId): Promise<boolean> {
    return Boolean(
      await this.bookingModel.exists({ [ROOM_ID_PATH]: roomId }).exec(),
    );
  }

  /** Current and future Confirmed / Pending Payment stays on a room. */
  async activeFutureStays(roomId: Types.ObjectId): Promise<HotelBookingView[]> {
    const filter: Record<string, unknown> = {
      [ROOM_ID_PATH]: roomId,
      checkOut: { $gt: new Date() },
      ...occupyingStatusFilter(),
    };

    return this.bookingModel
      .find(filter)
      .lean<HotelBookingView[]>()
      .exec();
  }
}
