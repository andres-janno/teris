// src/landing/landing.ts — landing'u beacon (vaatamine, CTA klõpsud) ja „Tunnen huvi“ vorm.
// Ilma Reactita, et leht jääks kergeks; sisu on HTML-is juba olemas.
const params = new URLSearchParams(location.search);
const utm = { utmSource: params.get('utm_source'), utmMedium: params.get('utm_medium'), utmCampaign: params.get('utm_campaign') };
const openedAt = Date.now();

function track(event: 'view' | 'cta_click' | 'form_submit', target?: string): void {
  // keepalive: päring jõuab kohale ka siis, kui klõps viib lehelt ära (nt /login)
  fetch('/api/landing/event', {
    method: 'POST',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ event, target, path: location.pathname, referrer: document.referrer, ...utm })
  }).catch(() => undefined);
}

track('view');
document.querySelectorAll<HTMLElement>('[data-cta]').forEach((el) => {
  el.addEventListener('click', () => track('cta_click', el.dataset.cta));
});

const form = document.getElementById('interest-form') as HTMLFormElement | null;
if (form) {
  const status = form.querySelector<HTMLElement>('.lp-form-status')!;
  const button = form.querySelector<HTMLButtonElement>('button[type="submit"]')!;
  const buttonLabel = button.textContent ?? '';
  const show = (text: string, isError: boolean) => {
    status.textContent = text;
    status.classList.toggle('error', isError);
  };
  form.addEventListener('submit', async (ev) => {
    ev.preventDefault();
    if (!form.reportValidity()) return;
    const data = Object.fromEntries(new FormData(form).entries()) as Record<string, string>;
    button.disabled = true;
    button.textContent = form.dataset.sending ?? '…';
    show('', false);
    try {
      const res = await fetch('/api/landing/interest', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...data, elapsedMs: Date.now() - openedAt, referrer: document.referrer, utmSource: utm.utmSource })
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        show(typeof body?.error === 'string' ? body.error : (form.dataset.error ?? ''), true);
        return;
      }
      track('form_submit');
      form.reset();
      show(form.dataset.success ?? '', false);
    } catch {
      show(form.dataset.error ?? '', true);
    } finally {
      button.disabled = false;
      button.textContent = buttonLabel;
    }
  });
}
