import { test } from 'node:test';
import assert from 'node:assert/strict';
import { bonusLabel, resolveLang, STRINGS } from '../src/i18n';
import { SHOP_GLASSES, SHOP_HATS, SHOP_SKINS, glassesName, hatName, skinName } from '../src/shop';

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

test('every shop item has a non-empty display name', () => {
  for (const skin of SHOP_SKINS) assert.ok(skinName(skin).length > 0, `${skin.id} needs a name`);
  for (const hat of SHOP_HATS) assert.ok(hatName(hat.id).length > 0, `${hat.id} needs a name`);
  for (const glasses of SHOP_GLASSES) assert.ok(glassesName(glasses.id).length > 0, `${glasses.id} needs a name`);
  assert.equal(bonusLabel('speed').length > 0, true);
  assert.equal(bonusLabel('x10'), 'x10');
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
