# Castle Ravenloft Digital — MVP Status & Roadmap

**Date:** 2026-03-23
**Project:** `c:\antigravity\ravenloft` (Vite + React Three Fiber + Zustand)
**Purpose:** Honest assessment of where we stand vs. a *playable* game.

---

## 1. Critical Blocker (FIXED)

**App.tsx — Duplicate UIOverlay conditional (Lines 143-149)**

The Power Selection Screen renders fine, but after confirming powers and transitioning to `'hero'` phase, a malformed JSX block caused two TypeScript errors:

```
src/App.tsx(146,9): error TS1005: ')' expected.
src/App.tsx(149,8): error TS1381: Unexpected token.
```

**Root cause:** Copy-paste created a double-nested `{gameState && gameState.phase !== 'setup' && ( ... )}` with a stray JSX comment fragment inside.  
**Status:** ✅ Fixed — collapsed to a single clean conditional. **0 TypeScript errors remaining.**

---

## 2. Architecture Overview

```
src/
├── App.tsx                   # Root — routes Setup vs Gameplay
├── main.tsx                  # Entry point
├── store/
│   ├── gameStore.ts          # Central Zustand store (1185 lines)
│   └── uiStore.ts            # UI modal / transition state
├── game/
│   ├── types.ts              # All game types, enums, interfaces
│   ├── GameEngine.ts         # High-level game coordinator
│   ├── dataLoader.ts         # Singleton JSON data loader
│   ├── constants.ts          # Game constants
│   ├── engine/               # 13 system modules
│   │   ├── CombatSystem.ts
│   │   ├── ConditionSystem.ts
│   │   ├── EncounterSystem.ts
│   │   ├── ExperienceSystem.ts
│   │   ├── ExplorationStateMachine.ts
│   │   ├── MonsterAI.ts
│   │   ├── PowerSelectionSystem.ts
│   │   ├── PowerSystem.ts
│   │   ├── TileSystem.ts
│   │   ├── TreasureSystem.ts
│   │   ├── CardResolutionSystem.ts
│   │   ├── CardSystem.ts
│   │   └── ActionResolver.ts
│   ├── ai/                   # AbilitySystem, BossPhases
│   ├── progression/          # SaveSystem
│   └── scenarios/            # Scenario validation / objectives
├── components/
│   ├── 3d/                   # Scene, DungeonBoard, Hero3D, Monster3D, etc.
│   ├── ui/                   # 23 UI components
│   ├── effects/              # Transitions
│   ├── interaction/          # GameController
│   ├── settings/             # AudioSettings
│   └── tutorial/             # TutorialSystem
├── data/                     # All JSON game data
│   ├── heroes.json           # 5 heroes
│   ├── monsters.json         # 13 monster stat blocks
│   ├── tiles.json            # 4 tile definitions
│   ├── powerCards.json       # 17 power cards
│   ├── scenarios.json        # Scenario index
│   ├── scenarios/            # 5 detailed scenario files
│   └── cards/
│       ├── encounters.json   # 35 encounter cards
│       ├── treasures.json    # 34 treasure cards
│       ├── monsters.json     # 5 monster spawn cards
│       ├── items.json        # 2 item cards
│       └── hero-abilities/   # 10 hero ability cards (2 per hero × 5)
└── audio/                    # AudioManager, AudioReactComponent
```

---

## 3. Card Data Gap Analysis

### What we have vs. what the board game contains (~200 cards)

| Card Category | Board Game Count | Our Data | Gap | Notes |
|---|---|---|---|---|
| **Monster Cards** | ~30 | 5 spawn cards + 13 stat blocks | **~12-17 missing spawn cards** | Stat blocks exist for 13 monsters but only 5 have matching "draw from deck" spawn cards |
| **Encounter Cards** | ~44 | 35 | **~9 missing** | Good coverage — check PDF for specific missing titles |
| **Treasure Cards** | ~32 | 34 | ✅ **Close / Covered** | May have slight extras from custom content |
| **Power Cards (At-Will, Daily, Utility)** | ~40-50 total | 17 generic + 10 hero-abilities = **27** | **~13-23 missing** | Board game has ~8-10 per hero; we have 2 hero abilities + shared pool |
| **Villain Cards** | ~13 (scenario villains) | 0 standalone | **~13 missing** | Villain behavior is in BossPhases.ts but no dedicated cards |
| **Adventure/Scenario Cards** | 13 adventures | 5 scenario files | **8 missing** | Scenarios 6-13 need data files |
| **Tile Cards** | ~40 dungeon tiles | 4 definitions | **~36 missing** | Critical gap — only Start + 3 tiles |
| **Hero Ability Cards** | 5×(2 at-will + 1 daily + 1 utility) = **20** | 10 (2 per hero) | **10 missing** | Each hero needs daily + utility abilities added |

