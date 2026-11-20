import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, Schema as MongooseSchema, Types } from 'mongoose';

import { REPORTABLE_TYPES } from '../moderation.constants';
import type { ReportableType } from '../moderation.constants';

export const REPORT_STATUSES = ['open', 'resolved'] as const;
export type ReportStatus = (typeof REPORT_STATUSES)[number];

export const REPORT_RESOLUTIONS = ['dismissed', 'hidden', 'deleted'] as const;
export type ReportResolution = (typeof REPORT_RESOLUTIONS)[number];

export type ReportDocument = HydratedDocument<Report>;

/** GEN-09 / GEN-10 */
@Schema({ timestamps: true })
export class Report {
  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', required: true })
  reporterId: Types.ObjectId;

  @Prop({ type: String, required: true, enum: [...REPORTABLE_TYPES] })
  targetType: ReportableType;

  @Prop({ type: MongooseSchema.Types.ObjectId, required: true })
  targetId: Types.ObjectId;

  @Prop({ required: true, trim: true, maxlength: 500 })
  reason: string;

  @Prop({
    type: String,
    required: true,
    enum: [...REPORT_STATUSES],
    default: 'open',
  })
  status: ReportStatus;

  @Prop({ type: String, enum: [...REPORT_RESOLUTIONS, null], default: null })
  resolution: ReportResolution | null;

  @Prop({ type: MongooseSchema.Types.ObjectId, ref: 'User', default: null })
  resolvedBy: Types.ObjectId | null;

  @Prop({ type: Date, default: null })
  resolvedAt: Date | null;

  @Prop({ type: String, default: null, maxlength: 500 })
  adminNote: string | null;

  createdAt?: Date;
  updatedAt?: Date;
}

export const ReportSchema = SchemaFactory.createForClass(Report);

// GEN-09: "at most once per item". Enforced by the database, so two
// simultaneous requests can't both get through.
ReportSchema.index(
  { reporterId: 1, targetType: 1, targetId: 1 },
  { unique: true },
);
ReportSchema.index({ status: 1, createdAt: -1 });
ReportSchema.index({ targetType: 1, targetId: 1, status: 1 });
