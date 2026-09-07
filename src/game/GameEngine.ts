import {
  GameState, WormState, Particle,
  WORLD_SIZE, WORLD_RADIUS, WORLD_CENTER,
  MAX_FOOD, MAX_AI_WORMS, INITIAL_LENGTH,
} from './types';
import { createPlayerWorm, createAIWorm, moveWorm, growWorm, killWorm, getHeadRadius, updateWormSpeed } from './Worm';
import { createFood, createFoodFromWormDeath, maintainFoodLevel, canCollectFood, updateFoodAnimation } from './Food';
import { checkCollisions } from './Collision';
import { updateAI } from './AIController';
import { InputHandler } from './InputHandler';
import { Renderer } from './Renderer';

/**
 * GameEngine — Ana oyun döngüsü ve state yönetimi
 */
export class GameEngine {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private state: GameState;
  private input: InputHandler;
  private renderer: Renderer;
  private animFrameId: number = 0;
  private running: boolean = false;
  private onGameOver: ((score: number, highScore: number) => void) | null = null;
  private onScoreUpdate: ((score: number, length: number, rank: number) => void) | null = null;
  private lastTime: number = 0;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d')!;
    this.renderer = new Renderer(this.ctx);
    this.input = new InputHandler(canvas);
    this.state = this.createInitialState();
  }

  /** Başlangıç state'i */
  private createInitialState(): GameState {
    const state: GameState = {
      worms: [],
      foods: [],
      particles: [],
      tick: 0,
      worldSize: WORLD_SIZE,
      worldRadius: WORLD_RADIUS,
      worldCenter: { ...WORLD_CENTER },
      camera: { x: WORLD_CENTER.x, y: WORLD_CENTER.y, zoom: 1, targetZoom: 1 },
      player: null,
      gameOver: false,
      leaderboard: [],
      mouseAngle: 0,
      highScore: parseInt(localStorage.getItem('worm_highscore') || '0'),
    };

    // Yemek spawn
    for (let i = 0; i < MAX_FOOD; i++) {
      state.foods.push(createFood());
    }

    // AI worm spawn
    for (let i = 0; i < MAX_AI_WORMS; i++) {
      state.worms.push(createAIWorm(i));
    }

    return state;
  }

  /** Oyunu başlat */
  start(playerName: string): void {
    // Önceki oyunu temizle
    this.stop();

    // Yeni state
    this.state = this.createInitialState();

    // Oyuncu worm
    const player = createPlayerWorm(playerName);
    this.state.player = player;
    this.state.worms.push(player);

    // Kamera oyuncuya ayarla
    this.state.camera.x = player.segments[0].x;
    this.state.camera.y = player.segments[0].y;

    this.running = true;
    this.lastTime = performance.now();
    this.loop();
  }

  /** Oyunu durdur */
  stop(): void {
    this.running = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = 0;
    }
  }

  /** Callback ayarla */
  setOnGameOver(cb: (score: number, highScore: number) => void): void {
    this.onGameOver = cb;
  }

  setOnScoreUpdate(cb: (score: number, length: number, rank: number) => void): void {
    this.onScoreUpdate = cb;
  }

  /** Ana oyun döngüsü */
  private loop = (): void => {
    if (!this.running) return;

    const now = performance.now();
    const _dt = now - this.lastTime;
    this.lastTime = now;

    this.tick();
    this.render();

    this.animFrameId = requestAnimationFrame(this.loop);
  };

  /** Oyun tick'i — tüm güncellemeler */
  private tick(): void {
    const state = this.state;
    state.tick++;

    // 1. Oyuncu input
    this.processInput();

    // 2. AI güncelle
    for (const worm of state.worms) {
      if (!worm.config.isPlayer) {
        updateAI(worm, state);
      }
    }

    // 3. Worm hızlarını güncelle
    for (const worm of state.worms) {
      updateWormSpeed(worm);
    }

    // 4. Worm'ları hareket ettir
    for (const worm of state.worms) {
      moveWorm(worm);
    }

    // 5. Yemek toplama
    this.checkFoodPickup();

    // 6. Çarpışma tespiti
    this.checkCollisions();

    // 7. Yemek seviyesini koru
    const newFoods = maintainFoodLevel(state.foods);
    state.foods.push(...newFoods);

    // 8. Yemek pulse animasyonu
    updateFoodAnimation(state.foods, performance.now());

    // 9. Boost trail parçacıkları
    this.spawnBoostTrail();

    // 10. Parçacıkları güncelle
    this.updateParticles();

    // 10. Ölü AI'ları yeniden spawn et
    this.respawnDeadAI();

    // 11. Kamera güncelle
    this.updateCamera();

    // 12. Liderlik tablosu
    this.updateLeaderboard();

    // 13. Skor callback
    if (state.player && state.player.alive && this.onScoreUpdate) {
      const rank = state.leaderboard.findIndex(l => l.isPlayer) + 1;
      this.onScoreUpdate(state.player.score, state.player.segments.length, rank || 0);
    }
  }

  /** Oyuncu input işleme */
  private processInput(): void {
    const player = this.state.player;
    if (!player || !player.alive) return;

    player.targetAngle = this.input.angle;
    player.boosting = this.input.boosting;
  }

  /** Yemek toplama kontrolü */
  private checkFoodPickup(): void {
    const state = this.state;
    const toRemove: Set<string> = new Set();

    for (const worm of state.worms) {
      if (!worm.alive) continue;

      const head = worm.segments[0];
      const headRadius = getHeadRadius(worm);
      // Toplama menzili — head yarıçapının 1.5 katı (daha kolay toplama)
      const collectRange = headRadius * 1.8;

      for (const food of state.foods) {
        if (toRemove.has(food.id)) continue;

        const dx = head.x - food.x;
        const dy = head.y - food.y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < collectRange + food.radius) {
          toRemove.add(food.id);
          growWorm(worm, food.value);

          // Parçacık efekti
          this.spawnCollectParticles(food.x, food.y, food.color);
        }
      }
    }

    // Toplanan yemekleri kaldır
    if (toRemove.size > 0) {
      state.foods = state.foods.filter(f => !toRemove.has(f.id));
    }
  }

  /** Çarpışma kontrolü */
  private checkCollisions(): void {
    const result = checkCollisions(this.state);

    for (const death of result.deaths) {
      const worm = death.worm;

      // Worm'dan yemek oluştur
      const drops = killWorm(worm);
      const foods = createFoodFromWormDeath(drops);
      this.state.foods.push(...foods);

      // Ölüm parçacıkları
      this.spawnDeathParticles(worm);

      // Oyuncu öldüyse game over
      if (worm.config.isPlayer) {
        this.state.gameOver = true;

        // High score kaydet
        if (worm.score > this.state.highScore) {
          this.state.highScore = worm.score;
          localStorage.setItem('worm_highscore', worm.score.toString());
        }

        // Dramatik zoom-out
        this.state.camera.targetZoom = 0.3;
        this.state.camera.zoom = 0.3;

        // Kısa bir gecikme ile game over callback'i çağır
        setTimeout(() => {
          if (this.onGameOver) {
            this.onGameOver(worm.score, this.state.highScore);
          }
        }, 800);
      }
    }
  }

  /** Ölü AI'ları yeniden spawn et */
  private respawnDeadAI(): void {
    const aliveAI = this.state.worms.filter(w => !w.config.isPlayer && w.alive).length;
    if (aliveAI < MAX_AI_WORMS) {
      // Her tick'te max 1 AI spawn et
      if (this.state.tick % 60 === 0) {
        this.state.worms.push(createAIWorm(this.state.tick));
      }
    }

    // Ölü worm'ları temizle
    this.state.worms = this.state.worms.filter(w => w.alive || w.config.isPlayer);
  }

  /** Kamera güncelle — oyuncuyu takip et */
  private updateCamera(): void {
    const player = this.state.player;
    if (!player || !player.alive) return;

    const head = player.segments[0];

    // Yumuşak takip
    this.state.camera.x += (head.x - this.state.camera.x) * 0.1;
    this.state.camera.y += (head.y - this.state.camera.y) * 0.1;

    // Zoom — büyüdukçe uzaklaş
    const targetZoom = Math.max(0.4, 1 - player.segments.length * 0.001);
    this.state.camera.targetZoom = targetZoom;
    this.state.camera.zoom += (this.state.camera.targetZoom - this.state.camera.zoom) * 0.05;
  }

  /** Liderlik tablosu güncelle */
  private updateLeaderboard(): void {
    const sorted = this.state.worms
      .filter(w => w.alive)
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    this.state.leaderboard = sorted.map(w => ({
      name: w.config.name,
      score: w.score,
      isPlayer: w.config.isPlayer,
    }));
  }

  /** Parçacık oluştur — yemek toplama */
  private spawnCollectParticles(x: number, y: number, color: string): void {
    // Ana parçacıklar — daha fazla ve parlak
    for (let i = 0; i < 8; i++) {
      const angle = (i / 8) * Math.PI * 2 + Math.random() * 0.3;
      const speed = 2 + Math.random() * 3;
      this.state.particles.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 25,
        maxLife: 25,
        color,
        radius: 4 + Math.random() * 3,
      });
    }

    // Yıldız parçacıkları — parlak beyaz
    for (let i = 0; i < 3; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2;
      this.state.particles.push({
        x: x + (Math.random() - 0.5) * 10,
        y: y + (Math.random() - 0.5) * 10,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 30,
        maxLife: 30,
        color: '#ffffff',
        radius: 2 + Math.random() * 2,
      });
    }
  }

  /** Parçacık oluştur — ölüm */
  private spawnDeathParticles(worm: WormState): void {
    const head = worm.segments[0];
    
    // Ana patlama parçacıkları — worm rengi
    for (let i = 0; i < 30; i++) {
      const angle = (i / 30) * Math.PI * 2;
      const speed = 3 + Math.random() * 5;
      this.state.particles.push({
        x: head.x + (Math.random() - 0.5) * 40,
        y: head.y + (Math.random() - 0.5) * 40,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 50,
        maxLife: 50,
        color: worm.config.color,
        radius: 5 + Math.random() * 5,
      });
    }

    // İkincil parçacıklar — ikinci renk
    for (let i = 0; i < 15; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 2 + Math.random() * 3;
      this.state.particles.push({
        x: head.x + (Math.random() - 0.5) * 50,
        y: head.y + (Math.random() - 0.5) * 50,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 40,
        maxLife: 40,
        color: worm.config.color2,
        radius: 3 + Math.random() * 3,
      });
    }

    // Beyaz parlama parçacıkları
    for (let i = 0; i < 10; i++) {
      const angle = Math.random() * Math.PI * 2;
      const speed = 4 + Math.random() * 6;
      this.state.particles.push({
        x: head.x,
        y: head.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 35,
        maxLife: 35,
        color: '#ffffff',
        radius: 2 + Math.random() * 3,
      });
    }
  }

  /** Boost trail parçacıkları — worm boost yaparken arkasından iz bırakır */
  private spawnBoostTrail(): void {
    for (const worm of this.state.worms) {
      if (!worm.alive || !worm.boosting) continue;
      if (this.state.tick % 3 !== 0) continue; // her 3 tick'te bir

      // Son segmentten parçacık bırak
      const tail = worm.segments[worm.segments.length - 1];
      if (!tail) continue;

      this.state.particles.push({
        x: tail.x + (Math.random() - 0.5) * 10,
        y: tail.y + (Math.random() - 0.5) * 10,
        vx: (Math.random() - 0.5) * 0.5,
        vy: (Math.random() - 0.5) * 0.5,
        life: 15,
        maxLife: 15,
        color: worm.config.color,
        radius: 3 + Math.random() * 2,
      });
    }
  }

  /** Parçacıkları güncelle */
  private updateParticles(): void {
    for (const p of this.state.particles) {
      p.x += p.vx;
      p.y += p.vy;
      p.vx *= 0.95;
      p.vy *= 0.95;
      p.life--;
    }
    this.state.particles = this.state.particles.filter(p => p.life > 0);
  }

  /** Render */
  private render(): void {
    this.renderer.render(this.state, this.canvas.width, this.canvas.height);
  }

  /** Canvas boyutunu güncelle */
  resize(width: number, height: number): void {
    this.canvas.width = width;
    this.canvas.height = height;
  }

  /** Temizlik */
  destroy(): void {
    this.stop();
    this.input.destroy();
  }

  /** State'e erişim (minimap için) */
  getState(): GameState {
    return this.state;
  }
}
