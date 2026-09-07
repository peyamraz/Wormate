import { GameState, Worm, Food, WORLD_WIDTH, WORLD_HEIGHT, SEGMENT_DISTANCE } from './types';

export function renderGame(
  ctx: CanvasRenderingContext2D,
  state: GameState,
  canvasWidth: number,
  canvasHeight: number,
  time: number
): void {
  const { camera } = state;

  ctx.save();
  ctx.clearRect(0, 0, canvasWidth, canvasHeight);

  // Background gradient
  const bgGrad = ctx.createRadialGradient(
    canvasWidth / 2, canvasHeight / 2, 0,
    canvasWidth / 2, canvasHeight / 2, canvasWidth
  );
  bgGrad.addColorStop(0, '#1a1a2e');
  bgGrad.addColorStop(1, '#0f0f1a');
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, canvasWidth, canvasHeight);

  // Apply camera transform
  ctx.translate(canvasWidth / 2, canvasHeight / 2);
  ctx.scale(camera.zoom, camera.zoom);
  ctx.translate(-camera.x, -camera.y);

  // Draw grid
  drawGrid(ctx, camera, canvasWidth, canvasHeight);

  // Draw world border
  drawWorldBorder(ctx);

  // Draw food
  for (const food of state.foods) {
    if (isOnScreen(food.x, food.y, camera, canvasWidth, canvasHeight, 50)) {
      drawFood(ctx, food, time);
    }
  }

  // Draw particles
  for (const particle of state.particles) {
    const alpha = particle.life / particle.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.radius * alpha, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;

  // Draw worms (player last so it's on top)
  const sortedWorms = [...state.worms].sort((a, b) => {
    if (a.isPlayer) return 1;
    if (b.isPlayer) return -1;
    return 0;
  });

  for (const worm of sortedWorms) {
    if (!worm.alive) continue;
    if (isWormOnScreen(worm, camera, canvasWidth, canvasHeight)) {
      drawWorm(ctx, worm, time);
    }
  }

  ctx.restore();

  // Draw minimap
  drawMinimap(ctx, state, canvasWidth, canvasHeight);
}

function isOnScreen(x: number, y: number, camera: { x: number; y: number; zoom: number }, w: number, h: number, margin: number): boolean {
  const halfW = (w / 2) / camera.zoom + margin;
  const halfH = (h / 2) / camera.zoom + margin;
  return Math.abs(x - camera.x) < halfW && Math.abs(y - camera.y) < halfH;
}

function isWormOnScreen(worm: Worm, camera: { x: number; y: number; zoom: number }, w: number, h: number): boolean {
  const head = worm.segments[0];
  const halfW = (w / 2) / camera.zoom + 200;
  const halfH = (h / 2) / camera.zoom + 200;
  return Math.abs(head.x - camera.x) < halfW && Math.abs(head.y - camera.y) < halfH;
}

function drawGrid(ctx: CanvasRenderingContext2D, camera: { x: number; y: number; zoom: number }, w: number, h: number): void {
  const gridSize = 50;
  const halfW = (w / 2) / camera.zoom;
  const halfH = (h / 2) / camera.zoom;

  const startX = Math.floor((camera.x - halfW) / gridSize) * gridSize;
  const startY = Math.floor((camera.y - halfH) / gridSize) * gridSize;
  const endX = camera.x + halfW + gridSize;
  const endY = camera.y + halfH + gridSize;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
  ctx.lineWidth = 1;
  ctx.beginPath();

  for (let x = startX; x <= endX; x += gridSize) {
    if (x < 0 || x > WORLD_WIDTH) continue;
    ctx.moveTo(x, Math.max(0, startY));
    ctx.lineTo(x, Math.min(WORLD_HEIGHT, endY));
  }
  for (let y = startY; y <= endY; y += gridSize) {
    if (y < 0 || y > WORLD_HEIGHT) continue;
    ctx.moveTo(Math.max(0, startX), y);
    ctx.lineTo(Math.min(WORLD_WIDTH, endX), y);
  }
  ctx.stroke();
}

function drawWorldBorder(ctx: CanvasRenderingContext2D): void {
  ctx.strokeStyle = 'rgba(255, 100, 100, 0.5)';
  ctx.lineWidth = 4;
  ctx.setLineDash([20, 10]);
  ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.setLineDash([]);

  // Glow effect
  ctx.shadowColor = 'rgba(255, 50, 50, 0.3)';
  ctx.shadowBlur = 20;
  ctx.strokeStyle = 'rgba(255, 50, 50, 0.2)';
  ctx.lineWidth = 2;
  ctx.strokeRect(0, 0, WORLD_WIDTH, WORLD_HEIGHT);
  ctx.shadowBlur = 0;
}

function drawFood(ctx: CanvasRenderingContext2D, food: Food, time: number): void {
  const pulse = 1 + Math.sin(food.pulsePhase + time * 0.003) * 0.2;
  const r = food.radius * pulse;

  // Glow
  ctx.shadowColor = food.color;
  ctx.shadowBlur = food.type === 'normal' ? 8 : 15;

  ctx.fillStyle = food.color;
  ctx.beginPath();
  ctx.arc(food.x, food.y, r, 0, Math.PI * 2);
  ctx.fill();

  // Inner highlight
  ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
  ctx.beginPath();
  ctx.arc(food.x - r * 0.2, food.y - r * 0.2, r * 0.4, 0, Math.PI * 2);
  ctx.fill();

  ctx.shadowBlur = 0;
}

