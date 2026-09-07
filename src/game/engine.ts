import {
  GameState, Worm, Food, Particle, Point,
  WORLD_WIDTH, WORLD_HEIGHT, MAX_FOOD, MAX_WORMS,
  SEGMENT_DISTANCE, WORM_BASE_SPEED, WORM_BOOST_SPEED,
  TURN_SPEED, MIN_LENGTH, FOOD_RADIUS, SUPER_FOOD_RADIUS,
  WORM_COLORS, AI_NAMES,
} from './types';

let idCounter = 0;
const genId = () => `${++idCounter}`;

export function createInitialState(): GameState {
  const state: GameState = {
    worms: [],
    foods: [],
    particles: [],
    worldWidth: WORLD_WIDTH,
    worldHeight: WORLD_HEIGHT,
    camera: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2, zoom: 1, targetZoom: 1 },
    player: null,
    gameOver: false,
    leaderboard: [],
    mouseAngle: 0,
    mouseWorld: { x: WORLD_WIDTH / 2, y: WORLD_HEIGHT / 2 },
  };

  // Spawn initial food
  for (let i = 0; i < MAX_FOOD; i++) {
    state.foods.push(createFood());
  }

  // Spawn AI worms
  for (let i = 0; i < MAX_WORMS - 1; i++) {
    state.worms.push(createAIWorm(i));
  }

  return state;
}

export function createPlayerWorm(name: string): Worm {
  const colorSet = WORM_COLORS[Math.floor(Math.random() * WORM_COLORS.length)];
  const x = WORLD_WIDTH / 2 + (Math.random() - 0.5) * 1000;
  const y = WORLD_HEIGHT / 2 + (Math.random() - 0.5) * 1000;
  const angle = Math.random() * Math.PI * 2;

  const segments: Point[] = [];
  for (let i = 0; i < MIN_LENGTH; i++) {
    segments.push({
      x: x - Math.cos(angle) * i * SEGMENT_DISTANCE,
      y: y - Math.sin(angle) * i * SEGMENT_DISTANCE,
    });
  }

  return {
    id: genId(),
    name,
    segments,
    angle,
    targetAngle: angle,
    speed: WORM_BASE_SPEED,
    baseSpeed: WORM_BASE_SPEED,
    boosting: false,
    color: colorSet.primary,
    secondaryColor: colorSet.secondary,
    score: 0,
    alive: true,
    isPlayer: true,
    eyeDirection: angle,
  };
}

function createAIWorm(index: number): Worm {
  const colorSet = WORM_COLORS[index % WORM_COLORS.length];
  const x = Math.random() * WORLD_WIDTH;
  const y = Math.random() * WORLD_HEIGHT;
  const angle = Math.random() * Math.PI * 2;
  const length = MIN_LENGTH + Math.floor(Math.random() * 30);

  const segments: Point[] = [];
  for (let i = 0; i < length; i++) {
    segments.push({
      x: x - Math.cos(angle) * i * SEGMENT_DISTANCE,
      y: y - Math.sin(angle) * i * SEGMENT_DISTANCE,
    });
  }

  return {
    id: genId(),
    name: AI_NAMES[index % AI_NAMES.length],
    segments,
    angle,
    targetAngle: angle,
    speed: WORM_BASE_SPEED,
    baseSpeed: WORM_BASE_SPEED,
    boosting: false,
    color: colorSet.primary,
    secondaryColor: colorSet.secondary,
    score: length * 10,
    alive: true,
    isPlayer: false,
    eyeDirection: angle,
    aiTimer: 0,
    aiBehavior: 'food',
  };
}

