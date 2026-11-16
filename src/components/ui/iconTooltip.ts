// src/components/ui/iconTooltip.ts — otsus: kas nupp saab rakenduse stiilis vihje (ainult tekstita ikoonnupud).
const ICON_SIZES = new Set(['icon-xs', 'icon-sm', 'icon-lg']);

export interface IconTooltipDecision {
  /** Vihje tekst (null = vihjet ei ole, nupp jääb ilma Tooltip-ümbriseta). */
  tooltip: string | null;
  /** Natiivne title, mis nupule jääb (ikoonnupul alati undefined: topeltvihjet ei tohi tekkida). */
  nativeTitle: string | undefined;
  ariaLabel: string | undefined;
}

export const iconTooltip = (
  size: string | null | undefined,
  title: string | undefined,
  ariaLabel: string | undefined
): IconTooltipDecision => {
  if (size && ICON_SIZES.has(size) && title) {
    return { tooltip: title, nativeTitle: undefined, ariaLabel: ariaLabel ?? title };
  }
  return { tooltip: null, nativeTitle: title, ariaLabel };
};
