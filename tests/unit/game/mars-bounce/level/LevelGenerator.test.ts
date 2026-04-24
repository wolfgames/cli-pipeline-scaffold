/**
 * LevelGenerator — board generation and solvability validation tests.
 *
 * Tests cover:
 *   - generated board contains only the expected alien species for level 1 (no planets)
 *   - solvability validation passes (largestGroupSize ≥ 2, clearablePercent ≥ 0.40)
 *   - fallback board is produced after max retries are exceeded
 */

import { describe, it, expect } from 'vitest';
import { LevelGenerator } from '~/game/mars-bounce/level/LevelGenerator';

describe('LevelGenerator — board generation', () => {
  it('board contains only 3 alien species, no planet entities, and has at least one group of size ≥ 2', () => {
    const generator = new LevelGenerator();
    const result = generator.generate({ levelNumber: 1, seed: 12345 });

    // Level 1 profile: 3 species, no planets
    const species = new Set(
      result.cells
        .filter((c) => c.cellKind === 'alien')
        .map((c) => c.species),
    );
    expect(species.size).toBeLessThanOrEqual(3);
    expect(species.size).toBeGreaterThanOrEqual(1);

    const hasPlanets = result.cells.some((c) => c.cellKind === 'rocky' || c.cellKind === 'bounce');
    expect(hasPlanets).toBe(false);

    // At least one group of size ≥ 2
    expect(result.validation.largestGroupSize).toBeGreaterThanOrEqual(2);
  });

  it('largestGroupSize ≥ 2 and clearablePercent ≥ 0.40', () => {
    const generator = new LevelGenerator();
    const result = generator.generate({ levelNumber: 1, seed: 12345 });

    expect(result.validation.largestGroupSize).toBeGreaterThanOrEqual(2);
    expect(result.validation.clearablePercent).toBeGreaterThanOrEqual(0.40);
  });

  it('fallback board is generated: 3 species, 35 moves, no planets', () => {
    const generator = new LevelGenerator();
    const fallback = generator.generateFallback();

    // Fallback: 3 species, maxMoves=35, no planets
    const species = new Set(
      fallback.cells
        .filter((c) => c.cellKind === 'alien')
        .map((c) => c.species),
    );
    expect(species.size).toBeLessThanOrEqual(3);
    expect(fallback.movesRemaining).toBe(35);

    const hasPlanets = fallback.cells.some((c) => c.cellKind === 'rocky' || c.cellKind === 'bounce');
    expect(hasPlanets).toBe(false);
  });
});
