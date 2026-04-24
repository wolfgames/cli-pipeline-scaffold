/**
 * HudRenderer — layout and update tests.
 *
 * Tests cover:
 *   - HUD fits within top 60 px, no visual overlap with board row 0
 *   - Move counter text updates within the same frame
 *   - Pause button hit area is ≥ 44×44 px
 *   - Pause button tap fires the scaffold pause system
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('pixi.js', () => {
  const Container = vi.fn().mockImplementation(() => ({
    eventMode: 'passive',
    label: '',
    addChild: vi.fn(),
    x: 0,
    y: 0,
    height: 0,
  }));
  const Text = vi.fn().mockImplementation((text: string) => ({
    text,
    x: 0,
    y: 0,
    label: '',
    style: {},
  }));
  const Graphics = vi.fn().mockImplementation(() => ({
    eventMode: 'none',
    hitArea: null,
    label: '',
    x: 0,
    y: 0,
    rect: vi.fn().mockReturnThis(),
    fill: vi.fn().mockReturnThis(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
  }));
  const Rectangle = vi.fn().mockImplementation((x, y, w, h) => ({ x, y, width: w, height: h }));
  const TextStyle = vi.fn().mockImplementation((s: Record<string, unknown>) => s);
  return { Container, Text, Graphics, Rectangle, TextStyle };
});

import { HudRenderer } from '~/game/mars-bounce/renderers/HudRenderer';

describe('HudRenderer — layout', () => {
  it('HUD fits within top 60 px, no visual overlap with board row 0', () => {
    const hud = new HudRenderer();
    hud.init(390, 60);

    // HUD container should be positioned at y=0, height ≤ reservedTop
    expect(hud.container.y).toBe(0);
    // Board row 0 starts at reservedTop (60) + MARGIN (8) = 68 px — HUD must end ≤ 60
    expect(hud.hudHeight).toBeLessThanOrEqual(60);
  });

  it('move counter text updates within the same frame', () => {
    const hud = new HudRenderer();
    hud.init(390, 60);

    hud.updateMoves(7);
    expect(hud.moveCounterText.text).toContain('7');
  });

  it('hit area is ≥ 44×44 px', () => {
    const hud = new HudRenderer();
    hud.init(390, 60);

    const hitArea = hud.pauseButton.hitArea as { width: number; height: number } | null;
    expect(hitArea).not.toBeNull();
    expect(hitArea!.width).toBeGreaterThanOrEqual(44);
    expect(hitArea!.height).toBeGreaterThanOrEqual(44);
  });

  it('pause overlay opens (scaffold pause system fires)', () => {
    const hud = new HudRenderer();
    const onPause = vi.fn();
    hud.init(390, 60, onPause);

    // Simulate tap on pause button
    hud.firePause();

    expect(onPause).toHaveBeenCalledTimes(1);
  });
});
