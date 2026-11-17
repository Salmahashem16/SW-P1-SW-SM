import { Schema as MongooseSchema, Types } from 'mongoose';
import type { QueryFilter, Schema } from 'mongoose';

import type { AuthUser } from '../auth/auth.types';
import { CONTENT_MODELS, HIDDEN_FIELD } from './moderation.constants';
import type { ReportableType } from './moderation.constants';

/**
 * GEN-10: adds the fields admin moderation writes to a reportable schema.
 * Call it in the post, comment, review and itinerary schema files:
 *
 *   PostSchema.plugin(moderationFieldsPlugin);
 */
export function moderationFieldsPlugin(schema: Schema) {
  schema.add({
    [HIDDEN_FIELD]: { type: Boolean, default: false, index: true },
    hiddenAt: { type: Date, default: null },
    hiddenBy: { type: MongooseSchema.Types.ObjectId, ref: 'User', default: null },
  });
}

/**
 * GEN-10: "Hidden content is visible only to its author and admins."
 * Combine it with your own filter using $and, so neither $or overwrites the
 * other:
 *
 *   const filter = { $and: [{ status: 'published' }, visibleTo('post', user)] };
 *
 * Pass undefined for guests.
 */
export function visibleTo(
  type: ReportableType,
  viewer?: AuthUser | null,
): QueryFilter<unknown> {
  if (viewer?.role === 'admin') {
    return {};
  }

  const notHidden = { [HIDDEN_FIELD]: { $ne: true } };

  if (!viewer) {
    return notHidden;
  }

  return {
    $or: [
      notHidden,
      { [CONTENT_MODELS[type].authorField]: new Types.ObjectId(viewer.userId) },
    ],
  };
}

/** Same rule for a single document you've already loaded. */
export function canView(
  type: ReportableType,
  doc: Record<string, unknown>,
  viewer?: AuthUser | null,
): boolean {
  if (doc[HIDDEN_FIELD] !== true || viewer?.role === 'admin') {
    return true;
  }

  const authorId = doc[CONTENT_MODELS[type].authorField];

  return Boolean(viewer && authorId && String(authorId) === viewer.userId);
}
