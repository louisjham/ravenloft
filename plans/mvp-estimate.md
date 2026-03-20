# Castle Ravenloft Digital Game - MVP Implementation Estimate

**Last Updated:** 2026-03-19 (Encounter System Integration Complete)
**Project Location:** `c:/antigravity/ravenloft`

---

## Executive Summary

This document provides a comprehensive implementation estimate for the Castle Ravenloft digital game MVP. The MVP aims to deliver a fully playable single-player experience that captures the core mechanics of the board game.

**CODE REVIEW FINDINGS (2026-03-19):**

- Multiple components marked as "Not Started" are actually **FULLY IMPLEMENTED**
- Core game systems are more complete than documented
- Primary gap is **UI INTEGRATION** - components exist but aren't connected to the app
- Playable MVP is much closer than the estimate suggests

### Current Implementation Status

**Completed Systems:**

- ✅ Core game loop (Hero Phase → Exploration Phase → Villain Phase)
- ✅ Condition System (Slowed, Immobilized, Poisoned, Dazed, Weakened, Stunned)
- ✅ Power System (Daily, At-Will, Utility powers)
- ✅ Encounter System (Environment, Event, Event-Attack, Trap cards)
- ✅ Treasure System (Blessings, Fortunes, Items)
- ✅ Experience System (XP spending, leveling up)
- ✅ Villain Phase (queue building, monster activation, trap activation)
- ✅ Villain Phase Overlay UI
- ✅ Basic Monster AI (tactics, pathfinding, threat assessment)
- ✅ Boss Phases framework (basic structure)
- ✅ Combat System (attack rolls, damage, HP tracking)
- ✅ Tile System (placement, connections, exploration)
- ✅ Card System (deck management, card drawing)
- ✅ Action Resolver (move, attack, use power actions)
- ✅ **NEW:** Special Abilities System (AbilitySystem.ts)
- ✅ **NEW:** Ability Library (common monster abilities)
- ✅ **NEW:** Monster-Specific Behaviors (Gargoyle, Ghost, Goblin, Skeleton, Strahd, Vampire, Wolf, Zombie)
- ✅ **NEW:** Boss-Specific Tactics (BossTactics.ts with phase definitions)
- ✅ **NEW:** Scenario Objectives System (Objectives.ts with ObjectiveTracker)
- ✅ **NEW:** Victory/Defeat Screens (VictoryScreen.tsx)
- ✅ **NEW:** Boss Phase Data (boss-phases.json with Strahd, Vampire Lord, Young Red Dragon)
- ✅ **NEW:** Monster Abilities Integration (abilities array in monsters.json)
- ✅ **NEW:** Power Selection System (PowerSelectionSystem.ts with constraints, auto-select, validation)
- ✅ **NEW:** Power Selection UI (PowerSelectionScreen.tsx with hero tabs, power cards)
- ✅ **NEW:** Power Card Display (PowerCardDisplay.tsx for individual card rendering)
- ✅ **NEW:** Power Card Data (powerCards.json with 50+ power cards across hero classes)
- ✅ **NEW:** Power Card Loader (powerCardLoader.ts for data management)

**Partially Implemented:**

- 🟡 UI Components (backend systems complete, some UI not integrated)
- 🟡 Adventure-Specific Rules (basic structure exists)

**Not Implemented:**

- ❌ Scenario Setup UI (difficulty selection, hero selection)
- ❌ Experience Spending UI (spend XP interface)
- ❌ Card UI Integration (components exist but not connected to app)
- ❌ Hero Selection UI (choose heroes before game start)

---

## Implementation Breakdown

### Phase 1: Core Game Mechanics ✅ COMPLETED

| Component | Status | Notes |
|-----------|--------|-------|
| Game State Management | ✅ Complete | Zustand store with `subscribeWithSelector` |
| Turn Structure | ✅ Complete | Hero → Exploration → Villain phases |
| Movement System | ✅ Complete | Tile-based movement with diagonal support |
| Combat System | ✅ Complete | d20 rolls, AC comparison, damage |
| Hero System | ✅ Complete | 5 heroes with stats and powers |
| Monster System | ✅ Complete | Monster cards, stats, basic tactics |
| Tile System | ✅ Complete | Dungeon tiles, connections, exploration |
| Card System | ✅ Complete | Deck management, card drawing |

