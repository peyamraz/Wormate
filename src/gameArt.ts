import { BONUSES, GAME_CONFIG as CONFIG, TREATS } from './constants';
import type { BonusKind, TreatKind, WormPattern, FlagSkin } from './constants';
import { SHOP_SKINS } from './shop';
import { bonusLabel } from './i18n';

type Context = CanvasRenderingContext2D;
type Paint = string | CanvasGradient;
type Palette = { main: string; light: string; dark: string; accent: string };

const TAU = Math.PI * 2;
const sweets = new Map<string, HTMLCanvasElement>();
const segments = new Map<string, HTMLCanvasElement>();
const glows = new Map<string, HTMLCanvasElement>();
const bonusSprites = new Map<string, HTMLCanvasElement>();
const grounds = new WeakMap<Context, { fine: CanvasPattern | null; wide: CanvasPattern | null }>();

export function blend(color: string, other: string, amount: number) {
  const a = Number.parseInt(color.slice(1), 16);
  const b = Number.parseInt(other.slice(1), 16);
  const channel = (shift: number) => Math.round(((a >> shift) & 255) * (1 - amount) + ((b >> shift) & 255) * amount);
  return `#${((channel(16) << 16) | (channel(8) << 8) | channel(0)).toString(16).padStart(6, '0')}`;
}

function sprite(paint: (ctx: Context) => void) {
  const canvas = document.createElement('canvas');
  canvas.width = 128;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.setTransform(2, 0, 0, 2, 64, 64);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    paint(ctx);
  }
  return canvas;
}

function ellipse(ctx: Context, x: number, y: number, rx: number, ry: number, paint: Paint, angle = 0) {
  ctx.fillStyle = paint;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, angle, 0, TAU);
  ctx.fill();
}

