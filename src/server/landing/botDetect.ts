// User-Agent → külastaja klass, roboti nimi ja seadme tüüp.
export type VisitorClass = 'human' | 'ai_bot' | 'search_bot' | 'other_bot';
export type Device = 'desktop' | 'mobile' | 'tablet';

// AI enne otsingut: „Applebot-Extended“ sisaldab „Applebot“-i.
const AI_BOTS = [
  'GPTBot', 'OAI-SearchBot', 'ChatGPT-User', 'ClaudeBot', 'Claude-User', 'Claude-SearchBot', 'anthropic-ai',
  'PerplexityBot', 'Perplexity-User', 'CCBot', 'Bytespider', 'Amazonbot', 'meta-externalagent',
  'DuckAssistBot', 'Applebot-Extended', 'cohere-ai', 'Google-CloudVertexBot'
];
const SEARCH_BOTS = ['Googlebot', 'bingbot', 'Applebot', 'YandexBot', 'DuckDuckBot', 'Baiduspider'];
const OTHER_BOT = /bot|crawler|spider|curl|wget|python-requests|headless/i;

const findName = (ua: string, names: string[]) => names.find((n) => ua.includes(n.toLowerCase())) ?? null;

export function classifyUserAgent(ua: string | undefined): { visitorClass: VisitorClass; botName: string | null } {
  const lower = (ua ?? '').toLowerCase();
  if (!lower.trim()) return { visitorClass: 'other_bot', botName: null };
  const ai = findName(lower, AI_BOTS);
  if (ai) return { visitorClass: 'ai_bot', botName: ai };
  const search = findName(lower, SEARCH_BOTS);
  if (search) return { visitorClass: 'search_bot', botName: search };
  if (OTHER_BOT.test(lower)) return { visitorClass: 'other_bot', botName: null };
  return { visitorClass: 'human', botName: null };
}

export function detectDevice(ua: string | undefined): Device {
  const s = ua ?? '';
  if (/iPad|Tablet/i.test(s) || (/Android/i.test(s) && !/Mobile/i.test(s))) return 'tablet';
  if (/Mobi|iPhone|Android/i.test(s)) return 'mobile';
  return 'desktop';
}
