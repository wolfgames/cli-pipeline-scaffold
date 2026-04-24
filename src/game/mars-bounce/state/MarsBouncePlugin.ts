/**
 * Mars Bounce ECS Plugin — central game state.
 *
 * Property order is runtime-enforced:
 *   resources → archetypes → transactions → actions
 *
 * Resources:  boardState, movesRemaining, score, level, alienCellCount,
 *             activeSpecies (seeded RNG pool), chapterScore
 * Archetypes: Cell (board entity with position, kind, species, comboType)
 * Transactions: atomic mutations — setPhase, addScore, decrementMoves,
 *               replaceBoard, spawnCombo, grantContinue
 * Actions:    executeCluster, spawnAliens, applyGravity, activateCombo
 */

import { Database } from '@adobe/data/ecs';
import type { BoardState, CellKind, Species, ComboType, AnimationEvent } from './types';

// ── Plugin ───────────────────────────────────────────────────────────────────

export const marsBouncePlugin = Database.Plugin.create({
  components: {
    row:       { type: 'number', default: 0 } as const,
    col:       { type: 'number', default: 0 } as const,
    cellKind:  { type: 'string', default: 'empty' as CellKind } as const,
    species:   { type: 'string', default: '' as Species | '' } as const,
    comboType: { type: 'string', default: null as unknown as ComboType } as const,
  },

  resources: {
    boardState:     { default: 'Idle' as BoardState },
    movesRemaining: { default: 30 as number },
    score:          { default: 0 as number },
    level:          { default: 1 as number },
    alienCellCount: { default: 0 as number },
    /** JSON-serialised Species[] for current level (seeded RNG pool). */
    activeSpeciesJson: { default: '["zorbling","blipp","glurp"]' as string },
    chapterScore:   { default: 0 as number },
    /** Set by executeCluster — read by AnimationPlayer. */
    pendingRocketCell: { default: null as unknown as [number, number] | null },
  },

  archetypes: {
    Cell: ['row', 'col', 'cellKind', 'species', 'comboType'],
  },

  transactions: {
    /** Transition the board state machine. */
    setPhase(store, phase: BoardState) {
      store.resources.boardState = phase;
    },

    /** Add to score. */
    addScore(store, amount: number) {
      store.resources.score = store.resources.score + amount;
    },

    /** Decrement move counter by 1. */
    decrementMoves(store) {
      store.resources.movesRemaining = store.resources.movesRemaining - 1;
    },

    /** Grant extra moves for Continue (stub — no ad/currency plumbing in core pass). */
    grantContinue(store) {
      store.resources.movesRemaining = store.resources.movesRemaining + 5;
      store.resources.boardState = 'Idle';
    },

    /** Replace the entire board: delete all Cell entities, insert new state. */
    replaceBoard(
      store,
      cells: Array<{ row: number; col: number; cellKind: CellKind; species: Species | ''; comboType: ComboType }>,
    ) {
      // Delete all existing Cell entities
      for (const entity of store.select(['cellKind'])) {
        store.delete(entity);
      }
      // Insert new board state
      store.resources.alienCellCount = 0;
      for (const cell of cells) {
        store.archetypes.Cell.insert(cell);
        if (cell.cellKind === 'alien') {
          store.resources.alienCellCount = store.resources.alienCellCount + 1;
        }
      }
    },

    /** Initialise a fresh level: set resources and wipe board. */
    initLevel(
      store,
      args: {
        level: number;
        movesRemaining: number;
        activeSpecies: Species[];
        cells: Array<{ row: number; col: number; cellKind: CellKind; species: Species | ''; comboType: ComboType }>;
      },
    ) {
      store.resources.level = args.level;
      store.resources.movesRemaining = args.movesRemaining;
      store.resources.score = 0;
      store.resources.boardState = 'Idle';
      store.resources.activeSpeciesJson = JSON.stringify(args.activeSpecies);
      store.resources.pendingRocketCell = null;

      for (const entity of store.select(['cellKind'])) {
        store.delete(entity);
      }
      store.resources.alienCellCount = 0;
      for (const cell of args.cells) {
        store.archetypes.Cell.insert(cell);
        if (cell.cellKind === 'alien') {
          store.resources.alienCellCount = store.resources.alienCellCount + 1;
        }
      }
    },

    /** Accumulate chapter score on level win, optionally reset for new chapter. */
    updateChapterScore(store, args: { add: number; reset?: boolean }) {
      if (args.reset) {
        store.resources.chapterScore = 0;
      } else {
        store.resources.chapterScore = store.resources.chapterScore + args.add;
      }
    },
  },

  actions: {
    /**
     * Execute a tap at (row, col).
     * Returns animation events for the AnimationPlayer.
     * Pure state mutation — no Pixi, no Math.random() (uses seeded RNG from payload).
     */
    executeCluster(
      db,
      { row, col, rng }: { row: number; col: number; rng: () => number },
    ): AnimationEvent[] {
      const board = readBoard(db);
      const target = board[row]?.[col];

      if (!target || target.cellKind === 'empty' || target.cellKind === 'rocky') {
        return [{ type: 'invalid-tap', payload: { row, col } }];
      }

      // Detect combo tap
      if (
        target.cellKind === 'rocket' ||
        target.cellKind === 'planet-buster' ||
        target.cellKind === 'cosmic-storm'
      ) {
        // Combo activation handled by activateCombo action
        return [];
      }

      // Flood-fill to find connected group
      const group = floodFill(board, row, col, target.species);

      if (group.length < 2) {
        return [{ type: 'invalid-tap', payload: { row, col } }];
      }

      // Commit: transition to Animating, clear group
      db.transactions.setPhase('Animating');
      db.transactions.decrementMoves();

      const clearedEntities = group.map(([r, c]) => board[r][c]!.entity);
      const groupSize = group.length;

      // Remove cleared cells from board (replace with empty)
      let newBoard = board.map((cols) =>
        cols.map((cell) =>
          group.some(([r, c]) => r === cell.row && c === cell.col)
            ? { ...cell, cellKind: 'empty' as CellKind, species: '' as '' }
            : cell,
        ),
      );

      // Bounce Planet activation: any Bounce Planet adjacent to cleared group fires
      const bounceEvents: AnimationEvent[] = [];
      const clearedSet = new Set(group.map(([r, c]) => `${r},${c}`));
      const dirs: Array<[number, number]> = [[-1, 0], [1, 0], [0, -1], [0, 1]];
      const firedBounce = new Set<string>();

      for (const [gr, gc] of group) {
        for (const [dr, dc] of dirs) {
          const br = gr + dr;
          const bc = gc + dc;
          const bkey = `${br},${bc}`;
          if (!firedBounce.has(bkey) && !clearedSet.has(bkey)) {
            const bounceCell = newBoard[br]?.[bc];
            if (bounceCell?.cellKind === 'bounce') {
              firedBounce.add(bkey);
              // Choose a random cardinal direction
              const dirIdx = Math.floor(rng() * 4);
              const [ddr, ddc] = dirs[dirIdx];
              // Compute path: clear first alien row or column encountered
              const pathCells: Array<[number, number]> = [];
              let pr = br + ddr;
              let pc = bc + ddc;
              while (pr >= 0 && pr < newBoard.length && pc >= 0 && pc < newBoard[0].length) {
                if (newBoard[pr][pc].cellKind === 'alien') {
                  pathCells.push([pr, pc]);
                  break; // first alien hit — Bounce clears one row/col segment
                }
                pr += ddr;
                pc += ddc;
              }
              // Clear Bounce Planet and path cells
              newBoard = newBoard.map((cols) =>
                cols.map((cell) => {
                  if (cell.row === br && cell.col === bc) {
                    return { ...cell, cellKind: 'empty' as CellKind, species: '' as '' };
                  }
                  if (pathCells.some(([pr2, pc2]) => pr2 === cell.row && pc2 === cell.col)) {
                    return { ...cell, cellKind: 'empty' as CellKind, species: '' as '' };
                  }
                  return cell;
                }),
              );
              bounceEvents.push({
                type: 'bounce-planet-launched',
                payload: { row: br, col: bc, direction: dirIdx, pathCells },
              });
            }
          }
        }
      }

      // Apply gravity (skip refill on first pass to enable win-check before spawn)
      const { finalBoard: postDropBoard, gravityEvents } = applyGravity(newBoard, db, rng, true);

      // Scoring
      const cascadeDepth = gravityEvents.filter((e) => e.type === 'gravity-drop').length > 0 ? 1 : 0;
      const groupScore = (groupSize - 1) * 100;
      const cascadeMultiplier = cascadeDepth + 1;
      const turnScore = groupScore * cascadeMultiplier;
      db.transactions.addScore(turnScore);

      // Spawn combo piece if threshold met
      const comboEvents = spawnComboIfEarned(db, groupSize, group, rng);

      // Check win / loss BEFORE refill (win = no aliens remain after drop)
      const alienCountAfterDrop = countAliens(postDropBoard);
      const newMoves = db.resources.movesRemaining;

      let endEvent: AnimationEvent | null = null;

      if (alienCountAfterDrop === 0) {
        // Win: board cleared — do not refill
        db.transactions.setPhase('Won');
        endEvent = { type: 'win-sequence-start' };
      } else {
        // Refill columns now that we know it's not a win
        const { gravityEvents: refillEvents } = applyGravity(postDropBoard, db, rng);
        gravityEvents.push(...refillEvents);

        if (newMoves <= 0) {
          db.transactions.setPhase('Lost');
          endEvent = { type: 'loss-sequence-start' };
        } else {
          db.transactions.setPhase('Idle');
        }
      }

      return [
        { type: 'cluster-cleared', payload: { entities: clearedEntities, group } },
        ...bounceEvents,
        ...gravityEvents,
        ...comboEvents,
        { type: 'settle' },
        ...(endEvent ? [endEvent] : []),
        { type: 'turn-complete' },
      ];
    },

    /** Activate a combo piece at (row, col). */
    activateCombo(
      db,
      { row, col, direction, rng }: { row: number; col: number; direction?: 'row' | 'col'; rng: () => number },
    ): AnimationEvent[] {
      const board = readBoard(db);
      const cell = board[row]?.[col];
      if (!cell) return [];

      db.transactions.setPhase('Animating');
      db.transactions.decrementMoves();
      db.transactions.addScore(500); // comboBonus

      const affected: Array<[number, number]> = [];

      if (cell.cellKind === 'rocket' && direction) {
        if (direction === 'col') {
          for (let r = 0; r < board.length; r++) affected.push([r, col]);
        } else {
          for (let c = 0; c < board[0].length; c++) affected.push([row, c]);
        }
      } else if (cell.cellKind === 'planet-buster') {
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const r = row + dr;
            const c = col + dc;
            if (r >= 0 && r < board.length && c >= 0 && c < board[0].length) {
              affected.push([r, c]);
            }
          }
        }
      } else if (cell.cellKind === 'cosmic-storm') {
        const activeSpecies: Species[] = JSON.parse(db.resources.activeSpeciesJson);
        const targetSpecies = activeSpecies[Math.floor(rng() * activeSpecies.length)];
        for (let r = 0; r < board.length; r++) {
          for (let c = 0; c < board[0].length; c++) {
            if (board[r][c]?.species === targetSpecies) affected.push([r, c]);
          }
        }
      }

      // Clear affected cells
      const newBoard = board.map((cols) =>
        cols.map((c) =>
          affected.some(([r2, c2]) => r2 === c.row && c2 === c.col && c.cellKind !== 'rocky')
            ? { ...c, cellKind: 'empty' as CellKind, species: '' as '' }
            : c,
        ),
      );

      // Apply gravity without refill to enable win-check before spawn
      const { finalBoard: postDropBoard, gravityEvents } = applyGravity(newBoard, db, rng, true);
      const alienCountAfterDrop = countAliens(postDropBoard);
      const newMoves = db.resources.movesRemaining;

      let endEvent: AnimationEvent | null = null;
      if (alienCountAfterDrop === 0) {
        db.transactions.setPhase('Won');
        endEvent = { type: 'win-sequence-start' };
      } else {
        const { gravityEvents: refillEvents } = applyGravity(postDropBoard, db, rng);
        gravityEvents.push(...refillEvents);

        if (newMoves <= 0) {
          db.transactions.setPhase('Lost');
          endEvent = { type: 'loss-sequence-start' };
        } else {
          db.transactions.setPhase('Idle');
        }
      }

      return [
        { type: 'combo-activated', payload: { comboType: cell.cellKind, affected } },
        ...gravityEvents,
        { type: 'settle' },
        ...(endEvent ? [endEvent] : []),
        { type: 'turn-complete' },
      ];
    },
  },
});