function polygon(ctx: Context, points: number[][], paint: Paint) {
  ctx.fillStyle = paint;
  ctx.beginPath();
  points.forEach(([x, y], index) => index === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
  ctx.closePath();
  ctx.fill();
}

function roundedPath(ctx: Context, x: number, y: number, width: number, height: number, radius: number) {
  const r = Math.min(radius, width / 2, height / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.lineTo(x + width - r, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + r);
  ctx.lineTo(x + width, y + height - r);
  ctx.quadraticCurveTo(x + width, y + height, x + width - r, y + height);
  ctx.lineTo(x + r, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - r);
  ctx.lineTo(x, y + r);
  ctx.quadraticCurveTo(x, y, x + r, y);
  ctx.closePath();
}

function roundedRect(ctx: Context, x: number, y: number, width: number, height: number, radius: number, paint: Paint) {
  roundedPath(ctx, x, y, width, height, radius);
  ctx.fillStyle = paint;
  ctx.fill();
}

function gradient(ctx: Context, top: string, bottom: string, y1 = -24, y2 = 24) {
  const fill = ctx.createLinearGradient(-12, y1, 14, y2);
  fill.addColorStop(0, top);
  fill.addColorStop(1, bottom);
  return fill;
}

function sprinkles(ctx: Context, points: number[][], offset: number) {
  const colors = ['#fff6d2', '#ffea78', '#5ce0eb', '#f46198', '#b3f38a', '#fffaf1'];
  points.forEach(([x, y, angle], i) => {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(angle);
    ctx.strokeStyle = colors[(i + offset) % colors.length];
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(-1.6, 0);
    ctx.lineTo(1.6, 0);
    ctx.stroke();
    ctx.restore();
  });
}

function cherry(ctx: Context, x: number, y: number) {
  ctx.strokeStyle = '#51823e';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x, y - 2);
  ctx.quadraticCurveTo(x + 1, y - 7, x + 5, y - 7);
  ctx.stroke();
  ellipse(ctx, x, y, 4.5, 4.5, gradient(ctx, '#ff7d8d', '#c52059', y - 4, y + 5));
  ellipse(ctx, x - 1.4, y - 1.5, 1.1, 1.4, '#fff5dbb0', 0.5);
}

function donut(ctx: Context, p: Palette, variant: number) {
  ctx.save();
  ctx.scale(1, 0.91);
  ctx.fillStyle = gradient(ctx, '#ffd18c', '#b96830');
  ctx.beginPath();
  ctx.arc(0, 2, 23, 0, TAU);
  ctx.arc(0, 2, 7, 0, TAU, true);
  ctx.fill();
  ctx.fillStyle = gradient(ctx, p.light, p.dark);
  ctx.beginPath();
  for (let i = 0; i <= 48; i++) {
    const a = i / 48 * TAU;
    const r = 19.9 + Math.sin(a * 7 + variant) * 1.5;
    const x = Math.cos(a) * r;
    const y = Math.sin(a) * r - 1.3;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.moveTo(7.6, -1);
  ctx.arc(0, -1, 7.6, 0, TAU, true);
  ctx.fill();
  ctx.strokeStyle = '#fffaf044';
  ctx.lineWidth = 2.7;
  ctx.beginPath();
  ctx.arc(-1, -1, 17.5, 3.7, 4.6);
  ctx.stroke();
  sprinkles(ctx, [[-13, -9, 0.6], [-4, -15, -0.4], [8, -14, 0.8], [15, -6, -0.7], [14, 6, 0.6], [5, 12, -0.5], [-7, 13, 0.8], [-15, 6, -0.5], [-13, -1, 1.5], [1, 17, 0]], variant);
  ctx.restore();
}

function cake(ctx: Context, p: Palette, variant: number) {
  polygon(ctx, [[-22, -2], [22, 5], [22, 24], [-22, 17]], '#e5ad58');
  polygon(ctx, [[22, 5], [25, -10], [25, 9], [22, 24]], '#bb703b');
  polygon(ctx, [[-22, 2], [22, 9], [22, 13], [-22, 6]], '#fff0bc');
  polygon(ctx, [[-22, 7], [22, 14], [22, 18], [-22, 11]], p.dark);
  polygon(ctx, [[-22, 11], [22, 18], [22, 22], [-22, 15]], '#ffe4a4');
  polygon(ctx, [[22, 9], [25, -6], [25, -2], [22, 13]], '#f8db97');
  polygon(ctx, [[22, 14], [25, -1], [25, 3], [22, 18]], blend(p.dark, '#44263b', 0.2));
  polygon(ctx, [[-22, -2], [0, -20], [25, -10], [22, 5]], gradient(ctx, p.light, p.main));
  ctx.fillStyle = p.main;
  ctx.beginPath();
  ctx.moveTo(-22, -2);
  ctx.lineTo(22, 5);
  ctx.lineTo(22, 9);
  ctx.quadraticCurveTo(18, 10, 16, 6);
  ctx.quadraticCurveTo(12, 5, 12, 10);
  ctx.quadraticCurveTo(7, 12, 7, 6);
  ctx.lineTo(-6, 3);
  ctx.quadraticCurveTo(-7, 9, -11, 6);
  ctx.lineTo(-12, 1);
  ctx.quadraticCurveTo(-19, 3, -22, 1);
  ctx.closePath();
  ctx.fill();
  sprinkles(ctx, [[-9, -4, 0.6], [7, -5, -0.4], [15, -8, 0.7]], variant);
  ellipse(ctx, 0, -13, 7, 3.7, '#fff4d2');
  cherry(ctx, 0, -18);
  ctx.strokeStyle = '#fff7dc85';
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.moveTo(-19, -3);
  ctx.lineTo(-2, -17);
  ctx.stroke();
}

function macaron(ctx: Context, p: Palette) {
  ellipse(ctx, 0, 9, 23, 12.5, gradient(ctx, p.main, p.dark));
  roundedRect(ctx, -22, 0, 44, 10, 4, '#fff3cb');
  roundedRect(ctx, -22, 4, 44, 3, 1, '#dfac81');
  for (let i = -19; i <= 19; i += 4) {
    ellipse(ctx, i, 11, 2.7, 2.4, p.main);
    ellipse(ctx, i, -1, 2.5, 2.8, p.dark);
  }
  ellipse(ctx, 0, -4, 23, 13.5, gradient(ctx, p.light, p.main));
  ctx.strokeStyle = '#ffffff65';
  ctx.lineWidth = 2.7;
  ctx.beginPath();
  ctx.ellipse(-1, -5, 18, 9, 0, 3.6, 4.8);
  ctx.stroke();
  [[-12, -8], [2, -12], [14, -5], [-3, -2]].forEach(([x, y]) => ellipse(ctx, x, y, 0.8, 0.6, '#ffffff50'));
}

function popsicle(ctx: Context, p: Palette) {
  roundedRect(ctx, -4.5, 7, 9, 23, 4.5, gradient(ctx, '#fbe0a8', '#cb9055'));
  roundedRect(ctx, -2.5, 16, 2, 10, 1, '#fff0c57a');
  roundedRect(ctx, -16, -26, 32, 43, 13, p.dark);
  ctx.save();
  roundedPath(ctx, -15, -26, 29, 39, 12);
  ctx.clip();
  ctx.fillStyle = gradient(ctx, p.light, p.main);
  ctx.fillRect(-18, -27, 36, 43);
  for (let y = -33; y <= 28; y += 17) {
    polygon(ctx, [[-19, y + 14], [19, y - 8], [19, y], [-19, y + 22]], p.accent);
    polygon(ctx, [[-19, y + 14], [19, y - 8], [19, y - 5], [-19, y + 17]], '#fff6d35c');
  }
  ctx.restore();
  ctx.strokeStyle = '#ffffff88';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(-10, -6);
  ctx.lineTo(-10, -15);
  ctx.quadraticCurveTo(-10, -21, -5, -22);
  ctx.stroke();
}

function cookie(ctx: Context, variant: number) {
  ellipse(ctx, 0, 2, 22.5, 21.5, '#ae612e');
  ctx.fillStyle = gradient(ctx, '#ffe1a0', '#d99a53');
  ctx.beginPath();
  for (let i = 0; i <= 60; i++) {
    const a = i / 60 * TAU;
    const r = 21.5 + Math.sin(a * 11) * 0.5;
    if (i === 0) ctx.moveTo(Math.cos(a) * r, Math.sin(a) * r - 1);
    else ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r - 1);
  }
  ctx.fill();
  const chips = [[-11, -11, 3.5], [3, -14, 3], [12, -5, 4], [-14, 3, 3.8], [-3, -2, 4], [2, 12, 3.6], [13, 10, 3], [-10, 13, 2.4]];
  for (let i = 0; i < chips.length; i++) {
    const [x, y, size] = chips[i];
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(variant * 0.2 + i * 1.3);
    roundedRect(ctx, -size, -size * 0.8, size * 2, size * 1.8, size * 0.65, '#78402a');
    ellipse(ctx, -size * 0.3, -size * 0.5, size * 0.6, size * 0.35, '#bf7f51');
    ctx.restore();
  }
  [[-5, -14], [16, 1], [-7, 6], [8, 3], [-17, -5], [5, 17], [5, -7]].forEach(([x, y]) => {
    ellipse(ctx, x, y, 0.7, 0.9, '#9e672b60');
    ellipse(ctx, x - 0.6, y - 0.7, 0.7, 0.6, '#fff0bb90');
  });
  ctx.strokeStyle = '#fff2c58c';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, 18.7, 3.5, 4.5);
  ctx.stroke();
}

