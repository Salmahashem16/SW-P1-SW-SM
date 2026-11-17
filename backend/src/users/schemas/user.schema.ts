import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

export const USER_ROLES = [
  'registeredUser',
  'admin',
  'airlineModerator',
  'hotelModerator',
] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const USER_STATUSES = ['active', 'suspended', 'deactivated'] as const;
export type UserStatus = (typeof USER_STATUSES)[number];

export const PROVIDER_TYPES = ['hotel', 'airline'] as const;
export type ProviderType = (typeof PROVIDER_TYPES)[number];

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
    type: String,
    required: true,
    enum: [...USER_ROLES],
    default: 'registeredUser',
  })
  role: UserRole;

  @Prop({
    type: String,
    required: true,
    enum: [...USER_STATUSES],
    default: 'active',
  })
  status: UserStatus;

  // ACC-01: set when a guest registers. Seeded admins and admin-created
  // moderators do not go through the consent checkbox, so this is optional.
  @Prop({ type: Date, default: null })
  termsAcceptedAt: Date | null;

  @Prop({ default: 'USD' })
  preferredCurrency: string;

  @Prop()
  phone?: string;

  // ACC-13: a moderator is linked to exactly one hotel or airline.
  @Prop({ type: String, enum: [...PROVIDER_TYPES], default: null })
  providerType: ProviderType | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, default: null })
  providerId: Types.ObjectId | null;

  // ACC-05
  @Prop({ default: 0 })
  failedLoginAttempts: number;

  @Prop({ type: Date, default: null })
  lockUntil: Date | null;

  // ACC-07a / ACC-13: forces a password change at next login.
  @Prop({ default: false })
  mustChangePassword: boolean;

  // ACC-06: idle timeout.
  @Prop({ type: Date, default: Date.now })
  lastActivityAt: Date;

  @Prop({ type: String, default: null, select: false })
  refreshTokenHash: string | null;

  // ACC-12
  @Prop({ type: Date, default: null })
  deactivatedAt: Date | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

UserSchema.index({ refreshTokenHash: 1 });
UserSchema.index({ role: 1, status: 1 });
