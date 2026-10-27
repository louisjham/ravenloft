---
name: castle-ravenloft-rules
description: The complete Castle Ravenloft: The Adventure Board Game skill. History, rules text as structured JSON, full inventory of every piece/card/token, and agent-learned knowledge beyond the manual. Load for any question about the game itself, any mechanics definition, or any rulebook-compliance check. Takes precedence over current engine behavior when the two disagree; conflicts get flagged, never silently followed. This is a game skill, not a general board-game skill.
---

# Castle Ravenloft: The Adventure Board Game

## What this skill is

This skill is the whole game in one place: its history, its rules (as prose
below and as straight JSON in `rules.json`), every piece/card/token (as
structured data in `inventory.json`), and everything the agent has learned
about the game that is not in the manual. If a question is about Castle
Ravenloft itself rather than about this codebase, start here.

## Companion files (in this skill directory)

- `rules.json` — the rules as structured data: turn structure, movement,
  combat, powers, conditions, treasure, experience, surges, downed heroes,
  bone pile, other actions, win/loss, all 19 scenarios with surge counts and
  objectives, rebrand map, manual gaps, and unverified items. Machines read
  this; humans read the prose below. The two mirror each other: if they ever
  disagree, the source hierarchy below decides and the mismatch gets fixed,
  never silently picked.
- `inventory.json` — every piece/card/token generated from the repo data
  files (`src/data`): 61 monsters, 5 heroes, 41 tiles, 50 power cards,
  56 encounters, 61 treasures, 15 items, 19 scenario files. Each entry
  carries its id and name; tiles also carry their bone square. Full card
  text is NOT duplicated here: it lives in `card-source-truth/*.md` (see
  Sources), which is the card-text authority.

## History (verified)

- Castle Ravenloft is a cooperative dungeon-crawl board game for 1-5 players,
  about an hour per quest, built on a simplified 4th-edition D&D ruleset.
- First released in 2010 by Wizards of the Coast. Designers: Bill Slavicsek,
  Mike Mearls, and Peter Lee (some reprint coverage also credits Rob
  Heinsoo).
- It kicked off the D&D Adventure System series: the first in a line of
  compatible games using the same underlying system, followed by Wrath of
  Ashardalon, Legend of Drizzt, and Temple of Elemental Evil.
- The setting descends from the original 1983 Ravenloft adventure module
  (Strahd von Zarovich, Barovia). The board game is a separate 2010 game,
  not the module.
- The box's five heroes are the Human Cleric, Dragonborn Fighter, Rogue,
  Wizard, and Dwarf Ranger. This project names them Arjhan, Immeril, Kat,
  Thorgrim, and Alissa; class mapping for each lives in
  `src/data/heroes.json` and `card-source-truth/heroes.md`.
- Renegade Game Studios announced a reprint (September 2, 2026) releasing
  February 2027: standard edition $100 (42 unpainted miniatures), premium
  edition $200 (pre-painted miniatures), new art and components, rules
  largely the same. The rulebook text used for verification is the Wizards
  of the Coast rulebook (Renegade reprint, same rules text).

## When to use this skill

Load this skill before answering any question about the game, defining any
mechanic, or judging whether code is rulebook-compliant. It exists so
mechanics like the bone pile stop being reinvented from vibes: every
definition below was verified against the official rulebook text (see
Sources), and where the rulebook states no rule, this skill says so instead
of inventing one.

## Sources and authority (highest first)

1. Physical Castle Ravenloft card text verified by Louis.
2. Manually entered source-of-truth files from physical cards
   (`card-source-truth/*.md`: heroes, monsters, powers, items, fortunes,
   blessings, traps, events, environments, event-attacks).
3. The official rulebook text (Wizards of the Coast, Renegade reprint, same
   rules text), as verified in `RULES_SWEEP_2026-10-24.md`.
4. Scenario data (`src/data/scenarios/*.json`) for scenario objectives only.
5. Current engine behavior — LAST, and only where it is intentionally
   implemented. The sweep documents where code diverges from the rules; if
   code conflicts with this skill, flag the conflict and stop for Louis's
   call. Never rewrite a rule to match buggy code.

## Limits (read before citing)

- The Adventure Book scenario-specific rules are NOT in the rulebook text.
  Scenario rules below are checked against the code's own scenario data for
  internal consistency only, and are flagged as unverified against the
  original adventure text.
- Where the rulebook text states no rule (tile-stack exhaustion procedure,
  encounter-deck reshuffle, edge-matching on placement beyond the triangle
  sentence), this skill says so rather than inventing one.
