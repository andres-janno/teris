// src/components/ui/keyActivation.ts — klõpsatav rida/kaart/div klaviatuurilt: Enter või tühik = klõps
// (kasutaja otsus 2026-11-16: klaviatuuriligipääs ui tasemel).
import type React from 'react';

export interface ActivationKeyEvent {
  key: string;
  target: EventTarget | null;
  currentTarget: EventTarget | null;
  defaultPrevented: boolean;
  repeat?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  preventDefault(): void;
}

/** Enter/tühik elemendi enda peal (mitte selle sees oleval nupul/väljal) → activate. Tagastab, kas käivitas. */
export function handleActivationKey(e: ActivationKeyEvent, activate: () => void): boolean {
  if (e.defaultPrevented || e.target !== e.currentTarget) return false;
  if (e.repeat || e.altKey || e.ctrlKey || e.metaKey) return false;
  if (e.key !== 'Enter' && e.key !== ' ') return false;
  e.preventDefault();
  activate();
  return true;
}

/** onKeyDown klõpsatavale elemendile: klaviatuur käivitab sama onClick'i (e.currentTarget.click()). */
export const clickOnActivationKey = (e: React.KeyboardEvent<HTMLElement>): void => {
  handleActivationKey(e, () => e.currentTarget.click());
};
