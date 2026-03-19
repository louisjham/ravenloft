# Castle Ravenloft Digital Game - MVP Implementation Estimate

**Last Updated:** 2026-03-19
**Project Location:** `c:/antigravity/ravenloft`

---

## Executive Summary

This document provides a comprehensive implementation estimate for the Castle Ravenloft digital game MVP. The MVP aims to deliver a fully playable single-player experience that captures the core mechanics of the board game.

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

**Partially Implemented:**
- 🟡 Monster AI (basic tactics, needs special abilities and advanced behaviors)
- 🟡 Scenario System (basic structure, needs objectives and win/lose conditions)
- 🟡 UI Components (some implemented, many missing)

**Not Implemented:**
- ❌ Advanced Monster AI (special abilities, boss-specific tactics)
- ❌ Power Selection System (choosing power cards for heroes)
- ❌ Condition Markers UI (visual indicators for conditions)
- ❌ Card UI Systems (power selection, encounter, treasure card interfaces)
- ❌ Difficulty Adjustment (healing surge options)
- ❌ Scenario Objectives (adventure-specific win/lose conditions)
- ❌ Adventure-specific rules and mechanics

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

### Phase 4: Advanced Monster AI 🟡 IN PROGRESS

| Component | Status | Notes |
|-----------|--------|-------|
| Basic Tactics | ✅ Complete | Move, attack, move_then_attack, idle |
| Pathfinding | ✅ Complete | A* pathfinding for movement |
| Threat Assessment | ✅ Complete | Hero targeting based on distance/HP |
| Boss Phases Framework | ✅ Complete | Phase structure for bosses |
| Special Abilities | ❌ Not Started | Monster-specific abilities |
| Boss-Specific Tactics | ❌ Not Started | Unique boss behaviors |
| Monster Coordination | ❌ Not Started | Multi-monster strategies |

### Phase 5: Scenario System 🟡 PARTIAL

| Component | Status | Notes |
|-----------|--------|-------|
| Scenario Data Structure | ✅ Complete | JSON scenarios with basic info |
| Scenario Loading | ✅ Complete | ScenarioManager loads scenarios |
| Scenario Objectives | ❌ Not Started | Win/lose conditions |
| Adventure-Specific Rules | ❌ Not Started | Special mechanics per adventure |
| Victory/Defeat Screens | ❌ Not Started | End-game UI |

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
| Condition Markers UI | ❌ Not Started | Visual condition indicators |
| Power Selection UI | ❌ Not Started | Choose power cards |
| Encounter Card UI | ❌ Not Started | Draw/resolve encounter cards |
| Treasure Card UI | ❌ Not Started | Draw/use treasure cards |
| Experience Spending UI | ❌ Not Started | Spend XP interface |
| Victory/Defeat Screens | ❌ Not Started | End-game screens |

### Phase 7: Advanced Features ❌ NOT STARTED

| Component | Status | Notes |
|-----------|--------|-------|
| Power Selection System | ❌ Not Started | Choose power cards per hero |
| Difficulty Adjustment | ❌ Not Started | Healing surge options |
| Save/Load System | 🟡 Partial | Basic structure exists |
| Tutorial System | 🟡 Partial | Basic structure exists |
| Audio System | 🟡 Partial | Basic structure exists |
| Accessibility Features | 🟡 Partial | Basic structure exists |

---

## Remaining Work Analysis

### Largest Game Logic Pieces (Ranked by Complexity)

1. **Advanced Monster AI** - HIGH PRIORITY
   - Special abilities for different monster types
   - Boss-specific tactics and behaviors
   - Monster coordination (if applicable)
   - Special ability triggers and effects
   - Estimated complexity: HIGH

2. **Scenario Objectives System** - HIGH PRIORITY
   - Win/lose conditions per adventure
   - Adventure-specific rules and mechanics
   - Objective tracking and completion
   - Victory/Defeat logic
   - Estimated complexity: HIGH

