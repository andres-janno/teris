// Seotud peatüki loetav nimi (nt ajaloo loendis); tundmatu võti või vigane link ei viska, vaid näidatakse toorelt.
import { GUIDE_CHAPTERS } from './guideChapters.ts';
import { parseGuideRef } from './guideLink.ts';

export function guideLinkLabel(link: string | null): string {
  if (!link) return '';
  const ref = parseGuideRef(link);
  const title = ref?.chapter ? GUIDE_CHAPTERS.find((c) => c.key === ref.chapter)?.title : undefined;
  if (!ref || !title) return link;
  return ref.anchor ? `${title} (${ref.anchor})` : title;
}