// ── Type ─────────────────────────────────────────────────────────────────────

export type MarsBounceDatabase = Database.FromPlugin<typeof marsBouncePlugin>;

/** Factory — create a fresh database with the Mars Bounce plugin. */
export const createMarsBounceDb = (): MarsBounceDatabase =>
  Database.create(marsBouncePlugin);

// ── Internal helpers ──────────────────────────────────────────────────────────

type BoardCell = {
  entity: number;
  row: number;
  col: number;
  cellKind: CellKind;
  species: Species | '';
  comboType: ComboType;
};

type Board = BoardCell[][];

/** Read all Cell entities into a 2D row×col array. */
function readBoard(db: MarsBounceDatabase): Board {
  const rows = 9;
  const cols = 7;
  const board: Board = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      entity: -1,
      row: r,
      col: c,
      cellKind: 'empty' as CellKind,
      species: '' as '',
      comboType: null,
    })),
  );

  for (const entity of db.select(['cellKind', 'row', 'col'])) {
    const r = db.get(entity, 'row') as number;
    const c = db.get(entity, 'col') as number;
    if (r >= 0 && r < rows && c >= 0 && c < cols && board[r]?.[c]) {
      board[r][c] = {
        entity: entity as unknown as number,
        row: r,
        col: c,
        cellKind: db.get(entity, 'cellKind') as CellKind,
        species: db.get(entity, 'species') as Species | '',
        comboType: db.get(entity, 'comboType') as ComboType,
      };
    }
  }

  return board;
}

