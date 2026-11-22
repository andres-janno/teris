// Redaktori „Link peatükki“: valik peatükkide loendist + ankur; tulemus on `#guide.<peatükk>[#ankur]`.
import { useEffect, useMemo, useState } from 'react';
import { Button, Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, Select, type SelectOption } from '../components/ui';
import { GUIDE_CHAPTERS, chapterByKey, type GuideChapterKey } from '../help/guideChapters.ts';
import { formatGuideRef } from '../help/guideLink.ts';
import type { Anchor } from '../help/anchors.ts';

type Props = {
  open: boolean;
  onClose: () => void;
  onPick: (href: string, title: string) => void;
  anchorsOf: (key: GuideChapterKey) => Anchor[];
};

const CHAPTER_OPTIONS: SelectOption[] = GUIDE_CHAPTERS.map((c, i) => ({ value: c.key, label: `${i + 1}. ${c.title}` }));

export function ChapterLinkDialog({ open, onClose, onPick, anchorsOf }: Props) {
  const [chapter, setChapter] = useState<GuideChapterKey>(GUIDE_CHAPTERS[0].key);
  const [anchor, setAnchor] = useState('');
  const anchors = useMemo(() => anchorsOf(chapter), [chapter, anchorsOf]);

  useEffect(() => {
    if (open) {
      setChapter(GUIDE_CHAPTERS[0].key);
      setAnchor('');
    }
  }, [open]);

  const anchorOptions: SelectOption[] = [{ value: '', label: '— kogu peatükk —' }, ...anchors.map((a) => ({ value: a.slug, label: a.text }))];
  const title = anchors.find((a) => a.slug === anchor)?.text ?? chapterByKey(chapter).title;

  return (
    <Dialog open={open} onOpenChange={(o) => !o && onClose()}>
      <DialogContent size="sm">
        <DialogHeader title="Link peatükki" description="Vali peatükk ja soovi korral selle vahepealkiri." />
        <DialogBody>
          <div className="flex flex-col gap-2.5">
            <Select aria-label="Peatükk" value={chapter} onValueChange={(v) => { setChapter(v as GuideChapterKey); setAnchor(''); }} options={CHAPTER_OPTIONS} />
            <Select aria-label="Ankur peatükis" value={anchor} onValueChange={setAnchor} options={anchorOptions} />
          </div>
        </DialogBody>
        <DialogFooter>
          <Button onClick={onClose}>Loobu</Button>
          <Button variant="primary" onClick={() => onPick(`#${formatGuideRef(chapter, anchor || null)}`, title)}>
            Lisa link
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
