# Castle Ravenloft VR — Rules Sweep — 2026-10-24

**Repo:** `C:\antigravity\ravenloft`, branch `feature/original-gothic-rebrand`.
**Coverage note on HEAD:** the combat/powers/monsters and treasure/XP/surges/villain/scenario audits ran at
`dca42a41` ("feat(log): comprehensive game chronicle overhaul"); the turn/movement/exploration/encounter
audit ran at `c39bb4ef` ("fix(3d): resolve monster 3D models…"), one commit later. That commit touches only
`src/components/3d/Monster3D.tsx` and `src/utils/modelLoader.ts` (verified via `git diff --stat dca42a41 HEAD`:
2 files, 4 insertions, 3 deletions) — no rules, turn, movement, exploration, or scenario files — so the
combined findings stand. This sweep is **report only**: no code was changed, fixed, committed, or pushed.
This file is the sweep's only deliverable, left uncommitted in the repo root.

**Pre-existing repo state at final verification (not mine, left alone):**
`M GAME_LOOP_FIX_LIST.md`, `M README.md`, `?? BUG_REPORT_2026-10-24.md`, `?? public/audio/`.
(The `scratch_check_monsters.ts` file noted at sweep start no longer appears in `git status`.)

## 1. Rules source used — and its limits

**Primary source:** the official Castle Ravenloft rulebook (Wizards of the Coast, Renegade reprint, same rules
text), read as extracted PDF text:
https://store-kftzvkkgjv.mybigcommerce.com/content/File%20Storage%20for%20site/Rulebooks/Castle%20Ravenloft/D%26D_CastleRavenloft_Rulebook_WEB.pdf

**What the rulebook text covers (verified):** turn structure (Hero → Exploration → Villain), Hero Phase action
economy, movement, Slowed/Immobilized, exploration and tile placement, Villain Phase encounter/villain/monster
order, monster tactics, attack/damage, powers (at-will/daily/utility, face-down), treasure (blessings/fortunes/
items), XP spend/cancel/level-up, healing surges, downed heroes, pick up / destroy / disable / escape actions,
win/loss conditions.

**Limits:**
- The **Adventure Book scenario-specific rules are NOT in the rulebook text**. Scenario rules below are checked
  against the code's own scenario data (`src/data/scenarios/*.json`) for internal consistency only, and are
  flagged as unverified against the original adventure text.
- Where the extracted rulebook text states no rule (tile-stack exhaustion procedure, encounter-deck reshuffle,
  edge-matching on placement beyond the triangle sentence), this report says so rather than inventing one.
- Findings are static code reads against the rulebook text, not playtests, except where a code path leaves no
  enforcement check on a player-reachable action (stated as such).
- **Rebrand mapping:** data names are rebranded (Strahd → Varkath / Karl Von Nekrula, Castle Ravenloft → The
  Shadowhold, Skull Lord → Anthraxus, etc.) but the RULES are Castle Ravenloft's. Names are mapped back below.
  One live consequence of the rebrand: three combat paths still test for the string "skull lord" and therefore
  miss the renamed Anthraxus (see Monsters table).
- **BUG_REPORT_2026-10-24.md item 7 — SETTLED:** the end-of-turn encounter draw is NOT a bug in its core
  condition. The code draws exactly when the rulebook says (no tile placed, or black-triangle tile placed) —
  see Encounters table. The genuine gap in that area is adventure_04's sunset extra draw, which is missing.
- Art/model issues (e.g. the Ghoul model mapping, fixed by `c39bb4ef`) are NOT rules issues and are excluded,
  except where a model/data mapping changes mechanics (the Anthraxus name checks above).

**Status key:** implemented / partial / missing / wrong-order / divergent / deliberate divergence (see §5).

## 2. Ranked top-10 gaps (most gameplay-critical first)

1. **Move action economy unenforced at execution** — `combatSlice.moveHero`, `useGameActions.handleMoveHero`,
   `Hero3D` drop path: neither store move nor drag-drop checks `hasAttackedThisTurn` / `isExhausted`. A hero can
   Move → Attack → Move, and keep dragging at full speed after both actions are spent. Breaks the defining
   Hero Phase choice (Move+Attack / Attack+Move / Two Moves). Display badges are correct; enforcement is absent.
2. **Exploration collapses into the Hero Phase** — manual board-arrow exploration and move auto-explore run
   while `phase === 'hero'` (the `'exploration'` phase value is never assigned anywhere). A hero can explore,
   then move onto the new tile and attack the just-spawned monster in the same turn. The rulebook order forbids
   this: the monster arrives in the Exploration Phase, after the Hero Phase attack is spent.