function drawWorm(ctx: CanvasRenderingContext2D, worm: Worm, time: number): void {
  const segments = worm.segments;
  if (segments.length < 2) return;

  const baseRadius = 8 + Math.min(segments.length * 0.15, 12);

  // Draw body with smooth curve
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // Body glow
  ctx.shadowColor = worm.color;
  ctx.shadowBlur = worm.boosting ? 20 : 10;

  // Draw body segments as connected circles for smooth look
  for (let i = segments.length - 1; i >= 0; i--) {
    const seg = segments[i];
    const t = i / segments.length;
    const radius = baseRadius * (1 - t * 0.4); // Taper towards tail

    // Alternating colors for pattern
    const isStripe = Math.floor(i / 3) % 2 === 0;
    ctx.fillStyle = isStripe ? worm.color : worm.secondaryColor;

    ctx.beginPath();
    ctx.arc(seg.x, seg.y, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.shadowBlur = 0;

  // Draw head details
  const head = segments[0];
  const headRadius = baseRadius * 1.1;

  // Head
  ctx.fillStyle = worm.color;
  ctx.beginPath();
  ctx.arc(head.x, head.y, headRadius, 0, Math.PI * 2);
  ctx.fill();

  // Eyes
  const eyeOffset = headRadius * 0.4;
  const eyeAngle1 = worm.eyeDirection - 0.4;
  const eyeAngle2 = worm.eyeDirection + 0.4;

  const eye1x = head.x + Math.cos(eyeAngle1) * eyeOffset;
  const eye1y = head.y + Math.sin(eyeAngle1) * eyeOffset;
  const eye2x = head.x + Math.cos(eyeAngle2) * eyeOffset;
  const eye2y = head.y + Math.sin(eyeAngle2) * eyeOffset;

  // Eye whites
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  ctx.arc(eye1x, eye1y, headRadius * 0.35, 0, Math.PI * 2);
  ctx.fill();
  ctx.beginPath();
  ctx.arc(eye2x, eye2y, headRadius * 0.35, 0, Math.PI * 2);
  ctx.fill();

  // Pupils
  const pupilOffset = headRadius * 0.1;
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.arc(
    eye1x + Math.cos(worm.eyeDirection) * pupilOffset,
    eye1y + Math.sin(worm.eyeDirection) * pupilOffset,
    headRadius * 0.18, 0, Math.PI * 2
  );
  ctx.fill();
  ctx.beginPath();
  ctx.arc(
    eye2x + Math.cos(worm.eyeDirection) * pupilOffset,
    eye2y + Math.sin(worm.eyeDirection) * pupilOffset,
    headRadius * 0.18, 0, Math.PI * 2
  );
  ctx.fill();

  // Name tag
  if (!worm.isPlayer || true) {
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.font = 'bold 14px Arial, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(worm.name, head.x, head.y - headRadius - 8);

    // Score
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.font = '11px Arial, sans-serif';
    ctx.fillText(`${worm.score}`, head.x, head.y - headRadius - 22);
  }

  // Boost effect
  if (worm.boosting) {
    const tail = segments[segments.length - 1];
    for (let i = 0; i < 3; i++) {
      const alpha = 0.3 - i * 0.1;
      ctx.fillStyle = `rgba(255, 200, 50, ${alpha})`;
      ctx.beginPath();
      ctx.arc(
        tail.x + (Math.random() - 0.5) * 10,
        tail.y + (Math.random() - 0.5) * 10,
        3 + Math.random() * 3,
        0, Math.PI * 2
      );
      ctx.fill();
    }
  }
}

function drawMinimap(ctx: CanvasRenderingContext2D, state: GameState, w: number, h: number): void {
  const mapSize = 150;
  const mapX = w - mapSize - 15;
  const mapY = h - mapSize - 15;
  const scaleX = mapSize / WORLD_WIDTH;
  const scaleY = mapSize / WORLD_HEIGHT;

  // Background
  ctx.fillStyle = 'rgba(0, 0, 0, 0.6)';
  ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  const r = 5;
  ctx.moveTo(mapX + r, mapY);
  ctx.lineTo(mapX + mapSize - r, mapY);
  ctx.quadraticCurveTo(mapX + mapSize, mapY, mapX + mapSize, mapY + r);
  ctx.lineTo(mapX + mapSize, mapY + mapSize - r);
  ctx.quadraticCurveTo(mapX + mapSize, mapY + mapSize, mapX + mapSize - r, mapY + mapSize);
  ctx.lineTo(mapX + r, mapY + mapSize);
  ctx.quadraticCurveTo(mapX, mapY + mapSize, mapX, mapY + mapSize - r);
  ctx.lineTo(mapX, mapY + r);
  ctx.quadraticCurveTo(mapX, mapY, mapX + r, mapY);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Worms on minimap
  for (const worm of state.worms) {
    if (!worm.alive) continue;
    const head = worm.segments[0];
    const mx = mapX + head.x * scaleX;
    const my = mapY + head.y * scaleY;
    const size = worm.isPlayer ? 4 : 2;

    ctx.fillStyle = worm.isPlayer ? '#ffffff' : worm.color;
    ctx.beginPath();
    ctx.arc(mx, my, size, 0, Math.PI * 2);
    ctx.fill();
  }

  // Camera view rectangle
  const { camera } = state;
  const viewW = (w / camera.zoom) * scaleX;
  const viewH = (h / camera.zoom) * scaleY;
  const viewX = mapX + (camera.x - w / (2 * camera.zoom)) * scaleX;
  const viewY = mapY + (camera.y - h / (2 * camera.zoom)) * scaleY;

  ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
  ctx.lineWidth = 1;
  ctx.strokeRect(viewX, viewY, viewW, viewH);
}
