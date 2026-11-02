import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const RINGS_PER_ROUND = 8;
/** How close to a bottle's neck, in pixels, a ring has to land to score. */
export const NECK_RADIUS = 10;
/** Seconds a ring spends in the air. */
export const FLIGHT_TIME = 0.6;
/** How far, in pixels, the aim wobbles to each side. */
export const WOBBLE = 40;
/** Wobbles per second, in radians. */
const WOBBLE_SPEED = 2.6;
export const THROWER = { x: WIDTH / 2, y: HEIGHT - 40 } as const;
const BOTTLES_PER_ROW = 5;
/** Back row first. Bottles further back score more. */
const ROWS = [
  { y: 130, points: 30 },
  { y: 200, points: 20 },
  { y: 270, points: 10 },
];

export interface Bottle {
  x: number;
  /** Where the neck is. */
  y: number;
  points: number;
  ringed: boolean;
}

export interface Ring {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  /** Seconds since the ring was thrown. */
  age: number;
}

export interface Miss {
  x: number;
  y: number;
  age: number;
}

export interface RingTossState {
  bottles: Bottle[];
  rings: Ring[];
  misses: Miss[];
  ringsLeft: number;
  score: number;
  /** Seconds since the round started, which drives the wobble. */
  time: number;
  phase: 'playing' | 'over';
}

export function createState(): RingTossState {
  const spacing = 90;
  const left = WIDTH / 2 - (spacing * (BOTTLES_PER_ROW - 1)) / 2;
  const bottles = ROWS.flatMap((row) =>
    Array.from({ length: BOTTLES_PER_ROW }, (_, i) => ({
      x: left + spacing * i,
      y: row.y,
      points: row.points,
      ringed: false,
    })),
  );
  return {
    bottles,
    rings: [],
    misses: [],
    ringsLeft: RINGS_PER_ROUND,
    score: 0,
    time: 0,
    phase: 'playing',
  };
}

/** How far the aim is pushed sideways right now. */
export function wobbleOffset(state: RingTossState): number {
  return Math.sin(state.time * WOBBLE_SPEED) * WOBBLE;
}

/** Where a ring thrown at the aim point would land right now. */
export function landingPoint(state: RingTossState, aimX: number, aimY: number) {
  return { x: aimX + wobbleOffset(state), y: Math.min(aimY, THROWER.y - 1) };
}

/** The bottle a ring landing at (x, y) goes over, if any. A ringed bottle takes no more rings. */
export function bottleAt(state: RingTossState, x: number, y: number): Bottle | undefined {
  return state.bottles.find((b) => !b.ringed && Math.hypot(x - b.x, y - b.y) <= NECK_RADIUS);
}

/** Throws one ring towards the aim point. Returns false if nothing was thrown. */
export function toss(state: RingTossState, aimX: number, aimY: number): boolean {
  if (state.phase !== 'playing' || state.ringsLeft === 0) return false;
  const to = landingPoint(state, aimX, aimY);
  state.rings.push({ fromX: THROWER.x, fromY: THROWER.y, toX: to.x, toY: to.y, age: 0 });
  state.ringsLeft -= 1;
  return true;
}

/** Where a ring in the air is now, on a straight line from the thrower to where it lands. */
export function ringPosition(ring: Ring) {
  const t = Math.min(ring.age / FLIGHT_TIME, 1);
  return {
    x: ring.fromX + (ring.toX - ring.fromX) * t,
    y: ring.fromY + (ring.toY - ring.fromY) * t,
    /** Height above the ground, for drawing: highest halfway through the flight. */
    lift: Math.sin(t * Math.PI) * 60,
  };
}

