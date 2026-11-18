import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import type { AuthUser } from '../auth/auth.types';
import { HotelBooking } from '../bookings/schemas/hotel-booking.schema';
import { isProviderActive } from '../common/provider-status';
import { ImageStorageService } from '../common/uploads/image-storage.service';
import { MAX_IMAGES_PER_ITEM } from '../common/uploads/image-upload';
import type { UploadedImage } from '../common/uploads/image-upload';
import {
  addDays,
  formatDay,
  nightsBetween,
  parseDay,
  parseRange,
  rangesCover,
  rangesOverlap,
} from './date-range.util';
import {
  AvailabilityCalendarQueryDto,
  ListReservationsQueryDto,
  OptionalStayQueryDto,
} from './dto/hotel-query.dto';
import { CreateHotelDto, UpdateHotelDto, UpdateHotelPoliciesDto } from './dto/hotel.dto';
import { assertCanManageHotel, toObjectId } from './hotel-access';
import type { HotelBookingView } from './hotel-booking-contract';
import { HotelInventoryService } from './hotel-inventory.service';
import type { RoomView } from './hotel-inventory.service';
import { HotelSearchService } from './hotel-search.service';
import { ReviewsService } from './reviews.service';
import { Hotel } from './schemas/hotel.schema';
import { Room } from './schemas/room.schema';

type HotelView = Hotel & { _id: Types.ObjectId };

const MAX_CALENDAR_NIGHTS = 62;

@Injectable()
export class HotelsService {
  constructor(
    @InjectModel(Hotel.name) private readonly hotelModel: Model<Hotel>,
    @InjectModel(Room.name) private readonly roomModel: Model<Room>,
    @InjectModel(HotelBooking.name)
    private readonly bookingModel: Model<HotelBooking>,
    private readonly inventory: HotelInventoryService,
    private readonly search: HotelSearchService,
    private readonly reviews: ReviewsService,
    private readonly images: ImageStorageService,
  ) {}

  /** HTL-01: admin creates a hotel profile. */
  async create(dto: CreateHotelDto) {
    const hotel = await this.hotelModel.create(dto);
    return toHotelResponse(hotel.toObject() as HotelView);
  }

  /** HTL-01: the hotel's moderator (or an admin) edits the profile. */
  async update(user: AuthUser, id: string, dto: UpdateHotelDto) {
    const oid = toObjectId(id, 'Hotel');
    assertCanManageHotel(user, id, { allowAdmin: true });

    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Nothing to update');
    }

    const hotel = await this.hotelModel
      .findByIdAndUpdate(oid, { $set: dto }, { returnDocument: 'after', runValidators: true })
      .lean<HotelView>()
      .exec();

    if (!hotel) {
      throw new NotFoundException('Hotel not found');
    }

