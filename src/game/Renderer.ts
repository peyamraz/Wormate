import {
  GameState, WormState, FoodItem, Particle,
  WORLD_RADIUS, WORLD_CENTER, SEGMENT_DISTANCE,
} from './types';
import { getHeadRadius, getBodyRadius } from './Worm';

/**
 * Renderer — Canvas çizim katmanı
 * Çizim sırası: arka plan → grid → sınır → food → worm'lar → UI
 */

export class Renderer {
  private ctx: CanvasRenderingContext2D;
  private time: number = 0;

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx;
  }

  /** Ana render fonksiyonu */
  render(state: GameState, canvasWidth: number, canvasHeight: number): void {
    this.time = performance.now();
    const { ctx } = this;
    const { camera } = state;

    ctx.save();
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);

    // Arka plan
    this.drawBackground(canvasWidth, canvasHeight);

    // Kamera transformu
    ctx.translate(canvasWidth / 2, canvasHeight / 2);
    ctx.scale(camera.zoom, camera.zoom);
    ctx.translate(-camera.x, -camera.y);

    // Grid
    this.drawGrid(camera, canvasWidth, canvasHeight);

    // Dünya sınırı
    this.drawWorldBorder();

    // Yemekler
    for (const food of state.foods) {
      if (this.isOnScreen(food.x, food.y, camera, canvasWidth, canvasHeight, 50)) {
        this.drawFood(food);
      }
    }

    // Parçacıklar
    for (const particle of state.particles) {
      this.drawParticle(particle);
    }

    // Worm'lar (ölüden diriye — oyuncu en üstte)
    const sortedWorms = [...state.worms].sort((a, b) => {
      if (a.config.isPlayer) return 1;
      if (b.config.isPlayer) return -1;
      return 0;
    });

    for (const worm of sortedWorms) {
      if (worm.alive && this.isWormOnScreen(worm, camera, canvasWidth, canvasHeight)) {
        this.drawWorm(worm);
      }
    }

    ctx.restore();
  }

  /** Arka plan gradyanı */
  private drawBackground(w: number, h: number): void {
    const { ctx } = this;
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w);
    grad.addColorStop(0, '#1a1a2e');
    grad.addColorStop(1, '#0f0f1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  /** Referans grid çizgileri */
  private drawGrid(
    camera: { x: number; y: number; zoom: number },
    cw: number, ch: number
  ): void {
    const { ctx } = this;
    const gridSize = 50;
    const viewW = cw / camera.zoom;
    const viewH = ch / camera.zoom;

    const startX = Math.floor((camera.x - viewW / 2) / gridSize) * gridSize;
    const endX = Math.ceil((camera.x + viewW / 2) / gridSize) * gridSize;
    const startY = Math.floor((camera.y - viewH / 2) / gridSize) * gridSize;
    const endY = Math.ceil((camera.y + viewH / 2) / gridSize) * gridSize;

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.04)';
    ctx.lineWidth = 1;
    ctx.beginPath();

    for (let x = startX; x <= endX; x += gridSize) {
      ctx.moveTo(x, startY);
      ctx.lineTo(x, endY);
    }
    for (let y = startY; y <= endY; y += gridSize) {
      ctx.moveTo(startX, y);
      ctx.lineTo(endX, y);
    }
    ctx.stroke();
  }

  /** Dünya sınır dairesi */
  private drawWorldBorder(): void {
    const { ctx } = this;
    const pulse = Math.sin(this.time * 0.002) * 0.3 + 0.7;

    // Dış glow
    ctx.beginPath();
    ctx.arc(WORLD_CENTER.x, WORLD_CENTER.y, WORLD_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 100, 100, ${0.3 * pulse})`;
    ctx.lineWidth = 8;
    ctx.stroke();

    // İç çizgi
    ctx.beginPath();
    ctx.arc(WORLD_CENTER.x, WORLD_CENTER.y, WORLD_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 50, 50, ${0.6 * pulse})`;
    ctx.lineWidth = 3;
    ctx.stroke();
  }

  /** Yemek çizimi */
  private drawFood(food: FoodItem): void {
    const { ctx } = this;
    const pulse = Math.sin(food.pulsePhase) * 0.3 + 1;
    const r = food.radius * pulse;

    // Glow
    ctx.beginPath();
    ctx.arc(food.x, food.y, r * 2, 0, Math.PI * 2);
    ctx.fillStyle = food.color + '30';
    ctx.fill();

    // Ana daire
    ctx.beginPath();
    ctx.arc(food.x, food.y, r, 0, Math.PI * 2);
    ctx.fillStyle = food.color;
    ctx.fill();

    // Parlak nokta
    if (food.type === 'big') {
      ctx.beginPath();
      ctx.arc(food.x - r * 0.3, food.y - r * 0.3, r * 0.3, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
      ctx.fill();
    }
  }

  /** Parçacık çizimi */
  private drawParticle(p: Particle): void {
    const { ctx } = this;
    const alpha = p.life / p.maxLife;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.radius * alpha, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  }

  /** Worm çizimi — segment path + gözler */
  private drawWorm(worm: WormState): void {
    const { ctx } = this;
    const segs = worm.segments;
    if (segs.length < 2) return;

    const bodyRadius = getBodyRadius(worm);
    const headRadius = getHeadRadius(worm);

    // Boost efekti — glow (gövdenin altında)
    if (worm.boosting) {
      ctx.beginPath();
      this.drawSmoothPath(ctx, segs);
      ctx.strokeStyle = worm.config.color + '30';
      ctx.lineWidth = bodyRadius * 4;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // Gövde — smooth path ile çiz (quadratic bezier)
    ctx.beginPath();
    this.drawSmoothPath(ctx, segs);
    ctx.strokeStyle = worm.config.color;
    ctx.lineWidth = bodyRadius * 2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Desen — ikinci renk ile kısa çizgiler
    ctx.strokeStyle = worm.config.color2;
    ctx.lineWidth = bodyRadius * 1.2;
    ctx.setLineDash([SEGMENT_DISTANCE, SEGMENT_DISTANCE * 2]);
    ctx.beginPath();
    this.drawSmoothPath(ctx, segs);
    ctx.stroke();
    ctx.setLineDash([]);

    // Head — büyük daire
    const head = segs[0];
    ctx.beginPath();
    ctx.arc(head.x, head.y, headRadius, 0, Math.PI * 2);
    ctx.fillStyle = worm.config.color;
    ctx.fill();
    ctx.strokeStyle = worm.config.color2;
    ctx.lineWidth = 2;
    ctx.stroke();

    // Gözler
    this.drawEyes(worm, head, headRadius);

    // İsim etiketi
    this.drawNameTag(worm, head, headRadius);
  }

  /** Göz çizimi */
  private drawEyes(worm: WormState, head: { x: number; y: number }, headRadius: number): void {
    const { ctx } = this;
    const angle = worm.angle;
    const eyeOffset = headRadius * 0.4;
    const eyeRadius = headRadius * 0.35;
    const pupilRadius = headRadius * 0.2;

    // Sol göz
    const leftEyeX = head.x + Math.cos(angle - 0.5) * eyeOffset;
    const leftEyeY = head.y + Math.sin(angle - 0.5) * eyeOffset;

    // Sağ göz
    const rightEyeX = head.x + Math.cos(angle + 0.5) * eyeOffset;
    const rightEyeY = head.y + Math.sin(angle + 0.5) * eyeOffset;

    // Göz beyazı
    ctx.fillStyle = '#ffffff';
    ctx.beginPath();
    ctx.arc(leftEyeX, leftEyeY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightEyeX, rightEyeY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Göz bebeği
    ctx.fillStyle = '#1a1a2e';
    const pupilOffset = eyeRadius * 0.3;
    ctx.beginPath();
    ctx.arc(
      leftEyeX + Math.cos(angle) * pupilOffset,
      leftEyeY + Math.sin(angle) * pupilOffset,
      pupilRadius, 0, Math.PI * 2
    );
    ctx.fill();
    ctx.beginPath();
    ctx.arc(
      rightEyeX + Math.cos(angle) * pupilOffset,
      rightEyeY + Math.sin(angle) * pupilOffset,
      pupilRadius, 0, Math.PI * 2
    );
    ctx.fill();
  }

  /** İsim etiketi */
  private drawNameTag(worm: WormState, head: { x: number; y: number }, headRadius: number): void {
    const { ctx } = this;
    const name = worm.config.name;
    const fontSize = Math.max(12, headRadius * 1.2);

    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    // Gölge
    ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
    ctx.fillText(name, head.x + 1, head.y - headRadius - 5 + 1);

    // Metin
    ctx.fillStyle = '#ffffff';
    ctx.fillText(name, head.x, head.y - headRadius - 5);
  }

  /** Smooth path çizimi — quadratic bezier ile akıcı eğri */
  private drawSmoothPath(
    ctx: CanvasRenderingContext2D,
    segs: { x: number; y: number }[]
  ): void {
    if (segs.length < 2) return;

    ctx.moveTo(segs[0].x, segs[0].y);

    if (segs.length === 2) {
      ctx.lineTo(segs[1].x, segs[1].y);
      return;
    }

    // İlk segment — düz çizgi
    // Sonraki segmentler — quadratic bezier (control point = segment noktası)
    for (let i = 1; i < segs.length - 1; i++) {
      const xc = (segs[i].x + segs[i + 1].x) / 2;
      const yc = (segs[i].y + segs[i + 1].y) / 2;
      ctx.quadraticCurveTo(segs[i].x, segs[i].y, xc, yc);
    }

    // Son segment
    const last = segs[segs.length - 1];
    ctx.lineTo(last.x, last.y);
  }

  /** Viewport kontrolü — nokta ekranda mı */
  private isOnScreen(
    x: number, y: number,
    camera: { x: number; y: number; zoom: number },
    cw: number, ch: number,
    margin: number
  ): boolean {
    const viewW = cw / camera.zoom;
    const viewH = ch / camera.zoom;
    return (
      x > camera.x - viewW / 2 - margin &&
      x < camera.x + viewW / 2 + margin &&
      y > camera.y - viewH / 2 - margin &&
      y < camera.y + viewH / 2 + margin
    );
  }

  /** Worm viewport'ta mı */
  private isWormOnScreen(
    worm: WormState,
    camera: { x: number; y: number; zoom: number },
    cw: number, ch: number
  ): boolean {
    const head = worm.segments[0];
    const margin = worm.segments.length * SEGMENT_DISTANCE;
    return this.isOnScreen(head.x, head.y, camera, cw, ch, margin);
  }
}
