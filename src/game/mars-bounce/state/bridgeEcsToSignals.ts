/**
 * bridgeEcsToSignals — subscribes to Mars Bounce ECS resources and writes
 * derived values to SolidJS signals for DOM screen reactivity.
 *
 * Also bridges game-over navigation: observes boardState Won/Lost and calls
 * the optional goto callback to transition to the results screen.
 *
 * Returns an unsubscribe function. Call it before destroying the ECS database.
 */

import type { MarsBounceDatabase } from './MarsBouncePlugin';
import { gameState } from '~/game/state';

type Unobserve = () => void;

export interface BridgeOptions {
  /** Navigate to a screen when boardState transitions to Won or Lost. */
  goto?: (screen: string) => void;
}

export function bridgeEcsToSignals(db: MarsBounceDatabase, options?: BridgeOptions): Unobserve {
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

  // boardState Won/Lost → persist result in gameState, then navigate to results screen
  if (options?.goto) {
    const navigate = options.goto;
    cleanups.push(
      db.observe.resources.boardState((state) => {
        if (state === 'Won') {
          gameState.setLastResult('win');
          queueMicrotask(() => navigate('results'));
        } else if (state === 'Lost') {
          gameState.setLastResult('loss');
          queueMicrotask(() => navigate('results'));
        }
      }),
    );
  }

  return () => {
    for (const fn of cleanups) fn();
  };
}
