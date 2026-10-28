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
  it('lingi eelvaated, SEO-roomajad ja skriptid', () => {
    expect(classifyUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_11_1) AppleWebKit/601.2.4 (KHTML, like Gecko) Version/9.0.1 Safari/601.2.4 facebookexternalhit/1.1 Facebot Twitterbot/1.0'))
      .toEqual({ visitorClass: 'social_bot', botName: 'facebookexternalhit' });
    expect(classifyUserAgent('WhatsApp/2.23.20.0')).toEqual({ visitorClass: 'social_bot', botName: 'WhatsApp' });
    expect(classifyUserAgent('Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)')).toEqual({ visitorClass: 'seo_bot', botName: 'AhrefsBot' });
    expect(classifyUserAgent('Mozilla/5.0 (compatible; SemrushBot/7~bl; +http://www.semrush.com/bot.html)')).toEqual({ visitorClass: 'seo_bot', botName: 'SemrushBot' });
    expect(classifyUserAgent('curl/8.4.0')).toEqual({ visitorClass: 'script', botName: 'curl' });
    expect(classifyUserAgent('python-requests/2.32.5')).toEqual({ visitorClass: 'script', botName: 'python-requests' });
    expect(classifyUserAgent('Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/121.0.6167.139 Safari/537.36'))
      .toEqual({ visitorClass: 'script', botName: 'HeadlessChrome' });
  });
  it('muud robotid saavad nime UA-st, tühi UA eraldi', () => {
    expect(classifyUserAgent('SomeCrawler/1.0')).toEqual({ visitorClass: 'other_bot', botName: 'SomeCrawler' });
    expect(classifyUserAgent('Mozilla/5.0 (compatible; QlyzeBot/1.0; +https://app.qlyze.io/bot)')).toEqual({ visitorClass: 'other_bot', botName: 'QlyzeBot' });
    expect(classifyUserAgent('ApcosysBot/1.0 (+https://apcosys.net)')).toEqual({ visitorClass: 'other_bot', botName: 'ApcosysBot' });
    expect(classifyUserAgent('RecordedFuture Global Inventory Crawler')).toEqual({ visitorClass: 'other_bot', botName: 'RecordedFuture Global Inventory Crawler' });
    expect(classifyUserAgent('2ip bot/1.1 (+https://2ip.io/bot/)')).toEqual({ visitorClass: 'other_bot', botName: '2ip bot' });
    expect(classifyUserAgent('')).toEqual({ visitorClass: 'other_bot', botName: 'UA puudub' });
    expect(classifyUserAgent(undefined)).toEqual({ visitorClass: 'other_bot', botName: 'UA puudub' });
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
