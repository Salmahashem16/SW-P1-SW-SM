import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';

import { AuditLogsService } from '../audit-logs/audit-logs.service';
import type { AuthUser } from '../auth/auth.types';
import { isDuplicateKeyError } from '../common/mongo-errors';
import { ContentModerationService } from './content-moderation.service';
import type { ContentDoc } from './content-moderation.service';
import { CreateReportDto } from './dto/create-report.dto';
import { ListReportsQueryDto } from './dto/list-reports-query.dto';
import type { ReportAction } from './dto/resolve-report.dto';
import { canView } from './moderation-fields.plugin';
import { REPORTABLE_TYPES } from './moderation.constants';
import type { ReportableType } from './moderation.constants';
import { Report } from './schemas/report.schema';
import type {
  ReportDocument,
  ReportResolution,
} from './schemas/report.schema';

const LABELS: Record<ReportableType, string> = {
  post: 'Post',
  comment: 'Comment',
  review: 'Review',
  itinerary: 'Itinerary',
};

type PopulatedUser = { _id: Types.ObjectId; name?: string; email?: string };

@Injectable()
export class ReportsService {
  constructor(
    @InjectModel(Report.name) private readonly reportModel: Model<Report>,
    private readonly content: ContentModerationService,
    private readonly auditLogs: AuditLogsService,
  ) {}

  /** GEN-09 */
  async create(user: AuthUser, dto: CreateReportDto) {
    const target = await this.content.findById(dto.targetType, dto.targetId);

    // Same 404 for missing, hidden, draft and private content, so reporting
    // can't be used to discover things the user isn't allowed to see.
    if (
      !target ||
      !canView(dto.targetType, target, user) ||
      !this.isPubliclyVisible(dto.targetType, target, user)
    ) {
      throw new NotFoundException(`${LABELS[dto.targetType]} not found`);
    }

    if (this.content.authorOf(dto.targetType, target) === user.userId) {
      throw new BadRequestException('You cannot report your own content');
    }

    let report: ReportDocument;

    try {
      report = await this.reportModel.create({
        reporterId: new Types.ObjectId(user.userId),
        targetType: dto.targetType,
        targetId: new Types.ObjectId(dto.targetId),
        reason: dto.reason.trim(),
      });
    } catch (error) {
      if (isDuplicateKeyError(error)) {
        throw new ConflictException('You have already reported this item');
      }

      throw error;
    }

    return {
      message: 'Report submitted. An admin will review it.',
      report: {
        id: report._id.toString(),
        targetType: report.targetType,
        targetId: report.targetId.toString(),
        reason: report.reason,
        status: report.status,
        createdAt: report.createdAt ?? null,
      },
    };
  }

  /** GEN-10: open reports by default, newest first. */
  async listForAdmin(query: ListReportsQueryDto) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(50, Math.max(1, query.limit ?? 10));

    const filter = {
      ...(query.status ? { status: query.status } : {}),
      ...(query.targetType ? { targetType: query.targetType } : {}),
    };

    const [reports, total] = await Promise.all([
      this.reportModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate<{ reporterId: PopulatedUser | null }>(
          'reporterId',
          'name email',
        )
        .populate<{ resolvedBy: PopulatedUser | null }>('resolvedBy', 'name')
        .lean()
        .exec(),
      this.reportModel.countDocuments(filter).exec(),
    ]);

    // One query per content type for the whole page.
    const targets = new Map<ReportableType, Map<string, ContentDoc>>();

    for (const type of REPORTABLE_TYPES) {
      const ids = reports
        .filter((report) => report.targetType === type)
        .map((report) => report.targetId);

      targets.set(type, await this.content.findManyById(type, ids));
    }

    // How many open reports each target has, so admins can prioritise.
    const openCounts = await this.countOpenReports(
      reports.map((report) => report.targetId),
    );

