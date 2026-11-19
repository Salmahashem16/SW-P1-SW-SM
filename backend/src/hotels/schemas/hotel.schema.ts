import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { providerStatusPlugin } from '../../common/provider-status';

export type HotelDocument = HydratedDocument<Hotel>;

/** GEN-08: a stored hotel photo. `filename` is what the uploads service serves. */
@Schema({ _id: true, timestamps: false })
export class HotelPhoto {
  _id: Types.ObjectId;

  @Prop({ required: true })
  filename: string;

  @Prop({ required: true })
  url: string;
}
export const HotelPhotoSchema = SchemaFactory.createForClass(HotelPhoto);

/** HTL-10: one cancellation tier. Thresholds are unique per hotel. */
@Schema({ _id: false })
export class HotelCancellationTier {
  @Prop({ required: true, min: 0, validate: Number.isInteger })
  daysBeforeCheckIn: number;

  @Prop({ required: true, min: 0, max: 100 })
  refundPercentage: number;
}
export const HotelCancellationTierSchema = SchemaFactory.createForClass(
  HotelCancellationTier,
);

/**
 * Owner: Member 4 (Hotels).
 *
 * Keep: the model name "Hotel", `name`, and the providerStatusPlugin fields
 * (ACC-13, ACC-15, ACC-17 read them).
 */
@Schema({ timestamps: true })
export class Hotel {
  // HTL-01 profile
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true, default: '' })
  address: string;

  /** Matches the seeded reference data names (GEN-12). */
  @Prop({ trim: true, default: '' })
  city: string;

  @Prop({ trim: true, default: '' })
  country: string;

  @Prop({ trim: true, default: '' })
  description: string;

  @Prop({ type: Number, min: 1, max: 5, default: null })
  starClass: number | null;

  @Prop({ type: [String], default: [] })
  amenities: string[];

  @Prop({ type: [HotelPhotoSchema], default: [] })
  photos: HotelPhoto[];

  // HTL-09: "HH:mm", shown on the hotel page and booking summary.
  @Prop({ default: '14:00' })
  checkInTime: string;

  @Prop({ default: '12:00' })
  checkOutTime: string;

  // HTL-10
  @Prop({ type: [HotelCancellationTierSchema], default: [] })
  cancellationTiers: HotelCancellationTier[];

  // HTL-23 / HTL-24: kept up to date by ReviewsService.
  @Prop({ type: Number, default: null })
  ratingAverage: number | null;

  @Prop({ default: 0 })
  ratingCount: number;

  // Added by providerStatusPlugin (ACC-15).
  isActive: boolean;
  deactivatedAt: Date | null;
  deactivatedBy: Types.ObjectId | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const HotelSchema = SchemaFactory.createForClass(Hotel);

HotelSchema.plugin(providerStatusPlugin);

// HTL-11: search by city or country (case-insensitive via collation).
HotelSchema.index({ city: 1 }, { collation: { locale: 'en', strength: 2 } });
HotelSchema.index({ country: 1 }, { collation: { locale: 'en', strength: 2 } });