### Phase 2: Advanced Game Systems ✅ COMPLETED

| Component | Status | Notes |
|-----------|--------|-------|
| Condition System | ✅ Complete | All 6 conditions with turn processing |
| Power System | ✅ Complete | Daily, At-Will, Utility powers with tracking |
| Encounter System | ✅ Complete | Environment, Event, Event-Attack, Trap cards |
| Treasure System | ✅ Complete | Blessings, Fortunes, Items with assignment |
| Experience System | ✅ Complete | XP spending, leveling up, natural 20 triggers |
| Villain Phase | ✅ Complete | Queue building, monster/trap activation |

### Phase 3: Villain Phase Additions ✅ COMPLETED

| Component | Status | Notes |
|-----------|--------|-------|
| Villain Queue Building | ✅ Complete | `buildVillainQueue()` in gameStore |
| Monster Activation | ✅ Complete | `resolveTactic()` in MonsterAI |
| Trap Activation | ✅ Complete | `resolveTrap()` and `applyTrapResult()` |
| Villain Phase Overlay | ✅ Complete | `VillainPhaseOverlay.tsx` UI component |
| Trap System | ✅ Complete | Trap placement, activation, disabling |
| Villain Phase State Management | ✅ Complete | `activeVillainId`, `villainPhaseQueue` in store |

**Villain Phase Implementation Details:**

The Villain Phase implementation includes:

1. **Queue Building** (`buildVillainQueue()`):
   - Collects all monsters and traps in play
   - Orders them by draw order (earliest first)
   - Returns ordered list of villain IDs

2. **Monster Activation** (`resolveTactic()`):
   - Evaluates monster tactics against current game state
   - Supports: move, attack, move_then_attack, idle actions
   - Uses pathfinding for movement
   - Calculates optimal targets based on threat assessment

3. **Trap Activation** (`resolveTrap()`):
   - Evaluates trap effects based on trap card data
   - Supports: attack all on tile, attack closest hero
   - Returns damage results to apply

4. **UI Overlay** (`VillainPhaseOverlay.tsx`):
   - Displays current villain being activated
   - Shows progress (e.g., "Activating 2 of 5")
   - Gothic-themed visual design
   - Auto-advances with fade transitions

5. **State Management**:
   - `activeVillainId`: Currently activating villain
   - `villainPhaseQueue`: Ordered list of villains to activate
   - Automatic transition from Hero/Exploration to Villain phase

### Phase 4: Advanced Monster AI ✅ COMPLETED

| Component | Status | Notes |
|-----------|--------|-------|
| Basic Tactics | ✅ Complete | Move, attack, move_then_attack, idle |
| Pathfinding | ✅ Complete | A* pathfinding for movement |
| Threat Assessment | ✅ Complete | Hero targeting based on distance/HP |
| Boss Phases Framework | ✅ Complete | Phase structure for bosses |
| Special Abilities | ✅ Complete | AbilitySystem.ts with execution engine |
| Ability Library | ✅ Complete | 10+ common abilities (fireball, undying, plague_aura, vampiric_bite, mist_form, regeneration, etc.) |
| Monster-Specific Behaviors | ✅ Complete | 8 behavior modules (Gargoyle, Ghost, Goblin, Skeleton, Strahd, Vampire, Wolf, Zombie) |
| Boss-Specific Tactics | ✅ Complete | BossTactics.ts with phase-based behaviors |
| Monster Coordination | 🟡 Partial | Basic coordination via behavior modules |

### Phase 5: Scenario System ✅ COMPLETED

| Component | Status | Notes |
|-----------|--------|-------|
| Scenario Data Structure | ✅ Complete | JSON scenarios with basic info |
| Scenario Loading | ✅ Complete | ScenarioManager loads scenarios |
| Scenario Objectives | ✅ Complete | Objectives.ts with ObjectiveTracker |
| Objective Types | ✅ Complete | 10 types (find_item, kill_boss, escape, escort, survive, find_tile, all_at_position, interact, collect_items, find_event) |
| Adventure-Specific Rules | 🟡 Partial | Basic structure exists |
| Victory/Defeat Screens | ✅ Complete | VictoryScreen.tsx with stats display |

