import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { providerStatusPlugin } from '../../common/provider-status';

export type AirlineDocument = HydratedDocument<Airline>;

/**
 * Owner: Member 3 (Flights). Skeleton created early so admin features
 * (ACC-13, ACC-15, ACC-17) can reference it. Add your own fields (logo,
 * baggage policy, cancellation tiers, ...) here.
 *
 * Please keep: the class/model name "Airline", `name`, `code`, and the
 * status fields from providerStatusPlugin.
 */
@Schema({ timestamps: true })
export class Airline {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, uppercase: true, trim: true })
  code: string;

  // Added by providerStatusPlugin (ACC-15).
  isActive: boolean;
  deactivatedAt: Date | null;
  deactivatedBy: Types.ObjectId | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AirlineSchema = SchemaFactory.createForClass(Airline);

AirlineSchema.plugin(providerStatusPlugin);
