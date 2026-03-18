# Castle Ravenloft Board Game - Rules & Mechanics Implementation Checklist

This document maps all rules and mechanics from the Castle Ravenloft Board Game Rules PDF to their implementation status in the digital game.

## Table of Contents
1. [Game Overview](#game-overview)
2. [Game Setup](#game-setup)
3. [Turn Structure](#turn-structure)
4. [Dungeon Tiles](#dungeon-tiles)
5. [Heroes](#heroes)
6. [Movement](#movement)
7. [Attacks & Powers](#attacks--powers)
8. [Combat System](#combat-system)
9. [Monsters](#monsters)
10. [Encounter Cards](#encounter-cards)
11. [Treasure Cards](#treasure-cards)
12. [Experience & Leveling](#experience--leveling)
13. [Advanced Rules](#advanced-rules)

---

## Game Overview

### Core Mechanics
- [~] Cooperative gameplay - all players win or lose together
- [~] Victory condition: Complete the adventure's objective
- [~] Defeat condition: Any Hero at 0 HP at start of turn with no Healing Surge tokens remaining
- [~] Adventure-specific victory/defeat requirements

### Game Components
- [~] Monster Deck - shuffled at game start
- [~] Encounter Deck - shuffled at game start
- [~] Treasure Deck - shuffled at game start
- [~] Dungeon Tile Stack
- [~] Starting Tile (double-sized, treated as two separate tiles)
- [?] Quest Tiles (adventure-specific)
- [~] Die (d20)
- [~] Monster, Villain, and Hero figures
- [~] Healing Surge tokens (default: 2)
- [~] Hit Point tokens
- [ ] Condition markers (Slowed, Immobilized)
- [~] Experience Pile

---

## Game Setup

### Initial Setup Steps
- [x] Shuffle Monster Cards into their own deck
- [x] Shuffle Encounter Cards into their own deck
- [x] Shuffle Treasure Cards into their own deck
- [~] Place decks in easy reach
- [ ] Give each player a "Sequence of Play" card
- [~] Place die and figures in easy reach
- [x] Pick an adventure from Adventure Book
- [x] Each player chooses a Hero
- [x] Take Hero Card, Power Cards, and matching figure for chosen Hero
- [~] Each player draws a Treasure Card
- [~] Set up Dungeon Tile stack, starting tile, and quest tiles per adventure

### Hero Selection
- [x] Five 1st-level Heroes available:
  - [x] Dragonborn Fighter (Arjhan - Paladin)
  - [x] Human Rogue (Kat)
  - [x] Dwarf Cleric (Thorgrim)
  - [x] Eladrin Wizard (Immeril)
  - [x] Human Ranger (Vani)
- [x] Hero Card shows: Name, Race, Class, Level
- [~] Power Card selection per Hero Card specifications
- [~] Treasure Card for each player at start

---

## Turn Structure

### Three Phases Per Turn
- [x] Hero Phase
- [~] Exploration Phase
- [~] Villain Phase (Monster Phase)

### Turn Order
- [~] Player of group's choice starts
- [~] Proceeds clockwise
- [ ] Alternative: Roll die, highest goes first

---

## Dungeon Tiles

### Tile System
- [x] Tiles are basic building blocks of dungeon crypts
- [~] Each tile has:
  - [?] Bone pile (Monster spawn location)
  - [ ] White or black triangle (danger level indicator)
  - [~] Walls
  - [?] Special features (some tiles)
  - [~] Names (some tiles for adventure reference)

### Tile vs Square Distinction
- [x] Tile: Component of game board
- [x] Square: Individual space on a tile
- [?] Start tile: Treated as two separate tiles for movement and counting

### Unexplored Edge
- [x] Definition: Tile edge without wall, not adjacent to another tile
- [~] Used for placing new tiles during exploration

### Diagonal Movement Rules
- [~] Can move diagonally when moving by squares
- [ ] Cannot move diagonally when moving by tiles
- [ ] Tile counting: Move in straight lines, count around tiles
- [~] Square counting: Can move diagonally, even between tiles

### Large Creatures
- [ ] Creatures with base larger than one square count as being on all tiles their base occupies
- [ ] Distance counting applies to all tiles the creature is on

---

## Heroes

### Hero Card Components
- [x] Hero Name, Race, Class, and Level
- [x] Armor Class (AC) - defense score
- [x] Hit Points (HP) - health score
- [x] Speed - number of squares per move action
- [?] Surge Value - HP recovered when using Healing Surge
- [?] Special Ability - unique ability per Hero
- [~] Powers - specifies number and type of Power Cards

### Hero Stats
- [x] AC: Attack hits if roll + bonus >= AC
- [x] HP: Cannot regain more than total HP
- [x] Speed: Movement budget per turn
- [?] Surge Value: HP recovered at 0 HP

### Hero States
- [x] Active: Normal state, can move and attack
- [~] At 0 HP: Figure knocked over, cannot act, Monsters ignore
- [~] Revived: Healed before turn start, figure stands up, can act normally

---

## Movement

### Movement Rules
- [x] Move during Hero Phase (usually)
- [?] Can move at other times via Power/Treasure/Encounter Card effects
- [x] Speed = movement budget (squares per turn)
- [~] Can move in any direction including diagonally
- [~] Cannot move into wall squares
- [~] Cannot move into Monster-occupied squares
- [?] Can move through Hero-occupied squares, but cannot end movement there

### Movement Actions
- [?] Move then Attack
- [?] Attack then Move
- [?] Two Moves

### Condition: Slowed
- [ ] Trigger: Attack or effect causes Slowed condition
- [ ] Effect: Speed reduced to 2
- [ ] Marker: Slowed marker placed on Hero Card
- [ ] Duration: Discard at end of Hero Phase

### Condition: Immobilized
- [ ] Trigger: Attack or effect causes Immobilized condition
- [ ] Effect: Speed reduced to 0 (cannot move)
- [ ] Marker: Immobilized marker placed on Hero Card
- [ ] Duration: Discard at end of Hero Phase
- [ ] Note: Other effects (Slowed, Immobilized) still apply to downed Hero

---

## Attacks & Powers

### Power Types
- [ ] Daily Powers:
  - [ ] Flip over when used
  - [ ] Cannot use again until flipped back up (usually by Treasure Card)
  - [ ] Strongest attacks in game
  - [ ] Represent significant drain of stamina/energy

- [ ] At-Will Powers:
  - [ ] Do not flip over when used
  - [ ] Can use again next turn
  - [ ] Relatively simple attacks/spells/prayers
  - [ ] Weaker than Daily powers

- [ ] Utility Powers:
  - [ ] Do not actively attack Monsters
  - [ ] Provide other advantages (specialized moves, counter attacks)
  - [ ] Many don't require Attack action
  - [ ] Specify alternate time to use
  - [ ] Flip over when used
  - [ ] Cannot use again until flipped back up

### Power Selection
- [?] Each Hero Card specifies number of each power type
- [?] Some Power Cards are automatic
- [?] Suggested Power Cards in Adventure Book for early games
- [?] Later games: Choose Power Cards per Hero Card specifications

---

## Combat System

### Targeting
- [~] Power specifies targetable Monsters
- [?] Range: From adjacent square to 3 tiles away
- [?] Cannot trace diagonal path between tiles
- [?] Cannot attack if wall completely blocks path

### Attack Resolution
- [x] Roll d20
- [x] Add Attack Bonus
- [x] Compare to target's Armor Class
- [x] Hit if roll + bonus >= AC
- [x] Miss if roll + bonus < AC

### Damage
- [x] Hit deals listed damage
- [x] Damage reduces HP
- [?] Damage that doesn't reduce to 0 stays on Monster/Hero (use HP tokens)
- [?] Monsters can heal damage via powers
- [x] Hero powers can heal Heroes

### Defeating Monsters
- [x] Monster at 0 HP = defeated
- [~] Remove Monster figure from tile
- [?] Player controlling Monster discards Monster Card to Experience Pile
- [ ] If multiple players control same Monster type:
  - [ ] Player who made attack discards if they control one
  - [ ] Otherwise, go clockwise to first player who controls one
- [?] Defeating Monster grants Treasure Card (one per turn max)

### Defeating Heroes
- [x] Hero at 0 HP = downed
- [~] Keep Hero figure on tile, knock over
- [~] Monsters ignore downed Hero
- [?] Hero cannot take damage, use powers, or use items
- [?] Other effects (Slowed, Immobilized) still apply
- [?] Healed before turn start = revived, stand up, can act normally

### Healing Surges
- [x] Heroes start with 2 Healing Surge tokens (shared resource)
- [~] At 0 HP at start of turn: Must use Healing Surge token
- [~] Using Healing Surge:
  - [~] Discard token
  - [?] Regain HP equal to Surge Value
  - [?] Take turn normally
- [~] No Healing Surge tokens at 0 HP = Heroes lose adventure

---

## Monsters

### Monster Deck
- [~] Randomly determines Monsters encountered
- [x] Each Monster Card summarizes defenses and attacks

### Monster Card Components
- [x] Monster Name and Type
- [x] AC (Armor Class)
- [x] HP (Hit Points)
- [x] Special Ability (if any)
- [x] Experience Points (XP)
- [~] Monster Tactics

### Monster Tactics
- [x] Script showing what Monster does when activated
- [x] Presented as list of conditional statements
- [x] Each statement: If true, follow resulting tactics
- [x] If statement not true, go to next statement
- [x] Final entry: Default action if nothing else true
- [~] Once one set of tactics followed, Monster's turn ends
- [~] Do not continue checking remaining tactics that turn

### Monster Activation
- [~] Activate during Villain Phase
- [?] Activate each Monster and Trap Card in turn order drawn
- [ ] If multiple Monsters with same name in play:
  - [ ] Activate each of those Monsters during your turn
  - [ ] Other players will activate same Monsters on their turns

### Monster Placement
- [?] When placing new Dungeon Tile, place Monster on bone pile
- [?] Bone pile location shown on tile

---

## Encounter Cards

### Encounter Deck
- [~] Represents Events, Environments, Traps, and other threats
- [?] Several types, each with special rules
- [~] Apply effects immediately when drawn
- [?] Can cancel with Experience Points (5 XP)

### Active Hero
- [?] Hero played by player who drew the card

### Environment Cards
- [ ] Represent major change in dungeon crypts
- [ ] Examples: Bats swarm, thick mist
- [ ] Effects apply to all Heroes
- [ ] Place card where everyone can see it
- [ ] If Environment Card already in play:
  - [ ] Discard old Environment Card
  - [ ] Replace with new one
- [ ] Can cancel with XP (if canceling new one, don't discard existing)

### Event Cards
- [?] Strange occurrence, dreadful sight/sound, incident
- [?] Takes place when drawn (unless canceled with XP)
- [?] After resolving, discard card
- [ ] Most Events: Yellow cards
- [ ] Event-Attacks: Red cards with attack roll against Heroes

### Trap Cards
- [?] Snare/mechanical device to defeat Heroes
- [?] Each Trap Card has corresponding marker
- [ ] When drawn:
  - [ ] Place Trap marker on active Hero's tile
  - [ ] If Trap already there: Discard drawn Trap, draw another Encounter Card
  - [ ] Put Trap Card in front of player with other Monster/Trap Cards
- [ ] Activates during Villain Phase like Monster
- [ ] Lacks tactics, takes actions listed on card
- [ ] Examples: Attack all Heroes on tile, attack closest Hero
- [ ] Attacks like Monster

### Disabling Traps
- [ ] While Hero on tile with Trap, can attempt to disable instead of attacking
- [ ] Roll die
- [ ] If roll >= number on Trap Card: Discard Trap and marker

---

## Treasure Cards

### Treasure Deck
- [~] Magic items and valuables in dungeon crypts
- [?] Draw when defeating Monster (one per turn max)
- [~] Follow rules listed on card when using
- [?] Card explains when it can be used

### Treasure Card Types

#### Blessings
- [ ] Played immediately
- [ ] Last until end of next turn
- [ ] Provide benefit to all Heroes while in play
- [ ] Discard at end of next turn

#### Fortunes
- [ ] Played immediately
- [ ] Provide immediate benefit
- [ ] If benefit has no effect, nothing happens
- [ ] Discard immediately

#### Items
- [~] Provide lasting benefit
- [?] When drawn: Decide to keep for Hero or give to another Hero
- [?] Once decided, cannot give to another Hero later
- [?] Can benefit from multiple Treasure Cards that apply to Hero
- [?] Examples: Blessing + Fortune + Item to boost single attack

---

## Experience & Leveling

### Experience Points (XP)
- [x] Earned by defeating Monsters
- [?] Hero who controls Monster puts Monster Card in Experience Pile
- [x] Each Monster Card lists XP value
- [x] Tougher Monsters = more XP

### Using Experience Points

#### Canceling Encounter Cards
- [?] Represents using experience to avoid danger
- [?] Examples: Spot and disable Trap, avoid Event
- [?] Cost: 5 XP total
- [?] Must use Monster Cards whose XP adds up to at least 5
- [?] Cannot use excess points on later turn
- [?] Discard cards after spending
- [?] When canceled: Discard Encounter Card, ignore effects
- [?] Can only cancel when drawing card, not on later turn

#### Leveling Up
- [?] Trigger: Natural 20 on attack roll or disable trap roll
- [?] Cost: 5 XP
- [?] Effect: Become 2nd level
- [ ] Flip 1st-level Hero Card to 2nd-level
- [ ] Benefits of 2nd level:
  - [ ] Hit Points +2
  - [ ] Armor Class +1
  - [ ] Surge Value +1
  - [ ] Choose new Daily power
  - [ ] Gain special ability for critical attacks (shown on Hero Card)
- [ ] Alternative trigger: Level up Treasure Card

---

## Advanced Rules

### Choosing Power Cards (Later Adventures)
- [ ] Don't have to stick to suggested Power Cards
- [ ] Each 1st-Level Hero Card specifies number of each power type
- [ ] Two methods to choose:
  1. [ ] Choose Power Cards you want (easier game)
     - [ ] Set up perfect balance of powers
     - [ ] Know exactly what to expect from Hero
  2. [ ] Choose Power Cards randomly in each category (more challenging)
     - [ ] Figure out surprising combinations of powers
- [ ] Group can agree on method or each player chooses

### Difficulty Adjustment

#### More Challenging
- [ ] Reduce Healing Surge tokens to 1

#### Less Challenging
- [ ] Increase Healing Surge tokens to 3

### First Adventure Recommendations
- [ ] Solo play: "Escape the Tomb"
- [x] Multiplayer: "Find the Icon of Ravenloft"

---

## Implementation Status Key
- [ ] Not Implemented
- [x] Implemented
- [~] Partially Implemented
- [?] Needs Verification

---

## Notes
- This checklist is based on the Castle Ravenloft Board Game Rules PDF
- Refer to the original rules document for detailed explanations
- Adventure-specific rules are not included in this general checklist
- Some mechanics may have digital game-specific implementations
- **Last Updated:** 2026-03-18
- **Implementation Summary:** Core game loop exists, but many card types and advanced features are not fully implemented