export function createFood(forceSuper = false): Food {
  const isSuper = forceSuper || Math.random() < 0.05;
  const isPowerup = !isSuper && Math.random() < 0.02;

  let type: Food['type'] = 'normal';
  let color = '';
  let radius = FOOD_RADIUS;
  let value = 1;

  if (isPowerup) {
    const powerupTypes: Food['type'][] = ['powerup_speed', 'powerup_magnet', 'powerup_growth'];
    type = powerupTypes[Math.floor(Math.random() * powerupTypes.length)];
    radius = SUPER_FOOD_RADIUS + 2;
    value = 5;
    switch (type) {
      case 'powerup_speed': color = '#00ff88'; break;
      case 'powerup_magnet': color = '#ff00ff'; break;
      case 'powerup_growth': color = '#ffaa00'; break;
    }
  } else if (isSuper) {
    type = 'super';
    radius = SUPER_FOOD_RADIUS;
    value = 3;
    color = `hsl(${Math.random() * 360}, 100%, 70%)`;
  } else {
    const colors = ['#ff6b6b', '#4ecdc4', '#f9ca24', '#a29bfe', '#fd79a8', '#00b894', '#74b9ff', '#55efc4'];
    color = colors[Math.floor(Math.random() * colors.length)];
  }

  return {
    id: genId(),
    x: Math.random() * WORLD_WIDTH,
    y: Math.random() * WORLD_HEIGHT,
    radius,
    color,
    value,
    type,
    pulsePhase: Math.random() * Math.PI * 2,
  };
}

function distance(a: Point, b: Point): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function angleDiff(from: number, to: number): number {
  let diff = to - from;
  while (diff > Math.PI) diff -= Math.PI * 2;
  while (diff < -Math.PI) diff += Math.PI * 2;
  return diff;
}

function normalizeAngle(angle: number): number {
  while (angle > Math.PI) angle -= Math.PI * 2;
  while (angle < -Math.PI) angle += Math.PI * 2;
  return angle;
}

export function updateGame(state: GameState, dt: number): void {
  if (state.gameOver) return;

  const dtFactor = dt / 16.67; // normalize to 60fps

  // Update player worm
  if (state.player && state.player.alive) {
    state.player.targetAngle = state.mouseAngle;
  }

  // Update all worms
  for (const worm of state.worms) {
    if (!worm.alive) continue;
    updateWorm(worm, state, dtFactor);
  }

  // AI logic
  for (const worm of state.worms) {
    if (!worm.alive || worm.isPlayer) continue;
    updateAI(worm, state, dtFactor);
  }

  // Collision detection
  checkCollisions(state);

  // Update particles
  updateParticles(state, dtFactor);

  // Maintain food count
  while (state.foods.length < MAX_FOOD) {
    state.foods.push(createFood());
  }

  // Respawn dead AI worms
  const aliveAI = state.worms.filter(w => !w.isPlayer && w.alive).length;
  if (aliveAI < MAX_WORMS - 1) {
    const idx = state.worms.filter(w => !w.isPlayer).length;
    state.worms.push(createAIWorm(idx));
  }

  // Update camera
  if (state.player && state.player.alive) {
    const head = state.player.segments[0];
    state.camera.x += (head.x - state.camera.x) * 0.1;
    state.camera.y += (head.y - state.camera.y) * 0.1;
    const targetZoom = Math.max(0.4, 1 - state.player.segments.length * 0.003);
    state.camera.targetZoom = targetZoom;
    state.camera.zoom += (state.camera.targetZoom - state.camera.zoom) * 0.05;
  }

  // Update food pulse
  for (const food of state.foods) {
    food.pulsePhase += 0.05 * dtFactor;
  }

  // Update leaderboard
  updateLeaderboard(state);
}