### Phase 6: UI Components 🟡 PARTIAL

| Component | Status | Notes |
|-----------|--------|-------|
| Main Menu | ✅ Complete | Gothic-themed main menu |
| Hero Panel | ✅ Complete | Hero stats and info display |
| Action Bar | ✅ Complete | Action buttons (move, attack, etc.) |
| Card Hand | ✅ Complete | Displays hero's power cards |
| Combat Log | ✅ Complete | Logs combat events |
| Turn Indicator | ✅ Complete | Shows current phase/hero |
| Villain Phase Overlay | ✅ Complete | Shows villain activation |
| Victory/Defeat Screens | ✅ Complete | VictoryScreen.tsx with stats and narrative text |
| Power Selection UI | ✅ Complete | PowerSelectionScreen.tsx with hero tabs and power cards |
| Power Card Display | ✅ Complete | PowerCardDisplay.tsx for individual card rendering |
| Condition Markers UI | ✅ Complete | Integrated into HeroPanel.tsx |
| Encounter Card UI | ✅ Complete | Integrated into App.tsx and EncounterSystem.ts |
| Treasure Card UI | ✅ Complete | Integrated into App.tsx and UIOverlay.tsx |
| Card Flip Animation | ✅ Complete | CardFlip.tsx (107 lines) with 3D flip |
| Card Face Display | ✅ Complete | CardFace.tsx for card rendering |
| Card Resolution System | ✅ Complete | CardResolutionSystem.ts (165 lines) |
| Experience System | ✅ Complete | ExperienceSystem.ts (228 lines) with leveling |
| Experience Spending UI | ❌ Not Started | Spend XP interface |
| Scenario Setup UI | ❌ Not Started | Difficulty/hero selection |
| Hero Selection UI | ❌ Not Started | Choose heroes before game |

### Phase 7: Advanced Features 🟡 PARTIAL

| Component | Status | Notes |
|-----------|--------|-------|
| Power Selection System | ✅ Complete | Choose power cards per hero with constraints |
| Card UI Systems | ✅ Complete | Fully integrated (Encounter + Treasure) |
| Difficulty Adjustment | 🟡 Partial | Settings exist, no UI selector |
| Save/Load System | 🟡 Partial | Basic structure exists |
| Tutorial System | 🟡 Partial | Basic structure exists |
| Audio System | 🟡 Partial | Basic structure exists |
| Accessibility Features | 🟡 Partial | Basic structure exists |

---

## Remaining Work Analysis

### CODE REVIEW FINDINGS (2026-03-19)

**DISCOVERY:** Multiple components marked as "Not Started" are actually FULLY IMPLEMENTED:

- `EncounterCardOverlay.tsx` (242 lines) - Complete encounter card UI with phases, effects display
- `TreasureCardPanel.tsx` (176 lines) - Complete treasure card UI with usage interface
- `ConditionMarkers.tsx` (115 lines) - Complete condition visual indicators with duration badges
- `CardFlip.tsx` (107 lines) - Card flip animation component
- `CardFace.tsx` - Card face display component
- `CardResolutionSystem.ts` (165 lines) - Complete card resolution system
- `ExperienceSystem.ts` (228 lines) - Complete XP system with leveling

**PRIMARY GAP: SETUP & XP UI**

- Scenario selection and Hero selection are still hardcoded in `MainMenu.tsx`
- Experience spending (canceling encounters, leveling up) has no UI interface yet
- Core gameplay (movement, combat, exploration, encounters) is 100% playable in the 3D scene

### Largest Remaining Tasks (Ranked by Complexity)

1. **Card UI Integration** - HIGH PRIORITY (CRITICAL FOR PLAYABILITY)
    - Add `EncounterCardOverlay` to `App.tsx` when card resolution state is active
    - Add `TreasureCardPanel` to `App.tsx` when treasure is drawn
    - Wire up card drawing during exploration phase
    - Connect card resolution actions to UI
    - Estimated complexity: MEDIUM (components exist, just need integration)
    - **Risk Factors:**
      - State synchronization between card resolution and game flow
      - Timing of card displays during exploration
      - Proper cleanup when card resolution completes

