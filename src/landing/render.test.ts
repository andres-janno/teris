// src/landing/render.test.ts
import { describe, it, expect } from 'vitest';
import { CONTENT_ET } from './content.et.ts';
import { brandText, renderLandingHead, renderLandingBody, renderPrivacyBody, renderLlmsTxt, renderRobotsTxt, renderSitemap, buildJsonLd, escapeHtml } from './render.ts';

const c = CONTENT_ET;

describe('renderLandingBody', () => {
  const html = renderLandingBody(c);
  it('sisaldab ilma JS-ita kõiki sektsioone ja ühte h1-te', () => {
    expect(html.match(/<h1[\s>]/g)?.length).toBe(1);
    for (const t of [c.hero.headline, c.featuresTitle, c.stepsTitle, c.faqTitle, c.interest.title]) expect(html).toContain(brandText(t));
    if (c.preview) expect(html).toContain(brandText(c.preview.title));
    if (c.audience) expect(html).toContain(brandText(c.audience.title));
    for (const f of c.features) expect(html).toContain(brandText(f.title));
    for (const q of c.faq) expect(html).toContain(brandText(q.q));
  });
  it('vorm, ankrud ja CTA märgised', () => {
    expect(html).toContain('id="interest"');
    expect(html).toContain('href="/login"');
    expect(html).toContain('name="website"'); // honeypot
    for (const t of ['header', 'hero', 'steps', 'footer']) expect(html).toContain(`data-cta="${t}"`);
  });
});

describe('brandText', () => {
  it('TERIS kaldkirjas, ülejäänu turvaliselt kodeeritud', () => {
    expect(brandText('Mida TERIS teeb <b>')).toBe('Mida <em class="lp-brand-word">TERIS</em> teeb &lt;b&gt;');
    expect(brandText('TERIS-esse')).toBe('<em class="lp-brand-word">TERIS</em>-esse');
  });
  it('atribuutides jääb TERIS tavatekstiks', () => {
    const html = renderLandingBody(c);
    expect(html).not.toMatch(/="[^"]*<em/);
  });
});

describe('valikulised sektsioonid', () => {
  it('eelvaade ja „Kellele“ renderdatakse ainult siis, kui sisu on olemas', () => {
    const without = renderLandingBody({ ...c, preview: undefined, audience: undefined });
    expect(without).not.toContain('id="preview"');
    expect(without).not.toContain('id="audience"');
    expect(without).not.toContain('href="#audience"');
    const withBoth = renderLandingBody({
      ...c,
      preview: { title: 'Eelvaade', imageAlt: 'Kaart', image: '/landing/hero.svg' },
      audience: { title: 'Kellele', items: [{ title: 'Kasvatajad', text: 'Tekst' }] }
    });
    expect(withBoth).toContain('id="preview"');
    expect(withBoth).toContain('src="/landing/hero.svg"');
    expect(withBoth).toContain('id="audience"');
    expect(withBoth).toContain('href="#audience"');
  });
});

describe('JSON-LD', () => {
  it('kehtiv JSON õigete tüüpidega; FAQPage = nähtav KKK', () => {
    const ld = buildJsonLd(c) as any[];
    expect(ld.map((x) => x['@type'])).toEqual(['SoftwareApplication', 'Organization', 'FAQPage']);
    expect(ld[2].mainEntity.map((e: any) => e.name)).toEqual(c.faq.map((f) => f.q));
    const head = renderLandingHead(c);
    const m = /<script type="application\/ld\+json">([\s\S]*?)<\/script>/.exec(head);
    expect(m).not.toBeNull();
    expect(JSON.parse(m![1])).toHaveLength(3);
  });
  it('head: title, description, canonical, OG', () => {
    const head = renderLandingHead(c);
    expect(head).toContain(`<title>${escapeHtml(c.title)}</title>`);
    expect(head).toContain('<link rel="canonical" href="https://teris.ee/" />');
    expect(head).toContain('property="og:image" content="https://teris.ee/og-teris.png"');
  });
});

describe('masinloetavad failid', () => {
  it('robots.txt ei keela avalehte, keelab api ja login', () => {
    const r = renderRobotsTxt(c.siteUrl);
    expect(r).toContain('User-agent: *\nAllow: /\n');
    expect(r).not.toMatch(/^Disallow: \/$/m);
    for (const p of ['/api/', '/login', '/support', '/set-password', '/tugi', '/parool']) expect(r).toContain(`Disallow: ${p}\n`);
    expect(r).toContain('Sitemap: https://teris.ee/sitemap.xml');
  });
  it('sitemap sisaldab / ja /privacy', () => {
    const s = renderSitemap(c.siteUrl);
    expect(s).toContain('<loc>https://teris.ee/</loc>');
    expect(s).toContain('<loc>https://teris.ee/privacy</loc>');
  });
  it('llms.txt sisaldab kõiki võimalusi ja linke', () => {
    const t = renderLlmsTxt(c);
    expect(t.startsWith(`# ${c.name}\n`)).toBe(true);
    for (const f of c.features) expect(t).toContain(f.title);
    expect(t).toContain('https://teris.ee/#interest');
  });
  it('privaatsusleht', () => {
    expect(renderPrivacyBody(c)).toContain(brandText(c.privacy.title));
  });
});
