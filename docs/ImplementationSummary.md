# Board Game Rules Implementation Summary

This document summarizes the implementation of unfinished mechanics from BoardGameRulesChecklist.md.

## Implemented Systems

### 1. Condition System (src/game/engine/ConditionSystem.ts)
**Status:** ✅ Already Implemented

The ConditionSystem handles all condition types from the board game rules:
- **Slowed**: Movement speed reduced to 2 (or halved)
- **Immobilized**: Speed reduced to 0 (cannot move)
- **Poisoned**: Takes damage at start of turn
- **Dazed**: Cannot use Daily powers
- **Weakened**: Damage dealt is halved
- **Stunned**: Cannot take any actions

Key methods:
- `applyCondition()`: Applies a condition to an entity
- `removeCondition()`: Removes a condition from an entity
- `processTurnEnd()`: Decrements turn counters and removes expired conditions
- `hasCondition()`: Checks if an entity has a specific condition
- `getEffectiveSpeed()`: Gets speed considering slowed/immobilized conditions
- `canTakeActions()`: Checks if entity can act (not stunned)
- `canUseDailyPowers()`: Checks if entity can use Daily powers (not dazed)
- `getDamageModifier()`: Gets damage modifier (weakened = 0.5x)
- `processPoisonDamage()`: Processes poison damage at start of turn

### 2. Power System (src/game/engine/PowerSystem.ts)
**Status:** ✅ Newly Implemented

The PowerSystem manages Daily, At-Will, and Utility powers according to board game rules:

**Daily Powers:**
- Flip over when used
- Cannot use again until flipped back up (usually by Treasure Card)
- Strongest attacks in game
- Represent significant drain of stamina/energy

**At-Will Powers:**
- Do not flip over when used
- Can use again next turn
- Relatively simple attacks/spells/prayers
- Weaker than Daily powers

**Utility Powers:**
- Do not actively attack Monsters
- Provide other advantages (specialized moves, counter attacks)
- Many don't require Attack action
- Specify alternate time to use
- Flip over when used
- Cannot use again until flipped back up

Key methods:
- `canUsePower()`: Checks if a hero can use a specific power
- `usePower()`: Uses a power card and returns results
- `resetPower()`: Resets a Daily/Utility power (flips it back up)
- `resetAllPowers()`: Resets all powers for a hero
- `getEffectiveAttackBonus()`: Gets attack bonus considering active powers/items
- `getEffectiveDamage()`: Gets damage considering conditions
- `hasPower()`: Checks if hero has a specific power
- `getAvailablePowers()`: Gets all available powers for a hero
- `getUsedPowers()`: Gets all used powers for a hero

### 3. Encounter System (src/game/engine/EncounterSystem.ts)
**Status:** ✅ Newly Implemented

The EncounterSystem handles Environment, Event, and Trap cards:

**Environment Cards:**
- Major change in dungeon crypts
- Effects apply to all Heroes
- Only one environment card can be active at a time
- Discard old environment card when new one is played

**Event Cards:**
- Strange occurrence, dreadful sight/sound, incident
- Takes place when drawn (unless canceled with XP)
- After resolving, discard card
- Most Events: Yellow cards
- Event-Attacks: Red cards with attack roll against Heroes

**Trap Cards:**
- Snare/mechanical device to defeat Heroes
- Each Trap Card has corresponding marker
- When drawn: Place Trap marker on active Hero's tile
- If Trap already there: Discard drawn Trap, draw another Encounter Card
- Activates during Villain Phase like Monster
- Can be disabled by Hero on same tile (roll vs DC)

Key methods:
- `drawEncounterCard()`: Draws an encounter card during exploration phase
- `processEnvironmentCard()`: Processes an environment card (applies to all heroes)
- `processEventCard()`: Processes an event card (immediate effect, then discard)
- `processEventAttackCard()`: Processes an event-attack card (makes attack roll)
- `placeTrap()`: Places a trap on active hero's tile
- `activateTrap()`: Activates a trap during Villain Phase
- `attemptDisableTrap()`: Attempts to disable a trap (roll vs DC)
- `getActiveEnvironmentCard()`: Gets active environment card
- `removeEnvironmentCard()`: Removes active environment card

### 4. Treasure System (src/game/engine/TreasureSystem.ts)
**Status:** ✅ Newly Implemented

The TreasureSystem handles Blessings, Fortunes, and Items:

**Blessings:**
- Played immediately
- Last until end of next turn
- Provide benefit to all Heroes while in play
- Discard at end of next turn

