// src/components/GuideView.tsx — kasutusjuhend: täislehe vaade. Vasakul peatükkide loend, paremal peatüki tekst;
// ülal otsing üle kõigi peatükkide. Kitsal ekraanil on loend rippmenüü. Sügavlink: `#guide.<peatükk>[#ankur]` (guideRoute.ts).
// Moodulist sõltuvat peatükki ettevõttele, kellel moodulit pole, ei näidata; viited neile saavad märke „vajab moodulit …“.
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { BookOpen } from 'lucide-react';
import { Alert, cn, Card, CardButton, EmptyState, PageHeader, SearchInput, Select, type SelectOption } from './ui';
import { boardBodyClass, boardMainClass, boardViewClass } from './ui/variants';
import { MODULE_LABELS, chapterByKey, visibleChapters, type GuideChapterKey } from '../help/guideChapters';
import { markModuleLinks, parseGuideRef, type GuideRef } from '../help/guideLink';
import { anchorDomId } from '../help/anchors';
import { searchGuide } from '../help/guideSearch';
import { openGuide } from '../help/guideRoute';
import { reloadHelp, useGuideChapters } from '../help/helpStore';
import { sanitizeHelp } from '../help/sanitizeHelp';
import type { LicenseModule } from '../types/auth';

export const GuideView: React.FC<{ route: GuideRef; hasModule: (m: LicenseModule) => boolean }> = ({ route, hasModule }) => {
  const { chapters, loaded } = useGuideChapters();
  const [query, setQuery] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null); // tegelik kerija (boardBodyClass)
  const [scrollTick, setScrollTick] = useState(0); // sama hash'i link ei muuda marsruuti, aga peab ikkagi kerima

  const visible = useMemo(() => visibleChapters(hasModule), [hasModule]);
  const requested = route.chapter;
  const hiddenRequested = requested && !visible.some((c) => c.key === requested) ? chapterByKey(requested) : null;
  const current = (requested && visible.find((c) => c.key === requested)) || visible[0];

  useEffect(() => {
    reloadHelp();
  }, []);

  const missingModule = useCallback(
    (key: GuideChapterKey): string | null => {
      const m = chapterByKey(key).module;
      return m && !hasModule(m) ? MODULE_LABELS[m] : null;
    },
    [hasModule]
  );

  const rawHtml = chapters[current.key];
  const safe = useMemo(() => (rawHtml ? markModuleLinks(sanitizeHelp(rawHtml), missingModule) : ''), [rawHtml, missingModule]);

  const hits = useMemo(
    () => (query.trim().length >= 2 ? searchGuide(visible.map((c) => ({ key: c.key, title: c.title, html: chapters[c.key] ?? '' })), query) : null),
    [query, visible, chapters]
  );

  // Kohale kerimine: ankur (kui on) või peatüki algus
  useEffect(() => {
    const box = scrollRef.current;
    if (!box || hits) return;
    const target = route.anchor ? box.querySelector<HTMLElement>(`#${CSS.escape(anchorDomId(route.anchor))}`) : null;
    if (target) target.scrollIntoView({ block: 'start' });
    else box.scrollTo({ top: 0 });
  }, [current.key, route.anchor, safe, hits, scrollTick]);

  const go = (key: GuideChapterKey, anchor: string | null = null) => {
    setQuery('');
    openGuide({ chapter: key, anchor });
    setScrollTick((t) => t + 1);
  };

  // Peatükkide vahelised lingid (`#guide.fields#import`) avanevad selles vaates
  const onContentClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const href = (e.target as HTMLElement).closest('a')?.getAttribute('href');
    const ref = href?.startsWith('#guide') ? parseGuideRef(href) : null;
    if (!ref || e.metaKey || e.ctrlKey || e.shiftKey || e.button !== 0) return; // uues sakis avamine jääb brauserile
    e.preventDefault();
    setQuery('');
    openGuide(ref);
    setScrollTick((t) => t + 1);
  };

  const chapterOptions: SelectOption[] = visible.map((c) => ({ value: c.key, label: c.title }));

  return (
    <div className={boardViewClass}>
      <main className={boardMainClass}>
        <PageHeader
          icon={<BookOpen />}
          title="Juhend"
          subtitle="Kuidas Terisega töötada: peatükid vaadete kaupa ja ülesanded samm-sammult"
          actions={<SearchInput value={query} onChange={setQuery} placeholder="Otsi juhendist…" aria-label="Otsi juhendist" className="w-72 max-[861px]:w-[calc(100vw-2rem)]" />}
        />
        <div ref={scrollRef} className={cn(boardBodyClass, 'grid grid-cols-[minmax(220px,280px)_minmax(0,1fr)] content-start items-start gap-4 max-[861px]:grid-cols-1')}>
          <Card className="flex flex-col gap-0.5 max-[861px]:hidden">
            {visible.map((c, i) => (
              <CardButton key={c.key} variant="tile" padding="none" selected={!hits && c.key === current.key} className="flex w-full items-baseline gap-2 px-2.5 py-2 text-left" onClick={() => go(c.key)}>
                <span className="num text-xs leading-natural text-subtle">{i + 1}</span>
                <span className="text-base font-medium leading-natural">{c.title}</span>
                {chapters[c.key] === undefined && loaded && <span className="ml-auto text-xs leading-natural text-subtle">koostamisel</span>}
              </CardButton>
            ))}
          </Card>
          <div className="hidden max-[861px]:block">
            <Select aria-label="Peatükk" value={current.key} onValueChange={(v) => go(v as GuideChapterKey)} options={chapterOptions} />
          </div>

          <div className="min-h-0 min-w-0">
            {hits ? (
              <Card className="flex flex-col gap-2">
                <div className="text-sm text-muted-foreground">{hits.length === 0 ? 'Midagi ei leitud.' : `${hits.length} tabamust`}</div>
                {hits.map((h, i) => (
                  <CardButton key={i} variant="tile" padding="none" className="flex w-full flex-col items-start gap-0.5 px-2.5 py-2 text-left" onClick={() => go(h.chapter, h.anchor)}>
                    <span className="text-xs font-semibold text-subtle">
                      {h.chapterTitle}
                      {h.anchorText ? ` · ${h.anchorText}` : ''}
                    </span>
                    <span className="text-sm text-foreground">
                      {h.before}
                      <strong>{h.match}</strong>
                      {h.after}
                    </span>
                  </CardButton>
                ))}
              </Card>
            ) : (
              <Card className="mx-auto max-w-3xl">
                {hiddenRequested?.module && (
                  <Alert>Peatükk „{hiddenRequested.title}“ vajab moodulit „{MODULE_LABELS[hiddenRequested.module]}“, mida teie ettevõttel pole.</Alert>
                )}
                <h2 className="mb-3 text-xl font-semibold leading-natural">{current.title}</h2>
                {safe ? (
                  // oxlint-disable-next-line jsx-a11y/click-events-have-key-events
                  <div className="help-content" onClick={onContentClick} dangerouslySetInnerHTML={{ __html: safe }} />
                ) : !loaded ? (
                  <div className="text-sm text-muted-foreground">Laadin…</div>
                ) : (
                  <EmptyState title="Juhend on koostamisel" description="Selle peatüki tekst lisandub peagi." />
                )}
              </Card>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
