<img src="https://r2cdn.perplexity.ai/pplx-full-logo-primary-dark%402x.png" style="height:64px;margin-right:32px"/>

# Can  you verify these files are correct and identify any changes that need to be made?

Here's a full review of all four files with identified issues and recommendations:

***

## `constants.ts` — Minor Issues

The file is mostly clean but has two redundant constants:[^1_1]

- **`TILE_SIZE` and `TILE_SIZE_SQUARES` are duplicates** — both equal `4`. Pick one name and use it consistently across the codebase. `TILE_SIZE_SQUARES` is more descriptive and self-documenting.
- **`CENTER_OFFSET` and `EDGE_OFFSET` are both `2.0`** — if these are intentionally the same value, they should be merged into a single constant (e.g., `HALF_TILE_OFFSET`). If they're semantically different, add a comment explaining why.
- **`PHASES` is missing `'villain'`** — the `GamePhase` type in `types.ts` includes a `'villain'` phase, but `GAME_CONSTANTS.PHASES` only lists `['hero', 'exploration', 'monster']`. This will cause `GamePhaseType` to be narrower than `GamePhase`, creating a type mismatch.[^1_2]

***

## `dataLoader.ts` — Critical Bug

There is a **broken singleton pattern** — the `getInstance()` method is missing a closing brace, causing all subsequent methods to be nested inside it. The code as shown should be:[^1_3]

```typescript
public static getInstance(): DataLoader {
  if (!DataLoader.instance) {
    DataLoader.instance = new DataLoader();
  }
  return DataLoader.instance; // <-- closing brace for the `if` is missing
}
```

Additionally:

- **`scenariosData` is imported but never used** — `../data/scenarios.json` is imported at the top but the `scenarios` array is populated from the individual `adventure_0X` / `scenarioX` imports instead. Remove the unused import to avoid confusion.[^1_3]
- **`adventure07` is missing** — `GameState` in `types.ts` references `defeatedVillainIds`, `heroSuccessionQueue`, and `lairVillainPairings` which are clearly "Adventure 7" fields, but `adventure_07.json` is never imported.[^1_2]

***

## `GameEngine.ts` — Logic \& Type Issues

Several problems here:[^1_4]

