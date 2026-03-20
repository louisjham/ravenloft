# Power Selection System — Codebase Audit Answers

**Date:** 2026-03-19

---

## 1. Does a PowerSystem already exist?

**YES**

**File Path:** `src/game/engine/PowerSystem.ts`

**Exported Methods:**

- `canUsePower(hero: Hero, powerCard: Card): { canUse: boolean; reason?: string }`
- `usePower(hero: Hero, powerCard: Card, target: Entity | null, gameState: any): { success: boolean; message: string; effects: any[] }`
- `resetPower(hero: Hero, powerId: string): void`
- `resetAllPowers(hero: Hero): void`
- `getEffectiveAttackBonus(hero: Hero, baseBonus: number, target?: Entity): number`
- `getEffectiveDamage(hero: Hero, baseDamage: number): number`
- `hasPower(hero: Hero, powerId: string): boolean`
- `getAvailablePowers(hero: Hero, allCards: Card[]): Card[]`
- `getUsedPowers(hero: Hero, allCards: Card[]): Card[]`

---

## 2. Does the Hero type in types.ts already have a powerCards field?

**ABSENT**

The `Hero` interface does not have a `powerCards` field. Instead, it has:

```typescript
export interface Hero extends Entity {
  type: 'hero';
  heroClass: string;
  level: number;
  xp: number;
  surgeUsed: boolean;
  abilities: string[]; // Ability IDs
  hand: string[]; // Card IDs
  items: string[]; // Item IDs
}
```

---

## 3. Does a CardHand UI component exist?

**YES**

**File Path:** `src/components/ui/CardHand.tsx`

**Props Interface:** None (no props interface - functional component without props)

```typescript
export const CardHand: React.FC = () => {
  const gameState = useGameStore((state) => state.gameState);
  const currentHero = gameState?.heroes?.find(h => h.id === gameState?.currentHeroId);
  // ...
}
```

---

## 4. Does types.ts have a PowerCard type or interface?

**ABSENT**

There is no separate `PowerCard` type. Power cards use the `Card` interface with a `powerType` field:

```typescript
export interface Card {
  id: string;
  type: CardType;
  name: string;
  description: string;
  flavorText?: string;
  effects: Effect[];
  phase?: 'hero' | 'exploration' | 'monster';
  heroClass?: string;
  powerType?: PowerType;  // 'at-will' | 'daily' | 'utility'
  treasureType?: TreasureType;
  encounterType?: EncounterType;
  attackBonus?: number;
  damage?: number;
  range?: number;
  target?: 'self' | 'single' | 'area' | 'all_heroes' | 'all_monsters' | 'adjacent';
  isLevelUp?: boolean;
  disableDC?: number;
}

export type PowerType = 'at-will' | 'daily' | 'utility';
```

---

## 5. Does GameState have a currentPhase or gamePhase field that tracks setup vs. in-game?

**YES**

**Field Name:** `phase`

**Type:** `GamePhase`

```typescript
export type GamePhase = 'setup' | 'hero' | 'exploration' | 'villain' | 'monster' | 'end' | 'victory' | 'defeat';

export interface GameState {
  phase: GamePhase;
  currentHeroId: string;
  heroes: Hero[];
  // ... other fields
}
```

**Power Selection Availability:** The `'setup'` phase exists, so power selection can be limited to this phase.

---

## 6. Does a save/load system exist?

**YES**

**File Path:** `src/game/progression/SaveSystem.ts`

**Serialization Format:** JSON stored in localStorage

**Storage Key:** `castle_ravenloft_saves`

**SaveSlot Interface:**

```typescript
export interface SaveSlot {
  id: string;
  timestamp: string;
  scenarioId: string;
  scenarioName: string;
  heroNames: string[];
  state: GameState;
}
```

**Key Methods:**

- `saveGame(gameState: GameState, slotId: string = 'auto')`
- `loadGame(slotId: string): GameState | null`
- `getSaves(): Record<string, SaveSlot>`
- `deleteSave(slotId: string)`
- `trackCompletion(scenarioId: string)`
- `isCompleted(scenarioId: string): boolean`
