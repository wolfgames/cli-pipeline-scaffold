/**
 * SolvabilityValidator — validates a generated board is playable.
 *
 * Rejection conditions (per GDD):
 *   1. largestGroupSize < 2 — no valid first move exists
 *   2. clearablePercent < 0.40 — fewer than 40% of aliens are in groups ≥ 2
 *   3. Any 3×3 sub-region is entirely Rocky Planet cells
 */

import type { Species, CellKind } from '../state/types';

export interface BoardCell {
  row: number;
  col: number;
  cellKind: CellKind;
  species: Species | '';
}

export interface ValidationResult {
  valid: boolean;
  largestGroupSize: number;
  clearablePercent: number;
}

const ROWS = 9;
const COLS = 7;

/** BFS flood-fill to find connected same-species group from (startRow, startCol). */
function floodFill(grid: BoardCell[][], row: number, col: number, species: Species | ''): Array<[number, number]> {
  if (!species) return [];
  const visited = new Set<string>();
  const result: Array<[number, number]> = [];
  const queue: Array<[number, number]> = [[row, col]];

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    const key = `${r},${c}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const cell = grid[r]?.[c];
    if (!cell || cell.cellKind !== 'alien' || cell.species !== species) continue;

    result.push([r, c]);
    queue.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
  }

  return result;
}

export function validateBoard(cells: BoardCell[]): ValidationResult {
  // Build 2D grid
  const grid: BoardCell[][] = Array.from({ length: ROWS }, (_, r) =>
    Array.from({ length: COLS }, (_, c) => ({
      row: r,
      col: c,
      cellKind: 'empty' as CellKind,
      species: '' as '',
    })),
  );

  for (const cell of cells) {
    if (cell.row >= 0 && cell.row < ROWS && cell.col >= 0 && cell.col < COLS) {
      grid[cell.row][cell.col] = cell;
    }
  }

  const alienCells = cells.filter((c) => c.cellKind === 'alien');
  const totalAliens = alienCells.length;

  if (totalAliens === 0) {
    return { valid: false, largestGroupSize: 0, clearablePercent: 0 };
  }

  // Find all groups via flood-fill
  const visited = new Set<string>();
  let largestGroupSize = 0;
  let clearableAliens = 0;

  for (const cell of alienCells) {
    const key = `${cell.row},${cell.col}`;
    if (visited.has(key)) continue;

    const group = floodFill(grid, cell.row, cell.col, cell.species);
    for (const [r, c] of group) {
      visited.add(`${r},${c}`);
    }

    if (group.length >= 2) {
      clearableAliens += group.length;
      largestGroupSize = Math.max(largestGroupSize, group.length);
    }
  }

  const clearablePercent = totalAliens > 0 ? clearableAliens / totalAliens : 0;

  // Check 3×3 Rocky island
  const hasRockyIsland = checkRockyIsland(grid);

  const valid =
    largestGroupSize >= 2 &&
    clearablePercent >= 0.40 &&
    !hasRockyIsland;

  return { valid, largestGroupSize, clearablePercent };
}

/** Return true if any 3×3 sub-region is entirely Rocky Planet cells. */
function checkRockyIsland(grid: BoardCell[][]): boolean {
  for (let r = 0; r <= ROWS - 3; r++) {
    for (let c = 0; c <= COLS - 3; c++) {
      let allRocky = true;
      for (let dr = 0; dr < 3 && allRocky; dr++) {
        for (let dc = 0; dc < 3 && allRocky; dc++) {
          if (grid[r + dr]?.[c + dc]?.cellKind !== 'rocky') {
            allRocky = false;
          }
        }
      }
      if (allRocky) return true;
    }
  }
  return false;
}