### Overall Data Completeness: **~103/200 cards (~52%)**

### Priority Order for Card Data

1. **🔴 Tiles (36 missing)** — Without tiles, exploration dead-ends after 3 draws
2. **🔴 Power Cards / Hero Abilities (10-23 missing)** — Power selection feels thin
3. **🟡 Monster Spawn Cards (12-17 missing)** — Limits monster variety during play
4. **🟡 Scenarios 6-13 (8 missing)** — 5 scenarios is playable for MVP
5. **🟢 Encounter Cards (9 missing)** — 35 is a solid base
6. **🟢 Villain Cards (13 missing)** — Behavior exists in code, cards are presentational

---

## 4. Core Mechanic Fidelity Audit

### ✅ Faithfully Implemented

| Mechanic | Board Game Rule | Our Implementation |
|---|---|---|
| **Turn Structure** | Hero Phase → Exploration → Villain Phase | `endTurn()` in gameStore correctly chains phases |
| **Tile Exploration** | Draw tile, place at edge, spawn monster on bone pile | `TileSystem.drawAndPlace()` + `ExplorationStateMachine` |
| **Encounter Cards** | Draw encounter when new tile placed | `drawEncounterCard()` called in `App.tsx` after placement |
| **Power Selection** | Choose powers during setup before adventure starts | `PowerSelectionSystem` + `PowerSelectionScreen` UI |
| **Combat** | d20 + attack bonus vs AC | `CombatSystem.resolveAttack()` |
| **Conditions** | Slowed, Immobilized, Poisoned, Dazed, Weakened, Stunned | `ConditionSystem` with full status effect logic |
| **Healing Surges** | Shared party resource, spend to heal 2 HP | Available in game state, `healingSurges` tracked |
| **Treasure Cards** | Blessings (instant), Fortunes (one-use), Items (persistent) | `TreasureSystem` with 3 treasure types |
| **Experience** | Spend 5 XP to cancel encounter or level up | `ExperienceSystem` with both paths |
| **Villain Phase** | Activate each villain card, then each monster | `executeVillainPhase()` builds queue, processes sequentially |

### 🟡 Partially Implemented (Needs Work)

| Mechanic | Issue | Fix Required |
|---|---|---|
| **Monster Tactics** | Generic AI for all monsters | Each monster type needs unique tactic behavior from the monster cards |
| **Line of Sight** | Not implemented | Board game uses adjacency (same tile or adjacent tile); our tiles are too few to matter yet |
| **Trap Placement** | Traps created by encounters exist in state | Need 3D visualization on tiles and disable interaction |
| **Tile Connectivity** | Only 4 tiles; connections are minimal | Need full 40-tile set with proper edge connectors (white/black triangles) |
| **Monster Movement AI** | Pathfinding exists | Needs to respect tile connections, not just spatial adjacency |

### ❌ Missing Mechanics

| Mechanic | Board Game Rule | Status |
|---|---|---|
| **Coffin Tokens** | Scenario 1 requires searching coffins for Holy Water, Stake, Monsters, Traps | No implementation — coffin token assets exist in `Ravenloft_Tokens/` |
| **Quest Item Tokens** | Some scenarios require carrying/using specific items | Token images exist but no game logic |
| **Environment Cards** | Persist until replaced by another environment | `activeEnvironmentCard` field exists in state but no resolution logic |
| **Multiple Attack Types** | Heroes can have melee vs ranged with different ranges | Currently only basic attack, no range distinction |
| **Item Equip/Unequip** | Items should be assignable to any hero in same tile | `assignItem()` exists but no proximity check |
| **Scenario Special Triggers** | Each adventure has unique win/loss conditions | Only Scenario 1 has detailed triggers |

---

## 5. Token Asset Inventory (Ravenloft_Tokens/)

We have **73 PNG token images** ready to use. Here's the breakdown:

### Monster Tokens (12 files)

