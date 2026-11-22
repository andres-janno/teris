// src/help/sanitizeHelp.ts — juhendi HTML-i puhastus (DOMPurify): kasutatakse admin-redaktoris salvestamisel ja rakenduses kuvamisel.
// h3 saab ankru (id `g-<pealkirjast tuletatud lühinimi>`, vt anchors.ts); `#guide.<peatükk>[#ankur]` lingid jäävad rakenduse sisesteks.
import DOMPurify from 'dompurify';
import { anchorDomId, nextSlug } from './anchors.ts';

const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h3', 'h4', 'ul', 'ol', 'li', 'a'];
const ALLOWED_ATTR = ['href', 'target', 'rel', 'id'];

let hooked = false;
// h3 lühinimede loendur; nullitakse iga sanitizeHelp väljakutse alguses
let seenSlugs = new Map<string, number>();

function ensureHook() {
  if (hooked) return;
  hooked = true;
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      const href = node.getAttribute('href') ?? '';
      if (href.startsWith('#')) {
        // rakenduse sisene link (peatükk/ankur): jääb samasse aknasse
        node.removeAttribute('target');
        node.removeAttribute('rel');
      } else {
        // välislingid avanevad alati uues aknas ega anna avajale ligipääsu
        node.setAttribute('target', '_blank');
        node.setAttribute('rel', 'noopener noreferrer');
      }
    }
    // id lubatud ainult h3-l ja selle väärtuse tuletab alati meie (kleebitud id-sid ei usaldata)
    if (node.tagName === 'H3') node.setAttribute('id', anchorDomId(nextSlug(seenSlugs, node.textContent ?? '')));
    else node.removeAttribute('id');
  });
}

export function sanitizeHelp(html: string): string {
  ensureHook();
  seenSlugs = new Map();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#|\/)/i
  });
}