3. **Healed heroes stay `isDefeated=true` forever** — nothing clears `isDefeated` on heal (no `isDefeated: false`
   write for heroes anywhere except an unrelated `AbilitySystem` revive path; surge heal doesn't either). A hero
   who stands back up is ignored by monsters permanently, contradicting "stand up and act normally."
4. **`defeatedVillainIds` is never appended** — initialized to `[]` and written nowhere, so every
   `defeat_villains` objective (adv07, adv08, adv09, adv11, adv12, adv13) can never complete. adv11/adv12 also
   ignore their `targetIds`.
5. **Level-up via attack is unreachable** — `hasRolledNatural20ThisTurn` is set in exactly one place:
   `EncounterSystem.attemptDisableTrap()` on a roll of 20. No attack path sets it (`CombatSystem.resolveAttack()`
   computes `critical = roll === 20` and logs it, but never writes the flag). The Level-Up treasure card is
   gated on the same flag (`canLevelUp()`), so it is not an independent route either. Daily-power choice is a
   dead parameter: `ExperiencePanel` calls `levelUpHero(id)` with no ID and offers no picker.
6. **Villain activation order is wrong** — `villainPhaseLogic.buildVillainQueue()` queues (1) the active hero's
   monsters, (2) other heroes' same-named monsters, (3) unowned bosses, (4) the active hero's traps. Rulebook:
   villains first (each one at a time), then monsters/traps in draw order. The queue carries no draw-order
   information at all, and traps owned by other heroes are never queued in that phase.
7. **Movement ignores closed tile edges; diagonal movement is impossible** — `TileSystem.getReachableSquares`
   BFS steps only in the 4 orthogonal directions and never consults tile `connections`/`connectedTileId`, so a
   hero walks across a tile boundary where the shared edge is closed (a wall) on either side. There is no
   wall-square data at all (`Tile` has edge `connections` only; `tiles.json` has no per-square walls), so the
   square-level wall rules cannot be implemented as the data stands.
8. **No engine enforcement of range/walls/adjacency for hero attacks/powers** — the UI helper uses Manhattan
   tile distance only; `usePowerAsync` and `attackMonster` enforce nothing. Three definitions of "adjacent"
   coexist (tile-Manhattan, square-Manhattan, Chebyshev); the wall-blocking rule is missing for heroes;
   monster hardcoded overrides bypass line-of-sight.
9. **Adv06 Gravestorm never spawns** — `ScenarioManager.handleArcaneCircleReveal()` looks up
   `villain_gravestorm`, absent from `monsters.json` (real ID `monster_gravestorm`). The Laboratory tile is
   also placed at `arcane.x + 4` (not 4 tiles of graph distance, may overlap existing tiles), and no Phylactery
   is spawned on it. The `defeat_gravestorm` objective itself would match a spawned Gravestorm — moot while
   spawning fails.
10. **Defeat is checked before the Villain Phase with the outgoing hero** — `coreSlice.endTurn()` checks defeat
    before the Villain Phase using the outgoing hero as `currentHeroId`, so a hero dropping to 0 HP in their own
    Hero Phase with 0 surges loses immediately, before the Villain Phase and before anyone can heal them ahead
    of their next turn start. The rule tests 0 HP *at the start of their turn* with no surges. (The normal path
    does do the rule-correct check after the Villain Phase; the pre-Villain check is the violation.)

**Next tier (not in the top 10, still gameplay-relevant):** monster tactics hardcoded by name ignoring data,
bone-pile spawn ignored, new monsters don't activate the same Villain Phase; item bonuses summed not capped,
no starting treasure dealt, keeper choice missing at draw; scenario objectives broadly unwinnable/broken
(§4 Scenarios); treasure quota reset before the Villain Phase (second treasure possible, credited to the
outgoing hero); power kills deferred to end-of-turn processing; Villain-Phase deaths credited to the current
hero, not the striker; crits ungated (nat-20 auto-hit for everyone including monsters, no level-2 crit
ability); Slowed = half speed, not flat 2; Miss damage dropped in the generic hero-power path; utility timing
unenforced; downed-hero targeting hole (monster can select a downed hero, then waste its activation);
cancel-encounter never discards the cancelled card; Harrowed Experience XP display-only and unspendable;
escape adv04-only, immediate on click, escaped heroes keep cycling in state; manual exploration ungated at
store level (any board arrow clickable); End Turn refusal trap when no tile fits the edge; tile draw searches
the deck for a fitting tile instead of top-draw; triangle direction not modeled; disable-trap timing enforced
only in the ActionBar; encounter deck empty = silent skip; Start tile modeled as one tile, not two;
`EventSystem.checkTriggers()` never called; `ScenarioManager.checkVictory()` dead code; villain
`behaviors/*Behavior.ts` classes run only in tests; duplicate `activateMonsterEntity` in `MonsterAI.ts`
risks drift.

## 3. Resolution order — correct order vs. code order

**Rulebook order (verified):**

1. Turn start: 0-HP surge check (MUST spend a surge if available, regain surge value, then act normally;
   no surges left = lose).
2. Hero Phase: exactly one of Move+Attack / Attack+Move / Two Moves. Slowed/Immobilized markers discarded at
   the end of the Hero Phase.
3. Exploration Phase (only if on an unexplored edge space): draw ONE tile, place triangle toward that edge,
   place a monster on its bone pile (if YOU already control that type, discard and redraw; another player's
   copy is fine). Otherwise skip to the Villain Phase.
4. Villain Phase step 1: encounter draw ONLY if no tile placed OR black-triangle tile placed.
5. Villain Phase step 2: villain activation, each villain one at a time.
6. Villain Phase step 3: activate each monster/trap in draw order, following its tactics (ordered list, first
   true statement applies, then that monster's turn ends; same-name monsters each activate, including another
   player's). Newly placed monsters act in this same Villain Phase.
7. End of turn: flags reset, next hero's turn begins.

**Code order (`coreSlice.endTurn()` + `cardSlice.dismissCardResolution()` /
`cancelEncounterWithDispelMagic()` + `villainPhaseLogic.executeVillainPhase()`):**

| Step | Code behavior | Verdict |
|---|---|---|
| 1. Turn-start surge check | `ConditionSystem.processTurnStart()` during the previous turn's advance; auto-spends surge at 0 HP; defeat check catches 0 HP + 0 surges | Equivalent (auto-spend matches MUST) |
| 2. Hero Phase action economy | Tracked via `isExhausted` + `hasAttackedThisTurn`; badges display correctly | Display correct, **enforcement missing** (top-10 #1) |
| 2b. Slowed/Immobilized discard at Hero Phase end | `processTurnEnd` runs inside `endTurn` before the Villain Phase (i.e. at hero-phase end in UI terms) | Timing coincides for duration 1; formula/mechanism differ (see Movement) |
| 3. Exploration Phase | Manual arrows + move auto-explore run **during** Hero Phase; End Turn auto-explore runs at the Hero→Villain boundary | **Wrong order** for manual/move paths (top-10 #2); End Turn path sequence-faithful |
| 3b. Monster on bone pile | Exploration spawn hardcodes (2,2); all 41 tiles declare boneSquare (1,1) | **Wrong position**; log falsely claims "bone square" |
| 4. Encounter draw | `shouldDrawEncounter = chapelRevealed \|\| !placedType \|\| placedType === 'black'`, before activation; card resolution pauses, then Villain Phase runs | Correct, except adv04 sunset draw missing |
| 5. Villain activation | Unowned bosses queued AFTER owned monsters | **Wrong order** (top-10 #6) |
| 6. Monster/trap activation in draw order | Queue = insertion order for monsters, all traps last; no draw-order field; snapshot queue excludes newly placed monsters | **Wrong order**; new monsters don't act same phase |
| 7. End of turn / flags reset | All three `endTurn` paths reset flags; `turnCount` increments only on wrap | Correct, except `hasExploredThisTurn=false` + `exploredThisTurn=true` disagree mid-card-resolution (harmless: phase is `'villain'` then) |

**Additional ordering deviations (cross-cutting):**
- **Treasure quota resets before the Villain Phase** (`endTurn`: `resetTreasuresDrawn()` → victory/defeat check →
  encounter draw → `executeVillainPhase()`), so Villain-Phase kills can draw a second treasure credited to the
  outgoing hero.
- **Victory/defeat checked before the Villain Phase** in `endTurn()` — victory-before-villain is defensible (win
  the moment the objective completes), but the defeat half uses the outgoing hero and can end the game before
  the Villain Phase (top-10 #10). Victory is otherwise only noticed at `endTurn`/search, so mid-phase
  completions wait and extra Villain activations can occur after the win condition is met.
- **Exploration spawns before scenario rules run** (`spawnMonsterForExploration()` then `processPostExplore()`
  in all four exploration call sites), so every "spawn X *instead of* drawing a Monster" scenario rule
  double-spawns (normal monster + special villain).
- **Power kills deferred to end-of-turn processing** (wrong timing); Villain-Phase deaths award treasure to the
  current hero, not the striker; controller/clockwise discard rule missing (global XP pile, unconditional push).
- **Poison ticks twice per cycle** (end of own turn in `endTurn()` + start of next turn in `processTurnStart()`);
  poison is also applied after a surge heal, so a surged hero can be poisoned back to 0 and act at 0 HP with
  tokens remaining.
- **Blessing expiry at `endTurn()` before the Villain Phase** matches "end of your next Hero Phase" — correct.
- **End Turn auto-explore preserves the Hero → Exploration → Villain sequence** (a hero at an edge MUST
  explore per the rulebook; skipping would be the violation). What diverges is (a) rotation auto-picked
  (`validRotations[0]`, no player choice, unlike the manual path) and (b) the refusal trap: if the deck is
  non-empty but no tile fits the edge, `handleEndTurn` refuses to end the turn with an unfulfillable rotation
  prompt (deck literally empty proceeds normally). The fix list frames End Turn auto-explore as a design
  question owed by Louis (item 2); the move auto-explore path is the same mechanism in a worse phase position
  and is NOT in the fix list.
- **No exploration phase exists in the state machine:** the phase enum has `'exploration'` but it is never
  assigned; exploration runs while `phase === 'hero'`, and the Villain Phase has no observable phase except
  during encounter-card resolution (`'villain'` while waiting for the card; no-encounter path jumps straight
  from the ending hero to `'hero'` for the next hero). Phase order is enforced by flags and call order, not by
  the state machine — which is why the order violations above are possible at all.

## 4. Per-system tables — rule → code location → status

### Turn structure and phase order

| Rule | Code location | Status |
|---|---|---|
| Hero turn = Hero Phase → Exploration Phase → Villain Phase, in order | `coreSlice.endTurn`, `villainPhaseLogic.executeVillainPhase`, `useGameActions.handleEndTurn`, `useExplorationControls` | Wrong-order (exploration runs inside Hero Phase; no exploration phase in state machine) |
| Hero Phase: 0-HP surge check at turn start, then exactly one of Move+Attack / Attack+Move / Two Moves | `ConditionSystem.processTurnStart`; `combatSlice.moveHero` (`isExhausted` = moved once, second move consumes attack); `ActionBar` badges | Partial (surge check implemented, auto; action economy displayed but unenforced at execution) |
| End of turn: flags reset, next hero, turnCount on wrap | `coreSlice.endTurn` + `cardSlice.dismissCardResolution` / `cancelEncounterWithDispelMagic` + `resetHeroTurnFlags` | Implemented (all three paths reset; `hasExplored`/`explored` disagree mid-resolution, harmless) |
| Slowed/Immobilized discarded at end of Hero Phase | `ConditionSystem.processTurnEnd` inside `endTurn`, before Villain Phase | Partial (timing coincides only for duration 1; mechanism is duration countdown, not phase-end discard) |

### Movement

| Rule | Code location | Status |
|---|---|---|
| Speed = square budget; diagonal moves allowed counting squares | `TileSystem.getReachableSquares` (BFS, 4 orthogonal directions only); `isValidSquareMove` (Manhattan) | Wrong (diagonal impossible) |
| Cannot enter a wall square; no diagonal move between two adjacent walls | `TileSystem.getReachableSquares`; `Tile` type (`types.ts`); `tiles.json` | Missing (no wall-square data exists; edge walls also ignored — see next row) |
| Cannot cross a closed tile edge (wall between tiles) | `TileSystem.getReachableSquares` (never consults `connections`/`connectedTileId`) | Wrong (heroes walk through walls between tiles) |
| Cannot enter a monster-occupied square | `TileSystem.getReachableSquares` (`blockedSquares`) | Implemented |
| May pass through a hero's square but not end there | `TileSystem.getReachableSquares`, `useGameActions.handleMoveHero`, `Hero3D` highlight computation | Partial (passing allowed; ending there also allowed — hero squares never excluded) |
| Tile-range counting never counts diagonally | `MonsterAI.getTileGraphDistance` (BFS over connection graph) | Implemented |
| Slowed = Speed 2 | `ConditionSystem.getEffectiveSpeed` (`floor(speed / 2)`) | Divergent (Speed-6 hero gets 3, not 2; Speed-5 coincidentally gives 2) |
| Immobilized = Speed 0 | `ConditionSystem.getEffectiveSpeed`; `useGameActions.handleMoveHero` hard-blocks Immobilized | Implemented |
| Max one Slowed / one Immobilized marker each | `ConditionSystem.applyCondition` (dedupes by type) | Implemented |
| Start tile counts as two tiles for movement/counting | `tiles.json` (`start-tile`, single 4×4 entry) | Divergent (minor, undocumented; no compensation code) |

### Exploration

| Rule | Code location | Status |
|---|---|---|
| If on an unexplored edge space, draw ONE tile; else skip to Villain Phase | `TileSystem.getExplorationPoints` (open connections, no `connectedTileId`, adjacent cell unoccupied); `useGameActions.handleEndTurn` | Implemented for edge definition; phase placement wrong (see §3) |
| Place tile with triangle toward that edge | `TileSystem.getValidRotations`, `RotationPicker`; `Tile`, `tiles.json`, `TileSystem` (no triangle field anywhere) | Partial (rotation offered is connectivity-valid only; triangle direction cannot be enforced; auto paths take `validRotations[0]` with no player choice) |
| Place a monster on the tile's bone pile | `TileSystem.spawnMonsterForExploration` (hardcodes sqX 2, sqZ 2) | Wrong (all 41 tiles declare boneSquare 1,1; `placeTile` rotates the bone square, spawn ignores it; other paths — `ScenarioManager` start/lair, `AbilitySystem` — do use it) |
| If YOU already control that monster type, discard and redraw; another player's copy is fine | `TileSystem.spawnMonsterForExploration` (`activeTemplateIds` from `ownedByHeroId === currentHeroId`) | Implemented |
| Edge matching on placement (open vs wall) | `TileSystem.validateEdgeAlignment` (open-meets-wall blocked; wall-meets-open warning only, then `connectTiles` closes the new edge); `canPlaceTile` (overlap checked) | Partial, unverified against text (extracted rulebook text states no placement edge-matching rule beyond the triangle sentence) |
| Tile draw = top of stack | `TileSystem.drawAndPlace` (scans whole deck for first tile with any valid rotation for that edge, removes only it) | Divergent (undocumented; changes tile distribution; stated rationale is deadlock-avoidance, "never throws") |
| Tile-stack exhaustion handling | Manual path → `phase: 'exhausted'` + "Deck Exhausted / Accept Fate" modal (`App.tsx`); move path → silently ignored; End Turn path → refuses to end turn if deck non-empty but no tile fits | Partial / inconsistent (rulebook text read states no exhaustion/reshuffle rule; the End Turn no-fitting-tile refusal is a soft-lock-adjacent trap) |
| Set-aside / seeded tiles excluded from pool; special placements inserted | `coreSlice.startNewGame` (excludes start/set-aside/special; inserts e.g. Chapel at index 8 for adv02; lair/tome packets) | Implemented |
| Manual exploration gated to the active hero's tile/edge | `ExplorationLayer` (highlights only active hero's tile arrows) vs `useExplorationControls.onEdgeSelected` (checks only `phase === 'hero'` + `!hasExploredThisTurn`, never hero tile/square) | Partial (display gates; store does not — any board arrow clickable) |
| Newly placed monster acts in the same Villain Phase | `villainPhaseLogic.executeVillainPhase` (snapshot queue) | Missing |

### Encounters

| Rule | Code location | Status |
|---|---|---|
| Encounter draw if no tile placed OR black-triangle tile placed (Villain Phase step 1, before activation) | `coreSlice.endTurn` (`shouldDrawEncounter = chapelRevealed \|\| !placedType \|\| placedType === 'black'`); `cardSlice.dismissCardResolution` runs Villain Phase after card resolves | Implemented (core condition correct — BUG_REPORT item 7 settled, not a bug) |
| White-triangle tile placed → no encounter draw | Same condition | Implemented |
| Adv02 Chapel rule: once Chapel revealed, every hero draws an encounter at Villain Phase start | `coreSlice` init (`chapelRevealed=false` only when `setAsideTileIds` includes `named_chapel` — only adv02); `ScenarioManager.processPostExplore` sets it on `named_chapel` placement; `endTurn` forces draw | Implemented, correctly adv02-scoped in practice |
| Adv04 sunset rule: after sunset, draw an encounter at Villain Phase start | `ScenarioManager` time track sets `strahdAwakened` at max; `shouldDrawEncounter` does NOT include it | Missing (adv04 wants sunset ⇒ encounter draws; generic track instead fires Strahd awakening) |
| Encounter deck empty | `coreSlice.endTurn` guards `length > 0`; `EncounterSystem.drawEncounterCard` returns `card: null` | Partial, unhandled-silent (no reshuffle rule found in rulebook text read — flagged, not a confirmed violation) |
| No player-triggerable double draw | `cardSlice.drawEncounterCard` (store action, no UI button found) | Implemented (no double-draw path; card-effect draws are separate and out of scope) |
| XP-cancel an encounter only when drawn, before applying (see also XP table) | `EncounterCardOverlay` Cancel button renders only in phase `revealing` | Implemented in practice via UI gate; store function itself unchecked (see XP table) |

### Combat

| Rule | Code location | Status |
|---|---|---|
| d20 + bonus ≥ AC = hit, per target | `CombatSystem.resolveAttack`, `combatSlice.attackMonster` | Implemented |
| Miss effects apply if listed | Generic hero-power path; card `when: miss` effects; monster path | Partial (Miss damage dropped in generic hero-power path; works only via card effects or monster path) |
| Natural 20 = critical (2nd-level hero ability only; enables level-up spend) | `CombatSystem.resolveAttack` (auto-hit nat 20 for every attacker at every level, no damage effect); `ExperienceSystem.hasCriticalAbility` (level ≥ 2) | Divergent (unconditional auto-hit incl. monsters; `hasCriticalAbility` has zero callers; attack nat-20 never sets level-up flag — see XP table) |
| Damage, HP, heal cap, defeat | `CombatSystem.applyDamage` / `applyHealing`; defeat = flag, not array removal | Implemented |
| Defeat monster → controller discards card to Experience Pile | `TreasureSystem.processDefeatedMonsters` (global pile, unconditional push; killer/controller not tracked) | Partial (pile exists; controller/clockwise rule missing; Villain-Phase deaths credited to current hero, not striker) |
| Defeating hero draws ONE Treasure Card per turn max | `TreasureSystem.drawTreasureCard` (`treasuresDrawnThisTurn >= 1` refuses) | Implemented, with order caveat (quota resets before Villain Phase — see §3) |
| Monster HP/AC values | `data/monsters.json` vs `ExperienceSystem` header comment table | Divergent, unresolved (Skeleton 1 vs 2, Zombie 1 vs 3, Ghoul 2 vs 3, Wolf 1 vs 2, Gargoyle 2 vs 5; Wraith 5, Blazing Skeleton 3, Spider 1, Rat Swarm 1 match — one side needs a card check) |
| Targeting: range, walls, adjacency enforced | `usePowerAsync`, `attackMonster`, UI tile-Manhattan helper | Missing (no engine enforcement; three "adjacent" definitions; wall-blocking missing for heroes; monster overrides bypass line-of-sight) |

### Powers

| Rule | Code location | Status |
|---|---|---|
| At-will never flips face-down; Daily/utility flip face-down after use until an effect flips them back | `PowerSystem` / `CombatSystem` flip handling incl. flip-back | Implemented |
| Utility timing (reactions, hero-phase gating) | `PowerSystem` | Partial (reactions auto-trigger in Villain Phase; rest ungated in Hero Phase) |
| Power kills resolve at kill time | `TreasureSystem.processDefeatedMonsters` (end-of-turn processing) | Wrong-order (deferred to end of turn) |
| New Daily power on level-up (choice) | `ExperienceSystem.levelUpHero(heroId, newDailyPowerId?)`; `ExperiencePanel` (calls with no ID, no picker) | Partial (parameter exists; choice never happens in practice) |

### Monsters

| Rule | Code location | Status |
|---|---|---|
| Tactics: ordered list, first true statement applies, then that monster's turn ends | `MonsterAI.resolveTactic` (hardcoded by monster name, ignoring `monsters.json` behavior/tactics text) | Divergent (not the generic first-true model) |
| Same-name monsters each activate, including another player's | `villainPhaseLogic.buildVillainQueue` (same-named monsters of other heroes queued) | Implemented in queue construction; order vs villains/traps wrong (see §3) |
| Monster movement respects Slowed/Immobilized | Monster movement code | Missing (ignores both entirely) |
| Monster attacks: roll, miss damage, closest-hero movement, intercepts | `villainPhaseLogic.resolveMonsterAttacks`, `MonsterAI` | Implemented (Shield/Bodyguard/Parry/Yield intercepts in order) |
| Special abilities (Ghoul claws, Gargoyle stone form, Mummy Rot, Death Shriek, Explosive, Incorporeal, Swarm, Shifty) | Various hardcoded paths; `MonsterAI` | Partial (some hardcoded; Death Shriek/Explosive defined but never dispatched on death; Incorporeal/Swarm/Shifty inert; Ghoul immobilize only on move-then-attack branch, not adjacent-attack branch) |
| Skull Lord (Anthraxus) mechanics | Three combat paths testing `'skull lord'` | Wrong (name checks dead after rebrand rename) |
| Monsters ignore downed heroes | `villainPhaseLogic.resolveMonsterAttacks` (skips hp ≤ 0 / `isDefeated`); `MonsterAI.findClosestHero` (filters only `!removedFromPlay`) | Partial (live attack loop skips; target selection can still pick a downed hero, wasting the activation; Skull Lord retargets; duplicate `MonsterAI` attack routine ~line 1246 lacks the hp skip — latent risk) |
| Villain tactics (Strahd two-phase fight, etc.) | `BossPhases` (`game/ai/BossPhases.ts` + `data/boss-phases.json`) via pre-`resolveTactic` transition + boss-tactics step | Partial (live path works via BossPhases; dedicated `game/ai/behaviors/*Behavior.ts` classes wired only into `game/ai/MonsterAI.ts`, imported by tests only — dead in gameplay; villains otherwise use generic monster move/attack) |
| Duplicate monster-activation implementation | `villainPhaseLogic.activateMonsterEntity` vs `MonsterAI.ts` copy | Divergent (drift risk; villain-phase loop is the live path) |

### Treasure, items, fortunes, blessings

| Rule | Code location | Status |
|---|---|---|
| Draw 1 Treasure Card per turn max (on defeating a monster) | `TreasureSystem.drawTreasureCard`, `processDefeatedMonsters` (first defeated monster per turn only; later defeats that turn go to XP pile, draw nothing) | Implemented, with order caveat (quota resets before Villain Phase; `tokenSlice.searchToken` resets quota before coffin draw, bypassing quota) |
| Starting treasure dealt | `coreSlice.startNewGame` (builds/shuffles deck, deals nothing; heroes copied from `heroes.json` with `items: []`) | Missing (heroes start with zero treasure cards) |
| Blessings: play immediately, benefit all heroes, discard at end of next Hero Phase | `TreasureSystem.useBlessing`, `checkBlessingExpiry` (called from `coreSlice.endTurn`; expires end of drawing hero's next turn, purges dead heroes' blessings) | Implemented |
| Blessing effects (Heroic Stand +1 attack per monster on tile; Rejuvenating Onslaught heal 1 on hit; Guided Strikes +2; Run! +2 speed) | `CombatSystem.resolveAttack` (hardcoded); `ConditionSystem.getEffectiveSpeed` (Run!) | Implemented, except Surround Them! (see next row) |
| Surround Them!: +1 attack/+1 damage per hero on tile | `CombatSystem.resolveAttack` (flat +1 attack/+1 damage; never counts heroes on tile) | Divergent / simplified (card data effect is `attack_bonus_per_hero_on_tile`) |
| Fortunes: immediate effect, discard immediately | `TreasureSystem.useFortune`, `resolvePendingFortuneAsync` + `FortuneResolutionModal` | Implemented (incl. Moment's Respite sentinel, Daze, Lucky Find draw-3-keep-1 with kept card exempt from quota) |
| Items: keeper chosen on draw; cannot re-gift | All auto draw paths assign to current hero (`processDefeatedMonsters`, `cardSlice.drawTreasureCard`, `EncounterSystem` treasure draws, `tokenSlice.searchToken` coffin treasure); `cardSlice.assignItem(cardId, heroId)` accepts any hero | Missing at draw (no keeper-choice UI in `TreasureCardPanel`/`useTreasurePanel`); re-gift guard missing (store allows reassignment, though no UI feature exposes it) |
| Only one attack bonus and one defense bonus from items at a time | `TreasureSystem.getHeroItemBonuses`, `CombatSystem.getEffectiveAC` (both sum all bonuses) | Divergent (Magic Sword + Ring of Accuracy = +2 attack; Holy Avenger sums own +1 and +3 to +4; damage/speed/passives also summed, which the rule does not restrict) |

### Experience points and level-up

| Rule | Code location | Status |
|---|---|---|
| XP pile: defeated monsters' cards, spendable as currency | `TreasureSystem.processDefeatedMonsters` (shared `experiencePile`); `ExperienceSystem.getXpValue` (looks up `monsters.json`, defaults unknown IDs to 1 XP, dev warning only; template derivation can misfire for nonstandard instance IDs) | Implemented, with lookup risk (see Combat table for data-vs-comment value disagreements) |
| Spend 5 XP (cards summing ≥ 5, excess wasted) to cancel an encounter ONLY when drawn, before applying | `ExperienceSystem.cancelEncounterCard` (greedy largest-first, no player choice of which cards); `EncounterCardOverlay` Cancel button (only while `revealing`) | Partial (timing holds in practice via UI; store function ignores its `cardId` argument, never checks it matches the revealed card, and never discards the cancelled encounter card — it vanishes; Dispel Magic path does discard and correctly continues the Villain Phase when `pendingEncounter` is set; adv03 `xp_cancel_penalty` implemented) |
| Level up on natural 20 attack OR disable-trap roll by spending 5 XP: flip hero card, +2 HP, +1 AC, +1 surge value, new Daily power, critical-attacks ability | `ExperienceSystem.levelUpHero` (+2 max HP, heal 2 capped, +1 AC, surge +1 via derived `getSurgeValue`, level ≥ 2 ⇒ +1; field never mutated, consistent since only that getter and a setup display read it) | Partial, trigger broken (attack nat-20 never sets `hasRolledNatural20ThisTurn` — only `attemptDisableTrap` does; flag correctly cleared each turn by `resetHeroTurnFlags`; Daily choice dead parameter; crit ability has no level-gated implementation — see Combat table) |
| Level-Up treasure card as a route to level up | `TreasureSystem.processFortuneLevelUp` (requires `canLevelUp()`, i.e. the nat-20 flag) | Divergent (a Level-Up fortune drawn without a nat-20 that turn is discarded with "Not enough XP…" even with ≥ 5 XP in the pile; spends only monster-pile XP) |
| Harrowed Experience XP spendable | `TreasureSystem.processHarrowedExperience` (records 1 XP in `fortuneXpEntries`; `getTotalXP` counts it) | Divergent (display-only: `canCancelEncounter`, `cancelEncounterCard`, `levelUpHero`, `cureMummyRot` spend only from `experiencePile`) |

### Healing surges, hero death, revival

| Rule | Code location | Status |
|---|---|---|
| Group begins with TWO shared surge tokens (1 = harder, 3 = easier variants) | `coreSlice.startNewGame` (`healingSurges = scenario.maxSurges`; live scenarios use 2 almost everywhere, s3 legacy uses 1, adv07 uses 0 per its own `no_healing_surges` rule; no live scenario uses 3) | Implemented (scenario-driven counts; adv07's 0 is plausibly deliberate — see §5) |
| Hero at 0 HP at start of turn MUST spend a surge (regain surge value, then act normally); none left = lose | `ConditionSystem.processTurnStart` (auto-spends, heals `getSurgeValue()` incl. level-2 +1; no tokens ⇒ leaves hero at 0, caller's `checkDefeat` fires) | Implemented (auto-spend matches MUST; caveats below) |
| Surge-heal ordering vs poison | `ConditionSystem.processTurnStart` (poison applied AFTER surge heal) | Wrong-order (surged hero can be poisoned straight back to 0 in the same turn-start and then act at 0 HP with no re-surge; defeat check only fires if surges are now 0) |
| Downed hero: figure stays knocked down, monsters ignore, cannot take damage or use powers/items, conditions still apply | `villainPhaseLogic.resolveMonsterAttacks` (skip); `CombatSystem.applyDamage` (clamps at 0 only); `combatSlice.moveHero`/`attackMonster` (no HP guard); `PowerSystem` (gates only on stunned); `processTurnEnd`/poison (no 0-HP exemption) | Partial (monsters-ignore mostly in live path with targeting hole — see Monsters; no state-level no-damage/no-powers enforcement; conditions-on-downed consistent) |
| Healed before turn start = stands up and acts normally | `applyHealing`, surge heal, `processTurnStart` (none clears `isDefeated`) | Missing / broken (see top-10 #3; `hasUsedSurgeThisTurn` set by surge is wiped by `resetHeroTurnFlags` — dead flag, no reader) |
| Poison timing (card-defined effect, not core rulebook) | `coreSlice.endTurn` + `ConditionSystem.processTurnStart` | Wrong-order smell (ticks twice per round cycle: end of own turn + start of next turn) |

### Villain rules

| Rule | Code location | Status |
|---|---|---|
| Distinct Villain step: villains first, each one at a time | `villainPhaseLogic.executeVillainPhase` (single function: `buildVillainQueue` + one `for` loop + `processDefeatedMonsters`; no separate villain step) | Missing as a step; wrong-order in queue (top-10 #6); multi-villain sequential-in-state but batch presentation (known fix-list item 1, not re-reported as new) |
| Villains act every Villain Phase regardless of whose turn it is | `ScenarioManager.spawnLairVillain`, `triggerStrahdAwakening` (spawned bosses `isBoss=true, ownedByHeroId=null`, re-queue every phase) | Implemented |
| Villain-specific mechanics | `BossPhases` live path; `behaviors/*Behavior.ts` test-only | Partial (see Monsters table) |
| Spawned lair/arcane villains enter the villain queue | `processPostExplore` pushes onto `villainPhaseQueue`, but `executeVillainPhase` overwrites it with `buildVillainQueue()` | Partial (harmless in practice since unowned bosses re-queue; appended queue is dead state) |

### Other actions

| Rule | Code location | Status |
|---|---|---|
| Pick up objects: adjacent, Hero Phase, no action, any number, even while passing | None (`TokenSystem.searchToken` / `tokenSlice.searchToken` is a different mechanic: same tile, not adjacent; discrete search action; marks searched/revealed) | Missing (no generic pickup; `handleMoveHero` performs no pickup check along the path) |
| Destroy objects: target like a monster if it has AC/HP | None (no object entity with AC/HP; no attack-an-object action; destroy-targets modeled as monsters: `monster_klaks_artifact`, `monster_gravestorms_phylactery`; tile-wide powers iterate only `monstersOnTile`) | Missing as a generic action |
| Disable traps: on trap's tile, instead of attacking, roll ≥ disable number; nat 20 also enables level-up | `EncounterSystem.attemptDisableTrap` (via `tokenSlice.disableTrap`; `ActionBar` gate `phase === 'hero'` + `!hasAttackedThisTurn`); success at `card.disableDC \|\| 10` (falls back to 10 if card lacks `disableDC`); sets `hasAttackedThisTurn` on success AND failure; nat 20 sets level-up flag — the only working trigger | Implemented (roll mechanics + timing semantics); timing enforced only in the ActionBar — `attemptDisableTrap` itself checks only same-tile position (tile-level, matching rulebook phrasing), no phase/attack check |
| Escape: on specified location at end of Hero Phase → no more Hero/Exploration/encounter draws, but still Villain Phase | `coreSlice.escapeHero` (sets `escaped: true` immediately on click, not end of Hero Phase); `ActionBar` escape UI hardcoded to adv04 + start tile + phase `hero`; `endTurn` never filters escaped heroes from `turnOrder` | Partial (immediate instead of phase-end; escaped hero keeps cycling in state, UI-only filtering; controlled monsters/traps still activate — accidentally matches the Villain-Phase half; no-more-draws half not implemented in state; other scenarios' escapes are objective checks only) |

### Win / loss conditions

| Rule | Code location | Status |
|---|---|---|
| Win = adventure objective completed | `Objectives.checkObjectives` (victory = every objective `isCompleted`); checked inline in `coreSlice.endTurn` before Villain Phase and in `tokenSlice.searchToken`; `ScenarioManager.checkVictory` has no store caller (dead code; logic duplicated inline) | Partial (evaluation exists; timing late for mid-phase completions — see §3; adv01/adv10 stairway timing divergences in Scenarios table) |
| Lose = 0 HP at turn start with no surges | `ScenarioManager.checkDefeat` (all non-escaped heroes at 0 HP and no surges, OR current hero at 0 HP and no surges) | Partial (rule-correct check exists in the normal post-Villain path and the Dispel path; pre-Villain outgoing-hero check can end the game early — top-10 #10) |
| Adventure-specific defeat conditions | `checkDefeat` (no adventure-specific hook) | Missing (adv09 "5 monsters escape ⇒ lose", s3 collapse countdown have no defeat code) |

### Scenarios (data in `src/data/scenarios/*.json` vs `ScenarioManager` / `Objectives.ts`)

Objective-type coverage in `Objectives.ts`: `kill_boss, find_tile, all_at_position, escape_via_stairway,
possess_icon, clear_chapel_monsters, defeat_klak, destroy_artifact, escape_with_treasures, cure_kavan,
defeat_gravestorm, find_coffin, interact` (brazier only), `collect_items` (crown_shard only), `defeat_villains`
(counts `defeatedVillainIds` only, ignores `targetIds`), `find_event`. **No case:** `defeat_specific_monster`
(Tome), `escort` (s5). `EventSystem.checkTriggers()` is never called — all trigger-based legacy rules are dead
even where trigger evaluation exists. `ScenarioManager.processPostExplore` (called after
`TileSystem.spawnMonsterForExploration()` in all exploration paths) handles only: white-tile time-track advance
+ Strahd awakening, lair-villain spawns, Arcane Circle (adv06), Chapel-revealed flagging — so every
"spawn X *instead of* drawing a Monster" rule below double-spawns.

| Scenario | Objective / special rules → status |
|---|---|
| adv01 Escape the Tomb (2 surges) | `escape_via_stairway`: timing-divergent (completes whenever the current hero stands on the stairway at an `endTurn`/search check, not "starts their turn" there — step-on-and-end wins without surviving a Villain Phase). `sun_track`: implemented (white-tile advance; at 6, Strahd awakens on the start tile's bone pile; adv01's start tile IS the Crypt, placement right). |
| adv02 Find the Icon (2) | `possess_icon`: implemented (holds `treasure_icon_ravenloft`). `clear_chapel_monsters`: unwinnable (`targetIds` empty in JSON; `Objectives` sets `isCompleted=false` in that branch). `chapel_threat`: implemented structurally (`endTurn` forces encounter draw whenever `chapelRevealed`). |
| adv03 Klak's Infernal Artifact (2) | `xp_cancel_penalty`: implemented. `gain_powers` (discard a Treasure on a white-tile explore to gain a power): missing. Cross-contamination: `defeat_klak` matches any ID starting `monster_klak`, incl. `monster_klaks_artifact` — killing the artifact alone can complete both objectives. Klak has no spawn path (XP 0, excluded from random deck, no lair/placement code). |
| adv04 Daylight Assault (2) | `escape_with_treasures` (count 12): unwinnable as coded (counts held `treasure_*`-prefixed items; only 5 such item cards exist: icon, healing potion, silver dagger, skull, portrait; blessings/fortunes never sit in `items`). `daylight_assault_sunset`: wrong + missing (generic time-track at max fires Strahd awakening; adv04 wants sunset ⇒ encounter draws; no sunset-encounter code). `daylight_assault_escape`: partial (see Other actions). |
| adv05 The Final Transformation (2) | `cure_kavan` (fountain tokens → 0): missing in full (only init exists: `fountainTokens=5`, Kavan token on start tile). `kavan_escort` and `kavan_transformation`: no code; nothing decrements `fountainTokens` — objective can never complete. |
| adv06 Destroy the Dracolich (2) | `arcane_circle_spawns`: broken (see top-10 #9; plus double-spawn). `defeat_gravestorm`: would match a spawned Gravestorm — moot. `destroy_phylactery`: partial/divergent (no attack-adjacent-to-Lab action; `HeroPanel.handleUsePhylactery` lets a hero HOLDING `item_gravestorms_phylactery` deal 10 damage directly, targeting checks `templateId === 'monster_dragolich'` or name containing 'gravestorm' — both fail for rebranded "Varkath" spawned via lair path with no `templateId`). |
| adv07 Adventure Impossible (0) | `lair_villains` spawn: partial (lair packet deck build + `processPostExplore` lair pairing work, with double-spawn). `defeat_villains` (count 3): unwinnable (top-10 #4). `no_healing_surges` + `hero_succession`: missing and contradicted (generic `checkDefeat` declares defeat as soon as any hero sits at 0 HP at a checked boundary, instead of completing the Villain Phase, moving the next roster hero to the Start tile, losing only when the last hero dies with < 3 villains defeated). |
| adv08 Horror of the Howling Hag (2) | `defeat_villains` (count 1) + `interact` (count 5, time tokens): both unwinnable (`defeatedVillainIds` bug; `interact` brazier-only vs `targetAttribute: 'time_token'`). `no_start_tile`, `hag_teleport`, `arcane_circle_time_tokens`: all missing (start tile IS the Arcane Circle structurally, but Start-tile encounter discard/replace has no code; adv06 arcane handler does not apply here). |
| adv09 Gauntlet of Terror (2) | `defeat_villains` (count 20): unwinnable (same bug). `monster_tokens_face_down`, `monsters_move_to_exit`, `start_tile_hp` (5 HP on Start tile; 5 escapes ⇒ lose): all missing (no monster-token, exit-movement, Start-tile-HP, or adventure-defeat state). |
| adv10 Blood and Fog (2) | `escape_via_stairway` (ALL heroes escape via Secret Stairway): divergent, too easy (completes when the CURRENT hero alone stands on the stairway — does not require all heroes or the `escaped` flag). `undead_no_xp_cancel`: missing (cancel/level-up spend never distinguish undead). `rotting_nook_boss`: missing (no `named_rotting_nook` code; tile exists in data). `secret_stairway_escape`: missing as an escape action (no `escapeHero` gate for adv10; objective check only). |
| adv11 Rampaging Golem (2) | `defeat_villains` (count 1, `targetIds: [monster_flesh_golem]`): unwinnable + target ignored. `workshop_boss`, `item_tokens` (take an Item token instead of a Treasure draw), `golem_calming` (pacify instead of attacking): all missing. |
| adv12 Hunt for Nekrula Pt 1 (2) | `defeat_villains` (count 2, `targetIds: [monster_strahd]`): unwinnable + target ignored. `arcane_circle_bodyguard`, `secret_stairway_strahd`, `black_arrow_items`: all missing. `stahd_removed_crypt` (sic, data spelling): works structurally (`crypt_strahd` in `setAsideTileIds`, excluded from deck build). |
| adv13 Hunt for Nekrula Pt 2 (2) | `defeat_villains` (count 1) + `interact` (count 10, coffins): both unwinnable (`defeatedVillainIds` bug; `interact` brazier-only vs `targetAttribute: 'coffin'`). `coffin_tokens`, `coffin_investigation`, `coffin_healing`, `crypt_reveal_strahd`: all missing (coffin-token placement in `TokenSystem` only runs for s1 scenario IDs). |
| adv_tome The Tome of Nekrula (2) | `defeat_specific_monster` (guardian): no `Objectives` case — never auto-completes. Substitute: manual `HeroPanel` end-game button declaring victory iff any hero holds `item_tome_of_strahd`, regardless of guardian defeat. Rest largely implemented: setup packet (top 3 + Crypt after 12th tile), black-triangle item tokens from shuffled stack (`TileSystem` place-tile path), guardian spawn from villain stack on Crypt reveal (`spawnMonsterForExploration`), end-turn-adjacent item-token reveal (`endTurn` Tome block). `tome_of_strahd_scouting`: implemented but dead (`HeroPanel.handleScoutTile` spends `hero.xp`, a field starting at 0 and never increased anywhere — real XP lives in `experiencePile` — so `canScout` is always false). |
| s1 Find Nekrula's Coffin (2) | Mostly implemented: coffin deck, per-tile placement (`placeCoffinOnNewTile`, s1 IDs only), search/reveal, Strahd's-coffin victory. Gap: on the 4th coffin searched, `searchToken()` only sets `strahdAwakened = true` — does NOT spawn Nekrula (data trigger says he spawns on the nearest unexplored edge). |
| s2 Reset the Beacon (2) | `interact` brazier (count 4): counter exists, but brazier tokens are never placed (only type + counter) — unwinnable in practice. `fog_wraiths` (Wraith every 3rd tile reveal): missing (`EventSystem` trigger evaluation exists but is never called). |
| s3 Escape the Dungeon (1) | `find_tile` exit + `all_at_position` exit: generic mechanics exist, but NO exit tile exists in `tiles.json` (41 tiles; no exit tile) — both objectives unreferenceable. `collapse_countdown` (defeat at turn 20): missing (`coreSlice` creates a `timeTrack {0, 6}` by string-matching 'collapse', but nothing advances it or defeats at max, and 6 ≠ data's 20). |
| s4 Hunt for the Crown (2) | `collect_items` crown_shard (count 3): counter exists (`item_crown_shard` in `items`), but NO shard exists or is ever assigned (`shard_bearers` assign-to-3-random-bosses has no code; no `item_crown_shard` card/token created anywhere) — unwinnable in practice. |
| s5 Rescue the Adventurer (2) | `find_event` torture chamber: mechanic exists generically, but NO `torture_chamber` tile exists in `tiles.json` — first objective unreferenceable. `escort`: no `Objectives` case. `relentless_pursuit` (2 Zombies/turn after rescue): no code. |

**Scenario-manager structural notes:** `coreSlice.startNewGame()` correctly honors `setAsideTileIds`,
`specialTilePlacements` (insert indices), lair packet construction, and the Tome packet.
`processPostExplore()`'s lair matching uses `placedTile.id.startsWith(p.lairTileId)` and its Chapel check uses
`startsWith('named_chapel')` — fine for named tiles.

## 5. Deliberate divergences (not bugs — for Louis's call)

- **Adv07's 0 surges** matches its own `no_healing_surges` text; what is missing is the accompanying hero-
  succession rule, so the net effect is harsher than the written scenario, not necessarily a wrong number.
- **Automatic (non-optional) surge spending** matches the rule's "MUST" and is the only sane implementation for
  a solo digital game. The 0-HP surge check being automatic rather than a player choice is likewise reasonable;
  the rulebook leaves no other option at 0 HP.
- **End Turn auto-explore is a design question owed by Louis** (fix-list item 2), not a decided divergence —
  and its sequence is actually faithful (a hero at an edge must explore); only its rotation auto-pick and its
  failure refusal diverge.
- **Surround Them! as flat +1** (data says per-hero-on-tile) and **greedy largest-first XP spending with no
  card choice** are simplifications that may be deliberate UX choices; they diverge from a strict reading but
  are not crashes.
- **XP data values differing from the `ExperienceSystem` comment's table** (Skeleton/Zombie/Ghoul/Wolf/Gargoyle)
  could reflect actual card values the comment got wrong — needs a rulebook/card check before calling it a bug.
- **Deck-search tile drawing** (scan for a fitting tile instead of top-draw), **Start tile modeled as one tile**
  instead of two, and the **duration-based condition model** are undocumented simplifications, not recorded
  decisions — listed as gaps/divergences in §4, not as "deliberate," because no design decision in repo docs or
  the fix list states them.
- **Move auto-explore** is not mentioned in the fix list at all; it reads as implementation convenience, not a
  decision.
- **The rebrand** (names only) changes no rule.
- **In the turn scope, no documented deliberate divergence was found at all** — no stated design decision in
  `GAME_LOOP_FIX_LIST.md`, the bug report, or code comments deliberately overrides a rulebook rule there.

## 6. Known items deliberately NOT re-reported as new

- Villain-phase batch staging / no per-monster AI-card staging (fix-list item 1) — its *ordering consequences*
  (villains after monsters, traps last, no draw order) ARE reported above because they are order violations, but
  the staging presentation issue itself is the fix list's.
- End Turn auto-explore as a design question (fix-list item 2) — order analysis of it is reported (§3); the
  design question itself remains Louis's.
- Dice timeout surfacing; dice arena placement check; Alissa setup card; table-edge divider; F1 modal CSS
  mismatch — untouched.
- Ghoul-as-Warrior model mapping — a model issue, fixed by `c39bb4ef`, not a rules issue.

## 7. Caveats

- The turn/movement/exploration findings were verified against HEAD `c39bb4ef`; combat/treasure findings
  against its parent `dca42a41`. The intervening commit touches only 3D model files, so cross-scope findings
  are comparable, but if the audit target was strictly `dca42a41`, the turn files should be diffed for
  completeness (the turn auditor judged a difference there unlikely given the commit's file scope).
- The rulebook PDF text extraction interleaves diagrams/sidebars; every rule cited was verified against the
  extracted prose, but a rule could exist in a part of the rulebook not seen (e.g. adventure-book text, which
  was not in the supplied PDF). Tile-draw procedure, edge-matching asymmetry, and exhaustion handling are
  flagged with that uncertainty.
- Scenario rules are checked for internal consistency against the code's own scenario data only, not against
  the original Adventure Book (not in the rulebook PDF).
- Static code reads only; no playtesting. The drag-after-attack finding (top-10 #1) is a code-path conclusion
  (no enforcement check exists on that path), not a playtested exploit.

## 8. Key files (repo-relative)

- Turn flow: `src/store/slices/coreSlice.ts` (`startNewGame`, `endTurn`, `escapeHero`, `levelUpHero`),
  `src/store/slices/cardSlice.ts` (cancel paths, `dismissCardResolution`), `src/store/slices/tokenSlice.ts`
  (search/disable/escape-adjacent), `src/hooks/useGameActions.ts` (auto-explore on End Turn, move auto-explore),
  `src/hooks/useExplorationControls.ts` (manual arrows), `src/components/ui/EncounterCardOverlay.tsx` (cancel
  only while `revealing`), `src/components/ui/ActionBar.tsx` (disable-trap gate, adv04-only escape button),
  `src/components/ui/HeroPanel.tsx` (Tome manual end-game, phylactery button, dead scouting button),
  `src/components/ui/ExperiencePanel.tsx` (level-up button, no daily-power picker).
- Movement/exploration: `src/game/engine/TileSystem.ts` (`getReachableSquares`, `getExplorationPoints`,
  `spawnMonsterForExploration`, `drawAndPlace`, `validateEdgeAlignment`, `placeTile`, `canPlaceTile`),
  `src/game/types.ts` (phase enum, `Tile`), `src/data/tiles.json` (41 tiles, all declaring boneSquare 1,1).
- Combat/powers/monsters: `src/game/engine/CombatSystem.ts` (`resolveAttack`, `applyDamage`, `applyHealing`,
  `getEffectiveAC`), `src/store/slices/combatSlice.ts` (`moveHero`, `attackMonster`),
  `src/game/engine/PowerSystem.ts`, `src/game/engine/MonsterAI.ts` (`resolveTactic`, `findClosestHero`,
  `getTileGraphDistance`, duplicate `activateMonsterEntity`), `src/store/slices/villainPhaseLogic.ts`
  (`buildVillainQueue`, `executeVillainPhase`, `activateMonsterEntity`, `resolveMonsterAttacks`),
  `src/game/ai/BossPhases.ts` + `src/data/boss-phases.json`, `src/game/ai/behaviors/*Behavior.ts` (test-only),
  `src/game/ai/MonsterAI.ts` (test-only import), `src/data/monsters.json`.
- Treasure/XP/surges: `src/game/engine/TreasureSystem.ts` (draw, blessings, fortunes, items,
  `processDefeatedMonsters`, `getHeroItemBonuses`, `processFortuneLevelUp`, `processHarrowedExperience`),
  `src/game/engine/ExperienceSystem.ts` (`getXpValue`, `cancelEncounterCard`, `levelUpHero`, `canLevelUp`,
  `hasCriticalAbility`), `src/game/engine/ConditionSystem.ts` (`processTurnStart`, `processTurnEnd`,
  `getEffectiveSpeed`, `applyCondition`), `src/game/engine/EncounterSystem.ts` (`attemptDisableTrap`,
  `activateTrap`, `drawEncounterCard`, treasure-granting cards), `src/game/engine/TokenSystem.ts` (`searchToken`).
- Scenarios/objectives: `src/game/scenarios/ScenarioManager.ts` (`checkDefeat`, `checkVictory`,
  `processPostExplore`, `handleArcaneCircleReveal`, `spawnLairVillain`, `triggerStrahdAwakening`),
  `src/game/scenarios/Objectives.ts`, `src/game/scenarios/Events.ts` (never called),
  `src/data/scenarios/*.json`, `src/data/cards/treasures.json`.
