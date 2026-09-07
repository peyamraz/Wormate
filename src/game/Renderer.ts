import {
  GameState, WormState, FoodItem, Particle,
  WORLD_SIZE, WORLD_RADIUS, WORLD_CENTER, SEGMENT_DISTANCE,
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

  /** Arka plan gradyanı — daha canlı ve renkli */
  private drawBackground(w: number, h: number): void {
    const { ctx } = this;
    const grad = ctx.createRadialGradient(w / 2, h / 2, 0, w / 2, h / 2, w);
    grad.addColorStop(0, '#2a1a3e');
    grad.addColorStop(0.5, '#1a1a2e');
    grad.addColorStop(1, '#0f0f1a');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  }

  /** Referans grid çizgileri — daha canlı */
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

    // Ana grid — daha belirgin
    ctx.strokeStyle = 'rgba(100, 150, 255, 0.08)';
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

    // Büyük grid — her 5 karede bir
    const bigGridSize = gridSize * 5;
    const bigStartX = Math.floor((camera.x - viewW / 2) / bigGridSize) * bigGridSize;
    const bigEndX = Math.ceil((camera.x + viewW / 2) / bigGridSize) * bigGridSize;
    const bigStartY = Math.floor((camera.y - viewH / 2) / bigGridSize) * bigGridSize;
    const bigEndY = Math.ceil((camera.y + viewH / 2) / bigGridSize) * bigGridSize;

    ctx.strokeStyle = 'rgba(150, 200, 255, 0.12)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();

    for (let x = bigStartX; x <= bigEndX; x += bigGridSize) {
      ctx.moveTo(x, bigStartY);
      ctx.lineTo(x, bigEndY);
    }
    for (let y = bigStartY; y <= bigEndY; y += bigGridSize) {
      ctx.moveTo(bigStartX, y);
      ctx.lineTo(bigEndX, y);
    }
    ctx.stroke();
  }

  /** Dünya sınır dairesi — daha dramatik ve belirgin */
  private drawWorldBorder(): void {
    const { ctx } = this;
    const pulse = Math.sin(this.time * 0.002) * 0.3 + 0.7;

    // Dış alan — karanlık bölge (sınırın dışı)
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, 0, WORLD_SIZE, WORLD_SIZE);
    ctx.arc(WORLD_CENTER.x, WORLD_CENTER.y, WORLD_RADIUS, 0, Math.PI * 2, true);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
    ctx.fill();
    ctx.restore();

    // Dış glow — çok katmanlı
    for (let i = 0; i < 3; i++) {
      ctx.beginPath();
      ctx.arc(WORLD_CENTER.x, WORLD_CENTER.y, WORLD_RADIUS + i * 4, 0, Math.PI * 2);
      ctx.strokeStyle = `rgba(255, 80, 80, ${(0.15 - i * 0.04) * pulse})`;
      ctx.lineWidth = 6 - i;
      ctx.stroke();
    }

    // Ana sınır çizgisi
    ctx.beginPath();
    ctx.arc(WORLD_CENTER.x, WORLD_CENTER.y, WORLD_RADIUS, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 60, 60, ${0.8 * pulse})`;
    ctx.lineWidth = 3;
    ctx.stroke();

    // İç parlama
    ctx.beginPath();
    ctx.arc(WORLD_CENTER.x, WORLD_CENTER.y, WORLD_RADIUS - 2, 0, Math.PI * 2);
    ctx.strokeStyle = `rgba(255, 150, 150, ${0.3 * pulse})`;
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  /** Yemek çizimi — kurabiye/şeker/donut/cupcake */
  private drawFood(food: FoodItem): void {
    const { ctx } = this;
    const pulse = Math.sin(food.pulsePhase) * 0.2 + 1;
    const r = food.radius * pulse;

    ctx.save();
    ctx.translate(food.x, food.y);
    ctx.rotate(food.rotation);

    // Glow efekti
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.8, 0, Math.PI * 2);
    ctx.fillStyle = food.color + '25';
    ctx.fill();

    switch (food.type) {
      case 'cookie':
        this.drawCookie(r, food.color, food.color2);
        break;
      case 'candy':
        this.drawCandy(r, food.color, food.color2);
        break;
      case 'donut':
        this.drawDonut(r, food.color, food.color2);
        break;
      case 'cupcake':
        this.drawCupcake(r, food.color, food.color2);
        break;
      case 'big':
        this.drawBigFood(r, food.color, food.color2);
        break;
      default:
        this.drawCandy(r, food.color, food.color2);
    }

    ctx.restore();
  }

  /** Kurabiye çizimi */
  private drawCookie(r: number, color: string, color2: string): void {
    const { ctx } = this;
    
    // Ana kurabiye
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Çikolata parçaları
    const chipCount = Math.max(3, Math.floor(r / 2));
    for (let i = 0; i < chipCount; i++) {
      const angle = (i / chipCount) * Math.PI * 2;
      const dist = r * 0.5;
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist;
      
      ctx.beginPath();
      ctx.arc(x, y, r * 0.2, 0, Math.PI * 2);
      ctx.fillStyle = color2;
      ctx.fill();
    }

    // Parlak nokta
    ctx.beginPath();
    ctx.arc(-r * 0.3, -r * 0.3, r * 0.25, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.4)';
    ctx.fill();
  }

  /** Şeker çizimi */
  private drawCandy(r: number, color: string, color2: string): void {
    const { ctx } = this;
    
    // Ana şeker
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // Spiral desen
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.7, 0, Math.PI);
    ctx.strokeStyle = color2;
    ctx.lineWidth = r * 0.3;
    ctx.stroke();

    // Parlak nokta
    ctx.beginPath();
    ctx.arc(-r * 0.3, -r * 0.3, r * 0.3, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fill();
  }

  /** Donut çizimi */
  private drawDonut(r: number, color: string, color2: string): void {
    const { ctx } = this;
    
    // Dış halka
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    ctx.fillStyle = color;
    ctx.fill();

    // İç delik
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#1a1a2e';
    ctx.fill();

    // Glaze üst kısım
    ctx.beginPath();
    ctx.arc(0, -r * 0.2, r * 0.8, 0, Math.PI);
    ctx.fillStyle = color2;
    ctx.fill();

    // Serpiştirme noktaları
    const sprinkleCount = Math.max(4, Math.floor(r / 1.5));
    for (let i = 0; i < sprinkleCount; i++) {
      const angle = (i / sprinkleCount) * Math.PI * 2;
      const dist = r * 0.6;
      const x = Math.cos(angle) * dist;
      const y = Math.sin(angle) * dist - r * 0.2;
      
      ctx.beginPath();
      ctx.arc(x, y, r * 0.08, 0, Math.PI * 2);
      ctx.fillStyle = ['#FF69B4', '#FFD700', '#00CED1', '#9370DB'][i % 4];
      ctx.fill();
    }
  }

  /** Cupcake çizimi */
  private drawCupcake(r: number, color: string, color2: string): void {
    const { ctx } = this;
    
    // Cupcake tabanı
    ctx.beginPath();
    ctx.moveTo(-r * 0.8, r * 0.3);
    ctx.lineTo(-r * 0.6, r);
    ctx.lineTo(r * 0.6, r);
    ctx.lineTo(r * 0.8, r * 0.3);
    ctx.closePath();
    ctx.fillStyle = '#DEB887';
    ctx.fill();

    // Krema üstü
    ctx.beginPath();
    ctx.arc(0, 0, r * 0.8, Math.PI, 0);
    ctx.fillStyle = color;
    ctx.fill();

    // Krema swirl
    ctx.beginPath();
    ctx.arc(0, -r * 0.2, r * 0.5, 0, Math.PI * 1.5);
    ctx.strokeStyle = color2;
    ctx.lineWidth = r * 0.2;
    ctx.stroke();

    // Kiraz
    ctx.beginPath();
    ctx.arc(0, -r * 0.5, r * 0.2, 0, Math.PI * 2);
    ctx.fillStyle = '#FF1493';
    ctx.fill();

    // Parlak nokta
    ctx.beginPath();
    ctx.arc(-r * 0.15, -r * 0.6, r * 0.08, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.fill();
  }

  /** Büyük yemek (ölen worm'dan) */
  private drawBigFood(r: number, color: string, color2: string): void {
    const { ctx } = this;
    
    // Glow
    ctx.beginPath();
    ctx.arc(0, 0, r * 1.5, 0, Math.PI * 2);
    ctx.fillStyle = color + '40';
    ctx.fill();

    // Ana daire
    ctx.beginPath();
    ctx.arc(0, 0, r, 0, Math.PI * 2);
    const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
    gradient.addColorStop(0, color2);
    gradient.addColorStop(1, color);
    ctx.fillStyle = gradient;
    ctx.fill();

    // Yıldız parlaması
    ctx.beginPath();
    ctx.arc(-r * 0.3, -r * 0.3, r * 0.35, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
    ctx.fill();

    // Küçük yıldız
    ctx.beginPath();
    ctx.arc(r * 0.2, r * 0.2, r * 0.15, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.fill();
  }

  /** Parçacık çizimi — glow efektli */
  private drawParticle(p: Particle): void {
    const { ctx } = this;
    const alpha = p.life / p.maxLife;
    const r = p.radius * (0.5 + alpha * 0.5);

    // Glow efekti
    ctx.globalAlpha = alpha * 0.4;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r * 2, 0, Math.PI * 2);
    ctx.fill();

    // Ana parçacık
    ctx.globalAlpha = alpha;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, r, 0, Math.PI * 2);
    ctx.fill();

    // Parlak merkez
    if (p.color === '#ffffff' || p.color === '#FFFFFF') {
      ctx.globalAlpha = alpha * 0.8;
      ctx.fillStyle = '#ffffff';
      ctx.beginPath();
      ctx.arc(p.x, p.y, r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }

    ctx.globalAlpha = 1;
  }

  /** Worm çizimi — segment path + gözler — daha canlı ve parlak */
  private drawWorm(worm: WormState): void {
    const { ctx } = this;
    const segs = worm.segments;
    if (segs.length < 2) return;

    const bodyRadius = getBodyRadius(worm);
    const headRadius = getHeadRadius(worm);

    // Dış glow — worm'un etrafında parlama
    ctx.beginPath();
    this.drawSmoothPath(ctx, segs);
    ctx.strokeStyle = worm.config.color + '20';
    ctx.lineWidth = bodyRadius * 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Boost efekti — daha güçlü glow
    if (worm.boosting) {
      ctx.beginPath();
      this.drawSmoothPath(ctx, segs);
      ctx.strokeStyle = worm.config.color + '50';
      ctx.lineWidth = bodyRadius * 5;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.stroke();
    }

    // Ana gövde — kalın ve parlak
    ctx.beginPath();
    this.drawSmoothPath(ctx, segs);
    ctx.strokeStyle = worm.config.color;
    ctx.lineWidth = bodyRadius * 2.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // İç parlama — gradient efekti
    ctx.beginPath();
    this.drawSmoothPath(ctx, segs);
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
    ctx.lineWidth = bodyRadius * 1.2;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();

    // Desen — ikinci renk ile kısa çizgiler
    ctx.strokeStyle = worm.config.color2;
    ctx.lineWidth = bodyRadius * 1.4;
    ctx.setLineDash([SEGMENT_DISTANCE * 0.8, SEGMENT_DISTANCE * 1.5]);
    ctx.beginPath();
    this.drawSmoothPath(ctx, segs);
    ctx.stroke();
    ctx.setLineDash([]);

    // Head — büyük ve parlak daire
    const head = segs[0];
    
    // Head glow
    ctx.beginPath();
    ctx.arc(head.x, head.y, headRadius * 1.3, 0, Math.PI * 2);
    ctx.fillStyle = worm.config.color + '30';
    ctx.fill();

    // Ana head
    ctx.beginPath();
    ctx.arc(head.x, head.y, headRadius, 0, Math.PI * 2);
    const headGradient = ctx.createRadialGradient(
      head.x - headRadius * 0.3, head.y - headRadius * 0.3, 0,
      head.x, head.y, headRadius
    );
    headGradient.addColorStop(0, worm.config.color);
    headGradient.addColorStop(1, worm.config.color2);
    ctx.fillStyle = headGradient;
    ctx.fill();
    ctx.strokeStyle = worm.config.color2;
    ctx.lineWidth = 3;
    ctx.stroke();

    // Gözler — daha büyük ve ifade dolu
    this.drawEyes(worm, head, headRadius);

    // İsim etiketi
    this.drawNameTag(worm, head, headRadius);
  }

  /** Göz çizimi */
  private drawEyes(worm: WormState, head: { x: number; y: number }, headRadius: number): void {
    const { ctx } = this;
    const angle = worm.angle;
    const eyeOffset = headRadius * 0.45;
    const eyeRadius = headRadius * 0.45;
    const pupilRadius = headRadius * 0.28;

    // Sol göz
    const leftEyeX = head.x + Math.cos(angle - 0.5) * eyeOffset;
    const leftEyeY = head.y + Math.sin(angle - 0.5) * eyeOffset;

    // Sağ göz
    const rightEyeX = head.x + Math.cos(angle + 0.5) * eyeOffset;
    const rightEyeY = head.y + Math.sin(angle + 0.5) * eyeOffset;

    // Göz gölgesi
    ctx.fillStyle = 'rgba(0, 0, 0, 0.2)';
    ctx.beginPath();
    ctx.arc(leftEyeX + 1, leftEyeY + 1, eyeRadius * 1.05, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightEyeX + 1, rightEyeY + 1, eyeRadius * 1.05, 0, Math.PI * 2);
    ctx.fill();

    // Göz beyazı — parlak
    const eyeGradient = ctx.createRadialGradient(
      leftEyeX - eyeRadius * 0.2, leftEyeY - eyeRadius * 0.2, 0,
      leftEyeX, leftEyeY, eyeRadius
    );
    eyeGradient.addColorStop(0, '#ffffff');
    eyeGradient.addColorStop(1, '#f0f0f0');
    
    ctx.fillStyle = eyeGradient;
    ctx.beginPath();
    ctx.arc(leftEyeX, leftEyeY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();
    
    const eyeGradient2 = ctx.createRadialGradient(
      rightEyeX - eyeRadius * 0.2, rightEyeY - eyeRadius * 0.2, 0,
      rightEyeX, rightEyeY, eyeRadius
    );
    eyeGradient2.addColorStop(0, '#ffffff');
    eyeGradient2.addColorStop(1, '#f0f0f0');
    
    ctx.fillStyle = eyeGradient2;
    ctx.beginPath();
    ctx.arc(rightEyeX, rightEyeY, eyeRadius, 0, Math.PI * 2);
    ctx.fill();

    // Göz bebeği — gradient
    const pupilOffset = eyeRadius * 0.35;
    const leftPupilX = leftEyeX + Math.cos(angle) * pupilOffset;
    const leftPupilY = leftEyeY + Math.sin(angle) * pupilOffset;
    const rightPupilX = rightEyeX + Math.cos(angle) * pupilOffset;
    const rightPupilY = rightEyeY + Math.sin(angle) * pupilOffset;

    const pupilGradient = ctx.createRadialGradient(
      leftPupilX - pupilRadius * 0.2, leftPupilY - pupilRadius * 0.2, 0,
      leftPupilX, leftPupilY, pupilRadius
    );
    pupilGradient.addColorStop(0, '#2a2a3e');
    pupilGradient.addColorStop(1, '#0a0a1a');
    
    ctx.fillStyle = pupilGradient;
    ctx.beginPath();
    ctx.arc(leftPupilX, leftPupilY, pupilRadius, 0, Math.PI * 2);
    ctx.fill();
    
    const pupilGradient2 = ctx.createRadialGradient(
      rightPupilX - pupilRadius * 0.2, rightPupilY - pupilRadius * 0.2, 0,
      rightPupilX, rightPupilY, pupilRadius
    );
    pupilGradient2.addColorStop(0, '#2a2a3e');
    pupilGradient2.addColorStop(1, '#0a0a1a');
    
    ctx.fillStyle = pupilGradient2;
    ctx.beginPath();
    ctx.arc(rightPupilX, rightPupilY, pupilRadius, 0, Math.PI * 2);
    ctx.fill();

    // Göz parlaması — sevimli efekt
    ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.beginPath();
    ctx.arc(leftPupilX - pupilRadius * 0.3, leftPupilY - pupilRadius * 0.3, pupilRadius * 0.35, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightPupilX - pupilRadius * 0.3, rightPupilY - pupilRadius * 0.3, pupilRadius * 0.35, 0, Math.PI * 2);
    ctx.fill();

    // Küçük parlama
    ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
    ctx.beginPath();
    ctx.arc(leftPupilX + pupilRadius * 0.2, leftPupilY + pupilRadius * 0.2, pupilRadius * 0.15, 0, Math.PI * 2);
    ctx.fill();
    ctx.beginPath();
    ctx.arc(rightPupilX + pupilRadius * 0.2, rightPupilY + pupilRadius * 0.2, pupilRadius * 0.15, 0, Math.PI * 2);
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
