// Kohtjuhendi „Seotud peatükk“: peatüki valik + valikuline ankur (peatüki h3 pealkirjad salvestatud tekstist).
import { useMemo } from 'react';
import { Select, type SelectOption } from '../components/ui';
import { GUIDE_CHAPTERS, type GuideChapterKey } from '../help/guideChapters.ts';
import { formatGuideRef, parseGuideRef } from '../help/guideLink.ts';
import type { Anchor } from '../help/anchors.ts';
import { adminFieldLabelClass, adminHintClass } from './adminUi.ts';

type Props = { value: string; onChange: (value: string) => void; anchorsOf: (key: GuideChapterKey) => Anchor[] };

const CHAPTER_OPTIONS: SelectOption[] = [
  { value: '', label: '— pole —' },
  ...GUIDE_CHAPTERS.map((c, i) => ({ value: c.key, label: `${i + 1}. ${c.title}` }))
];

export function GuideLinkPicker({ value, onChange, anchorsOf }: Props) {
  const ref = parseGuideRef(value);
  const chapter = ref?.chapter ?? null;
  const anchors = useMemo(() => (chapter ? anchorsOf(chapter) : []), [chapter, anchorsOf]);
  const anchorOptions: SelectOption[] = [{ value: '', label: '— kogu peatükk —' }, ...anchors.map((a) => ({ value: a.slug, label: a.text }))];
  // Salvestatud ankur, mida peatükis enam pole, jääb valikusse nähtavaks
  if (ref?.anchor && !anchors.some((a) => a.slug === ref.anchor)) anchorOptions.push({ value: ref.anchor, label: `${ref.anchor} (puudub peatükis)` });

  return (
    <div className="flex flex-col gap-1.5">
      <div className={adminFieldLabelClass}>Seotud peatükk</div>
      <div className="flex flex-wrap gap-2.5">
        <Select
          className="min-w-64"
          aria-label="Seotud peatükk"
          value={chapter ?? ''}
          onValueChange={(v) => onChange(v ? formatGuideRef(v as GuideChapterKey) : '')}
          options={CHAPTER_OPTIONS}
        />
        {chapter && (
          <Select
            className="min-w-64"
            aria-label="Ankur peatükis"
            value={ref?.anchor ?? ''}
            onValueChange={(a) => onChange(formatGuideRef(chapter, a || null))}
            options={anchorOptions}
          />
        )}
      </div>
      <div className={adminHintClass}>Rakenduses näitab küsimärgi hüpik selle kohaga lingi „Loe juhendist →“. Tühja tekstiga kohta ei näidata, ka link kaob.</div>
    </div>
  );
}
