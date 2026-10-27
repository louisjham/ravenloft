# Ravenloft Fix Tracker

Living document. Every open bug or required fix gets one entry: an explanation
and a paste-ready prompt for the coding agent. Paste one prompt at a time.

**How to use:** pick an Open item, paste its prompt to the coding agent, playtest
the fix, then move the item to Fixed (never delete entries — history matters).
**Guardrails on every prompt:** `npm run build` must stay green; no gameplay or
rules change unless the item explicitly says so; do not commit or push (Louis
stages and pushes). Direction: AR-first; VR stays as a toggle inside the AR
build, not a separate version in parity; desktop stays the dev/playtest surface.
No prompt here forks anything.

**Scope:** this tracker covers the bug report's open items, the Oct 24 fix list,
and Oct 25 playtest findings. NOT duplicated here (tracked separately, pending
triage): the rules-sweep gaps in `RULES_SWEEP_2026-10-24.md` (top 10 + order
violations); the rebrand sweep (HELD by Louis); unboxing removal (needs his
final confirm); UI improvements (needs his pain points); the Icon rename (his
call); the tabletop-to-digital/AR improvements pass (queued behind his Todoist
run). Last updated: Oct 25, 2026.

## Open — ready to prompt

### 1. Tabletop too small — dungeon runs into the visible edge / void
(Bug report items 2–3: table-edge divider + edge "goes up".)

**Explanation:** `TableSurface.tsx` uses `TABLE_SIZE = 28` with a 26.8-unit top
plane, and tiles are 4 units (`TILE_SIZE` in `Tile3D`), so the table only fits
about 6 tiles across before the dungeon hits the visible edge. Beyond it is dark
void + fog, which reads as a "wall" / diagonal divider. The "goes up" part is
perspective: the desktop camera looks down at the table from a corner, so
screen-up reads as farther away, not taller. Scenarios draw from tile piles
(`src/data/scenarios/*.json`), not a fixed layout, so the size must be derived
from the data.

**Prompt:**
```
Replace the current tabletop with a wood tabletop large enough for any castle
configuration the game can realistically create. Current state: TableSurface.tsx
uses TABLE_SIZE = 28 with a 26.8-unit top plane, and tiles are 4 units
(TILE_SIZE in Tile3D), so the table only fits about 6 tiles across before the
dungeon runs into the visible edge and the dark void beyond it (fog 22-52).

What to do:
- Derive the size from the game data, not a magic number: total the tile piles in
  src/data/scenarios/*.json, take the largest scenario's pile total, and size the
  tabletop to fit that many tiles laid in the worst realistic shape plus a
  2-tile margin on every side. Minimum 12x12 tiles (48 units) even if the math
  says less.
- Make it read as wood: warm wood-toned top surface with a finished edge trim.
  Use an existing wood texture in the repo if one is present, otherwise a
  procedural wood-toned material (color + roughness, no new asset downloads).
- Kill the visible edge problem, not just the table: add a floor plane extending
  well beyond the table that fades into the existing fog, so from any camera
  angle (desktop orbit, VR, future AR passthrough) the eye never finds a hard
  edge or void drop.

Do not change tile placement, physics, camera, controls, or any game rule.
Verify with npm run build. Do not commit or push.
```

### 2. Distant backdrop dressing reads as ghost artifacts
(Bug report item 4.)

**Explanation:** `TavernProps3D` (barrels, desk, chair, altar) and the
`DungeonChamber` dressing (WallTorches, HangingSkeletons) sit around the
tabletop and read as unexplained ghost shapes in the distance, especially
through fog. They are already hidden in VR, and they will not be part of the AR
build, so keeping them on desktop only preserves a version no longer being
maintained.