| File | Use Case | Integration |
|---|---|---|
| `Token_Monster_0.png` through `Token_Monster_3.png` | Generic numbered monster tokens | Map to generic monster spawns |
| `Token_Monster_Dragolich.png` | Dracolich boss | Boss encounter visuals |
| `Token_Monster_FleshGolem.png` | Flesh Golem | Monster card art |
| `Token_Monster_HowlingHag.png` | Howling Hag | Monster card art |
| `Token_Monster_KoboldSorceror.png` | Kobold Sorcerer | Monster card art |
| `Token_Monster_Strahd.png` | Strahd (final boss) | Boss encounter / villain card |
| `Token_Monster_Werewolf.png` | Werewolf | Monster card art |
| `Token_Monster_YoungVampire.png` | Young Vampire | Monster card art |
| `Token_Monster_ZombieDragon.png` | Zombie Dragon | Monster card art |
| `Token_MonsterBack.png` | Monster card back | Deck display |

### Encounter Tokens (11 files)

| File | Use Case |
|---|---|
| `Token_Encounter_Alarm.png` | Alarm trap |
| `Token_Encounter_ConsecratedGround.png` | Positive encounter |
| `Token_Encounter_CrossbowTurret.png` | Crossbow Turret trap |
| `Token_Encounter_CrushingWalls.png` | Crushing Walls trap |
| `Token_Encounter_DartTrap.png` | Dart Trap |
| `Token_Encounter_FireTrap.png` | Fire Trap |
| `Token_Encounter_FreezingCloud.png` | Freezing Cloud |
| `Token_Encounter_IllusionaryCrowd.png` | Illusionary Crowd |
| `Token_Encounter_SlidingWalls.png` | Sliding Walls trap |
| `Token_Encounter_SpearGauntlet.png` | Spear Gauntlet trap |
| `Token_EncounterBack.png` | Encounter card back |

### Item Tokens (16 files)

| File | In-Game Item |
|---|---|
| `Token_Misc_ItemAnimal.png` | Animal companion |
| `Token_Misc_ItemDimensionalShackles.png` | Dimensional Shackles |
| `Token_Misc_ItemFeywalkAmulet.png` | Feywalk Amulet |
| `Token_Misc_ItemFood.png` | Rations |
| `Token_Misc_ItemGravestormsPhylactery.png` | Gravestorm's Phylactery |
| `Token_Misc_ItemHolyWater.png` | Holy Water |
| `Token_Misc_ItemIconOfRavenloft.png` | Icon of Ravenloft |
| `Token_Misc_ItemKavan.png` | Sunsword (Kavan) |
| `Token_Misc_ItemMirror.png` | Mirror |
| `Token_Misc_ItemPortrait.png` | Portrait |
| `Token_Misc_ItemSilverDagger.png` | Silver Dagger |
| `Token_Misc_ItemSkull.png` | Skull |
| `Token_Misc_ItemTorch.png` | Torch |
| `Token_Misc_ItemTreasure.png` | Generic treasure |
| `Token_Misc_ItemWoodenStake.png` | Wooden Stake |
| `Token_Misc_ItemBack.png` | Item card back |

### Condition / Status Tokens (4 files)

| File | Use Case |
|---|---|
| `Token_Misc_ConditionImmobilized.png` | Immobilized condition marker |
| `Token_Misc_ConditionSlowed.png` | Slowed condition marker |
| `Token_Misc_ConditionBack.png` | Condition card back |

### Coffin Tokens (8 files)

| File | Scenario Use |
|---|---|
| `Token_Misc_CoffinBack.png` | Face-down coffin (unexplored) |
| `Token_Misc_CoffinEmpty.png` | Empty coffin result |
| `Token_Misc_CoffinHolyWater.png` | Coffin contains Holy Water |
| `Token_Misc_CoffinMonster.png` | Coffin spawns monster |
| `Token_Misc_CoffinStrahd.png` | Coffin contains Strahd |
| `Token_Misc_CoffinTrap.png` | Coffin triggers trap |
| `Token_Misc_CoffinTreasure.png` | Coffin contains treasure |
| `Token_Misc_CoffinWoodenStake.png` | Coffin contains wooden stake |

### HP / Marker / Misc Tokens (12 files)

