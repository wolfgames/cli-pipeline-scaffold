import { onMount, createMemo, Show } from 'solid-js';
import { useScreen } from '~/core/systems/screens';
import { useAssets, useLoadingState } from '~/core/systems/assets';
import { useManifest } from '@wolfgames/components/solid';
import { useTuning, type ScaffoldTuning } from '~/core';
import { Logo } from '~/core/ui/Logo';
import type { GameTuning } from '~/game/tuning';
import { LOADING_BG_COLOR, LOADING_PROGRESS_COLOR, LOADING_TRACK_COLOR } from '~/game/mars-bounce/screens/loadingTheme';

export function LoadingScreen() {
  const { goto } = useScreen();
  const assets = useAssets();
  const loadingState = useLoadingState();
  const { manifest } = useManifest();
  const tuning = useTuning<ScaffoldTuning, GameTuning>();

  const m = manifest();
  const bundlesByPrefix = (prefix: string) =>
    m.bundles.filter((b) => b.name.startsWith(prefix)).map((b) => b.name);

  const bootBundles = bundlesByPrefix('boot-');
  const themeBundles = bundlesByPrefix('theme-');
  const coreBundles = bundlesByPrefix('core-');
  const audioBundles = bundlesByPrefix('audio-');

  const shouldSkipStartScreen = (): boolean => {
    if (tuning.game.devMode?.skipStartScreen) return true;
    const params = new URLSearchParams(window.location.search);
    return params.get('screen') === 'game';
  };

  const skipToGame = shouldSkipStartScreen();

  const targetBundles = skipToGame
    ? [...bootBundles, ...themeBundles, ...coreBundles, ...audioBundles]
    : [...bootBundles, ...themeBundles];

  const progress = createMemo(() => {
    const s = loadingState();
    if (targetBundles.length === 0) return 100;
    let sum = 0;
    for (const name of targetBundles) {
      if (s.loaded.includes(name)) {
        sum += 1;
      } else if (s.loading.includes(name)) {
        sum += 0.5;
      }
    }
    return (sum / targetBundles.length) * 100;
  });

  const themeLoaded = createMemo(() => {
    const s = loadingState();
    return themeBundles.every((b) => s.loaded.includes(b));
  });

  const failedBundles = createMemo(() => {
    const s = loadingState();
    return targetBundles.filter((name) => name in s.errors);
  });

  const retryFailed = async () => {
    const failed = failedBundles();
    for (const name of failed) {
      await assets.loadBundle(name);
    }
  };

  onMount(async () => {
    try {
      if (skipToGame) {
        await assets.loadBoot();
        await assets.loadTheme();

        assets.unlockAudio();
        await assets.initGpu();
        await assets.loadCore();
        try {
          await assets.loadAudio();
        } catch (err) {
          console.warn('Audio loading failed:', err);
        }
        await new Promise((r) => setTimeout(r, 300));
        await goto('game');
      } else {
        await assets.loadBoot();
        await assets.loadTheme();
        await new Promise((r) => setTimeout(r, 500));
        await goto('start');
      }
    } catch (err) {
      console.error('Failed to load initial assets:', err);
    }
  });

  return (
    <div
      class="fixed inset-0 flex flex-col items-center justify-center"
      style={{ 'background-color': LOADING_BG_COLOR }}
    >
      {/* Mars landscape header — emoji fallback until scene atlas available */}
      <div class="text-6xl mb-6 text-center" role="img" aria-label="Mars landscape">
        🌋🪐🌌
      </div>

      <h1 class="text-2xl font-bold text-white mb-2">Mars Bounce</h1>
      <p class="text-white/60 text-sm mb-8">Loading the colony…</p>

      <Show
        when={failedBundles().length === 0}
        fallback={
          <div class="text-center max-w-sm px-6">
            <p class="text-lg font-semibold text-white mb-2">Unable to load</p>
            <p class="text-sm text-white/60 mb-4">
              Failed to load: {failedBundles().join(', ')}
            </p>
            <button
              onClick={retryFailed}
              class="px-6 py-3 bg-white text-gray-800 rounded-xl font-medium shadow-md hover:shadow-lg active:scale-95 transition-all"
            >
              Retry
            </button>
          </div>
        }
      >
        {/* Animated Mars-themed progress bar — no spinner */}
        <div
          class="w-64 h-3 rounded-full overflow-hidden"
          style={{ 'background-color': LOADING_TRACK_COLOR }}
        >
          <div
            class="h-full rounded-full transition-all duration-300"
            style={{ width: `${progress()}%`, 'background-color': LOADING_PROGRESS_COLOR }}
          />
        </div>
        <p class="text-white/40 text-xs mt-3">{Math.round(progress())}%</p>
      </Show>

      {themeLoaded() && (
        <div class="absolute bottom-8">
          <Logo />
        </div>
      )}
    </div>
  );
}
