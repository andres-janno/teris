// src/server/mail.ts — e-kirjad (parooli lingid) serveri sendmail'i (Postfix) kaudu.
import { spawn } from 'node:child_process';

export const MAIL_FROM = process.env.MAIL_FROM || 'noreply@agro.ventcap.ee';
export const APP_BASE_URL = (process.env.APP_BASE_URL || 'https://agro.ventcap.ee').replace(/\/+$/, '');

export function normalizeEmail(raw: unknown): string | null {
  const email = String(raw ?? '').trim().toLowerCase();
  if (email.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
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
  const subject = o.purpose === 'INVITE' ? 'Kutse AGRO rakendusse' : 'AGRO parooli määramine';
  const greeting = o.displayName ? `Tere, ${o.displayName}!` : 'Tere!';
  const lines =
    o.purpose === 'INVITE'
      ? [
          greeting,
          '',
          `Sulle on loodud konto AGRO rakendusse kasutajanimega ${o.username}.`,
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
    `From: AGRO <${assertHeaderSafe(o.from)}>`,
    `To: ${assertHeaderSafe(o.to)}`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString()}`,
    'MIME-Version: 1.0',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit'
  ];
  return `${headers.join('\n')}\n\n${lines.join('\n')}\n`;
}

export function sendMail(message: string): Promise<void> {
  if (process.env.MAIL_DISABLED === '1') {
    const subject = /^Subject: (.*)$/m.exec(message)?.[1] ?? '';
    console.log('[Mail] MAIL_DISABLED — kirja ei saadetud:', subject);
    return Promise.resolve();
  }
  return new Promise((resolve, reject) => {
    const child = spawn('/usr/sbin/sendmail', ['-t', '-i', '-f', MAIL_FROM], { stdio: ['pipe', 'ignore', 'ignore'] });
    let settled = false;
    const settleResolve = () => {
      if (settled) return;
      settled = true;
      resolve();
    };
    const settleReject = (err: Error) => {
      if (settled) return;
      settled = true;
      reject(err);
    };
    child.on('error', settleReject);
    child.stdin.on('error', settleReject);
    child.on('close', (code) => (code === 0 ? settleResolve() : settleReject(new Error(`sendmail lõpetas koodiga ${code}`))));
    child.stdin.end(message);
  });
}
