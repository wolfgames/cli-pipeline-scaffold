/**
 * startView.ts — Mars Bounce start screen controller.
 *
 * Exports:
 *   createStartView() — pure session-routing logic (testable, no DOM)
 *   setupStartScreen  — scaffold contract (StartScreenDeps → StartScreenController)
 *
 * Session routing:
 *   First session (no localStorage flag) → 2-panel intro → Level 1
 *   Returning session (flag set) → Level 1 directly
 */

import type { StartScreenDeps, StartScreenController, SetupStartScreen } from '~/game/mygame-contract';
import { LOADING_BG_COLOR } from './loadingTheme';

const FIRST_SEEN_KEY = 'mars-bounce-firstSeen';

/** First-time intro panel copy. Index 0 = panel 1, index 1 = panel 2. */
const INTRO_PANELS: readonly string[] = [
  "They need your help! The alien colony is stranded on Mars.",
  "Tap matching aliens to launch them home. Match 2 or more!",
] as const;

export interface StartView {
  /** True if this is the player's first session (no localStorage flag). */
  isFirstSession(): boolean;
  /** Set the firstSeen flag in localStorage. */
  markSessionSeen(): void;
  /** Intro panel text strings (2 panels). */
  introPanels: readonly string[];
  /**
   * Start play:
   *   - Returning session → calls goto('game') directly
   *   - First session → caller should show intro, then call advanceIntro()
   */
  startPlay(goto: (screen: string) => void): void;
  /**
   * Advance the intro flow.
   *   - panelIndex 0 = first panel; panelIndex 1+ = last panel → goto('game')
   */
  advanceIntro(panelIndex: number, goto: (screen: string) => void): void;
}

export function createStartView(): StartView {
  const isFirstSession = (): boolean =>
    localStorage.getItem(FIRST_SEEN_KEY) === null;

  const markSessionSeen = (): void => {
    localStorage.setItem(FIRST_SEEN_KEY, 'true');
  };

  const startPlay = (goto: (screen: string) => void): void => {
    if (isFirstSession()) {
      // First session: signal 'intro' to caller — caller renders panels
      goto('intro');
    } else {
      goto('game');
    }
  };

  const advanceIntro = (panelIndex: number, goto: (screen: string) => void): void => {
    const isLastPanel = panelIndex >= INTRO_PANELS.length - 1;
    if (isLastPanel) {
      markSessionSeen();
      goto('game');
    }
    // Non-last panels: caller increments panel index in its own state
  };

  return { isFirstSession, markSessionSeen, introPanels: INTRO_PANELS, startPlay, advanceIntro };
}

// ── Scaffold Contract ─────────────────────────────────────────────────────────

export const setupStartScreen: SetupStartScreen = (deps: StartScreenDeps): StartScreenController => {
  let wrapper: HTMLDivElement | null = null;
  let panelIndex = 0;
  const view = createStartView();

  const renderIntro = () => {
    if (!wrapper) return;
    wrapper.innerHTML = '';

    const panel = document.createElement('div');
    panel.style.cssText =
      'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:24px;padding:24px;text-align:center;';

    // Mars illustration (emoji fallback)
    const icon = document.createElement('div');
    icon.textContent = panelIndex === 0 ? '👽🌋' : '🎯👾';
    icon.style.cssText = 'font-size:4rem;line-height:1;';

    const text = document.createElement('p');
    text.textContent = view.introPanels[panelIndex];
    text.style.cssText =
      'font-size:1.25rem;font-weight:600;color:#fff;margin:0;font-family:system-ui,sans-serif;max-width:280px;';

    const hint = document.createElement('p');
    hint.textContent = panelIndex < view.introPanels.length - 1 ? 'Tap to continue' : 'Tap to play!';
    hint.style.cssText = 'font-size:0.875rem;color:rgba(255,255,255,0.5);margin:0;font-family:system-ui,sans-serif;';

    panel.append(icon, text, hint);
    wrapper.append(panel);

    wrapper.addEventListener('click', () => {
      panelIndex++;
      view.advanceIntro(panelIndex - 1, deps.goto);
      if (panelIndex < view.introPanels.length) renderIntro();
    }, { once: true });
  };

  const renderTitle = () => {
    if (!wrapper) return;
    wrapper.innerHTML = '';

    const inner = document.createElement('div');
    inner.style.cssText =
      'display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;gap:32px;';

    // Settings icon (top right, ≥44px touch target)
    const settingsBtn = document.createElement('button');
    settingsBtn.textContent = '⚙️';
    settingsBtn.setAttribute('aria-label', 'Settings');
    settingsBtn.style.cssText =
      'position:absolute;top:16px;right:16px;width:44px;height:44px;' +
      'font-size:1.5rem;background:rgba(255,255,255,0.1);border:none;border-radius:8px;' +
      'cursor:pointer;display:flex;align-items:center;justify-content:center;';

    // Title
    const title = document.createElement('h1');
    title.textContent = 'Mars Bounce';
    title.style.cssText =
      'font-size:2.5rem;font-weight:800;color:#fff;margin:0;font-family:system-ui,sans-serif;' +
      'text-shadow:0 2px 8px rgba(0,0,0,0.4);';

    // Subtitle
    const sub = document.createElement('p');
    sub.textContent = 'Tap matching aliens to launch them home!';
    sub.style.cssText = 'font-size:1rem;color:rgba(255,255,255,0.7);margin:0;font-family:system-ui,sans-serif;text-align:center;max-width:260px;';

    // Play button (centered, ≥44px)
    const playBtn = document.createElement('button');
    playBtn.textContent = 'Play';
    playBtn.style.cssText =
      'font-size:1.25rem;font-weight:700;padding:16px 64px;min-height:44px;border:none;border-radius:16px;' +
      'background:#e07830;color:#fff;cursor:pointer;font-family:system-ui,sans-serif;' +
      'box-shadow:0 4px 16px rgba(224,120,48,0.4);transition:transform 0.1s;';
    playBtn.onmouseenter = () => { playBtn.style.transform = 'scale(1.05)'; };
    playBtn.onmouseleave = () => { playBtn.style.transform = 'scale(1)'; };

    playBtn.addEventListener('click', async () => {
      playBtn.disabled = true;
      playBtn.textContent = 'Loading…';
      try {
        deps.unlockAudio();
        await deps.initGpu();
        await deps.loadCore();
        try { await deps.loadAudio(); } catch { /* audio optional */ }
        deps.analytics.trackGameStart({
          start_source: 'play_button',
          is_returning_player: !view.isFirstSession(),
        });
      } catch (err) {
        console.error('[mars-bounce] Start screen load error:', err);
        playBtn.disabled = false;
        playBtn.textContent = 'Play';
        return;
      }
      view.startPlay(deps.goto);
      if (view.isFirstSession()) renderIntro();
    }, { once: true });

    inner.append(settingsBtn, title, sub, playBtn);
    wrapper.append(inner);
  };

  return {
    backgroundColor: LOADING_BG_COLOR,

    init(container: HTMLDivElement) {
      wrapper = document.createElement('div');
      wrapper.style.cssText = 'position:relative;width:100%;height:100%;';
      container.append(wrapper);
      renderTitle();
    },

    destroy() {
      wrapper?.remove();
      wrapper = null;
    },
  };
};
