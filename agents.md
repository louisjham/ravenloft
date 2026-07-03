Load castle-ravenloft-refactor for any refactor, cleanup, bug fix, performance, or architecture task.

Load castle-ravenloft-source-of-truth for any task involving cards, powers, treasures, encounters, JSON data, image remaps, scans, or source-of-truth verification.

If a task touches both architecture and card data, load both skills.

For any refactor, cleanup, bug-fix, performance optimization, or architectural change in this repository, load and follow the workspace skill `castle-ravenloft-refactor` before making edits.

Skill path:
.agents/skills/castle-ravenloft-refactor/SKILL.md

This skill is the default architectural guidance layer for this project.
Do not bypass it unless the user explicitly requests behavior changes that conflict with the skill.


Castle Ravenloft Refactor Architecture Brief
This project is a digital port of the Castle Ravenloft adventure board game built with React 18, Vite, Three.js, and Zustand slices for state management. The game is mostly implemented; current work focuses on refactoring for performance, clarity, and long-term maintainability without changing gameplay rules.

Core design principles
The refactor must preserve one-to-one behavior with the physical Castle Ravenloft game wherever feasible, including card effects, movement rules, encounter sequencing, and villain activation. Engine layers should follow the same pure-function discipline already present in systems like CombatSystem, EncounterSystem, TokenSystem, and TreasureSystem: inputs in, outputs out, no hidden mutation. All refactors must keep the code defensible, easy to reason about, and well-logged for future audits.

The architecture is organized around three layers:

Engine / rules layer — pure TypeScript modules in src/game/engine/ that implement rules, card resolution, conditions, experience, treasure, tokens, etc.

Store layer — Zustand slices (coreSlice, cardSlice, combatSlice, tokenSlice, diceStore, uiStore) that hold game state, connect engine results to React, and mediate async flows like dice rolls.

UI / rendering layer — React components and hooks (App.tsx, Tile3D, Dice3D, ExplorationLayer, useGameActions, useExplorationControls, etc.) plus Three.js scene logic for board, tokens, and dice.

Refactors should move logic downward (toward the engine) and side effects upward (toward UI), leaving stores as thin adapters.

Refactor goals
Villain phase modularization

Target file: villainPhaseLogic.ts.

Problem: This file is a large, procedural script that intermixes queue building, movement, attacks, reactions, defeat handling, logging, and state mutation.

Goal: Extract pure modules such as:

buildVillainQueue(newState, gameState)

resolveVillainMovement(newState, queue)

resolveVillainAttacks(newState, queue)

resolveVillainReactions(newState, queue)

resolveVillainDefeats(newState, queue)

generateVillainPhaseLogs(result)

Each module should accept explicit inputs and return { newState, logEntries, success }-style outputs without directly touching Zustand. The main villain-phase entry point in the store should orchestrate these modules and perform a single set() per end-turn.

Action hook decomposition

Target files: useGameActions.ts, useExplorationControls.ts.

Problem: These hooks currently mix UI concerns (notifications, modals, animation timing) with gameplay validation (movement BFS, exploration rules, token search, attack paths). They also subscribe broadly to store state.

Goal: Split responsibilities into more focused hooks or command modules:

Movement: useHeroMovementActions() — hero movement, reachability, conditions, BFS, monster blocking.

Combat: useCombatActions() — attack selection, attack resolution triggers, post-attack feedback.

Turn & exploration: useTurnActions() — end-turn checks, exploration gating, dungeon tile placement rules.

Tokens: useTokenActions() — search, token reveal, victory checks.

Each hook should:

Subscribe to narrow slices of store state via selectors, not whole gameState.

Call pure engine functions first, then dispatch store actions, then UI notifications/animations.

Avoid mixing React animation delays deeply into gameplay logic: animation delays should be thin wrappers around engine actions, not the other way around.

Board rendering performance and clarity

Target files: Tile3D.tsx, ExplorationLayer.tsx, dice-related components.

Problem: Tiles and dice currently subscribe directly to stores and do work per-instance that could be centralized. This amplifies re-render costs and hurts INP and overall responsiveness.

