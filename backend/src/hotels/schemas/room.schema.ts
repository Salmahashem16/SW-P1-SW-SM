import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export type RoomDocument = HydratedDocument<Room>;

/** HTL-04: a night range [from, to) when the room is bookable. */
@Schema({ _id: true })
export class RoomDateRange {
  _id: Types.ObjectId;

  @Prop({ type: Date, required: true })
  from: Date;

  @Prop({ type: Date, required: true })
  to: Date;
}
export const RoomDateRangeSchema = SchemaFactory.createForClass(RoomDateRange);

/** HTL-06: a blocked night range [from, to). */
@Schema({ _id: true })
export class RoomBlock {
  _id: Types.ObjectId;

  @Prop({ type: Date, required: true })
  from: Date;

  @Prop({ type: Date, required: true })
  to: Date;

  @Prop({ type: String, trim: true, default: null })
  reason: string | null;
}
export const RoomBlockSchema = SchemaFactory.createForClass(RoomBlock);

/**
 * Owner: Member 4 (Hotels). HTL-03: an individually bookable unit.
 *
 * Bookings (Member 5) store their own price per night, so editing
 * pricePerNight never changes existing reservations (HTL-05).
 */
@Schema({ timestamps: true })
export class Room {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'Hotel',
    required: true,
    index: true,
  })
  hotelId: Types.ObjectId;

  /** Room number or name, unique within the hotel. */
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, trim: true })
  type: string;

  @Prop({ required: true, min: 1, validate: Number.isInteger })
  beds: number;

  @Prop({ required: true, min: 1, validate: Number.isInteger })
  maxOccupancy: number;

  @Prop({ required: true, min: 0.01 })
  pricePerNight: number;

  /** HTL-06: deactivated rooms are excluded from search. */
  @Prop({ default: true, index: true })
  isActive: boolean;

  @Prop({ type: [RoomDateRangeSchema], default: [] })
  availability: RoomDateRange[];

  @Prop({ type: [RoomBlockSchema], default: [] })
  blocks: RoomBlock[];

  createdAt?: Date;
  updatedAt?: Date;
}

export const RoomSchema = SchemaFactory.createForClass(Room);

RoomSchema.index(
  { hotelId: 1, name: 1 },
  { unique: true, collation: { locale: 'en', strength: 2 } },
);
