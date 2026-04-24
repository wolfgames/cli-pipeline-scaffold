/**
 * LevelGenerator — procedural board generation for Mars Bounce.
 *
 * Algorithm (per GDD):
 *   1. Seed = levelNumber × 12345
 *   2. Difficulty profile selection (species count, move limit, planet count)
 *   3. Grid population (left-to-right, top-to-bottom, max 4 consecutive same-species)
 *   4. Planet placement (levels 11+)
 *   5. Solvability validation (up to 10 retries, then fallback)
 *
 * Deterministic: same seed → same board across devices and sessions.
 */

import type { Species, CellKind } from '../state/types';
import { validateBoard, type BoardCell, type ValidationResult } from './SolvabilityValidator';

const ROWS = 9;
const COLS = 7;
const MAX_RETRIES = 10;

const ALL_SPECIES: Species[] = ['zorbling', 'blipp', 'glurp', 'yipp', 'plonk'];

export interface LevelData {
  cells: BoardCell[];
  movesRemaining: number;
  activeSpecies: Species[];
  validation: ValidationResult;
}

/** Minimal seeded LCG RNG — same sequence on all platforms. */
function createRng(seed: number): () => number {
  let state = seed | 0;
  return () => {
    // LCG: multiplier 1664525, increment 1013904223 (Numerical Recipes)
    state = (Math.imul(state, 1664525) + 1013904223) | 0;
    return (state >>> 0) / 0x100000000;
  };
}

interface DifficultyProfile {
  activeSpecies: Species[];
  movesRemaining: number;
  planetCount: number;
  bouncePlanetCount: number;
}

function selectProfile(levelNumber: number, rng: () => number): DifficultyProfile {
  const baseSpeciesCount =
    levelNumber <= 10 ? 3 : levelNumber <= 30 ? 4 : 5;

  const activeSpecies = ALL_SPECIES.slice(0, baseSpeciesCount);

  // Move limit bands per GDD
  let moveBase: number;
  if (levelNumber <= 10) {
    moveBase = 30;
  } else if (levelNumber <= 30) {
    moveBase = 20 + Math.floor(rng() * 11); // 20–30
  } else {
    moveBase = 10 + Math.floor(rng() * 16); // 10–25
  }

  // Breathing room: every 5th level gets +5 moves
  const movesRemaining = levelNumber % 5 === 0 ? moveBase + 5 : moveBase;

  const planetCount =
    levelNumber <= 10 ? 0 :
    levelNumber <= 30 ? 1 + Math.floor(rng() * 3) :
    3 + Math.floor(rng() * 4);

  const bouncePlanetCount =
    levelNumber <= 10 ? 0 :
    levelNumber <= 30 ? Math.floor(rng() * 2) :
    1 + Math.floor(rng() * 3);

  return { activeSpecies, movesRemaining, planetCount, bouncePlanetCount };
}

/** Populate grid left-to-right, top-to-bottom; no more than 4 consecutive same-species. */
function populateGrid(activeSpecies: Species[], rng: () => number): BoardCell[] {
  const cells: BoardCell[] = [];
  const grid: (Species | '')[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => '' as Species | ''),
  );

  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      let species: Species;
      let attempts = 0;

      do {
        species = activeSpecies[Math.floor(rng() * activeSpecies.length)];
        attempts++;
        if (attempts > 20) break; // safety exit
      } while (consecutiveCount(grid, r, c, species) >= 4);

      grid[r][c] = species;
      cells.push({ row: r, col: c, cellKind: 'alien', species });
    }
  }

  return cells;
}

/** Count consecutive same-species cells in both row (leftward) and col (upward). */
function consecutiveCount(grid: (Species | '')[][], row: number, col: number, species: Species): number {
  let rowCount = 0;
  for (let c = col - 1; c >= 0 && grid[row][c] === species; c--) rowCount++;

  let colCount = 0;
  for (let r = row - 1; r >= 0 && grid[r]?.[col] === species; r--) colCount++;

  return Math.max(rowCount, colCount);
}

/** Place rocky and bounce planets, replacing alien cells. */
function placePlanets(
  cells: BoardCell[],
  planetCount: number,
  bouncePlanetCount: number,
  rng: () => number,
): BoardCell[] {
  const result = [...cells];
  const occupied = new Set<string>();

  const placePlanet = (kind: CellKind) => {
    let attempts = 0;
    while (attempts < 100) {
      const r = Math.floor(rng() * (ROWS - 2)); // not in bottom 2 rows
      const c = Math.floor(rng() * COLS);
      const key = `${r},${c}`;

      if (occupied.has(key)) { attempts++; continue; }

      // Check 2-cell spacing from other planets
      let tooClose = false;
      for (const k of occupied) {
        const [pr, pc] = k.split(',').map(Number);
        if (Math.abs(pr - r) <= 1 && Math.abs(pc - c) <= 1) { tooClose = true; break; }
      }
      if (tooClose) { attempts++; continue; }

      occupied.add(key);
      const idx = result.findIndex((cell) => cell.row === r && cell.col === c);
      if (idx !== -1) {
        result[idx] = { ...result[idx], cellKind: kind, species: '' };
      }
      return;
    }
  };

  for (let i = 0; i < planetCount; i++) placePlanet('rocky');
  for (let i = 0; i < bouncePlanetCount; i++) placePlanet('bounce');

  return result;
}

export class LevelGenerator {
  /** Generate a level from the given levelNumber and optional seed override. */
  generate({ levelNumber, seed }: { levelNumber: number; seed?: number }): LevelData {
    const baseSeed = seed ?? levelNumber * 12345;

    for (let retry = 0; retry <= MAX_RETRIES; retry++) {
      const rng = createRng(baseSeed + retry);
      const profile = selectProfile(levelNumber, rng);
      let cells = populateGrid(profile.activeSpecies, rng);

      if (profile.planetCount > 0 || profile.bouncePlanetCount > 0) {
        cells = placePlanets(cells, profile.planetCount, profile.bouncePlanetCount, rng);
      }

      const validation = validateBoard(cells);

      if (validation.valid) {
        return { cells, movesRemaining: profile.movesRemaining, activeSpecies: profile.activeSpecies, validation };
      }
    }

    // All retries failed — use fallback
    return this.generateFallback(baseSeed);
  }

  /**
   * Fallback board: 3 species, 35 moves, no planets.
   * Always valid per GDD guarantee.
   */
  generateFallback(seed?: number): LevelData {
    const rng = createRng(seed ?? 12345);
    const activeSpecies = ALL_SPECIES.slice(0, 3);
    const cells = populateGrid(activeSpecies, rng);
    const validation = validateBoard(cells);

    return { cells, movesRemaining: 35, activeSpecies, validation };
  }
}
