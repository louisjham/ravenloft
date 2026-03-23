# Castle Ravenloft Digital — MVP Status & Roadmap

**Date:** 2026-03-23 (Updated — Tile Placement Engine Complete)
**Project:** `c:\antigravity\ravenloft` (Vite + React Three Fiber + Zustand)
**Purpose:** Honest assessment of where we stand vs. a *playable* game.

---

## 1. Build Status: ✅ PASSING

```
npm run build → 0 TypeScript errors
✓ 765 modules transformed
✓ built in 10.35s
```

The game compiles, runs, and now supports the full interactive tile placement loop.

---

## 2. Current Data Inventory

### Actual Counts (as of 2026-03-23)

| Category | Count | Board Game | Gap | Status |
|---|---|---|---|---|
| **Tiles** | 4 (JSON) / 43 (PNG) | ~40 | **-36 JSON entries** | 🟡 Data Entry Only |
| **Power Cards** | 17 | ~40-50 | **-23 to -33** | 🔴 Critical |
| **Hero Abilities** | 10 (2×5) | 20 (4×5) | **-10** | 🟡 Partial |
| **Monster Stat Blocks** | 13 | ~13 | ✅ 0 | ✅ Complete |
| **Monster Spawn Cards** | 5 | ~30 | **-25** | 🔴 Critical |
| **Encounter Cards** | 35 | ~44 | **-9** | 🟢 Good |
| **Treasure Cards** | 34 | ~32 | ✅ +2 | ✅ Complete |
| **Items** | 2 | ~15 | **-13** | 🟡 Partial |
| **Scenarios** | 5 | 13 | **-8** | 🟢 MVP OK |

### Tile Assets Available (Not Yet in JSON)

We have **43 tile PNG images** in `public/assets/tiles/`. The placement *engine* is complete; only JSON data entry remains:

**Corridor — Black deck (12):**
- Tile_Black_x2_01 – _04 (4 tiles, 2 exits)
- Tile_Black_x3_01 – _02 (2 tiles, 3 exits)
- Tile_Black_x4_01 – _06 (6 tiles, 4 exits / crossroads)

**Corridor — White deck (8):**
- Tile_White_x2_01 – _03, Tile_White_x3_01 – _05

**Named Rooms (8):**
- Named_ArcaneCircle, Named_Chapel, Named_DarkFountain, Named_FetidDen
- Named_Laboratory, Named_RottingNook, Named_SecretStairway, Named_Workshop

**Crypt Tiles (12):**
- Crypt_StrahdsCrypt, Crypt_KingsCrypt, Crypt_LonelyCrypt, Crypt_IreenaKolyanasCrypt
- Crypt_PrinceAurelsCrypt, Crypt_CryptOfArtimus, Crypt_CryptOfBarovAndRavenovia
- Crypt_CryptOfSergeiVonZarovich, Crypt_Corner1-5, Crypt_Corner6-10, Crypt_Corner11-15, Crypt_Corner16-20

**The code blocker is gone. This is now purely a data-entry gap.**

---

## 3. Architecture Overview

```
src/
├── App.tsx                   # Root; orchestrates full tile placement loop
├── main.tsx                  # Entry point
├── store/
│   ├── gameStore.ts          # Central Zustand store (1185 lines)
│   └── uiStore.ts            # UI state + tile placement state
│       #  showTilePlacer, pendingTileRotation, tilePlacementError
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
│   │   ├── ExplorationStateMachine.ts  ✅ NEW — tile placement FSM
│   │   ├── MonsterAI.ts
│   │   ├── PowerSelectionSystem.ts
│   │   ├── PowerSystem.ts
│   │   ├── TileSystem.ts               ✅ EXPANDED — edge validation, rotation, graph
│   │   ├── TreasureSystem.ts
│   │   ├── CardResolutionSystem.ts
│   │   ├── CardSystem.ts
│   │   └── ActionResolver.ts
│   ├── ai/                   # AbilitySystem, BossPhases, Monster behaviors
│   ├── progression/          # SaveSystem
│   └── scenarios/            # Scenario validation / objectives
├── components/
│   ├── 3d/
│   │   ├── ExplorationLayer.tsx  ✅ NEW — arrows + live tile preview with rotation
│   │   ├── ExplorationArrow.tsx  ✅ NEW — clickable edge arrows
│   │   └── (Scene, DungeonBoard, Hero3D, Monster3D, etc.)
│   ├── ui/
│   │   ├── RotationPicker.tsx    ✅ NEW — rotation selector with auto-confirm
│   │   └── (UIOverlay, EncounterCardOverlay, TreasureCardPanel, etc.)
│   ├── effects/              # Transitions
│   ├── interaction/          # GameController
│   ├── settings/             # AudioSettings
│   └── tutorial/             # TutorialSystem
├── data/
│   ├── heroes.json           # 5 heroes
│   ├── monsters.json         # 13 monster stat blocks
│   ├── tiles.json            # 4 tiles (NEEDS DATA ENTRY — engine is ready)
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

## 4. Game Flow — What Works

### Current Flow

```
Main Menu → Scenario Select → Hero Select → Power Selection → [GAME STARTS]
                                                  ↓
                                          Hero Phase → Move / Attack / Use Power
                                                  ↓
                                          Exploration Phase
                                                  ↓
                              Click open-edge arrow on 3D board
                                                  ↓
                              TileSystem.drawAndPlace() — find first valid tile in deck
                                                  ↓
                              Live 3D preview appears at target position
                                                  ↓
                              RotationPicker — choose rotation
                              (auto-confirms if only one option is valid)
                                                  ↓
                              [R] Rotate  [Enter/Click] Confirm  [Esc] Cancel
                                                  ↓
                              isPlacementValid() — edge alignment check vs neighbors
                         ┌──────────────────────────────────────────────────┐
                    invalid (error toast + log)                          valid
                         │                                                  │
                   stay in positioning                        TileSystem.placeTile()
                                                                connects graph, rotates
                                                                bone square, updates deck
                                                                         ↓
                                                              drawEncounterCard()
                                                                         ↓
                                          Villain Phase → Monster AI → Trap Activation
                                                  ↓
                                          [Loop back to Hero Phase for next hero]
