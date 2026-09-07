/**
 * InputHandler — Mouse takibi ve boost input yönetimi
 * Canvas üzerindeki mouse pozisyonundan hedef açı hesaplar.
 */

export class InputHandler {
  private canvas: HTMLCanvasElement;
  private mouseX: number = 0;
  private mouseY: number = 0;
  private _boosting: boolean = false;
  private _angle: number = 0;
  private _active: boolean = false;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.setupListeners();
  }

  private setupListeners(): void {
    // Mouse move
    this.canvas.addEventListener('mousemove', this.onMouseMove);
    this.canvas.addEventListener('mouseenter', () => { this._active = true; });
    this.canvas.addEventListener('mouseleave', () => { this._active = false; });

    // Mouse button (boost)
    this.canvas.addEventListener('mousedown', (e) => {
      if (e.button === 0) this._boosting = true;
    });
    this.canvas.addEventListener('mouseup', (e) => {
      if (e.button === 0) this._boosting = false;
    });

    // Touch support
    this.canvas.addEventListener('touchstart', this.onTouchStart, { passive: false });
    this.canvas.addEventListener('touchmove', this.onTouchMove, { passive: false });
    this.canvas.addEventListener('touchend', this.onTouchEnd);

    // Space bar for boost
    window.addEventListener('keydown', (e) => {
      if (e.code === 'Space') {
        e.preventDefault();
        this._boosting = true;
      }
    });
    window.addEventListener('keyup', (e) => {
      if (e.code === 'Space') {
        this._boosting = false;
      }
    });
  }

  private onMouseMove = (e: MouseEvent): void => {
    const rect = this.canvas.getBoundingClientRect();
    this.mouseX = e.clientX - rect.left;
    this.mouseY = e.clientY - rect.top;
    this.updateAngle();
  };

  private onTouchStart = (e: TouchEvent): void => {
    e.preventDefault();
    this._active = true;
    if (e.touches.length >= 2) {
      this._boosting = true;
    }
    if (e.touches.length > 0) {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.touches[0].clientX - rect.left;
      this.mouseY = e.touches[0].clientY - rect.top;
      this.updateAngle();
    }
  };

  private onTouchMove = (e: TouchEvent): void => {
    e.preventDefault();
    if (e.touches.length > 0) {
      const rect = this.canvas.getBoundingClientRect();
      this.mouseX = e.touches[0].clientX - rect.left;
      this.mouseY = e.touches[0].clientY - rect.top;
      this.updateAngle();
    }
  };

  private onTouchEnd = (): void => {
    this._boosting = false;
  };

  private updateAngle(): void {
    const centerX = this.canvas.width / 2;
    const centerY = this.canvas.height / 2;
    this._angle = Math.atan2(this.mouseY - centerY, this.mouseX - centerX);
  }

  /** Oyuncu worm'un hedef açısını döner */
  get angle(): number {
    return this._angle;
  }

  /** Boost aktif mi */
  get boosting(): boolean {
    return this._boosting;
  }

  /** Input aktif mi (mouse canvas üzerinde mi) */
  get active(): boolean {
    return this._active;
  }

  /** Temizlik */
  destroy(): void {
    this.canvas.removeEventListener('mousemove', this.onMouseMove);
    this.canvas.removeEventListener('touchstart', this.onTouchStart);
    this.canvas.removeEventListener('touchmove', this.onTouchMove);
    this.canvas.removeEventListener('touchend', this.onTouchEnd);
  }
}
