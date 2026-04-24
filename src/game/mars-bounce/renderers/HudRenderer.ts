/**
 * HudRenderer — Pixi GPU overlay for the top HUD strip.
 *
 * Layout (reservedTop = 60 px):
 *   Level number  — left (x=10)
 *   Move counter  — center (x=viewportW/2), bold 28 px — most important glanceable value
 *   Score         — right (x=viewportW-10)
 *   Pause button  — far right, 44×44 pt hit area
 *
 * Sits at y=0, height=reservedTop. Board row 0 starts at reservedTop+8=68 px.
 */

import { Container, Graphics, Text, TextStyle, Rectangle } from 'pixi.js';
import gsap from 'gsap';

const HUD_BG_COLOR = 0x0d0d2a; // dark Martian blue
const FONT_FAMILY = 'system-ui, sans-serif';

export class HudRenderer {
  readonly container: Container;

  hudHeight = 0;

  /** Exposed for tests */
  moveCounterText!: Text;
  scoreText!: Text;
  levelText!: Text;
  pauseButton!: Graphics;

  private onPause: (() => void) | null = null;

  constructor() {
    this.container = new Container();
    this.container.label = 'hud';
    this.container.eventMode = 'passive'; // propagates to pause button
    this.container.y = 0;
  }

  init(viewportW: number, reservedTop: number, onPause?: () => void): void {
    this.hudHeight = reservedTop;
    this.onPause = onPause ?? null;

    // Background
    const bg = new Graphics();
    bg.rect(0, 0, viewportW, reservedTop);
    bg.fill({ color: HUD_BG_COLOR, alpha: 0.9 });
    bg.eventMode = 'none';
    this.container.addChild(bg);

    const midY = reservedTop / 2;

    // Level (left)
    this.levelText = new Text('Lv 1', new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 20, fill: '#ffffff' }));
    this.levelText.x = 10;
    this.levelText.y = midY - 10;
    this.levelText.label = 'level';
    this.container.addChild(this.levelText);

    // Move counter (center, bold 28 px — most critical glanceable value)
    this.moveCounterText = new Text('30', new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 28, fontWeight: 'bold', fill: '#ffffff' }));
    this.moveCounterText.x = viewportW / 2 - 14; // approx centered
    this.moveCounterText.y = midY - 14;
    this.moveCounterText.label = 'moves';
    this.container.addChild(this.moveCounterText);

    // Score (right)
    this.scoreText = new Text('0', new TextStyle({ fontFamily: FONT_FAMILY, fontSize: 20, fill: '#ffe066' }));
    this.scoreText.x = viewportW - 70;
    this.scoreText.y = midY - 10;
    this.scoreText.label = 'score';
    this.container.addChild(this.scoreText);

    // Pause button (far right, 44×44 hit area)
    this.pauseButton = new Graphics();
    this.pauseButton.rect(0, 0, 32, 32);
    this.pauseButton.fill({ color: 0xffffff, alpha: 0.1 });
    this.pauseButton.x = viewportW - 44;
    this.pauseButton.y = midY - 16;
    this.pauseButton.eventMode = 'static';
    this.pauseButton.label = 'pause-btn';
    // 44×44 invisible hit area regardless of visual size
    this.pauseButton.hitArea = new Rectangle(-6, -6, 44, 44);
    this.pauseButton.on('pointertap', () => this.firePause());
    this.container.addChild(this.pauseButton);
  }

  /** Update move counter text — called synchronously by ECS observer. */
  updateMoves(moves: number): void {
    this.moveCounterText.text = String(moves);
  }

  /** Update score text. */
  updateScore(score: number): void {
    this.scoreText.text = String(score);
  }

  /** Update level text. */
  updateLevel(level: number): void {
    this.levelText.text = `Lv ${level}`;
  }

  /** Trigger pause — called by button tap or by tests. */
  firePause(): void {
    this.onPause?.();
  }

  /** Shake the move counter on loss sequence. */
  shakeMovesCounter(): void {
    gsap.to(this.moveCounterText, { x: '+=4', repeat: 5, yoyo: true, duration: 0.05, ease: 'none' });
  }

  destroy(): void {
    gsap.killTweensOf(this.container);
    gsap.killTweensOf(this.moveCounterText);
    this.pauseButton.removeAllListeners();
    this.container.parent?.removeChild(this.container);
    this.container.destroy({ children: true });
  }
}