    return {
      items: reports.map((report) => {
        const doc = targets
          .get(report.targetType)
          ?.get(report.targetId.toString());

        return {
          id: report._id.toString(),
          targetType: report.targetType,
          targetId: report.targetId.toString(),
          reason: report.reason,
          status: report.status,
          resolution: report.resolution,
          adminNote: report.adminNote,
          reporter: report.reporterId
            ? {
                id: report.reporterId._id.toString(),
                name: report.reporterId.name ?? null,
                email: report.reporterId.email ?? null,
              }
            : null,
          resolvedBy: report.resolvedBy
            ? {
                id: report.resolvedBy._id.toString(),
                name: report.resolvedBy.name ?? null,
              }
            : null,
          resolvedAt: report.resolvedAt,
          createdAt: report.createdAt ?? null,
          openReportsOnTarget:
            openCounts.get(
              `${report.targetType}:${report.targetId.toString()}`,
            ) ?? 0,
          target: doc
            ? {
                exists: true,
                authorId: this.content.authorOf(report.targetType, doc),
                isHidden: this.content.isHidden(doc),
                preview: this.content.previewOf(report.targetType, doc),
              }
            : { exists: false, authorId: null, isHidden: false, preview: null },
        };
      }),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /** GEN-10: dismiss the report, or hide/delete the reported content. */
  async resolve(
    admin: AuthUser,
    reportId: string,
    action: ReportAction,
    note?: string,
  ) {
    const report = await this.reportModel.findById(reportId).exec();

    if (!report) {
      throw new NotFoundException('Report not found');
    }

    if (report.status !== 'open') {
      throw new ConflictException('This report has already been resolved');
    }

    const type = report.targetType;
    const targetId = report.targetId.toString();

    if (action === 'dismiss') {
      // The status condition stops two admins resolving the same report.
      const updated = await this.reportModel
        .findOneAndUpdate(
          { _id: report._id, status: 'open' },
          { $set: this.resolutionFields(admin, 'dismissed', note) },
          { returnDocument: 'after' },
        )
        .exec();

      if (!updated) {
        throw new ConflictException('This report has already been resolved');
      }

      await this.auditLogs.record({
        actorId: admin.userId,
        action: 'report.dismissed',
        targetType: 'report',
        targetId: reportId,
        details: { contentType: type, contentId: targetId, note: note ?? null },
      });

      return { message: 'Report dismissed', resolvedReports: 1 };
    }

    const result =
      action === 'hide'
        ? await this.hideContent(admin, type, targetId, note, reportId)
        : await this.deleteContent(admin, type, targetId, note, reportId);

    return result;
  }

  /** GEN-10: hide directly, or as the outcome of a report. */
  async hideContent(
    admin: AuthUser,
    type: ReportableType,
    id: string,
    note?: string,
    reportId?: string,
  ) {
    const target = await this.getContentOrThrow(type, id, reportId);

    if (this.content.isHidden(target)) {
      throw new ConflictException(`${LABELS[type]} is already hidden`);
    }

    await this.content.setHidden(type, id, true, admin.userId);
    const resolvedReports = await this.resolveOpenReports(
      admin,
      type,
      id,
      'hidden',
      note,
    );

    await this.auditLogs.record({
      actorId: admin.userId,
      action: 'content.hidden',
      targetType: type,
      targetId: id,
      details: {
        authorId: this.content.authorOf(type, target),
        reportId: reportId ?? null,
        resolvedReports,
        note: note ?? null,
      },
    });

    return {
      message: `${LABELS[type]} hidden. Only its author and admins can see it now.`,
      resolvedReports,
    };
  }

  /** GEN-10 */
  async unhideContent(
    admin: AuthUser,
    type: ReportableType,
    id: string,
    note?: string,
  ) {
    const target = await this.getContentOrThrow(type, id);

    if (!this.content.isHidden(target)) {
      throw new ConflictException(`${LABELS[type]} is not hidden`);
    }

    await this.content.setHidden(type, id, false, admin.userId);

    await this.auditLogs.record({
      actorId: admin.userId,
      action: 'content.unhidden',
      targetType: type,
      targetId: id,
      details: {
        authorId: this.content.authorOf(type, target),
        note: note ?? null,
      },
    });

    return { message: `${LABELS[type]} is visible again` };
  }

  /** GEN-10: delete directly, or as the outcome of a report. */
  async deleteContent(
    admin: AuthUser,
    type: ReportableType,
    id: string,
    note?: string,
    reportId?: string,
  ) {
    const target = await this.getContentOrThrow(type, id, reportId);

    await this.content.delete(type, id);
    const resolvedReports = await this.resolveOpenReports(
      admin,
      type,
      id,
      'deleted',
      note,
    );

    // The content is gone, so keep enough in the log to know what it was.
    await this.auditLogs.record({
      actorId: admin.userId,
      action: 'content.deleted',
      targetType: type,
      targetId: id,
      details: {
        authorId: this.content.authorOf(type, target),
        preview: this.content.previewOf(type, target),
        reportId: reportId ?? null,
        resolvedReports,
        note: note ?? null,
      },
    });

    return { message: `${LABELS[type]} deleted`, resolvedReports };
  }

  private async getContentOrThrow(
    type: ReportableType,
    id: string,
    reportId?: string,
  ): Promise<ContentDoc> {
    const target = await this.content.findById(type, id);

    if (!target) {
      throw new NotFoundException(
        reportId
          ? `The reported ${type} no longer exists. Dismiss the report instead.`
          : `${LABELS[type]} not found`,
      );
    }

    return target;
  }

  /** Every open report on the same content shares the outcome. */
  private async resolveOpenReports(
    admin: AuthUser,
    type: ReportableType,
    id: string,
    resolution: ReportResolution,
    note?: string,
  ): Promise<number> {
    const result = await this.reportModel
      .updateMany(
        { targetType: type, targetId: new Types.ObjectId(id), status: 'open' },
        { $set: this.resolutionFields(admin, resolution, note) },
      )
      .exec();

    return result.modifiedCount;
  }

  private resolutionFields(
    admin: AuthUser,
    resolution: ReportResolution,
    note?: string,
  ) {
    return {
      status: 'resolved' as const,
      resolution,
      resolvedBy: new Types.ObjectId(admin.userId),
      resolvedAt: new Date(),
      adminNote: note?.trim() || null,
    };
  }

  private async countOpenReports(targetIds: Types.ObjectId[]) {
    if (targetIds.length === 0) {
      return new Map<string, number>();
    }

    const rows = await this.reportModel
      .aggregate<{
        _id: { targetType: ReportableType; targetId: Types.ObjectId };
        count: number;
      }>([
        { $match: { status: 'open', targetId: { $in: targetIds } } },
        {
          $group: {
            _id: { targetType: '$targetType', targetId: '$targetId' },
            count: { $sum: 1 },
          },
        },
      ])
      .exec();

    return new Map(
      rows.map((row) => [
        `${row._id.targetType}:${row._id.targetId.toString()}`,
        row.count,
      ]),
    );
  }

  /**
   * Draft posts (BLG-01) and private itineraries (ITN-20) can only be seen by
   * their author, so nobody else can report them. Only checked when the
   * document actually has the field.
   */
  private isPubliclyVisible(
    type: ReportableType,
    doc: ContentDoc,
    user: AuthUser,
  ): boolean {
    if (this.content.authorOf(type, doc) === user.userId) {
      return true;
    }

    const lower = (value: unknown) =>
      typeof value === 'string' ? value.toLowerCase() : undefined;

    if (type === 'post' && lower(doc.status) === 'draft') {
      return false;
    }

    if (
      type === 'itinerary' &&
      doc.visibility !== undefined &&
      lower(doc.visibility) !== 'public'
    ) {
      return false;
    }

    return true;
  }
}
