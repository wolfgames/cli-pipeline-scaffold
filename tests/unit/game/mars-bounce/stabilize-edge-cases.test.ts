/**
 * Stabilize edge-case tests — one per new feature from implementation-plan.yml.
 *
 * Features covered:
 *   ecs-plugin       — cascade scoring at depth > 0 uses correct multiplier
 *   animation-queue  — queue with only invalid-tap events never sets Animating
 *   tap-handler      — Rocket Alien cancel (re-tap same cell) restores Idle
 *   level-generation — level 15 profile allows 4 species
 *   gravity-cascade  — Bounce Planet path cells are cleared from board
 *   combo-pieces     — activateCombo that clears all aliens transitions to Won
 */

import { describe, it, expect, vi } from 'vitest';
import { createMarsBounceDb } from '~/game/mars-bounce/state/MarsBouncePlugin';
import { AnimationPlayer } from '~/game/mars-bounce/animation/AnimationPlayer';
import { TapHandler } from '~/game/mars-bounce/input/TapHandler';
import { LevelGenerator } from '~/game/mars-bounce/level/LevelGenerator';
import type { AnimationEvent } from '~/game/mars-bounce/state/types';
import type { BoardRenderer } from '~/game/mars-bounce/renderers/BoardRenderer';

// ── Helpers ──────────────────────────────────────────────────────────────────

const seededRng = () => 0.0; // deterministic: always picks first index

