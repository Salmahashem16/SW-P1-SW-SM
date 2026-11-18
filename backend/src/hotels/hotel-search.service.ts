import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { activeProviderFilter, isProviderActive } from '../common/provider-status';
import { formatDay, nightsBetween, parseRange } from './date-range.util';
import type { DayRange } from './date-range.util';
import { SearchHotelsDto } from './dto/hotel-query.dto';
import { exactInsensitive, toObjectId } from './hotel-access';
import { HotelInventoryService } from './hotel-inventory.service';
import type { RoomView } from './hotel-inventory.service';
import { Hotel } from './schemas/hotel.schema';
import { Room } from './schemas/room.schema';

type HotelView = Hotel & { _id: Types.ObjectId };

const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * HTL-11, HTL-12, HTL-15. Exported so itineraries (ITN-25, Member 6) can
 * reuse the same search for a city group's dates.
 */
@Injectable()
export class HotelSearchService {
  constructor(
    @InjectModel(Hotel.name) private readonly hotelModel: Model<Hotel>,
    @InjectModel(Room.name) private readonly roomModel: Model<Room>,
    private readonly inventory: HotelInventoryService,
  ) {}

  parseStay(checkIn: string, checkOut: string): DayRange {
    return parseRange(checkIn, checkOut, {
      fromField: 'checkIn',
      toField: 'checkOut',
      notInPast: true,
    });
  }

