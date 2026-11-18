
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  HydratedDocument,
  Schema as MongooseSchema,
  Types,
} from 'mongoose';

export type FlightDocument = HydratedDocument<Flight>;

export const FLIGHT_STATUSES = [
  'Scheduled',
  'Cancelled',
  'Departed',
] as const;

export type FlightStatus = (typeof FLIGHT_STATUSES)[number];

export const CABIN_CLASSES = [
  'Economy',
  'Premium Economy',
  'Business',
  'First',
] as const;

export type CabinClass = (typeof CABIN_CLASSES)[number];

@Schema({ _id: true })
export class CabinInventory {
  @Prop({
    type: String,
    required: true,
    enum: [...CABIN_CLASSES],
  })
  cabinClass: CabinClass;

  @Prop({
    required: true,
    min: 1,
    validate: Number.isInteger,
  })
  capacity: number;

  @Prop({ required: true, min: 0.01 })
  price: number;

  @Prop({
    required: true,
    uppercase: true,
    trim: true,
  })
  currency: string;

  @Prop({
    required: true,
    min: 0,
    validate: Number.isInteger,
  })
  freeBaggageCount: number;

  @Prop({ required: true, min: 0.01 })
  maxBagWeightKg: number;


}

export const CabinInventorySchema =
  SchemaFactory.createForClass(CabinInventory);

@Schema({ timestamps: true })
export class Flight {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Airline',
    required: true,
    index: true,
  })
  airlineId: Types.ObjectId;

  @Prop({
    required: true,
    uppercase: true,
    trim: true,
  })
  flightNumber: string;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Airport',
    required: true,
  })
  departureAirportId: Types.ObjectId;

  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Airport',
    required: true,
  })
  arrivalAirportId: Types.ObjectId;

  @Prop({ type: Date, required: true })
  departureAt: Date;

  @Prop({ type: Date, required: true })
  arrivalAt: Date;

  @Prop({ type: String, required: true })
  departureLocalDate: string;

  @Prop({
    type: String,
    enum: [...FLIGHT_STATUSES],
    default: 'Scheduled',
    index: true,
  })
  status: FlightStatus;

  @Prop({
    type: [CabinInventorySchema],
    default: [],
  })
  cabins: CabinInventory[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const FlightSchema =
  SchemaFactory.createForClass(Flight);

FlightSchema.index({
  airlineId: 1,
  flightNumber: 1,
  departureAt: 1,
});


FlightSchema.index(
  {
    airlineId: 1,
    flightNumber: 1,
    departureLocalDate: 1,
  },
  { unique: true },
);