**Prompt:**
```
Remove the distant backdrop dressing from the scene in ALL views (desktop and
XR), not just VR. Currently TavernProps3D (barrels, desk, chair, altar) and the
DungeonChamber dressing (WallTorches, HangingSkeletons) sit around the tabletop
and read as unexplained ghost shapes in the distance, especially through fog.
They are already hidden in VR, and they will not be part of the AR build, so
keeping them on desktop only preserves a version we are no longer maintaining.

What to do:
- Remove the TavernProps3D mount and the WallTorches / HangingSkeletons dressing
  from the scene. Leave the component files on disk (reversible); just unmount
  them.
- Keep everything that serves the dungeon itself: table, tiles, tokens, heroes,
  monsters, and lighting that lights the play area.

Do not change gameplay, camera, or controls. Verify with npm run build.
Do not commit or push.
```

### 3. F1 Quick Reference modal is unthemed
(Bug report item 5.)

**Explanation:** The `HelpOverlay` in `components/tutorial/TutorialSystem.tsx`
(heading "Quick Reference (F1)") uses `.gothic-panel`, but `.help-content` has
no CSS rules anywhere, so the heading, list, and buttons fall back to browser
defaults instead of the theme. `.help-screen` lives at `index.css:400`.

**Prompt:**
```
Fix the Quick Reference (F1) modal so it matches the game's gothic theme.
Currently the HelpOverlay in components/tutorial/TutorialSystem.tsx (heading
"Quick Reference (F1)") uses .gothic-panel, but .help-content has no CSS rules
anywhere, so the heading, list, and buttons fall back to browser defaults
instead of the theme. .help-screen lives at index.css:400.

What to do:
- Apply the existing theme classes to the help content: .gothic-title (Cinzel,
  gold, uppercase, 2px letter-spacing) for the heading, .gothic-button for
  buttons, and matching themed list styling. Add .help-content rules to
  index.css if the existing classes alone do not cover it.
- Change no text, no content, no keybindings.

Verify with npm run build and by opening the F1 modal. Do not commit or push.
```

### 5. No sound — ambient blocked at mount + SFX unwired
(Louis playtest question, Oct 25, 2026.)

**Explanation:** Ruled out: all 13 audio files present at manifest paths,
volumes non-zero (master 0.8, music 0.6, sfx 1.0), `DUMMY_MODE` false,
`AudioReactComponent` mounted (`App.tsx:125`). Three causes: (1) ambient
`dungeon_loop` plays exactly once, on mount, before any user gesture, so
Chrome's autoplay policy blocks it and nothing ever retries — real bug;
(2) `SoundLibrary` exists with every sound mapped but has ZERO call sites in
`src` — SFX (tile, dice, cards, combat, UI) are unwired, silent by omission;
(3) `MusicSystem` scores only setup (`main_theme`), boss (`boss_theme`), and
end (stop) — hero/exploration/monster phases have no music by current code
structure. Cause (3) is a design call (see Blocked item 11), not part of this
prompt.

**Prompt:**
```
Fix the game's silence: two gaps, no new assets, no gameplay changes.

1. Ambient never recovers from the autoplay block. AudioReactComponent calls
   playAmbient('dungeon_loop') once on mount, before any user gesture, so the
   browser blocks it and nothing retries. Add a resume path: on the first user
   gesture (pointerdown/keydown), if the ambient element exists and is paused,
   call play() again. The loop must actually be audible during play after that
   first gesture.

2. Sound effects are unwired. SoundLibrary (src/audio/SoundLibrary.ts) maps
   tilePlace, diceRoll, cardDraw, cardPlay, hit, spell, hurt, death, click, and
   hover to AudioManager.playSound, but nothing in src calls SoundLibrary.
   Wire each one to the game action it names: tile placement, dice rolls, card
   draws/plays, combat hits, spell casts, hero hurt, monster death, and UI
   clicks. Do not change any game rule or timing; sounds fire on the existing
   action paths.

Verify with npm run build. Do not commit or push.
```

