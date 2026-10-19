import { describe, it, expect } from 'vitest';
import { normalizeEmail, buildPasswordLinkMail } from './mail';

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
