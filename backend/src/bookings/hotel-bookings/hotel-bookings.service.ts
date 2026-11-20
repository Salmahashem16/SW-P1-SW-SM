import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import type { AuthUser } from '../../auth/auth.types';
import { assertOwnerOrRole } from '../../auth/ownership';
import { DomainEvents } from '../../common/events/domain-events';
import { isDuplicateKeyError } from '../../common/mongo-errors';
import { formatDay, nightsBetween, parseRange, startOfDay } from '../../hotels/date-range.util';
import { toObjectId } from '../../hotels/hotel-access';
import { HotelInventoryService } from '../../hotels/hotel-inventory.service';
import type { RoomView } from '../../hotels/hotel-inventory.service';
import { computeHotelRefund } from '../../hotels/hotel-policy.util';
import { Hotel } from '../../hotels/schemas/hotel.schema';
import { Room } from '../../hotels/schemas/room.schema';
import { PLATFORM_CURRENCY } from '../booking-status';
import { HotelBooking } from '../schemas/hotel-booking.schema';
import type { RefundStatus } from '../schemas/hotel-booking.schema';
import {
  CreateHotelBookingDto,
  ListMyHotelBookingsQueryDto,
} from './dto/hotel-booking.dto';
import {
  assertGuestsFit,
  bookingGroup,
  bookingGroupFilter,
  effectiveStatus,
  generateBookingReference,
  holdExpiry,
  isHoldExpired,
  priceStay,
} from './hotel-booking.rules';
import type { RoomSelection } from './hotel-booking.rules';

type BookingDoc = HotelBooking & { _id: Types.ObjectId };
type HotelSummary = Pick<Hotel, 'name' | 'city' | 'country' | 'address'> & {
  _id: Types.ObjectId;
};

/** Hotel reservations: HTL-16, 17, 18, 20, 21 and the GEN-11 lifecycle. */
@Injectable()
export class HotelBookingsService {
  constructor(
    @InjectModel(HotelBooking.name)
    private readonly bookingModel: Model<HotelBooking>,
    @InjectModel(Hotel.name) private readonly hotelModel: Model<Hotel>,
    @InjectModel(Room.name) private readonly roomModel: Model<Room>,
    private readonly inventory: HotelInventoryService,
    private readonly events: DomainEvents,
  ) {}

  /**
   * HTL-16 + HTL-18: hold every selected room together for 10 minutes as one
   * Pending Payment reservation. Any unavailable room rejects the whole
   * request.
   */
  async createHold(user: AuthUser, dto: CreateHotelBookingDto) {
    const stay = parseRange(dto.checkIn, dto.checkOut, {
      fromField: 'checkIn',
      toField: 'checkOut',
      notInPast: true,
    });
    const hotelId = toObjectId(dto.hotelId, 'Hotel');

    const selections: RoomSelection[] = dto.rooms.map((room) => ({
      roomId: String(toObjectId(room.roomId, 'Room')),
      adults: room.adults,
      children: room.children ?? [],
    }));
    const roomIds = selections.map((s) => new Types.ObjectId(s.roomId));

    if (new Set(selections.map((s) => s.roomId)).size !== selections.length) {
      throw new BadRequestException('Each room can be selected only once');
    }

    // Hotel active, rooms in this hotel, open and not occupied (Member 4).
    const rooms = await this.inventory.assertRoomsBookable(hotelId, roomIds, stay);
    const roomsById = new Map(rooms.map((room) => [String(room._id), room]));
    assertGuestsFit(selections, roomsById);

    const hotel = await this.hotelModel.findById(hotelId).lean().exec();
    const nights = nightsBetween(stay.from, stay.to);
    const prices = selections.map((s) => roomsById.get(s.roomId)!.pricePerNight);
    const { subtotals, total } = priceStay(prices, nights);

    const booking = await this.bookingModel.create({
      userId: new Types.ObjectId(user.userId),
      hotelId,
      checkIn: stay.from,
      checkOut: stay.to,
      nights,
      rooms: selections.map((s, i) => {
        const room = roomsById.get(s.roomId)!;
        return {
          roomId: room._id,
          name: room.name,
          type: room.type ?? null,
          pricePerNight: room.pricePerNight,
          adults: s.adults,
          children: s.children,
          subtotal: subtotals[i],
        };
      }),
      totalAmount: total,
      currency: PLATFORM_CURRENCY,
      status: 'pendingPayment',
      holdExpiresAt: holdExpiry(),
      checkInTime: hotel?.checkInTime ?? null,
      checkOutTime: hotel?.checkOutTime ?? null,
      cancellationTiers: (hotel?.cancellationTiers ?? []).map((tier) => ({
        daysBeforeCheckIn: tier.daysBeforeCheckIn,
        refundPercentage: tier.refundPercentage,
      })),
    });

    // Write, then verify: if another hold or a room block landed at the same
    // time, give the rooms up. Both racing requests may lose, never both win.
    await this.releaseIfRaced(booking._id, roomIds, stay);

    return this.toResponse(booking.toObject() as BookingDoc, hotel);
  }