**Follow-on (after this item lands; NOT part of the prompt above):**
Spatial audio. `src/audio/SpatialAudio.ts` already exists (36 lines:
three.js `AudioListener` on the camera plus `PositionalAudio` sources via
`createPositionalSource`, defaults refDistance 5 / maxDistance 20) but has
zero call sites. Once the base sound wiring above is in, wire positional
sources to 3D objects (monsters, tiles, treasure) so cues come from their
board position. Same helper serves AR and VR. Immersion win, not a
competition blocker. Do not pull it into this item.

### 10. Alissa setup card — wrong treatment + misspelled name
(Bug report item 1.)

**Explanation:** In `ScenarioSetupScreen.tsx`, Alissa is special-cased: Level 1
shows her scan at 100% height while other heroes use a 200% crop/rotate of a
double-sided scan, and Level 2 renders a synthetic "Custom Card Back" panel
(dark radial gradient, gold text) that misspells her name "ALLISA". Checked
Oct 25: `public/ui/heroes/` holds only `alissa_card.jpg` (plus portraits
`alissa.png` / `alissa-old.png`) — no distinct 2nd-level scan file exists, so
the fix uses existing art unless Louis later supplies a true 2nd-level scan
(he owns the physical cards).

**Prompt:**
```
Fix the Alissa setup card. In ScenarioSetupScreen.tsx, Alissa is special-cased:
Level 1 shows her scan at 100% height while other heroes use a 200% crop/rotate
of a double-sided scan, and Level 2 renders a synthetic "Custom Card Back"
panel (dark radial gradient, gold text) that misspells her name "ALLISA".
Checked: public/ui/heroes/ holds only alissa_card.jpg (plus portraits
alissa.png / alissa-old.png) — no distinct 2nd-level scan file exists.

What to do:
- Fix the "ALLISA" typo.
- Make Level 1 match the other heroes' presentation (200% crop/rotate treatment
  of the scan).
- For Level 2, reuse her existing alissa_card.jpg with the same scan treatment
  as the other heroes, since no distinct 2nd-level art exists in the repo. Do
  not invent art.
- If Louis later supplies a true 2nd-level scan, it should be droppable into
  this same slot.

Verify with npm run build and the setup screen for Alissa at both levels.
Do not commit or push.
```


## Blocked — needs Louis's call before a prompt

### 12. Hero-phase music: silence by code, intent unknown
**Explanation:** `MusicSystem` scores only setup (`main_theme`), boss
(`boss_theme`), and end (stop). Hero/exploration/monster phases have no music
by current code structure. If Louis wants music there, the prompt is: loop
`main_theme` during hero/exploration phases, with `boss_theme` overriding while
a boss is active, stopping on end; verify with `npm run build`; do not commit
or push. If silence is intentional, this item closes with no work.

### 13. End Turn auto-explore — design call
(Fix list item 2.)
**Explanation:** Pressing End Turn while the hero stands at an explorable edge
silently auto-explores: it draws the tile, places it with `validRotations[0]`,
spawns a monster, then ends the turn. The rules sweep narrowed this: the
sequence itself is rules-faithful (a hero at an edge must explore), so the
genuine issues are only the rotation auto-pick and the failure-refusal
(refusing to end the turn when placement is ambiguous). Questions for Louis:
(a) auto-pick the rotation, or require the player to choose it? (b) on
placement failure, keep refusing to end the turn (current), or something else?
No prompt until he decides.

## Fixed / settled — reference, do not re-report

- **Right-hand show/hide gesture latched (Item 18) — FIXED.**
  1. Replaced continuous per-frame pose polling in CardHandDock3D.tsx with a persistent latched toggle state (isDockVisibleRef).
  2. Implemented edge-triggered gesture detection with dwell gating (>= 120ms sustained palm-up) and hysteresis re-arming (< 0.20 neutral release). Tactile haptic feedback fires on toggle.
  3. Decoupled dock visibility from live tracking frames so cards stay put away across arbitrary hand movements and tracking updates until the next deliberate show gesture.
  4. Verified with pm run build (0 errors).

