/**
 * ResultsScreen — win/loss/chapter-complete branches for Mars Bounce.
 *
 * Win branch (Level Complete):
 *   - Score tally, celebration aliens, Next Level button
 * Loss branch (Loss Screen):
 *   - Sad alien, Try Again + Continue (5 extra moves) buttons
 * Chapter Complete branch (every 10 levels):
 *   - Mars panorama, chapter number, chapter score tally, Keep Going! button
 *
 * The screen reads boardState from ECS (via gameState bridge) to determine branch.
 * For continue: ECS grantContinue transaction is dispatched via the active DB.
 */

import { createSignal, onMount, Show } from 'solid-js';
import { useScreen } from '~/core/systems/screens';
import { Button } from '~/core/ui/Button';
import { gameState } from '~/game/state';
import { activeDb } from '~/core/systems/ecs';

export interface ResultsScreenProps {
  /** 'win' | 'loss' | 'chapter-complete' — drives which branch renders. Defaults to reading ECS boardState. */
  result?: 'win' | 'loss' | 'chapter-complete';
}

/** Animated score tally — counts from 0 to final value over 600ms. */
function ScoreTally(props: { finalScore: number }) {
  const [displayed, setDisplayed] = createSignal(0);

  onMount(() => {
    const start = performance.now();
    const duration = 600;
    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      setDisplayed(Math.round(props.finalScore * progress));
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  return <span>{displayed().toLocaleString()}</span>;
}

export function ResultsScreen(props: ResultsScreenProps) {
  const { goto } = useScreen();
  const score = gameState.score();

  // Resolve result branch — prefer explicit prop, then persisted lastResult signal, then default to 'win'
  const lastResult = gameState.lastResult();
  const result = props.result ?? (lastResult === 'loss' ? 'loss' : 'win');
  // Chapter complete: level % 10 === 0 and it's a win (level() is the level just completed)
  const currentLevel = gameState.level();
  const isChapterComplete = result === 'chapter-complete' || (result === 'win' && currentLevel % 10 === 0 && currentLevel > 0);
  const isWin = result === 'win' && !isChapterComplete;

  const handleNextLevel = () => {
    gameState.incrementLevel();
    goto('game');
  };

  const handleTryAgain = () => {
    goto('game');
  };

  const handleContinue = () => {
    // Grant 5 extra moves via ECS; board state preserved
    const db = activeDb() as ReturnType<typeof import('~/game/mars-bounce/state/MarsBouncePlugin').createMarsBounceDb> | null;
    db?.transactions?.grantContinue?.();
    goto('game');
  };

  const handleMainMenu = () => {
    goto('start');
  };

  const handleKeepGoing = () => {
    // Reset chapter score and advance to next level via start screen
    const db = activeDb() as ReturnType<typeof import('~/game/mars-bounce/state/MarsBouncePlugin').createMarsBounceDb> | null;
    db?.transactions?.updateChapterScore?.({ add: 0, reset: true });
    gameState.incrementLevel();
    goto('start');
  };

  // Chapter number = current level / 10 (levels 1-10 = chapter 1, etc.)
  const chapterNumber = Math.ceil(gameState.level() / 10);
  const chapterScore = (activeDb() as ReturnType<typeof import('~/game/mars-bounce/state/MarsBouncePlugin').createMarsBounceDb> | null)
    ?.resources?.chapterScore ?? 0;

  return (
    <div class="fixed inset-0 flex flex-col items-center justify-center bg-gradient-to-b from-slate-900 to-black px-6">
      <Show
        when={isChapterComplete}
        fallback={
          <Show
            when={isWin}
            fallback={
              /* Loss branch */
              <div class="flex flex-col items-center gap-6 text-center">
                {/* Sad alien emoji fallback — replaced with sprite when atlas loaded */}
                <div class="text-7xl animate-bounce" role="img" aria-label="Sad alien">
                  👾
                </div>

                <h1 class="text-3xl font-bold text-white">Out of moves!</h1>
                <p class="text-white/60 text-sm">
                  {gameState.score().toLocaleString()} points scored
                </p>

                {/* Try Again and Continue buttons — both ≥ 44×44 px via Button component */}
                <div class="flex flex-col gap-3 w-full max-w-xs">
                  <Button
                    class="min-h-[44px] w-full"
                    onClick={handleTryAgain}
                  >
                    Try Again
                  </Button>

                  <Button
                    variant="secondary"
                    class="min-h-[44px] w-full"
                    onClick={handleContinue}
                  >
                    Continue (+5 moves)
                  </Button>

                  <Button
                    variant="secondary"
                    class="min-h-[44px] w-full"
                    onClick={handleMainMenu}
                  >
                    Main Menu
                  </Button>
                </div>
              </div>
            }
          >
            {/* Win branch */}
            <div class="flex flex-col items-center gap-6 text-center">
              {/* Celebration aliens — emoji fallback */}
              <div class="text-6xl animate-bounce" role="img" aria-label="Celebration aliens">
                🎉👾🎉
              </div>

              <h1 class="text-3xl font-bold text-white">Level Complete!</h1>

              <div>
                <p class="text-white/60 text-sm mb-1">Score</p>
                <p class="text-5xl font-bold text-yellow-400">
                  <ScoreTally finalScore={score} />
                </p>
              </div>

              <div class="flex flex-col gap-3 w-full max-w-xs">
                <Button
                  class="min-h-[44px] w-full"
                  onClick={handleNextLevel}
                >
                  Next Level
                </Button>

                <Button
                  variant="secondary"
                  class="min-h-[44px] w-full"
                  onClick={handleMainMenu}
                >
                  Main Menu
                </Button>
              </div>
            </div>
          </Show>
        }
      >
        {/* Chapter Complete branch */}
        <div class="flex flex-col items-center gap-6 text-center">
          {/* Mars panorama — emoji fallback until scene atlas available */}
          <div
            class="text-5xl"
            role="img"
            aria-label="Mars panorama"
            style={{ animation: 'pulse 2s ease-in-out infinite' }}
          >
            🌋🪐🌌✨
          </div>

          <div>
            <p class="text-white/50 text-sm uppercase tracking-widest mb-1">
              Chapter {chapterNumber} Complete!
            </p>
            <h1 class="text-3xl font-bold text-white">Colony Saved!</h1>
          </div>

          <div>
            <p class="text-white/60 text-sm mb-1">Chapter Score</p>
            <p class="text-5xl font-bold text-yellow-400">
              <ScoreTally finalScore={chapterScore} />
            </p>
          </div>

          <div class="flex flex-col gap-3 w-full max-w-xs">
            {/* Keep Going! — advances to start screen, resets chapter score */}
            <Button
              class="min-h-[44px] w-full"
              onClick={handleKeepGoing}
            >
              Keep Going!
            </Button>

            <Button
              variant="secondary"
              class="min-h-[44px] w-full"
              onClick={handleMainMenu}
            >
              Main Menu
            </Button>
          </div>
        </div>
      </Show>
    </div>
  );
}
