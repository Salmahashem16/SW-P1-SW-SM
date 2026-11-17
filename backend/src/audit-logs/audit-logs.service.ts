import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { AuditLog } from './schemas/audit-log.schema';
import type { AuditAction } from './schemas/audit-log.schema';

export type AuditEntry = {
  actorId: string;
  action: AuditAction;
  targetType: string;
  targetId?: string | null;
  details?: Record<string, unknown>;
};

export type AuditLogFilters = {
  page?: number;
  limit?: number;
  action?: AuditAction;
  actorId?: string;
};

/**
 * GEN-07. Inject this in any service that performs an admin action:
 *
 *   await this.auditLogs.record({
 *     actorId: admin.userId,
 *     action: 'content.hidden',
 *     targetType: 'post',
 *     targetId: post._id.toString(),
 *     details: { reportId },
 *   });
 */
@Injectable()
export class AuditLogsService {
  constructor(
    @InjectModel(AuditLog.name)
    private readonly auditLogModel: Model<AuditLog>,
  ) {}

  record(entry: AuditEntry) {
    return this.auditLogModel.create({
      actorId: new Types.ObjectId(entry.actorId),
      action: entry.action,
      targetType: entry.targetType,
      targetId: entry.targetId ?? null,
      details: entry.details ?? {},
    });
  }

  async list(filters: AuditLogFilters) {
    const page = Math.max(1, filters.page ?? 1);
    const limit = Math.min(50, Math.max(1, filters.limit ?? 10));

    const query = {
      ...(filters.action ? { action: filters.action } : {}),
      ...(filters.actorId && Types.ObjectId.isValid(filters.actorId)
        ? { actorId: new Types.ObjectId(filters.actorId) }
        : {}),
    };

    const [items, total] = await Promise.all([
      this.auditLogModel
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate('actorId', 'name email')
        .lean()
        .exec(),
      this.auditLogModel.countDocuments(query).exec(),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