- **Reset All view & object placement button — FIXED.**
  1. Added `resetAllVersion: number`, `resetAllRequested: boolean`, and `requestResetAll()` to `uiStore.ts`.
  2. Implemented dynamic scene-start snapshotting across all interactive systems (captured immediately after setup completes, avoiding hardcoded positions that setup can change):
     - `XRTabletopRig.tsx`: Snapshots post-setup playspace transform (`worldPos`, `worldRotY`, `worldScale`); restores table and board back to the player's initial view upon Reset All.
     - `XRTabletopHUD3D.tsx`: Snapshots initial spatial command bar position; restores bar position and upright player-facing orientation. Added clearly labeled "RESET ALL" button (`subtext="view & items"`).
     - `Scene.tsx`: Snapshots desktop camera and `OrbitControls` focus target; restores view on desktop.
     - `Hero3D.tsx`: Restores hero miniature visual transform to legal board square `(worldX, 0, worldZ)` and releases mid-drag state.
     - `Dice3D.tsx`: Releases grab and restores d20 die to `spawnPosition`.
     - `PhysicalCard3D.tsx`: Releases grab, dismisses inspection mode (`isInspecting = false`), and restores card to original layout coordinates.
     - `GrabbablePiece3D.tsx`, `PhysicalTile3D.tsx`, `PhysicalToken3D.tsx`, `GrabbableBox3D.tsx`: Dismisses inspection and returns to base placements.
  3. Reset is strictly view and placement only: game rules, turn phase, monster AI, card deck state, HP, and scenario progress remain 100% untouched. Board pinch/grab locomotion mechanics in `XRTabletopRig.tsx` preserved without modification.
  4. Verified with `npx tsc --noEmit` (0 errors), `npx tsx runTests.ts` (all test suites passed), and `npm run build` (exit code 0).

- **Sticky grabs in AR hand tracking (Item 15) — FIXED.**
  1. Diagnosed root causes:
     - `@react-three/xr` v8 `InteractionManager` relies exclusively on raycasting from the targeting ray (`direction: [0, 0, -1]`). When an object is grabbed and held in hand, the ray shoots forward from the wrist into space away from the held object, causing `hoverState[handedness].has(object)` to become false (`onBlur` fires). When the user opens their pinch, WebXR dispatches `selectend`, but `triggerEvent("onSelectEnd")` discards the event because the object is no longer in `hoverState`. The grab state remains latched indefinitely.
     - Grabbable objects lacked per-frame polling of pinch/grip state in `useFrame`, unlike `XRTabletopRig.tsx` (which checked `hand.inputState.pinching` directly every frame and playtested as perfect).
     - Lack of re-grab debounce allowed hand tracking confidence jitter or post-release finger twitch near an object to immediately snatch it back.
  2. Implemented unified XR Grab Manager (`src/xr/XRGrabManager.ts`):
     - `isHandPinching`: Checks `hand.inputState.pinching` and validates physical joint distance between `index-finger-tip` and `thumb-tip` (ensuring release when fingers open beyond 3.0 cm).
     - `getPinchPos`: Calculates the physical fingertip pinch midpoint, holding objects naturally between fingers in hand tracking.
     - `isGrabActive`: Evaluates active pinch/grip status every frame in `useFrame` (at 90Hz). If the hand opens or controller buttons are released, drops the object on the exact frame with zero delay.
     - `recordGrabRelease`: Enforces an 180ms re-grab lockout per hand/controller to eliminate noisy re-grabs from hand-tracking confidence flicker without delaying the release itself. Requires a confirmed fresh pinch gesture to pick up an object again.
  3. Integrated across all 8 grabbable 3D entities in the codebase:
     - `Hero3D.tsx` (gameplay hero miniature: grab, drag to move/attack, instant drop)
     - `Dice3D.tsx` (d20 physical throw with velocity calculation on release)
     - `PhysicalCard3D.tsx` (in-hand 6DoF card inspection and placement)
     - `GrabbablePiece3D.tsx` (showcase/gallery hero and monster miniatures with scaling)
     - `PhysicalTile3D.tsx` (dungeon tiles in showcase/unboxing)
     - `PhysicalToken3D.tsx` (game tokens in showcase/unboxing)
     - `GrabbableBox3D.tsx` (game box and lid)
     - `XRTabletopHUD3D.tsx` (spatial HUD bar repositioning)
  4. Preserved `XRTabletopRig.tsx` board pinch/grab movement completely without modification or regression.
  5. Verified with `npx tsc --noEmit` (exit code 0), `npx tsx runTests.ts` (all test suites passed), and `npm run build` (exit code 0).

