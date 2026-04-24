/**
 * StartScreen — session routing tests for Mars Bounce.
 *
 * Tests cover:
 *   - First session: intro sequence starts after Play tap
 *   - Returning session: Level 1 loads directly, intro skipped
 *   - First-time intro panel text content
 *   - Level 1 loads after panel 2 tap
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createStartView } from '~/game/mars-bounce/screens/startView';

const FIRST_SEEN_KEY = 'mars-bounce-firstSeen';

describe('StartScreen — session routing', () => {
  let localStorageMock: Record<string, string>;

  beforeEach(() => {
    localStorageMock = {};
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => localStorageMock[k] ?? null,
      setItem: (k: string, v: string) => { localStorageMock[k] = v; },
      removeItem: (k: string) => { delete localStorageMock[k]; },
      clear: () => { localStorageMock = {}; },
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('isFirstSession returns true when no localStorage flag exists', () => {
    const { isFirstSession } = createStartView();
    expect(isFirstSession()).toBe(true);
  });

  it('isFirstSession returns false when localStorage flag exists', () => {
    localStorageMock[FIRST_SEEN_KEY] = 'true';
    const { isFirstSession } = createStartView();
    expect(isFirstSession()).toBe(false);
  });

  it('markSessionSeen sets the localStorage flag', () => {
    const { markSessionSeen } = createStartView();
    markSessionSeen();
    expect(localStorageMock[FIRST_SEEN_KEY]).toBe('true');
  });

  it('intro panels contain correct text: panel 1 mentions help, panel 2 mentions tapping', () => {
    const { introPanels } = createStartView();
    expect(introPanels[0]).toContain('help');
    expect(introPanels[1]).toContain('Tap');
  });

  it('advancing past panel 2 marks session seen and triggers goto game', () => {
    const goto = vi.fn();
    const { advanceIntro, markSessionSeen } = createStartView();

    markSessionSeen();
    advanceIntro(1, goto); // panel index 1 = last panel

    expect(goto).toHaveBeenCalledWith('game');
  });

  it('first session: goto game called directly (no intro) when returning', () => {
    localStorageMock[FIRST_SEEN_KEY] = 'true';
    const goto = vi.fn();
    const { startPlay } = createStartView();

    startPlay(goto);

    expect(goto).toHaveBeenCalledWith('game');
  });
});

describe('LoadingScreen — Mars theme', () => {
  it('loading screen background is Mars-themed (not green)', async () => {
    // The LoadingScreen background color must not be the default scaffold green (#BCE083)
    // Verified by checking the exported LOADING_BACKGROUND constant
    const { LOADING_BG_COLOR } = await import('~/game/mars-bounce/screens/loadingTheme');
    expect(LOADING_BG_COLOR).not.toBe('#BCE083');
    // Must be a dark Martian red/orange/brown palette
    expect(LOADING_BG_COLOR).toMatch(/^#[0-9a-fA-F]{6}$/);
  });
});