2. **Scenario Setup UI** - HIGH PRIORITY (NEEDED FOR GAME START)
    - Create scenario selection screen with difficulty options
    - Add hero selection interface (choose 1-5 heroes)
    - Add healing surge token selection (1, 2, or 3 surges)
    - Connect to `startNewGame` with selected parameters
    - Estimated complexity: MEDIUM

3. **Condition Markers Integration** ✅ COMPLETED
    - Integrated into `HeroPanel.tsx`
    - Displaying active conditions with duration badges
    - Status: Fully Functional

4. **Experience Spending UI** - MEDIUM PRIORITY
    - Create XP spending interface
    - Allow spending XP to cancel encounter cards
    - Allow spending XP to level up heroes
    - Display available XP from experience pile
    - Estimated complexity: MEDIUM

5. **Hero Selection UI** - LOW PRIORITY (CAN USE DEFAULTS FOR MVP)
    - Choose heroes before game start
    - Display hero stats and abilities
    - Estimated complexity: LOW

---

## Next Implementation Priority: Path to Playable MVP

### Rationale

Based on the code review, the game is MUCH closer to a playable MVP than previously estimated. The primary remaining work is **UI INTEGRATION** - most components already exist and are fully functional.

### Playable MVP Definition

A playable MVP should allow:

1. **Start a game** with scenario selection and hero selection
2. **Explore the dungeon** with tile placement
3. **Encounter cards** drawn during exploration with visual feedback
4. **Combat** with monsters (move, attack, powers)
5. **Treasure cards** discovered and used
6. **Villain phase** with monster activation
7. **Victory/defeat** conditions checked and displayed

### Implementation Priority (Fast Path to Playable MVP)

#### 1. Card UI & Conditions Integration ✅ COMPLETED

**Status:** Completed and verified

**Tasks:**

- Add `EncounterCardOverlay` to `App.tsx`: ✅ Done
- Wire up `drawEncounterCard()` during exploration: ✅ Done
- Implement `advanceCardResolution()` logic: ✅ Done
- Use real card data from `DataLoader`: ✅ Done
- Integrate `ConditionMarkers` into `HeroPanel`: ✅ Done

**Files to modify:**

- `src/App.tsx` - Add card overlay components
- `src/game/engine/TileSystem.ts` - Trigger encounter card on tile placement
- `src/components/ui/ActionBar.tsx` - Add treasure card button

#### 2. Scenario Setup UI (HIGH PRIORITY - 1 day)

**Status:** New component needed

**Tasks:**

- Create `ScenarioSetupScreen.tsx` with:
  - Scenario selection (dropdown or cards)
  - Hero selection (checkboxes for 1-5 heroes)
  - Difficulty selection (Easy/Medium/Hard)
  - Healing surge selection (1/2/3)
- Replace hardcoded scenario/hero in `MainMenu.tsx`
- Connect to `startNewGame` with selected parameters

**Files to create:**

- `src/components/ui/ScenarioSetupScreen.tsx`

**Files to modify:**

- `src/components/ui/MainMenu.tsx` - Route to setup screen

#### 3. Condition Markers Integration (MEDIUM PRIORITY - 0.5 day)

**Status:** Component exists, need integration

**Tasks:**

- Add `ConditionMarkers` to `HeroPanel.tsx`
- Display for each hero with their active conditions
- Show duration badges

**Files to modify:**

- `src/components/ui/HeroPanel.tsx`

#### 4. Experience Spending UI (LOW PRIORITY FOR MVP - 0.5 day)

**Status:** New component needed

**Tasks:**

- Create simple XP spending dialog
- Allow cancel encounter cards (5 XP)
- Allow level up heroes (5 XP)
- Display available XP

**Files to create:**

- `src/components/ui/ExperienceDialog.tsx`

**Files to modify:**

- `src/components/ui/HeroPanel.tsx` - Add XP spend button

