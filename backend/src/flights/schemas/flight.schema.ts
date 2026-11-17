
import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import {
  HydratedDocument,
  Schema as MongooseSchema,
  Types,
} from 'mongoose';

export type FlightDocument = HydratedDocument<Flight>;

export const FLIGHT_STATUSES = [
  'scheduled',
  'delayed',
  'cancelled',
  'completed',
] as const;

export type FlightStatus = (typeof FLIGHT_STATUSES)[number];

@Schema({ _id: true })
export class CabinInventory {
  @Prop({ required: true, trim: true })
  cabinClass: string;

  @Prop({ required: true, min: 0 })
  capacity: number;

  @Prop({ required: true, min: 0 })
  price: number;

  @Prop({ required: true, uppercase: true, trim: true })
  currency: string;
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

  @Prop({ required: true, uppercase: true, trim: true })
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

  @Prop({
    type: String,
    enum: [...FLIGHT_STATUSES],
    default: 'scheduled',
  })
  status: FlightStatus;

  @Prop({ type: [CabinInventorySchema], default: [] })
  cabins: CabinInventory[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const FlightSchema = SchemaFactory.createForClass(Flight);

FlightSchema.index({
  departureAirportId: 1,
  arrivalAirportId: 1,
  departureAt: 1,
  status: 1,
});

FlightSchema.index({
  airlineId: 1,
  departureAt: 1,
});
