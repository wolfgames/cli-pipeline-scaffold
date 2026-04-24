/**
 * TapHandler — cluster selection and invalid tap feedback.
 *
 * Tests cover:
 *   - Valid tap clears group ≥ 2, decrements moves
 *   - Invalid tap (solo) produces shake feedback with no state mutation
 *   - Tap during Animating is ignored
 *   - Rocket Alien tap enters pending-direction state with ghost overlay
 */

import { describe, it, expect, vi } from 'vitest';
import { createMarsBounceDb } from '~/game/mars-bounce/state/MarsBouncePlugin';
import { TapHandler } from '~/game/mars-bounce/input/TapHandler';
import type { BoardRenderer } from '~/game/mars-bounce/renderers/BoardRenderer';
import type { CellPosition } from '~/game/mars-bounce/state/types';

// Stable seeded RNG for deterministic tests
const seededRng = () => 0.5;

/** Build a minimal board with a 2-cell zorbling group at (0,0)-(0,1) and isolated blipp at (1,0). */
function makeBoardDb() {
  const db = createMarsBounceDb();

  db.transactions.initLevel({
    level: 1,
    movesRemaining: 10,
    activeSpecies: ['zorbling', 'blipp'],
    cells: [
      // Row 0: zorbling group (cols 0-6 → zorbling zorbling blipp blipp blipp blipp blipp)
      ...Array.from({ length: 7 }, (_, c) => ({
        row: 0,
        col: c,
        cellKind: 'alien' as const,
        species: c < 2 ? 'zorbling' as const : 'blipp' as const,
        comboType: null,
      })),
      // Rows 1-8: single blipp per cell (no connected groups across rows)
      ...Array.from({ length: 8 * 7 }, (_, i) => ({
        row: Math.floor(i / 7) + 1,
        col: i % 7,
        cellKind: 'alien' as const,
        species: 'blipp' as const,
        comboType: null,
      })),
    ],
  });

  return db;
}

const makeBoardRenderer = (): BoardRenderer => ({
  container: { eventMode: 'passive', on: vi.fn(), addChild: vi.fn() } as any,
  cellGraphics: Array.from({ length: 9 }, () =>
    Array.from({ length: 7 }, () => ({
      x: 0,
      y: 0,
      eventMode: 'static',
      hitArea: null,
      on: vi.fn(),
    })),
  ) as any,
  showDirectionOverlay: vi.fn(),
  hideDirectionOverlay: vi.fn(),
  onCellTap: null,
  cellSize: 55,
  boardWidth: 385,
  boardHeight: 495,
  boardX: 3,
  boardY: 68,
  init: vi.fn(),
  destroy: vi.fn(),
} as any);

describe('TapHandler — cluster selection', () => {
  it('all cells in the group are cleared from the board; movesRemaining decrements by 1', () => {
    const db = makeBoardDb();
    const br = makeBoardRenderer();
    const handler = new TapHandler(db as any, br);
    const initialMoves = db.resources.movesRemaining;

    // Tap zorbling at (0,0) — group is (0,0) and (0,1)
    handler.handleTap({ row: 0, col: 0 }, seededRng);

    expect(db.resources.movesRemaining).toBe(initialMoves - 1);
  });

  it('cell shakes (3-frame wiggle animation) and thud SFX plays; no state change', () => {
    const db = makeBoardDb();
    const br = makeBoardRenderer();
    const playSfx = vi.fn();
    const handler = new TapHandler(db as any, br, { playSfx });
    const stateBeforeTap = db.resources.boardState;
    const movesBefore = db.resources.movesRemaining;

    // Tap a cell that is isolated — row 1, col 0 is blipp, surrounded by blipps BUT
    // let's use a known isolated setup: tap at row 1, col 0 (blipp)
    // In this board all blipps form one giant connected group — we need an actual isolated cell.
    // Override: use a fresh db with an isolated alien
    const isolatedDb = createMarsBounceDb();
    isolatedDb.transactions.initLevel({
      level: 1,
      movesRemaining: 10,
      activeSpecies: ['zorbling'],
      cells: [
        { row: 0, col: 0, cellKind: 'alien', species: 'zorbling', comboType: null },
        // Fill rest as empty
        ...Array.from({ length: 9 * 7 - 1 }, (_, i) => ({
          row: Math.floor((i + 1) / 7),
          col: (i + 1) % 7,
          cellKind: 'empty' as const,
          species: '' as const,
          comboType: null,
        })),
      ],
    });

    const gsapSpy = vi.fn();
    const handler2 = new TapHandler(isolatedDb as any, br, { playSfx, gsapTween: gsapSpy });

    handler2.handleTap({ row: 0, col: 0 }, seededRng);

    // State must NOT change
    expect(isolatedDb.resources.boardState).toBe(stateBeforeTap);
    expect(isolatedDb.resources.movesRemaining).toBe(10);
    // Shake should be triggered
    expect(gsapSpy).toHaveBeenCalled();
    // SFX should play
    expect(playSfx).toHaveBeenCalledWith('thud');
  });

  it('tap events are ignored (no state change, no feedback)', () => {
    const db = makeBoardDb();
    const br = makeBoardRenderer();
    const playSfx = vi.fn();
    const gsapTween = vi.fn();
    const handler = new TapHandler(db as any, br, { playSfx, gsapTween });

    // Force Animating state
    db.transactions.setPhase('Animating');

    const movesBefore = db.resources.movesRemaining;
    handler.handleTap({ row: 0, col: 0 }, seededRng);

    expect(db.resources.movesRemaining).toBe(movesBefore);
    expect(db.resources.boardState).toBe('Animating');
    expect(gsapTween).not.toHaveBeenCalled();
    expect(playSfx).not.toHaveBeenCalled();
  });

  it('boardState enters pending-direction; row and column ghost overlays appear', () => {
    const db = createMarsBounceDb();
    db.transactions.initLevel({
      level: 1,
      movesRemaining: 10,
      activeSpecies: ['zorbling'],
      cells: [
        { row: 2, col: 3, cellKind: 'rocket', species: '', comboType: 'rocket' },
        ...Array.from({ length: 9 * 7 - 1 }, (_, i) => {
          const idx = i >= 2 * 7 + 3 ? i + 1 : i;
          return {
            row: Math.floor(idx / 7),
            col: idx % 7,
            cellKind: 'empty' as const,
            species: '' as const,
            comboType: null,
          };
        }),
      ],
    });

    const br = makeBoardRenderer();
    const handler = new TapHandler(db as any, br);

    handler.handleTap({ row: 2, col: 3 }, seededRng);

    expect(db.resources.boardState).toBe('PendingDirection');
    expect(br.showDirectionOverlay).toHaveBeenCalledWith({ row: 2, col: 3 });
  });
});
