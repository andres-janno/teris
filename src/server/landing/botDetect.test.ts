import { describe, it, expect } from 'vitest';
import { classifyUserAgent, detectDevice } from './botDetect.ts';

const CHROME = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0.0.0 Safari/537.36';
const IPHONE = 'Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const IPAD = 'Mozilla/5.0 (iPad; CPU OS 18_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.0 Mobile/15E148 Safari/604.1';
const ANDROID_PHONE = 'Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Mobile Safari/537.36';
const ANDROID_TABLET = 'Mozilla/5.0 (Linux; Android 14; SM-X710) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36';

describe('classifyUserAgent', () => {
  it('tunneb AI-roomajad', () => {
    expect(classifyUserAgent('Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; GPTBot/1.2; +https://openai.com/gptbot)')).toEqual({ visitorClass: 'ai_bot', botName: 'GPTBot' });
    expect(classifyUserAgent('Mozilla/5.0 (compatible; ClaudeBot/1.0; +claudebot@anthropic.com)')).toEqual({ visitorClass: 'ai_bot', botName: 'ClaudeBot' });
    expect(classifyUserAgent('Mozilla/5.0 (compatible; PerplexityBot/1.0)')).toEqual({ visitorClass: 'ai_bot', botName: 'PerplexityBot' });
    expect(classifyUserAgent('Mozilla/5.0 ChatGPT-User/1.0')).toEqual({ visitorClass: 'ai_bot', botName: 'ChatGPT-User' });
  });
  it('Applebot-Extended on AI, Applebot otsing', () => {
    expect(classifyUserAgent('Mozilla/5.0 (compatible; Applebot-Extended/0.1)').botName).toBe('Applebot-Extended');
    expect(classifyUserAgent('Mozilla/5.0 (compatible; Applebot/0.1)')).toEqual({ visitorClass: 'search_bot', botName: 'Applebot' });
  });
  it('tunneb otsingurobotid', () => {
    expect(classifyUserAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)')).toEqual({ visitorClass: 'search_bot', botName: 'Googlebot' });
    expect(classifyUserAgent('Mozilla/5.0 (compatible; bingbot/2.0)')).toEqual({ visitorClass: 'search_bot', botName: 'bingbot' });
  });
  it('muud robotid ja tühi UA', () => {
    expect(classifyUserAgent('curl/8.4.0')).toEqual({ visitorClass: 'other_bot', botName: null });
    expect(classifyUserAgent('SomeCrawler/1.0')).toEqual({ visitorClass: 'other_bot', botName: null });
    expect(classifyUserAgent('')).toEqual({ visitorClass: 'other_bot', botName: null });
    expect(classifyUserAgent(undefined)).toEqual({ visitorClass: 'other_bot', botName: null });
  });
  it('inimese brauserid', () => {
    for (const ua of [CHROME, IPHONE, IPAD, ANDROID_PHONE]) expect(classifyUserAgent(ua)).toEqual({ visitorClass: 'human', botName: null });
  });
});

describe('detectDevice', () => {
  it('eristab seadmed', () => {
    expect(detectDevice(CHROME)).toBe('desktop');
    expect(detectDevice(IPHONE)).toBe('mobile');
    expect(detectDevice(ANDROID_PHONE)).toBe('mobile');
    expect(detectDevice(IPAD)).toBe('tablet');
    expect(detectDevice(ANDROID_TABLET)).toBe('tablet');
    expect(detectDevice(undefined)).toBe('desktop');
  });
});