function gummy(ctx: Context, p: Palette) {
  const jelly = ctx.createRadialGradient(-9, -14, 1, 1, 1, 34);
  jelly.addColorStop(0, p.light);
  jelly.addColorStop(0.45, p.main);
  jelly.addColorStop(1, p.dark);
  ctx.fillStyle = jelly;
  ctx.beginPath();
  const lobes = [[-10, -18, 7, 7], [10, -18, 7, 7], [0, -10, 15, 13], [0, 9, 14, 16], [-14, 5, 7, 9], [14, 5, 7, 9], [-9, 22, 8, 7], [9, 22, 8, 7]];
  for (const [x, y, rx, ry] of lobes) {
    ctx.moveTo(x + rx, y);
    ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  }
  ctx.fill();
  ellipse(ctx, -2, 9, 9, 11, '#ffffff20', 0.15);
  ellipse(ctx, -6, -14, 5.5, 3.5, '#ffffff50', -0.6);
  ellipse(ctx, -11, -20, 2.5, 1.5, '#ffffff70', -0.8);
  ellipse(ctx, -12, 22, 3, 2, '#ffffff35', -0.2);
  ellipse(ctx, -5, -9, 1.6, 2, '#47304c');
  ellipse(ctx, 5, -9, 1.6, 2, '#47304c');
  ellipse(ctx, 0, -3, 4.5, 3.2, blend(p.main, '#fff6dd', 0.35));
  ellipse(ctx, 0, -4, 1.8, 1.2, '#654055');
  ctx.strokeStyle = '#63394f';
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.arc(0, -2.5, 2.1, 0.3, Math.PI - 0.3);
  ctx.stroke();
}

function cupcake(ctx: Context, p: Palette, variant: number) {
  ctx.save();
  polygon(ctx, [[-18, 0], [18, 0], [13, 25], [-13, 25]], gradient(ctx, p.main, p.dark));
  ctx.clip();
  ctx.strokeStyle = p.light;
  ctx.lineWidth = 2;
  for (let i = -17; i <= 17; i += 6) {
    ctx.beginPath();
    ctx.moveTo(i, 1);
    ctx.lineTo(i * 0.7, 24);
    ctx.stroke();
  }
  ctx.restore();
  ellipse(ctx, 0, 1, 20, 5.5, '#b17b5c');
  ctx.fillStyle = gradient(ctx, '#fffbe8', p.light, -25, 7);
  ctx.beginPath();
  ctx.moveTo(-21, 2);
  ctx.bezierCurveTo(-26, -6, -15, -11, -12, -10);
  ctx.bezierCurveTo(-18, -19, -4, -17, 0, -27);
  ctx.bezierCurveTo(3, -30, 3, -18, 10, -19);
  ctx.bezierCurveTo(18, -17, 10, -12, 17, -10);
  ctx.bezierCurveTo(25, -8, 27, 1, 19, 5);
  ctx.bezierCurveTo(8, 11, -9, 8, -21, 2);
  ctx.fill();
  ctx.strokeStyle = blend(p.main, '#ffffff', 0.48);
  ctx.lineWidth = 2.4;
  ctx.beginPath();
  ctx.moveTo(-15, -6);
  ctx.quadraticCurveTo(-2, 0, 17, -3);
  ctx.moveTo(-7, -15);
  ctx.quadraticCurveTo(1, -10, 10, -13);
  ctx.stroke();
  sprinkles(ctx, [[-16, 0, -0.5], [-7, -4, 1.4], [6, 2, 0.5], [16, -6, 1.5], [4, -16, 0.3]], variant);
}

function candy(ctx: Context, p: Palette) {
  polygon(ctx, [[-10, -7], [-29, -14], [-24, -2], [-29, 11], [-11, 8]], gradient(ctx, p.light, p.dark));
  polygon(ctx, [[10, -7], [29, -14], [24, -2], [29, 11], [11, 8]], gradient(ctx, p.light, p.dark));
  ctx.strokeStyle = '#fff0d780';
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(-25, -8);
  ctx.lineTo(-12, -2);
  ctx.moveTo(-25, 6);
  ctx.lineTo(-13, 2);
  ctx.moveTo(25, -8);
  ctx.lineTo(12, -2);
  ctx.moveTo(25, 6);
  ctx.lineTo(13, 2);
  ctx.stroke();
  roundedRect(ctx, -15, -14, 30, 29, 12, p.dark);
  ctx.save();
  roundedPath(ctx, -14, -15, 28, 27, 11);
  ctx.clip();
  ctx.fillStyle = gradient(ctx, p.light, p.main);
  ctx.fillRect(-15, -15, 30, 30);
  for (let x = -30; x < 30; x += 15) {
    polygon(ctx, [[x, -18], [x + 8, -18], [x + 24, 16], [x + 16, 16]], '#fff1b8');
  }
  ctx.restore();
  ellipse(ctx, -5, -8, 7, 2.3, '#ffffff80', -0.2);
}

function icecream(ctx: Context, p: Palette, variant: number) {
  ctx.save();
  polygon(ctx, [[-14, -2], [15, -2], [3, 29]], gradient(ctx, '#ffda8d', '#b86e37'));
  ctx.clip();
  ctx.strokeStyle = '#b9753890';
  ctx.lineWidth = 1.2;
  for (let i = -20; i < 35; i += 7) {
    ctx.beginPath();
    ctx.moveTo(-20, i);
    ctx.lineTo(20, i + 26);
    ctx.moveTo(20, i);
    ctx.lineTo(-20, i + 26);
    ctx.stroke();
  }
  ctx.restore();
  ellipse(ctx, 0, -2, 18, 7, p.dark);
  const scoop = ctx.createRadialGradient(-8, -20, 1, 0, -9, 25);
  scoop.addColorStop(0, p.light);
  scoop.addColorStop(0.6, p.main);
  scoop.addColorStop(1, p.dark);
  ellipse(ctx, 0, -12, 18, 16, scoop);
  [-13, -5, 5, 13].forEach((x, i) => ellipse(ctx, x, -2 + i % 2, 6, 5, scoop));
  ellipse(ctx, -6, -20, 7, 3, '#ffffff65', -0.5);
  sprinkles(ctx, [[-10, -12, -0.4], [2, -20, 0.8], [10, -12, -0.3], [1, -8, 0.6]], variant);
}

function watermelon(ctx: Context) {
  ellipse(ctx, 0, 0, 22, 22, gradient(ctx, '#3aa655', '#1e6e38', -22, 22));
  ellipse(ctx, 0, 0, 19, 19, '#e8f3d8');
  ellipse(ctx, 0, -1, 16.5, 16.5, gradient(ctx, '#ff8d9a', '#e63e5c', -16, 16));
  ctx.fillStyle = '#3b1e2a';
  for (let i = 0; i < 7; i++) {
    const a = i / 7 * TAU + 0.4;
    ellipse(ctx, Math.cos(a) * 9.5, -1 + Math.sin(a) * 9.5, 1.5, 2.2, '#3b1e2a', a);
  }
  ellipse(ctx, -7, -11, 6, 3, '#ffffff40', -0.5);
}

