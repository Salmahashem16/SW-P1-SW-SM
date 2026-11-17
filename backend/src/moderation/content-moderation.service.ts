import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection, Model, Types } from 'mongoose';

import { CONTENT_MODELS, HIDDEN_FIELD } from './moderation.constants';
import type { ReportableType } from './moderation.constants';

export type ContentDoc = Record<string, unknown> & { _id: Types.ObjectId };

/** Called instead of a plain deleteOne, e.g. to cascade or recalculate. */
export type ContentDeleteHandler = (id: string) => Promise<void>;

const PREVIEW_LENGTH = 200;

/**
 * GEN-09 / GEN-10: reads, hides and deletes reportable content without
 * importing the blog, hotels or itineraries modules. It looks models up by
 * name on the shared connection (see CONTENT_MODELS), so it starts working
 * for a type as soon as that type's module is merged.
 *
 * Deleting a post should also delete its comments and likes, and deleting a
 * review should recalculate the hotel's rating (HTL-23). The owning module
 * does that by registering a delete handler, for example in its service:
 *
 *   constructor(moderation: ContentModerationService) {
 *     moderation.registerDeleteHandler('review', (id) => this.removeReview(id));
 *   }
 */
@Injectable()
export class ContentModerationService {
  private readonly logger = new Logger(ContentModerationService.name);
  private readonly deleteHandlers = new Map<
    ReportableType,
    ContentDeleteHandler
  >();

  constructor(@InjectConnection() private readonly connection: Connection) {}

  registerDeleteHandler(type: ReportableType, handler: ContentDeleteHandler) {
    this.deleteHandlers.set(type, handler);
  }

  /** Throws 400 if the module that owns this content type isn't merged yet. */
  assertAvailable(type: ReportableType): void {
    this.getModel(type);
  }

  async findById(type: ReportableType, id: string): Promise<ContentDoc | null> {
    if (!Types.ObjectId.isValid(id)) {
      return null;
    }

    return (await this.getModel(type)
      .findById(id)
      .lean()
      .exec()) as ContentDoc | null;
  }

  /** Loads many documents of one type at once; missing ids are left out. */
  async findManyById(
    type: ReportableType,
    ids: Types.ObjectId[],
  ): Promise<Map<string, ContentDoc>> {
    const model = this.connection.models[CONTENT_MODELS[type].modelName];

    if (!model || ids.length === 0) {
      return new Map();
    }

    const docs = (await model
      .find({ _id: { $in: ids } })
      .lean()
      .exec()) as ContentDoc[];

    return new Map(docs.map((doc) => [doc._id.toString(), doc]));
  }

  authorOf(type: ReportableType, doc: ContentDoc): string | null {
    const authorId = doc[CONTENT_MODELS[type].authorField];

    return authorId ? String(authorId) : null;
  }

  isHidden(doc: ContentDoc): boolean {
    return doc[HIDDEN_FIELD] === true;
  }

  previewOf(type: ReportableType, doc: ContentDoc): string | null {
    for (const field of CONTENT_MODELS[type].previewFields) {
      const value = doc[field];

      if (typeof value === 'string' && value.trim()) {
        const text = value.trim();

        return text.length > PREVIEW_LENGTH
          ? `${text.slice(0, PREVIEW_LENGTH)}…`
          : text;
      }
    }

    return null;
  }

  async setHidden(
    type: ReportableType,
    id: string,
    hidden: boolean,
    adminId: string,
  ): Promise<void> {
    // strict: false so the flag is saved even if the owning schema forgot
    // moderationFieldsPlugin.
    await this.getModel(type)
      .updateOne(
        { _id: new Types.ObjectId(id) },
        {
          $set: {
            [HIDDEN_FIELD]: hidden,
            hiddenAt: hidden ? new Date() : null,
            hiddenBy: hidden ? new Types.ObjectId(adminId) : null,
          },
        },
        { strict: false },
      )
      .exec();
  }

  async delete(type: ReportableType, id: string): Promise<void> {
    const handler = this.deleteHandlers.get(type);

    if (handler) {
      await handler(id);
      return;
    }

    await this.getModel(type)
      .deleteOne({ _id: new Types.ObjectId(id) })
      .exec();
  }

  private getModel(type: ReportableType): Model<unknown> {
    const { modelName } = CONTENT_MODELS[type];
    const model = this.connection.models[modelName] as
      | Model<unknown>
      | undefined;

    if (!model) {
      this.logger.warn(
        `Model "${modelName}" is not registered; ${type} moderation is unavailable until that module is merged.`,
      );
      throw new BadRequestException(
        `Moderation of ${type}s is not available yet`,
      );
    }

    return model;
  }
}
