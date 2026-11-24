// src/server/mail.ts — e-kirjad (parooli lingid ja väljalaske märkmed) serveri sendmail'i (Postfix) kaudu.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import {
  RELEASE_NOTE_CATEGORIES,
  RELEASE_NOTE_CATEGORY_LABELS,
  type ReleaseNoteItem
} from '../types/releaseNotes.ts';

export const MAIL_FROM = process.env.MAIL_FROM || 'noreply@teris.ee';
export const APP_BASE_URL = (process.env.APP_BASE_URL || 'https://teris.ee').replace(/\/+$/, '');

export function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export function normalizeEmail(raw: unknown): string | null {
  const email = String(raw ?? '').trim().toLowerCase();
  if (email.length > 254) return null;
  // Keelemärgid ,;<>()"' võimaldaksid päise/argumendi süsti (nt mitu saajat, sendmail'i lipud) — need ei tohi läbida.
  return /^[^\s@,;<>()"']+@[^\s@,;<>()"']+\.[^\s@,;<>()"']+$/.test(email) ? email : null;
}

const encodeHeader = (text: string) => `=?UTF-8?B?${Buffer.from(text, 'utf8').toString('base64')}?=`;

function assertHeaderSafe(value: string): string {
  if (/[\r\n]/.test(value)) throw new Error('Päise väärtus sisaldab reavahetust');
  return value;
}

export function buildPasswordLinkMail(o: {
  to: string;
  from: string;
  purpose: 'INVITE' | 'RESET';
  link: string;
  username: string;
  displayName: string | null;
}): string {
  const subject = o.purpose === 'INVITE' ? 'Kutse TERIS rakendusse' : 'TERIS parooli määramine';
  const greeting = o.displayName ? `Tere, ${o.displayName}!` : 'Tere!';
  const lines =
    o.purpose === 'INVITE'
      ? [
          greeting,
          '',
          `Sulle on loodud konto TERIS rakendusse kasutajanimega ${o.username}.`,
          'Määra endale parool alloleval lingil, seejärel saad sisse logida:',
          '',
          o.link,
          '',
          'Link kehtib 7 päeva ja on ühekordne.'
        ]
      : [
          greeting,
          '',
          `Konto ${o.username} parooli saad määrata alloleval lingil:`,
          '',
          o.link,
          '',
          'Link kehtib 1 tund ja on ühekordne. Kui sa seda ei tellinud, võid kirja eirata.'
        ];
  const headers = [
    `From: TERIS <${assertHeaderSafe(o.from)}>`,
    `To: ${assertHeaderSafe(o.to)}`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit'
  ];
  return `${headers.join('\n')}\n\n${lines.join('\n')}\n`;
}

