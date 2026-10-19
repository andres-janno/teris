// src/landing/render.ts — landing'u staatiline HTML, JSON-LD ja masinloetavad failid sisust.
// Kasutatakse ehitusel (landingHtmlPlugin.ts) — brauseris seda koodi ei jookse.
import type { LandingContent } from './content.et.ts';

export function escapeHtml(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const e = escapeHtml;

// Kaubamärk „TERIS“ lehe tekstis paksu kaldkirjana nagu logos (ainult tekstisisus, mitte atribuutides).
export const brandText = (s: string): string => escapeHtml(s).replace(/TERIS/g, '<em class="lp-brand-word">TERIS</em>');
const t = brandText;
const abs = (c: LandingContent, p: string) => `${c.siteUrl}${p}`;

export function buildJsonLd(c: LandingContent): object[] {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'SoftwareApplication',
      name: c.name,
      url: `${c.siteUrl}/`,
      applicationCategory: 'BusinessApplication',
      applicationSubCategory: 'Farm management',
      operatingSystem: 'Web',
      inLanguage: c.lang,
      description: c.description,
      featureList: c.features.map((f) => f.title),
      publisher: { '@type': 'Organization', name: c.organization.name }
    },
    {
      '@context': 'https://schema.org',
      '@type': 'Organization',
      name: c.organization.name,
      url: `${c.siteUrl}/`,
      logo: abs(c, '/teris-logo-color.svg'),
      email: c.organization.email
    },
    {
      '@context': 'https://schema.org',
      '@type': 'FAQPage',
      mainEntity: c.faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } }))
    }
  ];
}

// </script> ei tohi JSON-i seest skripti sulgeda
const jsonForScript = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c');

function metaTags(c: LandingContent, title: string, description: string, path: string): string {
  return [
    `<title>${e(title)}</title>`,
    `<meta name="description" content="${e(description)}" />`,
    `<link rel="canonical" href="${e(abs(c, path))}" />`,
    `<meta property="og:type" content="website" />`,
    `<meta property="og:locale" content="et_EE" />`,
    `<meta property="og:site_name" content="${e(c.name)}" />`,
    `<meta property="og:title" content="${e(title)}" />`,
    `<meta property="og:description" content="${e(description)}" />`,
    `<meta property="og:url" content="${e(abs(c, path))}" />`,
    `<meta property="og:image" content="${e(abs(c, c.ogImage))}" />`,
    `<meta name="twitter:card" content="summary_large_image" />`
  ].join('\n    ');
}

export function renderLandingHead(c: LandingContent): string {
  return `${metaTags(c, c.title, c.description, '/')}
    <link rel="alternate" type="text/markdown" href="/llms.txt" title="llms.txt" />
    <script type="application/ld+json">${jsonForScript(buildJsonLd(c))}</script>`;
}

function header(c: LandingContent, home: boolean): string {
  const a = (hash: string) => (home ? hash : `/${hash}`);
  return `<header class="lp-header">
  <a class="lp-brand" href="/" aria-label="${e(c.name)}"><img src="/teris-horizontal-color.svg" alt="${e(c.name)}" width="132" height="32" /></a>
  <nav class="lp-nav" aria-label="Peamenüü">
    <a href="${a('#features')}">${e(c.nav.features)}</a>
    ${c.audience ? `<a href="${a('#audience')}">${e(c.nav.audience)}</a>` : ''}
    <a href="${a('#faq')}">${e(c.nav.faq)}</a>
  </nav>
  <div class="lp-header-actions">
    <a class="lp-btn lp-btn-ghost" href="/login" data-cta="header-login">${e(c.nav.login)}</a>
    <a class="lp-btn lp-btn-primary" href="${a('#interest')}" data-cta="header">${e(c.nav.cta)}</a>
  </div>
</header>`;
}

function footer(c: LandingContent): string {
  return `<footer class="lp-footer">
  <span>${e(c.footer.copyright)}</span>
  <a href="mailto:${e(c.organization.email)}">${e(c.organization.email)}</a>
  <a href="/privacy">${e(c.footer.privacy)}</a>
  <a class="lp-btn lp-btn-primary" href="/#interest" data-cta="footer">${e(c.nav.cta)}</a>
</footer>`;
}

