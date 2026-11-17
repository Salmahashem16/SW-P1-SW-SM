import { BadRequestException, Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import type { PipelineStage } from 'mongoose';

import type { BookingType } from '../bookings/booking-status';
import { FlightBooking } from '../bookings/schemas/flight-booking.schema';
import { HotelBooking } from '../bookings/schemas/hotel-booking.schema';
import { Airline } from '../flights/schemas/airline.schema';
import { Hotel } from '../hotels/schemas/hotel.schema';
import { User } from '../users/schemas/user.schema';
import { ListBookingsQueryDto } from './dto/list-bookings-query.dto';

const DAY_MS = 24 * 60 * 60 * 1000;
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

type Row = {
  _id: Types.ObjectId;
  type: BookingType;
  reference: string | null;
  startDate: Date;
  endDate: Date | null;
  amount: number;
  currency: string;
  status: string;
  createdAt: Date;
  user: { _id: Types.ObjectId; name: string; email: string } | null;
  provider: { _id: Types.ObjectId; name: string } | null;
};

/**
 * ACC-17: read-only list of every flight booking and hotel reservation,
 * newest first, filterable by type, status and travel-date range. Both
 * collections are combined in one aggregation ($unionWith), so pagination
 * and totals are correct across them.
 */
@Injectable()
export class BookingsAdminService {
  constructor(
    @InjectModel(FlightBooking.name)
    private readonly flightBookings: Model<FlightBooking>,
    @InjectModel(HotelBooking.name)
    private readonly hotelBookings: Model<HotelBooking>,
    @InjectModel(Airline.name) private readonly airlines: Model<Airline>,
    @InjectModel(Hotel.name) private readonly hotels: Model<Hotel>,
    @InjectModel(User.name) private readonly users: Model<User>,
  ) {}

  async list(query: ListBookingsQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 10));
    const range = this.dateRange(query.from, query.to);

    const flightStages = this.stagesFor('flight', query.status, range);
    const hotelStages = this.stagesFor('hotel', query.status, range);

    let base: Model<unknown>;
    let pipeline: PipelineStage[];

    if (query.type === 'flight') {
      base = this.flightBookings as Model<unknown>;
      pipeline = [...flightStages];
    } else if (query.type === 'hotel') {
      base = this.hotelBookings as Model<unknown>;
      pipeline = [...hotelStages];
    } else {
      base = this.flightBookings as Model<unknown>;
      pipeline = [
        ...flightStages,
        {
          $unionWith: {
            coll: this.hotelBookings.collection.name,
            pipeline: hotelStages as PipelineStage.UnionWithPipelineStage[],
          },
        },
      ];
    }

    pipeline.push(
      { $sort: { createdAt: -1, _id: -1 } },
      {
        $facet: {
          items: [
            { $skip: (page - 1) * limit },
            { $limit: limit },
            ...this.lookupStages(),
          ],
          total: [{ $count: 'count' }],
        },
      },
    );

    const [result] = await base
      .aggregate<{ items: Row[]; total: { count: number }[] }>(pipeline)
      .exec();

    const total = result?.total[0]?.count ?? 0;

    return {
      items: (result?.items ?? []).map((row) => ({
        id: row._id.toString(),
        type: row.type,
        reference: row.reference,
        user: row.user
          ? {
              id: row.user._id.toString(),
              name: row.user.name,
              email: row.user.email,
            }
          : null,
        provider: row.provider
          ? { id: row.provider._id.toString(), name: row.provider.name }
          : null,
        startDate: row.startDate,
        endDate: row.endDate,
        amount: row.amount,
        currency: row.currency,
        status: row.status,
        createdAt: row.createdAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Match + project one collection into the shared row shape. */
  private stagesFor(
    type: BookingType,
    status: string | undefined,
    range: { $gte?: Date; $lt?: Date } | null,
  ): PipelineStage[] {
    const startField = type === 'flight' ? 'departureAt' : 'checkIn';

    const match: Record<string, unknown> = {};
    if (status) {
      match.status = status;
    }
    if (range) {
      match[startField] = range;
    }

    return [
      { $match: match },
      {
        $project: {
          type: { $literal: type },
          reference: { $ifNull: ['$bookingReference', null] },
          userId: 1,
          providerId: type === 'flight' ? '$airlineId' : '$hotelId',
          startDate: `$${startField}`,
          endDate: type === 'flight' ? { $literal: null } : '$checkOut',
          amount: '$totalAmount',
          currency: 1,
          status: 1,
          createdAt: 1,
        },
      },
    ];
  }

  /** Runs only on the current page. */
  private lookupStages(): PipelineStage.FacetPipelineStage[] {
    return [
      {
        $lookup: {
          from: this.users.collection.name,
          localField: 'userId',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1, email: 1 } }],
          as: 'user',
        },
      },
      {
        $lookup: {
          from: this.airlines.collection.name,
          localField: 'providerId',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1 } }],
          as: 'airline',
        },
      },
      {
        $lookup: {
          from: this.hotels.collection.name,
          localField: 'providerId',
          foreignField: '_id',
          pipeline: [{ $project: { name: 1 } }],
          as: 'hotel',
        },
      },
      {
        $set: {
          user: { $ifNull: [{ $first: '$user' }, null] },
          provider: {
            $ifNull: [
              {
                $first: {
                  $cond: [{ $eq: ['$type', 'flight'] }, '$airline', '$hotel'],
                },
              },
              null,
            ],
          },
        },
      },
      { $unset: ['airline', 'hotel', 'userId', 'providerId'] },
    ];
  }

  private dateRange(from?: string, to?: string) {
    if (!from && !to) {
      return null;
    }

    const range: { $gte?: Date; $lt?: Date } = {};

    if (from) {
      range.$gte = new Date(from);
    }

    if (to) {
      // A plain date means "through the end of that day".
      range.$lt = DATE_ONLY.test(to)
        ? new Date(new Date(to).getTime() + DAY_MS)
        : new Date(new Date(to).getTime() + 1);
    }

    if (range.$gte && range.$lt && range.$gte >= range.$lt) {
      throw new BadRequestException('"from" must be on or before "to"');
    }

    return range;
  }
}
