import { createSignal, createRoot } from 'solid-js';

/**
 * Game state that persists across screens.
 * Created in a root to avoid disposal issues.
 *
 * Add your game-specific signals here.
 * Pause state lives in core/systems/pause (scaffold feature).
 */

export interface GameState {
  score: () => number;
  setScore: (score: number) => void;
  addScore: (amount: number) => void;

  level: () => number;
  setLevel: (level: number) => void;
  incrementLevel: () => void;

  /** Last game result — 'win' | 'loss'. Set by bridgeEcsToSignals before navigation. */
  lastResult: () => 'win' | 'loss' | null;
  setLastResult: (result: 'win' | 'loss' | null) => void;

  reset: () => void;
}

function createGameState(): GameState {
  const [score, setScore] = createSignal(0);
  const [level, setLevel] = createSignal(1);
  const [lastResult, setLastResult] = createSignal<'win' | 'loss' | null>(null);

  return {
    score,
    setScore,
    addScore: (amount: number) => setScore((s) => s + amount),

    level,
    setLevel,
    incrementLevel: () => setLevel((l) => l + 1),

    lastResult,
    setLastResult,

    reset: () => {
      setScore(0);
      setLevel(1);
      setLastResult(null);
    },
  };
}

export const gameState = createRoot(createGameState);
