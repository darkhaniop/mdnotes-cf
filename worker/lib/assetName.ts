import { ALLOWED_MIME, MIME_EXTENSIONS, type AllowedMime } from '@shared/constants';

/**
 * Magic-byte signatures for the allow-listed types. The browser-declared
 * Content-Type is attacker-controlled, so it is only ever a hint — the first
 * bytes have to agree with it.
 */
const SIGNATURES: Record<AllowedMime, (bytes: Uint8Array) => boolean> = {
  'image/png': (b) =>
    b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47 && b[4] === 0x0d && b[5] === 0x0a,
  'image/jpeg': (b) => b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff,
  'image/gif': (b) => b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x38,
  'image/webp': (b) =>
    b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45,
  'application/pdf': (b) => b[0] === 0x25 && b[1] === 0x50 && b[2] === 0x44 && b[3] === 0x46,
};

export function isAllowedMime(mime: string): mime is AllowedMime {
  return (ALLOWED_MIME as readonly string[]).includes(mime);
}

/** WebP needs 12 bytes (RIFF....WEBP); everything else fits in 8. */
export function sniffMatches(mime: AllowedMime, head: Uint8Array): boolean {
  if (head.length < 12) return false;
  return SIGNATURES[mime](head);
}

const EXTENSION_ALIASES: Record<string, string> = { jpeg: 'jpg', htm: 'html' };

/**
 * Slugifies the base name but keeps a single, MIME-derived extension. This is
 * what markdown references, so it must be predictable and free of anything that
 * could confuse a URL path.
 */
export function normalizeFilename(original: string, mime: AllowedMime): string {
  const bare = original.split(/[\\/]/).pop() ?? original;
  const dot = bare.lastIndexOf('.');
  const rawBase = dot > 0 ? bare.slice(0, dot) : bare;
  const base =
    rawBase
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
      .replace(/-+$/g, '') || 'file';
  return `${base}.${MIME_EXTENSIONS[mime]}`;
}

/** `report.pdf` → `report-1.pdf` when the name is already taken in the project. */
export function dedupeFilename(filename: string, taken: Set<string>): string {
  if (!taken.has(filename)) return filename;
  const dot = filename.lastIndexOf('.');
  const base = dot > 0 ? filename.slice(0, dot) : filename;
  const ext = dot > 0 ? filename.slice(dot) : '';
  for (let i = 1; ; i++) {
    const candidate = `${base}-${i}${ext}`;
    if (!taken.has(candidate)) return candidate;
  }
}

/**
 * Resolves a markdown reference to the flat per-project name space: strip any
 * directory part, percent-decode, then apply the same normalisation used at
 * upload time so `./img/My Photo.PNG` finds `my-photo.png`.
 */
export function referenceToFilename(reference: string): string {
  let value = reference;
  try {
    value = decodeURIComponent(reference);
  } catch {
    /* malformed escapes: use the raw value */
  }
  const bare = value.split(/[?#]/)[0]!.split(/[\\/]/).pop() ?? value;
  const dot = bare.lastIndexOf('.');
  const rawBase = dot > 0 ? bare.slice(0, dot) : bare;
  const rawExt = dot > 0 ? bare.slice(dot + 1).toLowerCase() : '';
  const ext = EXTENSION_ALIASES[rawExt] ?? rawExt;
  const base =
    rawBase
      .normalize('NFKD')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
      .replace(/-+$/g, '') || 'file';
  return ext ? `${base}.${ext}` : base;
}