  private async releaseIfRaced(
    bookingId: Types.ObjectId,
    roomIds: Types.ObjectId[],
    stay: { from: Date; to: Date },
  ) {
    const [others, rooms] = await Promise.all([
      this.inventory.findOccupying(roomIds, stay, bookingId),
      this.roomModel.find({ _id: { $in: roomIds } }).lean<RoomView[]>().exec(),
    ]);
    const stillOpen =
      rooms.length === roomIds.length &&
      rooms.every((room) => this.inventory.isRoomOpen(room, stay));

    if (others.length > 0 || !stillOpen) {
      await this.bookingModel.deleteOne({ _id: bookingId }).exec();
      throw new ConflictException(
        'Some of these rooms were just booked by someone else. Please search again.',
      );
    }
  }

  /** HTL-20: the user's reservations, optionally one group, newest stay first. */
  async listMine(user: AuthUser, query: ListMyHotelBookingsQueryDto) {
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;
    const now = new Date();

    const filter: Record<string, unknown> = {
      userId: new Types.ObjectId(user.userId),
      ...(query.group ? bookingGroupFilter(query.group, now) : {}),
    };
    const sort: Record<string, 1 | -1> =
      query.group === 'upcoming' ? { checkIn: 1, _id: 1 } : { checkIn: -1, _id: -1 };

    const [items, total] = await Promise.all([
      this.bookingModel
        .find(filter)
        .sort(sort)
        .skip((page - 1) * limit)
        .limit(limit)
        .lean<BookingDoc[]>()
        .exec(),
      this.bookingModel.countDocuments(filter).exec(),
    ]);

    const hotels = await this.hotelsById(items.map((b) => b.hotelId));

    return {
      items: items.map((b) => this.toResponse(b, hotels.get(String(b.hotelId)), now)),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** HTL-20 detail: the owner, or an admin (ACC-17). */
  async getOne(user: AuthUser, id: string) {
    const booking = await this.findVisible(user, id, ['admin']);
    const hotel = await this.hotelModel.findById(booking.hotelId).lean().exec();
    return this.toResponse(booking, hotel);
  }

  /** PAY-02: what the user must accept before paying. */
  async getPolicies(user: AuthUser, id: string) {
    const booking = await this.findVisible(user, id);
    const hotel = await this.hotelModel.findById(booking.hotelId).lean().exec();

    return {
      bookingId: String(booking._id),
      bookingType: 'hotel',
      hotel: hotel ? { id: String(hotel._id), name: hotel.name } : null,
      checkIn: formatDay(booking.checkIn),
      checkOut: formatDay(booking.checkOut),
      checkInTime: booking.checkInTime,
      checkOutTime: booking.checkOutTime,
      cancellationTiers: [...(booking.cancellationTiers ?? [])].sort(
        (a, b) => b.daysBeforeCheckIn - a.daysBeforeCheckIn,
      ),
      totalAmount: booking.totalAmount,
      currency: booking.currency,
      policiesAcceptedAt: booking.policiesAcceptedAt ?? null,
    };
  }

  /** PAY-02: store the acceptance with a timestamp. */
  async acceptPolicies(user: AuthUser, id: string) {
    const booking = await this.findVisible(user, id);
    this.assertPayable(booking);

    const acceptedAt = booking.policiesAcceptedAt ?? new Date();
    if (!booking.policiesAcceptedAt) {
      await this.bookingModel
        .updateOne({ _id: booking._id }, { $set: { policiesAcceptedAt: acceptedAt } })
        .exec();
    }

    return { bookingId: String(booking._id), policiesAcceptedAt: acceptedAt };
  }

  /**
   * For the payment service (PAY-01): what to charge. Throws unless the
   * reservation is the user's, still held, and its policies are accepted.
   */
  async getPayable(user: AuthUser, id: string) {
    const booking = await this.findVisible(user, id);
    this.assertPayable(booking);
    if (!booking.policiesAcceptedAt) {
      throw new BadRequestException('Accept the hotel policies before paying');
    }

    return {
      bookingId: String(booking._id),
      bookingType: 'hotel' as const,
      userId: String(booking.userId),
      amount: booking.totalAmount,
      currency: booking.currency,
      holdExpiresAt: booking.holdExpiresAt,
    };
  }

  /**
   * HTL-17: called by the payment service after it has verified the payment
   * (Stripe webhook). Confirms the whole reservation at once and gives it a
   * unique booking reference. Refuses if the hold has already expired.
   */
  async confirmPayment(bookingId: string, paymentId: string) {
    const id = toObjectId(bookingId, 'Reservation');
    const now = new Date();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      try {
        const confirmed = await this.bookingModel
          .findOneAndUpdate(
            {
              _id: id,
              status: 'pendingPayment',
              holdExpiresAt: { $gt: now },
              policiesAcceptedAt: { $ne: null },
            },
            {
              $set: {
                status: 'confirmed',
                bookingReference: generateBookingReference(),
                paymentId,
                confirmedAt: now,
                holdExpiresAt: null,
              },
            },
            { returnDocument: 'after' },
          )
          .lean<BookingDoc>()
          .exec();

        if (!confirmed) {
          return this.explainNotConfirmable(id, paymentId);
        }

        const hotel = await this.hotelModel.findById(confirmed.hotelId).lean().exec();
        void this.events.emit('hotelBooking.confirmed', {
          bookingId: String(confirmed._id),
          userId: String(confirmed.userId),
          hotelId: String(confirmed.hotelId),
          hotelName: hotel?.name ?? '',
          bookingReference: confirmed.bookingReference!,
          checkIn: formatDay(confirmed.checkIn),
          checkOut: formatDay(confirmed.checkOut),
          totalAmount: confirmed.totalAmount,
          currency: confirmed.currency,
        });

        return this.toResponse(confirmed, hotel);
      } catch (error) {
        // Reference collision: try another one.
        if (!isDuplicateKeyError(error)) {
          throw error;
        }
      }
    }

    throw new ConflictException('Could not generate a booking reference, please retry');
  }

  private async explainNotConfirmable(id: Types.ObjectId, paymentId: string) {
    const booking = await this.bookingModel.findById(id).lean<BookingDoc>().exec();
    if (!booking) {
      throw new NotFoundException('Reservation not found');
    }
    // Same payment delivered twice (webhooks can repeat): already done.
    if (booking.status === 'confirmed' && booking.paymentId === paymentId) {
      return this.toResponse(booking);
    }
    if (!booking.policiesAcceptedAt) {
      throw new BadRequestException('The hotel policies were not accepted');
    }
    throw new ConflictException(
      isHoldExpired(booking) || booking.status === 'expired'
        ? 'The hold on these rooms has expired'
        : `Reservation is ${booking.status} and cannot be confirmed`,
    );
  }

  /** HTL-21: refund the user would get if they cancelled now. */
  async cancellationPreview(user: AuthUser, id: string) {
    const booking = await this.findVisible(user, id);
    this.assertCancellable(booking);
    return {
      bookingId: String(booking._id),
      totalAmount: booking.totalAmount,
      currency: booking.currency,
      ...computeHotelRefund(booking.cancellationTiers ?? [], booking.checkIn, booking.totalAmount),
    };
  }

  /**
   * HTL-21: cancel the whole Confirmed reservation before check-in. The
   * refund uses the hotel's tiers as they were when the user booked, on the
   * full total. PAY-03 issues the money back and updates refundStatus.
   */
  async cancel(user: AuthUser, id: string) {
    const booking = await this.findVisible(user, id);
    this.assertCancellable(booking);

    const now = new Date();
    const refund = computeHotelRefund(
      booking.cancellationTiers ?? [],
      booking.checkIn,
      booking.totalAmount,
      now,
    );
    const refundStatus: RefundStatus = refund.refundAmount > 0 ? 'pending' : 'none';

    const cancelled = await this.bookingModel
      .findOneAndUpdate(
        { _id: booking._id, status: 'confirmed' },
        {
          $set: {
            status: 'cancelled',
            cancelledAt: now,
            refundPercentage: refund.refundPercentage,
            refundAmount: refund.refundAmount,
            refundStatus,
          },
        },
        { returnDocument: 'after' },
      )
      .lean<BookingDoc>()
      .exec();

    if (!cancelled) {
      throw new ConflictException('This reservation was already changed, please reload it');
    }

    const hotel = await this.hotelModel.findById(cancelled.hotelId).lean().exec();
    void this.events.emit('hotelBooking.cancelled', {
      bookingId: String(cancelled._id),
      userId: String(cancelled.userId),
      hotelId: String(cancelled.hotelId),
      hotelName: hotel?.name ?? '',
      bookingReference: cancelled.bookingReference,
      paymentId: cancelled.paymentId,
      refundAmount: refund.refundAmount,
      currency: cancelled.currency,
    });

    return {
      ...this.toResponse(cancelled, hotel, now),
      refund: {
        daysBeforeCheckIn: refund.daysBeforeCheckIn,
        appliedTier: refund.appliedTier,
      },
    };
  }

  /** PAY-03: the payment service reports the refund outcome. */
  async recordRefund(bookingId: string, status: RefundStatus, refundId: string | null) {
    const id = toObjectId(bookingId, 'Reservation');
    const updated = await this.bookingModel
      .findOneAndUpdate(
        { _id: id, status: 'cancelled' },
        { $set: { refundStatus: status, refundId } },
        { returnDocument: 'after' },
      )
      .lean<BookingDoc>()
      .exec();
    if (!updated) {
      throw new NotFoundException('Cancelled reservation not found');
    }
    return this.toResponse(updated);
  }

  /** GEN-11 / HTL-18: Pending Payment holds past their expiry become Expired. */
  async expireHolds(now: Date = new Date()): Promise<number> {
    const result = await this.bookingModel
      .updateMany(
        { status: 'pendingPayment', holdExpiresAt: { $lte: now } },
        { $set: { status: 'expired' } },
      )
      .exec();
    return result.modifiedCount;
  }

  /** GEN-11 / HTL-23: Confirmed stays become Completed after check-out. */
  async completeStays(now: Date = new Date()): Promise<number> {
    const result = await this.bookingModel
      .updateMany(
        { status: 'confirmed', checkOut: { $lte: now } },
        { $set: { status: 'completed', completedAt: now } },
      )
      .exec();
    return result.modifiedCount;
  }

  // --- helpers ---

  /** ACC-11: other users' reservations look like they don't exist. */
  private async findVisible(
    user: AuthUser,
    id: string,
    extraRoles: AuthUser['role'][] = [],
  ): Promise<BookingDoc> {
    const booking = await this.bookingModel
      .findById(toObjectId(id, 'Reservation'))
      .lean<BookingDoc>()
      .exec();
    if (!booking) {
      throw new NotFoundException('Reservation not found');
    }
    assertOwnerOrRole(user, booking.userId, extraRoles, 'Reservation not found');
    return booking;
  }

  private assertPayable(booking: BookingDoc) {
    if (booking.status !== 'pendingPayment' || isHoldExpired(booking)) {
      throw new ConflictException(
        isHoldExpired(booking) || booking.status === 'expired'
          ? 'The hold on these rooms has expired. Please book again.'
          : `Reservation is ${booking.status}, not awaiting payment`,
      );
    }
  }

  private assertCancellable(booking: BookingDoc) {
    if (effectiveStatus(booking) !== 'confirmed') {
      throw new BadRequestException('Only Confirmed reservations can be cancelled');
    }
    if (startOfDay() >= booking.checkIn) {
      throw new BadRequestException('Reservations can only be cancelled before the check-in day');
    }
  }

  private async hotelsById(ids: Types.ObjectId[]) {
    const unique = [...new Set(ids.map(String))].map((id) => new Types.ObjectId(id));
    const hotels = await this.hotelModel
      .find({ _id: { $in: unique } })
      .select('name city country address')
      .lean<HotelSummary[]>()
      .exec();
    return new Map(hotels.map((h) => [String(h._id), h]));
  }

  private toResponse(
    booking: BookingDoc,
    hotel?: Partial<HotelSummary> | null,
    now: Date = new Date(),
  ) {
    return {
      id: String(booking._id),
      bookingReference: booking.bookingReference ?? null,
      status: effectiveStatus(booking, now),
      group: bookingGroup(booking, now),
      hotel: hotel
        ? {
            id: String(booking.hotelId),
            name: hotel.name ?? null,
            city: hotel.city ?? null,
            country: hotel.country ?? null,
            address: hotel.address ?? null,
          }
        : { id: String(booking.hotelId) },
      checkIn: formatDay(booking.checkIn),
      checkOut: formatDay(booking.checkOut),
      checkInTime: booking.checkInTime ?? null,
      checkOutTime: booking.checkOutTime ?? null,
      nights: booking.nights,
      rooms: (booking.rooms ?? []).map((room) => ({
        roomId: String(room.roomId),
        name: room.name,
        type: room.type ?? null,
        pricePerNight: room.pricePerNight,
        adults: room.adults,
        children: room.children ?? [],
        subtotal: room.subtotal,
      })),
      totalAmount: booking.totalAmount,
      currency: booking.currency,
      holdExpiresAt: booking.status === 'pendingPayment' ? booking.holdExpiresAt : null,
      cancellationTiers: booking.cancellationTiers ?? [],
      policiesAcceptedAt: booking.policiesAcceptedAt ?? null,
      paymentId: booking.paymentId ?? null,
      confirmedAt: booking.confirmedAt ?? null,
      cancelledAt: booking.cancelledAt ?? null,
      refundPercentage: booking.refundPercentage ?? null,
      refundAmount: booking.refundAmount ?? null,
      refundStatus: booking.refundStatus ?? 'none',
      createdAt: booking.createdAt,
    };
  }
}
