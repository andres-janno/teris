// „Link peatükki“ HTML: href on kujul `#guide.<peatükk>[#ankur]`; tekst ja href on HTML-i jaoks escape'itud.
const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

export const buildChapterLinkHtml = (href: string, title: string): string => `<a href="${escapeHtml(href)}">${escapeHtml(title)}</a>`;
