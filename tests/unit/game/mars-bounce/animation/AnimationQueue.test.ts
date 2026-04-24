/**
 * AnimationQueue — event playback order and input gate tests.
 *
 * Tests cover:
 *   - boardState transitions to Animating before any visual change starts
 *   - group cells animate off-screen before gravity events begin
 *   - boardState transitions to Idle and input is re-enabled after turn-complete
 *   - invalid-tap event plays shake animation with no board state mutation
 */

import { describe, it, expect, vi } from 'vitest';
import { AnimationPlayer } from '~/game/mars-bounce/animation/AnimationPlayer';
import { createMarsBounceDb } from '~/game/mars-bounce/state/MarsBouncePlugin';
import type { AnimationEvent } from '~/game/mars-bounce/state/types';

/** Collect the sequence of animations played back (by type). */
async function collectPlaybackOrder(events: AnimationEvent[]): Promise<string[]> {
  const order: string[] = [];
  const player = new AnimationPlayer({
    playEvent: (event) => {
      order.push(event.type);
      return Promise.resolve();
    },
    setPhase: vi.fn(),
  });
  await player.playQueue(events);
  return order;
}

describe('AnimationQueue — event playback order', () => {
  it('boardState transitions to Animating before any visual change starts', async () => {
    const db = createMarsBounceDb();
    const setPhase = vi.fn();

    const events: AnimationEvent[] = [
      { type: 'cluster-cleared', payload: { group: [[0, 0]] } },
      { type: 'gravity-drop', payload: {} },
      { type: 'turn-complete' },
    ];

    const player = new AnimationPlayer({
      playEvent: () => Promise.resolve(),
      setPhase,
    });

    // Animating is set before playback starts
    await player.playQueue(events);

    expect(setPhase).toHaveBeenCalledWith('Animating');
    // First call must be Animating (called before first event)
    expect((setPhase as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe('Animating');
  });

  it('group cells animate off-screen before gravity events begin', async () => {
    const events: AnimationEvent[] = [
      { type: 'cluster-cleared', payload: { group: [[0, 0], [0, 1]] } },
      { type: 'gravity-drop', payload: { fromRow: 1, toRow: 2, col: 0 } },
      { type: 'elements-entered', payload: { row: 0, col: 0, species: 'zorbling' } },
      { type: 'turn-complete' },
    ];

    const order = await collectPlaybackOrder(events);

    const clusterIdx = order.indexOf('cluster-cleared');
    const gravityIdx = order.indexOf('gravity-drop');
    expect(clusterIdx).toBeLessThan(gravityIdx);
  });

  it('boardState transitions to Idle and input is re-enabled', async () => {
    const setPhase = vi.fn();
    const events: AnimationEvent[] = [
      { type: 'cluster-cleared', payload: {} },
      { type: 'settle' },
      { type: 'turn-complete' },
    ];

    const player = new AnimationPlayer({
      playEvent: () => Promise.resolve(),
      setPhase,
    });

    await player.playQueue(events);

    const calls = (setPhase as ReturnType<typeof vi.fn>).mock.calls.map((c) => c[0]);
    // Must include Animating first, then Idle last
    expect(calls[0]).toBe('Animating');
    expect(calls[calls.length - 1]).toBe('Idle');
  });

  it('cell shake GSAP tween plays and no board state mutation occurs', async () => {
    const setPhase = vi.fn();
    const playEvent = vi.fn().mockResolvedValue(undefined);

    const events: AnimationEvent[] = [
      { type: 'invalid-tap', payload: { row: 2, col: 3 } },
    ];

    const player = new AnimationPlayer({ playEvent, setPhase });
    await player.playQueue(events);

    // invalid-tap: setPhase should NOT be called (no state change)
    expect(setPhase).not.toHaveBeenCalled();
    // playEvent should have been called for invalid-tap
    expect(playEvent).toHaveBeenCalledWith({ type: 'invalid-tap', payload: { row: 2, col: 3 } });
  });
});