export function renderLandingBody(c: LandingContent): string {
  const L = c.interest.labels;
  const field = (id: string, label: string, attrs: string) =>
    `<div class="lp-field"><label for="interest-${id}">${e(label)}</label><input id="interest-${id}" name="${id}" ${attrs} /></div>`;
  return `${header(c, true)}
<main>
  <section class="lp-hero" aria-labelledby="hero-title">
    <div class="lp-hero-backdrop" aria-hidden="true">
      <div class="lp-hero-photo"></div>
      <div class="lp-hero-sun"></div>
      <div class="lp-hero-shade"></div>
      <canvas class="lp-dust"></canvas>
    </div>
    <div class="lp-hero-text">
      <h1 id="hero-title">${t(c.hero.headline)}</h1>
      <p class="lp-lead">${t(c.hero.lead)}</p>
      <a class="lp-btn lp-btn-primary lp-btn-lg" href="#interest" data-cta="hero">${e(c.hero.cta)}</a>
    </div>
  </section>

${c.preview ? `
  <section id="preview" class="lp-section" aria-labelledby="preview-title">
    <h2 id="preview-title">${t(c.preview.title)}</h2>
    <div class="lp-card lp-preview-card">
      <img class="lp-preview-image" src="${e(c.preview.image)}" alt="${e(c.preview.imageAlt)}" width="1200" height="750" loading="lazy" />
    </div>
  </section>
` : ''}
  <section id="features" class="lp-section" aria-labelledby="features-title">
    <h2 id="features-title">${t(c.featuresTitle)}</h2>
    <div class="lp-grid">
      ${c.features.map((f) => `<article class="lp-card" id="feature-${e(f.id)}"><h3>${t(f.title)}</h3><p>${t(f.text)}</p></article>`).join('\n      ')}
    </div>
  </section>

${c.audience ? `
  <section id="audience" class="lp-section" aria-labelledby="audience-title">
    <h2 id="audience-title">${t(c.audience.title)}</h2>
    <div class="lp-grid lp-grid-2">
      ${c.audience.items.map((x) => `<article class="lp-card"><h3>${t(x.title)}</h3><p>${t(x.text)}</p></article>`).join('\n      ')}
    </div>
  </section>
` : ''}
  <section id="steps" class="lp-section" aria-labelledby="steps-title">
    <h2 id="steps-title">${t(c.stepsTitle)}</h2>
    <ol class="lp-steps">
      ${c.steps.map((s) => `<li><h3>${t(s.title)}</h3><p>${t(s.text)}</p></li>`).join('\n      ')}
    </ol>
    <a class="lp-btn lp-btn-primary" href="#interest" data-cta="steps">${e(c.nav.cta)}</a>
  </section>

  <section id="faq" class="lp-section" aria-labelledby="faq-title">
    <h2 id="faq-title">${t(c.faqTitle)}</h2>
    ${c.faq.map((f) => `<details class="lp-faq"><summary>${t(f.q)}</summary><p>${t(f.a)}</p></details>`).join('\n    ')}
  </section>

  <section id="interest" class="lp-section lp-interest" aria-labelledby="interest-title">
    <h2 id="interest-title">${t(c.interest.title)}</h2>
    <p class="lp-lead">${t(c.interest.lead)}</p>
    <form id="interest-form" class="lp-form" novalidate data-sending="${e(c.interest.sending)}" data-success="${e(c.interest.success)}" data-error="${e(c.interest.error)}">
      ${field('name', L.name + ' *', 'required maxlength="100" autocomplete="name"')}
      ${field('email', L.email + ' *', 'type="email" required maxlength="254" autocomplete="email"')}
      ${field('company', L.company, 'maxlength="100" autocomplete="organization"')}
      ${field('phone', L.phone, 'type="tel" maxlength="30" autocomplete="tel"')}
      ${field('areaHa', L.areaHa, 'inputmode="decimal" maxlength="10"')}
      <div class="lp-field lp-field-wide"><label for="interest-message">${e(L.message)}</label><textarea id="interest-message" name="message" maxlength="2000" rows="4"></textarea></div>
      <div class="lp-hp" aria-hidden="true"><label for="interest-website">Veebileht</label><input id="interest-website" name="website" tabindex="-1" autocomplete="off" /></div>
      <p class="lp-note lp-field-wide">${t(c.interest.privacyNote)} <a href="/privacy">${e(c.footer.privacy)}</a></p>
      <div class="lp-form-status lp-field-wide" role="status" aria-live="polite"></div>
      <button type="submit" class="lp-btn lp-btn-primary lp-btn-lg">${e(c.interest.submit)}</button>
    </form>
  </section>
</main>
${footer(c)}`;
}

export function renderPrivacyHead(c: LandingContent): string {
  return metaTags(c, `${c.privacy.title} — ${c.name}`, c.privacy.sections[1].paragraphs[0], '/privacy');
}

export function renderPrivacyBody(c: LandingContent): string {
  return `${header(c, false)}
<main class="lp-section lp-prose">
  <h1>${t(c.privacy.title)}</h1>
  <p class="lp-note">Uuendatud ${e(c.privacy.updated)}</p>
  ${c.privacy.sections.map((s) => `<h2>${t(s.title)}</h2>\n  ${s.paragraphs.map((p) => `<p>${t(p)}</p>`).join('\n  ')}`).join('\n  ')}
</main>
${footer(c)}`;
}

export function renderLlmsTxt(c: LandingContent): string {
  return [
    `# ${c.name}`,
    '',
    `> ${c.description}`,
    '',
    `${c.hero.lead}`,
    '',
    `## ${c.featuresTitle}`,
    '',
    ...c.features.map((f) => `- **${f.title}**: ${f.text}`),
    '',
    ...(c.audience ? [`## ${c.audience.title}`, '', ...c.audience.items.map((a) => `- **${a.title}**: ${a.text}`), ''] : []),
    `## ${c.faqTitle}`,
    '',
    ...c.faq.flatMap((f) => [`### ${f.q}`, '', f.a, '']),
    '## Lingid',
    '',
    `- [Avaleht](${c.siteUrl}/)`,
    `- [Tunnen huvi — kontaktvorm](${c.siteUrl}/#interest)`,
    `- [Privaatsusteade](${c.siteUrl}/privacy)`,
    `- Kontakt: ${c.organization.email}`,
    ''
  ].join('\n');
}

export function renderRobotsTxt(siteUrl: string): string {
  return ['User-agent: *', 'Allow: /', ...['/api/', '/login', '/support', '/set-password', '/tugi', '/parool'].map((p) => `Disallow: ${p}`), '', `Sitemap: ${siteUrl}/sitemap.xml`, ''].join('\n');
}

export function renderSitemap(siteUrl: string): string {
  const url = (p: string) => `  <url><loc>${siteUrl}${p}</loc></url>`;
  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${url('/')}
${url('/privacy')}
</urlset>
`;
}
