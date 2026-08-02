import type { Context, ErrorHandler } from 'hono';
import { HTTPException } from 'hono/http-exception';
import type { ContentfulStatusCode } from 'hono/utils/http-status';

export class ApiError extends HTTPException {
  readonly code: string;
  readonly details?: unknown;

  constructor(status: ContentfulStatusCode, code: string, message?: string, details?: unknown) {
    super(status, { message: message ?? code });
    this.code = code;
    this.details = details;
  }
}

export const badRequest = (code = 'bad_request', message?: string, details?: unknown) =>
  new ApiError(400, code, message, details);
export const unauthorized = (code = 'unauthorized', message?: string) =>
  new ApiError(401, code, message);
export const notFound = (code = 'not_found', message?: string) => new ApiError(404, code, message);
export const conflict = (code = 'conflict', message?: string) => new ApiError(409, code, message);
export const tooLarge = (code = 'payload_too_large', message?: string) =>
  new ApiError(413, code, message);
export const tooManyRequests = (code = 'rate_limited', message?: string) =>
  new ApiError(429, code, message);

export const onError: ErrorHandler = (err, c: Context) => {
  if (err instanceof ApiError) {
    return c.json({ error: err.code, message: err.message, details: err.details }, err.status);
  }
  if (err instanceof HTTPException) {
    return c.json({ error: 'http_error', message: err.message }, err.status);
  }
  console.error('unhandled error', err);
  return c.json({ error: 'internal_error', message: 'Something went wrong' }, 500);
};
