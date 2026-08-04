import { describe, expect, it } from 'vitest';
import { isPdfHref, makeUrlTransform, referenceToFilename } from '@/lib/markdown';

const transform = makeUrlTransform('proj-1');

describe('makeUrlTransform', () => {
  it('passes absolute URLs through untouched', () => {
    expect(transform('https://example.com/a.png')).toBe('https://example.com/a.png');
    expect(transform('http://example.com')).toBe('http://example.com');
    expect(transform('mailto:a@b.com')).toBe('mailto:a@b.com');
  });

  it('allows inline base64 images but not other data URLs', () => {
    expect(transform('data:image/png;base64,AAAA')).toBe('data:image/png;base64,AAAA');
    expect(transform('data:text/html;base64,PHNjcmlwdD4=')).toBe('');
  });

  it('drops dangerous schemes', () => {
    expect(transform('javascript:alert(1)')).toBe('');
    expect(transform('vbscript:msgbox')).toBe('');
    expect(transform('JAVASCRIPT:alert(1)')).toBe('');
  });

  it('keeps in-page anchors', () => {
    expect(transform('#section')).toBe('#section');
  });

  it('maps a bare filename onto the project asset route', () => {
    expect(transform('diagram.png')).toBe('/api/projects/proj-1/assets/by-name/diagram.png');
  });

  it('flattens relative paths to the basename', () => {
    expect(transform('./img/diagram.png')).toBe('/api/projects/proj-1/assets/by-name/diagram.png');
    expect(transform('../../assets/diagram.png')).toBe(
      '/api/projects/proj-1/assets/by-name/diagram.png',
    );
  });

  it('normalises case, spaces and percent-escapes the way the server does', () => {
    expect(transform('My Photo.PNG')).toBe('/api/projects/proj-1/assets/by-name/my-photo.png');
    expect(transform('My%20Photo.PNG')).toBe('/api/projects/proj-1/assets/by-name/my-photo.png');
    expect(transform('shot.jpeg')).toBe('/api/projects/proj-1/assets/by-name/shot.jpg');
  });

  it('leaves an already-resolved asset URL alone', () => {
    expect(transform('/api/projects/proj-1/assets/by-name/x.png')).toBe(
      '/api/projects/proj-1/assets/by-name/x.png',
    );
  });

  it('handles the empty string', () => {
    expect(transform('')).toBe('');
  });
});

describe('referenceToFilename', () => {
  it('matches the worker implementation on the interesting cases', () => {
    expect(referenceToFilename('diagram.png')).toBe('diagram.png');
    expect(referenceToFilename('./img/My Photo.PNG')).toBe('my-photo.png');
    expect(referenceToFilename('spec.pdf?v=2')).toBe('spec.pdf');
    expect(referenceToFilename('物理.png')).toBe('file.png');
  });
});

describe('isPdfHref', () => {
  it('detects PDFs before and after the transform', () => {
    expect(isPdfHref('spec.pdf')).toBe(true);
    expect(isPdfHref('/api/projects/p/assets/by-name/spec.pdf')).toBe(true);
    expect(isPdfHref('/api/projects/p/assets/by-name/spec.png')).toBe(false);
    expect(isPdfHref(undefined)).toBe(false);
  });
});
