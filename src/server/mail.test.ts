import { describe, it, expect } from 'vitest';
import { normalizeEmail, buildPasswordLinkMail, buildReleaseNoteMail } from './mail';

describe('normalizeEmail', () => {
  it('trimmib ja teeb väiketähtedeks', () => {
    expect(normalizeEmail('  Mari.Maasikas@Näide.EE ')).toBe('mari.maasikas@näide.ee');
  });
  it('lükkab tagasi vigased', () => {
    expect(normalizeEmail('')).toBeNull();
    expect(normalizeEmail('mari')).toBeNull();
    expect(normalizeEmail('mari@')).toBeNull();
    expect(normalizeEmail('mari @x.ee')).toBeNull();
    expect(normalizeEmail(`${'a'.repeat(250)}@x.ee`)).toBeNull();
  });
  it('lükkab tagasi saaja süsti võimaldavad märgid', () => {
    expect(normalizeEmail('a@x.ee,root')).toBeNull();
    expect(normalizeEmail('a@x.ee;root')).toBeNull();
    expect(normalizeEmail('"a"@x.ee')).toBeNull();
    expect(normalizeEmail('<a@x.ee>')).toBeNull();
  });
});

describe('buildPasswordLinkMail', () => {
  const base = { to: 'mari@x.ee', from: 'noreply@teris.ee', link: 'https://teris.ee/set-password#abc', username: 'mari', displayName: 'Mari Maasikas' };
  it('kutse: päised, MIME-teema ja link', () => {
    const msg = buildPasswordLinkMail({ ...base, purpose: 'INVITE' });
    const [head, ...bodyParts] = msg.split('\n\n');
    const body = bodyParts.join('\n\n');
    expect(head).toContain('To: mari@x.ee');
    expect(head).toContain('From: TERIS <noreply@teris.ee>');
    expect(head).toContain(`Subject: =?UTF-8?B?${Buffer.from('Kutse TERIS rakendusse').toString('base64')}?=`);
    expect(head).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(body).toContain('https://teris.ee/set-password#abc');
    expect(body).toContain('kasutajanimega mari');
    expect(body).toContain('7 päeva');
  });
  it('lähtestus: teema ja kehtivus', () => {
    const msg = buildPasswordLinkMail({ ...base, purpose: 'RESET' });
    expect(msg).toContain(`=?UTF-8?B?${Buffer.from('TERIS parooli määramine').toString('base64')}?=`);
    expect(msg).toContain('1 tund');
  });
  it('ei luba päisesse reavahetust', () => {
    expect(() => buildPasswordLinkMail({ ...base, to: 'a@x.ee\r\nBcc: b@y.ee', purpose: 'RESET' })).toThrow();
  });
});

describe('buildReleaseNoteMail', () => {
  const base = {
    to: 'mari@x.ee',
    from: 'noreply@teris.ee',
    displayName: 'Mari Maasikas',
    version: '2026.11.24',
    title: 'Novembri uuendused',
    summary: 'Lao koguväärtus & kiirem sisestus',
    items: [
      { id: '1', category: 'FEATURE' as const, area: 'Ladu', text: 'Artiklite vaates on näha koguväärtus <EUR>.' },
      { id: '2', category: 'FIX' as const, text: 'Parandatud filtri lähtestamine.' }
    ],
    appLink: 'https://teris.ee/#releases',
    unsubscribeLink: 'https://teris.ee/api/release-notes/unsubscribe?token=tok123'
  };

  it('ehitab multipart/alternative kirja base64-osadega, List-Unsubscribe päiste ja HTML escape-imisega', () => {
    const msg = buildReleaseNoteMail(base);
    expect(msg).toContain('Content-Type: multipart/alternative; boundary="teris_');
    expect(msg).toContain('List-Unsubscribe: <https://teris.ee/api/release-notes/unsubscribe?token=tok123>');
    expect(msg).toContain('List-Unsubscribe-Post: List-Unsubscribe=One-Click');
    expect(msg).toContain('Content-Type: text/plain; charset=UTF-8');
    expect(msg).toContain('Content-Type: text/html; charset=UTF-8');
    expect(msg).toContain('Content-Transfer-Encoding: base64');

    // Ükski rida ei tohi ületada SMTP 998 märgi piiri
    for (const line of msg.split('\n')) {
      expect(line.length).toBeLessThanOrEqual(998);
    }

    // Dekodeeri plain-text ja HTML osad
    const boundary = /boundary="(teris_[^"]+)"/.exec(msg)?.[1];
    expect(boundary).toBeTruthy();
    const parts = msg.split(`--${boundary}`);
    const decodePart = (p: string) => Buffer.from(p.split('\n\n').slice(1).join('\n\n').replace(/\s+/g, ''), 'base64').toString('utf8');
    const textPart = decodePart(parts[1]);
    const htmlPart = decodePart(parts[2]);

    expect(textPart).toContain('- [Ladu] Artiklite vaates on näha koguväärtus <EUR>.');
    expect(textPart).toContain('https://teris.ee/#releases');
    expect(htmlPart).toContain('Artiklite vaates on näha koguväärtus &lt;EUR&gt;.');
    expect(htmlPart).toContain('Lao koguväärtus &amp; kiirem sisestus');
    expect(htmlPart).toContain('TERIS - põllumajanduse infosüsteem');
  });

  it('lisab testkirjale [TEST] eesliite', () => {
    const msg = buildReleaseNoteMail({ ...base, isTest: true });
    expect(msg).toContain(
      `Subject: =?UTF-8?B?${Buffer.from('[TEST] TERIS uuendused (2026.11.24): Novembri uuendused').toString('base64')}?=`
    );
  });
});
