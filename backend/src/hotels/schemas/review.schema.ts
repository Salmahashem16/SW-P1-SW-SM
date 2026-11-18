import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { moderationFieldsPlugin } from '../../moderation/moderation-fields.plugin';

export type ReviewDocument = HydratedDocument<Review>;

/**
 * Owner: Member 4 (Hotels). HTL-23: one rating per Completed reservation,
 * regardless of how many rooms it has.
 *
 * Model name "Review", author field `userId` and text field `comment` are
 * what content moderation expects (moderation.constants.ts, GEN-09/10).
 */
@Schema({ timestamps: true })
export class Review {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true,
  })
  hotelId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'HotelBooking',
    required: true,
    unique: true,
  })
  bookingId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  userId: Types.ObjectId;

  @Prop({ required: true, min: 1, max: 5, validate: Number.isInteger })
  rating: number;

  @Prop({ type: String, trim: true, maxlength: 1000, default: null })
  comment: string | null;

  // Added by moderationFieldsPlugin (GEN-10).
  isHidden: boolean;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ReviewSchema = SchemaFactory.createForClass(Review);

ReviewSchema.plugin(moderationFieldsPlugin);
ReviewSchema.index({ hotelId: 1, createdAt: -1 });
