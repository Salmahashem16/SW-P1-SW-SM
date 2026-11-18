import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import type { AuthUser } from '../auth/auth.types';
import { HotelBooking } from '../bookings/schemas/hotel-booking.schema';
import { isDuplicateKeyError } from '../common/mongo-errors';
import { HIDDEN_FIELD } from '../moderation/moderation.constants';
import { visibleTo } from '../moderation/moderation-fields.plugin';
import { CreateReviewDto, UpdateReviewDto } from './dto/review.dto';
import { toObjectId } from './hotel-access';
import type { HotelBookingView } from './hotel-booking-contract';
import { Hotel } from './schemas/hotel.schema';
import { Review } from './schemas/review.schema';

type ReviewView = Review & { _id: Types.ObjectId };
type PopulatedReview = Omit<ReviewView, 'userId'> & {
  userId: { _id: Types.ObjectId; name: string } | null;
};

/** HTL-23 (submit, edit, delete) and HTL-24 (list + average). */
@Injectable()
export class ReviewsService {
  constructor(
    @InjectModel(Review.name) private readonly reviewModel: Model<Review>,
    @InjectModel(Hotel.name) private readonly hotelModel: Model<Hotel>,
    @InjectModel(HotelBooking.name)
    private readonly bookingModel: Model<HotelBooking>,
  ) {}

  /**
   * One review per Completed reservation. A Confirmed reservation whose
   * check-out has passed counts as Completed (GEN-11), in case the status
   * job has not run yet.
   */
  async create(user: AuthUser, bookingId: string, dto: CreateReviewDto) {
    const booking = await this.bookingModel
      .findById(toObjectId(bookingId, 'Reservation'))
      .lean<HotelBookingView>()
      .exec();

    // ACC-11: other users' reservations look like they don't exist.
    if (!booking || String(booking.userId) !== user.userId) {
      throw new NotFoundException('Reservation not found');
    }

    const completed =
      booking.status === 'completed' ||
      (booking.status === 'confirmed' && booking.checkOut <= new Date());
    if (!completed) {
      throw new BadRequestException(
        'You can review a stay only after it is completed',
      );
    }

    try {
      const review = await this.reviewModel.create({
        hotelId: booking.hotelId,
        bookingId: booking._id,
        userId: new Types.ObjectId(user.userId),
        rating: dto.rating,
        comment: dto.comment ?? null,
      });

      await this.recalculate(booking.hotelId);
      return toReviewResponse(review.toObject() as ReviewView);
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException('You have already reviewed this reservation');
      }
      throw error;
    }
  }

  async update(user: AuthUser, id: string, dto: UpdateReviewDto) {
    const review = await this.getOwnReview(user, id);

    if (Object.keys(dto).length === 0) {
      throw new BadRequestException('Nothing to update');
    }

    const updated = await this.reviewModel
      .findByIdAndUpdate(review._id, { $set: dto }, { returnDocument: 'after', runValidators: true })
      .lean<ReviewView>()
      .exec();

    await this.recalculate(review.hotelId);
    return toReviewResponse(updated!);
  }

  async remove(user: AuthUser, id: string) {
    const review = await this.getOwnReview(user, id);
    await this.reviewModel.deleteOne({ _id: review._id }).exec();
    await this.recalculate(review.hotelId);
    return { message: 'Review deleted' };
  }

  /** HTL-24: newest first, paginated, with the average and count. */
  async listForHotel(hotelId: string, paging: { page?: number; limit?: number }) {
    const hotelOid = toObjectId(hotelId, 'Hotel');
    const page = paging.page ?? 1;
    const limit = paging.limit ?? 10;

    if (!(await this.hotelModel.exists({ _id: hotelOid }).exec())) {
      throw new NotFoundException('Hotel not found');
    }

    // Public list: hidden reviews (GEN-10) are left out.
    const filter = { $and: [{ hotelId: hotelOid }, visibleTo('review', undefined)] };

    const [items, total, stats] = await Promise.all([
      this.reviewModel
        .find(filter)
        .sort({ createdAt: -1, _id: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('userId', 'name')
        .lean<PopulatedReview[]>()
        .exec(),
      this.reviewModel.countDocuments(filter).exec(),
      this.stats(hotelOid),
    ]);

    return {
      hotelId,
      ratingAverage: stats.ratingAverage,
      ratingCount: stats.ratingCount,
      items: items.map((r) => ({
        ...toReviewResponse({ ...r, userId: r.userId?._id ?? null } as unknown as ReviewView),
        author: r.userId ? { id: String(r.userId._id), name: r.userId.name } : null,
      })),
      page,
      limit,
      total,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** Keeps Hotel.ratingAverage / ratingCount in sync (used by search, HTL-12). */
  async recalculate(hotelId: Types.ObjectId) {
    const stats = await this.stats(hotelId);
    await this.hotelModel
      .updateOne({ _id: hotelId }, { $set: stats })
      .exec();
    return stats;
  }

  private async stats(hotelId: Types.ObjectId) {
    const [row] = await this.reviewModel
      .aggregate<{ avg: number; count: number }>([
        { $match: { hotelId, [HIDDEN_FIELD]: { $ne: true } } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } },
      ])
      .exec();

    return {
      ratingAverage: row ? Math.round(row.avg * 10) / 10 : null,
      ratingCount: row?.count ?? 0,
    };
  }

  private async getOwnReview(user: AuthUser, id: string) {
    const review = await this.reviewModel
      .findById(toObjectId(id, 'Review'))
      .lean<ReviewView>()
      .exec();

    if (!review || String(review.userId) !== user.userId) {
      throw new NotFoundException('Review not found');
    }

    return review;
  }
}

function toReviewResponse(review: ReviewView) {
  return {
    id: String(review._id),
    hotelId: String(review.hotelId),
    bookingId: String(review.bookingId),
    userId: review.userId ? String(review.userId) : null,
    rating: review.rating,
    comment: review.comment ?? null,
    createdAt: review.createdAt,
    updatedAt: review.updatedAt,
  };
}
