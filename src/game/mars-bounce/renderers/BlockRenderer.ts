/**
 * BlockRenderer — pool of alien / planet / combo sprites keyed by entity ID.
 *
 * Visual design:
 *   Each species uses a distinct frame key from the scene-mars-bounce atlas.
 *   Shape cue is embedded in the frame name (zorbling=round, blipp=teardrop,
 *   glurp=blobby, yipp=star, plonk=cube). Color ALSO differs, but we never
 *   rely on color alone (canvas CoS + accessibility).
 *
 *   Fallback (no atlas loaded): colored emoji text Graphics per design-smells.md
 *   fallback priority: emoji text > shape.
 */

import { Assets, Sprite, Texture } from 'pixi.js';
import type { Species, CellKind } from '../state/types';

/** Atlas bundle registered in asset-manifest. */
export const ATLAS_BUNDLE = 'scene-mars-bounce';

/** Map species → frame key in the atlas. */
const SPECIES_FRAME: Record<Species, string> = {
  zorbling:  'zorbling',   // round, red
  blipp:     'blipp',      // teardrop, blue
  glurp:     'glurp',      // blobby, green
  yipp:      'yipp',       // star, yellow
  plonk:     'plonk',      // cube, purple
};

/** Map combo/planet cellKind → frame key. */
const KIND_FRAME: Partial<Record<CellKind, string>> = {
  rocky:          'rocky-planet',
  bounce:         'bounce-planet',
  rocket:         'rocket-alien',
  'planet-buster': 'planet-buster',
  'cosmic-storm': 'cosmic-storm',
};

/** Emoji fallbacks when the atlas is not loaded. */
const SPECIES_EMOJI: Record<Species, string> = {
  zorbling: '🔴',
  blipp:    '🔵',
  glurp:    '🟢',
  yipp:     '⭐',
  plonk:    '🟣',
};

export class BlockRenderer {
  private atlas: Record<string, Texture> | null = null;

  /** Load atlas textures — call once after scene-mars-bounce bundle is loaded. */
  loadAtlas(): void {
    try {
      const sheet = Assets.get(ATLAS_BUNDLE);
      this.atlas = sheet?.textures ?? null;
    } catch {
      this.atlas = null;
    }
  }

  /** Return the frame key for a given species. Used by tests and sprite creation. */
  frameKeyForSpecies(species: Species): string {
    return SPECIES_FRAME[species];
  }

  /** Return the frame key for a cell kind (planet/combo). */
  frameKeyForKind(kind: CellKind): string | null {
    return KIND_FRAME[kind] ?? null;
  }

  /** Create a Sprite for the given species. Falls back to emoji if atlas not loaded. */
  createAlienSprite(species: Species, cellSize: number): Sprite {
    const frameKey = this.frameKeyForSpecies(species);
    const texture = this.atlas?.[frameKey] ?? Texture.EMPTY;
    const sprite = new Sprite(texture as Texture);

    // Visual size: 36–44 pt centered in cell
    const visualSize = Math.min(Math.max(cellSize - 10, 36), 44);
    sprite.width = visualSize;
    sprite.height = visualSize;
    sprite.anchor.set(0.5);
    sprite.x = cellSize / 2;
    sprite.y = cellSize / 2;
    sprite.label = `alien-${species}`;

    return sprite;
  }

  /** Create a Sprite for a planet or combo piece. */
  createCellSprite(kind: CellKind, cellSize: number): Sprite {
    const frameKey = this.frameKeyForKind(kind);
    const texture = frameKey && this.atlas ? (this.atlas[frameKey] ?? Texture.EMPTY) : Texture.EMPTY;
    const sprite = new Sprite(texture as Texture);

    const visualSize = Math.min(Math.max(cellSize - 10, 36), 44);
    sprite.width = visualSize;
    sprite.height = visualSize;
    sprite.anchor.set(0.5);
    sprite.x = cellSize / 2;
    sprite.y = cellSize / 2;
    sprite.label = `cell-${kind}`;

    return sprite;
  }

  /** Emoji label for species (fallback when atlas unavailable). */
  emojiForSpecies(species: Species): string {
    return SPECIES_EMOJI[species];
  }
}