- **Title screen and adventure setup in AR (Item 14) — FIXED.**
  1. Identified AR entry path in `src/xr/XRInteractionBridge.tsx`: removed auto-start `useEffect` that bypassed setup and mounted the board on headset entry.
  2. Integrated the desktop setup flow into AR as 3D spatial panels: created `src/xr/menus/XRSpatialSetupPanels.tsx` which renders inside `<XRTabletopRig>`. When entering AR, Title Screen (`MainMenu`) is presented first in 3D above the tabletop.
  3. Clicking "Begin Adventure" (or opening the 3D box tray in `XRMainMenu3D`) transitions to the Adventure Setup spatial panel (`ScenarioSetupScreen`). Reused 100% of existing setup logic, scenario selector (all 18 adventures), hero cards with Level 1/2 flips, power card selections, and game settings (healing surges, animation speed, roll speed, graphics quality).
  4. Game play does not start and the 3D dungeon board does not mount until the player completes setup and confirms "Start Adventure". The setup panel dismisses, `gameState.phase` transitions to `'hero'`, and the 3D board, figures, and dice mount on the tabletop.
  5. Verified clean compilation with `npx tsc --noEmit`, full integration test suite with `npx tsx runTests.ts`, and production build with `npm run build`.

- **Bone pile rulebook compliance (Item 11) — FIXED.** Audited all monster placement and tactics movement paths against the official Castle Ravenloft rulebook. Reconciled disparate implementations to use the tile's rotated `boneSquare`:
  1. `TileSystem.getRotatedBoneSquare`, `TileSystem.isSquareOccupied`, and `TileSystem.getBoneSquareOrEmpty` added as the unified rules-layer authority.
  2. Fixed exploration spawn (`TileSystem.spawnMonsterForExploration`) from hardcoding `sqX: 2, sqZ: 2` to placing on the tile's rotated boneSquare, falling back to an unoccupied square on the tile if occupied; preserved the exploration control rule (discard and redraw if already controlling that type; another player's copy is fine).
  3. Fixed `EncounterSystem.spawnMonsterOnTile` from hardcoding `sqX: 2, sqZ: 2` to placing on the rotated boneSquare with occupied fallback, and wired control rule checks for drawn monsters. Fixed 5 bottom-draw tile instantiation sites to compute rotated `boneSquare` using `TileSystem.rotateBoneSquare`.
  4. Fixed `ScenarioManager.ts` start tile Strahd awakening and lair villain spawns to use `TileSystem.getBoneSquareOrEmpty` instead of `?? 0` fallback.
  5. Fixed `AbilitySystem.ts` summon ability from `?? 2` fallback to `TileSystem.getBoneSquareOrEmpty`; multi-monster summons now cascade to empty squares on the tile rather than stacking.
  6. Implemented monster tactics movement rule in `MonsterAI.ts` (`findBestLandingSquare`): when moving from tile to tile, monster moves to the tile's rotated bone pile if empty, else anywhere on the tile. Tile-to-tile range counting preserved via BFS graph distance (not bone-pile-to-bone-pile).
  7. Audited encounter card data and confirmed zero encounter cards reference bone pile squares (Grave Dirt / Idol of Strahd do not exist in the deck); no encounter cards were invented or changed.
  8. Verified full test suite including new 7-point suite in `test_bone_pile.ts`. Build and tests green.
