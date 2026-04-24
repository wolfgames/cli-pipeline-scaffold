/**
 * BlockRenderer — alien sprite frame and visual distinctiveness tests.
 *
 * Tests cover:
 *   - Each of the 5 alien species has a distinct texture frame key
 *   - Species are distinguishable by shape cue (not color alone) — verified by frame key uniqueness
 *   - Zorbling species uses the 'zorbling' frame key from the scene-mars-bounce atlas
 */

import { describe, it, expect, vi } from 'vitest';

vi.mock('pixi.js', () => {
  const Sprite = vi.fn().mockImplementation(() => ({
    eventMode: 'none',
    x: 0,
    y: 0,
    width: 0,
    height: 0,
    anchor: { set: vi.fn() },
    label: '',
  }));
  const Texture = {
    EMPTY: { label: 'EMPTY' },
    from: vi.fn((key: string) => ({ label: key })),
  };
  const Assets = {
    get: vi.fn((key: string) => ({
      textures: Object.fromEntries(
        ['zorbling', 'blipp', 'glurp', 'yipp', 'plonk',
         'rocky-planet', 'bounce-planet', 'rocket-alien', 'planet-buster', 'cosmic-storm'].map(
          (k) => [k, { label: k }],
        ),
      ),
    })),
  };
  return { Sprite, Texture, Assets };
});

import { BlockRenderer } from '~/game/mars-bounce/renderers/BlockRenderer';
import type { Species } from '~/game/mars-bounce/state/types';

const ALL_SPECIES: Species[] = ['zorbling', 'blipp', 'glurp', 'yipp', 'plonk'];

describe('BlockRenderer — alien sprites', () => {
  it('each species has a distinct texture frame AND a distinct shape cue (not color alone)', () => {
    const renderer = new BlockRenderer();
    const frameKeys = ALL_SPECIES.map((s) => renderer.frameKeyForSpecies(s));

    // All frame keys must be unique (shape cue = distinct frame)
    const unique = new Set(frameKeys);
    expect(unique.size).toBe(ALL_SPECIES.length);
    // No key should be empty
    expect(frameKeys.every((k) => k.length > 0)).toBe(true);
  });

  it("sprite frame key is 'zorbling' from scene-mars-bounce atlas", () => {
    const renderer = new BlockRenderer();
    expect(renderer.frameKeyForSpecies('zorbling')).toBe('zorbling');
  });
});