### Estimated Time to Playable MVP

| Task | Estimated Time | Priority |
|------|---------------|----------|
| Scenario Setup UI | 1 day | CRITICAL |
| Experience Spending UI | 0.5 day | MEDIUM |
| **TOTAL** | **1.5 days** | - |

**Note:** This assumes the existing components work as expected. Integration testing and bug fixing may add additional time.

---

## Implementation Architecture

### Monster Ability Data Structure (IMPLEMENTED)

```typescript
interface MonsterAbility {
  id: string;
  name: string;
  description: string;
  type: 'passive' | 'active' | 'triggered';
  trigger?: string; // For triggered abilities
  cooldown?: number; // For active abilities
  effects: AbilityEffect[];
}

interface AbilityEffect {
  type: 'damage' | 'heal' | 'condition' | 'move' | 'summon' | 'buff' | 'debuff' | 'teleport';
  target: 'self' | 'closest_hero' | 'all_heroes' | 'all_monsters' | 'adjacent' | 'adjacent_heroes' | 'tile';
  value?: number;
  condition?: string; // Condition to apply
  duration?: number; // Duration in turns
}
```

### Boss Phase Data Structure (IMPLEMENTED)

```typescript
interface BossPhase {
  id: string;
  className: string;
  hpThreshold: number; // 0.0 to 1.0
  triggers: string[];
  abilities: string[];
  tactics: TacticPattern[];
}
```

### Scenario Objective Data Structure (IMPLEMENTED)

```typescript
interface Objective {
  id: string;
  type: 'find_item' | 'kill_boss' | 'escape' | 'escort' | 'survive' |
        'find_tile' | 'all_at_position' | 'interact' | 'collect_items' | 'find_event';
  description: string;
  isCompleted: boolean;
  targetId?: string;
  targetTileId?: string;
  targetEntityId?: string;
  targetPositionId?: string;
  count?: number;
  currentCount?: number;
}
```

---

## File Structure

```
src/game/
├── ai/
│   ├── MonsterAI.ts              (Existing - basic tactics)
│   ├── BossPhases.ts             (Existing - basic structure)
│   ├── Pathfinding.ts            (Existing)
│   ├── ThreatAssessment.ts       (Existing)
│   ├── AbilitySystem.ts          (✅ Complete - ability execution engine)
│   └── behaviors/                (✅ Complete directory)
│       ├── AbilityLibrary.ts     (✅ Complete - common abilities)
│       ├── BossTactics.ts        (✅ Complete - boss-specific behaviors)
│       ├── GargoyleBehavior.ts   (✅ Complete - gargoyle behavior)
│       ├── GhostBehavior.ts      (✅ Complete - ghost behavior)
│       ├── GoblinBehavior.ts     (✅ Complete - goblin behavior)
│       ├── SkeletonBehavior.ts   (✅ Complete - skeleton behavior)
│       ├── StrahdBehavior.ts     (✅ Complete - Strahd behavior)
│       ├── VampireBehavior.ts    (✅ Complete - vampire behavior)
│       ├── WolfBehavior.ts       (✅ Complete - wolf behavior)
│       └── ZombieBehavior.ts     (✅ Complete - zombie behavior)
├── engine/
│   ├── MonsterAI.ts              (Existing - tactic resolution)
│   ├── PowerSelectionSystem.ts   (✅ Complete - power selection logic)
│   ├── EncounterSystem.ts        (✅ Complete - encounter card system)
│   ├── TreasureSystem.ts         (✅ Complete - treasure card system)
│   ├── ExperienceSystem.ts       (✅ Complete - XP and leveling)
│   └── CardResolutionSystem.ts  (✅ Complete - card resolution engine)
├── scenarios/
│   ├── ScenarioManager.ts        (Existing)
│   ├── Events.ts                 (Existing)
│   └── Objectives.ts             (✅ Complete - objective system)
├── data/
│   ├── monsters.json             (✅ Updated - with abilities)
│   ├── boss-phases.json          (✅ Complete - boss phase data)
│   ├── powerCards.json           (✅ Complete - 50+ power cards)
│   └── powerCardLoader.ts        (✅ Complete - power card data loader)
└── types.ts                      (✅ Updated - with ability types)

src/components/ui/
├── VictoryScreen.tsx             (✅ Complete - victory/defeat screens)
├── PowerSelectionScreen.tsx      (✅ Complete - power selection UI)
├── PowerCardDisplay.tsx          (✅ Complete - individual power card display)
├── EncounterCardOverlay.tsx      (✅ Complete - ✅ INTEGRATED)
├── TreasureCardPanel.tsx         (✅ Complete - ✅ INTEGRATED)
├── ConditionMarkers.tsx          (✅ Complete - ✅ INTEGRATED)
├── cards/
│   ├── CardFace.tsx              (✅ Complete - card face display)
│   └── CardFlip.tsx             (✅ Complete - card flip animation)
└── [ScenarioSetupScreen.tsx]     (❌ NEEDED - scenario/hero selection)
```