- **`CardSystem` constructor is using `dungeonDeck` for both `ability` and `monster` decks** — this is flagged with a `// Placeholder mapping` comment, but it's a real bug. These should use separate deck arrays from `GameState` if they exist, or the comment should be upgraded to a `TODO` with a ticket reference.
- **`'villain'` phase is unhandled in `processTurn()`** — the `switch` statement covers `hero`, `exploration`, and `monster`, but `GamePhase` also includes `'villain'`, `'end'`, `'victory'`, and `'defeat'`. At minimum add a `default` case that logs a warning.
- **`explorationPhase()` always transitions to `'monster'`** — it sets `this.state.phase = 'monster'` unconditionally, even when `heroTileEdge` is `null` (i.e., the hero isn't at an open edge). The phase transition should likely only happen after exploration resolution, not as a fallback.
- **`Tile` and `Card` are imported but never used** — both appear in the import line but are not referenced anywhere in the class. TypeScript will warn on `noUnusedLocals`.[^1_4]
- **`monsterPhase()` skips the `'villain'` phase** — after monsters act, `nextHero()` is called which jumps directly to `'hero'`. Per the `GamePhase` type, `'villain'` should come before `'monster'` (or after, depending on your rule order).

***

## `types.ts` — Minor Improvements

The file is well-structured overall:[^1_2]

- **`Die.sides` is typed as a literal `20` not `number`** — `sides: 20` makes the field read-only and immutable. If you ever want to support other die types (d6, d8, etc.), change it to `sides: number`. If d20 is the only die, rename the interface to `D20` for clarity.
- **`SpecialRule.effect` is typed `any`** — the comment says "Could be typed later." Given the existing richness of `Effect`, `AbilityEffect`, and `Objective`, this could reasonably be typed now as `Effect | Effect[]` or a dedicated `RuleEffect` union.
- **`MonsterAbility` is referenced in `Monster` but `MonsterAbility` is defined *after* `Monster`** in the file — TypeScript handles this fine, but for readability the `MonsterAbility` interface should be declared before `Monster`.
- **`GameState` is partially visible in the snippet** but `powerSelections` field lacks proper array initialization note — `PowerSelection[]` is properly typed, but the comment `// One entry per hero, populated at game initialization.` appears orphaned (no field follows it in the visible output). Confirm the associated field (`heroPowerSelections`?) wasn't accidentally deleted.

<div align="center">⁂</div>

[^1_1]: constants.ts

[^1_2]: types.ts

[^1_3]: dataLoader.ts

[^1_4]: GameEngine.ts


---

# I want to make sure I understand the Ravenloft board game rules so I can know I am implementing them correctly in the game. Please provide a comprehemnsive walkthrough of the game rule and indicate any tricky parts for porting to a digital version.

This is a comprehensive game with some genuinely tricky rules interactions. Here is a full walkthrough, organized by system, with digital porting notes throughout.

***

## Game Overview \& Win/Loss Conditions

Castle Ravenloft is a fully cooperative game — all players win or lose together. You win by completing the adventure-specific objective (e.g., kill the boss, find an artifact, escape). You lose if **any Hero starts their turn at 0 HP with no Healing Surge tokens remaining**. This loss condition is critical to implement correctly: the check happens at the **start of the downed hero's turn**, not at the moment they hit 0, giving other heroes a window to heal them first.[^2_1]

> ⚠️ **Digital Porting Note:** The defeat check is deferred, not immediate. A hero at 0 HP is in a "downed but alive" limbo state — they cannot take damage, cannot use powers, and monsters ignore them, but conditions like Slowed/Immobilized still apply. You need a distinct `isDefeated` vs `isAt0HP` state distinction, which your `types.ts` partially handles with `isDefeated?: boolean` but needs a dedicated `isDown` flag.[^2_1]

***

## Turn Structure

Every player's turn consists of exactly three sequential phases:[^2_2][^2_1]

**1. Hero Phase → 2. Exploration Phase → 3. Villain Phase**

These always happen in this order with no skipping. Your `GamePhase` type includes a `'villain'` phase but your `processTurn()` switch in `GameEngine.ts` doesn't handle it — this is a critical bug referenced in the previous review.

***

## Hero Phase

The hero performs exactly **one of three action pairs**:[^2_1]

- Move → Attack
- Attack → Move
- Move → Move (double move)

Movement is measured in **squares** (each tile is 4×4), and heroes can move diagonally between squares. Key movement restrictions: you cannot enter a wall square, cannot enter a monster's square, can pass through a friendly hero's square but cannot end there, and cannot squeeze between two diagonally adjacent walls.[^2_1]

> ⚠️ **Digital Porting Note:** There are **two completely different distance systems** in this game. Square-counting allows diagonals; tile-counting does **not** allow diagonals and counts around tiles. Many powers and monster tactics specify range in tiles (e.g., "within 1 tile"), and you must path along cardinal tile adjacencies for that measurement. Your `manhattanDistance` function in `GameEngine.ts` uses raw X/Z coordinates, which is fine for squares but incorrect for tile-range checks — you need a separate tile-graph pathfinder.[^2_1]

***

## Conditions

Only two conditions exist in the base rules:[^2_1]

- **Slowed:** Speed reduced to 2. Expires at the end of your Hero Phase.
- **Immobilized:** Speed reduced to 0. Expires at the end of your Hero Phase.

Both conditions expire at the **end of the Hero Phase** each turn — not at the start of the next turn, and not at the end of the full turn. Your `types.ts` has a richer `ConditionType` union with `poisoned`, `dazed`, `weakened`, `stunned`, and `frightened`, which are expansions likely coming from your adventure data rather than the base rulebook.[^2_1]

> ⚠️ **Digital Porting Note:** The flowchart confirms conditions are cleared after monster defeats as well. Make sure your condition cleanup logic fires in both places.[^2_2]

***

## Power Cards

There are three power types:[^2_1]


| Type | Flip After Use? | Strength |
| :-- | :-- | :-- |
| At-Will | No — reusable every turn | Weakest |
| Daily | Yes — flip face-down, locked until reset | Strongest |
| Utility | Yes — flip face-down, locked until reset | Non-attack effects |

Utilities are used **during your Hero Phase** but don't consume the attack action — they have their own timing specified on the card. This is a commonly misimplemented rule: a utility like *Healing Word* can be played on your turn in addition to your Move+Attack combo.[^2_1]

***

## Exploration Phase

Exploration only triggers if **your hero is standing on an unexplored edge space** — a tile edge that has no wall and no adjacent tile. If not, skip straight to the Villain Phase.[^2_1]

When you do explore:[^2_1]

1. Draw a dungeon tile and orient it with its **triangle arrow pointing toward the edge you're exploring from**
2. Draw a Monster Card and place the monster figure on the **bone pile** of the new tile
3. If you already control that same monster, draw again until you get a different one (another player owning the same monster is fine)

> ⚠️ **Digital Porting Note:** Tile placement orientation is the hardest part to automate. The arrow on the tile must point toward the connecting edge. In your current `Tile` type you have `rotation: 0 | 90 | 180 | 270` which is correct, but your placement algorithm needs to compute the required rotation based on which edge triggered exploration and what the tile's default arrow direction is. Also, **tiles can sometimes have edge conflicts** — your `EdgeConflict` type in `types.ts` is well-designed for this.

***

## Villain Phase

The Villain Phase has three ordered steps:[^2_2][^2_1]

**Step 1 — Draw an Encounter Card** if you didn't place a dungeon tile, OR if the tile you placed had a **black triangle** (more dangerous tiles always trigger an encounter even when exploring).[^2_1]

**Step 2 — Activate the Villain**, if one is in play per the scenario rules.[^2_1]

**Step 3 — Activate all Monster and Trap Cards you personally control**, in the order you drew them. If you and another player both control a Kobold, you activate **both** Kobolds — monsters are activated by card ownership, not physical position.[^2_1]

Monster AI follows a **priority-ordered tactics list** — check each condition in sequence and execute the first true one, then stop. The Wraith example: if within 1 tile of a hero → move adjacent and attack; otherwise → move 1 tile toward closest hero.[^2_1]

> ⚠️ **Digital Porting Note:** The "activate both Kobolds" rule means the same monster type can act twice in a single Villain Phase. Your `GameEngine.monsterPhase()` iterates `this.state.monsters` globally — it needs to be scoped to cards owned by the current active player, then re-checked for shared-type duplicates.

***

## Encounter Cards

The four encounter subtypes:[^2_1]

- **Environment** — persists until replaced by a new Environment card; only one active at a time
- **Event** — resolves immediately, then discarded
- **Event-Attack** — resolves immediately with an attack roll, then discarded
- **Trap** — places a marker on the active hero's tile; activates like a monster every Villain Phase; only one trap per tile (if a trap is already there, discard and redraw)

> ⚠️ **Digital Porting Note:** The "active hero" on encounter cards refers specifically to the player whose Villain Phase it is — not whoever is nearest to the event. Your `CardResolutionState` has a `targetEntityId` which is the right approach.

***

## Treasure Cards

Treasures are earned by defeating monsters — **one Treasure Card per turn maximum** regardless of how many monsters are killed. The three types behave differently: **Blessings** last until end of your next turn, **Fortunes** are one-time immediate effects, and **Items** are permanently equipped to a specific hero and cannot be transferred once assigned. Multiple treasure effects can stack on a single attack.[^2_1]

***

## Experience \& Leveling Up

Defeated monster cards go to a shared **Experience Pile**. XP has two uses:[^2_1]

- **Cancel an Encounter Card** — spend 5 XP from the pile at draw time only; excess is wasted (no change-making)[^2_1]
- **Level Up** — only possible when a hero rolls a **natural 20** on an attack or disable-trap roll; then optionally spend 5 XP to flip the Hero Card to 2nd level[^2_1]

Leveling grants +2 HP, +1 AC, +1 Surge Value, one new Daily power, and the critical hit special ability.[^2_1]

> ⚠️ **Digital Porting Note:** The level-up trigger is the natural 20 roll **first**, XP spend is optional afterward. You cannot spend XP to level up without the die roll. Your `constants.ts` has `XP_COST_LEVEL_UP: 5` and `CRITICAL_HIT_ROLL: 20` correctly, but the engine needs to gate the level-up prompt behind the natural 20 check, not just the XP count. Also: `TOTAL_SURGE_HEAL_HP: 1` in constants looks wrong — the hero recovers HP equal to their **surge value** (varies per hero, e.g., 4 HP for Thorgrim), not a flat 1 HP.[^2_1]

***

## Healing Surges

The party starts with **2 Healing Surge tokens** (adjustable for difficulty). They are a **shared group resource**. When a hero starts their turn at 0 HP, they **must** spend one — it's not optional. The hero recovers HP equal to their personal surge value. If no tokens remain when this check triggers, the group immediately loses.[^2_1]

> ⚠️ **Digital Porting Note:** The `TOTAL_SURGE_HEAL_HP: 1` constant is almost certainly a bug — this should not be a global constant since surge value differs per hero. It should be read from `hero.surgeValue` (or the 2nd-level card equivalent). The rulebook explicitly states the default is 2 tokens, not 3, so your `MAX_HEALING_SURGES: 3` constant also doesn't match the base rules (3 is the "easy mode" value).[^2_1]
<span style="display:none">[^2_3][^2_4][^2_5]</span>

<div align="center">⁂</div>

[^2_1]: Castle-Ravenloft-Board-Game-Rules.pdf

[^2_2]: Flowchart_v4.pdf

[^2_3]: ravenloft_adv3_intro-converted.pdf

[^2_4]: Ravenloft_Rules_Summary.pdf

[^2_5]: Castle_Ravenloft_Card_List_v1.0.pdf


---

# Can you review the coding agents changes and see if they look good?

Walkthrough: Monster Encounters \& Villain Phase Enhancements
What We Accomplished
We have successfully completely revamped how monsters are drawn, tracked, and displayed during gameplay, fulfilling all the requirements of Phase 3 and Phase 4 from our implementation plan!

1. 31 Custom Expansion Monsters Added
We replaced the previous generic monsters with the complete set of 31 new Custom Monsters straight from the Chromatic Dragons expansion rulebooks. All 31 monsters have been added to the game engine with their unique names, stats, capabilities, and required 3D model assets specified.
2. Implemented the "Monster Activation Banner"
To help players follow the action and understand why a monster is doing what it's doing (the "cognitive load" of tracking monster AI), we've implemented the rich VillainPhaseOverlay.
Whenever the Villain Phase begins, the game will now pause and pop up a highly-stylized Gothic banner displaying:
The Monster's Name
The Monster's 2D Card Token (Loaded from Token_Monster_[Name].png)
The Monster's exact Tactics Text (e.g. "If the Hero is within 1 tile...")
Any special abilities the monster has (e.g. "Undying", "Flying")
3. Redesigned the Encounter Card Overlay
The UI that pops up when you draw an Encounter Card has been completely overhauled with a premium Gothic aesthetic (EncounterCardOverlay.tsx). It now dynamically adapts to the specific card type drawn, rendering:
A circular 2D token specific to that Encounter
Context-aware primary action buttons (e.g., "Trigger Trap", "Roll to Defend", or "Apply Environment") instead of a generic "Resolve"
The exact flavor text of the drawn event
4. Rich Event Logging
Instead of simple system messages, drawing and resolving Encounter Cards now populate the game_logs with styled, descriptive events, allowing players to scroll through the Combat Log to read the exact text and descriptions of the encounters they've faced.
5. Architectural Improvements
Behind the scenes, we completely refactored gameStore.executeVillainPhase so that the game loop naturally pauses to accommodate the UI rendering. This is crucial as it ensures the 3D action won't zoom past the player before they have a chance to read the monster tactics banner!
Verification
Run npm run dev to start the game server.
The project successfully compiles using npm run build with zero TypeScript errors.
We are now ready to tackle the remaining tasks, including testing out the Encounters during an actual playthrough!

Here is a full review of all three files. The agent has done solid work overall, but there are some meaningful bugs and rule violations worth addressing.

***

## `VillainPhaseOverlay.tsx` — Mostly Good, Two Issues

The Gothic aesthetic, token image fallback, and fade-in/out timing logic are all well-implemented. However there are two problems:[^4_1]

**1. Auto-advance race condition.** The overlay auto-fades after 2,300ms and fades in 300ms, but there's nothing blocking the game engine from advancing `activeVillainId` to the next monster before the fade finishes. The `displayVillainId` state preserves the last villain visually, which is correct, but the `getProgressText()` function calls `villainQueue.indexOf(activeVillainId)` — once `activeVillainId` advances, the progress text jumps to the next monster while the card is still showing the previous one. Fix: snapshot the progress index at display time, not reactively.

**2. Trap fallback text is hardcoded and wrong.** When displaying a trap, the tactics text is hardcoded to `'The trap activates, striking at heroes nearby!'` regardless of what the actual trap card does. Since traps are already fully typed in `types.ts` and have card data in the deck, the overlay should look up the card from the `DataLoader` using `trap.cardId` to pull the real description text — the same way monster tactics are displayed.[^4_1]

**3. Missing type annotation on `React.FC`.** The component is declared as `React.FC` without the props generic (`React.FC<VillainPhaseOverlayProps>`). TypeScript will accept this but props won't be type-checked at the call site.

***

## `EncounterCardOverlay.tsx` — Rules Bug \& Architecture Issue

The encounter overlay looks visually polished and the context-aware button labels are a great UX touch.[^4_2]

**1. XP cancellation check is wrong per the rules.** The `canCancel` check uses `useGameStore.getState().gameState?.experiencePile.length || 0` and checks `>= 5` [^4_2]. But per the rules, you need Monster Cards whose XP *values add up to* 5 — the card count doesn't matter [^4_3]. A pile of five 1-XP cards should work; a pile of three 3-XP cards should not. The button should be disabled or hidden unless the pile contains cards that can sum to ≥5 XP. The `ExperienceSystem` should already have this logic — the overlay should call into it rather than doing its own count.

**2. `useGameStore` inside a presentational component is an anti-pattern.** The overlay calls `useGameStore.getState()` directly inside the component body. This bypasses React's subscription system — if the store updates, this component won't re-render with the new XP count. Move the XP calculation to a selector in the parent and pass it as a prop, or use `useGameStore(state => state.gameState?.experiencePile)` as a hook at the top of the component.[^4_2]

**3. `onDismiss` is accepted as a prop but never called.** The component accepts `onDismiss` in its prop interface but there's no dismiss/close button and the prop isn't invoked anywhere. This is a dead prop. Either wire it up to a close button for the `complete` phase, or remove it from the interface.[^4_2]

**4. Environment card cancellation behavior is subtly wrong.** When a new Environment card is canceled with XP, the old environment in play should *stay active* — the rules explicitly state "if you cancel a new Environment Card when there is already one in play, you do not discard the card that was already in play". Verify that `cancelEncounterCard` in `gameStore.ts` handles this case; the overlay itself just calls it blindly.[^4_3]

***

## `gameStore.ts` — Several Issues Found

The store is large and well-structured, but the review of the villain phase and defeat logic surfaced a few correctness problems.

**1. Defeat condition fires too eagerly.** `applyEndStateChecks` triggers defeat when `outOfSurges` is true — meaning `healingSurges <= 0`. But per the rules, heroes only lose when a hero *starts their turn at 0 HP* with no surges remaining. Having 0 surges in the pool with all heroes above 0 HP is fine. The check should be: any hero is at 0 HP at the start of their turn AND `healingSurges <= 0`. The current logic incorrectly ends the game the moment the last surge is spent, even if all heroes are still standing.[^4_4][^4_3]

**2. `allDead` condition includes `escaped` heroes incorrectly.** The line `state.heroes.every(h => h.hp <= 0 || h.escaped)` treats escape as equivalent to death for the defeat condition [^4_4]. If one hero escapes and another dies, that should not necessarily be a defeat — especially in adventures like Adventure 6 where escaping is part of the objective. The escape flag should only contribute to the victory check via `ObjectiveTracker`, not to the defeat check.

**3. `treasureDeck` includes non-standard card types.** The deck is initialized by filtering for `['treasure', 'item', 'consumable', 'weapon', 'summon']`. The base rules only have three treasure types: Blessing, Fortune, and Item. The `'weapon'` and `'summon'` types are custom expansions — this is fine if intentional for the Chromatic Dragons expansion, but it should be a named constant rather than an inline string array so future changes are consistent.[^4_4][^4_3]

**4. Leftover `console.log` debug statements throughout `startNewGame`.** There are at least 6 `console.log('[DEBUG]...')` calls in `startNewGame`. These should either be removed or gated behind a `settings.showDevTools` flag now that the architecture supports it.[^4_4]

**5. Villain phase queue processes correctly, but `activeVillainId` is cleared synchronously.** At the end of `executeVillainPhase`, `activeVillainId` is set to `null` and `villainPhaseQueue` is wiped in the same state update. This is correct for state purposes, but if the overlay is still fading out at this moment (2,300ms display window), the `isVillainPhaseActive: false` from the parent will immediately hide the overlay mid-animation. The `isVillainPhaseActive` prop needs to remain `true` until the overlay's fade is fully complete — consider a separate "overlayDone" callback or keeping the queue state alive until the UI confirms dismiss.[^4_4]

<div align="center">⁂</div>

[^4_1]: VillainPhaseOverlay.tsx

[^4_2]: EncounterCardOverlay.tsx

[^4_3]: Castle-Ravenloft-Board-Game-Rules.pdf

[^4_4]: gameStore.ts


---

# Could you describe the Adventures listed in the rulebook and how these ate setup in the bpoard game? Then provide a overview of how to digitalize the experience in game, and any extra cards, tokens, or game states that need to be tracked to correctly play the adventure digitally.

Based on the rulebooks and attached adventure files, here is a full breakdown of every adventure, how it plays on the physical tabletop, how to digitalize it, and what extra state needs tracking.

***

## How Adventures Work in General

Every adventure in the Castle Ravenloft board game shares the same three-phase turn structure — Hero Phase, Exploration Phase, Villain Phase — but each adventure layered on top of that with its own villain card, special tiles that must be seeded into the deck at specific positions, unique tokens, and scenario-specific rules that override or extend the base rules. Setup always begins with shuffling the three core decks (Monster, Encounter, Treasure), selecting heroes and their Power Cards, and placing heroes on the Start Tile. What changes per adventure is *which tiles are set aside*, *where named tiles are inserted into the deck*, *which villain appears and when*, and *what the victory/defeat conditions are*.[^5_1]

***

## Adventure 1 — Escape the Tomb

**Physical Setup:** The rulebook presents this as the solo/tutorial adventure. Heroes start on the Start Tile and explore freely. The Villain is Count Strahd, and a Time Track of 6 tokens is placed at the start. At the end of each full round of turns (all heroes having gone once), one time token is flipped. If Strahd is awakened (typically when all time tokens are flipped), he enters play and activates every Villain Phase.[^5_1]

**Victory/Defeat:** Heroes win by escaping the dungeon — reaching the exit tile. They lose if a hero starts their turn at 0 HP with no Healing Surges remaining, or if the time track expires and Strahd defeats the party.[^5_1]

**Digital State to Track:**

- `timeTrack: { current: number, max: 6 }` — already present in `gameStore.ts`[^5_2]
- `strahdAwakened: boolean` — already present[^5_2]
- Strahd's Villain Card with Mistform ability: must track whether Strahd is in Mistform (invulnerable, moving through walls) as a boolean on his monster entity
- The **exit tile** must be seeded at a specific position in the dungeon deck; it needs a `isExit: true` flag on the tile and an objective that triggers when a hero occupies it

***

## Adventure 2 — Find the Icon of Ravenloft

**Physical Setup:** The Chapel of Ravenloft is a named tile that must be shuffled into the 9th position of the dungeon deck before play begins. The Icon of Ravenloft (Item Card \#148) is set aside and placed as an item token on the Chapel tile when it is revealed. Heroes must reach the Chapel, pick up the Icon, and escape back to the Start Tile.[^5_1]

**Victory/Defeat:** Heroes win when a hero carrying the Icon of Ravenloft returns to the Start Tile. They lose under standard HP/Surge conditions.

**Digital State to Track:**

- `chapelRevealed: boolean` — already present in `gameStore.ts`[^5_2]
- Icon of Ravenloft as a **tile-bound item token** that gets picked up: already partially handled via `token_item_icon_of_ravenloft` logic in `endTurn`[^5_2]
- **Objective: hero carrying the Icon must be on the Start Tile** — the `ObjectiveTracker` needs a check for `hero.items.includes('treasure_icon_ravenloft') && hero is on startTile`
- The Chapel's `specialTilePlacements` insertion at index 8 is already coded in `startNewGame`[^5_2]

***

## Adventure 3 — Lair of the Dracolich

**Physical Setup:** This is the most mechanically complex adventure. Three named tiles (Arcane Circle, Rotting Nook, Workshop) are removed from the deck first. The Arcane Circle is shuffled in with 3 random tiles to form a 4-tile sub-stack, which is inserted 5 tiles deep into the main deck. The Rotting Nook is similarly shuffled in at the 8-tile position below that. The Workshop tile is kept completely off the deck until the heroes find Father Langdon's map.[^5_3]

A set of **Hourglass tokens** is placed on the Start Tile, scaled to hero count (8/6/4/2 for 2/3/4/5 heroes). One token flips at the end of every full round. If all are flipped before the Arcane Circle is explored, the heroes lose immediately. After the Arcane Circle is found, the tokens move there and begin a second countdown for finding the Workshop via bone-pile investigation.[^5_3]

The **Gravestorm's Phylactery** is a separate token that, once destroyed (by reaching the Workshop tile), weakens Gravestorm — removing 10 HP instantly in your implementation. Gravestorm enters play when the Rotting Nook is revealed and carries the Dragon's Breath token on his card at entry.[^5_3][^5_2]

**Digital State to Track:**


| State Variable | Purpose |
| :-- | :-- |
| `hourglassTokens: { count, phase: 'start' | 'arcaneCircle', flippedCount }` | Per-round countdown, two phases |
| `arcaneCircleRevealed: boolean` | Triggers hourglass phase transition |
| `rottingNookRevealed: boolean` | Triggers Gravestorm entering play |
| `workshopPlaced: boolean` | Whether the Workshop tile has been added |
| `mapTokenFound: boolean` | Controls bonus move action for carrying hero |
| `mapTokenHeroId: string | null` | Which hero holds the map |
| `investigationPool: Token[]` | 6 tokens (1 map + 5 random items) drawn blind |
| `phylacteryDestroyed: boolean` | Already tracked via `attackMonster` in gameStore [^5_2] |
| `dragonBreathTokenOnGravestorm: boolean` | Tracked on the monster entity itself |

The bone-pile investigation mechanic is entirely new — it requires a Hero action during the Hero Phase ("investigate instead of attack") and a blind draw from the investigation pool, which is not currently implemented.

***

## Adventure 4 — Strahd's Awakening

**Physical Setup:** Similar to Adventure 1 but Strahd awakens at a fixed point rather than via a time track expiry — when a specific named tile is revealed, he immediately enters play. He also has the **Coffin deck** mechanic: 10 Coffin tokens are shuffled and placed face-down on the Start Tile. When Strahd is reduced to 0 HP, instead of being defeated, a Coffin token is flipped. If it reveals a Coffin, Strahd regenerates and returns. Only finding the true Coffin (the Icon of Strahd, Item \#149) and staking it wins the game.[^5_4][^5_1]

**Victory/Defeat:** Defeat Strahd and reveal his true Coffin. Lose under standard conditions or if the dungeon runs out of tiles.

**Digital State to Track:**

- `strahdAwakened: boolean` — already present[^5_2]
- `coffinDeck: Token[]` — a shuffled deck of coffin tokens; one is the "true coffin" and the rest are decoys
- `coffinTokensFlipped: number` — how many have been revealed
- `strahdCoffinTokenId: string` — already present in `gameStore.ts`[^5_2]
- `unplacedCoffinTokens: Token[]` — already present[^5_2]
- The Icon of Strahd item (\#149) must be in the Adventure Treasure pool and trigger the victory check when used on Strahd's coffin

***

## Adventure 5 — The Cure for Kavan

**Physical Setup:** Kavan, a young vampire NPC, starts as an item token on the Start Tile. One hero can "escort" Kavan (pick him up), and Kavan follows that hero tile for tile. Scattered through the dungeon are Dark Fountain tiles. To cure Kavan, heroes must stand him on a Dark Fountain tile with no monsters present at the end of their turn — this costs one of 5 Fountain Tokens. Once all 5 are spent, Kavan is cured and the heroes win. If Kavan (the Young Vampire monster stand-in) is defeated, the heroes lose immediately.[^5_2]

**Victory/Defeat:** Spend all 5 Fountain Tokens. Lose if Kavan is killed or standard HP/Surge conditions.

**Digital State to Track:**

- `kavanEscortedBy: string | null` — already present [^5_2]
- `fountainTokens: number` — already present, initialized to 5[^5_2]
- `token_item_kavan` as a tile-following token — already coded in `endTurn`[^5_2]
- The **Young Vampire monster acting as Kavan's health proxy** is already checked for defeat in `attackMonster`[^5_2]
- Dark Fountain tiles need `terrainType: 'dark_fountain'` or a named ID match to trigger the cure mechanic — currently done via `tileId.startsWith('named_dark_fountain')`[^5_2]

***

## Adventure 6 — Escape from Ravenloft

**Physical Setup:** This is the escape adventure. Multiple Villain figures are in play simultaneously from the start — Strahd and at least one other Villain are both seeded onto the board at setup. The Exit tile must be found and *each hero must reach it individually* to escape; they don't all need to be there simultaneously, but any hero who hasn't escaped when the time runs out is considered lost.[^5_1]

**Victory/Defeat:** All heroes escape via the Exit tile. Heroes are lost individually, not as a group, so partial victory is possible in some rule variants.

**Digital State to Track:**

- `escapedHeroes: string[]` — which hero IDs have successfully exited; this is distinct from `hero.escaped: boolean`
- **Multiple active villains from turn 1** — the villain queue must be pre-populated at `startNewGame` rather than waiting for a villain tile to be revealed
- `phase: 'victory'` check must confirm *all* heroes have escaped, not just one
- The current `applyEndStateChecks` logic using `h.escaped` for the defeat check is a bug in this context (as noted in the code review): escaped heroes should not count toward defeat[^5_2]

***

## Universal Digital Requirements Across All Adventures

There are several systems that every adventure needs correctly to play faithfully, beyond adventure-specific state:

**Time Tracking** needs to count completed *full rounds* (all heroes having taken a turn), not individual turns. A `roundCompletedFlag` or a comparison of `turnCount % heroCount === 0` is needed to fire the round-end trigger reliably.

**Named Tile Seeding** — Adventures 2, 3, and 4 all require specific tiles to appear at deterministic depth ranges. The `specialTilePlacements` system in `gameStore.ts` handles Adventure 2's Chapel correctly, but Adventures 3 and 4 need a more sophisticated *range-based shuffle* mechanism (e.g., "shuffle tile X within positions 5–8 of the deck"), not a simple `splice`.[^5_2]

**Encounter Card on Black Triangle tiles** — the Villain Phase must draw an Encounter Card not only when no tile was placed, but also *whenever a tile with a black triangle is placed* [^5_1]. This tile property needs to be stored on each `Tile` as `dangerTriangle: 'white' | 'black'` and checked in `executeVillainPhase`.

**Villain Enters Play Trigger** — most adventures have villains who only appear when a specific named tile is explored (Rotting Nook → Gravestorm, etc.). This requires an `onTileRevealed` hook in the Exploration Phase that checks the scenario's villain spawn conditions and adds the villain to the active villain queue.

<div align="center">⁂</div>

[^5_1]: Castle-Ravenloft-Board-Game-Rules.pdf

[^5_2]: gameStore.ts

[^5_3]: ravenloft_adv3_intro-converted.pdf

[^5_4]: Castle_Ravenloft_Card_List_v1.0.pdf


---

# Can you explain the 200 cards in the original board game and when that card would be brought into play and how it would resolve? Explain any mechanics that might be diffficult ot digitalize.

The 200 cards in Castle Ravenloft divide into five functional groups. Here is a complete breakdown of each group, how and when each card enters play, how it resolves, and the specific digitalization challenges involved.

***

## Cards 1–50: Power Cards (Hero Abilities)

Power Cards represent each hero's arsenal — the spells, prayers, maneuvers, and fighting techniques they bring into the dungeon. Each hero class has 10 cards split into three subtypes: At-Will Powers (usable every turn), Daily Powers (flipped face-down after use, unavailable until refreshed), and Utility Powers (non-attack abilities, also flipped after use). Cards 1–10 belong to the Cleric (e.g., Healing Word, Divine Flare, Beacon of Hope), 11–20 to the Fighter, 21–30 to the Ranger, 31–40 to the Rogue, and 41–50 to the Wizard.[^6_1][^6_2]

**When they enter play:** Heroes select their Power Cards during setup before the adventure begins. Each hero card specifies exactly how many of each type they can bring — the Cleric, for example, takes one fixed Utility Power (Healing Word) plus player-chosen selections for the rest. Unused Power Cards are set aside for the entire adventure.[^6_2]

**How they resolve:** During the Hero Phase, a player picks one power from their face-up cards, declares a target, rolls the d20, adds the power's Attack Bonus, and compares to the target's AC. On a hit, damage is dealt; on a miss some powers still deal partial damage or apply secondary effects. At-Will cards stay face-up; Daily and Utility cards flip face-down and become unavailable until a Treasure Card (usually Fortunes like "Short Rest") or a level-up restores them.[^6_2]

**Digitalization challenges:**

- **"Flip" state** requires each Power Card to track an `isFlipped: boolean` on the hero's power loadout. This is already partially implemented but must survive across the villain phase (some monsters attack after the hero uses powers).
- **Conditional secondary effects** — many powers do different things on a hit vs. a miss (e.g., "Hit: deal 3 damage; Miss: deal 1 damage") or apply conditions like Slowed alongside damage. The `CombatSystem.resolveAttack` needs a `hitEffects[]` and `missEffects[]` array per power, not just a flat `damage` value.[^6_2]
- **"Hit or miss" effects** — cards like *Hallowed Advance* move all heroes on a tile whether the attack hits or misses. This means effects must be categorized as `onHit`, `onMiss`, or `always`, and the resolution pipeline must execute all three.
- **Target selection UI** — some powers target "one adjacent Monster," others "each Monster on your tile," others "one Monster within 3 tiles" [^6_2]. The game needs a `targeting: 'adjacent' | 'tile' | 'range-N' | 'all-on-tile'` property on each power and a UI that highlights only legal targets.

***

## Cards 51–110: Encounter Cards (60 cards)

The Encounter Deck is the primary source of chaos and pressure. It contains four subtypes across 60 cards:[^6_1]

**8 Environment Cards (51–58)** — Bat Swarm, Blood Fog, Cackling Skull, Crippling Miasma, Deadly Shadows, Haunted Mists, Music of the Damned, Spirit of Doom. These represent persistent dungeon-wide hazards that remain in play until a new Environment Card replaces them. Each one applies a passive rule to all heroes for the rest of the game, such as Blood Fog dealing +1 damage on same-tile attacks.[^6_2]

**30 Event Cards (59–88)** — These are one-shot occurrences ranging from harmless (Treasure Chest: draw a Treasure Card) to punishing (Mists of Terror: each hero loses HP). Named NPC Events like Cyrus Belview, Lief Lipsiege, and Ghost Prince of Aurel give brief narrative flavor and mechanical effects. Events draw and immediately resolve, then discard.[^6_2]

**12 Event-Attack Cards (89–103)** — Red-bordered cards like Ambush!, Circle of Death, Gray Ooze, and Strahd Attacks. These behave like Events but also include an attack roll against one or more heroes, making them more immediately dangerous than standard yellow Events.[^6_1][^6_2]

**10 Trap Cards (104–110)** — Alarm, Crossbow Turret, Crushing Walls, Dart Trap, Fire Trap, Sliding Walls, Spear Gauntlet, plus a few others. Unlike Events, Traps don't resolve immediately — instead a Trap marker is placed on the active hero's tile and the Trap Card joins the player's hand of active villain cards, triggering every Villain Phase until a hero disables it.[^6_2]

**When they enter play:** Encounter Cards are drawn at the start of the Villain Phase whenever the hero either (a) did not place a dungeon tile, or (b) placed a tile with a black triangle. The card is drawn and applied immediately before the player activates their monsters.[^6_2]

**Digitalization challenges:**

- **Active Environment Card state** is a global modifier that must be evaluated on every attack for every hero and monster. This means `applyDamage()` must consult `state.activeEnvironmentCard` and apply conditional bonuses — e.g., Blood Fog adds 1 damage only for same-tile attacks, which requires checking the attacker and target's tile position at the moment of damage resolution.
- **Trap persistence** is the trickiest Encounter mechanic. Traps must be stored in the active villain queue, placed as a marker on a specific tile, and removed from both places simultaneously when disabled. A trap must *not* trigger if the tile it occupies has been abandoned by heroes — the digital implementation needs a `trap.tileId` check at activation time.
- **Named NPC Events** like Cyrus Belview, Lief Lipsiege, and the Ghost Prince introduce temporary companion mechanics (a friendly character appears and fights alongside heroes) that require spawning a non-enemy entity on the board — this is a fundamentally different entity type from monsters and heroes and would need a `Companion` type in the game state.
- **Passage of Time / Strahd's Hunger** are Events that directly advance the Time Track or interact with Strahd's villain state — they require the Encounter resolution pipeline to fire adventure-specific callbacks, not just apply static effects.
- **"Place a new Monster on the active Hero's tile"** appears on multiple Event-Attack cards (Ambush!, Reinforcements). This means drawing from the Monster deck mid-Encounter resolution, which creates a nested draw-and-place action within the already-in-progress Villain Phase. The `cardResolution` state machine needs to handle this as a queued sub-action.

***

## Cards 111–140: Monster Cards (30 cards)

There are 10 monster types, with 3 copies of each card in the deck: Blazing Skeleton (Undead), Gargoyle (Elemental), Ghoul (Undead), Kobold Skirmisher (Reptile), Rat Swarm (Animal), Skeleton (Undead), Spider (Vermin), Wolf (Animal), Wraith (Undead), and Zombie (Undead).[^6_1]

**When they enter play:** A Monster Card is drawn during the Exploration Phase whenever a new dungeon tile is placed. The corresponding figure is placed on the bone pile of the new tile. If the drawing hero already has that card in their hand, they discard it and draw again — but another hero may hold the same type simultaneously.[^6_2]

**How they resolve:** Every Villain Phase, each Monster Card owner activates *all* monsters of that type they have in play, in draw order. Each monster follows its tactics script — a conditional decision tree evaluated top to bottom, stopping at the first true condition. Monsters move and attack according to that single matched tactic, then their turn ends.[^6_2]

Each Monster Card has a Special Ability in addition to its tactics:[^6_2]

- **Wraith** — Death Shriek: when destroyed, deals 1 damage to all heroes on its tile
- **Ghoul** — Paralyzing Claws: on hit, applies the Immobilized condition
- **Wolf** — Pack Hunter: gains +2 to attacks if another Wolf is on the same tile
- **Gargoyle** — Stone Form: cannot be damaged until it has activated at least once
- **Zombie** — Undying: when reduced to 0 HP, roll d20; on 11+ it survives with 1 HP

**Digitalization challenges:**

- **The "same type" duplicate rule** is subtle — the *same player* cannot hold two cards of the same monster type, but *different players* can each hold one. The `drawMonsterCard` function needs to check `state.monsters.filter(m => m.controlledBy === currentHeroId && m.type === drawnType)` before accepting a draw, and redraw only in that case.
- **Multi-instance activation** — if two Kobolds are in play and both belong to the same player, *both* activate during that player's Villain Phase. This means the villain queue must contain monster *instances*, not monster *types*, and the queue must be built by collecting all monsters owned by the current hero.[^6_2]
- **Tactics distance calculations** use *tiles*, not squares, and tile-distance is Manhattan distance ignoring diagonal connections. This is the most common source of incorrect AI behavior — `Math.abs(dx) + Math.abs(dz)` only works on a grid; the real tile graph is irregular and requires a BFS pathfinder.[^6_2]
- **The Zombie's Undying ability** introduces a probabilistic survival mechanic on death — the monster could go to 0 HP and be "pending defeat" until a d20 roll confirms it. This intermediate state (`pendingDefeat: boolean`) must be held in the monster entity and checked before awarding XP and a Treasure Card to the hero.

***

## Cards 141–150: Adventure Treasure Cards (10 cards)

These are set aside at the start and only enter specific adventures: Silver Dragon (141), Wooden Stake ×2 (142–143), Feywalk Amulet (144), Torch (145), Dimensional Shackles (146), Holy Symbol of Ravenkind (147), Icon of Ravenloft (148), Icon of Strahd (149), and Sunsword (150).[^6_1]

**When they enter play:** Each adventure specifies which of these are relevant. They are either placed as item tokens on named tiles (Icon of Ravenloft in Adventure 2's Chapel) or available from the start as starting gear for heroes (Adventure 3 starts heroes with 2 treasure items from this pool).[^6_3]

**Digitalization challenges:** These cards have the game's most complex single-card effects. The **Sunsword** gives +2 attack bonus against undead and also counts as a light source (some tiles penalize heroes in darkness). The **Wooden Stake** can only be used on a Vampire-type villain and instantly defeats them — bypassing the normal Coffin resurrection mechanic in Adventure 4. The **Dimensional Shackles** prevent a monster from moving for a full round. All of these require targeted ability hooks that don't generalize to simple `damage + condition` logic, and each needs a custom `onUse` handler in the item resolution system.

***

## Cards 151–200: Standard Treasure Cards (50 cards)

These are earned during play by defeating monsters — heroes draw one per turn from the Treasure Deck when they get a kill.[^6_2]

**5 Blessings (151–155)** — Heroic Stand, Guided Strike, Rejuvenating Onslaught, Run!, Surround Them! Each lasts until the end of the drawing hero's *next* turn and applies a global bonus to all heroes.[^6_2]

**20 Fortunes (156–175)** — One-use immediate effects. Action Surge grants an extra action, Breath of Life heals a downed hero immediately, Level Up allows leveling without a nat-20 roll, Moment's Respite places itself on top of the Encounter or Monster deck to skip the next draw from that deck, and Short Rest refreshes one used power.[^6_1][^6_2]

**25 Items (176–200)** — Persistent cards assigned to one hero permanently: Amulet of Protection (+1 AC), Boots of Striding (+2 Speed), Crystal Ball (look at top of any deck), Dragon's Breath Elixir (one-use area fire damage), Glyph of Warding (place on tile, explodes when monster enters), Holy Water (extra damage vs. Undead), Necklace of Fireballs (multi-use ranged fire attack), Potions of Healing, Ring of Accuracy (+2 attack bonus), Ring of Regeneration (regain 1 HP each turn), Scroll of Teleportation (move to any revealed tile), Wand of Teleportation (teleport a monster).[^6_1]

**Digitalization challenges:**

- **Blessing expiry** — a Blessing must be active for the remainder of the drawing hero's current turn and the entirety of their *next* turn, then auto-discarded. This requires storing `blessingExpiresAfterTurnOf: heroId` in state, and checking for expiry at the *start* of that hero's turn — not at end-of-turn, which is the more obvious (and incorrect) place to check.
- **Moment's Respite** places the Fortune card itself on top of a chosen deck, acting as a "nullify next draw" marker. Digitally, this requires inserting a sentinel value at index 0 of `encounterDeck` or `monsterDeck` that the draw function checks before pulling a real card — the card list has two copies of this card (\#172).[^6_1]
- **Glyph of Warding** is a placed persistent hazard with a trigger condition (monster enters the tile) — it is effectively a hero-placed trap, and requires a tile-based event listener system that doesn't currently exist in the architecture.
- **Crystal Ball** requires presenting the player with a read-only preview of the top 1–3 cards of a chosen deck without shuffling or consuming them — a purely informational UI action that still needs a dedicated game action and modal to display.
- **Ring of Regeneration** applies a passive per-turn heal that must fire at the start of every Hero Phase for the card's holder — this is an `onTurnStart` passive hook that attaches to the hero's item list rather than being triggered by an explicit player action, making it easy to forget in implementation.
- **XP cancellation requires value matching, not simple counting** — the rulebook is explicit that you must spend Monster Cards whose XP values *sum to at least 5*, and the excess is wasted. A pile of five 1-XP cards cannot cancel a card because no combination sums to exactly 5 with those values — you need a subset-sum solver on the `experiencePile` array to determine whether cancellation is legally possible before showing the cancel button to the player.[^6_2]

***

## Cards 196–200: Sequence of Play Reference Cards

These five cards (\#196–200) are player aid cards only  — identical reprints of the turn order summary given to each player at setup. They have no game mechanics and do not enter play. Digitally, they are replaced by the in-game HUD's turn phase indicator.[^6_1]

<div align="center">⁂</div>

[^6_1]: Castle_Ravenloft_Card_List_v1.0.pdf

[^6_2]: Castle-Ravenloft-Board-Game-Rules.pdf

[^6_3]: ravenloft_adv3_intro-converted.pdf