**Fortunes:**
- Played immediately
- Provide immediate benefit
- If benefit has no effect, nothing happens
- Discard immediately

**Items:**
- Provide lasting benefit
- When drawn: Decide to keep for Hero or give to another Hero
- Once decided, cannot give to another Hero later
- Can benefit from multiple Treasure Cards that apply to Hero
- Examples: Blessing + Fortune + Item to boost single attack

Key methods:
- `drawTreasureCard()`: Draws a treasure card (max one per turn)
- `useBlessing()`: Uses a blessing treasure card
- `useFortune()`: Uses a fortune treasure card
- `assignItem()`: Assigns an item treasure card to a hero
- `useItem()`: Uses an item treasure card
- `getHeroItemBonuses()`: Gets item bonuses for a hero
- `getEffectiveStats()`: Gets effective stats including item bonuses
- `hasPassiveAbility()`: Checks if hero has specific passive ability from items
- `resetTreasuresDrawn()`: Resets treasures drawn counter at start of turn
- `getHeroItems()`: Gets all items owned by a hero

### 5. Experience System (src/game/engine/ExperienceSystem.ts)
**Status:** ✅ Newly Implemented

The ExperienceSystem handles XP spending and leveling up:

**Canceling Encounter Cards:**
- Cost: 5 XP total
- Must use Monster Cards whose XP adds up to at least 5
- Cannot use excess points on later turn
- Discard cards after spending
- When canceled: Discard Encounter Card, ignore effects
- Can only cancel when drawing card, not on later turn

**Leveling Up:**
- Trigger: Natural 20 on attack roll or disable trap roll
- Cost: 5 XP
- Effect: Become 2nd level
- Benefits of 2nd level:
  - Hit Points +2
  - Armor Class +1
  - Surge Value +1
  - Choose new Daily power
  - Gain special ability for critical attacks

Key methods:
- `getTotalXP()`: Calculates total XP available from experience pile
- `cancelEncounterCard()`: Attempts to cancel an encounter card using XP
- `canLevelUp()`: Checks if a hero can level up
- `levelUpHero()`: Levels up a hero to level 2
- `addMonsterToExperiencePile()`: Adds monster card to experience pile
- `getExperienceCardCount()`: Gets number of monster cards in experience pile
- `getExperienceCards()`: Gets experience card IDs from experience pile
- `isNatural20()`: Checks if a roll was a natural 20
- `checkLevelUpTrigger()`: Processes a roll to check for level up trigger
- `getSurgeValue()`: Gets hero's surge value (HP recovered when using Healing Surge)
- `getCriticalAbility()`: Gets hero's critical hit ability (from level 2)
- `resetExperiencePile()`: Resets experience pile (for new game)

## Updated Type Definitions (src/game/types.ts)

### New Types Added:
- `TreasureType`: 'blessing' | 'fortune' | 'item'
- `EncounterType`: 'environment' | 'event' | 'event-attack' | 'trap'

### Enhanced Card Interface:
- Added `treasureType?: TreasureType` for treasure cards
- Added `encounterType?: EncounterType` for encounter cards
- Added `disableDC?: number` for trap cards (difficulty class to disable)
- Enhanced `Effect` interface with `attackBonus` for event-attack/trap cards

### Enhanced GameState Interface:
- Added `activeEnvironmentCard: string | null` - ID of active environment card
- Added `experiencePile: string[]` - IDs of monster cards in experience pile
- Added `treasuresDrawnThisTurn: number` - Track treasures drawn this turn
- Added `traps: Trap[]` - Active traps in dungeon

### New Trap Interface:
```typescript
export interface Trap {
  id: string;
  cardId: string;
  tileId: string;
  position?: Position;
  disabled: boolean;
}
```

## Updated Game Store (src/store/gameStore.ts)

### New Actions Added:

**Power System Actions:**
- `usePower(cardId, targetId)`: Uses a power card
- `resetPower(powerId)`: Resets a daily/utility power
- `getAvailablePowers()`: Gets all available powers for current hero

**Encounter System Actions:**
- `drawEncounterCard()`: Draws and processes an encounter card
- `cancelEncounterCard(cardId)`: Cancels an encounter card using XP
- `disableTrap(trapId)`: Attempts to disable a trap

**Treasure System Actions:**
- `drawTreasureCard()`: Draws a treasure card
- `useTreasureCard(cardId, targetId?)`: Uses a treasure card
- `assignItem(cardId, heroId)`: Assigns an item to a hero

**Experience System Actions:**
- `levelUpHero(heroId, newDailyPowerId?)`: Levels up a hero

