import { BONUS_BY_KIND, GAME_CONFIG as CONFIG } from './constants';
import type { Food, GameEngine, Worm } from './gameEngine';
import { GRID_CELL_SIZE, GRID_COLS, GRID_ROWS } from './gameEngine';
import { getArenaPatterns, getBonusSprite, getGlow, getTreatSprite, getWormSegment } from './gameArt';

type Context = CanvasRenderingContext2D;
type Bounds = { left: number; right: number; top: number; bottom: number };
const TAU = Math.PI * 2;
const SEGMENT_SIZE = 64 / 24;
let vignette: HTMLCanvasElement | null = null;

function inView(x: number, y: number, bounds: Bounds) {
  return x >= bounds.left && x <= bounds.right && y >= bounds.top && y <= bounds.bottom;
}

function ellipse(ctx: Context, x: number, y: number, rx: number, ry: number, fill: string) {
  ctx.fillStyle = fill;
  ctx.beginPath();
  ctx.ellipse(x, y, rx, ry, 0, 0, TAU);
  ctx.fill();
}

function sparkle(ctx: Context, x: number, y: number, size: number) {
  ctx.beginPath();
  ctx.moveTo(x, y - size);
  ctx.quadraticCurveTo(x + size * 0.15, y - size * 0.15, x + size, y);
  ctx.quadraticCurveTo(x + size * 0.15, y + size * 0.15, x, y + size);
  ctx.quadraticCurveTo(x - size * 0.15, y + size * 0.15, x - size, y);
  ctx.quadraticCurveTo(x - size * 0.15, y - size * 0.15, x, y - size);
  ctx.fill();
}

function drawFace(ctx: Context, worm: Worm, radius: number, ticks: number, reducedMotion: boolean) {
  const phase = (ticks + worm.facePhase) % 270;
  const blink = !reducedMotion && phase > 258 ? Math.max(0.09, 1 - Math.sin((phase - 258) / 12 * Math.PI)) : 1;
  const bite = reducedMotion ? 0 : Math.max(worm.growthPulse, worm.appetite * 0.65);
  const head = worm.segments[0];
  ctx.save();
  ctx.translate(head.x, head.y);
  ctx.rotate(worm.angle);

  for (const side of [-1, 1]) {
    ellipse(ctx, radius * 0.32, side * radius * 0.8, radius * 0.18, radius * 0.08, '#ffaebd60');
    ctx.save();
    ctx.translate(-radius * 0.04, side * radius * 0.47);
    if (blink !== 1) ctx.scale(1, blink);
    ellipse(ctx, 0, 0.5, radius * 0.415, radius * 0.425, '#082d43');
    ellipse(ctx, 0, -0.2, radius * 0.365, radius * 0.38, '#d8eff1');
    ellipse(ctx, -radius * 0.028, -radius * 0.06, radius * 0.34, radius * 0.31, '#fffef3');
    const px = radius * (0.11 + (worm.isBoosting ? 0.03 : 0));
    const py = worm.lookOffset * radius * 0.12;
    ellipse(ctx, px, py, radius * 0.18, radius * 0.21, '#112532');
    ellipse(ctx, px - radius * 0.055, py - radius * 0.07, radius * 0.067, radius * 0.075, '#ffffff');
    ellipse(ctx, px + radius * 0.065, py + radius * 0.08, radius * 0.024, radius * 0.03, '#ffffffa0');
    ctx.restore();

    if (worm.isBoosting) {
      ctx.strokeStyle = '#0a354e';
      ctx.lineWidth = radius * 0.075;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(-radius * 0.3, side * radius * 0.91);
      ctx.quadraticCurveTo(0, side * radius * 0.93, radius * 0.25, side * radius * 0.8);
      ctx.stroke();
    }
  }

  const mouthX = radius * 0.64;
  const mouthWidth = radius * (0.11 + bite * 0.1);
  ellipse(ctx, mouthX, 0, mouthWidth + 0.6, radius * 0.255 + 0.6, '#0a3443');
  ellipse(ctx, mouthX, 0, mouthWidth, radius * 0.255, '#592440');
  ellipse(ctx, mouthX + mouthWidth * 0.38, radius * 0.035, mouthWidth * 0.5, radius * 0.17, '#ff8f9f');
  if (bite > 0.25) ellipse(ctx, mouthX - mouthWidth * 0.44, -radius * 0.08, mouthWidth * 0.2, radius * 0.08, '#fff5dc');
  ctx.restore();
}

