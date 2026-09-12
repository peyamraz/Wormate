// Mağazadaki HER deri/şapka/gözlük tek tek geometrik kontrolden geçer:
// - sprite'lar hatasız üretilir, desen boyası gerçekten çizilir
// - şapkalar ağzı kapatmaz ve yüze simetriktir (yana kayma yok)
// - gözlük lensleri gözbebekleriyle aynı noktadadır
import { test } from 'node:test';
import assert from 'node:assert/strict';

interface Op { op: string; args: unknown[]; fill: string; stroke: string; }

class MockGradient { addColorStop() { /* kayıt dışı */ } }

function makeCtx(ops: Op[]): any {
  const ctx: any = {
    fillStyle: '', strokeStyle: '', lineWidth: 1, globalAlpha: 1,
    font: '', textAlign: '', textBaseline: '', lineCap: '', lineJoin: '',
    lineDashOffset: 0,
  };
  const methods = ['save', 'restore', 'translate', 'rotate', 'scale', 'setTransform',
    'beginPath', 'moveTo', 'lineTo', 'arc', 'ellipse', 'rect', 'roundRect', 'fillRect',
    'quadraticCurveTo', 'bezierCurveTo', 'closePath', 'fill', 'stroke', 'clip',
    'fillText', 'strokeText', 'setLineDash', 'clearRect', 'drawImage'];
  for (const m of methods) ctx[m] = (...a: unknown[]) => { ops.push({ op: m, args: [...a], fill: ctx.fillStyle, stroke: ctx.strokeStyle }); };
  ctx.createRadialGradient = (...a: unknown[]) => { ops.push({ op: 'createRadialGradient', args: [...a], fill: '', stroke: '' }); return new MockGradient(); };
  ctx.createLinearGradient = (...a: unknown[]) => { ops.push({ op: 'createLinearGradient', args: [...a], fill: '', stroke: '' }); return new MockGradient(); };
  ctx.measureText = (s: string) => ({ width: String(s).length * 6 });
  return ctx;
}

const created: { ops: Op[] }[] = [];
(globalThis as any).document = {
  createElement: () => {
    const entry = { ops: [] as Op[] };
    created.push(entry);
    return { width: 0, height: 0, getContext: () => makeCtx(entry.ops) };
  },
};

const num = (v: unknown) => typeof v === 'number' ? v : Number.NaN;

// Bir op'un kapladığı noktalar (simetri/sınır hesabı için)
function pointsOf(ops: Op[]): { x: number; y: number }[] {
  const out: { x: number; y: number }[] = [];
  for (const o of ops) {
    const a = o.args;
    if (o.op === 'moveTo' || o.op === 'lineTo') out.push({ x: num(a[0]), y: num(a[1]) });
    else if (o.op === 'arc' || o.op === 'ellipse') out.push({ x: num(a[0]), y: num(a[1]) });
    else if (o.op === 'fillRect') {
      const x = num(a[0]), y = num(a[1]), w = num(a[2]), h = num(a[3]);
      out.push({ x, y }, { x: x + w, y: y + h });
    }
  }
  return out.filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));
}

test('tum deri sprite lari hatasiz uretilir ve desen boyasi cizilir', async () => {
  const { getWormTube } = await import('../src/gameArt');
  const { SHOP_SKINS } = await import('../src/shop');
  assert.ok(SHOP_SKINS.length >= 40, `zengin magaza beklenir, bulunan: ${SHOP_SKINS.length}`);
  for (const skin of SHOP_SKINS) {
    const before = created.length;
    getWormTube(skin.color, skin.pattern);
    getWormTube(skin.color, skin.pattern, true);
    assert.ok(created.length > before, `${skin.id} sprite uretmeli`);
    const ops = created[created.length - 1].ops;
    assert.ok(ops.length > 6, `${skin.id} bos gorunmemeli`);
    if (skin.pattern.startsWith('flag-')) {
      const expected: Record<string, string[]> = {
        'flag-tr': ['#e30a17', '#ffffff'],
        'flag-az': ['#00b5e2', '#ef3340', '#00a651', '#ffffff'],
        'flag-de': ['#111111', '#dd0000', '#ffce00'],
        'flag-fr': ['#0055a4', '#ffffff', '#ef4135'],
        'flag-us': ['#b31942', '#ffffff', '#0a3161'],
        'flag-br': ['#009b3a', '#ffdf00', '#002776'],
        'flag-gb': ['#012169', '#ffffff', '#c8102e'],
        'flag-it': ['#009246', '#ffffff', '#ce2b37'],
      };
      const fills = ops.filter(o => o.op === 'fill' || o.op === 'fillRect').map(o => String(o.fill).toLowerCase());
      for (const color of expected[skin.pattern] ?? []) {
        assert.ok(fills.includes(color), `${skin.id} ${color} rengini icermeli`);
      }
      // Hilal/yildiz/hac amblemi olan bayraklar cizgi isleri de icermeli.
      if (['flag-tr', 'flag-az', 'flag-us', 'flag-gb', 'flag-br'].includes(skin.pattern)) {
        assert.ok(ops.some(o => o.op === 'moveTo' || o.op === 'lineTo' || o.op === 'stroke'),
          `${skin.id} amblem cizgisi icermeli`);
      }
    }
    if (skin.pattern === 'stripes') {
      const bands = ops.filter(o => o.op === 'fillRect').length;
      assert.ok(bands >= 3, `${skin.id} en az 3 cizgi bandi icermeli`);
    }
    if (skin.pattern === 'dots') {
      const dots = ops.filter(o => o.op === 'arc').length;
      assert.ok(dots >= 5, `${skin.id} en az 5 puantiye icermeli`);
    }
  }
});