- Rebrand mapping (names only, rules unchanged): Strahd becomes Varkath /
  Karl Von Nekrula, Castle Ravenloft becomes The Shadowhold, Skull Lord
  becomes Anthraxus. Rules below use the original names; map them when
  reading code or data.
- For which scenario objectives the code currently cannot complete, see
  `RULES_SWEEP_2026-10-24.md` section 4 (Scenarios). Do not redesign scenario
  rules to work around code bugs without Louis's call.

## Do not invent

Do not invent card text, mechanics, card names, image mappings, or rules. If
a rule cannot be verified from the sources above, mark it **unresolved** and
stop for approval. This is the same discipline as
`castle-ravenloft-source-of-truth`, applied to rules instead of cards.

## What's in the box (verified counts; full lists in inventory.json)

- 5 heroes: Arjhan, Immeril, Kat, Thorgrim, Alissa (`src/data/heroes.json`).
- 41 dungeon tiles (`src/data/tiles.json`), each declaring one bone pile
  square (`boneSquare`, 1,1 before rotation).
- 61 monster entries (`src/data/monsters.json`).
- 50 power cards (`src/data/powerCards.json`).
- 56 encounters (`src/data/cards/encounters.json`).
- 61 treasures (`src/data/cards/treasures.json`: blessings, fortunes, items).
- 15 items (`src/data/cards/items.json`).
- 19 scenario files: adventures 01-13, the Tome of Strahd adventure, and
  scenarios 1-5 (`src/data/scenarios/*.json`).
- Tokens: healing surges (the group begins with TWO shared tokens; harder
  variants use 1, easier variants use 3), coffin tokens, brazier tokens, time
  tokens, item tokens, crown shards, fountain tokens (scenario-specific).

## Turn structure (rulebook order; mirrored in rules.json)

1. Turn start: 0-HP surge check. A hero at 0 HP MUST spend a surge if one is
   available, regains their surge value, then acts normally. No surges left
   means the hero (and, if all heroes are down with no surges, the game) is
   lost.
2. Hero Phase: exactly one of Move+Attack, Attack+Move, or Two Moves.
   Slowed/Immobilized markers are discarded at the end of the Hero Phase.
3. Exploration Phase (only if on an unexplored edge space): draw ONE tile,
   place it triangle toward that edge, place a monster on its bone pile (see
   Bone pile). Otherwise skip to the Villain Phase.
4. Villain Phase step 1: encounter draw ONLY if no tile was placed OR a
   black-triangle tile was placed.