function gingerbread(ctx: Context) {
  ctx.fillStyle = '#b06a35';
  ellipse(ctx, 0, -16, 10, 10, '#b06a35');
  roundedRect(ctx, -9, -8, 18, 24, 8, '#b06a35');
  roundedRect(ctx, -21, -6, 13, 7, 3.5, '#a05e2d');
  roundedRect(ctx, 8, -6, 13, 7, 3.5, '#a05e2d');
  roundedRect(ctx, -9, 13, 8, 13, 4, '#a05e2d');
  roundedRect(ctx, 1, 13, 8, 13, 4, '#a05e2d');
  // Krema süsler
  ctx.fillStyle = '#fff6e8';
  ellipse(ctx, -3.5, -18, 1.8, 1.8, '#fff6e8');
  ellipse(ctx, 3.5, -18, 1.8, 1.8, '#fff6e8');
  ctx.strokeStyle = '#fff6e8';
  ctx.lineWidth = 1.6;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.arc(0, -14, 3.4, 0.3, Math.PI - 0.3);
  ctx.stroke();
  ellipse(ctx, -4, 2, 2.2, 2.2, '#e63956');
  ellipse(ctx, 4, 10, 2.2, 2.2, '#e63956');
  ellipse(ctx, -13, 17, 3, 1.6, '#ffffff50', -0.4);
}

function berry(ctx: Context, p: Palette) {
  const grapes: [number, number][] = [[-8, -4], [8, -4], [0, 3], [-9, 7], [9, 7], [0, -10]];
  for (const [x, y] of grapes) {
    const g = ctx.createRadialGradient(x - 2, y - 3, 0.5, x, y, 8);
    g.addColorStop(0, p.light);
    g.addColorStop(0.55, p.main);
    g.addColorStop(1, p.dark);
    ellipse(ctx, x, y, 7, 7, g);
  }
  ellipse(ctx, 11, -15, 6, 3, '#4caf50', 0.5);
  ctx.strokeStyle = '#3c7a3c';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(6, -12);
  ctx.quadraticCurveTo(10, -18, 15, -19);
  ctx.stroke();
  ellipse(ctx, -6, -12, 4, 2.2, '#ffffff45', -0.5);
}

function orange(ctx: Context) {
  ellipse(ctx, 0, 0, 21, 21, gradient(ctx, '#f0962e', '#c86a12', -21, 21));
  ellipse(ctx, 0, 0, 18, 18, '#ffe3ae');
  ellipse(ctx, 0, 0, 15.5, 15.5, gradient(ctx, '#ffd06e', '#ff9d2e', -15, 15));
  ctx.strokeStyle = '#e8821e';
  ctx.lineWidth = 1.6;
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * TAU;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * 3, Math.sin(a) * 3);
    ctx.lineTo(Math.cos(a) * 14.5, Math.sin(a) * 14.5);
    ctx.stroke();
  }
  ellipse(ctx, 0, 0, 3, 3, '#fff3d0');
  ellipse(ctx, -8, -10, 5, 2.6, '#ffffff50', -0.6);
}

function croissant(ctx: Context) {
  ellipse(ctx, -13, 5, 9.5, 7.5, gradient(ctx, '#e0a558', '#9e5f22', -22, 12));
  ellipse(ctx, 13, 5, 9.5, 7.5, gradient(ctx, '#e0a558', '#9e5f22', 4, 22));
  ellipse(ctx, 0, -1, 11, 10, gradient(ctx, '#ffd48f', '#c07f2e', -11, 9));
  ctx.strokeStyle = 'rgba(140,80,20,0.55)';
  ctx.lineWidth = 1.8;
  for (const x of [-6, 0, 6]) {
    ctx.beginPath();
    ctx.moveTo(x - 2, -9);
    ctx.quadraticCurveTo(x + 2, 0, x - 2, 8);
    ctx.stroke();
  }
  ellipse(ctx, -4, -7, 6, 2.6, '#ffffff50', -0.3);
}

export function getTreatSprite(kind: TreatKind, variant: number) {
  const key = `${kind}:${variant}`;
  let cached = sweets.get(key);
  if (cached) return cached;
  const main = CONFIG.FOOD_COLORS[variant % CONFIG.FOOD_COLORS.length];
  const palette: Palette = {
    main,
    light: blend(main, '#fff9e3', 0.48),
    dark: blend(main, '#682d51', 0.27),
    accent: CONFIG.FOOD_COLORS[(variant + 2) % CONFIG.FOOD_COLORS.length],
  };
  cached = sprite(ctx => {
    ellipse(ctx, 1, 23, kind === 'candy' ? 23 : 18, 4.5, '#00000032');
    switch (kind) {
      case 'donut': donut(ctx, palette, variant); break;
      case 'cake': cake(ctx, palette, variant); break;
      case 'macaron': macaron(ctx, palette); break;
      case 'popsicle': popsicle(ctx, palette); break;
      case 'cookie': cookie(ctx, variant); break;
      case 'gummy': gummy(ctx, palette); break;
      case 'cupcake': cupcake(ctx, palette, variant); break;
      case 'candy': candy(ctx, palette); break;
      case 'icecream': icecream(ctx, palette, variant); break;
      case 'watermelon': watermelon(ctx); break;
      case 'gingerbread': gingerbread(ctx); break;
      case 'berry': berry(ctx, palette); break;
      case 'orange': orange(ctx); break;
      case 'croissant': croissant(ctx); break;
    }
  });
  sweets.set(key, cached);
  return cached;
}

