# AMI-1 Type Definitions - Ground Truth Answers

**Date:** 2026-03-19

---

## Question 1: Does src/game/ai/BossPhases.ts already exist?

**Answer:** YES

**Current exported types and methods:**

```typescript
// Exported Type:
export interface BossPhase {
  id: string;
  className: string;
  hpThreshold: number; // 0.0 to 1.0
  triggers: string[];
  abilities: string[];
}

// Exported Class and Methods:
export class BossPhases {
  private static config: Record<string, BossPhase[]> = { ... };

  public static getCurrentPhase(monster: Monster): BossPhase | null;
  public static shouldTriggerTransition(monster: Monster, lastHp: number): boolean;
}
```

**Note:** The file exists with basic structure. It will need enhancement to add:
- `tactics: TacticPattern[]` to BossPhase interface
- `passiveAbilities?: string[]` to BossPhase interface
- Additional methods for phase transition and tactic evaluation

---

## Question 2: Does Monster in types.ts currently have an hp field? What is its type?

**Answer:** YES - `number`

```typescript
export interface Entity {
  id: string;
  name: string;
  type: EntityType;
  position: Position;
  hp: number;        // <-- Type is number
  maxHp: number;     // <-- Also number
  ac: number;
  speed: number;
  isExhausted: boolean;
  conditions: Condition[];
  usedPowers: string[];
}

export interface Monster extends Entity {
  type: 'monster';
  monsterType: string;
  behavior: MonsterBehavior;
  attackBonus: number;
  damage: number;
  experienceValue: number;
  ownedByHeroId: string | null;
  moveRange?: number;
}
```

**Implication:** Boss phase transition check can use `monster.hp / monster.maxHp` directly to calculate HP ratio.

---

## Question 3: Does GameState have a monsters field that is Tile[] or a separate Record/Map structure?

**Answer:** `Monster[]` (array)

```typescript
export interface GameState {
  phase: GamePhase;
  currentHeroId: string;
  heroes: Hero[];
  monsters: Monster[];      // <-- Array of Monster objects
  tiles: Tile[];
  dungeonDeck: string[];
  treasureDeck: string[];
  encounterDeck: string[];
  discardPiles: Record<CardType | string, string[]>;
  activeScenario: Scenario;
  turnOrder: string[];
  healingSurges: number;
  turnCount: number;
  log: GameLogEntry[];
  // ... additional fields
}
```

**Implication:** AbilitySystem can look up monsters using `gameState.monsters.find(m => m.id === id)` or similar array methods.

---

## Question 4: Does any d20 / dice roll utility already exist?

**Answer:** NO dedicated utility function

**Current implementations (inline):**

1. **CombatSystem.ts** (line 19):
```typescript
const roll = Math.floor(Math.random() * GAME_CONSTANTS.D20_SIDES) + 1;
```

2. **EncounterSystem.ts** (line 271):
```typescript
const roll = Math.floor(Math.random() * 20) + 1;
```

3. **GameEngine.ts** (line 94):
```typescript
public rollDie(sides: number = 20): number {
  return Math.floor(Math.random() * sides) + 1;
}
```

**Constants reference:**
- `GAME_CONSTANTS.D20_SIDES` (likely 20)
- `GAME_CONSTANTS.CRITICAL_HIT_ROLL` (likely 20)

**Implication:** AMI-2 should create a dedicated dice roll utility, possibly in `src/utils/dice.ts` or as a static method in a utility class.

**Suggested import path:** `src/utils/dice.ts` (to be created)

---

## Question 5: Does existing ConditionType exist in types.ts?

**Answer:** YES

```typescript
export type ConditionType = 'slowed' | 'immobilized' | 'poisoned' | 'dazed' | 'weakened' | 'stunned';
```

**Implication:** The plan's reference to `ConditionType` in `AbilityEffect` is valid. No changes needed to existing type definition.

---

## Summary

| Question | Answer | Implications |
|----------|--------|--------------|
| 1. BossPhases.ts exists? | YES | Needs enhancement (tactics, passiveAbilities) |
| 2. Monster.hp type? | `number` | Can use `hp / maxHp` for ratio |
| 3. GameState.monsters type? | `Monster[]` | Use `find()` for lookups |
| 4. Dice roll utility? | NO | Create in AMI-2 |
| 5. ConditionType exists? | YES | Ready to use |

---

## Notes for Implementation

1. **BossPhases.ts** needs enhancement, not creation from scratch
2. **Dice utility** should be created in AMI-2 with consistent implementation
3. **Monster HP** is simple number, no object structure needed
4. **Monster lookup** via array methods is straightforward
5. **ConditionType** is already defined and ready to use