function updateWorm(worm: Worm, state: GameState, dtFactor: number): void {
  // Turn towards target angle
  const diff = angleDiff(worm.angle, worm.targetAngle);
  worm.angle += diff * TURN_SPEED * dtFactor;
  worm.angle = normalizeAngle(worm.angle);
  worm.eyeDirection = worm.angle;

  // Speed
  const speed = worm.boosting ? WORM_BOOST_SPEED : worm.baseSpeed;
  worm.speed = speed;

  // Move head
  const head = worm.segments[0];
  const newHead: Point = {
    x: head.x + Math.cos(worm.angle) * speed * dtFactor,
    y: head.y + Math.sin(worm.angle) * speed * dtFactor,
  };

  // World bounds - wrap around
  if (newHead.x < 0) newHead.x = WORLD_WIDTH;
  if (newHead.x > WORLD_WIDTH) newHead.x = 0;
  if (newHead.y < 0) newHead.y = WORLD_HEIGHT;
  if (newHead.y > WORLD_HEIGHT) newHead.y = 0;

  // Insert new head, shift segments
  worm.segments.unshift(newHead);

  // Maintain segment distance
  while (worm.segments.length > 1) {
    const seg = worm.segments[1];
    const dist = distance(newHead, seg);
    if (dist > SEGMENT_DISTANCE) {
      const ratio = SEGMENT_DISTANCE / dist;
      seg.x = newHead.x + (seg.x - newHead.x) * ratio;
      seg.y = newHead.y + (seg.y - newHead.y) * ratio;
    }
    break;
  }

  // Remove excess segments to maintain proper length
  const targetLength = Math.max(MIN_LENGTH, Math.floor(worm.score / 10) + MIN_LENGTH);
  while (worm.segments.length > targetLength) {
    worm.segments.pop();
  }

  // Boosting costs segments
  if (worm.boosting && worm.segments.length > MIN_LENGTH) {
    if (Math.random() < 0.1 * dtFactor) {
      const tail = worm.segments.pop()!;
      // Drop food from tail
      state.foods.push({
        id: genId(),
        x: tail.x + (Math.random() - 0.5) * 10,
        y: tail.y + (Math.random() - 0.5) * 10,
        radius: FOOD_RADIUS,
        color: worm.color,
        value: 1,
        type: 'normal',
        pulsePhase: Math.random() * Math.PI * 2,
      });
    }
  }

  // Eat food
  for (let i = state.foods.length - 1; i >= 0; i--) {
    const food = state.foods[i];
    const dist = distance(worm.segments[0], food);
    if (dist < food.radius + 12) {
      worm.score += food.value * 10;
      // Add segments
      for (let j = 0; j < food.value; j++) {
        const last = worm.segments[worm.segments.length - 1];
        worm.segments.push({ x: last.x, y: last.y });
      }
      // Create particles
      for (let j = 0; j < 5; j++) {
        state.particles.push({
          x: food.x,
          y: food.y,
          vx: (Math.random() - 0.5) * 4,
          vy: (Math.random() - 0.5) * 4,
          life: 30,
          maxLife: 30,
          color: food.color,
          radius: 3,
        });
      }
      state.foods.splice(i, 1);
    }
  }
}

function updateAI(worm: Worm, state: GameState, dtFactor: number): void {
  worm.aiTimer = (worm.aiTimer || 0) - dtFactor;

  if (worm.aiTimer <= 0) {
    // Decide behavior
    const rand = Math.random();
    if (rand < 0.7) {
      worm.aiBehavior = 'food';
    } else if (rand < 0.9) {
      worm.aiBehavior = 'hunt';
    } else {
      worm.aiBehavior = 'flee';
    }
    worm.aiTimer = 60 + Math.random() * 120;
  }

  const head = worm.segments[0];

  switch (worm.aiBehavior) {
    case 'food': {
      // Find nearest food
      let nearestFood: Food | null = null;
      let nearestDist = Infinity;
      for (const food of state.foods) {
        const d = distance(head, food);
        if (d < nearestDist && d < 500) {
          nearestDist = d;
          nearestFood = food;
        }
      }
      if (nearestFood) {
        worm.targetAngle = Math.atan2(nearestFood.y - head.y, nearestFood.x - head.x);
      } else {
        // Wander
        if (Math.random() < 0.02) {
          worm.targetAngle += (Math.random() - 0.5) * 1;
        }
      }
      worm.boosting = false;
      break;
    }
    case 'hunt': {
      // Find nearest smaller worm
      let target: Worm | null = null;
      let targetDist = Infinity;
      for (const other of state.worms) {
        if (other.id === worm.id || !other.alive) continue;
        if (other.segments.length < worm.segments.length * 0.7) {
          const d = distance(head, other.segments[0]);
          if (d < targetDist && d < 400) {
            targetDist = d;
            target = other;
          }
        }
      }
      if (target) {
        const tHead = target.segments[0];
        worm.targetAngle = Math.atan2(tHead.y - head.y, tHead.x - head.x);
        worm.boosting = targetDist < 200 && worm.segments.length > MIN_LENGTH + 5;
      } else {
        worm.aiBehavior = 'food';
      }
      break;
    }
    case 'flee': {
      // Find nearest larger worm and flee
      let threat: Worm | null = null;
      let threatDist = Infinity;
      for (const other of state.worms) {
        if (other.id === worm.id || !other.alive) continue;
        if (other.segments.length > worm.segments.length * 1.3) {
          const d = distance(head, other.segments[0]);
          if (d < threatDist && d < 300) {
            threatDist = d;
            threat = other;
          }
        }
      }
      if (threat) {
        const tHead = threat.segments[0];
        worm.targetAngle = Math.atan2(head.y - tHead.y, head.x - tHead.x);
        worm.boosting = worm.segments.length > MIN_LENGTH + 3;
      } else {
        worm.aiBehavior = 'food';
      }
      break;
    }
  }

  // Avoid walls
  const margin = 200;
  if (head.x < margin) worm.targetAngle = 0;
  if (head.x > WORLD_WIDTH - margin) worm.targetAngle = Math.PI;
  if (head.y < margin) worm.targetAngle = Math.PI / 2;
  if (head.y > WORLD_HEIGHT - margin) worm.targetAngle = -Math.PI / 2;

  // Avoid own body - check if heading into own segments
  for (let i = 10; i < Math.min(worm.segments.length, 40); i += 3) {
    const seg = worm.segments[i];
    const d = distance(head, seg);
    if (d < 40) {
      const awayAngle = Math.atan2(head.y - seg.y, head.x - seg.x);
      worm.targetAngle = awayAngle;
      break;
    }
  }

  // Avoid other worms' bodies
  for (const other of state.worms) {
    if (other.id === worm.id || !other.alive) continue;
    for (let i = 0; i < Math.min(other.segments.length, 30); i += 4) {
      const seg = other.segments[i];
      const d = distance(head, seg);
      if (d < 50) {
        const awayAngle = Math.atan2(head.y - seg.y, head.x - seg.x);
        worm.targetAngle = awayAngle;
        break;
      }
    }
  }
}

