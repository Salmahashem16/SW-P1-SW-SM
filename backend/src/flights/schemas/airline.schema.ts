
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

import { providerStatusPlugin } from '../../common/provider-status';

export type AirlineDocument = HydratedDocument<Airline>;

@Schema({ timestamps: true })
export class Airline {
  @Prop({
    required: true,
    trim: true,
    minlength: 2,
    maxlength: 100,
  })
  name: string;

  @Prop({
    required: true,
    unique: true,
    uppercase: true,
    trim: true,
  })
  code: string;

  @Prop({
    type: String,
    default: null,
  })
  logo: string | null;

  @Prop({
    type: {
      extraBagPrice: {
        type: Number,
        required: true,
        min: 0.01,
      },
      maxExtraBags: {
        type: Number,
        required: true,
        min: 0,
        validate: Number.isInteger,
      },
    },
    default: null,
  })
  baggagePolicy: {
    extraBagPrice: number;
    maxExtraBags: number;
  } | null;

  isActive: boolean;
  deactivatedAt: Date | null;
  deactivatedBy: Types.ObjectId | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const AirlineSchema =
  SchemaFactory.createForClass(Airline);

AirlineSchema.plugin(providerStatusPlugin);
