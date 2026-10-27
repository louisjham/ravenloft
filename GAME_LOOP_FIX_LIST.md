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
- **Grab-and-throw dice** — `src/components/3d/Dice3D.tsx`, `src/store/diceStore.ts`,
  `src/xr/XRInteractionBridge.tsx`, `src/components/interaction/GameController.tsx`,
  `src/components/ui/DiceAnnouncementOverlay.tsx`: hero rolls are now true
  physical rolls. The die floats in front of the player while waiting; grip (or
  trigger) grabs it and releasing it throws it with the controller's velocity.
  Trigger / space without grabbing tosses it with a random impulse. The result
  is read from the settled face via the existing `getUpFaceNumber` (verified:
  all 20 faces round-trip through `getQuaternionForNumber`). Monster/AI
  auto-rolls are unchanged (pre-rolled theater). A 15s adapter timeout remains
  as backstop. The old pre-roll + forced-face path survives only for auto-rolls.

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
5. **Alissa's card on the adventure setup screen does not match the other
   cards** (reported by Louis, Oct 24 evening). `ScenarioSetupScreen.tsx`
   special-cases her: `isSingleSided('alissa')` is true, so her Level 1 view
   shows the scan at 100% height (others use a 200% crop/rotate of a
   double-sided scan), and her Level 2 view is not a scan at all — it renders
   a synthetic "Custom Card Back" panel (dark radial gradient, gold text)
   instead of a card image. That panel also misspells her name "ALLISA"
   (data files spell her "Alissa"). Fix routes: (a) supply a real 2nd-level
   scan of her card and remove the special-case; (b) restyle the custom back
   to match the scanned cards; either way fix the spelling. Needs Louis's
   call on whether a 2nd-level scan exists.

6. **Table edge reads as a stray diagonal divider (desktop view).**
   (Reported by Louis, Oct 24 evening, with screenshots.) `TableSurface`
   is a finite 28x28 slab; on the desktop camera (position [5.5, 5.5, 5.5],
   fov 38) its far edge projects as a diagonal line across the screen, and
   beyond it is dark void (fog `#0e0a17`, page background `#050505`). The
   edge climbs on screen because it recedes from the camera — screen-up is
   farther away here, not taller. Fix directions: bigger table, a visible
   floor plane under it, or fog tuned so the edge falls off softer.
7. **Quick Reference (F1) modal does not match the rest of the UI.**
   (Reported by Louis, Oct 24 evening.) `HelpOverlay`
   (`components/tutorial/TutorialSystem.tsx`) uses `.gothic-panel`, but
   `.help-content` has no CSS rules of its own, so the heading, list, and
   button fall back to browser defaults: sans-serif white title instead of
   `.gothic-title` (Cinzel, gold), default disc bullets, flat gray button
   instead of `.gothic-button`. Fix: style the modal's elements with the
   theme classes (gothic-title on the heading, gothic-button on the button,
   themed list).

## Design calls owed by Louis (not built, not assumed)

- **The fork question.** Whether to strip the DOM UI and go XR-only is
  undecided; nothing in this list prejudges it. The DOM remains the only home
  of power selection, scenario setup, settings, menus, and the card hand.
