// Töö kuvatav nimi: lühinimi, kui see on olemas, muidu PRIA tegevuse nimi.
export function workTypeDisplayName(w: { name: string; shortName?: string | null }): string {
  const short = w.shortName?.trim();
  return short ? short : w.name;
}
