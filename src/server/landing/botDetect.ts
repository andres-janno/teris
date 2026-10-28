// User-Agent → külastaja klass, roboti nimi ja seadme tüüp.
export type VisitorClass = 'human' | 'ai_bot' | 'search_bot' | 'seo_bot' | 'social_bot' | 'script' | 'other_bot';
export type Device = 'desktop' | 'mobile' | 'tablet';

// AI enne otsingut: „Applebot-Extended“ sisaldab „Applebot“-i.
const AI_BOTS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai',
  'PerplexityBot', 'Perplexity-User', 'CCBot', 'Bytespider', 'Amazonbot', 'meta-externalagent',
  'DuckAssistBot', 'Applebot-Extended', 'cohere-ai', 'Google-CloudVertexBot'
];
const SEARCH_BOTS = ['Googlebot', 'bingbot', 'Applebot', 'YandexBot', 'DuckDuckBot', 'Baiduspider', 'SeznamBot', 'PetalBot', 'Qwantbot'];
// Lingi eelvaated (jagamine sotsiaalmeedias ja suhtlusäppides); Facebooki UA sisaldab ka „Twitterbot“-i, seega Facebook ees
const SOCIAL_BOTS = [
  'facebookexternalhit', 'Facebot', 'Twitterbot', 'LinkedInBot', 'Slackbot', 'Discordbot', 'TelegramBot', 'WhatsApp',
  'SkypeUriPreview', 'Pinterestbot', 'redditbot', 'Embedly'
];
// SEO- ja turundusanalüüsi roomajad
const SEO_BOTS = [
  'AhrefsBot', 'SemrushBot', 'DataForSeoBot', 'MJ12bot', 'DotBot', 'BLEXBot', 'serpstatbot', 'Barkrowler', 'rogerbot',
  'Screaming Frog', 'SiteAuditBot', 'Pandalytics', 'webXtrendBot', 'NicheMinerBot'
];
// Skriptid ja automaattööriistad (päringuteegid, peata brauserid)
const SCRIPTS = [
  'HeadlessChrome', 'curl', 'Wget', 'python-requests', 'python-urllib', 'aiohttp', 'httpx', 'Go-http-client', 'axios',
  'node-fetch', 'undici', 'okhttp', 'Java/', 'libwww-perl', 'Scrapy', 'PostmanRuntime'
];
const OTHER_BOT = /bot|crawler|spider|scraper|headless/i;

// Tundmatu roboti nimi UA-st: „compatible; XBot/1.0“ → XBot, „XBot/1.0 (+url)“ → XBot, muidu bot/crawler/spider sõna
const extractBotName = (ua: string): string | null => {
  const compatible = /compatible;\s*([^/;)]+)/i.exec(ua)?.[1]?.trim();
  if (compatible && OTHER_BOT.test(compatible)) return compatible.slice(0, 60);
  const product = /^([^/(]+)/.exec(ua)?.[1]?.trim();
  if (product && !/^mozilla$/i.test(product) && OTHER_BOT.test(product)) return product.slice(0, 60);
  return /[\w.-]*(bot|crawler|spider|scraper)[\w.-]*/i.exec(ua)?.[0]?.slice(0, 60) ?? null;
};

const findName = (ua: string, names: string[]) => names.find((n) => ua.includes(n.toLowerCase())) ?? null;

export function classifyUserAgent(ua: string | undefined): { visitorClass: VisitorClass; botName: string | null } {
  const lower = (ua ?? '').toLowerCase();
  if (!lower.trim()) return { visitorClass: 'other_bot', botName: 'UA puudub' };
  const ai = findName(lower, AI_BOTS);
  if (ai) return { visitorClass: 'ai_bot', botName: ai };
  const search = findName(lower, SEARCH_BOTS);
  if (search) return { visitorClass: 'search_bot', botName: search };
  const social = findName(lower, SOCIAL_BOTS);
  if (social) return { visitorClass: 'social_bot', botName: social };
  const seo = findName(lower, SEO_BOTS);
  if (seo) return { visitorClass: 'seo_bot', botName: seo };
  const script = findName(lower, SCRIPTS);
  if (script) return { visitorClass: 'script', botName: script.replace(/\/$/, '') };
  if (OTHER_BOT.test(lower)) return { visitorClass: 'other_bot', botName: extractBotName(ua ?? '') };
  return { visitorClass: 'human', botName: null };
}

export function detectDevice(ua: string | undefined): Device {
  const s = ua ?? '';
  if (/iPad|Tablet/i.test(s) || (/Android/i.test(s) && !/Mobile/i.test(s))) return 'tablet';
  if (/Mobi|iPhone|Android/i.test(s)) return 'mobile';
  return 'desktop';
}