Goal:

Make Tile3D mostly a pure presentational component: coordinates, visual state, and minimal per-tile props.

Move movement overlays, exploration highlights, and hover-derived state up to a board-level container.

Ensure dice components consume carefully scoped physics profiles from a single source of truth (DiceProfiles.ts), with animation driven by a clear phase machine in diceStore.

Performance constraints:

Keep INP for dice roll and main interactions under 200ms where possible.

Minimize the number of React components that re-render on large state changes (villain phase, end-turn).

Store hygiene and side-effect control

Target files: coreSlice.ts, diceStore.ts, cardSlice.ts, tokenSlice.ts, combatSlice.ts, uiStore.ts.

Problem: Some actions do multiple set() calls per logical operation, some mutate state indirectly, and some rely on debug logs or repeated selectors.

Goal:

Ensure complex operations like end-turn and villain phase use at most one final set() with the computed newState.

Gate all debug logging behind import.meta.env.DEV or equivalent.

Use typed result objects from engine modules ({ newState, message, success, logEntries }) instead of embedding rule logic into slices.

Document each slice action with a short comment about which engine module it expects to call.

Behavioral constraints
Do not change rules, card effects, phase sequencing, movement or attack math unless explicitly marked as a bug fix.

Treat the physical card text and existing engine modules as the source of truth for behavior; store and UI refactors must adapt around them.

When in doubt, favor predictability over cleverness: explicit state machines and pure functions instead of implicit, reactive flows.

Performance and quality constraints
Refactors must not introduce TypeScript errors: always maintain strict typing and run npm run build or npx tsc --noEmit after changes.

Maintain test coverage by running npx tsx runTests.ts when available before declaring a refactor complete.

Logs should be structured and minimal, with dev-only verbosity where needed.

Skill ideas for Antigravity / Gemini
To make this reusable across sessions, it’s worth defining at least two workspace skills in .agents/skills/ (or the Gemini equivalent).

Skill 1: castle-ravenloft-refactor (architecture & behavior)
Purpose: Teach the agent the refactor goals, constraints, and layering rules for this project.

Contents of SKILL.md (high level):

Short description: “Guides refactors to the Castle Ravenloft React/Three.js/Zustand game to improve structure and performance without changing rules.”

Sections:

Stack overview (React/Vite/Three.js/Zustand).

Layering (engine, store, UI) and pure-function expectations.

Villain-phase modularization rules.

Action hook decomposition rules.

Board performance constraints (INP, re-renders).

Behavioral constraints (physical card fidelity).

Required validation steps (build, tests).

You can paste most of the brief above into that skill, trim it slightly, and add a “Decision tree” section: “If task affects villainPhaseLogic, follow path A; if it affects hooks, follow path B; if it affects store slices, follow path C”.

Skill 2: card-source-truth (data & content workflow)
Purpose: Encode your source-of-truth workflow for card text and images so the agent always treats manually entered card data and card-scans as authoritative.

Contents of SKILL.md:

Describe:

Manually entered card text in card-source-truth/ is the ultimate source of truth.

JSON data (treasures.json, encounters.json, etc.) must always be updated to match the source-of-truth files, never the reverse.

Image paths are mapped from card-scans directories according to existing conventions.

Agents must show diffs and get approval before modifying JSON.

Provide:

Example workflow steps (like the preamble you already use when starting card-entry sessions).

A simple decision tree: “If asked to change a card, first read the card-source-truth file, then propose JSON changes, then show diff.”

This prevents future refactors or data work from drifting away from the physical game.

Optional Skill 3: dice-performance-tuning
Purpose: Capture the constraints we identified around dice animation responsiveness and store interactions so agents don’t re-introduce sluggishness.

Contents:

Describe:

Single source of truth for physics profiles in DiceProfiles.ts.

No redeclaration of defaults in diceStore.ts.

Use subscribe-with-selector and phase machine, not timers and polling.

Aim for INP under 200ms; avoid dynamic imports on hot paths.