function checkCollisions(state: GameState): void {
  for (const worm of state.worms) {
    if (!worm.alive) continue;
    const head = worm.segments[0];

    for (const other of state.worms) {
      if (other.id === worm.id || !other.alive) continue;

      // Check head against other's body segments (skip first few to avoid self-like collision)
      for (let i = 5; i < other.segments.length; i++) {
        const seg = other.segments[i];
        const dist = distance(head, seg);
        const otherRadius = 8 + Math.min(other.segments.length * 0.12, 10);
        const myRadius = 8 + Math.min(worm.segments.length * 0.12, 10);
        const hitRadius = (otherRadius + myRadius) * 0.55;
        if (dist < hitRadius) {
          // Worm dies
          killWorm(worm, state);
          other.score += Math.floor(worm.score * 0.3);
          break;
        }
      }
      if (!worm.alive) break;
    }
  }
}

function killWorm(worm: Worm, state: GameState): void {
  worm.alive = false;

  // Convert segments to food
  for (let i = 0; i < worm.segments.length; i += 2) {
    const seg = worm.segments[i];
    state.foods.push({
      id: genId(),
      x: seg.x + (Math.random() - 0.5) * 20,
      y: seg.y + (Math.random() - 0.5) * 20,
      radius: SUPER_FOOD_RADIUS,
      color: worm.color,
      value: 2,
      type: 'super',
      pulsePhase: Math.random() * Math.PI * 2,
    });
  }

  // Death particles
  for (let i = 0; i < 20; i++) {
    state.particles.push({
      x: worm.segments[0].x,
      y: worm.segments[0].y,
      vx: (Math.random() - 0.5) * 8,
      vy: (Math.random() - 0.5) * 8,
      life: 60,
      maxLife: 60,
      color: worm.color,
      radius: 4 + Math.random() * 4,
    });
  }

  if (worm.isPlayer) {
    state.gameOver = true;
  }
}

function updateParticles(state: GameState, dtFactor: number): void {
  for (let i = state.particles.length - 1; i >= 0; i--) {
    const p = state.particles[i];
    p.x += p.vx * dtFactor;
    p.y += p.vy * dtFactor;
    p.vx *= 0.95;
    p.vy *= 0.95;
    p.life -= dtFactor;
    if (p.life <= 0) {
      state.particles.splice(i, 1);
    }
  }
}

function updateLeaderboard(state: GameState): void {
  const sorted = state.worms
    .filter(w => w.alive)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)
    .map(w => ({ name: w.name, score: w.score }));
  state.leaderboard = sorted;
}

export function screenToWorld(
  screenX: number, screenY: number,
  cameraX: number, cameraY: number, zoom: number,
  canvasWidth: number, canvasHeight: number
): Point {
  return {
    x: cameraX + (screenX - canvasWidth / 2) / zoom,
    y: cameraY + (screenY - canvasHeight / 2) / zoom,
  };
}