---

## Next Steps

### Immediate (Path to Playable MVP - 3-4 days)

1. **Scenario Setup UI** (CRITICAL - Start Here)
   - Create `ScenarioSetupScreen.tsx` with scenario/hero/difficulty/surge selection
   - Update `MainMenu.tsx` to route to setup screen
   - Connect to `startNewGame` with selected parameters

2. **Experience Spending UI** (MEDIUM PRIORITY)
   - Create simple XP spending dialog
   - Allow cancel encounter cards and level up heroes
   - Connect to `ExperienceSystem.ts` methods

### Future Enhancements (Post-MVP)

1. Save/Load System - Persist game state
2. Tutorial System - Guide new players
3. Audio System - Music and sound effects
4. Accessibility Features - Screen reader support, high contrast mode
5. Adventure-Specific Rules - Unique mechanics per adventure
6. Multiplayer Support - Co-op gameplay

---

## Summary & Key Findings

### What's Complete

**Core Game Systems (100%):**

- ✅ Game loop (Hero → Exploration → Villain phases)
- ✅ Condition System (all 6 conditions with turn processing)
- ✅ Power System (Daily, At-Will, Utility powers)
- ✅ Encounter System (Environment, Event, Event-Attack, Trap cards)
- ✅ Treasure System (Blessings, Fortunes, Items)
- ✅ Experience System (XP spending, leveling up)
- ✅ Villain Phase (queue building, monster/trap activation)
- ✅ Combat System (attack rolls, damage, HP tracking)
- ✅ Tile System (placement, connections, exploration)
- ✅ Card System (deck management, card drawing)
- ✅ Monster AI (tactics, pathfinding, threat assessment)
- ✅ Boss Phases (phase-based behaviors)
- ✅ Special Abilities (AbilitySystem with 10+ abilities)
- ✅ Monster-Specific Behaviors (8 behavior modules)
- ✅ Scenario Objectives (10 objective types)
- ✅ Victory/Defeat Screens

**UI Components (Mostly Complete):**

- ✅ Main Menu
- ✅ Hero Panel
- ✅ Action Bar
- ✅ Card Hand
- ✅ Combat Log
- ✅ Turn Indicator
- ✅ Villain Phase Overlay
- ✅ Victory/Defeat Screens
- ✅ Power Selection Screen
- ✅ Power Card Display
- ✅ Condition Markers
- ✅ Encounter Card Overlay
- ✅ Treasure Card Panel
- ✅ Card Flip Animation
- ✅ Card Face Display
- ✅ Card Resolution System
- ✅ Experience System

### What's Missing for Playable MVP

1. **Card UI Integration** - Components exist, need to be connected to app
2. **Scenario Setup UI** - Need scenario/hero/difficulty/surge selection screen
3. **Condition Markers Integration** - Component exists, need to add to HeroPanel
4. **Experience Spending UI** - Need simple dialog for XP spending

### Estimated Time to Playable MVP

**1.5 days** of focused development work.

### Key Insight

The codebase is now **mostly integrated**. The only remaining major hurdle for a "Complete" MVP loop is the **Scenario Setup interface**. All core gameplay mechanics are now functional and wired to the UI.

This means the project is in its **final polish and entry-point phase**.