| Category | Files |
|---|---|
| HP tracking | `Token_Misc_HP1.png`, `HP1Back`, `HP5`, `HP5Back`, `MonsterHP`, `MonsterHPBack` |
| Healing Surge | `Token_Misc_HealingSurge.png`, `HealingSurgeBack` |
| Markers | `MarkerBack`, `MarkerDragonsBreath`, `MarkerMistForm` |
| Misc | `FreezingCloud`, `Sun`, `Time`, `TimeBack`, `ReactionBack`, `ReactionCalm`, `ReactionEnrage` |

### Adventure / Item Card Backs (3 files)

| File | Use |
|---|---|
| `Token_AdventureBack.png` | Adventure card back |
| `Token_Adventure_KlaksArtifact.png` | Klak's Artifact scenario item |
| `Token_ItemBack.png` | Item card back |
| `Token_Item_GlyphOfWarding.png` | Glyph of Warding item |

### How to Integrate These Assets

**Option A: Direct HTML/CSS overlay (Recommended for MVP)**

- Use token PNGs as `<img>` sources in card/overlay components
- Map card IDs to token filenames via a lookup table in `src/data/tokenMap.ts`
- Display on EncounterCardOverlay, TreasureCardPanel, ConditionMarkers, etc.

**Option B: 3D sprite planes**

- Create Three.js `Sprite` or `Plane` geometries textured with token PNGs
- Place on the dungeon board at token positions
- Good for coffins, traps, quest items that exist physically on tiles

**Option C: Hybrid approach (Best)**

- Use Option A for cards / UI overlays (encounters, treasures, items in hand)
- Use Option B for board tokens (coffins, traps, condition markers on minis)
- Create a `TokenRenderer` component that handles both contexts

---

## 6. Game Flow — What Works vs. What's Broken

### Current Flow

```
Main Menu → Scenario Select → Hero Select → Power Selection → [GAME STARTS]
                                                  ↓
                                          Hero Phase → Move/Attack/Use Power
                                                  ↓
                                          Exploration Phase → Draw Tile → Place → Encounter Card
                                                  ↓
                                          Villain Phase → Monster AI → Trap Activation
                                                  ↓
                                          [Loop back to Hero Phase for next hero]
```

### What actually works when you click through

1. ✅ Main Menu loads
2. ✅ Scenario Selection (5 scenarios available)
3. ✅ Hero Selection (5 heroes)
4. ✅ Power Selection Screen renders with correct hero data
5. ✅ Auto-select and manual power selection both function
6. ✅ Confirm powers → `beginAdventure()` transitions to `'hero'` phase
7. ✅ 3D scene renders with dungeon board and hero models
8. ✅ UIOverlay appears (fixed the JSX bug above)
9. ⚠️ Tile exploration works but only 3 drawable tiles exist
10. ⚠️ Encounter cards draw correctly but monster spawning is incomplete
11. ⚠️ Combat works for basic attacks but power usage UI needs polish

---

## 7. Custom Content Mechanism

### Current Data Architecture (Already Extensible)

The game uses flat JSON files loaded via `DataLoader.getInstance()`. Adding custom content is straightforward:

```
src/data/
├── cards/
│   ├── encounters.json       ← add entries here
│   ├── treasures.json        ← add entries here
│   ├── monsters.json         ← add entries here
│   └── hero-abilities/
│       └── [heroname].json   ← add new hero files
├── heroes.json               ← add hero definitions
├── monsters.json             ← add monster stat blocks
├── powerCards.json            ← add power card definitions
├── scenarios/
│   └── scenario[N].json      ← add new adventure scenarios
└── tiles.json                ← add tile definitions
```

### Recommended Custom Content System

**Phase 1 (MVP):** JSON-based modding

- All game content lives in `src/data/*.json` files
- New cards/monsters/scenarios = new JSON entries following existing schemas
- `DataLoader` already dynamically loads all entries from these files
- Document the JSON schema for each content type

**Phase 2 (Post-MVP):** Mod loader

- Add a `custom/` directory alongside `src/data/`
- Create a `ModLoader` that merges custom content with base game data
- Support JSON files dropped into `custom/cards/`, `custom/heroes/`, etc.
- Add mod enable/disable toggles in Settings

**Phase 3 (Advanced):** In-game editor

- Card builder UI for creating custom encounters, treasures, monsters
- Scenario editor for designing custom adventures
- Export/import as JSON mod packs

### JSON Schema Documentation Needed