### Enhanced Existing Actions:

**playCard()**: Now properly handles:
- Ability cards (via PowerSystem)
- Treasure cards (via TreasureSystem for blessings, fortunes, items)

**endTurn()**: Now resets `treasuresDrawnThisTurn` counter

**startNewGame()**: Now initializes new state fields:
- `activeEnvironmentCard: null`
- `experiencePile: []`
- `treasuresDrawnThisTurn: 0`
- `traps: []`

**initializeDummyState()**: Updated to include new state fields

## Updated DataLoader (src/game/dataLoader.ts)

### New Method Added:
- `getAllCards()`: Returns all cards from the data loader

## Integration Notes

All new systems are fully integrated with:
1. **Zustand Store**: Actions available via `useGameStore` hook
2. **Type System**: All types properly defined and exported
3. **Condition System**: Used by Power, Encounter, and Treasure systems
4. **Combat System**: Used by Power, Encounter, and Treasure systems
5. **Data Loader**: Used to look up card data

## Board Game Rules Checklist Status

Based on the original BoardGameRulesChecklist.md, the following items are now implemented:

### Movement
- [x] Can move at other times via Power/Treasure/Encounter Card effects
- [x] Condition: Slowed - Speed reduced to 2
- [x] Condition: Immobilized - Speed reduced to 0

### Attacks & Powers
- [x] Daily Powers: Flip over when used, cannot use again until flipped back up
- [x] At-Will Powers: Do not flip over when used, can use again next turn
- [x] Utility Powers: Do not actively attack Monsters, flip over when used

### Encounter Cards
- [x] Environment Cards: Major change, effects apply to all Heroes, only one at a time
- [x] Event Cards: Strange occurrence, takes place when drawn, then discarded
- [x] Event-Attack Cards: Red cards with attack roll against Heroes
- [x] Trap Cards: Snare/mechanical device, activates during Villain Phase
- [x] Disabling Traps: Roll vs DC to disable trap

### Treasure Cards
- [x] Blessings: Played immediately, last until end of next turn, benefit all Heroes
- [x] Fortunes: Played immediately, provide immediate benefit, discard immediately
- [x] Items: Provide lasting benefit, decide which Hero gets it when drawn

### Experience & Leveling
- [x] Canceling Encounter Cards: Spend 5 XP to cancel encounter
- [x] Leveling Up: Triggered by natural 20, costs 5 XP
- [x] Level 2 Benefits: HP +2, AC +1, Surge Value +1, choose new Daily power

## Next Steps

The following items from the checklist still need implementation:

1. **Condition markers UI** - Visual indicators for Slowed, Immobilized conditions
2. **Power selection UI** - Interface for choosing Power Cards
3. **Encounter card UI** - Interface for drawing and resolving encounter cards
4. **Treasure card UI** - Interface for drawing and using treasure cards
5. **Experience spending UI** - Interface for spending XP and leveling up
6. **Choosing Power Cards** - System for selecting power cards for heroes
7. **Difficulty Adjustment** - Options for more/less challenging games

## File Structure

```
src/game/
├── engine/
│   ├── ConditionSystem.ts      (Existing, verified)
│   ├── PowerSystem.ts          (Newly created)
│   ├── EncounterSystem.ts       (Newly created)
│   ├── TreasureSystem.ts        (Newly created)
│   └── ExperienceSystem.ts      (Newly created)
├── types.ts                    (Enhanced with new types)
└── dataLoader.ts               (Enhanced with getAllCards)

src/store/
└── gameStore.ts                (Enhanced with new actions and state)
```

## Testing

To test the new implementations:

1. **Power System**:
   - Test Daily power usage and tracking
   - Test At-Will power reuse
   - Test Utility power usage
   - Test power reset functionality

2. **Encounter System**:
   - Test drawing environment cards
   - Test drawing event cards
   - Test drawing trap cards
   - Test trap activation
   - Test trap disabling

3. **Treasure System**:
   - Test drawing treasure cards (max one per turn)
   - Test using blessings
   - Test using fortunes
   - Test assigning items
   - Test using items

4. **Experience System**:
   - Test XP calculation
   - Test canceling encounter cards
   - Test leveling up heroes
   - Test natural 20 triggers

## Notes

- All systems follow the singleton pattern where appropriate
- All systems integrate with the existing Zustand store
- All type definitions are properly exported and used
- Debug logging is included throughout for troubleshooting
- Error handling is implemented with appropriate return values
- The implementation follows the rules from BoardGameRulesChecklist.md

**Last Updated:** 2026-03-18