export function buildReleaseNoteMail(o: {
  to: string;
  from: string;
  displayName: string | null;
  version: string;
  title: string;
  summary: string | null;
  items: ReleaseNoteItem[];
  appLink: string;
  unsubscribeLink?: string | null;
  isTest?: boolean;
}): string {
  const prefix = o.isTest ? '[TEST] ' : '';
  const subject = `${prefix}TERIS uuendused (${o.version}): ${o.title}`;
  const greeting = o.displayName ? `Tere, ${o.displayName}!` : 'Tere!';
  const boundary = `teris_${randomBytes(12).toString('hex')}`;

  const groups = RELEASE_NOTE_CATEGORIES.map((category) => ({
    category,
    label: RELEASE_NOTE_CATEGORY_LABELS[category].plural,
    items: o.items.filter((i) => i.category === category)
  })).filter((g) => g.items.length > 0);

  // Plain-text versioon
  const textLines: string[] = [greeting, '', `TERIS on uuenenud (${o.version}) — ${o.title}`];
  if (o.summary?.trim()) textLines.push('', o.summary.trim());
  for (const g of groups) {
    textLines.push('', g.label.toUpperCase());
    for (const item of g.items) {
      const areaPrefix = item.area?.trim() ? `[${item.area.trim()}] ` : '';
      textLines.push(`- ${areaPrefix}${item.text}`);
    }
  }
  textLines.push('', `Vaata kõiki uuendusi TERISes: ${o.appLink}`);
  if (o.unsubscribeLink) {
    textLines.push('', `Kui sa ei soovi enam uuenduste e-kirju saada, saad neist loobuda siin: ${o.unsubscribeLink}`);
  }

  // HTML versioon
  const htmlGroups = groups
    .map((g) => {
      const lis = g.items
        .map((item) => {
          const areaBadge = item.area?.trim()
            ? `<strong style="color:#0f172a;">${escapeHtml(item.area.trim())}:</strong> `
            : '';
          return `<li style="margin:6px 0;line-height:1.5;color:#1e293b;">${areaBadge}${escapeHtml(item.text)}</li>`;
        })
        .join('');
      return `<h3 style="margin:20px 0 8px;font-size:15px;color:#0f172a;border-bottom:1px solid #e2e8f0;padding-bottom:4px;">${escapeHtml(g.label)}</h3><ul style="margin:0;padding-left:20px;">${lis}</ul>`;
    })
    .join('');

  const summaryHtml = o.summary?.trim()
    ? `<p style="margin:12px 0 0;line-height:1.6;color:#334155;">${escapeHtml(o.summary.trim()).replace(/\n/g, '<br>')}</p>`
    : '';
  const unsubHtml = o.unsubscribeLink
    ? `<p style="margin:12px 0 0;font-size:12px;color:#64748b;">Kui sa ei soovi enam uuenduste e-kirju saada, <a href="${escapeHtml(o.unsubscribeLink)}" style="color:#475569;">loobu teavitustest</a>.</p>`
    : '';

  const html = [
    '<!DOCTYPE html>',
    '<html lang="et"><body style="margin:0;padding:24px;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:#0f172a;">',
    '<div style="max-width:600px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:12px;padding:28px;">',
    `<div style="font-size:12px;font-weight:600;letter-spacing:0.04em;text-transform:uppercase;color:#15803d;">TERIS • Versioon ${escapeHtml(o.version)}</div>`,
    `<h2 style="margin:8px 0 0;font-size:20px;line-height:1.3;color:#0f172a;">${escapeHtml(o.title)}</h2>`,
    `<p style="margin:14px 0 0;color:#334155;">${escapeHtml(greeting)}</p>`,
    summaryHtml,
    htmlGroups,
    `<div style="margin:24px 0 0;"><a href="${escapeHtml(o.appLink)}" style="display:inline-block;background:#15803d;color:#ffffff;text-decoration:none;font-weight:600;font-size:14px;padding:10px 18px;border-radius:8px;">Ava uuendused TERISes</a></div>`,
    '<hr style="margin:24px 0 12px;border:none;border-top:1px solid #e2e8f0;">',
    '<p style="margin:0;font-size:12px;color:#64748b;">TERIS — põlluraamat ja farmihaldus</p>',
    unsubHtml,
    '</div></body></html>'
  ].join('');

  const headers = [
    `From: TERIS <${assertHeaderSafe(o.from)}>`,
    `To: ${assertHeaderSafe(o.to)}`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    `Content-Type: multipart/alternative; boundary="${boundary}"`
  ];
  if (o.unsubscribeLink) {
    headers.push(`List-Unsubscribe: <${assertHeaderSafe(o.unsubscribeLink)}>`);
    headers.push('List-Unsubscribe-Post: List-Unsubscribe=One-Click');
  }

  return [
    headers.join('\n'),
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    textLines.join('\n'),
    '',
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    '',
    html,
    '',
    `--${boundary}--`,
    ''
  ].join('\n');
}

const SENDMAIL_TIMEOUT_MS = 15_000;

// Saaja antakse argumendina (mitte -t + To: päisest), et päisesse sattunud
// koma/semikoolon vms ei saaks lisada varjatud saajaid ega sendmail'i lippe.
export function sendMail(message: string, to: string): Promise<void> {
  if (process.env.MAIL_DISABLED === '1') {
    const subject = /^Subject: (.*)$/m.exec(message)?.[1] ?? '';
    console.log('[Mail] MAIL_DISABLED — kirja ei saadetud:', subject);
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/sbin/sendmail', ['-i', '-f', MAIL_FROM, '--', to], { stdio: ['pipe', 'ignore', 'ignore'] });
    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      child.kill();
      settleReject(new Error('sendmail ei vastanud 15 sekundi jooksul'));
    }, SENDMAIL_TIMEOUT_MS);
    const settleResolve = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve();
    };
    const settleReject = (err: Error) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      reject(err);
    };
    child.on('error', settleReject);
    child.stdin.on('error', settleReject);
    child.on('close', (code) => (code === 0 ? settleResolve() : settleReject(new Error(`sendmail lõpetas koodiga ${code}`))));
    child.stdin.end(message);
  });
}
