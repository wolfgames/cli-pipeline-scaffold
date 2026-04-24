---
type: game-report
game: Mars Bounce
pipeline_version: "0.3.8"
run: 1
pass: core
status: partial
features:
  total: 22
  implemented: 18
  partial: 4
  deferred: 0
tests:
  new: 6
  passing: 199
  total: 199
issues:
  critical: 0
  minor: 4
cos:
  - id: core-interaction
    status: partial
    note: "Primary tap mechanic and input gate fully implemented; direction overlay stubs (showDirectionOverlay/hideDirectionOverlay empty bodies) deferred to visual pass"
  - id: canvas
    status: partial
    note: "Viewport geometry passes (55 px cells, 7×9, HUD no-overlap); piece visual identity deferred — Texture.EMPTY used, atlas sprites not loaded"
  - id: animated-dynamics
    status: partial
    note: "Event queue architecture and stable entity IDs fully implemented; GSAP playEvent is a stub (resolves immediately); cascade escalation not implemented — both deferred to visual pass"
  - id: scoring
    status: pass
    note: "Multiplicative formula: (groupSize-1)×100 × (cascadeDepth+1) + 500 combo bonus. HUD displays real-time score. Expert 3×+ beginner confirmed."
  - id: pattern-busters
    status: deferred-to-pass-secondary
    note: "Planet and combo infrastructure built; full CoS walk deferred to secondary pass per conditions/index.md"
  - id: skill-curve
    status: deferred-to-pass-meta
    note: "Level difficulty profiles implemented (1–10/11–30/31+); full CoS walk deferred to meta pass"
completeness:
  items_required: 17
  items_met: 13
  items_gaps: 4
blocking:
  cos_failed: []
  completeness_gaps:
    - "piece-visual-style-locked: Texture.EMPTY atlas fallback — board renders invisible; must switch to emoji Text fallback or real atlas before first playtest (deferred to visual pass)"
    - "cascade-escalation: speed/bounce/intensity scaling with depth not implemented — deferred to visual pass per implement.carry_forward.animation_gsap_integration"
    - "score-popup-animation: score popup at clear location not implemented — deferred to visual pass"
    - "mobile-60fps-verified: browser_verified: false per verify phase; mobile playtest not performed this run"
---

# Pipeline Report: Mars Bounce

## Blocking issues — must resolve before next pass

**Completeness gap (pass=`core`) — piece-visual-style-locked**: `BlockRenderer` uses `Texture.EMPTY` as the atlas fallback. The GPU board renders invisible sprites. Must switch to emoji `Text` fallback nodes (as unified in `integrate`) or load the real `scene-mars-bounce` atlas before first visual playtest. Deferred to visual pass per `implement.carry_forward.sprite_atlas_integration`.

**Completeness gap (pass=`core`) — cascade-escalation**: Animation event queue emits `cascade-start` events with depth but `AnimationPlayer.playEvent` is a stub (resolves immediately). Speed/bounce/intensity escalation with cascade depth is not animated. Deferred to visual pass per `implement.carry_forward.animation_gsap_integration`.

**Completeness gap (pass=`core`) — score-popup-animation**: Score popup at the clear cell location is not implemented. HUD score display is present but per-clear popup animation is absent. Deferred to visual pass.

**Completeness gap (pass=`core`) — mobile-60fps-verified**: `browser_verified: false` per verify phase. Mobile touch at 60fps has not been confirmed on a real device this run.

## Features

- [x] asset-coordinator — scaffold infra, unchanged
- [x] audio-system — scaffold infra, unchanged
- [x] pause-overlay — scaffold infra, unchanged
- [x] analytics — scaffold infra, unchanged
- [x] error-tracking — scaffold infra, unchanged
- [x] branding-logo — scaffold DOM overlay, 64 px reserved
- [x] screen-flow — loading → start → game → results wired; chapter-complete branch added
- [x] ecs-plugin — MarsBouncePlugin: resources, archetypes, transactions, actions; setActiveDb lifecycle correct
- [x] board-renderer — 7×9 grid, cellSize=55, eventMode=passive/static, hit area ≥44 px
- [~] alien-entities — BlockRenderer frame keys defined; sprite pool uses Texture.EMPTY (atlas deferred)
- [x] tap-input-handler — TapHandler: cluster BFS, invalid-tap shake, Rocket modal, input gate
- [x] gravity-cascade — applyGravity: rocky anchored, bounce falls, skipRefill win-check pattern
- [x] animation-event-queue — AnimationPlayer: Animating/Idle lifecycle, sequential queue, invalid-tap isolation
- [x] combo-pieces — Rocket/PlanetBuster/CosmicStorm: spawn thresholds, activation, activateCombo
- [x] hud — HudRenderer: level/moves/score/pause, ≥44 px hit area, ECS observer wired
- [x] board-state-machine — Idle/Animating/Won/Lost/Paused; PendingDirection for Rocket
- [x] win-sequence — boardState→Won trigger, win-sequence-start event, ResultsScreen win branch
- [x] loss-sequence — boardState→Lost trigger, loss-sequence-start event, ResultsScreen loss branch
- [x] continue-system — grantContinue +5 moves stub (no ad/currency); board state preserved
- [x] first-time-intro — 2-panel intro; localStorage firstSeen flag; session routing
- [x] chapter-complete-screen — ResultsScreen chapter-complete branch; chapterScore ECS resource
- [x] level-generation — LevelGenerator: seeded LCG, 3 profiles, SolvabilityValidator, 10 retries, fallback
- [x] scoring-system — (groupSize-1)×100 × (cascadeDepth+1) + 500 comboBonus; wide range confirmed
- [~] planet-entities — Rocky anchored, Bounce fires; full pattern-busters CoS deferred to secondary pass
- [~] loading-screen-theme — Mars red background, progress bar; visual illustration deferred
- [~] title-screen-theme — Play button, session routing; GPU Mars scene deferred to visual pass
- [~] results-screen-theme — win/loss branches present; Mars theme visual polish deferred
- [~] game-screen-shell-theme — gameMode='pixi' active; GPU canvas renders; alien sprites invisible (atlas deferred)

