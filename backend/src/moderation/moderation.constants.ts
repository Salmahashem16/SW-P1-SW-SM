/** GEN-09: content a registered user can report. */
export const REPORTABLE_TYPES = ['post', 'comment', 'review', 'itinerary'] as const;
export type ReportableType = (typeof REPORTABLE_TYPES)[number];

/** Field set on hidden content (GEN-10). See moderationFieldsPlugin. */
export const HIDDEN_FIELD = 'isHidden';

export type ContentModelConfig = {
  /** Mongoose model name the owning module registers. */
  modelName: string;
  /** Field holding the author/owner's user id. */
  authorField: string;
  /** Fields tried, in order, to build a short preview for the admin list. */
  previewFields: string[];
};

/**
 * How moderation finds each content type. The blog, hotels and itineraries
 * members own these models: if you name a model or its author field
 * differently, change it here. Nothing else in this module needs to change.
 */
export const CONTENT_MODELS: Record<ReportableType, ContentModelConfig> = {
  post: {
    modelName: 'Post',
    authorField: 'authorId',
    previewFields: ['title', 'body'],
  },
  comment: {
    modelName: 'Comment',
    authorField: 'authorId',
    previewFields: ['body', 'text', 'content'],
  },
  review: {
    modelName: 'Review',
    authorField: 'userId',
    previewFields: ['comment', 'text', 'body'],
  },
  itinerary: {
    modelName: 'Itinerary',
    authorField: 'ownerId',
    previewFields: ['title'],
  },
};
