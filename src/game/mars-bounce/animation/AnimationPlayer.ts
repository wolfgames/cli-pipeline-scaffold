/**
 * AnimationPlayer — sequential event queue playback.
 *
 * Responsibilities:
 *   - Set boardState to Animating before any visual event plays
 *   - Play each AnimationEvent sequentially via the injected playEvent callback
 *   - Restore boardState to Idle when a turn-complete event is processed
 *   - Handle invalid-tap events: play animation but do NOT change boardState
 *
 * The player is dependency-injected so it can run in node test environments
 * without GSAP or Pixi.
 */

import type { AnimationEvent, BoardState } from '../state/types';

export interface AnimationPlayerOptions {
  /** Plays a single animation event. Must return a Promise that resolves when complete. */
  playEvent: (event: AnimationEvent) => Promise<void>;
  /** Sets the ECS boardState resource phase. */
  setPhase: (phase: BoardState) => void;
}

/** Events that affect boardState lifecycle (all except invalid-tap). */
const STATE_EVENTS = new Set<string>([
  'cluster-cleared',
  'gravity-drop',
  'elements-entered',
  'win-sequence-start',
  'loss-sequence-start',
  'combo-activated',
  'bounce-planet-launched',
  'settle',
  'turn-complete',
]);

export class AnimationPlayer {
  private readonly playEvent: (event: AnimationEvent) => Promise<void>;
  private readonly setPhase: (phase: BoardState) => void;

  constructor({ playEvent, setPhase }: AnimationPlayerOptions) {
    this.playEvent = playEvent;
    this.setPhase = setPhase;
  }

  /**
   * Play a queue of animation events sequentially.
   *
   * - If the queue contains any state events, boardState is set to Animating
   *   before the first event plays.
   * - After a turn-complete event, boardState is set to Idle.
   * - invalid-tap events play their animation but never mutate boardState.
   */
  async playQueue(events: AnimationEvent[]): Promise<void> {
    const hasStateEvents = events.some((e) => STATE_EVENTS.has(e.type));

    if (hasStateEvents) {
      this.setPhase('Animating');
    }

    for (const event of events) {
      await this.playEvent(event);

      if (event.type === 'turn-complete') {
        this.setPhase('Idle');
      }
    }
  }
}