5. Villain Phase step 2: villain activation, each villain one at a time.
6. Villain Phase step 3: activate each monster/trap in draw order, following
   its tactics (ordered list, first true statement applies, then that
   monster's turn ends; same-name monsters each activate, including another
   player's). Newly placed monsters act in this same Villain Phase.
7. End of turn: flags reset, next hero's turn begins.

## Mechanics definitions

**Action economy.** One Hero Phase action set per turn: Move+Attack,
Attack+Move, or Two Moves. No third action, no Move-Attack-Move.

**Adjacent and range.** Range is counted tile-to-tile. Tile-range counting
is never diagonal. Square-level adjacency and wall-blocking for hero
attacks/powers are known code gaps: do not cite the code's Manhattan,
square-Manhattan, or Chebyshev helpers as the rule. Monster distance uses
tile graph distance (see `MonsterAI.getTileGraphDistance` in code, but the
rule is tile-to-tile).

**Attack.** d20 + bonus >= AC is a hit, per target. Miss effects apply if
listed on the card. A natural 20 is a critical hit (and, with the
critical-attacks ability from leveling, enables level-up spending; see XP).

**Bone pile.** The marked spawn square on each dungeon tile. It is a
position, not a pile anything accumulates in.
- Exploration: the monster drawn on exploration is placed on the new tile's
  bone pile. Tile data declares it (`boneSquare`, 1,1 on all 41 tiles);
  placement rotates it with the tile, so placement must use the ROTATED
  bone square, never the declared one and never a hardcoded square.
- Control rule on exploration spawn: if YOU already control that monster
  type, discard and redraw; another player's copy of the same type is fine.
- Monster tactics movement: move to the bone pile if empty, else anywhere
  on the tile.
- Scenario and card effects that name the bone pile place there (example:
  Strahd awakens on the start tile's bone pile; monster cards reading
  "Spawn X on the bone pile of the newly revealed tile").
- Range is NOT measured bone-pile-to-bone-pile. Range is tile-to-tile (see
  Adjacent and range).
- Occupied bone pile: when the bone pile is occupied, place on an empty
  square on the same tile. (Placement convention per Louis's spec; the
  verified rulebook statement of "if empty, else anywhere" is the tactics
  movement rule above.)
- Encounter cards targeting bone piles (for example Grave Dirt, Idol of
  Strahd): UNVERIFIED from the rulebook. Check the actual card data
  (`card-source-truth/events.md`, `src/data/cards/encounters.json`) before
  claiming any such effect; do not assume one exists.

**Conditions.** Slowed = Speed 2. Immobilized = Speed 0. At most one marker
of each per hero. Markers are discarded at the end of the Hero Phase.

**Downed hero.** The figure stays knocked down on its square. Monsters
ignore it. It cannot take damage or use powers/items, but conditions still
apply. Healed before its turn starts, it stands up and acts normally.

**Encounter draw.** Drawn in the Villain Phase only when no tile was placed
or a black-triangle tile was placed (see Turn structure step 4). An encounter
card may be cancelled by spending XP (see XP) only when drawn, before
applying it.

**Escape.** On a specified location at the end of the Hero Phase: the hero
takes no more Hero/Exploration actions and draws no more encounters, but
still takes Villain Phase turns (as applicable per scenario).

**Exploration.** Only from an unexplored edge space, only one tile per turn,
triangle toward that edge. The monster drawn goes on the bone pile (see Bone
pile). A hero at an edge must explore; the sequence is not optional.

**Healing surges.** The group begins with TWO shared surge tokens (1 for
harder variants, 3 for easier). A hero at 0 HP at turn start MUST spend one
(regain surge value, then act normally). None left at a 0-HP turn start
means defeat (see Win/loss).

**Monster tactics.** An ordered list on the monster card. The first true
statement applies, then that monster's turn ends. Same-name monsters each
activate, including another player's. Newly placed monsters act in the same
Villain Phase they were placed. Monster special abilities (for example
Incorporeal, Swarm, Shifty, Death Shriek) apply only as their card text
states them; do not generalize them across monsters.

**Movement.** Speed is a square budget. Diagonal movement is allowed,
counting squares, unless blocked. A figure cannot enter a wall square or a
monster-occupied square; it may pass through a hero's square but may not end
there. No diagonal move between two adjacent walls. Tile-range counting is
never diagonal.

**Other actions.** Pick up objects: adjacent, Hero Phase, no action cost,
any number, even while passing. Destroy objects: target like a monster if
the object has AC/HP. Disable traps: on the trap's tile, instead of
attacking, roll >= the disable number; a natural 20 also enables level-up
spending (see XP).

**Powers.** At-will powers never flip face-down. Daily and utility powers
flip face-down after use until an effect flips them back. Utility timing
(reactions vs hero-phase use) follows the card text.

**Treasure.** Three kinds. Blessings: play immediately, affect all heroes,
discard at the end of the next Hero Phase. Fortunes: immediate effect,
discard immediately. Items: the drawing hero chooses the keeper on draw;
items cannot be re-gifted; only one attack bonus and one defense bonus from
items apply at a time. A hero who defeats a monster draws at most ONE
Treasure Card per turn. Defeated monsters go to the controller's Experience
Pile (their card is discarded to it).

**Villains.** Activated in the Villain Phase, each villain one at a time,
before monsters/traps (see Turn structure step 5). Villain-specific rules
(lairs, spawns, awakenings) are scenario data, verified for internal
consistency only.

**Win/loss.** Win = the adventure objective is completed. Lose = a hero at
0 HP at turn start with no surges remaining (and all heroes down), or an
adventure-specific defeat condition (example: 5 monsters escape in adv09).

**XP and level-up.** Experience comes from defeated monsters (their cards,
in the controller's Experience Pile).
- Cancel: spend XP cards summing to >= 5 (excess wasted) to cancel an
  encounter card, ONLY when drawn and before applying it.
- Level up: on a natural 20 attack roll OR a natural 20 disable-trap roll,
  spend 5 XP to level up: flip the hero card, +2 HP, +1 AC, +1 surge value,
  gain a new Daily power and the critical-attacks ability.

## Scenarios (names and objectives; rules verified against scenario data only)

- adv01 Escape the Tomb: escape via stairway; sun track (at 6, Strahd
  awakens on the start tile's bone pile). 2 surges.
- adv02 Find the Icon: possess the Icon of Ravenloft; clear the Chapel of
  monsters. 2 surges.
- adv03 Klak's Infernal Artifact: defeat Klak; artifact rules. 2 surges.
- adv04 Daylight Assault: escape with treasures; sunset encounter draws.
  2 surges.
- adv05 The Final Transformation: cure Kavan (fountain tokens); escort and
  transformation rules. 2 surges.
- adv06 Destroy the Dracolich: Arcane Circle spawns; defeat Gravestorm;
  destroy the phylactery. 2 surges.
- adv07 Adventure Impossible: lair villains; defeat villains; no healing
  surges; hero succession. 0 surges.
- adv08 Horror of the Howling Hag: defeat villains; interact (time tokens).
  2 surges.
- adv09 Gauntlet of Terror: defeat villains; monster tokens; monsters move
  to exit; Start tile HP; 5 escapes means defeat. 2 surges.
- adv10 Blood and Fog: all heroes escape via Secret Stairway; undead
  no-XP-cancel; Rotting Nook boss. 2 surges.
- adv11 Rampaging Golem: defeat villains (Flesh Golem); workshop boss; item
  tokens; golem calming. 2 surges.
- adv12 Hunt for Nekrula Pt 1: defeat villains (Strahd); Arcane Circle
  bodyguard; Secret Stairway Strahd; black arrow items. 2 surges.
- adv13 Hunt for Nekrula Pt 2: defeat villains; interact (coffins); coffin
  tokens, investigation, healing; Crypt reveal Strahd. 2 surges.
- adv_tome The Tome of Nekrula: setup packet (top 3 plus Crypt after the
  12th tile); black-triangle item tokens; guardian spawn on Crypt reveal;
  defeat the guardian. 2 surges.
- s1 Find Nekrula's Coffin: coffin deck, per-tile placement, search/reveal,
  Strahd's-coffin victory. 2 surges.
- s2 Reset the Beacon: interact (braziers); fog wraiths. 2 surges.
- s3 Escape the Dungeon: find the exit tile; all heroes at the exit;
  collapse countdown. 1 surge.
- s4 Hunt for the Crown: collect crown shards. 2 surges.
- s5 Rescue the Adventurer: find the torture chamber; escort; relentless
  pursuit. 2 surges.

## Learned outside the manual (agent knowledge, not rulebook text)

Each item names its source. None of these override the rulebook; they are
what playtesting, data audits, and code reads taught the agent that the
manual does not state.

- **Rebrand mapping (project data).** Strahd is Varkath / Karl Von Nekrula,
  Castle Ravenloft is The Shadowhold, Skull Lord is Anthraxus. Names only;
  rules unchanged. Live consequence: three combat paths still test for the
  string "skull lord" and therefore miss the renamed Anthraxus (see the
  sweep, Monsters table). When reading code or data, map names before
  judging correctness.
- **Scenario surge counts and objectives (scenario data).** The per-adventure
  surge counts and objective lists above come from `src/data/scenarios/*.json`,
  checked for internal consistency only. The Adventure Book itself was not
  in the rulebook PDF, so scenario specifics are data-verified, not
  Adventure-Book-verified.
- **Card-text authority (physical cards).** Full card text lives in
  `card-source-truth/*.md`, transcribed from physical cards and verified by
  Louis. Data files (`src/data/cards/*.json`, `src/data/monsters.json`)
  must match it, not the reverse. Cards in data with no matching verified
  entry are unverified legacy content: mark unresolved, do not invent text.
- **XP value disagreements (data vs comment).** `monsters.json` XP values
  disagree with `ExperienceSystem`'s own header table (examples: Skeleton 1
  vs 2, Ghoul 2 vs 3, Gargoyle 2 vs 5). Unresolved which is right: needs a
  card check before calling either a bug. Do not cite either table as the
  rule until verified against card text.
- **Bone pile, code vs rule (code audit).** Tile data declares `boneSquare`
  1,1 on all 41 tiles and `placeTile` rotates it, but exploration spawning
  hardcodes sqX 2, sqZ 2 while its log claims "bone square" (Fix Tracker
  item 11). The rule is the rotated bone square; the code position is the
  bug, not a second rule.
- **Start tile modeling (code fact, not a rule).** The code models the Start
  tile as one tile, not two. The rulebook's Start tile treatment is a
  two-tile arrangement in the physical game; do not cite the code's single
  tile as the rule.
- **Manual gaps (rulebook states no rule).** Tile-stack exhaustion procedure,
  encounter-deck reshuffle, and edge-matching on placement beyond the
  triangle sentence: the rulebook text states no rule. Any procedure for
  these is a project decision, not a rulebook rule, and must be labeled as
  such.
- **Deliberate divergences (Louis's calls, not bugs).** Automatic
  (non-optional) surge spending matches the rule's "MUST" and is the only
  sane implementation for a solo digital game. Adv07's 0 surges matches its
  own `no_healing_surges` text. The rebrand changes no rule. End Turn
  auto-explore is a design question (Fix Tracker item 13), not a decided divergence.
