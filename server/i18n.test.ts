import { test } from 'node:test';
import assert from 'node:assert/strict';
import { resolveLang, STRINGS } from '../src/i18n';

test('browser language tags resolve to the right dictionary', () => {
  assert.equal(resolveLang('tr-TR'), 'tr');
  assert.equal(resolveLang('tr'), 'tr');
  assert.equal(resolveLang('en-US'), 'en');
  assert.equal(resolveLang('es-ES'), 'es');
  assert.equal(resolveLang('fr-CA'), 'fr');
  assert.equal(resolveLang('de-DE'), 'de');
  assert.equal(resolveLang('pt-BR'), 'pt');
  assert.equal(resolveLang('zh-CN'), 'en');
  assert.equal(resolveLang('ar-EG'), 'en');
  assert.equal(resolveLang(undefined), 'en');
  assert.equal(resolveLang(''), 'en');
});

test('every language ships the same text keys', () => {
  const reference = Object.keys(STRINGS.en).sort();
  assert.ok(reference.length > 40, 'dictionary must cover the UI');
  for (const lang of Object.keys(STRINGS) as (keyof typeof STRINGS)[]) {
    assert.deepEqual(Object.keys(STRINGS[lang]).sort(), reference, `${lang} must match English keys`);
    for (const value of Object.values(STRINGS[lang])) {
      assert.ok(typeof value === 'string' && value.length > 0, `${lang} has no empty strings`);
    }
  }
});
