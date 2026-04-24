/**
 * BoardRenderer — grid layout and input model tests.
 *
 * Tests cover:
 *   - 7×9 grid is laid out with cell size 55×55 px at 390 px viewport width
 *   - board container eventMode is 'passive'; cell sprites are 'static'
 *   - cell hit area is at least 44×44 px (touch target floor)
 */

import { describe, it, expect, vi } from 'vitest';

// Stub Pixi.js — layout math runs without WebGL
vi.mock('pixi.js', () => {
  const Container = vi.fn().mockImplementation(() => ({
    eventMode: 'none',
    label: '',
    addChild: vi.fn(),
    x: 0,
    y: 0,
    children: [],
  }));
  const Sprite = vi.fn().mockImplementation(() => ({
    eventMode: 'none',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    hitArea: null,
    label: '',
    anchor: { set: vi.fn() },
  }));
  const Rectangle = vi.fn().mockImplementation((x, y, w, h) => ({ x, y, width: w, height: h }));
  const Graphics = vi.fn().mockImplementation(() => ({
    rect: vi.fn().mockReturnThis(),
    fill: vi.fn().mockReturnThis(),
    tint: 0,
    x: 0,
    y: 0,
    eventMode: 'none',
    hitArea: null,
    label: '',
    on: vi.fn(),
  }));
  const Texture = { EMPTY: {} };
  return { Container, Sprite, Rectangle, Graphics, Texture };
});

import { BoardRenderer } from '~/game/mars-bounce/renderers/BoardRenderer';

const makeBoard = () => {
  const renderer = new BoardRenderer();
  // Init with iPhone 390×844, HUD top 60 px, logo bottom 64 px
  renderer.init(390, 844, 60, 64);
  return renderer;
};

describe('BoardRenderer — grid layout', () => {
  it('7×9 grid renders with cell size 55×55 px, board centered horizontally', () => {
    const renderer = makeBoard();

    expect(renderer.cellSize).toBe(55); // floor(390/7) = 55
    expect(renderer.boardWidth).toBe(385); // 7 × 55
    expect(renderer.boardHeight).toBe(495); // 9 × 55
    // Board horizontally centered: (390 - 385) / 2 = 2.5 → Math.round = 3
    expect(renderer.boardX).toBeGreaterThanOrEqual(2);
  });

  it("board container has eventMode 'passive'; individual cell sprites have eventMode 'static'", () => {
    const renderer = makeBoard();

    expect(renderer.container.eventMode).toBe('passive');
    // All cell graphics should be 'static'
    const cellModes = renderer.cellGraphics.flat().map((g) => g.eventMode);
    expect(cellModes.every((m) => m === 'static')).toBe(true);
  });

  it('its Pixi hit area is at least 44×44 px', () => {
    const renderer = makeBoard();

    for (const row of renderer.cellGraphics) {
      for (const cell of row) {
        expect(cell.hitArea).not.toBeNull();
        const { width, height } = cell.hitArea as { width: number; height: number };
        expect(width).toBeGreaterThanOrEqual(44);
        expect(height).toBeGreaterThanOrEqual(44);
      }
    }
  });
});
