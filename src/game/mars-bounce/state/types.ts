/**
 * Mars Bounce — shared type definitions.
 *
 * Species and board-state literals used across plugin, renderer, and input.
 */

export type BoardState = 'Idle' | 'Animating' | 'Won' | 'Lost' | 'Paused' | 'PendingDirection';

export type Species = 'zorbling' | 'blipp' | 'glurp' | 'yipp' | 'plonk';

export type CellKind =
  | 'alien'        // standard alien — falls under gravity
  | 'rocky'        // Rocky Planet — anchored, cleared only by combo blast
  | 'bounce'       // Bounce Planet — falls, triggers on adjacent clear
  | 'rocket'       // Rocket Alien combo piece (5–6 clear)
  | 'planet-buster' // Planet Buster combo piece (7–8 clear)
  | 'cosmic-storm' // Cosmic Storm combo piece (9+ clear)
  | 'empty';

export type ComboType = 'rocket' | 'planet-buster' | 'cosmic-storm' | null;

/** Animation event types emitted by executeCluster and applyGravity. */
export type AnimationEventType =
  | 'cluster-cleared'
  | 'gravity-drop'
  | 'elements-entered'
  | 'invalid-tap'
  | 'win-sequence-start'
  | 'loss-sequence-start'
  | 'combo-activated'
  | 'bounce-planet-launched'
  | 'settle'
  | 'turn-complete';

export interface AnimationEvent {
  type: AnimationEventType;
  payload?: Record<string, unknown>;
}

/** Per-cell position on the board grid. */
export interface CellPosition {
  row: number;
  col: number;
}