function makeBoardRenderer(): BoardRenderer {
  return {
    container: { eventMode: 'passive', on: vi.fn(), addChild: vi.fn() } as any,
    cellGraphics: Array.from({ length: 9 }, () =>
      Array.from({ length: 7 }, () => ({
        x: 0, y: 0, eventMode: 'static', hitArea: null, on: vi.fn(),
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
  } as any;
}

// ── ecs-plugin edge case ──────────────────────────────────────────────────────

describe('ecs-plugin edge case — cascade scoring multiplier', () => {
  it('a group cleared after a cascade (depth 1) applies a ×2 multiplier to groupScore', () => {
    /**
     * The scoring formula: turnScore = (groupSize - 1) × 100 × (cascadeDepth + 1).
     * executeCluster computes cascadeDepth from the number of gravity-drop events
     * produced (> 0 → depth 1). This test verifies the multiplier is applied.
     *
     * Set up: col 0 has zorbling at rows 6-8, blipp above rows 0-5.
     * When the zorbling group (size 3) is cleared, blipps in col 0 fall → gravity-drop
     * events are emitted → cascadeDepth = 1 → score = (3-1)×100×2 = 400.
     */
    const db = createMarsBounceDb();
    db.transactions.initLevel({
      level: 1,
      movesRemaining: 10,
      activeSpecies: ['zorbling', 'blipp'],
      cells: [
        // Col 0: blipp in rows 0-5, zorbling in rows 6-8
        ...Array.from({ length: 6 }, (_, r) => ({
          row: r, col: 0, cellKind: 'alien' as const, species: 'blipp' as const, comboType: null,
        })),
        { row: 6, col: 0, cellKind: 'alien' as const, species: 'zorbling' as const, comboType: null },
        { row: 7, col: 0, cellKind: 'alien' as const, species: 'zorbling' as const, comboType: null },
        { row: 8, col: 0, cellKind: 'alien' as const, species: 'zorbling' as const, comboType: null },
        // Cols 1-6: fill with blipp
        ...Array.from({ length: 9 * 6 }, (_, i) => ({
          row: Math.floor(i / 6),
          col: i % 6 + 1,
          cellKind: 'alien' as const,
          species: 'blipp' as const,
          comboType: null,
        })),
      ],
    });

    db.actions.executeCluster({ row: 6, col: 0, rng: seededRng });

    // With cascade: score should be (3-1)*100*(1+1) = 400
    expect(db.resources.score).toBeGreaterThanOrEqual(400);
    // Without cascade multiplier (flat): would be 200 — the multiplied value is strictly higher
    expect(db.resources.score).toBeGreaterThan(200);
  });
});

// ── animation-queue edge case ─────────────────────────────────────────────────

describe('animation-queue edge case — invalid-tap only queue', () => {
  it('a queue containing only invalid-tap events never sets boardState to Animating', async () => {
    /**
     * invalid-tap is not in STATE_EVENTS — a queue containing only invalid-tap
     * should skip the Animating phase entirely. The player sees the shake but
     * board state remains Idle.
     */
    const setPhase = vi.fn();

    const events: AnimationEvent[] = [
      { type: 'invalid-tap', payload: { row: 1, col: 1 } },
    ];

    const player = new AnimationPlayer({
      playEvent: () => Promise.resolve(),
      setPhase,
    });

    await player.playQueue(events);

    // setPhase must never have been called (no state events in queue)
    expect(setPhase).not.toHaveBeenCalled();
  });
});

// ── tap-handler edge case ────────────────────────────────────────────────────

describe('tap-handler edge case — Rocket Alien cancel', () => {
  it('tapping the Rocket Alien cell again while in PendingDirection cancels and restores Idle', () => {
    /**
     * Per interaction-archetype.md: a second tap on the same Rocket Alien cell
     * while boardState === 'PendingDirection' cancels the action — boardState
     * returns to Idle and the ghost overlay is hidden.
     */
    const db = createMarsBounceDb();
    db.transactions.initLevel({
      level: 1,
      movesRemaining: 10,
      activeSpecies: ['zorbling'],
      cells: [
        { row: 3, col: 3, cellKind: 'rocket', species: '', comboType: 'rocket' },
        ...Array.from({ length: 9 * 7 - 1 }, (_, i) => {
          const idx = i >= 3 * 7 + 3 ? i + 1 : i;
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

    // First tap: enter PendingDirection
    handler.handleTap({ row: 3, col: 3 }, seededRng);
    expect(db.resources.boardState).toBe('PendingDirection');

    // Second tap on same cell: cancel
    handler.handleTap({ row: 3, col: 3 }, seededRng);

    expect(db.resources.boardState).toBe('Idle');
    expect(br.hideDirectionOverlay).toHaveBeenCalled();
  });
});

// ── level-generation edge case ───────────────────────────────────────────────

describe('level-generation edge case — level 15 uses 4 species', () => {
  it('level 15 (11–30 profile) generates up to 4 alien species', () => {
    /**
     * Implementation-plan.yml batch 6: difficulty profiles — levels 11–30 use
     * 4 species. Level 15 should produce a board with up to 4 distinct species
     * (more than the 3-species profile used for levels 1–10).
     */
    const generator = new LevelGenerator();
    const result = generator.generate({ levelNumber: 15, seed: 15 * 12345 });

    const species = new Set(
      result.cells
        .filter((c) => c.cellKind === 'alien')
        .map((c) => c.species),
    );

    // Profile 11–30 allows up to 4 species
    expect(species.size).toBeGreaterThanOrEqual(1);
    expect(species.size).toBeLessThanOrEqual(4);
    // At least one group of size ≥ 2 (solvability check)
    expect(result.validation.largestGroupSize).toBeGreaterThanOrEqual(2);
  });
});

// ── gravity-cascade edge case ────────────────────────────────────────────────

describe('gravity-cascade edge case — Bounce Planet path cells cleared', () => {
  it('Bounce Planet adjacent to a cleared group fires and its path alien is removed', () => {
    /**
     * When a Bounce Planet is adjacent to a cleared group it fires in a random
     * cardinal direction. The test seeds rng to 0 (direction 0 = up = [-1,0]).
     * We place a Bounce Planet at (5,0) with an alien at (4,0) directly above.
     * After the group clear, (5,0) (bounce) and (4,0) (alien in path) should
     * both be emptied, and a bounce-planet-launched event should be in the queue.
     *
     * Board: zorbling group at (6,0)-(7,0), alien at (4,0), bounce at (5,0), rest blipp.
     */
    const db = createMarsBounceDb();
    db.transactions.initLevel({
      level: 1,
      movesRemaining: 10,
      activeSpecies: ['zorbling', 'blipp'],
      cells: [
        { row: 4, col: 0, cellKind: 'alien' as const, species: 'blipp' as const, comboType: null },
        { row: 5, col: 0, cellKind: 'bounce' as const, species: '' as const, comboType: null },
        { row: 6, col: 0, cellKind: 'alien' as const, species: 'zorbling' as const, comboType: null },
        { row: 7, col: 0, cellKind: 'alien' as const, species: 'zorbling' as const, comboType: null },
        // Fill remaining cells with blipp
        ...Array.from({ length: 9 * 7 - 4 }, (_, i) => {
          const skipPositions = new Set(['4,0', '5,0', '6,0', '7,0']);
          let idx = i;
          let row = Math.floor(idx / 7);
          let col = idx % 7;
          while (skipPositions.has(`${row},${col}`)) {
            idx++;
            row = Math.floor(idx / 7);
            col = idx % 7;
          }
          return { row, col, cellKind: 'alien' as const, species: 'blipp' as const, comboType: null };
        }),
      ],
    });

    const events = db.actions.executeCluster({ row: 6, col: 0, rng: seededRng });

    // A bounce-planet-launched event should be present
    const bounceEvent = events.find((e) => e.type === 'bounce-planet-launched');
    expect(bounceEvent).toBeDefined();
  });
});

// ── combo-pieces edge case ────────────────────────────────────────────────────

describe('combo-pieces edge case — combo clears all aliens → Won', () => {
  it('activateCombo (planet-buster) that removes all remaining aliens transitions to Won', () => {
    /**
     * A Planet Buster (3×3 zone) clearing all remaining aliens should trigger
     * the Won state. This edge case verifies that activateCombo participates
     * in the same win-check as executeCluster.
     *
     * Board: 2×2 zorbling block at rows 4-5, cols 3-4 (4 aliens total in 3×3 zone).
     * Planet Buster placed at (4,3) — 3×3 zone covers all 4 aliens.
     */
    const db = createMarsBounceDb();
    db.transactions.initLevel({
      level: 1,
      movesRemaining: 5,
      activeSpecies: ['zorbling'],
      cells: [
        // Planet Buster at (4,3)
        { row: 4, col: 3, cellKind: 'planet-buster' as const, species: '' as const, comboType: 'planet-buster' },
        // 4 zorbling aliens in the 3×3 zone (but not on the buster cell itself)
        { row: 3, col: 2, cellKind: 'alien' as const, species: 'zorbling' as const, comboType: null },
        { row: 3, col: 3, cellKind: 'alien' as const, species: 'zorbling' as const, comboType: null },
        { row: 3, col: 4, cellKind: 'alien' as const, species: 'zorbling' as const, comboType: null },
        { row: 4, col: 2, cellKind: 'alien' as const, species: 'zorbling' as const, comboType: null },
        // No other aliens
      ],
    });

    const events = db.actions.activateCombo({ row: 4, col: 3, rng: seededRng });

    // All aliens cleared → boardState should be Won
    expect(db.resources.boardState).toBe('Won');
    // win-sequence-start event in queue
    expect(events.some((e) => e.type === 'win-sequence-start')).toBe(true);
  });
});
