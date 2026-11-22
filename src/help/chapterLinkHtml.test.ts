// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { buildChapterLinkHtml } from './chapterLinkHtml.ts';
import { GUIDE_CHAPTERS } from './guideChapters.ts';
import { formatGuideRef } from './guideLink.ts';
import { extractAnchors } from './anchors.ts';
import { sanitizeHelp } from './sanitizeHelp.ts';

describe('buildChapterLinkHtml', () => {
  it('escape\'ib href-i ja pealkirja', () => {
    expect(buildChapterLinkHtml('#guide.fields', 'A <b> & "c"')).toBe('<a href="#guide.fields">A &lt;b&gt; &amp; &quot;c&quot;</a>');
  });

  it('sanitizeHelp säilitab href-i igale peatükile ja iga ankru slugile', () => {
    const html = `<h3>Impordi mullaproovid</h3><h3>${'Väga pikk vahepealkiri '.repeat(8)}</h3><h3>Ülemäära  &amp; erimärgid!</h3>`;
    const anchors = extractAnchors(sanitizeHelp(html));
    expect(anchors.length).toBe(3);
    for (const c of GUIDE_CHAPTERS) {
      for (const a of [null, ...anchors.map((x) => x.slug)]) {
        const href = `#${formatGuideRef(c.key, a)}`;
        const out = sanitizeHelp(buildChapterLinkHtml(href, c.title));
        expect(out).toContain(`href="${href}"`);
      }
    }
  });
});