- `HeroSchema` — fields: id, name, heroClass, hp, ac, speed, surge, abilities
- `MonsterSchema` — fields: id, name, hp, ac, damage, xpValue, tactics, abilities
- `CardSchema` — fields: id, name, type, description, effects[], phase
- `TileSchema` — fields: id, name, terrainType, connections, boneSquare
- `ScenarioSchema` — fields: id, name, objectives[], specialRules[], startTileId

---

## 8. Immediate Action Plan

### 🔴 P0 — Must Fix Before Playing (1-2 days)

| # | Task | Effort | Why |
|---|---|---|---|
| 1 | ~~Fix App.tsx UIOverlay JSX bug~~ | ✅ Done | Was blocking all gameplay after power selection |
| 2 | Add remaining ~36 tile definitions to `tiles.json` | 4-6 hrs | Without tiles, game dead-ends at tile 4 |
| 3 | Add 10 missing hero ability cards (daily + utility per hero) | 2-3 hrs | Power selection feels empty |
| 4 | Add missing ~12 monster spawn cards to `cards/monsters.json` | 1-2 hrs | Variety; otherwise only 5 monster types appear |

### 🟡 P1 — Complete the Card Set (2-3 days)

| # | Task | Effort |
|---|---|---|
| 5 | Cross-reference PDF card list and fill missing encounter cards (~9) | 2 hrs |
| 6 | Add remaining power cards for each hero class | 3-4 hrs |
| 7 | Create villain/boss cards as data entries | 2 hrs |
| 8 | Create Scenarios 6-13 data files | 4-6 hrs |

### 🟢 P2 — Polish & Assets (3-5 days)

| # | Task | Effort |
|---|---|---|
| 9 | Create `tokenMap.ts` and wire token PNGs to card/overlay components | 3-4 hrs |
| 10 | Implement coffin token system for Scenario 1 | 3-4 hrs |
| 11 | Add 3D trap visualization on tiles | 2-3 hrs |
| 12 | Save/Load UI integration | 2-3 hrs |
| 13 | Audio engine integration (replace DUMMY_MODE) | 4-6 hrs |
| 14 | Document JSON schemas for custom content modding | 2-3 hrs |

### Total Estimated Time to Playable MVP: **6-10 days**

### Total Estimated Time Including Polish: **12-18 days**

---

## 9. Card Artwork Strategy

The PDF lists ~200 cards. Getting artwork for all of them:

### Option A: Use Token PNGs We Already Have

- 73 token images cover monsters, encounters, items, conditions
- Sufficient for ~40% of cards
- Already in the repo at `game_texts/Ravenloft_Tokens/`

### Option B: Generate Card Art with AI Image Generation

- Use the `generate_image` tool to create card illustrations
- Generate gothic/D&D-themed artwork for each card type
- Batch generate: encounter scenes, monster portraits, item icons, treasure gleams
- Output to `public/assets/cards/` for runtime loading

### Option C: Placeholder Procedural Cards (Fastest)

- Generate card frames programmatically in CSS/Canvas
- Use text + color coding (red=encounter, gold=treasure, purple=power)
- Fill in real artwork later without changing game logic

### Recommended Approach: **C → A → B**

1. Start with procedural CSS card frames (instant, functional)
2. Wire in existing token PNGs where they match
3. Generate remaining art with AI image tool as time permits

---

## 10. Files That Need Attention

| File | Issue |
|---|---|
| [App.tsx](file:///c:/antigravity/ravenloft/src/App.tsx) | ✅ Fixed — was the critical blocker |
| [tiles.json](file:///c:/antigravity/ravenloft/src/data/tiles.json) | Only 4 tiles — needs ~36 more |
| [powerCards.json](file:///c:/antigravity/ravenloft/src/data/powerCards.json) | 17 cards — needs hero-specific expansion |
| [cards/monsters.json](file:///c:/antigravity/ravenloft/src/data/cards/monsters.json) | Only 5 monster spawn cards |
| [cards/items.json](file:///c:/antigravity/ravenloft/src/data/cards/items.json) | Only 2 items — Ravenloft has ~15 |
| [monsters.json](file:///c:/antigravity/ravenloft/src/data/monsters.json) | 13 stat blocks — decent, may need 2-3 more |
| [scenarios/](file:///c:/antigravity/ravenloft/src/data/scenarios/) | 5 of 13 scenarios |
| [hero-abilities/](file:///c:/antigravity/ravenloft/src/data/cards/hero-abilities/) | 2 abilities per hero — each needs 2 more |
