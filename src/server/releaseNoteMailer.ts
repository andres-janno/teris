// src/server/releaseNoteMailer.ts — taustasaatja release_note_deliveries järjekorrale.
// Saadab PENDING olekus kirjad väikeste pausidega, et vältida HTTP timeout'e ja Postfixi koormuspiike.
import { authDb } from './db.ts';
import { APP_BASE_URL, MAIL_FROM, buildReleaseNoteMail, sendMail } from './mail.ts';
import { issueFreshUnsubscribeToken, takePendingUnsubscribeToken } from './releaseNotes.ts';
import type { ReleaseNoteItem } from '../types/releaseNotes.ts';

const POLL_INTERVAL_MS = 15_000;
const BATCH_SIZE = 10;
const SEND_DELAY_MS = 300;
const MAX_ATTEMPTS = 3;

let running = false;
let timer: NodeJS.Timeout | null = null;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function processReleaseNoteMailBatch(opts?: { delayMs?: number }): Promise<number> {
  if (running) return 0;
  running = true;
  let processed = 0;
  const delayMs = opts?.delayMs ?? SEND_DELAY_MS;

  try {
    const pending = await authDb().releaseNoteDelivery.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: BATCH_SIZE,
      include: {
        releaseNote: {
          select: { version: true, title: true, summary: true, itemsJson: true }
        }
      }
    });

    for (let i = 0; i < pending.length; i++) {
      const d = pending[i];
      if (i > 0 && delayMs > 0) await sleep(delayMs);

      try {
        const rawToken = takePendingUnsubscribeToken(d.id) ?? (await issueFreshUnsubscribeToken(d.id));
        const items = Array.isArray(d.releaseNote.itemsJson) ? (d.releaseNote.itemsJson as unknown as ReleaseNoteItem[]) : [];
        const message = buildReleaseNoteMail({
          to: d.email,
          from: MAIL_FROM,
          displayName: d.displayName,
          version: d.releaseNote.version,
          title: d.releaseNote.title,
          summary: d.releaseNote.summary,
          items,
          appLink: `${APP_BASE_URL}/#releases`,
          unsubscribeLink: `${APP_BASE_URL}/api/release-notes/unsubscribe?token=${encodeURIComponent(rawToken)}`
        });
        await sendMail(message, d.email);
        await authDb().releaseNoteDelivery.update({
          where: { id: d.id },
          data: { status: 'SENT', sentAt: new Date(), attempts: d.attempts + 1, lastError: null }
        });
      } catch (err) {
        const attempts = d.attempts + 1;
        const errMsg = err instanceof Error ? err.message : String(err);
        await authDb().releaseNoteDelivery.update({
          where: { id: d.id },
          data: {
            attempts,
            lastError: errMsg.slice(0, 500),
            status: attempts >= MAX_ATTEMPTS ? 'FAILED' : 'PENDING'
          }
        });
        console.error(`[ReleaseNoteMailer] saatmine ebaõnnestus (${d.email}, katse ${attempts}/${MAX_ATTEMPTS}):`, errMsg);
      }
      processed++;
    }
  } finally {
    running = false;
  }
  return processed;
}

export function triggerReleaseNoteMailFlush(): void {
  void processReleaseNoteMailBatch().catch((err) => {
    console.error('[ReleaseNoteMailer] taustatöö viga:', err);
  });
}

export function startReleaseNoteMailScheduler(): void {
  if (timer) return;
  timer = setInterval(() => {
    triggerReleaseNoteMailFlush();
  }, POLL_INTERVAL_MS);
  timer.unref?.();
  triggerReleaseNoteMailFlush();
}