## CoS Compliance — pass `core`

| CoS                    | Status  | Evidence / note |
|------------------------|---------|-----------------|
| `core-interaction`     | partial | Tap mechanic, pointer events, input gate, interaction-archetype.md all pass; showDirectionOverlay is a stub (Rocket overlay invisible) |
| `canvas`               | partial | 55 px cells, 7×9 viewport budget passes, HUD no-overlap confirmed; alien sprites invisible (Texture.EMPTY atlas fallback, visual pass) |
| `animated-dynamics`    | partial | Event queue + stable entity IDs + board-diff correct; GSAP playEvent stub resolves immediately; cascade escalation not implemented |
| `scoring` (base)       | pass    | (groupSize-1)×100 × (cascadeDepth+1); HUD display; expert/beginner ratio >3× confirmed |
| `pattern-busters`      | deferred-to-pass-secondary | Infrastructure built; full walk deferred per conditions/index.md |
| `skill-curve`          | deferred-to-pass-meta | Level profiles implemented; full walk deferred per conditions/index.md |

## Completeness — pass `core`

| Area                    | Required | Met | Gaps |
|-------------------------|----------|-----|------|
| Interaction             | 5        | 5   | 0    |
| Board & Pieces          | 4        | 3   | 1    |
| Core Mechanics          | 6        | 5   | 1    |
| Scoring (base)          | 3        | 2   | 1    |
| CoS mandatory rows      | 4        | 1   | 3    |

## Known Issues

- **minor** — alien sprites invisible: `BlockRenderer` uses `Texture.EMPTY`; GPU board renders as empty sprites. The `emojiForSpecies()` helper is defined but not wired to rendering path. Fix in visual pass.
- **minor** — animation stubs: `playEvent` resolves immediately in `gameController.ts` — no visual animation on cluster clear, gravity drop, or combo activation. GSAP tween wiring deferred to visual pass.
- **minor** — results screen theme drift: generic space gradient (slate-900 → black) instead of Mars-red palette used on other screens.
- **minor** — direction overlay stubs: `showDirectionOverlay` / `hideDirectionOverlay` are empty bodies in `BoardRenderer`. Rocket Alien pending-direction state is fully implemented in ECS and TapHandler; the ghost overlay visual is absent.

## Deferred

- **GSAP integration** — `playEvent` in `gameController.ts` is a stub. Real GSAP tween playback (cluster launch, gravity drop timing, spring bounce, cascade escalation) deferred to visual pass. Architecture is in place; filling in tween implementations is the primary visual-pass task.
- **Atlas sprites** — `scene-mars-bounce` atlas bundle not yet generated. `BlockRenderer.createAlienSprite` uses `Texture.EMPTY` fallback. Deferred to asset pass (emoji fallback is the interim solution).
- **Audio playback** — audio hooks are present in deps; SFX calls exist in `TapHandler` (`playSfx('thud')`). Actual audio content and bundle deferred to audio pass.
- **Direction overlay visual** — `showDirectionOverlay` / `hideDirectionOverlay` stubs. Ghost row/column highlight for Rocket Alien deferred to visual pass.
- **Score popup animation** — per-clear popup at the clear location deferred to visual pass.
- **Mobile 60fps verification** — no browser playtest performed this run.

## Recommendations

1. **Visual pass priority 1**: Wire `playEvent` in `gameController.ts` to real GSAP tweens. Start with cluster-cleared (launch), then gravity-drop (fall with 80ms ease-in), then elements-entered (200ms spring). This unlocks the full animated-dynamics CoS.
2. **Visual pass priority 2**: Replace `Texture.EMPTY` with emoji `Text` nodes in `BlockRenderer` as interim fallback (already unified in `integrate` for DOM screens). This makes the board visible before the atlas is ready.
3. **Visual pass priority 3**: Implement `showDirectionOverlay` in `BoardRenderer` — draw semi-transparent highlight on rocket's row and column so the Rocket Alien UX is complete.
4. **Asset pass**: Generate `scene-mars-bounce` spritesheet atlas with all 5 alien species + planet/combo frames. Switch `BlockRenderer` from `Texture.EMPTY` to atlas frames.
5. **Mobile playtest**: Perform at least one test on a real mobile device (390×844) to confirm 60fps, touch-action:none working, and safe areas respected.
