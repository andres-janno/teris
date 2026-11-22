// Peatükkide register: spec'i 16 võtit järjekorras, moodulid, nähtavus, mustandi failinimi.
import { describe, it, expect } from 'vitest';
import { GUIDE_CHAPTERS, GUIDE_MAX_LENGTH, chapterByKey, chapterNumber, draftFileName, isGuideChapterKey, visibleChapters } from './guideChapters';

describe('guideChapters', () => {
  it('16 peatükki spec-i järjekorras', () => {
    expect(GUIDE_CHAPTERS.map((c) => c.key)).toEqual([
      'guide.getting-started', 'guide.onboarding', 'guide.map', 'guide.fields', 'guide.crops', 'guide.rotation',
      'guide.works', 'guide.stock', 'guide.fleet', 'guide.telemetry', 'guide.infrastructure', 'guide.parties',
      'guide.weather', 'guide.seasons', 'guide.pria', 'guide.settings'
    ]);
    expect(new Set(GUIDE_CHAPTERS.map((c) => c.key)).size).toBe(16);
    expect(chapterByKey('guide.telemetry').title).toBe('GPS-seadmed ja sõidud');
    expect(chapterByKey('guide.settings').title).toBe('Kasutajad ja seaded');
  });

  it('moodulist sõltuvad ainult telemeetria ja ilm', () => {
    expect(GUIDE_CHAPTERS.filter((c) => c.module).map((c) => [c.key, c.module])).toEqual([
      ['guide.telemetry', 'TELEMETRY'],
      ['guide.weather', 'WEATHER']
    ]);
  });

  it('visibleChapters peidab peatükid, mille moodulit ettevõttel pole', () => {
    expect(visibleChapters(() => true)).toHaveLength(16);
    const none = visibleChapters(() => false).map((c) => c.key);
    expect(none).toHaveLength(14);
    expect(none).not.toContain('guide.telemetry');
    expect(none).not.toContain('guide.weather');
    const onlyWeather = visibleChapters((m) => m === 'WEATHER').map((c) => c.key);
    expect(onlyWeather).toContain('guide.weather');
    expect(onlyWeather).not.toContain('guide.telemetry');
  });

  it('võtme kontroll, number ja mustandi failinimi', () => {
    expect(isGuideChapterKey('guide.fields')).toBe(true);
    expect(isGuideChapterKey('guide.nope')).toBe(false);
    expect(isGuideChapterKey('fields.register.export-csv')).toBe(false);
    expect(chapterNumber('guide.getting-started')).toBe(1);
    expect(chapterNumber('guide.settings')).toBe(16);
    expect(draftFileName('guide.getting-started')).toBe('01-guide.getting-started.html');
    expect(draftFileName('guide.settings')).toBe('16-guide.settings.html');
    expect(GUIDE_MAX_LENGTH).toBe(100000);
  });
});
