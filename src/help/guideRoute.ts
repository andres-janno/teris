// src/help/guideRoute.ts — juhendi sügavlink on URL-i hash (`#guide.fields#import`): ajalugu ja tagasi-nupp töötavad
// brauseri enda `hashchange`/`popstate` kaudu; „?“-ikooni ja peatükkide vahelised lingid on samad hash-lingid.
import { useMemo, useSyncExternalStore } from 'react';
import { guideHash, parseGuideRef, type GuideRef } from './guideLink';

const REFRESH = 'teris:guide-route';

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb);
  window.addEventListener('popstate', cb);
  window.addEventListener(REFRESH, cb);
  return () => {
    window.removeEventListener('hashchange', cb);
    window.removeEventListener('popstate', cb);
    window.removeEventListener(REFRESH, cb);
  };
};

/** Praegune juhendi viide URL-ist; null = juhend pole avatud */
export function useGuideRoute(): GuideRef | null {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash, () => '');
  return useMemo(() => parseGuideRef(hash), [hash]);
}

/** Avab juhendi (uus ajaloo kirje: tagasi-nupp viib eelmisesse kohta). */
export function openGuide(ref: GuideRef = { chapter: null, anchor: null }): void {
  const target = guideHash(ref);
  if (window.location.hash === target) {
    window.dispatchEvent(new Event(REFRESH));
    return;
  }
  window.location.hash = target;
}

/** Sulgeb juhendi: hash kaob URL-ist (uus ajaloo kirje; tagasi-nupp avab juhendi uuesti). */
export function closeGuide(): void {
  window.history.pushState(null, '', window.location.pathname + window.location.search);
  window.dispatchEvent(new Event(REFRESH));
}