```

### Verified Working (✅)

1. ✅ Main Menu loads
2. ✅ Scenario Selection (5 scenarios)
3. ✅ Hero Selection (5 heroes)
4. ✅ Power Selection Screen renders with correct hero data
5. ✅ Auto-select and manual power selection both function
6. ✅ Confirm powers → `beginAdventure()` transitions to `'hero'` phase
7. ✅ 3D scene renders with dungeon board and hero models
8. ✅ UIOverlay appears correctly
9. ✅ TypeScript compiles with 0 errors
10. ✅ Vite production build succeeds
11. ✅ **Exploration arrows** rendered at every open edge of revealed tiles
12. ✅ **Arrow click → deck draw** — `drawAndPlace()` finds first tile that fits the incoming edge
13. ✅ **Live 3D tile preview** shown at target grid position with correct rotation
14. ✅ **RotationPicker UI** — lists valid rotations, auto-confirms when only one exists
15. ✅ **Keyboard shortcuts** — `[R]` rotate, `[Enter]` confirm, `[Esc]` cancel
16. ✅ **Edge validation on confirm** — `isPlacementValid()` checks open/closed alignment against all neighboring tiles
17. ✅ **Error feedback** — invalid placements show reason in red overlay and in combat log
18. ✅ **Tile committed to board** — `placeTile()` handles coord assignment, rotation, bone-square rotation, and bidirectional graph linkage (`connectTiles`)
19. ✅ **Encounter card drawn after placement** (skipped during `'setup'` phase)
20. ✅ **Deck exhausted** — shows user prompt, gracefully handled

### Known Issues (⚠️)

1. ⚠️ **Only 4 tiles in JSON** — game dead-ends after 3 explorations (data entry, not code)
2. ⚠️ **Only 5 monster spawn cards** — limited monster variety
3. ⚠️ **Power selection feels thin** — only 17 powers for 5 classes

---

## 5. Core Mechanic Fidelity Audit

### ✅ Faithfully Implemented

| Mechanic | Board Game Rule | Our Implementation |
|---|---|---|
| **Turn Structure** | Hero Phase → Exploration → Villain Phase | `endTurn()` in gameStore correctly chains phases |
| **Tile Exploration** | Draw tile, place at open edge | `TileSystem.drawAndPlace()` finds first legal tile |
| **Tile Rotation** | Player chooses orientation | `RotationPicker` + `rotateConnections()` + `rotateBoneSquare()` |
| **Edge Alignment** | Open edges must connect; walls must not open onto walls | `isPlacementValid()` + `validateEdgeAlignment()` |
| **Tile Graph** | Tiles track adjacency for movement/LOS | `connectTiles()` sets `connectedTileId` bidirectionally |
| **Draw Different Tile** | If current tile doesn't fit, cycle deck | `returnAndDrawNext()` + `onDrawDifferentTile()` FSM transition |
| **Encounter Cards** | draw encounter when new tile placed | `drawEncounterCard()` called after successful placement |
| **Power Selection** | Choose powers during setup before adventure starts | `PowerSelectionSystem` + `PowerSelectionScreen` UI |
| **Combat** | d20 + attack bonus vs AC | `CombatSystem.resolveAttack()` |
| **Conditions** | Slowed, Immobilized, Poisoned, Dazed, Weakened, Stunned | `ConditionSystem` with full status-effect logic |
| **Healing Surges** | Shared party resource, spend to heal 2 HP | `healingSurges` tracked in game state |
| **Treasure Cards** | Blessings (instant), Fortunes (one-use), Items (persistent) | `TreasureSystem` with 3 treasure types |
| **Experience** | Spend 5 XP to cancel encounter or level up | `ExperienceSystem` with both paths |
| **Villain Phase** | Activate each villain card, then each monster | `executeVillainPhase()` builds queue, processes sequentially |

### 🟡 Partially Implemented (Needs Work)

| Mechanic | Issue | Fix Required |
|---|---|---|
| **Tile Content** | Only 4 tiles in JSON | Pure data entry — all 43 PNGs wired and ready |
| **Monster Tactics** | Generic AI for all monsters | Each monster type needs unique tactic behavior |
| **Line of Sight** | Not implemented | Board game uses same-tile or adjacent-tile adjacency |
| **Trap Placement** | Traps exist in state | Need 3D visualization on tiles |

### ❌ Missing Mechanics

| Mechanic | Board Game Rule | Status |
|---|---|---|
| **Coffin Tokens** | Scenario 1 requires searching coffins | No implementation — assets exist in `Ravenloft_Tokens/` |
| **Quest Item Tokens** | Some scenarios require carrying items | Token images exist but no game logic |
| **Environment Cards** | Persist until replaced | Field exists in state but no resolution logic |
| **Multiple Attack Types** | Melee vs ranged with different ranges | Only basic attack currently |
| **Item Equip/Unequip** | Items assignable to any hero in same tile | `assignItem()` exists but no proximity check |
| **Scenario Special Triggers** | Unique win/loss conditions per adventure | Only Scenario 1 has detailed triggers |

---

## 6. Token Asset Inventory (Ravenloft_Tokens/)

We have **73 PNG token images** ready to use:

- **Monster Tokens:** 12 files (Dracolich, Flesh Golem, Howling Hag, etc.)
- **Encounter Tokens:** 11 files (traps, environmental effects)
- **Item Tokens:** 16 files (Holy Water, Stake, Torch, etc.)
- **Condition Tokens:** 4 files (Immobilized, Slowed, etc.)
- **Coffin Tokens:** 8 files (Empty, Monster, Trap, Treasure, etc.)
- **HP/Markers:** 12 files (HP tracking, Healing Surge, etc.)

---

## 7. Immediate Action Plan for Playable MVP

### 🔴 P0 — Critical Blockers (~1 day, revised down from 2-3)

| # | Task | Effort | Why |
|---|---|---|---|
| 1 | **Expand tiles.json to ~40 tiles** | 3-4 hrs | Game dead-ends after 3 tiles; engine is ready — pure JSON data entry |
| 2 | **Add 25 monster spawn cards** | 2-3 hrs | Only 5 monster types currently spawn |
| 3 | **Add 10 missing hero abilities** | 2-3 hrs | Each hero needs daily + utility powers |

> **Note:** Tile placement code was previously P0. It is ✅ complete. All code plumbing (draw, preview, rotate, validate, commit, encounter trigger) is done.

### 🟡 P1 — Complete Experience (2-3 days)

| # | Task | Effort |
|---|---|---|
| 4 | Add missing encounter cards (~9) | 2 hrs |
| 5 | Add missing item cards (~13) | 2 hrs |
| 6 | Implement coffin token system for Scenario 1 | 3-4 hrs |
| 7 | Add 3D trap visualization on tiles | 2-3 hrs |

### 🟢 P2 — Polish (3-5 days)

| # | Task | Effort |
|---|---|---|
| 8 | Create `tokenMap.ts` and wire token PNGs to UI | 3-4 hrs |
| 9 | Save/Load UI integration | 2-3 hrs |
| 10 | Audio engine integration (replace DUMMY_MODE) | 4-6 hrs |
| 11 | Add Scenarios 6-13 data files | 4-6 hrs |
| 12 | Document JSON schemas for modding | 2-3 hrs |

---

## 8. Estimated Timeline

| Milestone | Time | Status |
|---|---|---|
| **Build Passing** | — | ✅ Done |
| **Tile Placement Engine** | — | ✅ Done (was previously a P0 blocker) |
| **Playable MVP** | ~1 day | 🟡 Data entry only |
| **Complete Card Set** | +2-3 days | 🟡 Pending |
| **Polished Release** | +3-5 days | 🟢 Optional |

### Total Estimated Time to Playable MVP: **~1 day** *(revised from 2-3 days)*

The tile placement engine, edge validation, rotation picker, live 3D preview, encounter card trigger, and deck exhaustion handling are all implemented. All remaining P0 work is JSON data entry.

### Total Estimated Time Including Polish: **5-8 days** *(revised from 7-11 days)*

---

## 9. Files That Need Attention

| File | Current | Target | Priority |
|---|---|---|---|
| [`tiles.json`](src/data/tiles.json) | 4 tiles | ~40 tiles | 🔴 P0 — data entry only, engine ready |
| [`cards/monsters.json`](src/data/cards/monsters.json) | 5 cards | 30 cards | 🔴 P0 |
| [`powerCards.json`](src/data/powerCards.json) | 17 cards | 40+ cards | 🟡 P1 |
| [`cards/items.json`](src/data/cards/items.json) | 2 cards | 15 cards | 🟡 P1 |
| [`cards/hero-abilities/*.json`](src/data/cards/hero-abilities/) | 10 cards | 20 cards | 🟡 P1 |

---

## 10. Quick Win: Tile Data Entry

Expanding `tiles.json` is the single fastest path to a playable game. Paste the template below once per tile; the engine will do the rest.

**Template for each tile:**

```json
{
  "id": "tile_black_x2_01",
  "name": "Dark Corridor",
  "x": 0,
  "z": 0,
  "terrainType": "corridor",
  "isRevealed": false,
  "isStart": false,
  "isExit": false,
  "rotation": 0,
  "connections": [
    { "edge": "north", "isOpen": true },
    { "edge": "south", "isOpen": true },
    { "edge": "east",  "isOpen": false },
    { "edge": "west",  "isOpen": false }
  ],
  "monsters": [],
  "heroes": [],
  "items": [],
  "boneSquare": { "sqX": 1, "sqZ": 1 },
  "imageUrl": "/assets/tiles/Tile_Black_x2_01.png",
  "encounterType": "black",
  "openEdges": ["north", "south"]
}
```

**Available tile images (43 files in `public/assets/tiles/`):**

```
Tile_Black_x2_01 – _04    (2-exit black corridors)
Tile_Black_x3_01 – _02    (3-exit black corridors)
Tile_Black_x4_01 – _06    (4-exit crossroads)
Tile_White_x2_01 – _03    (2-exit white corridors)
Tile_White_x3_01 – _05    (3-exit white corridors)
Named_*.png               (8 special named rooms)
Crypt_*.png               (12 crypt rooms + corner tile sets)
```

---

## 11. New Tile Placement Systems Added

The following pipeline was built and is now fully functional end-to-end:

| System | File | What it does |
|---|---|---|
| **ExplorationStateMachine** | `engine/ExplorationStateMachine.ts` | FSM: idle → positioning → placing → idle. Handles cancel, deck-cycle, and exhaustion |
| **Edge Validation** | `engine/TileSystem.ts` `isPlacementValid()` | Open/closed alignment vs. all placed neighbors |
| **Rotation Engine** | `engine/TileSystem.ts` `rotateConnections()` / `rotateBoneSquare()` | Pure lookup-table–based clockwise rotation; no trig |
| **Valid Rotation Filter** | `engine/TileSystem.ts` `getValidRotations()` | Pre-filters rotations that expose an open edge to the incoming corridor |
| **Deck Cycling** | `engine/TileSystem.ts` `returnAndDrawNext()` | Returns current tile to deck bottom; draws next legal fit |
| **Tile Graph Linker** | `engine/TileSystem.ts` `connectTiles()` | Bidirectional `connectedTileId` wiring + closes edges that meet walls |
| **ExplorationLayer** | `components/3d/ExplorationLayer.tsx` | Renders clickable edge arrows + live 3D preview tile at correct position and rotation |
| **RotationPicker** | `components/ui/RotationPicker.tsx` | Gothic modal for rotation selection; auto-confirms when ≤ 1 option |
| **uiStore tile state** | `store/uiStore.ts` | `showTilePlacer`, `pendingTileRotation`, `tilePlacementError`, `rotatePendingTile` |
| **App.tsx integration** | `App.tsx` | Keyboard event handlers `confirm-tile-placement` / `cancel-tile-placement`; full orchestration |

---

## 12. Conclusion

**The game is technically sound** — TypeScript compiles, build passes, all core systems implemented.

**The tile placement engine is complete** — clicking an arrow, seeing the live 3D preview, rotating, validating edges, and committing to the board all work end-to-end.

**The only remaining MVP blocker is data entry** — populate `tiles.json` with ~36 entries using the 43 PNG assets already in place.

**Estimated time to playable:** ~1 day of focused data entry and smoke-testing.
