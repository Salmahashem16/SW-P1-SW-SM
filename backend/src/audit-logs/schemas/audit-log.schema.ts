import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

/**
 * GEN-07: known admin actions. Other members can add their own
 * (e.g. 'content.hidden', 'content.deleted' for GEN-10).
 */
export const AUDIT_ACTIONS = [
  'moderator.created',
  'account.suspended',
  'account.reactivated',
  'account.password_reset',
  'provider.deactivated',
  'provider.reactivated',
  'report.dismissed',
  'content.hidden',
  'content.unhidden',
  'content.deleted',
] as const;
export type AuditAction = (typeof AUDIT_ACTIONS)[number];

export type AuditLogDocument = HydratedDocument<AuditLog>;

@Schema({
  collection: 'audit_logs',
  timestamps: { createdAt: true, updatedAt: false },
})
export class AuditLog {
  @Prop({
    type: MongooseSchema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  })
  actorId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: [...AUDIT_ACTIONS], index: true })
  action: AuditAction;

  /** 'user', 'hotel', 'airline', 'post', 'comment', 'review', 'itinerary', 'report' */
  @Prop({ type: String, required: true })
  targetType: string;

  @Prop({ type: String, default: null })
  targetId: string | null;

  @Prop({ type: MongooseSchema.Types.Mixed, default: {} })
  details: Record<string, unknown>;

  createdAt?: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

AuditLogSchema.index({ createdAt: -1 });