export function getWormSegment(color: string, pattern: WormPattern = 'solid', pale = false) {
  // LEGACY: oyun artik getWormTube kullaniyor (duz boru). Test disi kullanim kalmadi.
  const key = `${color}:${pattern}:${pattern === 'candy' && pale}`;
  let cached = segments.get(key);
  if (cached) return cached;
  cached = sprite(ctx => {
    const base = pattern === 'candy' && pale ? blend(color, '#fff4d3', 0.7) : color;
    const shadow = ctx.createRadialGradient(1, 3, 17, 1, 3, 30);
    shadow.addColorStop(0, '#00000065');
    shadow.addColorStop(0.7, '#00000026');
    shadow.addColorStop(1, '#00000000');
    ellipse(ctx, 1, 3, 30, 29, shadow);

    const fill = ctx.createRadialGradient(-8, -10, 0, -1, -2, 29);
    fill.addColorStop(0, blend(base, '#ffffff', 0.42));
    fill.addColorStop(0.28, blend(base, '#ffffff', 0.16));
    fill.addColorStop(0.56, base);
    fill.addColorStop(0.83, blend(base, '#002b3e', 0.23));
    fill.addColorStop(1, blend(base, '#001823', 0.55));
    ellipse(ctx, 0, 0, 24, 24, fill);

    ctx.strokeStyle = blend(base, '#002334', 0.3);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.arc(0, 0, 23.1, -0.18, Math.PI * 0.94);
    ctx.stroke();
    if (pattern === 'freckles') {
      ellipse(ctx, -9, -6, 3.1, 2.2, '#fff4de88', -0.4);
      ellipse(ctx, 7, 7, 2.8, 2.1, '#fff4de5c', 0.5);
      ellipse(ctx, 8, -11, 1.5, 1.2, '#fff4de77');
    }
    if (pattern === 'stripes') {
      ctx.save();
      ctx.beginPath();
      ctx.arc(0, 0, 23, 0, TAU);
      ctx.clip();
      ctx.fillStyle = blend(base, '#001823', 0.5);
      ctx.rotate(0.5);
      for (const x of [-18, -6, 6, 18]) ctx.fillRect(x - 3.5, -26, 7, 52);
      ctx.restore();
    }
    if (pattern === 'dots') {
      ctx.fillStyle = blend(base, '#ffffff', 0.5);
      for (const [x, y] of [[-11, -9], [2, -14], [13, -5], [-14, 4], [-2, 0], [10, 9], [-8, 12]] as const) {
        ctx.beginPath();
        ctx.arc(x, y, 3.6, 0, TAU);
        ctx.fill();
      }
    }
    if (pattern.startsWith('flag-')) {
      paintFlag(ctx, pattern);
    }
  });
  segments.set(key, cached);
  return cached;
}

// --- yassı boru diskleri: bombeli dilimler yerine düz desen, bayraklar okunur ---
const tubes = new Map<string, HTMLCanvasElement>();

function clipTubeDisc(ctx: Context) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, 23, 0, TAU);
  ctx.clip();
}

function tubeHBands(ctx: Context, colors: string[]) {
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(-24, -24 + i * 16, 48, 16);
  }
}

function tubeVBands(ctx: Context, colors: string[]) {
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(-24 + i * 16, -24, 16, 48);
  }
}

function tubeStar(ctx: Context, x: number, y: number, R: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function tubeFlag(ctx: Context, pattern: string) {
  clipTubeDisc(ctx);
  if (pattern === 'flag-tr') {
    ctx.fillStyle = '#e30a17';
    ctx.fillRect(-24, -24, 48, 48);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-4, 0, 10, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e30a17';
    ctx.beginPath(); ctx.arc(-1.5, 0, 8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff';
    tubeStar(ctx, 8, 0, 5, 2);
    ctx.fill();
  } else if (pattern === 'flag-az') {
    tubeHBands(ctx, ['#00b5e2', '#ef3340', '#00a651']);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-1, 0, 6.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ef3340';
    ctx.beginPath(); ctx.arc(0.5, 0, 5.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff';
    tubeStar(ctx, 6.5, 0, 3.4, 1.4);
    ctx.fill();
  } else if (pattern === 'flag-de') {
    tubeHBands(ctx, ['#111111', '#dd0000', '#ffce00']);
  } else if (pattern === 'flag-fr') {
    tubeVBands(ctx, ['#0055a4', '#ffffff', '#ef4135']);
  } else if (pattern === 'flag-us') {
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#b31942' : '#ffffff';
      ctx.fillRect(-24, -24 + i * (48 / 7), 48, 48 / 7 + 1);
    }
    ctx.fillStyle = '#0a3161';
    ctx.fillRect(-24, -24, 22, 26);
    ctx.fillStyle = '#ffffff';
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        ctx.beginPath();
        ctx.arc(-19 + col * 7, -18 + row * 8, 1.6, 0, TAU);
        ctx.fill();
      }
    }
  } else if (pattern === 'flag-br') {
    ctx.fillStyle = '#009b3a';
    ctx.fillRect(-24, -24, 48, 48);
    ctx.fillStyle = '#ffdf00';
    ctx.beginPath();
    ctx.moveTo(0, -19); ctx.lineTo(19, 0); ctx.lineTo(0, 19); ctx.lineTo(-19, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#002776';
    ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 0, 7.5, 0.4, 2.4); ctx.stroke();
  } else if (pattern === 'flag-gb') {
    ctx.fillStyle = '#012169';
    ctx.fillRect(-24, -24, 48, 48);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-24, -24); ctx.lineTo(24, 24);
    ctx.moveTo(24, -24); ctx.lineTo(-24, 24);
    ctx.stroke();
    ctx.strokeStyle = '#c8102e';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-24, -24); ctx.lineTo(24, 24);
    ctx.moveTo(24, -24); ctx.lineTo(-24, 24);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-24, -7, 48, 14);
    ctx.fillRect(-7, -24, 14, 48);
    ctx.fillStyle = '#c8102e';
    ctx.fillRect(-24, -4, 48, 8);
    ctx.fillRect(-4, -24, 8, 48);
  } else if (pattern === 'flag-it') {
    tubeVBands(ctx, ['#009246', '#ffffff', '#ce2b37']);
  }
  ctx.restore();
}