/** Advances the game by `dt` seconds. */
export function step(state: RingTossState, dt: number): void {
  state.time += dt;
  for (const miss of state.misses) miss.age += dt;
  state.misses = state.misses.filter((m) => m.age < 0.6);

  const flying: Ring[] = [];
  for (const ring of state.rings) {
    ring.age += dt;
    if (ring.age < FLIGHT_TIME) {
      flying.push(ring);
      continue;
    }
    const bottle = bottleAt(state, ring.toX, ring.toY);
    if (bottle) {
      bottle.ringed = true;
      state.score += bottle.points;
    } else {
      state.misses.push({ x: ring.toX, y: ring.toY, age: 0 });
    }
  }
  state.rings = flying;

  if (state.ringsLeft === 0 && state.rings.length === 0) state.phase = 'over';
}

function drawRing(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.beginPath();
  ctx.ellipse(x, y, size, size * 0.45, 0, 0, Math.PI * 2);
  ctx.stroke();
}

function draw(ctx: CanvasRenderingContext2D, state: RingTossState, aim: { x: number; y: number }) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // Shelves under each row.
  for (const row of ROWS) {
    ctx.fillStyle = colors.wood;
    ctx.fillRect(WIDTH / 2 - 230, row.y + 40, 460, 8);
  }

  for (const bottle of state.bottles) {
    ctx.fillStyle = colors.surface;
    ctx.fillRect(bottle.x - 14, bottle.y + 14, 28, 26);
    ctx.fillRect(bottle.x - 5, bottle.y - 4, 10, 18);
    ctx.fillStyle = colors.muted;
    ctx.fillRect(bottle.x - 14, bottle.y + 22, 28, 8);
    if (bottle.ringed) {
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 4;
      drawRing(ctx, bottle.x, bottle.y + 10, 14);
    }
  }

  ctx.strokeStyle = colors.danger;
  ctx.lineWidth = 3;
  for (const miss of state.misses) {
    ctx.globalAlpha = 1 - miss.age / 0.6;
    drawRing(ctx, miss.x, miss.y, 14);
  }
  ctx.globalAlpha = 1;

  ctx.strokeStyle = colors.accent;
  ctx.lineWidth = 4;
  for (const ring of state.rings) {
    const at = ringPosition(ring);
    drawRing(ctx, at.x, at.y - at.lift, 14 + at.lift / 10);
  }

  if (state.phase === 'playing') {
    // The reticle shows where a ring would land now.
    const target = landingPoint(state, aim.x, aim.y);
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(target.x, target.y, NECK_RADIUS, 0, Math.PI * 2);
    ctx.moveTo(target.x - 16, target.y);
    ctx.lineTo(target.x + 16, target.y);
    ctx.moveTo(target.x, target.y - 16);
    ctx.lineTo(target.x, target.y + 16);
    ctx.stroke();
  }

  // The thrower's hand, holding the next ring.
  ctx.fillStyle = colors.surface;
  ctx.beginPath();
  ctx.arc(THROWER.x, THROWER.y, 20, 0, Math.PI * 2);
  ctx.fill();
  if (state.ringsLeft > 0) {
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 4;
    drawRing(ctx, THROWER.x, THROWER.y - 6, 16);
  }

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Score ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Rings ${state.ringsLeft}/${RINGS_PER_ROUND}`, WIDTH - 16, HEIGHT - 20);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Out of rings! You scored ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const ringToss: CarnivalGame = {
  id: 'ring-toss',
  name: 'Ring Toss',
  description:
    'Land rings on the bottle necks before you run out. Bottles further back score more.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;
    const aim = { x: WIDTH / 2, y: ROWS[1].y };

    const toCanvas = (event: PointerEvent) => {
      const rect = canvas.getBoundingClientRect();
      return {
        x: ((event.clientX - rect.left) / rect.width) * WIDTH,
        y: ((event.clientY - rect.top) / rect.height) * HEIGHT,
      };
    };
    const onMove = (event: PointerEvent) => Object.assign(aim, toCanvas(event));
    const onDown = (event: PointerEvent) => {
      Object.assign(aim, toCanvas(event));
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      } else {
        toss(state, aim.x, aim.y);
      }
    };
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(ringToss.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state, aim);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerdown', onDown);
    };
  },
};

export default ringToss;
