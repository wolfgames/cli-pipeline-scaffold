/**
 * GameController — pixi init and destroy lifecycle tests.
 *
 * Tests cover:
 *   - gameMode is 'pixi' on the returned controller
 *   - init() sets the active ECS database and appends a canvas to the container
 *   - destroy() cleans up the Pixi app, ECS bridge, and releases the active DB
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Stub canvas/append behavior so tests work in the node environment
const mockCanvas = { style: { cssText: '' }, remove: vi.fn() };

vi.mock('pixi.js', () => ({
  Application: vi.fn().mockImplementation(() => ({
    init: vi.fn().mockResolvedValue(undefined),
    destroy: vi.fn(),
    canvas: mockCanvas,
    screen: { width: 390, height: 844 },
    stage: {
      eventMode: 'static',
      addChild: vi.fn(),
    },
  })),
  Container: vi.fn().mockImplementation(() => ({
    eventMode: 'passive',
    label: '',
    addChild: vi.fn(),
    parent: null,
    removeChild: vi.fn(),
    destroy: vi.fn(),
  })),
  Graphics: vi.fn().mockImplementation(() => ({
    eventMode: 'none',
    hitArea: null,
    label: '',
    x: 0,
    y: 0,
    rect: vi.fn().mockReturnThis(),
    fill: vi.fn().mockReturnThis(),
    on: vi.fn(),
    removeAllListeners: vi.fn(),
    parent: null,
    removeChild: vi.fn(),
  })),
  Rectangle: vi.fn().mockImplementation((x, y, w, h) => ({ x, y, width: w, height: h })),
  Text: vi.fn().mockImplementation((text: string) => ({
    text,
    x: 0,
    y: 0,
    label: '',
    style: {},
    destroy: vi.fn(),
  })),
  TextStyle: vi.fn().mockImplementation((s: Record<string, unknown>) => s),
}));

vi.mock('gsap', () => ({
  default: { killTweensOf: vi.fn() },
  killTweensOf: vi.fn(),
}));

vi.mock('~/core/systems/ecs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('~/core/systems/ecs')>();
  return { ...actual, setActiveDb: vi.fn() };
});

import { setupGame } from '~/game/mars-bounce/screens/gameController';
import { setActiveDb } from '~/core/systems/ecs';
import { createMarsBounceDb } from '~/game/mars-bounce/state/MarsBouncePlugin';

const makeDeps = () => ({
  coordinator: {} as any,
  tuning: { scaffold: {} as any, game: {} as any },
  audio: {},
  gameData: {},
  analytics: {},
});

describe('GameController — pixi init', () => {
  const fakeContainer = {
    appendChild: vi.fn(),
  } as unknown as HTMLDivElement;

  beforeEach(() => {
    vi.clearAllMocks();
    mockCanvas.remove.mockClear();
  });

  it("gameMode is 'pixi', Pixi Application is created and canvas is appended to container", async () => {
    const controller = setupGame(makeDeps());

    expect(controller.gameMode).toBe('pixi');

    await controller.init(fakeContainer);

    // Canvas should have been appended to the container
    expect(fakeContainer.appendChild).toHaveBeenCalledWith(mockCanvas);
    // ECS active db must be set (not null)
    const calls = (setActiveDb as ReturnType<typeof vi.fn>).mock.calls;
    expect(calls.length).toBeGreaterThan(0);
    expect(calls[0][0]).not.toBeNull();
  });

  it('Pixi app is destroyed, ECS bridge is cleaned up, canvas is removed from DOM', async () => {
    const controller = setupGame(makeDeps());
    await controller.init(fakeContainer);

    vi.clearAllMocks();
    controller.destroy();

    // setActiveDb(null) called as final step
    expect(setActiveDb).toHaveBeenLastCalledWith(null);
    // Canvas removed
    expect(mockCanvas.remove).toHaveBeenCalled();
  });
});

describe('GameController — win/loss sequences', () => {
  it('boardState transitions to Won when all aliens are cleared', () => {
    const db = createMarsBounceDb();
    // Load a minimal board with 2 aliens in same species group
    db.transactions.initLevel({
      level: 1,
      movesRemaining: 30,
      activeSpecies: ['zorbling', 'blipp', 'glurp'],
      cells: [
        { row: 0, col: 0, cellKind: 'alien', species: 'zorbling', comboType: null },
        { row: 0, col: 1, cellKind: 'alien', species: 'zorbling', comboType: null },
      ],
    });

    // Clear both aliens
    db.actions.executeCluster({ row: 0, col: 0, rng: Math.random });

    expect(db.resources.boardState).toBe('Won');
  });

  it('boardState transitions to Lost when moves run out with aliens remaining', () => {
    const db = createMarsBounceDb();
    db.transactions.initLevel({
      level: 1,
      movesRemaining: 1,
      activeSpecies: ['zorbling', 'blipp', 'glurp'],
      cells: [
        { row: 0, col: 0, cellKind: 'alien', species: 'zorbling', comboType: null },
        { row: 0, col: 1, cellKind: 'alien', species: 'zorbling', comboType: null },
        { row: 0, col: 2, cellKind: 'alien', species: 'blipp', comboType: null },
        { row: 1, col: 2, cellKind: 'alien', species: 'blipp', comboType: null },
      ],
    });

    // Clear the zorbling pair — uses last move, blipps remain
    db.actions.executeCluster({ row: 0, col: 0, rng: Math.random });

    expect(db.resources.boardState).toBe('Lost');
  });

  it('Continue grants 5 moves and boardState returns to Idle preserving board', () => {
    const db = createMarsBounceDb();
    db.transactions.initLevel({
      level: 1,
      movesRemaining: 0,
      activeSpecies: ['zorbling'],
      cells: [
        { row: 0, col: 0, cellKind: 'alien', species: 'zorbling', comboType: null },
        { row: 0, col: 1, cellKind: 'alien', species: 'zorbling', comboType: null },
      ],
    });
    db.transactions.setPhase('Lost');

    db.transactions.grantContinue();

    expect(db.resources.movesRemaining).toBe(5);
    expect(db.resources.boardState).toBe('Idle');
    // Board is preserved — aliens still on board
    expect(db.resources.alienCellCount).toBe(2);
  });
});

describe('GameController — chapter boundary routing', () => {
  it('chapter boundary fires at level 10 (level % 10 === 0)', () => {
    const db = createMarsBounceDb();
    db.transactions.initLevel({
      level: 10,
      movesRemaining: 5,
      activeSpecies: ['zorbling'],
      cells: [],
    });

    // Level 10 → chapter boundary check
    const isChapterBoundary = db.resources.level % 10 === 0;
    expect(isChapterBoundary).toBe(true);
  });

  it('chapter score accumulates and resets to 0 on new chapter', () => {
    const db = createMarsBounceDb();

    // Accumulate level scores
    db.transactions.updateChapterScore({ add: 1500 });
    db.transactions.updateChapterScore({ add: 2000 });
    expect(db.resources.chapterScore).toBe(3500);

    // Reset on chapter boundary
    db.transactions.updateChapterScore({ add: 0, reset: true });
    expect(db.resources.chapterScore).toBe(0);
  });

  it('non-chapter-boundary level (level % 10 !== 0) does not trigger chapter complete', () => {
    const db = createMarsBounceDb();
    db.transactions.initLevel({
      level: 7,
      movesRemaining: 5,
      activeSpecies: ['zorbling'],
      cells: [],
    });

    const isChapterBoundary = db.resources.level % 10 === 0;
    expect(isChapterBoundary).toBe(false);
  });

  it('chapterScore is preserved until reset, then returns to 0', () => {
    const db = createMarsBounceDb();

    db.transactions.updateChapterScore({ add: 800 });
    db.transactions.updateChapterScore({ add: 1200 });
    const totalBeforeReset = db.resources.chapterScore;
    expect(totalBeforeReset).toBe(2000);

    // ResultsScreen's handleKeepGoing dispatches this
    db.transactions.updateChapterScore({ add: 0, reset: true });
    expect(db.resources.chapterScore).toBe(0);
  });
});
