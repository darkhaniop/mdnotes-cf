import { z } from 'zod';
import { ALLOWED_MIME } from '../constants';

export const allowedMimeSchema = z.enum(ALLOWED_MIME);

export const assetDtoSchema = z.object({
  id: z.string(),
  projectId: z.string(),
  filename: z.string(),
  contentType: allowedMimeSchema,
  sizeBytes: z.number(),
  sha256: z.string(),
  createdAt: z.number(),
  url: z.string(),
});

export type AssetDto = z.infer<typeof assetDtoSchema>;

export function isImageMime(mime: string): boolean {
  return mime.startsWith('image/');
}