    return toHotelResponse(hotel);
  }

  /**
   * HTL-02: profile, photos, amenities, check-in/out times, cancellation
   * policy, rating and latest reviews; free rooms when dates are given.
   */
  async getDetails(id: string, query: OptionalStayQueryDto) {
    const hotel = await this.getHotel(id);
    const [reviewSummary, availableRooms] = await Promise.all([
      this.reviews.listForHotel(id, { page: 1, limit: 5 }),
      query.checkIn && query.checkOut && isProviderActive(hotel)
        ? this.search.availableRooms(id, query.checkIn, query.checkOut)
        : Promise.resolve(null),
    ]);

    return {
      ...toHotelResponse(hotel),
      latestReviews: reviewSummary.items,
      availability: availableRooms,
    };
  }

  /** HTL-09 and HTL-10. Thresholds must be unique. */
  async setPolicies(user: AuthUser, id: string, dto: UpdateHotelPoliciesDto) {
    const oid = toObjectId(id, 'Hotel');
    assertCanManageHotel(user, id);

    const thresholds = dto.cancellationTiers.map((t) => t.daysBeforeCheckIn);
    if (new Set(thresholds).size !== thresholds.length) {
      throw new BadRequestException(
        'Each cancellation tier must have a unique daysBeforeCheckIn',
      );
    }

    const tiers = [...dto.cancellationTiers].sort(
      (a, b) => b.daysBeforeCheckIn - a.daysBeforeCheckIn,
    );

    const hotel = await this.hotelModel
      .findByIdAndUpdate(
        oid,
        {
          $set: {
            checkInTime: dto.checkInTime,
            checkOutTime: dto.checkOutTime,
            cancellationTiers: tiers,
          },
        },
        { returnDocument: 'after', runValidators: true },
      )
      .lean<HotelView>()
      .exec();

    if (!hotel) {
      throw new NotFoundException('Hotel not found');
    }

    return toHotelResponse(hotel);
  }

  /** GEN-08: up to 5 photos per hotel. */
  async addPhotos(user: AuthUser, id: string, files: UploadedImage[]) {
    const oid = toObjectId(id, 'Hotel');
    assertCanManageHotel(user, id, { allowAdmin: true });
    await this.getHotel(id);

    const saved = await this.images.saveAll(files);
    const photos = saved.map((s) => ({ _id: new Types.ObjectId(), ...s }));

    // Atomic limit check so concurrent uploads can't exceed 5.
    const hotel = await this.hotelModel
      .findOneAndUpdate(
        {
          _id: oid,
          $expr: {
            $lte: [{ $add: [{ $size: { $ifNull: ['$photos', []] } }, photos.length] }, MAX_IMAGES_PER_ITEM],
          },
        },
        { $push: { photos: { $each: photos } } },
        { returnDocument: 'after' },
      )
      .lean<HotelView>()
      .exec();

    if (!hotel) {
      await this.images.removeAll(saved.map((s) => s.filename));
      throw new BadRequestException(
        `A hotel can have at most ${MAX_IMAGES_PER_ITEM} photos`,
      );
    }

    return toHotelResponse(hotel);
  }

  async removePhoto(user: AuthUser, id: string, photoId: string) {
    const oid = toObjectId(id, 'Hotel');
    assertCanManageHotel(user, id, { allowAdmin: true });
    const photoOid = toObjectId(photoId, 'Photo');

    const before = await this.hotelModel
      .findOneAndUpdate(
        { _id: oid, 'photos._id': photoOid },
        { $pull: { photos: { _id: photoOid } } },
        { returnDocument: 'before' },
      )
      .lean<HotelView>()
      .exec();

    if (!before) {
      throw new NotFoundException('Photo not found');
    }

    const removed = before.photos.find((p) => String(p._id) === photoId);
    if (removed) {
      await this.images.remove(removed.filename);
    }

    return { message: 'Photo removed' };
  }

  /** HTL-08: each room's status per night: Available, Booked or Blocked. */
  async availabilityCalendar(
    user: AuthUser,
    id: string,
    query: AvailabilityCalendarQueryDto,
  ) {
    assertCanManageHotel(user, id, { allowAdmin: true });
    const hotel = await this.getHotel(id);
    const range = parseRange(query.from, query.to);
    const nights = nightsBetween(range.from, range.to);

    if (nights > MAX_CALENDAR_NIGHTS) {
      throw new BadRequestException(
        `The date range can be at most ${MAX_CALENDAR_NIGHTS} nights`,
      );
    }

    const rooms = await this.roomModel
      .find({ hotelId: hotel._id })
      .sort({ name: 1 })
      .lean<RoomView[]>()
      .exec();
    const bookings = await this.inventory.findOccupying(
      rooms.map((r) => r._id),
      range,
    );

    return {
      hotelId: id,
      from: formatDay(range.from),
      to: formatDay(range.to),
      rooms: rooms.map((room) => ({
        id: String(room._id),
        name: room.name,
        type: room.type,
        isActive: room.isActive !== false,
        days: Array.from({ length: nights }, (_, i) =>
          dayStatus(room, addDays(range.from, i), bookings),
        ),
      })),
    };
  }

  /** HTL-22: reservations for the moderator's hotel (guest, dates, status). */
  async listReservations(user: AuthUser, id: string, query: ListReservationsQueryDto) {
    assertCanManageHotel(user, id, { allowAdmin: true });
    const hotel = await this.getHotel(id);
    const page = query.page ?? 1;
    const limit = query.limit ?? 10;

    const filter: Record<string, unknown> = { hotelId: hotel._id };
    if (query.status) filter.status = query.status;
    if (query.from) filter.checkOut = { $gt: parseDay(query.from, 'from') };
    if (query.to) filter.checkIn = { $lt: parseDay(query.to, 'to') };

    const [items, total] = await Promise.all([
      this.bookingModel
        .find(filter)
        .sort({ checkIn: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'name email')
        .lean<(HotelBookingView & { userId: { _id: Types.ObjectId; name: string; email: string } | null })[]>()
        .exec(),
      this.bookingModel.countDocuments(filter).exec(),
    ]);

    const roomIds = items.flatMap((b) => (b.rooms ?? []).map((r) => r.roomId));
    const roomNames = new Map(
      (
        await this.roomModel
          .find({ _id: { $in: roomIds } })
          .select('name')
          .lean<{ _id: Types.ObjectId; name: string }[]>()
          .exec()
      ).map((r) => [String(r._id), r.name]),
    );

    return {
      items: items.map((b) => ({
        id: String(b._id),
        bookingReference: b.bookingReference,
        guest: b.userId
          ? { id: String(b.userId._id), name: b.userId.name, email: b.userId.email }
          : null,
        checkIn: formatDay(b.checkIn),
        checkOut: formatDay(b.checkOut),
        rooms: (b.rooms ?? []).map((r) => ({
          id: String(r.roomId),
          name: roomNames.get(String(r.roomId)) ?? null,
          adults: r.adults ?? null,
          children: r.children ?? [],
        })),
        totalAmount: b.totalAmount,
        currency: b.currency,
        status: b.status,
        createdAt: b.createdAt,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  private async getHotel(id: string): Promise<HotelView> {
    const hotel = await this.hotelModel
      .findById(toObjectId(id, 'Hotel'))
      .lean<HotelView>()
      .exec();

    if (!hotel) {
      throw new NotFoundException('Hotel not found');
    }

    return hotel;
  }
}

function dayStatus(room: RoomView, day: Date, bookings: HotelBookingView[]) {
  const night = { from: day, to: addDays(day, 1) };
  const date = formatDay(day);

  if ((room.blocks ?? []).some((b) => rangesOverlap(b, night))) {
    return { date, status: 'Blocked' as const };
  }

  const booking = bookings.find(
    (b) =>
      (b.rooms ?? []).some((r) => String(r.roomId) === String(room._id)) &&
      rangesOverlap({ from: b.checkIn, to: b.checkOut }, night),
  );
  if (booking) {
    return {
      date,
      status: 'Booked' as const,
      bookingReference: booking.bookingReference,
      bookingStatus: booking.status,
    };
  }

  if (room.isActive !== false && rangesCover(room.availability ?? [], night)) {
    return { date, status: 'Available' as const };
  }

  // Outside the room's bookable ranges, or the room is deactivated.
  return { date, status: 'Unavailable' as const };
}

export function toHotelResponse(hotel: HotelView) {
  return {
    id: String(hotel._id),
    name: hotel.name,
    address: hotel.address ?? '',
    city: hotel.city ?? '',
    country: hotel.country ?? '',
    description: hotel.description ?? '',
    starClass: hotel.starClass ?? null,
    amenities: hotel.amenities ?? [],
    photos: (hotel.photos ?? []).map((p) => ({ id: String(p._id), url: p.url })),
    checkInTime: hotel.checkInTime ?? '14:00',
    checkOutTime: hotel.checkOutTime ?? '12:00',
    cancellationTiers: (hotel.cancellationTiers ?? []).map((t) => ({
      daysBeforeCheckIn: t.daysBeforeCheckIn,
      refundPercentage: t.refundPercentage,
    })),
    ratingAverage: hotel.ratingAverage ?? null,
    ratingCount: hotel.ratingCount ?? 0,
    isActive: isProviderActive(hotel),
    createdAt: hotel.createdAt,
    updatedAt: hotel.updatedAt,
  };
}
