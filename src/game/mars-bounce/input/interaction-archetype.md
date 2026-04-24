# Mars Bounce — Interaction Archetype

## Which Interaction Type

**Tap** — single pointer-down + pointer-up on a cell. This is the one and only primary gesture.

Secondary gesture: **Modal tap-then-row/column-tap** for Rocket Alien direction selection. Still two separate taps, not a swipe — the first tap enters a modal state, the second resolves it.

## Pointer Sequence

```
pointertap on cell
  → check boardState === 'Idle'
    NO  → ignore silently (board is Animating, Won, Lost, Paused, PendingDirection)
    YES → check cellKind
            alien / bounce → floodFill from cell; check group.size
                size ≥ 2  → db.actions.executeCluster({row, col, rng})  [clears group]
                size < 2  → invalid-tap feedback (shake + thud SFX); no state mutation
            rocket         → set boardState = 'PendingDirection'
                             show ghost overlay on entire row and column
                             wait for second tap (cancel: tap rocket cell again)
            planet-buster  → db.actions.activateCombo({row, col, rng})
            cosmic-storm   → db.actions.activateCombo({row, col, rng})

pointertap on cell (PendingDirection state)
  → if cell is same as pending rocket cell: cancel (boardState → Idle, hide overlay)
  → else: determine if player tapped a cell in the rocket's row or column
      same row → db.actions.activateCombo({row, col, direction: 'row', rng})
      same col → db.actions.activateCombo({row, col, direction: 'col', rng})
      neither  → ignore (outside row/col — should not happen with 7×9 board)
```

## Direction Detection

Not applicable for primary tap. For Rocket Alien direction: determined by whether the second-tap cell's row matches the rocket's row OR the cell's col matches the rocket's col. Row takes priority on exact diagonal tap.

## Cancel Behavior

- No multi-step gesture for normal aliens — single tap is atomic.
- Rocket Alien pending-direction: tap the rocket cell again to cancel (boardState → Idle, overlay hidden). Timeout: none in core pass.
- If boardState !== Idle and a tap arrives: silently ignore.

## Invalid Gesture Feedback

| Scenario | Feedback |
|---|---|
| Solo alien tap (group size 1) | Cell shakes — 3-frame wiggle GSAP tween (±4 px, 300 ms), thud SFX plays |
| Tap during Animating/Won/Lost | Silently ignored — board is "talking" |
| Tap rocky planet | Silently ignored — not interactive |

Shake animation specs: `gsap.to(cell, { x: '+=4', repeat: 5, yoyo: true, duration: 0.05, ease: 'none' })`

## Feel Description

**Immediate and satisfying.** The game responds to each tap in < 100 ms (visual highlight before logic resolves). Group launches pop off-screen with spring energy. Invalid taps bounce back with physical weight. The world never feels dead — every touch has a reaction.

## Platform Notes

- `touch-action: none` is set on the Pixi canvas element.
- Events use Pixi's `pointertap` (unifies pointer/mouse/touch).
- Input blocked during Animating phase: checked at top of tap handler.
