/**
 * BoardRenderer — 7×9 Mars Bounce grid.
 *
 * Contract:
 *   init(viewportW, viewportH, reservedTop, reservedBottom)
 *     → creates GPU container, sizes cells, sets eventModes
 *   syncBoard(boardDiff)
 *     → GSAP-animates only changed entities (batch 5)
 *   destroy()
 *     → tweens → listeners → removeChild → destroy({children: true})
 *
 * Cell layout:
 *   cellSize = floor(viewportW / 7)        (≥ 44 px, ≤ 64 px at 390 px)
 *   boardWidth  = 7 × cellSize
 *   boardHeight = 9 × cellSize
 *   boardX = round((viewportW - boardWidth) / 2)
 *   boardY = reservedTop + MARGIN_ABOVE_BOARD
 */

import { Container, Graphics, Rectangle } from 'pixi.js';
import gsap from 'gsap';
import type { CellPosition } from '../state/types';

const BOARD_COLS = 7;
const BOARD_ROWS = 9;
const MARGIN_ABOVE = 8;

export class BoardRenderer {
  readonly container: Container;

  cellSize = 0;
  boardWidth = 0;
  boardHeight = 0;
  boardX = 0;
  boardY = 0;

  /** 2D array [row][col] of cell Graphics objects. */
  cellGraphics: Graphics[][] = [];

  /** tap callback wired by TapHandler in batch 3 */
  onCellTap: ((pos: CellPosition) => void) | null = null;

  constructor() {
    this.container = new Container();
    this.container.label = 'board-renderer';
    this.container.eventMode = 'passive'; // propagates events to children
  }

  /** Set up layout and cell graphics. Call once after app.init(). */
  init(
    viewportW: number,
    _viewportH: number,
    reservedTop: number,
    _reservedBottom: number,
  ) {
    this.cellSize = Math.floor(viewportW / BOARD_COLS);
    this.boardWidth = BOARD_COLS * this.cellSize;
    this.boardHeight = BOARD_ROWS * this.cellSize;
    this.boardX = Math.round((viewportW - this.boardWidth) / 2);
    this.boardY = reservedTop + MARGIN_ABOVE;

    this.container.x = this.boardX;
    this.container.y = this.boardY;

    this.cellGraphics = [];

    for (let row = 0; row < BOARD_ROWS; row++) {
      const rowArr: Graphics[] = [];
      for (let col = 0; col < BOARD_COLS; col++) {
        const g = new Graphics();
        g.eventMode = 'static'; // receives pointer events
        g.label = `cell-${row}-${col}`;

        // Invisible background — actual alien sprite added by BlockRenderer
        // Size matches cell, centred
        g.rect(0, 0, this.cellSize, this.cellSize);
        g.fill({ color: 0x000000, alpha: 0 });

        // Explicit hit area ≥ 44 px
        const hitSize = Math.max(this.cellSize, 44);
        const offset = (hitSize - this.cellSize) / 2;
        g.hitArea = new Rectangle(-offset, -offset, hitSize, hitSize);

        g.x = col * this.cellSize;
        g.y = row * this.cellSize;

        g.on('pointertap', () => {
          this.onCellTap?.({ row, col });
        });

        this.container.addChild(g);
        rowArr.push(g);
      }
      this.cellGraphics.push(rowArr);
    }
  }

  /** Show/hide direction overlay for Rocket Alien (batch 3). */
  showDirectionOverlay(_cell: CellPosition): void {
    // Implemented in batch 7
  }

  hideDirectionOverlay(): void {
    // Implemented in batch 7
  }

  destroy() {
    gsap.killTweensOf(this.container);
    for (const row of this.cellGraphics) {
      for (const g of row) {
        gsap.killTweensOf(g);
        g.removeAllListeners();
      }
    }
    this.container.parent?.removeChild(this.container);
    this.container.destroy({ children: true });
    this.cellGraphics = [];
  }
}
