import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Types } from 'mongoose';

export type ItineraryDocument = HydratedDocument<Itinerary>;

@Schema({ _id: true })
export class ItineraryActivity {
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ trim: true })
  description?: string;

  @Prop({ trim: true })
  attractionId?: string;

  @Prop({ type: [{ _id: { type: Types.ObjectId, default: () => new Types.ObjectId() }, url: { type: String, required: true }, filename: { type: String, required: true } }], default: [] })
  images?: { _id: Types.ObjectId; url: string; filename: string }[];
}

export const ItineraryActivitySchema = SchemaFactory.createForClass(ItineraryActivity);

@Schema({ _id: true })
export class BudgetEntry {
  _id: Types.ObjectId;

  @Prop({ required: true, enum: ['food', 'accommodation', 'localTransportation', 'activities'] })
  category: string;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ required: true, uppercase: true, match: /^[A-Z]{3}$/ })
  currency: string;

  @Prop({ trim: true })
  description?: string;
}
export const BudgetEntrySchema = SchemaFactory.createForClass(BudgetEntry);

@Schema({ _id: true })
export class TransportCost {
  _id: Types.ObjectId;

  @Prop({ required: true, trim: true })
  fromCityId: string;

  @Prop({ required: true, trim: true })
  toCityId: string;

  @Prop({ required: true, min: 0 })
  amount: number;

  @Prop({ required: true, uppercase: true, match: /^[A-Z]{3}$/ })
  currency: string;

  @Prop({ trim: true })
  description?: string;
}
export const TransportCostSchema = SchemaFactory.createForClass(TransportCost);

@Schema({ _id: true })
export class ItineraryDay {
  _id: Types.ObjectId;

  @Prop({ required: true, min: 1 })
  dayNumber: number;

  @Prop({ required: true, trim: true })
  cityId: string;

  @Prop({ required: true, type: Date })
  date: Date;

  @Prop({ type: [ItineraryActivitySchema], default: [] })
  activities: ItineraryActivity[];

  @Prop({ type: [BudgetEntrySchema], default: [] })
  budgets: BudgetEntry[];
}

export const ItineraryDaySchema = SchemaFactory.createForClass(ItineraryDay);

@Schema({ timestamps: true })
export class Itinerary {
  @Prop({ type: Types.ObjectId, required: true, ref: 'User' })
  ownerId: Types.ObjectId;

  @Prop({ required: true, trim: true })
  title: string;

  @Prop({ type: [String], default: [] })
  countries: string[];

  @Prop({ required: true, type: Date })
  startDate: Date;

  @Prop({ default: false })
  isPublic: boolean;

  @Prop({ type: Types.ObjectId, ref: 'Itinerary' })
  clonedFrom?: Types.ObjectId;

  @Prop({ type: [ItineraryDaySchema], default: [] })
  days: ItineraryDay[];

  @Prop({ type: [TransportCostSchema], default: [] })
  transportCosts: TransportCost[];
}

export const ItinerarySchema = SchemaFactory.createForClass(Itinerary);