test('cizgiler halka halka, bayraklar bant + amblem ritmiyle dizilir', async () => {
  const art = await import('../src/gameArt');
  const { SHOP_SKINS } = await import('../src/shop');
  const green = '#4dff6a';
  assert.notEqual(art.getStripeTube(green, 0), art.getStripeTube(green, 1), 'cizgi halkalari alterne olmali');
  assert.equal(art.getStripeTube(green, 0), art.getStripeTube(green, 2), 'halka ritmi tekrar etmeli');
  const flags = SHOP_SKINS.filter(s => s.pattern.startsWith('flag-'));
  assert.ok(flags.length >= 8, '8 bayrak beklenir');
  for (const skin of flags) {
    const flag = skin.pattern as import('../src/constants').FlagSkin;
    for (let k = 0; k < 14; k++) art.getFlagTube(flag, k);
    const plain = art.getFlagTube(flag, 0);
    const medal = art.getFlagTube(flag, 6);
    if (['flag-tr', 'flag-us', 'flag-br', 'flag-gb'].includes(flag)) {
      assert.notEqual(medal, plain, `${flag} amblem dilimi farkli olmali`);
    }
    // Cok renkli bayraklar her dilimde alterne olur (rakip halkalar gibi).
    const multi = ['flag-az', 'flag-de', 'flag-fr', 'flag-gb', 'flag-it', 'flag-us'].includes(flag);
    if (multi) {
      assert.notEqual(art.getFlagTube(flag, 0), art.getFlagTube(flag, 1), `${flag} her dilimde degismeli`);
    }
  }
  // Kategori dagilimi: rakip magazadaki gibi 4 grup.
  const cats = new Set(SHOP_SKINS.map(s => s.category));
  for (const c of ['basit', 'cizgili', 'desenli', 'bayraklar']) assert.ok(cats.has(c as never), `${c} kategorisi dolu olmali`);
});

