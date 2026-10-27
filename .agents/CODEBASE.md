# Castle Ravenloft codebase — plain-language map

Generated Oct 25, 2026 from the repo as it stands. If this file disagrees
with the code, the code wins and this file needs regenerating. Keep it
short: this is a map, not a dump. Detail lives in the skills and docs
linked at the bottom.

## What this is

A digital adaptation of the Castle Ravenloft board game: a cooperative
dungeon crawl for 1–5 players. One codebase (React 18 + Vite + TypeScript
+ Three.js), shipped as a WebXR AR experience on Meta Quest via a
PWA/TWA package to the Horizon Store. Direction: AR-first; VR stays as a
toggle inside the AR build, never a separate version in parity; desktop
is the dev and playtest surface only. No forks. Never commit or push —
Louis stages and pushes.

## Cold-start checklist

1. Read this file.
2. Load the skill the routing in agents.md points to for the task.
3. Check FIX_TRACKER.md for open items before changing behavior.
4. After any change: `tsc --noEmit`, `eslint src/ --max-warnings 0`,
   `vite build` — all must exit 0. (`npm run build` runs tsc + vite
   build.) New game-logic modules need Vitest tests; the test entry
   point is runTests.ts.

## Layout (210 files under src/)

- `src/main.tsx`, `src/App.tsx`, `src/index.css` — entry, app shell, styles.
- `src/components/` (73 files) — everything the player sees:
  `3d/` (the tabletop, tiles, cards, monsters; `3d/environment/` for
  dressing), `ui/` (HUD, menus, `ui/cards/`), `interaction/` (grabbing,
  dice throwing), `effects/`, `settings/`, `tutorial/`.
- `src/game/` — the rules, with no rendering in it:
  - `engine/` — the turn and combat machinery: TileSystem,
    EncounterSystem, CombatSystem, CombatAdapter, CombatEncounterSystem,
    ActionResolver, CardResolutionSystem, ConditionSystem, PowerSystem,
    PowerSelectionSystem, TreasureSystem, ExperienceSystem,
    ExplorationStateMachine, HeroTurnUtils, TokenSystem, DiceProfiles,
    tabletopDimensions, MonsterAI.
  - `ai/` — monster brains: MonsterAI, AbilitySystem, BossPhases,
    Pathfinding, ThreatAssessment, plus one behavior file per major
    monster type (Skeleton, Zombie, Goblin, Wolf, Ghost, Gargoyle,
    Vampire, Strahd).
  - `scenarios/` — ScenarioManager (loads a scenario, owns start and
    lair tiles), Objectives, Events.
  - `progression/` — SaveSystem. `constants.ts`, `types.ts`,
    `dataLoader.ts` sit at the top of `src/game/`.
- `src/store/` — all shared state, in Zustand:
  `gameStore.ts`, `uiStore.ts`, `diceStore.ts`, `storeTypes.ts`, plus
  `slices/` (card, combat, condition, core, power, token,
  villainPhaseLogic). Game state and UI state stay separate.
- `src/data/` — the game's data as JSON, loaded by dataLoader and
  powerCardLoader: heroes, monsters, tiles, powerCards, boss-phases,
  scenarios, audioManifest, plus tokenMap and billboardAssets.
  `data/cards/` (9 files, including hero-abilities) and
  `data/scenarios/` (19 scenario files).
- `src/xr/` (16 files) — the XR presentation layer only: cards, hud,
  menus, unboxing. It reads the stores and calls the engine. It never
  implements rules of its own.
- `src/audio/`, `src/assets/`, `src/contexts/`, `src/hooks/`,
  `src/utils/`, `src/testing/` — sound and music systems, static
  assets, React context, hooks, helpers, tests.
- `public/` — shipped assets: card-images (229), models (39),
  card-scans (10), audio (14), ui (38), icons (4), assets (310).
  `public/.well-known/` holds the asset-links file the store package
  needs. `twa-manifest.json` at the root is the packaging manifest.
- `card-source-truth/` — the authority for card text: one Markdown
  file per card family (heroes, monsters, powers, items, events,
  traps, fortunes, blessings, environments, event-attacks) plus an
  image audit and a README. When card text and code disagree, this
  folder wins and the code gets fixed.

## How the pieces connect

Presentation reads the stores and calls engine functions; the engine
returns new state; the stores hold it; the components render it. That
order matters: a bug in how something looks is a components problem,
a bug in what happens is an engine or store problem, and a bug in
what a card says is a data or card-source-truth problem. Dice are the
one exception to look up, not guess: DiceProfiles is the single
source for dice behavior, diceStore holds dice state, and a thrown
die's result comes from the face it settles on.

The tabletop is sized from the data, not a magic number:
`src/game/engine/tabletopDimensions.ts` derives it from the scenario
tile piles, with a 48-unit (12x12 tile) minimum. Tiles are 4 units.
Every tile carries a boneSquare at (1,1), rotated when the tile is
placed. Bone-pile behavior is defined by the castle-ravenloft-rules
skill, which takes precedence over engine behavior when they conflict.

## Rules of the road

- Preserve gameplay behavior unless the task is explicitly a bug fix.
  Refactors improve structure, readability, performance, or
  maintainability without changing rules, cards, movement, villain
  logic, turn order, or state transitions.
- The repo root SKILL.md exists but is NOT referenced by agents.md
  and does not match the refactor skill. Do not treat it as guidance.
- The rebrand sweep is HELD. `rebrand-bible.json` exists; do not
  apply it unless Louis says so.
- A `.env` file exists at the root. Never print or copy its contents.
- Search with the built-in search tool (or grep). Never search with
  PowerShell Get-ChildItem/Select-String pipelines: every new search
  string is a new shell command that needs a fresh permission approval.

## Where to go next

- Skills (all under `.agents/skills/`, routed by agents.md):
  castle-ravenloft-refactor (default for code changes),
  castle-ravenloft-source-of-truth (cards and data),
  castle-ravenloft-ar (the AR stack for this codebase),
  castle-ravenloft-rules (the board game's rules, history, and
  rules.json + inventory.json), metavr-cli (Quest device, app, logs,
  screenshots, performance), hz-store-pwa (packaging pipeline),
  plus hz-quest-verify-first, hz-store-submit, hz-vr-debug,
  hz-perfetto-debug, hz-simpleperf-debug, hz-immersive-designer,
  hz-iwsdk-webxr (reference only), 3d-web-experience,
  threejs-geometry, threejs-skills, web-games, game-design,
  game-development, game-art.
- Docs at the repo root: FIX_TRACKER.md (open items, each with a
  paste-ready prompt; Fixed items move to the Fixed section, never
  deleted), BUG_REPORT_2026-10-24.md, GAME_LOOP_FIX_LIST.md,
  RULES_SWEEP_2026-10-24.md (rules-sweep gaps, pending triage, not
  duplicated in the tracker), README.md.
