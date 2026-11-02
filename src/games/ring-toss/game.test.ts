import { describe, expect, it } from 'vitest';
import {
  FLIGHT_TIME,
  NECK_RADIUS,
  RINGS_PER_ROUND,
  THROWER,
  WOBBLE,
  bottleAt,
  createState,
  landingPoint,
  step,
  toss,
  wobbleOffset,
} from './game';

/** Aims so that, with the wobble at this moment, the ring lands at (x, y). */
function aimFor(state: ReturnType<typeof createState>, x: number, y: number) {
  return { x: x - wobbleOffset(state), y };
}

describe('ring toss', () => {
  it('starts with every ring, no score and no ringed bottles', () => {
    const state = createState();
    expect(state.ringsLeft).toBe(RINGS_PER_ROUND);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('playing');
    expect(state.bottles).toHaveLength(15);
    expect(state.bottles.every((b) => !b.ringed)).toBe(true);
  });

  it('puts the bottles further back on higher scores', () => {
    const { bottles } = createState();
    const back = bottles.reduce((a, b) => (b.y < a.y ? b : a));
    const front = bottles.reduce((a, b) => (b.y > a.y ? b : a));
    expect(back.points).toBe(30);
    expect(front.points).toBe(10);
  });

  it('uses one ring per throw', () => {
    const state = createState();
    expect(toss(state, 400, 200)).toBe(true);
    expect(state.ringsLeft).toBe(RINGS_PER_ROUND - 1);
    expect(state.rings).toHaveLength(1);
  });

  it('cannot throw once the rings run out', () => {
    const state = createState();
    state.ringsLeft = 0;
    expect(toss(state, 400, 200)).toBe(false);
    expect(state.rings).toHaveLength(0);
  });

  it('wobbles the aim no further than the wobble allows', () => {
    const state = createState();
    for (let i = 0; i < 100; i++) {
      step(state, 0.05);
      expect(Math.abs(wobbleOffset(state))).toBeLessThanOrEqual(WOBBLE);
    }
  });

  it('never lands a ring behind the thrower', () => {
    const state = createState();
    expect(landingPoint(state, 400, THROWER.y + 100).y).toBeLessThan(THROWER.y);
  });

  it('scores a ring that lands on a bottle neck once it comes down', () => {
    const state = createState();
    step(state, 0.3);
    const bottle = state.bottles[0];
    const aim = aimFor(state, bottle.x + NECK_RADIUS / 2, bottle.y);
    toss(state, aim.x, aim.y);
    step(state, FLIGHT_TIME / 2);
    expect(state.score).toBe(0);
    step(state, FLIGHT_TIME);
    expect(state.score).toBe(bottle.points);
    expect(bottle.ringed).toBe(true);
    expect(state.rings).toHaveLength(0);
  });

  it('scores nothing for a ring that misses every neck', () => {
    const state = createState();
    const aim = aimFor(state, 10, 450);
    toss(state, aim.x, aim.y);
    step(state, FLIGHT_TIME);
    expect(state.score).toBe(0);
    expect(state.misses).toHaveLength(1);
  });

  it('does not score a second ring on a bottle that is already ringed', () => {
    const state = createState();
    const bottle = state.bottles[0];
    bottle.ringed = true;
    expect(bottleAt(state, bottle.x, bottle.y)).toBeUndefined();
    const aim = aimFor(state, bottle.x, bottle.y);
    toss(state, aim.x, aim.y);
    step(state, FLIGHT_TIME);
    expect(state.score).toBe(0);
  });

  it('ends the round when the last ring has landed', () => {
    const state = createState();
    state.ringsLeft = 1;
    toss(state, 400, 200);
    step(state, FLIGHT_TIME / 2);
    expect(state.phase).toBe('playing');
    step(state, FLIGHT_TIME);
    expect(state.phase).toBe('over');
  });

  it('cannot throw once the round is over', () => {
    const state = createState();
    state.phase = 'over';
    expect(toss(state, 400, 200)).toBe(false);
  });
});
