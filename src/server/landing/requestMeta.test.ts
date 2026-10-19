// src/server/landing/requestMeta.test.ts
import { describe, it, expect } from 'vitest';
import type { IncomingMessage } from 'http';
import { referrerHostOf, clip, requestMeta } from './requestMeta.ts';

describe('referrerHostOf', () => {
  it('jätab ainult domeeni, oma domeen → null', () => {
    expect(referrerHostOf('https://www.google.com/search?q=teris')).toBe('google.com');
    expect(referrerHostOf('https://chatgpt.com/c/123')).toBe('chatgpt.com');
    expect(referrerHostOf('https://teris.ee/privacy')).toBeNull();
    expect(referrerHostOf('https://www.teris.ee/')).toBeNull();
    expect(referrerHostOf('not a url')).toBeNull();
    expect(referrerHostOf('')).toBeNull();
    expect(referrerHostOf(undefined)).toBeNull();
  });
});

describe('clip', () => {
  it('lõikab ja tühjendab', () => {
    expect(clip('  abc  ', 2)).toBe('ab');
    expect(clip('', 10)).toBeNull();
    expect(clip(42, 10)).toBeNull();
  });
});

describe('requestMeta', () => {
  it('loeb IP, UA, viitaja ja UTM-i', () => {
    const req = {
      url: '/?utm_source=facebook&utm_medium=social&utm_campaign=sygis',
      headers: { 'user-agent': 'UA', referer: 'https://www.facebook.com/x', 'x-forwarded-for': '9.9.9.9' },
      socket: { remoteAddress: '127.0.0.1' }
    } as unknown as IncomingMessage;
    expect(requestMeta(req)).toEqual({
      ip: '9.9.9.9', ua: 'UA', referrerHost: 'facebook.com', utmSource: 'facebook', utmMedium: 'social', utmCampaign: 'sygis'
    });
  });
});
