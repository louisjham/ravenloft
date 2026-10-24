# Game loop fix list — from Aleph's Oct 24, 2026 audit

Read-only audit of the loop (turn clarity, control deliberateness, combat, dice).
Nothing here is a design decision — those are Louis's. This is the ticket list.

## Done (safe, additive, no engine/store logic changed)

- **Treasure sparkle** — `src/xr/cards/PhysicalCard3D.tsx`: drei `<Sparkles>`
  (50 soft-gold points) on `card.type === 'treasure'` cards that aren't used up.
  Follows the card when grabbed/inspected. Tune with `count` / `size` / `opacity`.
- **In-world dice prompt** — `src/components/3d/Dice3D.tsx`: a billboarded text
  above the drop point during `announcing` / `waiting_for_roll` (skipped for
  auto-rolls). The DOM announcement overlay does not render in-headset, so
  without this a hero roll waited silently for a trigger press nobody announced.
- **HUD turn-order pips** — `src/xr/hud/XRTabletopHUD3D.tsx`: VR twin of the
  desktop TurnIndicator dots (gold = current hero). Sits above the HUD bar.

## Corrected findings (earlier audit claims, fixed by reading the code)

- The active-hero ring, light pillar, emissive gold pedestal, and the billboard
  reading "ACTIVE HERO — YOUR TURN" **already exist** in `Hero3D.tsx`. The
  turn banner / ring items from the first audit are therefore already built —
  the pips above replace them as the actual gap (turn *order*, not turn *signal*).
- **The dice are cheap.** One sphere physics body, one static ground plane,
  static tile boxes, a 60-vertex cached d20, a 20–60 mesh dismiss burst that
  lives ~100ms, 50 ambient fire points. The old "CPU killer on web" reputation
  does not match the current code.
- **XR already sheds the expensive bits.** `Scene.tsx` disables EffectComposer
  (Outline/Vignette) while presenting, and shadow-casting is gated off in XR
  too. If Quest frames get tight, look at model/texture weight, not the dice.

## Next, in suggested order (not yet built)

1. **Villain phase staging.** `executeVillainPhase` (`store/slices/villainPhaseLogic.ts`)
   runs every monster/trap in one batch pass; the log is currently the only
   witness. Stage it one monster at a time, showing its monster-AI card first
   (the card tells the player what the monster will do — the game's own pillar
   doing structural work), with the acting piece highlighted.
2. **End Turn must only end the turn.** `useGameActions.handleEndTurn` currently
   auto-explores (draws + places a tile, first valid rotation, spawns a monster)
   when the hero hasn't explored and stands at an edge — and refuses to end
   when placement is ambiguous. Explore should be its own explicit choice with
   its own confirmation. Needs Louis's design call on what End Turn does when
   the hero hasn't explored.
3. **Surface the dice timeout.** `CombatAdapter` resolves a hero attack with a
   silent direct roll after 15s if the player never rolls. With the in-world
   prompt in place this should rarely fire; consider a visible countdown or a
   shorter window rather than silent resolution.
4. **Dice arena placement check.** The die drops near the current hero's piece
   (hero position + 1.0 offset). Confirm in-headset that the drop point and
   the new prompt are actually in the player's view during combat — do not
   move the arena blind.

## Design calls owed by Louis (not built, not assumed)

- **Grab-and-throw dice.** Current flow pre-rolls the result (`playerRoll`
  picks the number, physics is theater, settle forces the die to the pre-rolled
  face via `getQuaternionForNumber`). True grab-and-throw needs: die spawns in
  the air in front of the player, `Interactive` grab (pattern exists in
  `PhysicalCard3D`), release enables physics with throw velocity, settle
  detection (exists), and result read from the settled orientation — the
  inverse of `getQuaternionForNumber`, computable from the exported
  `faceNormals` + `FACE_TO_NUMBER` in `D20Geometry.ts`. Desktop trigger/space
  and monster auto-roll stay as fallbacks. A new `held` dice phase and a
  paused/timeout rule while held are part of the design.
- **The fork question.** Whether to strip the DOM UI and go XR-only is
  undecided; nothing in this list prejudges it. The DOM remains the only home
  of power selection, scenario setup, settings, menus, and the card hand.
