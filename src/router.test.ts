import { describe, expect, it } from 'vitest';
import { resolveRoute } from './router';

describe('resolveRoute', () => {
  it('maps the public routes', () => {
    expect(resolveRoute('/')).toBe('home');
    expect(resolveRoute('/studio')).toBe('studio');
    expect(resolveRoute('/docs')).toBe('docs');
  });

  it('ignores trailing slashes', () => {
    expect(resolveRoute('/studio/')).toBe('studio');
    expect(resolveRoute('/docs//')).toBe('docs');
  });

  it('treats anything else as not found', () => {
    expect(resolveRoute('/nope')).toBe('notFound');
    expect(resolveRoute('/studio/extra')).toBe('notFound');
    expect(resolveRoute('/Studio')).toBe('notFound');
  });
});
