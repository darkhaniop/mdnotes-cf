import { z } from 'zod';
import { MAX_DOC_BYTES } from '../constants';

export const documentTitleSchema = z
  .string()
  .trim()
  .min(1, 'Give the document a title')
  .max(200, 'Keep the title under 200 characters');

export const documentContentSchema = z
  .string()
  .max(MAX_DOC_BYTES, 'This document is too large (1 MB limit)');

export const createDocumentSchema = z.object({
  title: documentTitleSchema,
  content: documentContentSchema.optional(),
});

export const updateDocumentSchema = z
  .object({
    title: documentTitleSchema.optional(),
    content: documentContentSchema.optional(),
    /** Last known `updatedAt`; used for optimistic concurrency (409 on mismatch). */
    expectedUpdatedAt: z.number().int().optional(),
  })
  .refine((v) => v.title !== undefined || v.content !== undefined, {
    message: 'Nothing to update',
  });

export type CreateDocumentInput = z.infer<typeof createDocumentSchema>;
export type UpdateDocumentInput = z.infer<typeof updateDocumentSchema>;

export const documentDtoSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  title: z.string(),
  slug: z.string(),
  content: z.string(),
  createdAt: z.number(),
  updatedAt: z.number(),
});

export type DocumentDto = z.infer<typeof documentDtoSchema>;

/** List rows omit `content` to keep the payload small. */
export const documentSummarySchema = documentDtoSchema.omit({ content: true }).extend({
  excerpt: z.string(),
});

export type DocumentSummary = z.infer<typeof documentSummarySchema>;