- **Auto-roll dice arena placement (Item 9) — FIXED.** Verified placement in desktop and VR views. Previously, `diceStore.ts` and `Dice3D.tsx` hardcoded fallback positions to `[0, 0, -6]` in the dark fog/void, `Dice3D` only queried `currentHeroId` (misaligning monster attacks against other party heroes), and auto-rolls failed to pass the final rested die position upon settlement, causing the in-world 3D result billboard to float over empty ground. Updated `ARENA_POSITION` and fallback to `[2.0, 0.1, 2.0]` (center of the start tile), aligned drop focus to the target/attacker/active-hero entity, and wired exact settle positions for auto-rolls so the 3D result billboard directly crowns the landed die across desktop and Quest VR views.
- **Dice timeout resolves silently (Item 8) — FIXED.** When a dice roll timeout fires in `CombatAdapter.resolveAttackAsync` (15s for interactive hero rolls, 3s for auto-rolls), the fallback direct resolution now explicitly surfaces to the player: a Chronicle combat log entry is recorded with a fresh sequential ID stating the roll timed out and was auto-resolved for attacker vs target, and an on-screen warning toast is dispatched via `useUIStore.addNotification`. No changes were made to timeout durations, fallback logic, or dice math.
- **Villain Phase staged entity by entity (Item 7) — FIXED.** Replaced the single batch pass with staged queue execution via `executeVillainPhaseStaged` in `villainPhaseLogic.ts`. For each entity in the villain queue, its AI card (token, name, tactics text, special ability, progress index) is presented via `VillainPhaseOverlay` for 2.2s before the entity acts on the board. Actions (movement, attacks, sounds, damage logs) then resolve with clear table visibility, followed by turn transition to the incoming hero. Maintained pure synchronous `executeVillainPhase` for headless unit tests.
- **Chronicle duplicate React keys (Item 6) — FIXED.** Root cause was conflicting ID conventions (`counter + 1` pre-increment vs `counter++` post-increment vs stale base state writeback) across systems. Unified on the majority convention `id = String(counter + 1), counter = counter + 1` and routed all writers across engine systems (`TileSystem`, `EncounterSystem`, `ConditionSystem`, `MonsterAI`, `TreasureSystem`, `ScenarioManager`), store slices (`combatSlice`, `coreSlice`, `powerSlice`, `villainPhaseLogic`), and UI action hooks through `LogUtils.ts` (`addLogEntry` / `addLogEntries`). Duplicate React key warnings eliminated in exploration, monster draws, traps, and stealth actions.
- **Encounter cards logged to Chronicle (Item 4) — FIXED.** Whenever an encounter card is drawn (during exploration or Villain Phase), one Chronicle entry is written containing title, full verbatim lore/flavor text, and the resolution outcome (effect applied, trap/monster spawned, cancelled by 5 XP, or cancelled by Dispel Magic). Added a dedicated '📜 Encounter' category and tab in the Chronicle (alongside All / Fight / Rooms / Magic / Villain), and implemented the single log-id discipline via `LogUtils.ts` (`addLogEntry`) to ensure sequential, unique React keys.
- **Ghoul renders as a Warrior — FIXED in `c39bb4ef`.** Root cause was
  `Monster3D.tsx:364` passing `monsterType` ("Undead") into the model lookup,
  so all 61 monsters fell back to knight.glb. Now resolved by
  `templateId || id || name || monsterType`; 41 monsters render authentic
  models, 20 legitimately fall back to the knight (no dedicated .glb).
- **Encounter end-of-turn draw — SETTLED by the rules sweep.** The core
  condition is correct (draw when no tile placed, or black-triangle tile
  placed). The genuine nearby gap is adv04's missing sunset extra draw —
  tracked in the sweep, not here.
- **Table-edge "goes up" (bug report item 3) — same as item 1.** Perspective,
  not a separate bug; covered by the tabletop prompt.
