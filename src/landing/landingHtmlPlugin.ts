// src/landing/landingHtmlPlugin.ts — süstib landing'u ja privaatsuslehe sisu HTML-i ehitusel ja
// arendusserveris ning emiteerib llms.txt, robots.txt ja sitemap.xml.
import type { Plugin } from 'vite';
import { CONTENT_ET } from './content.et.ts';
import { renderLandingHead, renderLandingBody, renderPrivacyHead, renderPrivacyBody, renderLlmsTxt, renderRobotsTxt, renderSitemap } from './render.ts';

const c = CONTENT_ET;
const TEXT_FILES: Record<string, { type: string; body: () => string }> = {
  'llms.txt': { type: 'text/plain; charset=utf-8', body: () => renderLlmsTxt(c) },
  'robots.txt': { type: 'text/plain; charset=utf-8', body: () => renderRobotsTxt(c.siteUrl) },
  'sitemap.xml': { type: 'application/xml; charset=utf-8', body: () => renderSitemap(c.siteUrl) }
};

export function landingHtmlPlugin(): Plugin {
  return {
    name: 'landing-html',
    transformIndexHtml: {
      order: 'pre',
      handler(html, ctx) {
        if (ctx.path.endsWith('/landing.html')) {
          return html.replace('<!--landing:head-->', renderLandingHead(c)).replace('<!--landing:body-->', renderLandingBody(c));
        }
        if (ctx.path.endsWith('/privacy.html')) {
          return html.replace('<!--privacy:head-->', renderPrivacyHead(c)).replace('<!--privacy:body-->', renderPrivacyBody(c));
        }
        return html;
      }
    },
    generateBundle() {
      for (const [fileName, f] of Object.entries(TEXT_FILES)) this.emitFile({ type: 'asset', fileName, source: f.body() });
    },
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const f = TEXT_FILES[(req.url ?? '').split('?')[0].replace(/^\//, '')];
        if (!f) return next();
        res.setHeader('Content-Type', f.type);
        res.end(f.body());
      });
    }
  };
}