3. **Power Selection System** - MEDIUM PRIORITY
   - Hero card specifications for power counts
   - Power card pool management
   - Selection UI (manual vs random)
   - Power assignment to heroes
   - Estimated complexity: MEDIUM

4. **Card UI Systems** - MEDIUM PRIORITY
   - Encounter card drawing and resolution UI
   - Treasure card drawing and usage UI
   - Power card selection and usage UI
   - Card animations and effects
   - Estimated complexity: MEDIUM

5. **Condition Markers UI** - LOW PRIORITY
   - Visual indicators for conditions on heroes
   - Condition duration display
   - Hover tooltips for condition effects
   - Estimated complexity: LOW

6. **Difficulty Adjustment** - LOW PRIORITY
   - Healing surge token options (1, 2, 3)
   - Difficulty selection in scenario setup
   - Estimated complexity: LOW

---

## Next Implementation Priority: Advanced Monster AI

### Rationale

Advanced Monster AI is the largest remaining game logic piece and is critical for:

1. **Gameplay Depth**: Special abilities make monsters more interesting and challenging
2. **Boss Encounters**: Bosses need unique tactics to be memorable
3. **Strategic Play**: Players need to anticipate and counter monster abilities
4. **MVP Completeness**: Without advanced AI, combat feels repetitive

### Scope

The Advanced Monster AI implementation will include:

1. **Monster Special Abilities**
   - Define ability data structure
   - Implement ability triggers and effects
   - Create ability library for common monster abilities
   - Integrate abilities into monster tactics

2. **Boss-Specific Tactics**
   - Expand boss phase system with phase-specific behaviors
   - Implement unique boss abilities
   - Create boss AI patterns (e.g., Strahd's teleportation, vampire's regeneration)
   - Phase transition logic and effects

3. **Monster Coordination** (Optional for MVP)
   - Basic monster communication (e.g., goblin swarms)
   - Flanking behaviors
   - Target priority coordination

4. **Special Ability System Architecture**
   - Ability data format in monster JSON
   - Ability execution engine
   - Ability effects on game state
   - Ability cooldowns and charges

---

## Implementation Architecture

### Monster Ability Data Structure

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
  type: 'damage' | 'heal' | 'condition' | 'move' | 'summon' | 'buff' | 'debuff';
  target: 'self' | 'closest_hero' | 'all_heroes' | 'all_monsters' | 'adjacent';
  value?: number;
  condition?: string; // Condition to apply
  duration?: number; // Duration in turns
}
```

### Boss Phase Data Structure

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

---

## File Structure

```
src/game/
├── ai/
│   ├── MonsterAI.ts              (Existing - basic tactics)
│   ├── BossPhases.ts             (Existing - basic structure)
│   ├── Pathfinding.ts            (Existing)
│   ├── ThreatAssessment.ts       (Existing)
│   ├── behaviors/                (New directory)
│   │   ├── SpecialAbilities.ts   (New - ability definitions)
│   │   ├── BossTactics.ts        (New - boss-specific behaviors)
│   │   └── AbilityLibrary.ts     (New - common abilities)
│   └── AbilitySystem.ts          (New - ability execution engine)
├── engine/
│   └── MonsterAI.ts              (Existing - tactic resolution)
├── data/
│   ├── monsters.json             (Update - add abilities)
│   └── boss-phases.json          (New - boss phase data)
└── types.ts                      (Update - add ability types)
```

---

## Next Steps

1. Design and implement the Special Abilities System
2. Create ability library for common monster abilities
3. Implement boss-specific tactics and behaviors
4. Integrate abilities into monster tactics
5. Test and balance monster AI

---

## Notes

- The Villain Phase implementation is complete and tested
- All core game systems are functional
- The next logical step is to enhance monster AI for better gameplay
- UI components can be implemented in parallel with game logic
- Scenario objectives are the next priority after Advanced Monster AI