function drawWormBody(ctx: Context, worm: Worm, engine: GameEngine, reducedMotion: boolean, bounds: Bounds) {
  if (worm.isDead || !worm.segments.some(point => inView(point.x, point.y, bounds))) return;
  const radius = worm.radius * (engine.isDemo ? 1.14 : 1);
  const head = worm.segments[0];
  const step = Math.max(2, Math.round(radius * 0.58 / CONFIG.WORM_SEGMENT_SPACING));
  const player = worm === engine.player;

  // Overlapping domed sprites give the body depth without per-frame gradients.
  for (let i = worm.segments.length - 1; i > 0; i -= step) {
    const point = worm.segments[i];
    if (!inView(point.x, point.y, bounds)) continue;
    const taper = 0.64 + 0.36 * Math.min(1, (worm.segments.length - 1 - i) / 7);
    let swallow = 0;
    if (!reducedMotion) {
      for (let w = 0; w < worm.swallowWaves.length; w++) {
        const wave = worm.swallowWaves[w];
        const distance = Math.abs(i - wave);
        if (distance < 7) swallow = Math.max(swallow, (1 - distance / 7) * 0.15);
      }
    }
    const size = radius * taper * (1 + swallow) * SEGMENT_SIZE;
    const pale = Math.floor(i / (step * 3)) % 2 === 0;
    ctx.drawImage(getWormSegment(worm.color, worm.pattern, pale), point.x - size / 2, point.y - size / 2, size, size);
  }

  const pulse = reducedMotion ? 1 : 1 + worm.growthPulse * 0.055;
  const headSize = radius * SEGMENT_SIZE * 1.055 * pulse;
  ctx.drawImage(getWormSegment(worm.color), head.x - headSize / 2, head.y - headSize / 2, headSize, headSize);
  drawFace(ctx, worm, radius * pulse, engine.ticks, reducedMotion);

  if (player && worm.chompTicks > 0 && !engine.isDemo) {
    const vacuum = 18 + (reducedMotion ? 10 : (engine.ticks % 24));
    ctx.strokeStyle = '#fb923c';
    ctx.globalAlpha = 0.35;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(head.x, head.y, vacuum + radius, 0, TAU);
    ctx.stroke();
    ctx.globalAlpha = 1;
  }

  if (player && worm.spawnProtection > 0 && !engine.isDemo) {
    ctx.strokeStyle = '#bcf6fa';
    ctx.globalAlpha = 0.7;
    ctx.lineWidth = 1.2;
    ctx.setLineDash([3, 5]);
    ctx.lineDashOffset = reducedMotion ? 0 : -engine.ticks * 0.2;
    ctx.beginPath();
    ctx.arc(head.x, head.y, radius + 7, 0, TAU);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.globalAlpha = 1;
  }

  const zoom = engine.camera.zoom;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.font = `600 ${11 / zoom}px system-ui, sans-serif`;
  ctx.fillStyle = player ? '#edfdff' : '#dae9ebb8';
  const label = player
    ? engine.isDemo ? 'Noodle' : worm.spawnProtection > 0 ? `YOU / SHIELD ${Math.ceil(worm.spawnProtection / 60)}s` : 'YOU'
    : worm.name;
  ctx.fillText(label, head.x, head.y - radius - 12 / zoom);
}

function drawFoodGlow(ctx: Context, food: Food, zoom: number) {
  const radius = Math.max(food.radius, 15 / zoom);
  if (food.isTreasure) {
    const size = radius * 7;
    ctx.globalAlpha = 0.55;
    ctx.drawImage(getGlow('#ff6983'), food.x - size / 2, food.y - size / 2, size, size);
    ctx.globalAlpha = 0.9;
    ctx.drawImage(getGlow('#ffbd69'), food.x - size * 0.36, food.y - size * 0.36, size * 0.72, size * 0.72);
  } else if (food.value >= 3) {
    const size = radius * 4.5;
    ctx.globalAlpha = 0.25;
    ctx.drawImage(getGlow(food.color), food.x - size / 2, food.y - size / 2, size, size);
  }
}

