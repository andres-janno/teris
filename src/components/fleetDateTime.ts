// src/components/fleetDateTime.ts — kuupäeva ja kellaaja abifunktsioonid masinapargi registritele
// (haakimise ja telemeetriaseadmete seoste register).

export function formatDateTime(isoString?: string): string {
  if (!isoString) return '—';
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return '—';
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    return `${day}.${month}.${year} ${hours}:${minutes}`;
  } catch {
    return '—';
  }
}

export function formatDuration(startedAtIso: string, endedAtIso?: string): string {
  try {
    const start = new Date(startedAtIso).getTime();
    const end = endedAtIso ? new Date(endedAtIso).getTime() : Date.now();
    const diffMs = Math.max(0, end - start);
    const diffMins = Math.round(diffMs / (60 * 1000));
    const hours = Math.floor(diffMins / 60);
    const mins = diffMins % 60;
    const days = Math.floor(hours / 24);
    const remHours = hours % 24;

    if (days > 0) {
      return `${days} p ${remHours} h`;
    }
    if (hours > 0) {
      return `${hours} h ${mins} min`;
    }
    return `${mins} min`;
  } catch {
    return '—';
  }
}

export const TIME_OPTIONS: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 15) {
    TIME_OPTIONS.push(`${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`);
  }
}

export function getTimeOptions(currentTime?: string): string[] {
  if (!currentTime) return TIME_OPTIONS;
  if (!TIME_OPTIONS.includes(currentTime)) {
    return [...TIME_OPTIONS, currentTime].sort();
  }
  return TIME_OPTIONS;
}

export function splitIsoToDateAndTime(isoString?: string): { date: string; time: string } {
  if (!isoString) return { date: '', time: '' };
  try {
    const d = new Date(isoString);
    if (isNaN(d.getTime())) return { date: '', time: '' };
    const pad = (n: number) => String(n).padStart(2, '0');
    const date = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const time = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    return { date, time };
  } catch {
    return { date: '', time: '' };
  }
}

export function combineDateAndTimeToIso(dateStr: string, timeStr: string): string | null {
  if (!dateStr) return null;
  const time = timeStr || '00:00';
  const [year, month, day] = dateStr.split('-').map(Number);
  const [hours, minutes] = time.split(':').map(Number);
  const d = new Date(year, (month || 1) - 1, day || 1, hours || 0, minutes || 0, 0);
  if (isNaN(d.getTime())) return null;
  return d.toISOString();
}
