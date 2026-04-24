/**
 * TapHandler — wires pointertap events from the BoardRenderer to ECS actions.
 *
 * Primary interaction: single tap (per interaction-archetype.md).
 * Secondary: modal tap-then-row/col-tap for Rocket Alien direction.
 *
 * Dependency injection of playSfx and gsapTween keeps this testable in node.
 */

import type { MarsBounceDatabase } from '../state/MarsBouncePlugin';
import type { BoardRenderer } from '../renderers/BoardRenderer';
import type { AnimationEvent, CellPosition, BoardState } from '../state/types';

export interface TapHandlerOptions {
  /** Plays a named SFX. Injected so tests can spy without pixi. */
  playSfx?: (name: string) => void;
  /** GSAP tween — injected for testability. */
  gsapTween?: (target: unknown, vars: Record<string, unknown>) => void;
  /** Called with the animation event queue from valid cluster/combo actions. */
  onAnimationEvents?: (events: AnimationEvent[]) => void;
}

/** States that allow tap input. */
const IDLE_STATES: BoardState[] = ['Idle'];
/** States that process second tap for Rocket direction. */
const PENDING_DIRECTION: BoardState = 'PendingDirection';

export class TapHandler {
  private pendingRocketCell: CellPosition | null = null;
  private readonly playSfx: (name: string) => void;
  private readonly gsapTween: (target: unknown, vars: Record<string, unknown>) => void;
  private readonly onAnimationEvents: (events: AnimationEvent[]) => void;

  constructor(
    private readonly db: MarsBounceDatabase,
    private readonly boardRenderer: BoardRenderer,
    options: TapHandlerOptions = {},
  ) {
    this.playSfx = options.playSfx ?? (() => undefined);
    this.onAnimationEvents = options.onAnimationEvents ?? (() => undefined);
    this.gsapTween =
      options.gsapTween ??
      ((target, vars) => {
        // Production path: use gsap directly
        import('gsap').then(({ default: gsap }) => {
          gsap.to(target, vars);
        }).catch(() => undefined);
      });

    // Wire board renderer tap callback
    this.boardRenderer.onCellTap = (pos) => this.handleTap(pos, Math.random);
  }

  /** Handle a tap at the given cell position. Exposed for testing. */
  handleTap(pos: CellPosition, rng: () => number): void {
    const { boardState } = this.db.resources;

    // Handle pending direction (Rocket Alien second tap)
    if (boardState === PENDING_DIRECTION) {
      this.handleDirectionTap(pos, rng);
      return;
    }

    // Gate: only process taps in Idle
    if (!IDLE_STATES.includes(boardState as BoardState)) return;

    const entity = this.findEntityAt(pos.row, pos.col);
    if (!entity) return;

    const cellKind = this.db.get(entity, 'cellKind') as string;

    // Rocket: enter direction selection mode
    if (cellKind === 'rocket') {
      this.db.transactions.setPhase('PendingDirection');
      this.pendingRocketCell = pos;
      this.boardRenderer.showDirectionOverlay(pos);
      return;
    }

    // Combo pieces: activate immediately
    if (cellKind === 'planet-buster' || cellKind === 'cosmic-storm') {
      const comboEvents = this.db.actions.activateCombo({ row: pos.row, col: pos.col, rng });
      if (comboEvents?.length) this.onAnimationEvents(comboEvents as AnimationEvent[]);
      return;
    }

    // Rocky: silently ignore (it is not an interactive alien)
    if (cellKind === 'rocky' || cellKind === 'empty') return;

    // Alien (or bounce): executeCluster
    const events = this.db.actions.executeCluster({ row: pos.row, col: pos.col, rng });

    // If invalid tap (group too small), show shake + SFX
    if (events[0]?.type === 'invalid-tap') {
      const cellGraphic = this.boardRenderer.cellGraphics[pos.row]?.[pos.col];
      if (cellGraphic) {
        this.gsapTween(cellGraphic, {
          x: '+=4',
          repeat: 5,
          yoyo: true,
          duration: 0.05,
          ease: 'none',
        });
      }
      this.playSfx('thud');
      // Pass invalid-tap event to animation player for shake feedback
      this.onAnimationEvents(events as AnimationEvent[]);
      return;
    }

    // Valid cluster — pass full event queue to AnimationPlayer
    if (events?.length) this.onAnimationEvents(events as AnimationEvent[]);
  }

  /** Resolve direction tap while in pending-direction state. */
  private handleDirectionTap(pos: CellPosition, rng: () => number): void {
    if (!this.pendingRocketCell) return;

    const { row: rocketRow, col: rocketCol } = this.pendingRocketCell;

    // Cancel: tap the rocket cell again
    if (pos.row === rocketRow && pos.col === rocketCol) {
      this.db.transactions.setPhase('Idle');
      this.boardRenderer.hideDirectionOverlay();
      this.pendingRocketCell = null;
      return;
    }

    // Resolve direction: row or col
    const direction = pos.row === rocketRow ? 'row' : 'col';

    this.boardRenderer.hideDirectionOverlay();
    this.pendingRocketCell = null;

    const rocketEvents = this.db.actions.activateCombo({ row: rocketRow, col: rocketCol, direction, rng });
    if (rocketEvents?.length) this.onAnimationEvents(rocketEvents as AnimationEvent[]);
  }

  /** Look up entity at a board position. Returns entity ID or null. */
  private findEntityAt(row: number, col: number): number | null {
    for (const entity of this.db.select(['cellKind', 'row', 'col'])) {
      const r = this.db.get(entity, 'row') as number;
      const c = this.db.get(entity, 'col') as number;
      if (r === row && c === col) return entity as unknown as number;
    }
    return null;
  }

  destroy(): void {
    this.boardRenderer.onCellTap = null;
    this.pendingRocketCell = null;
  }
}