function drawEffects(ctx: Context, engine: GameEngine, bounds: Bounds, reducedMotion: boolean) {
  if (!reducedMotion) {
    for (const bite of engine.snackBites) {
      const t = 1 - bite.life ** 2;
      const head = bite.target.segments[0];
      const angle = bite.target.angle;
      const mouthX = head.x + Math.cos(angle) * bite.target.radius * 0.7;
      const mouthY = head.y + Math.sin(angle) * bite.target.radius * 0.7;
      const arc = Math.sin(t * Math.PI) * 5;
      const x = bite.x + (mouthX - bite.x) * t - Math.sin(angle) * arc;
      const y = bite.y + (mouthY - bite.y) * t + Math.cos(angle) * arc;
      const size = bite.radius * 2.85 * (0.22 + bite.life * 0.78);
      ctx.save();
      ctx.globalAlpha = Math.min(1, bite.life * 4);
      ctx.translate(x, y);
      ctx.rotate(bite.rotation + t * 0.6);
      ctx.drawImage(getTreatSprite(bite.kind, bite.variant), -size / 2, -size / 2, size, size);
      ctx.restore();
    }
    for (const ring of engine.snackRings) {
      ctx.globalAlpha = ring.life * 0.55;
      ctx.strokeStyle = ring.color;
      ctx.lineWidth = 1.5 * ring.life;
      ctx.beginPath();
      ctx.arc(ring.x, ring.y, ring.radius + (1 - ring.life) * 22, 0, TAU);
      ctx.stroke();
    }
    for (const particle of engine.particles) {
      if (!inView(particle.x, particle.y, bounds)) continue;
      ctx.save();
      ctx.globalAlpha = particle.life;
      ctx.translate(particle.x, particle.y);
      ctx.rotate(particle.rotation);
      ctx.fillStyle = particle.color;
      const size = particle.size * (0.4 + particle.life * 0.6);
      if (particle.shape === 'sprinkle') {
        ctx.fillRect(-size, -size * 0.3, size * 2, size * 0.6);
      } else if (particle.shape === 'sparkle') {
        sparkle(ctx, 0, 0, size * 1.5);
      } else {
        ctx.beginPath();
        ctx.arc(0, 0, size * 0.65, 0, TAU);
        ctx.fill();
      }
      ctx.restore();
    }
  }
  ctx.globalAlpha = 1;
  const zoom = engine.camera.zoom;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  for (const text of engine.floatingScores) {
    ctx.globalAlpha = Math.min(1, text.life * 2);
    ctx.fillStyle = text.color;
    ctx.font = `800 ${18 / zoom}px system-ui, sans-serif`;
    ctx.fillText(`+${text.value}`, text.x, text.y);
    if (text.label) {
      ctx.font = `800 ${8 / zoom}px system-ui, sans-serif`;
      ctx.fillText(text.label, text.x, text.y + 15 / zoom);
    }
  }
  ctx.globalAlpha = 1;
}

function getVignette() {
  if (vignette) return vignette;
  vignette = document.createElement('canvas');
  vignette.width = 512;
  vignette.height = 512;
  const ctx = vignette.getContext('2d');
  if (ctx) {
    const fill = ctx.createRadialGradient(256, 240, 90, 256, 256, 360);
    fill.addColorStop(0, '#05101700');
    fill.addColorStop(0.6, '#05101709');
    fill.addColorStop(1, '#05101760');
    ctx.fillStyle = fill;
    ctx.fillRect(0, 0, 512, 512);
  }
  return vignette;
}