test('tum sapkalar agzi kapatmaz ve simetriktir', async () => {
  const { drawHat } = await import('../src/gameRenderer');
  const { SHOP_HATS } = await import('../src/shop');
  const r = 14;
  for (const hat of SHOP_HATS) {
    const ops: Op[] = [];
    drawHat(makeCtx(ops) as CanvasRenderingContext2D, { hat: hat.id } as any, r);
    if (hat.id === 'none') {
      assert.equal(ops.length, 0, 'sapkasiz cizim yapilmamali');
      continue;
    }
    assert.ok(ops.length > 5, `${hat.id} gorsel icermeli`);
    const pts = pointsOf(ops);
    assert.ok(pts.length > 0, `${hat.id} nokta icermeli`);
    const maxX = Math.max(...pts.map(p => p.x));
    const minX = Math.min(...pts.map(p => p.x));
    const maxY = Math.max(...pts.map(p => p.y));
    const minY = Math.min(...pts.map(p => p.y));
    assert.ok(maxX <= 0.25 * r, `${hat.id} agzi kapatmamali (maxX=${maxX.toFixed(1)})`);
    assert.ok(minX >= -1.5 * r, `${hat.id} kafadan kopmamali (minX=${minX.toFixed(1)})`);
    assert.ok(Math.abs(maxY + minY) <= 0.25 * r, `${hat.id} simetrik olmali (y: ${minY.toFixed(1)}..${maxY.toFixed(1)})`);
    for (const o of ops) {
      if (o.op === 'fill' || o.op === 'stroke') {
        const c = o.op === 'fill' ? o.fill : o.stroke;
        assert.match(String(c), /^#[0-9a-f]{6}$/i, `${hat.id} gecersiz renk: ${c}`);
      }
    }
  }
});

test('tum gozlukler gozbebegiyle ayni noktadadir', async () => {
  const { drawGlasses } = await import('../src/gameRenderer');
  const { SHOP_GLASSES } = await import('../src/shop');
  const r = 14;
  const ex = -0.04 * r, ey = 0.47 * r;
  const near = (ops: Op[], x: number, y: number, tol: number) =>
    ops.some(o => (o.op === 'ellipse' || o.op === 'arc') &&
      Math.hypot(num(o.args[0]) - x, num(o.args[1]) - y) <= tol);
  for (const g of SHOP_GLASSES) {
    const ops: Op[] = [];
    drawGlasses(makeCtx(ops) as CanvasRenderingContext2D, { glasses: g.id } as any, r);
    if (g.id === 'none') {
      assert.equal(ops.length, 0, 'gozluksuz cizim yapilmamali');
      continue;
    }
    if (g.id === 'star') {
      // Yildiz cizgilerle cizilir: tum kose noktalari bir gozun yakininda olmali.
      const pts = pointsOf(ops);
      assert.ok(pts.length > 10, 'yildiz kose icermeli');
      for (const p of pts) {
        const d = Math.min(Math.hypot(p.x - ex, p.y - ey), Math.hypot(p.x - ex, p.y + ey));
        assert.ok(d <= 0.75 * r, `yildiz noktasi gozde olmali (d=${d.toFixed(1)})`);
      }
      continue;
    }
    if (g.id === 'heart') {
      // Kalp iki yaydan olusur; yay merkezleri gozun hemen ustundedir.
      const rw = 0.46 * r, rh = 0.46 * r;
      for (const sy of [1, -1]) {
        for (const sx of [-1, 1]) {
          assert.ok(near(ops, ex + sx * 0.28 * rw, sy * ey - 0.18 * rh, 0.7), `kalp yayi gozde olmali (${sy > 0 ? 'sag' : 'sol'})`);
        }
      }
      continue;
    }
    assert.ok(near(ops, ex, ey, 0.6), `${g.id} sag lens gozde olmali`);
    if (g.id === 'mono') {
      assert.ok(ops.filter(o => o.op === 'ellipse' || o.op === 'arc').length <= 2,
        'monokl tek gozde olmali');
    } else {
      assert.ok(near(ops, ex, -ey, 0.6), `${g.id} sol lens gozde olmali`);
      assert.ok(ops.some(o => o.op === 'stroke'), `${g.id} kopru cizgisi olmali`);
    }
  }
});

test('tum goz ve agiz stilleri hatasiz cizilir', async () => {
  const { drawFace } = await import('../src/gameRenderer');
  const eyes = ['normal', 'sleepy', 'angry', 'star'];
  const mouths = ['smile', 'teeth', 'open'];
  for (const eye of eyes) {
    for (const mouth of mouths) {
      const ops: Op[] = [];
      const worm = {
        segments: [{ x: 100, y: 100 }],
        angle: 0.5, lookOffset: 0, isBoosting: false,
        growthPulse: 0, appetite: 0, facePhase: 0,
        eyes: eye, mouth, glasses: 'none', hat: 'none',
      };
      drawFace(makeCtx(ops) as CanvasRenderingContext2D, worm as any, 14, 0, false);
      assert.ok(ops.length > 10, `yuz ${eye}/${mouth} cizilmeli`);
    }
  }
});

test('tum bonus kupleri ve sekerler hatasiz uretilir', async () => {
  const { getBonusSprite, getTreatSprite } = await import('../src/gameArt');
  const { BONUSES, TREATS } = await import('../src/constants');
  for (const bonus of BONUSES) {
    const before = created.length;
    getBonusSprite(bonus.kind);
    assert.ok(created.length > before, `${bonus.kind} kup uretmeli`);
    const ops = created[created.length - 1].ops;
    if (bonus.kind === 'coin') {
      // Coin yazisizdir: yildiz amblemi tasir.
      assert.ok(ops.some(o => o.op === 'moveTo' || o.op === 'lineTo'), 'coin yildiz icermeli');
      continue;
    }
    if (bonus.kind === 'wide') {
      // WIDE yazisizdir: genisleyen oklar tasir.
      assert.ok(ops.some(o => o.op === 'roundRect'), 'wide karo icermeli');
      assert.ok(ops.filter(o => o.op === 'moveTo').length >= 8, 'wide oklar icermeli');
      continue;
    }
    const texts = ops.filter(o => o.op === 'fillText');
    assert.ok(texts.some(o => String(o.args[0]).length > 0), `${bonus.kind} etiket yazmali`);
  }
  for (const treat of TREATS) {
    for (let v = 0; v < 3; v++) {
      const before = created.length;
      getTreatSprite(treat.kind, v);
      assert.ok(created.length > before || v > 0, `${treat.kind}:${v} seker uretmeli`);
    }
  }
});