/** BFS flood-fill: returns all [row, col] pairs in the connected same-species group. */
function floodFill(board: Board, startRow: number, startCol: number, species: Species | ''): Array<[number, number]> {
  if (!species) return [];
  const visited = new Set<string>();
  const result: Array<[number, number]> = [];
  const queue: Array<[number, number]> = [[startRow, startCol]];

  while (queue.length > 0) {
    const [r, c] = queue.shift()!;
    const key = `${r},${c}`;
    if (visited.has(key)) continue;
    visited.add(key);

    const cell = board[r]?.[c];
    if (!cell || cell.cellKind !== 'alien' || cell.species !== species) continue;

    result.push([r, c]);
    queue.push([r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]);
  }

  return result;
}

/**
 * Apply gravity: drop non-rocky cells down, optionally refill columns from top.
 * Pass skipRefill=true to check win condition before spawning new aliens.
 */
function applyGravity(
  board: Board,
  db: MarsBounceDatabase,
  rng: () => number,
  skipRefill = false,
): { finalBoard: Board; gravityEvents: AnimationEvent[] } {
  const rows = board.length;
  const cols = board[0].length;
  const activeSpecies: Species[] = JSON.parse(db.resources.activeSpeciesJson);
  const gravityEvents: AnimationEvent[] = [];

  const newBoard: Board = board.map((rowArr) => rowArr.map((cell) => ({ ...cell })));

  for (let c = 0; c < cols; c++) {
    // Collect non-empty, non-rocky cells top-to-bottom
    const falling: BoardCell[] = [];
    const rocky: Array<[number, BoardCell]> = [];

    for (let r = 0; r < rows; r++) {
      const cell = newBoard[r][c];
      if (cell.cellKind === 'rocky') {
        rocky.push([r, cell]);
      } else if (cell.cellKind !== 'empty') {
        falling.push({ ...cell });
      }
    }

    // Clear column
    for (let r = 0; r < rows; r++) {
      newBoard[r][c] = { entity: -1, row: r, col: c, cellKind: 'empty', species: '', comboType: null };
    }

    // Replace rocky cells
    for (const [r, cell] of rocky) {
      newBoard[r][c] = cell;
    }

    // Stack falling cells from bottom
    let bottom = rows - 1;
    for (let i = falling.length - 1; i >= 0; i--) {
      // Find next available non-rocky slot from bottom
      while (bottom >= 0 && newBoard[bottom][c].cellKind !== 'empty') bottom--;
      if (bottom < 0) break;

      const fromRow = falling[i].row;
      newBoard[bottom][c] = { ...falling[i], row: bottom, col: c };

      if (fromRow !== bottom) {
        gravityEvents.push({
          type: 'gravity-drop',
          payload: { entity: falling[i].entity, fromRow, toRow: bottom, col: c },
        });
      }
      bottom--;
    }

    // Fill empty slots from top with new aliens (skipped on win-check pass)
    if (!skipRefill) {
      for (let r = 0; r < rows; r++) {
        if (newBoard[r][c].cellKind === 'empty') {
          const species = activeSpecies[Math.floor(rng() * activeSpecies.length)];
          newBoard[r][c] = { entity: -1, row: r, col: c, cellKind: 'alien', species, comboType: null };
          gravityEvents.push({
            type: 'elements-entered',
            payload: { row: r, col: c, species },
          });
        }
      }
    }
  }

  // Commit new board state to ECS
  const allCells = newBoard.flat().map((cell) => ({
    row: cell.row,
    col: cell.col,
    cellKind: cell.cellKind,
    species: cell.species as Species | '',
    comboType: cell.comboType,
  }));
  db.transactions.replaceBoard(allCells as any);

  return { finalBoard: newBoard, gravityEvents };
}

/** Count alien cells on a board (used for win-check). */
function countAliens(board: Board): number {
  return board.flat().filter((c) => c.cellKind === 'alien').length;
}

/** Spawn combo piece if group size meets a threshold. Returns animation events. */
function spawnComboIfEarned(
  db: MarsBounceDatabase,
  groupSize: number,
  group: Array<[number, number]>,
  rng: () => number,
): AnimationEvent[] {
  if (groupSize < 5) return [];

  const comboType: CellKind =
    groupSize >= 9 ? 'cosmic-storm' : groupSize >= 7 ? 'planet-buster' : 'rocket';

  // Pick a random cell from cleared group's column
  const spawnIdx = Math.floor(rng() * group.length);
  const [spawnRow, spawnCol] = group[spawnIdx];

  // Insert into ECS (entity ID assigned by store)
  db.store.archetypes.Cell.insert({
    row: spawnRow,
    col: spawnCol,
    cellKind: comboType,
    species: '' as '',
    comboType: comboType as unknown as ComboType,
  });

  return [
    { type: 'combo-activated', payload: { comboType, spawnRow, spawnCol } },
  ];
}