  async search(dto: SearchHotelsDto) {
    const stay = this.parseStay(dto.checkIn, dto.checkOut);
    const roomsWanted = dto.rooms ?? 1;
    const page = dto.page ?? 1;
    const limit = dto.limit ?? 10;

    if (!dto.city && !dto.country) {
      throw new BadRequestException('city or country is required');
    }
    if (
      dto.minPrice !== undefined &&
      dto.maxPrice !== undefined &&
      dto.minPrice > dto.maxPrice
    ) {
      throw new BadRequestException('minPrice cannot be greater than maxPrice');
    }

    // ACC-15: deactivated hotels are hidden from search.
    const hotelFilter: Record<string, unknown> = { ...activeProviderFilter };
    if (dto.city) hotelFilter.city = exactInsensitive(dto.city);
    if (dto.country) hotelFilter.country = exactInsensitive(dto.country);

    const hotels = await this.hotelModel
      .find(hotelFilter)
      .select('-cancellationTiers')
      .lean<HotelView[]>()
      .exec();

    const freeByHotel = await this.freeRoomsByHotel(
      hotels.map((h) => h._id),
      stay,
    );

    let results = hotels
      .map((hotel) => {
        const free = freeByHotel.get(String(hotel._id)) ?? [];
        if (!qualifies(free, roomsWanted, dto.guests)) {
          return null;
        }

        return {
          hotel,
          freeRooms: free.length,
          minPricePerNight: Math.min(...free.map((r) => r.pricePerNight)),
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    // HTL-12 filters
    if (dto.minPrice !== undefined) {
      results = results.filter((r) => r.minPricePerNight >= dto.minPrice!);
    }
    if (dto.maxPrice !== undefined) {
      results = results.filter((r) => r.minPricePerNight <= dto.maxPrice!);
    }
    if (dto.minRating !== undefined) {
      results = results.filter(
        (r) => r.hotel.ratingAverage != null && r.hotel.ratingAverage >= dto.minRating!,
      );
    }

    // HTL-12 sorting; unrated hotels go last when sorting by rating.
    const direction = dto.order === 'desc' ? -1 : 1;
    results.sort((a, b) => {
      if (dto.sortBy === 'rating') {
        const ra = a.hotel.ratingAverage;
        const rb = b.hotel.ratingAverage;
        if (ra == null || rb == null) {
          if (ra == null && rb == null) return a.hotel.name.localeCompare(b.hotel.name);
          return ra == null ? 1 : -1;
        }
        if (ra !== rb) return (ra - rb) * direction;
      } else if (a.minPricePerNight !== b.minPricePerNight) {
        return (a.minPricePerNight - b.minPricePerNight) * direction;
      }
      return a.hotel.name.localeCompare(b.hotel.name);
    });

    const nights = nightsBetween(stay.from, stay.to);
    const total = results.length;

    return {
      checkIn: formatDay(stay.from),
      checkOut: formatDay(stay.to),
      nights,
      guests: dto.guests,
      rooms: roomsWanted,
      items: results.slice((page - 1) * limit, page * limit).map((r) => ({
        id: String(r.hotel._id),
        name: r.hotel.name,
        address: r.hotel.address,
        city: r.hotel.city,
        country: r.hotel.country,
        starClass: r.hotel.starClass ?? null,
        amenities: r.hotel.amenities ?? [],
        photo: r.hotel.photos?.[0]?.url ?? null,
        ratingAverage: r.hotel.ratingAverage ?? null,
        ratingCount: r.hotel.ratingCount ?? 0,
        freeRooms: r.freeRooms,
        minPricePerNight: r.minPricePerNight,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** HTL-15: every room of the hotel free for the stay, with stay totals. */
  async availableRooms(hotelId: string, checkIn: string, checkOut: string) {
    const stay = this.parseStay(checkIn, checkOut);
    const hotel = await this.hotelModel
      .findById(toObjectId(hotelId, 'Hotel'))
      .lean<HotelView>()
      .exec();

    if (!hotel) {
      throw new NotFoundException('Hotel not found');
    }
    if (!isProviderActive(hotel)) {
      throw new BadRequestException('This hotel is not accepting bookings');
    }

    const free = (await this.freeRoomsByHotel([hotel._id], stay)).get(String(hotel._id)) ?? [];
    const nights = nightsBetween(stay.from, stay.to);

    return {
      hotelId: String(hotel._id),
      checkIn: formatDay(stay.from),
      checkOut: formatDay(stay.to),
      nights,
      rooms: free
        .sort((a, b) => a.pricePerNight - b.pricePerNight || a.name.localeCompare(b.name))
        .map((room) => ({
          id: String(room._id),
          name: room.name,
          type: room.type,
          beds: room.beds,
          maxOccupancy: room.maxOccupancy,
          pricePerNight: room.pricePerNight,
          totalPrice: round2(room.pricePerNight * nights),
        })),
    };
  }

  private async freeRoomsByHotel(hotelIds: Types.ObjectId[], stay: DayRange) {
    const byHotel = new Map<string, RoomView[]>();
    if (hotelIds.length === 0) {
      return byHotel;
    }

    // Pre-filter in MongoDB; exact coverage is checked by the inventory service.
    const candidates = await this.roomModel
      .find({
        hotelId: { $in: hotelIds },
        isActive: { $ne: false },
        availability: { $elemMatch: { from: { $lt: stay.to }, to: { $gt: stay.from } } },
        blocks: { $not: { $elemMatch: { from: { $lt: stay.to }, to: { $gt: stay.from } } } },
      })
      .lean<RoomView[]>()
      .exec();

    const free = await this.inventory.filterFreeRooms(candidates, stay);
    for (const room of free) {
      const key = String(room.hotelId);
      byHotel.set(key, [...(byHotel.get(key) ?? []), room]);
    }

    return byHotel;
  }
}

/**
 * HTL-11: at least `roomsWanted` free rooms whose combined maximum occupancy
 * covers the guests (using the largest rooms).
 */
export function qualifies(
  free: { maxOccupancy: number }[],
  roomsWanted: number,
  guests: number,
): boolean {
  if (free.length < roomsWanted) {
    return false;
  }

  const capacity = free
    .map((r) => r.maxOccupancy)
    .sort((a, b) => b - a)
    .slice(0, roomsWanted)
    .reduce((sum, n) => sum + n, 0);

  return capacity >= guests;
}
