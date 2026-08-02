/** Hard cap on a single uploaded asset. */
export const MAX_UPLOAD_BYTES = 25 * 1024 * 1024;

/** Hard cap on a document's markdown source stored in D1. */
export const MAX_DOC_BYTES = 1024 * 1024;

/** Upload MIME allow-list. SVG is deliberately excluded (script injection vector). */
export const ALLOWED_MIME = [
  'image/png',
  'image/jpeg',
  'image/webp',
  'image/gif',
  'application/pdf',
] as const;

export type AllowedMime = (typeof ALLOWED_MIME)[number];

export const MIME_EXTENSIONS: Record<AllowedMime, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

export const ACCESS_TOKEN_TTL_SECONDS = 15 * 60;
export const REFRESH_TOKEN_TTL_SECONDS = 30 * 24 * 60 * 60;
export const ASSET_COOKIE_TTL_SECONDS = 30 * 60;

export const REFRESH_COOKIE = 'mdn_rt';
export const ASSET_COOKIE = 'mdn_at';

export const REFRESH_COOKIE_PATH = '/api/auth';
export const ASSET_COOKIE_PATH = '/api/projects';
