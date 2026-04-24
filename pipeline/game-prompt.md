# Mars Bounce
**Tagline:** Every tap sends the cosmos flying.
**Genre:** Casual Puzzle / Physics-Match
**Platform:** Mobile first (portrait, touch), playable on web
**Target Audience:** Casual adults 30+

---

## Table of Contents

**The Game**
1. [Game Overview](#game-overview)
2. [At a Glance](#at-a-glance)

**How It Plays**
3. [Core Mechanics](#core-mechanics)
4. [Level Generation](#level-generation)

**How It Flows**
5. [Game Flow](#game-flow)

---

## Game Overview

Mars Bounce is a tap-to-clear puzzle game set on a vibrant alien colony on the Martian surface. Players tap connected clusters of matching alien species, launching them off the grid in a shower of springy, satisfying bounces. Planetoids roll in from the edges to fill gaps and block progress, demanding strategic thinking one tap at a time.

**Setting:** A cheerful, top-down view of a Martian colony grid — dusty red terrain, glowing alien creatures, and rolling mini-planets drifting across the surface.

**Core Loop:** Player taps a connected group of 2+ matching aliens → the group launches off-screen with a bouncy animation → remaining aliens fall under Mars gravity while new aliens bounce in from the top → score accumulates toward the level's move target.

---

## At a Glance

| | |
|---|---|
| **Grid** | 7 × 9 |
| **Input** | Tap |
| **Alien Species** | 5 (Red Zorblings, Blue Blipps, Green Glurps, Yellow Yipps, Purple Plonks) |
| **Planet Types** | 2 (Rocky Planet — blocker, Bounce Planet — chain-reaction piece) |
| **Session Target** | 2–5 min per level |
| **Move Range** | 10–35 moves |
| **Failure** | Yes — out of moves |
| **Continue System** | Ad or in-game currency for extra moves |
| **Combo Pieces** | Rocket Alien (5–6 tap), Planet Buster (7–8 tap), Cosmic Storm (9+ tap) |

---

## Core Mechanics

### Primary Input

**Input type:** Single tap (touch on mobile, mouse click on web)
**Acts on:** A cell containing an alien species on the play grid
**Produces:** If the tapped cell belongs to a connected group of 2+ same-species aliens, the entire connected group launches off the grid with a bouncy animation and is removed. If the group has 5+ aliens, a special combo piece spawns in its place. If the tapped cell is isolated (group of 1), the action is invalid.

> For invalid action feedback (visual, audio, duration), see [Feedback & Juice](#feedback--juice).

### Play Surface

- **Dimensions:** 7 columns × 9 rows
- **Scaling:** Grid scales to fill the portrait viewport between the HUD (top) and the bottom safe zone. Maximum cell size 56×56pt, minimum 44×44pt. Cells are square.
- **Cell types:** Empty, Alien (5 species), Rocky Planet (blocker), Bounce Planet (chain-reaction piece)
- **Bounds:** Aliens that fall off the bottom edge are removed. New aliens bounce in from the top row.

### Game Entities

#### Alien Species (5 types)
| Entity | Visual | Behavior Rules | Edge Cases |
|--------|--------|---------------|------------|
| Red Zorbling | Round, red, wide grin | Connects to adjacent same-species cells (4-directional) | Diagonal connections do NOT count |
| Blue Blipp | Teardrop-shaped, blue, one large eye | Same connection rules as Zorbling | Cannot connect through a Planet cell |
| Green Glurp | Blobby, green, wiggly antennae | Same connection rules | Same |
| Yellow Yipp | Star-shaped, yellow, tiny wings | Same connection rules | Same |
| Purple Plonk | Cube-shaped, purple, stubby horns | Same connection rules | Same |

All alien cells: minimum visual size 36×36pt, tap target 44×44pt minimum.

#### Rocky Planet (Blocker)
| Entity | Visual | Behavior Rules | Edge Cases |
|--------|--------|---------------|------------|
| Rocky Planet | Gray cratered sphere, 1 cell wide | Cannot be tapped or moved by the player. Does not fall under gravity. Occupies one cell permanently until cleared by an adjacent combo piece explosion. | Immovable when surrounded by aliens that have nowhere to fall |

#### Bounce Planet (Chain-Reaction Piece)
| Entity | Visual | Behavior Rules | Edge Cases |
|--------|--------|---------------|------------|
| Bounce Planet | Colorful striped sphere, 1 cell wide | When an adjacent alien group (any species) is cleared, the Bounce Planet launches in a random cardinal direction, bouncing off walls and clearing the first alien column or row it passes through before disappearing. | Bouncing path is computed before animation starts; cannot bounce off other Bounce Planets in the same frame |

#### Combo Pieces (spawn on large clears)

| Piece | Threshold | Visual | Effect |
|-------|-----------|--------|--------|
| Rocket Alien | 5–6 tapped aliens | Alien wearing rocket pack | Clears the entire row or column (direction chosen by player via swipe at moment of use) |
| Planet Buster | 7–8 tapped aliens | Glowing miniature sun | Clears a 3×3 area centered on the piece |
| Cosmic Storm | 9+ tapped aliens | Swirling galaxy vortex | Clears all aliens of one random species on the board |

Combo pieces sit on the grid like aliens and are activated by tapping them. They count as a move.

### Movement & Physics Rules

**Gravity (post-clear):**
- IF a cell is cleared AND there are alien cells in the same column above it THEN those aliens fall downward one cell at a time (cascade) until they rest on a non-empty cell or the bottom boundary.
- IF a Rocky Planet is above an empty cell THEN the Rocky Planet does NOT fall (it is anchored).
- IF a Bounce Planet is above an empty cell THEN the Bounce Planet DOES fall (gravity applies to it).

**New alien spawn:**
- IF a column has fewer than 9 cells of content (alien + planet) THEN new aliens bounce in from off-screen top, one per empty slot, until the column is full.
- New aliens are assigned a random species from the current level's active species pool.
- Animation duration for each falling step: 80ms ease-in.
- Animation duration for bounce-in from top: 200ms with spring overshoot (scale 1.15 → 1.0).

**Input during animation:**
- IF the board is in the Animating state THEN all tap input is ignored.
- The board returns to Idle after all falling and spawn animations have completed.

**Cascade resolution:**
- Cascades are resolved in a single sweep top-to-bottom, left-to-right, before spawn begins. No mid-cascade chain reactions from newly formed groups.

All interactive elements: minimum tap target 44×44pt.
All game entities are placed in the Natural and Stretching thumb zones (the middle 60% of the portrait screen); the Hard zone (top 20%) is reserved for HUD only.

> For invalid action feedback (visual, audio, duration), see [Feedback & Juice](#feedback--juice).

---

## Level Generation

### Method

**Procedural** — all levels are generated at runtime from a seed. No hand-crafted levels (levels 1–3 use a tightly constrained generation profile that ensures near-guaranteed solvability).

### Generation Algorithm

**Step 1: Seed Initialization**
- Inputs: `levelNumber` (1-based integer)
- Outputs: Seeded RNG instance
- Constraints: `seed = levelNumber × 12345`. Same seed always produces the same level.

**Step 2: Difficulty Profile Selection**
- Inputs: `levelNumber`, RNG
- Outputs: `activeSpecies` (3–5 int), `moveLimit` (10–35 int), `planetCount` (0–6 int), `bouncePlanetCount` (0–3 int), `gridFillPercent` (0.75–1.0)
- Constraints:
  - Levels 1–10: `activeSpecies=3`, `moveLimit=30–35`, `planetCount=0`, `bouncePlanetCount=0`, `gridFillPercent=1.0`
  - Levels 11–30: `activeSpecies=4`, `moveLimit=20–30`, `planetCount=1–3`, `bouncePlanetCount=0–1`, `gridFillPercent=0.9–1.0`
  - Levels 31+: `activeSpecies=5`, `moveLimit=10–25`, `planetCount=3–6`, `bouncePlanetCount=1–3`, `gridFillPercent=0.75–1.0`
  - Difficulty breathes: every 5th level in a range has `moveLimit` increased by 5 (breathing room).

**Step 3: Grid Population**
- Inputs: `activeSpecies`, `gridFillPercent`, RNG
- Outputs: 7×9 array with alien species or empty per cell
- Constraints:
  - Fill cells in left-to-right, top-to-bottom order.
  - Each filled cell assigned a random species from the `activeSpecies` pool.
  - No more than 4 consecutive same-species cells in any row or column (avoid trivial mega-groups at start).
  - Empty cells (if `gridFillPercent < 1.0`) are placed at the top rows only.

**Step 4: Planet Placement**
- Inputs: Populated grid, `planetCount`, `bouncePlanetCount`, RNG
- Outputs: Grid with Rocky and Bounce Planets inserted
- Constraints:
  - Rocky Planets replace alien cells (not empty cells). Placed at least 2 cells apart.
  - Bounce Planets placed similarly; maximum 1 Bounce Planet per row.
  - No planet in the bottom 2 rows (to keep clearing routes open at game start).

**Step 5: Solvability Pre-Validation**
- Inputs: Final grid state
- Outputs: `valid: boolean`, `largestGroupSize: int`, `clearablePercent: float`
- Constraints:
  - REJECT IF `largestGroupSize < 2` (no valid move exists at level start)
  - REJECT IF `clearablePercent < 0.40` (fewer than 40% of alien cells are reachable in groups ≥ 2)
  - REJECT IF any 3×3 region contains only Rocky Planets (impassable island)

### Seeding & Reproducibility

- Seed formula: `levelNumber × 12345` (integer multiplication, no float rounding)
- The same seed is guaranteed to produce the same grid across devices and sessions.
- If the player receives a continue (extra moves), the seed is unchanged — the board state is preserved in memory.

### Solvability Validation

**Rejection conditions:**
1. No group of 2+ same-species aliens exists at game start
2. Fewer than 40% of alien cells are part of any valid tap group
3. Any 3×3 sub-region is entirely Rocky Planet cells
4. Move limit would require perfect play to solve at level 1–10 (validated by a fast simulation run: if simulated greedy solver can't clear 80%+ of aliens within the move limit, reject)

**Retry logic:**
- On rejection, increment seed by 1 (`seed += 1`) and regenerate from Step 3.
- Maximum 10 retries.

**Fallback after 10 retries:**
- Force `activeSpecies=3`, `moveLimit=35`, `planetCount=0`, `bouncePlanetCount=0`, `gridFillPercent=1.0` and regenerate once more with the original seed.

**Last-resort guarantee:**
- A 7×9 grid of 3 alternating alien species with no planets and 35 moves is always valid. This guarantee level is never shown to players but ensures no crash path exists.

### Hand-Crafted Levels

None. All levels are procedurally generated. The Level 1–10 difficulty profile (3 species, no planets, max moves) acts as a soft hand-crafted constraint to ensure new player experience quality.

---

## Game Flow

### Master Flow Diagram

```
App Open
   ↓ (assets load)
Loading Screen [BOOT]
   ↓ (load complete)
Title Screen [TITLE]
   ↓ (tap "Play" — first session only)
First-Time Intro [TITLE]
   ↓ (tap to continue)
Gameplay Screen — Level 1 [PLAY]
   ↓ (all aliens cleared OR move limit reached)
Level Complete Screen [OUTCOME]  ←→  Loss Screen [OUTCOME]
   ↓ (tap "Next")                        ↓ (tap "Try Again" or "Continue")
Gameplay Screen — Level N+1 [PLAY]   Gameplay Screen — same level [PLAY]
   ↓ (repeat until chapter goal met)
Chapter Complete Screen [PROGRESSION]
   ↓ (tap "Continue")
Title Screen [TITLE]
```

### Screen Breakdown

#### Loading Screen
- **lifecycle_phase:** BOOT
- **Purpose:** Load all assets before the game is playable.
- **Player sees:** Mars landscape illustration, animated progress bar, game logo.
- **Player does:** Nothing (passive).
- **What happens next:** Transitions to Title Screen when assets are loaded (≤ 3 seconds target).
- **Expected session time:** 0–3 seconds.

#### Title Screen
- **lifecycle_phase:** TITLE
- **Purpose:** Entry point; lets the player start playing.
- **Player sees:** Animated Mars landscape, game title, "Play" button, settings icon.
- **Player does:** Taps "Play" to start (or taps Settings).
- **What happens next:** First session → First-Time Intro. Returning player → resumes at current level on Gameplay Screen.
- **Expected session time:** 2–5 seconds.

#### First-Time Intro
- **lifecycle_phase:** TITLE
- **Purpose:** Brief 2-screen visual intro establishing setting and goal (no walls of text).
- **Player sees:** Two illustrated screens: (1) Mars colony with aliens waving, caption "They need your help!"; (2) Grid with highlighted group, caption "Tap matching aliens to launch them home."
- **Player does:** Taps to advance.
- **What happens next:** Gameplay Screen — Level 1.
- **Expected session time:** 5–10 seconds.

#### Gameplay Screen
- **lifecycle_phase:** PLAY
- **Purpose:** Core interactive level play.
- **Player sees:** 7×9 alien grid, move counter (top center), score (top right), level number (top left), pause button (top right corner).
- **Player does:** Taps alien groups to clear them. Taps combo pieces to activate them.
- **What happens next:** All aliens cleared → Level Complete Screen. Move counter reaches 0 with aliens remaining → Loss Screen.
- **Expected session time:** 2–5 minutes.

#### Level Complete Screen
- **lifecycle_phase:** OUTCOME
- **Purpose:** Celebrate the win and advance.
- **Player sees:** Animated aliens bouncing in celebration, score total, "Next Level" button.
- **Player does:** Taps "Next Level."
- **What happens next:** Gameplay Screen — next level. If level N was the final level of a chapter → Chapter Complete Screen.
- **Expected session time:** 5–10 seconds.

#### Loss Screen
- **lifecycle_phase:** OUTCOME
- **Purpose:** Gentle failure recovery — never punishing.
- **Player sees:** Sad-but-cute alien expression, "Out of moves!" text, remaining alien count, "Try Again" button, "Continue" button (costs ad or currency).
- **Player does:** Taps "Try Again" (restart level, no cost) or "Continue" (5 extra moves).
- **What happens next:** Gameplay Screen — same level (board state preserved on Continue; fresh board on Try Again).
- **Expected session time:** 5–15 seconds.

#### Chapter Complete Screen
- **lifecycle_phase:** PROGRESSION
- **Purpose:** Mark chapter milestone and motivate continued play.
- **Player sees:** Animated Mars panorama, confetti, chapter number, score, "Keep Going!" button.
- **Player does:** Taps "Keep Going!"
- **What happens next:** Title Screen (chapter score banked; next chapter begins on next play tap).
- **Expected session time:** 5–10 seconds.

### Board States

| State | Description | Input Allowed? |
|-------|-------------|---------------|
| **Idle** | Grid fully settled; no animations running | Yes — tap any cell |
| **Animating** | Aliens launching, falling, or spawning | No — all taps ignored |
| **Won** | All aliens cleared; win sequence triggered | No |
| **Lost** | Move counter = 0 and aliens remain; loss sequence triggered | No |
| **Paused** | Player tapped pause; overlay shown | Pause overlay only |

Any board-state transition that mutates visible pieces (alien launch, cascade fall, new alien bounce-in, combo explosion) is an animated transition. No state changes are instant — minimum animation duration 80ms.

### Win Condition

IF `alienCellCount == 0` AND `boardState == Idle` THEN `boardState = Won`.

### Lose Condition

IF `movesRemaining == 0` AND `alienCellCount > 0` AND `boardState == Idle` THEN `boardState = Lost`.

### Win Sequence (ordered)

1. `boardState` transitions to `Won`.
2. All remaining board cells pulse once (scale 1.0 → 1.1 → 1.0, 200ms).
3. Score tally animation runs (numbers tick up to final score, 600ms).
4. Level Complete Screen slides up from bottom (300ms ease-out).
5. Celebration aliens bounce in from edges (staggered, 400ms total).
6. "Next Level" button appears (fade in, 150ms).

### Loss Sequence (ordered)

1. `boardState` transitions to `Lost`.
2. Move counter shakes (wiggle 3× left-right, 300ms total).
3. Remaining alien cells droop (scale 1.0 → 0.9, alpha 1.0 → 0.6, 400ms).
4. Loss Screen slides up from bottom (300ms ease-out).
5. Sad alien animation plays (loop: alien slumps, 2-frame, indefinite).
6. "Try Again" and "Continue" buttons appear (fade in, 150ms, staggered 80ms apart).
