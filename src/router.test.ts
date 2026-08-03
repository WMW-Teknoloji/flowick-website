import { describe, it, expect } from 'vitest';
import { matchRoute } from './router';

describe('matchRoute', () => {
  it('matches root path', () => {
    const result = matchRoute('/', '/');
    expect(result).toEqual({});
  });

  it('matches blog listing', () => {
    const result = matchRoute('/blog', '/blog');
    expect(result).toEqual({});
  });

  it('matches blog detail with slug', () => {
    const result = matchRoute('/blog/:slug', '/blog/dijital-donusum');
    expect(result).toEqual({ slug: 'dijital-donusum' });
  });

  it('returns null for non-matching route', () => {
    const result = matchRoute('/blog/:slug', '/urunler');
    expect(result).toBeNull();
  });

  it('matches urunler', () => {
    const result = matchRoute('/urunler', '/urunler');
    expect(result).toEqual({});
  });

  it('matches path with trailing slash', () => {
    expect(matchRoute('/urunler', '/urunler/')).toEqual({});
    expect(matchRoute('/blog/:slug', '/blog/dijital-donusum/')).toEqual({
      slug: 'dijital-donusum',
    });
  });

  it('still matches bare root', () => {
    expect(matchRoute('/', '/')).toEqual({});
  });
});
