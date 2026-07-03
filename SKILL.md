# Castle Ravenloft Refactor

Use this skill for any refactor, bug fix, performance improvement, or architectural cleanup in the Castle Ravenloft web app. This skill is the default guidance layer for all code-changing work in this project.

## Project Identity

This project is a digital adaptation of the Castle Ravenloft Adventure Board Game built with React, Vite, Three.js, TypeScript, and Zustand slices. The game already exists and is playable. Most work in this repository is not greenfield feature work; it is fidelity-preserving cleanup, bug fixing, performance tuning, and architectural improvement.

## Primary Rule

Preserve gameplay behavior unless the task is explicitly a bug fix. Refactors must improve structure, readability, performance, or maintainability without changing game rules, card behavior, movement rules, villain logic, turn order, or state transitions unless the user specifically requests a rule correction.

When behavior is ambiguous, prefer exact parity with the current implemented rules and the physical board game over clever rewrites.

## Source of Truth

Use these priority levels when making decisions:

1. User instructions in the current session
2. Manually verified Castle Ravenloft card text and project source-of-truth files
3. Current engine behavior that has already been intentionally implemented
4. Existing UI behavior
5. Documentation files such as agents.md

If documentation conflicts with code, verify whether the code is intentionally correct or the docs are stale before changing either.

## Refactor Objectives

Every refactor should push the codebase toward these goals:

- Pure rules logic in engine modules
- Thin Zustand slice actions that orchestrate engine calls
- Narrow store subscriptions in hooks and components
- UI hooks that coordinate user intent, not game rules
- Three.js components that are as presentational and low-churn as possible
- Minimal debug logging in production paths
- Single source of truth for shared constants and profiles

## Layer Boundaries

### Engine Layer

Engine modules should contain deterministic game rules and calculations. Prefer pure functions or class methods that take explicit inputs and return explicit outputs.

Good engine outputs:
- `{ newState, success, message }`
- `{ newState, logEntries, events }`
- typed resolution results for movement, attacks, token search, or villain actions

Engine modules should not:
- call React hooks
- subscribe to Zustand stores
- manipulate UI modals or notifications
- rely on animation timing

### Store Layer

Zustand slices should be thin orchestration layers. They may:
- call engine modules
- commit final state updates
- expose stable actions to UI hooks

Zustand slices should avoid:
- embedding large rule systems inline
- repeated `set()` calls during a single logical action when one final state commit is possible
- production debug noise
- duplicated constants that already exist elsewhere

### UI Hook Layer

Custom hooks should express player intent and local UI coordination. They may:
- select narrowly scoped store state
- call store actions
- trigger notifications and animation wrappers
- hold local UI state like open panels or selected entities

Custom hooks should avoid:
- owning large chunks of rule logic
- broad `gameState` subscriptions when a few fields will do
- mixing validation, state mutation, and presentation concerns in one giant function when smaller modules would be clearer

### Rendering Layer

React and Three.js components should be mostly presentational. Prefer passing derived props down rather than having many leaf components subscribe directly to broad store state.

Avoid per-tile or per-entity subscriptions when the same derived state can be computed once at a board or scene level.

## Known Refactor Targets

### 1. Villain Phase

`villainPhaseLogic.ts` is a high-priority architectural target. Treat it as a candidate for decomposition into smaller rule modules such as:
- queue building
- movement resolution
- attack resolution
- reaction resolution
- defeat handling
- cleanup and log generation

When refactoring villain flow:
- preserve exact behavior first
- extract pure steps before changing algorithms
- keep logs and side effects at orchestration boundaries
- prefer one final committed state update over many incremental commits

### 2. Action Hooks

`useGameActions.ts` and `useExplorationControls.ts` are important but overloaded. Prefer splitting responsibilities into smaller action modules or hooks such as:
- hero movement
- combat actions
- turn/exploration actions
- token actions

### 3. Board Performance

`Tile3D.tsx`, exploration overlays, and dice-related components should be treated as performance-sensitive code.

Prefer:
- memoized derived props
- centralized overlay calculations
- stable references
- single source of truth for dice physics and profiles
- fewer broad subscriptions in render-heavy components

## Performance Rules

When making performance changes:
- reduce unnecessary React rerenders first
- narrow Zustand selectors before introducing complexity
- remove dynamic imports from hot gameplay paths when safe
- avoid recomputing expensive derived data per tile or per entity if it can be shared
- keep the main thread responsive during large turn-resolution flows

Do not trade correctness for micro-optimizations.

## Logging Rules

All debug logging in runtime code should be dev-gated. Prefer `import.meta.env.DEV` or an equivalent project-approved guard.

Do not add noisy logs in hot loops, render paths, dice animation loops, villain activation loops, or frequently called selectors.

## Safe Change Policy

For any refactor or cleanup task:
1. Identify whether the change is structural, behavioral, or both.
2. If behavioral impact is possible, explicitly state it before editing.
3. Prefer extraction and simplification before semantic rewrites.
4. Do not delete suspicious files unless usage has been verified.
5. Keep edits scoped to the requested task.

A file is not dead unless usage has been checked and there is evidence it is not part of the active workflow.

## Decision Tree

### If the task touches engine rules
- Keep logic pure
- Preserve exact rules behavior
- Return structured results
- Do not add UI concerns

### If the task touches Zustand slices
- Move complex rule logic out into engine helpers where possible
- Reduce repeated `set()` calls
- Keep selectors and actions explicit and typed

### If the task touches hooks
- Narrow subscriptions
- Separate local UI state from gameplay validation
- Prefer composition over omnibus hooks

### If the task touches Three.js or board rendering
- Check whether rerender pressure comes from subscriptions, derived state churn, or object recreation
- Centralize repeated calculations
- Keep visual behavior stable unless the task explicitly includes UX polish

### If the task touches docs
- Make docs match reality
- Do not document scripts, helpers, or architecture that do not exist

## Required Validation

After any meaningful code change, the agent should:

1. Run the real available validation commands for the repo
2. Prefer `npm run build` when it includes TypeScript compilation
3. Use `npx tsc --noEmit` when a direct type check is needed and available
4. Run `npx tsx runTests.ts` when the task affects gameplay logic or shared engine behavior
5. Report exactly what changed, why it is safe, and any remaining risks

Do not invent scripts that are not present in `package.json`.

## Output Expectations

When completing a task, provide:
- files changed
- what was changed
- whether behavior changed or was preserved
- validation run
- known risks or deferred follow-ups

## Anti-Patterns

Avoid these patterns during refactors:
- broad `useGameStore()` subscriptions in performance-sensitive hooks or components
- duplicated constants across files when one source of truth should exist
- embedding UI notifications inside engine modules
- performing expensive derived calculations in every tile render
- replacing explicit rule code with vague generic abstractions
- deleting files based only on suspicion
- changing game behavior under the label of refactor

## Default Posture

This project benefits from careful, incremental, evidence-based changes. Prefer small, verifiable steps over sweeping rewrites. The best refactor is one that makes the next refactor easier.
