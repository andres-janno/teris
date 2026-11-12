// src/components/ui/cn.ts — klasside liitmine: tingimuslikud klassid (clsx) + Tailwindi konfliktide lahendus.
// Meie kirjasuurus `text-2xs` pole Tailwindi vaikeskaalas — ilma laienduseta peaks tailwind-merge seda
// värviks ja kustutaks `text-foreground`-i kõrvalt.
import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

const twMerge = extendTailwindMerge({
  extend: { classGroups: { 'font-size': [{ text: ['2xs'] }] } },
});

export const cn = (...inputs: ClassValue[]): string => twMerge(clsx(inputs));
