// src/help/sanitizeHelp.ts — juhendi HTML-i puhastus (DOMPurify): kasutatakse admin-redaktoris salvestamisel ja rakenduses kuvamisel.
import DOMPurify from 'dompurify';

const ALLOWED_TAGS = ['p', 'br', 'strong', 'b', 'em', 'i', 'u', 'h3', 'h4', 'ul', 'ol', 'li', 'a'];
const ALLOWED_ATTR = ['href', 'target', 'rel'];

let hooked = false;
function ensureHook() {
  if (hooked) return;
  hooked = true;
  // Lingid avanevad alati uues aknas ega anna avajale ligipääsu
  DOMPurify.addHook('afterSanitizeAttributes', (node) => {
    if (node.tagName === 'A') {
      node.setAttribute('target', '_blank');
      node.setAttribute('rel', 'noopener noreferrer');
    }
  });
}

export function sanitizeHelp(html: string): string {
  ensureHook();
  return DOMPurify.sanitize(html, {
    ALLOWED_TAGS,
    ALLOWED_ATTR,
    ALLOWED_URI_REGEXP: /^(?:https?:|mailto:|tel:|#|\/)/i
  });
}