export function drawGame(ctx: Context, engine: GameEngine, dpr: number, reducedMotion: boolean) {
  const { width, height } = engine.viewport;
  const { x, y, zoom } = engine.camera;
  const bounds: Bounds = {
    left: x - width / (2 * zoom) - 90,
    right: x + width / (2 * zoom) + 90,
    top: y - height / (2 * zoom) - 90,
    bottom: y + height / (2 * zoom) + 90,
  };
  const shake = reducedMotion ? 0 : engine.shake;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.fillStyle = '#291b27';
  ctx.fillRect(0, 0, width, height);
  ctx.save();
  ctx.translate(width / 2 + (Math.random() - 0.5) * shake, height / 2 + (Math.random() - 0.5) * shake);
  ctx.scale(zoom, zoom);
  ctx.translate(-x, -y);

  // Background grid
  const groundX = Math.max(0, bounds.left);
  const groundY = Math.max(0, bounds.top);
  const groundWidth = Math.min(CONFIG.CANVAS_WIDTH, bounds.right) - groundX;
  const groundHeight = Math.min(CONFIG.CANVAS_HEIGHT, bounds.bottom) - groundY;
  if (groundWidth > 0 && groundHeight > 0) {
    const patterns = getArenaPatterns(ctx);
    ctx.fillStyle = patterns.fine ?? '#18282f';
    ctx.fillRect(groundX, groundY, groundWidth, groundHeight);
    if (patterns.wide) {
      ctx.fillStyle = patterns.wide;
      ctx.fillRect(groundX, groundY, groundWidth, groundHeight);
    }
  }
  ctx.strokeStyle = '#fb718523';
  ctx.lineWidth = 28;
  ctx.strokeRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);
  ctx.strokeStyle = '#fb7185';
  ctx.lineWidth = 3;
  ctx.strokeRect(0, 0, CONFIG.CANVAS_WIDTH, CONFIG.CANVAS_HEIGHT);

  // Collect visible foods using spatial grid
  const visibleFoods: Food[] = [];
  if (engine.foodGrid) {
    const minCx = Math.max(0, Math.min(GRID_COLS - 1, Math.floor(bounds.left / GRID_CELL_SIZE)));
    const maxCx = Math.max(0, Math.min(GRID_COLS - 1, Math.floor(bounds.right / GRID_CELL_SIZE)));
    const minCy = Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(bounds.top / GRID_CELL_SIZE)));
    const maxCy = Math.max(0, Math.min(GRID_ROWS - 1, Math.floor(bounds.bottom / GRID_CELL_SIZE)));

    for (let cy = minCy; cy <= maxCy; cy++) {
      for (let cx = minCx; cx <= maxCx; cx++) {
        const cell = engine.foodGrid[cy * GRID_COLS + cx];
        for (let i = 0; i < cell.length; i++) {
          const food = cell[i];
          if (food.x >= bounds.left && food.x <= bounds.right && food.y >= bounds.top && food.y <= bounds.bottom) {
            visibleFoods.push(food);
          }
        }
      }
    }
  } else {
    for (let i = 0; i < engine.foods.length; i++) {
      const food = engine.foods[i];
      if (inView(food.x, food.y, bounds)) visibleFoods.push(food);
    }
  }

  // Draw Loot Trails
  ctx.globalCompositeOperation = 'lighter';
  for (const trail of engine.lootTrails) {
    const size = trail.width * 3;
    ctx.globalAlpha = trail.life * 0.7;
    for (let i = 0; i < trail.points.length; i += 2) {
      const point = trail.points[i];
      if (inView(point.x, point.y, bounds)) ctx.drawImage(getGlow('#ffbd69'), point.x - size / 2, point.y - size / 2, size, size);
    }
  }

  // Batch all Glow passes together in ONE 'lighter' pass
  const allLivingWorms = engine.allWorms().filter(w => !w.isDead);
  for (const worm of allLivingWorms) {
    if (worm.isBoosting || worm.speedTicks > 0 || worm === engine.player) {
      ctx.globalAlpha = worm.isBoosting || worm.speedTicks > 0 ? 0.45 : 0.12;
      const glow = getGlow(worm.color);
      const size = worm.radius * (worm.isBoosting || worm.speedTicks > 0 ? 5.5 : 4.2);
      const glowStep = Math.max(3, Math.round(worm.radius * 0.8 / CONFIG.WORM_SEGMENT_SPACING));
      for (let i = 0; i < worm.segments.length; i += glowStep * 2) {
        const point = worm.segments[i];
        if (inView(point.x, point.y, bounds)) ctx.drawImage(glow, point.x - size / 2, point.y - size / 2, size, size);
      }
    }
  }

  // Draw glows ONLY for treasure and high-value food
  for (let i = 0; i < visibleFoods.length; i++) {
    const food = visibleFoods[i];
    if (food.isTreasure || food.value >= 3) drawFoodGlow(ctx, food, zoom);
  }

  // Soft halo under every ordinary treat so food pops against the dark floor.
  for (let i = 0; i < visibleFoods.length; i++) {
    const food = visibleFoods[i];
    if (food.isTreasure || food.value >= 3) continue;
    const radius = Math.max(food.radius, 15 / zoom);
    const size = radius * 3.4;
    ctx.globalAlpha = 0.2;
    ctx.drawImage(getGlow(food.color), food.x - size / 2, food.y - size / 2, size, size);
  }

  // Draw glows for bonus orbs
  for (const bonus of engine.bonuses) {
    if (!inView(bonus.x, bonus.y, bounds)) continue;
    const info = BONUS_BY_KIND[bonus.kind];
    const pulse = reducedMotion ? 1 : 1 + Math.sin(engine.ticks * 0.08 + bonus.phase) * 0.08;
    const size = (info.multiplier >= 10 ? 52 : 42) * pulse;
    ctx.globalAlpha = 0.55;
    ctx.drawImage(getGlow(info.color), bonus.x - size * 0.9, bonus.y - size * 0.9, size * 1.8, size * 1.8);
  }

  // Switch back to 'source-over' ONCE for rest of frame
  ctx.globalCompositeOperation = 'source-over';
  ctx.globalAlpha = 1;

  // Draw visible foods
  for (let i = 0; i < visibleFoods.length; i++) {
    const food = visibleFoods[i];
    const phase = engine.ticks * 0.023 + food.phase;
    const float = reducedMotion ? 0 : Math.sin(phase) * 0.9;
    const radius = Math.max(food.radius, 15 / zoom);
    const size = radius * 2.85;

    if (food.isTreasure || food.value >= 3) {
      ctx.save();
      ctx.translate(food.x, food.y + float);
      ctx.rotate(food.rotation + (reducedMotion ? 0 : Math.sin(phase * 0.6) * 0.045));
      ctx.drawImage(getTreatSprite(food.kind, food.variant), -size / 2, -size / 2, size, size);
      ctx.restore();

      ctx.fillStyle = '#fff0be';
      ctx.globalAlpha = reducedMotion ? 0.5 : 0.4 + Math.sin(phase) * 0.22;
      sparkle(ctx, food.x + radius * 1.3, food.y - radius * 1.15, 2.4 / zoom);
      ctx.globalAlpha = 1;
    } else {
      ctx.drawImage(getTreatSprite(food.kind, food.variant), food.x - size / 2, food.y + float - size / 2, size, size);
    }
  }

  // Draw bonus orbs
  for (const bonus of engine.bonuses) {
    if (!inView(bonus.x, bonus.y, bounds)) continue;
    const info = BONUS_BY_KIND[bonus.kind];
    const pulse = reducedMotion ? 1 : 1 + Math.sin(engine.ticks * 0.08 + bonus.phase) * 0.08;
    const size = (info.multiplier >= 10 ? 52 : 42) * pulse;
    ctx.save();
    ctx.translate(bonus.x, bonus.y + (reducedMotion ? 0 : Math.sin(engine.ticks * 0.05 + bonus.phase) * 2));
    ctx.rotate(reducedMotion ? 0 : Math.sin(engine.ticks * 0.03 + bonus.phase) * 0.12);
    ctx.drawImage(getBonusSprite(bonus.kind), -size / 2, -size / 2, size, size);
    ctx.restore();
  }

  // Draw worms
  for (const worm of engine.bots) drawWormBody(ctx, worm, engine, reducedMotion, bounds);
  drawWormBody(ctx, engine.player, engine, reducedMotion, bounds);

  // Draw effects
  drawEffects(ctx, engine, bounds, reducedMotion);

  ctx.restore();
  ctx.drawImage(getVignette(), 0, 0, width, height);
}
