/**
 * bridgeEcsToSignals — subscribes to Mars Bounce ECS resources and writes
 * derived values to SolidJS signals for DOM screen reactivity.
 *
 * Returns an unsubscribe function. Call it before destroying the ECS database.
 */

import type { MarsBounceDatabase } from './MarsBouncePlugin';
import { gameState } from '~/game/state';

type Unobserve = () => void;

export function bridgeEcsToSignals(db: MarsBounceDatabase): Unobserve {
  const cleanups: Unobserve[] = [];

  // Score → DOM score signal
  cleanups.push(
    db.observe.resources.score((value) => {
      gameState.setScore(value);
    }),
  );

  // Level → DOM level signal
  cleanups.push(
    db.observe.resources.level((value) => {
      gameState.setLevel(value);
    }),
  );

  return () => {
    for (const fn of cleanups) fn();
  };
}