function paintBodyPattern(ctx: Context, pattern: WormPattern, base: string) {
  if (pattern === 'freckles') {
    ellipse(ctx, -9, -6, 3.1, 2.2, '#fff4de88', -0.4);
    ellipse(ctx, 7, 7, 2.8, 2.1, '#fff4de5c', 0.5);
    ellipse(ctx, 8, -11, 1.5, 1.2, '#fff4de77');
  }
  if (pattern === 'stripes') {
    ctx.save();
    ctx.beginPath();
    ctx.arc(0, 0, 23, 0, TAU);
    ctx.clip();
    ctx.fillStyle = blend(base, '#001823', 0.5);
    ctx.rotate(0.5);
    for (const x of [-18, -6, 6, 18]) ctx.fillRect(x - 3.5, -26, 7, 52);
    ctx.restore();
  }
  if (pattern === 'dots') {
    ctx.fillStyle = blend(base, '#ffffff', 0.5);
    for (const [x, y] of [[-11, -9], [2, -14], [13, -5], [-14, 4], [-2, 0], [10, 9], [-8, 12]] as const) {
      ctx.beginPath();
      ctx.arc(x, y, 3.6, 0, TAU);
      ctx.fill();
    }
  }
  if (pattern.startsWith('flag-')) {
    tubeFlag(ctx, pattern);
  }
}

export function getWormTube(color: string, pattern: WormPattern = 'solid', pale = false) {
  const key = `tube:${color}:${pattern}:${pattern === 'candy' && pale}`;
  let cached = tubes.get(key);
  if (cached) return cached;
  cached = sprite(ctx => {
    const base = pattern === 'candy' && pale ? blend(color, '#fff4d3', 0.7) : color;
    tubeDiscBase(ctx, base);
    paintBodyPattern(ctx, pattern, base);
    tubeDiscRim(ctx);
  });
  tubes.set(key, cached);
  return cached;
}

function tubeDiscBase(ctx: Context, base: string) {
  ellipse(ctx, 0, 0, 24, 24, base);
  // Hafif üst ışık — bombesiz, deseni ezmez.
  const sheen = ctx.createLinearGradient(0, -24, 0, 24);
  sheen.addColorStop(0, 'rgba(255,255,255,0.14)');
  sheen.addColorStop(0.35, 'rgba(255,255,255,0)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.16)');
  ellipse(ctx, 0, 0, 24, 24, sheen);
}

function tubeDiscRim(ctx: Context) {
  ctx.strokeStyle = 'rgba(0,0,0,0.28)';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.arc(0, 0, 23.2, 0, TAU);
  ctx.stroke();
}

// Düz renk disk: çizgi halkaları ve bayrak bantları için (dönüşten bağımsız, hep doğru).
const plainDiscs = new Map<string, HTMLCanvasElement>();
export function getTubeDisc(color: string): HTMLCanvasElement {
  let cached = plainDiscs.get(color);
  if (cached) return cached;
  cached = sprite(ctx => {
    tubeDiscBase(ctx, color);
    tubeDiscRim(ctx);
  });
  plainDiscs.set(color, cached);
  return cached;
}

export function getStripeTube(color: string, i: number): HTMLCanvasElement {
  return getTubeDisc(i % 2 === 0 ? color : blend(color, '#ffffff', 0.55));
}

// Bayraklar gövde BOYUNCA okunur: bantlar dilim dilim dizilir, amblem 12 dilimde bir.
const FLAG_CYCLE: Record<FlagSkin, string[]> = {
  'flag-tr': ['#e30a17'],
  'flag-az': ['#00b5e2', '#ef3340', '#00a651'],
  'flag-de': ['#111111', '#dd0000', '#ffce00'],
  'flag-fr': ['#0055a4', '#ffffff', '#ef4135'],
  'flag-us': ['#b31942', '#ffffff'],
  'flag-br': ['#009b3a'],
  'flag-gb': ['#012169', '#ffffff', '#c8102e'],
  'flag-it': ['#009246', '#ffffff', '#ce2b37'],
};
const FLAG_MEDAL: Partial<Record<FlagSkin, 'crescent' | 'stars' | 'sun' | 'cross'>> = {
  'flag-tr': 'crescent',
  'flag-us': 'stars',
  'flag-br': 'sun',
  'flag-gb': 'cross',
};

function paintMedal(ctx: Context, flag: FlagSkin) {
  const medal = FLAG_MEDAL[flag];
  if (medal === 'crescent') {
    ellipse(ctx, 0, 0, 24, 24, '#e30a17');
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-4, 0, 10, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e30a17';
    ctx.beginPath(); ctx.arc(-1.5, 0, 8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff';
    tubeStar(ctx, 8, 0, 5, 2);
    ctx.fill();
  } else if (medal === 'stars') {
    ellipse(ctx, 0, 0, 24, 24, '#0a3161');
    ctx.fillStyle = '#ffffff';
    for (let row = -1; row <= 1; row++) {
      for (let col = -1; col <= 1; col++) {
        ctx.beginPath();
        ctx.arc(col * 9, row * 9, 2.4, 0, TAU);
        ctx.fill();
      }
    }
  } else if (medal === 'sun') {
    ellipse(ctx, 0, 0, 24, 24, '#ffdf00');
    ctx.fillStyle = '#002776';
    ctx.beginPath(); ctx.arc(0, 0, 9, 0, TAU); ctx.fill();
  } else if (medal === 'cross') {
    ellipse(ctx, 0, 0, 24, 24, '#ffffff');
    ctx.fillStyle = '#c8102e';
    ctx.fillRect(-24, -5, 48, 10);
    ctx.fillRect(-5, -24, 10, 48);
  }
  const sheen = ctx.createLinearGradient(0, -24, 0, 24);
  sheen.addColorStop(0, 'rgba(255,255,255,0.14)');
  sheen.addColorStop(1, 'rgba(0,0,0,0.16)');
  ellipse(ctx, 0, 0, 24, 24, sheen);
  tubeDiscRim(ctx);
}

const flagTubes = new Map<string, HTMLCanvasElement>();
export function getFlagTube(flag: FlagSkin, i: number): HTMLCanvasElement {
  const key = `flagtube:${flag}:${((i % 12) + 12) % 12}`;
  let cached = flagTubes.get(key);
  if (cached) return cached;
  cached = sprite(ctx => {
    if (FLAG_MEDAL[flag] && i % 12 === 6) {
      paintMedal(ctx, flag);
      return;
    }
    const cycle = FLAG_CYCLE[flag];
    tubeDiscBase(ctx, cycle[i % cycle.length]);
    tubeDiscRim(ctx);
  });
  flagTubes.set(key, cached);
  return cached;
}

function clipDisc(ctx: Context) {
  ctx.save();
  ctx.beginPath();
  ctx.arc(0, 0, 23, 0, TAU);
  ctx.clip();
}

function hBands(ctx: Context, colors: string[]) {
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(-24, -24 + i * 16, 48, 16);
  }
}

