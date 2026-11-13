import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type UserDocument = HydratedDocument<User>;

@Schema({ timestamps: true })
export class User {
  @Prop({ required: true, trim: true })
  name: string;

  @Prop({ required: true, unique: true, lowercase: true, trim: true })
  email: string;

  @Prop({ required: true, select: false })
  passwordHash: string;

  @Prop({
    required: true,
    enum: ['registeredUser', 'admin', 'airlineModerator', 'hotelModerator'],
    default: 'registeredUser',
  })
  role: string;

  @Prop({
    required: true,
    enum: ['active', 'suspended', 'deactivated'],
    default: 'active',
  })
  status: string;

  @Prop({ required: true })
  termsAcceptedAt: Date;

  @Prop({ default: 'USD' })
  preferredCurrency: string;

  @Prop()
  phone?: string;

  @Prop({ default: 0 })
  failedLoginAttempts: number;

  @Prop()
  lockUntil?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);