/**
 * Mars Bounce GameController — Pixi mode.
 *
 * Wiring sequence (per game-controller.mdc contract):
 *   1. ECS DB created → setActiveDb(db) → bridgeEcsToSignals(db)
 *   2. Pixi Application initialised → layers created
 *   3. (batch 2+) renderers instantiated and wired
 *
 * Destroy order: GSAP tweens → Pixi app → cleanupBridge → setActiveDb(null)
 */

import { createSignal } from 'solid-js';
import { Application, Container } from 'pixi.js';
import gsap from 'gsap';
import type { GameControllerDeps, GameController, SetupGame } from '~/game/mygame-contract';
import { setActiveDb } from '~/core/systems/ecs';
import { createMarsBounceDb } from '../state/MarsBouncePlugin';
import { bridgeEcsToSignals } from '../state/bridgeEcsToSignals';
import { BoardRenderer } from '../renderers/BoardRenderer';
import { BlockRenderer } from '../renderers/BlockRenderer';
import { TapHandler } from '../input/TapHandler';
import { HudRenderer } from '../renderers/HudRenderer';
import { AnimationPlayer } from '../animation/AnimationPlayer';
import { LevelGenerator } from '../level/LevelGenerator';

export const setupGame: SetupGame = (_deps: GameControllerDeps): GameController => {
  const [ariaText, setAriaText] = createSignal('Mars Bounce loading…');

  let app: Application | null = null;
  let cleanupBridge: (() => void) | null = null;
  let canvas: HTMLCanvasElement | null = null;

  // Layers (created after app init)
  let bgLayer: Container | null = null;
  let boardLayer: Container | null = null;
  let hudLayer: Container | null = null;
  let uiLayer: Container | null = null;

  // Renderers
  const boardRenderer = new BoardRenderer();
  const blockRenderer = new BlockRenderer();
  let tapHandler: TapHandler | null = null;
  const hudRenderer = new HudRenderer();
  let hudCleanups: Array<() => void> = [];

  const controller: GameController = {
    gameMode: 'pixi',

    async init(container: HTMLDivElement) {
      setAriaText('Mars Bounce');

      try {
      // 1. ECS setup
      const db = createMarsBounceDb();
      setActiveDb(db as any);
      cleanupBridge = bridgeEcsToSignals(db);

      // 2. Pixi Application
      app = new Application();
      await app.init({
        resizeTo: container,
        background: '#0a0a1a', // dark Martian sky
        resolution: Math.min(globalThis.window?.devicePixelRatio ?? 1, 2),
        antialias: false,
      });

      canvas = app.canvas as HTMLCanvasElement;
      // touch-action: none — prevents iOS scroll disambiguation on the game canvas
      canvas.style.cssText = 'touch-action: none; user-select: none; -webkit-user-select: none;';
      container.appendChild(canvas);

      // 3. Layer setup
      app.stage.eventMode = 'static';

      bgLayer = new Container();
      bgLayer.eventMode = 'none'; // no interactive children
      bgLayer.label = 'bg';

      boardLayer = new Container();
      boardLayer.eventMode = 'passive'; // has interactive children
      boardLayer.label = 'board';

      hudLayer = new Container();
      hudLayer.eventMode = 'passive';
      hudLayer.label = 'hud';

      uiLayer = new Container();
      uiLayer.eventMode = 'passive';
      uiLayer.label = 'ui';

      app.stage.addChild(bgLayer, boardLayer, hudLayer, uiLayer);

      // 4. BoardRenderer — init with viewport + reserved heights
      const { width, height } = app.screen;
      boardRenderer.init(width, height, 60, 64);
      boardLayer.addChild(boardRenderer.container);

      // 5. BlockRenderer — load atlas after scene bundle is available
      blockRenderer.loadAtlas();

      // 6. HudRenderer — wire in top 60 px, observe ECS resources
      hudRenderer.init(width, 60, () => {
        // Scaffold pause system — imported lazily to avoid circular deps
        import('~/core/systems/pause').then((m) => m.openPause?.()).catch(() => undefined);
      });
      hudLayer.addChild(hudRenderer.container);

      // Wire ECS resource observations → HUD updates
      hudCleanups = [
        db.observe.resources.score((v) => hudRenderer.updateScore(v)),
        db.observe.resources.movesRemaining((v) => hudRenderer.updateMoves(v)),
        db.observe.resources.level((v) => hudRenderer.updateLevel(v)),
      ];

      // 7. Load level 1 from seeded generator
      const levelGenerator = new LevelGenerator();
      const levelData = levelGenerator.generate({ levelNumber: db.resources.level });
      db.transactions.initLevel({
        level: db.resources.level,
        movesRemaining: levelData.movesRemaining,
        activeSpecies: levelData.activeSpecies,
        cells: levelData.cells as Parameters<typeof db.transactions.initLevel>[1]['cells'],
      });

      // 9. AnimationPlayer — sequential event queue, bridges ECS phase to visual playback
      const animationPlayer = new AnimationPlayer({
        setPhase: (phase) => db.transactions.setPhase(phase),
        playEvent: (_event) => {
          // Batch 7+: dispatch GSAP tween sequences per event type.
          // Stub resolves immediately so boardState flows correctly.
          return Promise.resolve();
        },
      });

      // 10. TapHandler — wire input on board container, feed events into AnimationPlayer
      tapHandler = new TapHandler(db as any, boardRenderer, {
        onAnimationEvents: (events) => { animationPlayer.playQueue(events).catch(() => undefined); },
      });

      setAriaText('Mars Bounce — tap aliens to launch them home!');
      } catch (err) {
        console.error('[mars-bounce] GameController.init failed:', err);
        throw err;
      }
    },

    destroy() {
      // Destroy order: tweens → renderers → Pixi app → bridge → setActiveDb(null)
      tapHandler?.destroy();
      tapHandler = null;
      for (const fn of hudCleanups) fn();
      hudCleanups = [];
      hudRenderer.destroy();
      boardRenderer.destroy();
      gsap.killTweensOf(app?.stage);
      if (bgLayer) gsap.killTweensOf(bgLayer);
      if (boardLayer) gsap.killTweensOf(boardLayer);
      if (hudLayer) gsap.killTweensOf(hudLayer);

      if (canvas) {
        canvas.remove();
        canvas = null;
      }

      app?.destroy(true, { children: true });
      app = null;

      cleanupBridge?.();
      cleanupBridge = null;

      setActiveDb(null);

      bgLayer = boardLayer = hudLayer = uiLayer = null;
    },

    ariaText,
  };

  return controller;
};