function vBands(ctx: Context, colors: string[]) {
  for (let i = 0; i < 3; i++) {
    ctx.fillStyle = colors[i % colors.length];
    ctx.fillRect(-24 + i * 16, -24, 16, 48);
  }
}

function starPath(ctx: Context, x: number, y: number, R: number, r: number) {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const rad = i % 2 === 0 ? R : r;
    const a = -Math.PI / 2 + i * Math.PI / 5;
    const px = x + Math.cos(a) * rad, py = y + Math.sin(a) * rad;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function paintFlag(ctx: Context, pattern: string) {
  clipDisc(ctx);
  if (pattern === 'flag-tr') {
    ctx.fillStyle = '#e30a17';
    ctx.fillRect(-24, -24, 48, 48);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-4, 0, 10, 0, TAU); ctx.fill();
    ctx.fillStyle = '#e30a17';
    ctx.beginPath(); ctx.arc(-1.5, 0, 8, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff';
    starPath(ctx, 8, 0, 5, 2);
    ctx.fill();
  } else if (pattern === 'flag-az') {
    hBands(ctx, ['#00b5e2', '#ef3340', '#00a651']);
    ctx.fillStyle = '#ffffff';
    ctx.beginPath(); ctx.arc(-1, 0, 6.5, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ef3340';
    ctx.beginPath(); ctx.arc(0.5, 0, 5.2, 0, TAU); ctx.fill();
    ctx.fillStyle = '#ffffff';
    starPath(ctx, 6.5, 0, 3.4, 1.4);
    ctx.fill();
  } else if (pattern === 'flag-de') {
    hBands(ctx, ['#111111', '#dd0000', '#ffce00']);
  } else if (pattern === 'flag-fr') {
    vBands(ctx, ['#0055a4', '#ffffff', '#ef4135']);
  } else if (pattern === 'flag-us') {
    for (let i = 0; i < 7; i++) {
      ctx.fillStyle = i % 2 === 0 ? '#b31942' : '#ffffff';
      ctx.fillRect(-24, -24 + i * (48 / 7), 48, 48 / 7 + 1);
    }
    ctx.fillStyle = '#0a3161';
    ctx.fillRect(-24, -24, 22, 26);
    ctx.fillStyle = '#ffffff';
    for (let row = 0; row < 3; row++) {
      for (let col = 0; col < 3; col++) {
        ctx.beginPath();
        ctx.arc(-19 + col * 7, -18 + row * 8, 1.6, 0, TAU);
        ctx.fill();
      }
    }
  } else if (pattern === 'flag-br') {
    ctx.fillStyle = '#009b3a';
    ctx.fillRect(-24, -24, 48, 48);
    ctx.fillStyle = '#ffdf00';
    ctx.beginPath();
    ctx.moveTo(0, -19); ctx.lineTo(19, 0); ctx.lineTo(0, 19); ctx.lineTo(-19, 0);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#002776';
    ctx.beginPath(); ctx.arc(0, 0, 7.5, 0, TAU); ctx.fill();
    ctx.strokeStyle = 'rgba(255,255,255,0.7)';
    ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.arc(0, 0, 7.5, 0.4, 2.4); ctx.stroke();
  } else if (pattern === 'flag-gb') {
    ctx.fillStyle = '#012169';
    ctx.fillRect(-24, -24, 48, 48);
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 7;
    ctx.beginPath();
    ctx.moveTo(-24, -24); ctx.lineTo(24, 24);
    ctx.moveTo(24, -24); ctx.lineTo(-24, 24);
    ctx.stroke();
    ctx.strokeStyle = '#c8102e';
    ctx.lineWidth = 2.6;
    ctx.beginPath();
    ctx.moveTo(-24, -24); ctx.lineTo(24, 24);
    ctx.moveTo(24, -24); ctx.lineTo(-24, 24);
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(-24, -7, 48, 14);
    ctx.fillRect(-7, -24, 14, 48);
    ctx.fillStyle = '#c8102e';
    ctx.fillRect(-24, -4, 48, 8);
    ctx.fillRect(-4, -24, 8, 48);
  } else if (pattern === 'flag-it') {
    vBands(ctx, ['#009246', '#ffffff', '#ce2b37']);
  }
  ctx.restore();
}

export function getGlow(color: string) {
  let cached = glows.get(color);
  if (cached) return cached;
  cached = sprite(ctx => {
    const fill = ctx.createRadialGradient(0, 0, 0, 0, 0, 32);
    fill.addColorStop(0, `${color}dc`);
    fill.addColorStop(0.2, `${color}96`);
    fill.addColorStop(0.5, `${color}36`);
    fill.addColorStop(0.8, `${color}0c`);
    fill.addColorStop(1, `${color}00`);
    ellipse(ctx, 0, 0, 32, 32, fill);
  });
  glows.set(color, cached);
  return cached;
}

function hexTile(rx: number, ry: number, wide: boolean) {
  const canvas = document.createElement('canvas');
  canvas.width = rx * 6;
  canvas.height = ry * 4;
  const ctx = canvas.getContext('2d');
  if (!ctx) return canvas;
  ctx.scale(2, 2);
  const width = rx * 3;
  const height = ry * 2;
  for (let column = -1; column <= 3; column++) {
    for (let row = -1; row <= 2; row++) {
      const x = column * rx * 1.5;
      const y = row * height + (Math.abs(column) % 2) * ry;
      const outline = () => {
        ctx.beginPath();
        ctx.moveTo(x + rx, y);
        ctx.lineTo(x + rx / 2, y + ry);
        ctx.lineTo(x - rx / 2, y + ry);
        ctx.lineTo(x - rx, y);
        ctx.lineTo(x - rx / 2, y - ry);
        ctx.lineTo(x + rx / 2, y - ry);
        ctx.closePath();
      };
      outline();
      if (wide) {
        ctx.lineWidth = 3.5;
        ctx.strokeStyle = '#081116a3';
        ctx.stroke();
        ctx.lineWidth = 0.6;
        ctx.strokeStyle = '#3d59604d';
        ctx.stroke();
      } else {
        const fill = ctx.createLinearGradient(x, y - ry, x, y + ry);
        fill.addColorStop(0, '#1d3038');
        fill.addColorStop(1, '#15252c');
        ctx.fillStyle = fill;
        ctx.fill();
        ctx.lineWidth = 0.45;
        ctx.strokeStyle = '#36505b68';
        ctx.stroke();
      }
    }
  }
  if (!wide) {
    for (let y = 1; y < height; y += 3) {
      for (let x = 1; x < width; x += 3) {
        ctx.fillStyle = (x + y) % 2 === 0 ? '#ffffff03' : '#00000005';
        ctx.fillRect(x, y, 0.6, 0.6);
      }
    }
  }
  return canvas;
}

export function getArenaPatterns(ctx: Context) {
  let cached = grounds.get(ctx);
  if (cached) return cached;
  const fine = ctx.createPattern(hexTile(8, 7, false), 'repeat');
  const wide = ctx.createPattern(hexTile(96, 84, true), 'repeat');
  const transform = new DOMMatrix().scale(0.5);
  fine?.setTransform(transform);
  wide?.setTransform(transform);
  cached = { fine, wide };
  grounds.set(ctx, cached);
  return cached;
}

// Bake detailed gradients once; gameplay only blits small, reusable textures.
export function prepareGameArt(ctx: Context) {
  for (const treat of TREATS) {
    for (let variant = 0; variant < CONFIG.FOOD_COLORS.length; variant++) getTreatSprite(treat.kind, variant);
  }
  for (const skin of SHOP_SKINS) getWormTube(skin.color, skin.pattern);
  for (const color of CONFIG.COLORS) {
    getWormTube(color, 'candy', true);
    getGlow(color);
  }
  for (const color of [...CONFIG.FOOD_COLORS, '#f0b56f', '#ffbd69', '#ff6983', '#38bdf8', '#fb923c', '#a3e635', '#facc15', '#f472b6', '#ffd166']) getGlow(color);
  for (const bonus of BONUSES) getBonusSprite(bonus.kind);
  getArenaPatterns(ctx);
}

export function getBonusSprite(kind: BonusKind) {
  let cached = bonusSprites.get(kind);
  if (cached) return cached;
  const bonus = BONUSES.find(item => item.kind === kind)!;
  cached = sprite(ctx => {
    ellipse(ctx, 1, 24, 18, 4.5, '#00000040');
    if (kind === 'wide') {
      // Açı genişleten oklar: yazısız, uzaktan okunur.
      ctx.fillStyle = '#2a1e4e';
      ctx.strokeStyle = '#8b5cf6';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.roundRect(-20, -20, 40, 40, 10);
      ctx.fill();
      ctx.stroke();
      ctx.strokeStyle = '#e9e4ff';
      ctx.lineWidth = 4.5;
      ctx.lineCap = 'round';
      for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
        ctx.beginPath();
        ctx.moveTo(sx * 3, sy * 3);
        ctx.lineTo(sx * 12, sy * 12);
        ctx.moveTo(sx * 12, sy * 12);
        ctx.lineTo(sx * 5, sy * 12);
        ctx.moveTo(sx * 12, sy * 12);
        ctx.lineTo(sx * 12, sy * 5);
        ctx.stroke();
      }
      return;
    }
    if (kind === 'coin') {
      // Altın coin: kalın kenar + parlak iç + yıldız.
      ellipse(ctx, 0, 0, 23, 23, gradient(ctx, '#8a6a00', '#b8860b', -24, 24));
      ellipse(ctx, 0, 0, 18.5, 18.5, gradient(ctx, '#ffe98a', '#f5b800', -18, 18));
      ctx.strokeStyle = '#fff8dc';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(-2, -2, 15, 3.6, 5.2);
      ctx.stroke();
      ctx.fillStyle = '#a86e00';
      ctx.beginPath();
      for (let i = 0; i < 10; i++) {
        const rad = i % 2 === 0 ? 9 : 3.8;
        const a = -Math.PI / 2 + i * Math.PI / 5;
        const px = Math.cos(a) * rad, py = Math.sin(a) * rad;
        if (i === 0) ctx.moveTo(px, py);
        else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.fill();
      return;
    }
    const gem = ctx.createRadialGradient(-8, -10, 2, 0, 0, 26);
    gem.addColorStop(0, blend(bonus.color, '#ffffff', 0.55));
    gem.addColorStop(0.45, bonus.color);
    gem.addColorStop(1, blend(bonus.color, '#3b1d4a', 0.35));
    ctx.fillStyle = gem;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.lineTo(21, -8);
    ctx.lineTo(16, 18);
    ctx.lineTo(-16, 18);
    ctx.lineTo(-21, -8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#fff8deaa';
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.fillStyle = '#ffffff55';
    ctx.beginPath();
    ctx.moveTo(-8, -16);
    ctx.lineTo(2, -20);
    ctx.lineTo(6, -10);
    ctx.lineTo(-4, -8);
    ctx.fill();
    ctx.fillStyle = '#3b2048';
    const gemLabel = bonusLabel(kind);
    const gemFont = kind === 'speed' || kind === 'chomp' ? (gemLabel.length > 6 ? 6.5 : gemLabel.length > 4 ? 8 : 9) : 16;
    ctx.font = `800 ${gemFont}px system-ui, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(gemLabel, 0, 3);
    ctx.fillStyle = '#fffef8';
    ctx.fillText(gemLabel, 0, 1);
  });
  bonusSprites.set(kind, cached);
  return cached;
}