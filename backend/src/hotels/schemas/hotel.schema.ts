import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { providerStatusPlugin } from '../../common/provider-status';

export type HotelDocument = HydratedDocument<Hotel>;

/**
 * Owner: Member 4 (Hotels). Skeleton created early so admin features
 * (ACC-13, ACC-15, ACC-17) can reference it. Add your own fields (address,
 * city, country, photos, star class, amenities, policies, ...) here.
 *
 * Please keep: the class/model name "Hotel", `name`, and the status fields
 * from providerStatusPlugin.
 */
@Schema({ timestamps: true })
export class Hotel {
  @Prop({ required: true, trim: true })
  name: string;

  // Added by providerStatusPlugin (ACC-15).
  isActive: boolean;
  deactivatedAt: Date | null;
  deactivatedBy: Types.ObjectId | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const HotelSchema = SchemaFactory.createForClass(Hotel);

HotelSchema.plugin(providerStatusPlugin);
