---
name: castle-ravenloft-ar
description: AR-first delivery for this project: WebXR AR on Meta Quest, passthrough tabletop, hands-first interaction, and PWA/TWA packaging to the Horizon Store, with a VR mode toggle inside the AR build. Covers the full stack for this codebase (React/Vite/Three.js) and AR best practices. Use for any AR, XR, passthrough, WebXR session, hand-tracking, tabletop-alignment, packaging, or store task. Takes precedence over hz-iwsdk-webxr, hz-store-pwa mode choice, and game-development platform routing for this project.
---

# Castle Ravenloft AR

## Direction (see agents.md)

AR-first, VR toggle kept. Target: Meta Quest (Horizon OS), WebXR AR, shipped
as PWA/TWA via Bubblewrap to the Horizon Store. One codebase (React/Vite/
Three.js web app); AR is the shipped focus and the runtime mode, not a
separate app. VR remains as a toggle inside the AR build (many AR games offer
a VR mode). The toggle is maintained; it is NOT a separate version, and VR is
never kept in parity with AR. No desktop/web version in parity. Desktop is
dev/playtest surface only, never a release target. No forks: AR work lands in
this codebase.

## When to use this skill

Use this skill for any task involving: WebXR AR sessions, passthrough, room
tabletop anchoring/alignment, hand tracking or controller input in AR, AR
performance on Quest, PWA/TWA packaging, Horizon Store upload, or Quest
on-device verification. Load it before writing any AR code, and before any
packaging or store step.

## Precedence

- This skill takes precedence over `hz-iwsdk-webxr` for this project. IWSDK's
  ECS architecture does NOT apply here: this codebase uses its own
  React Three Fiber scene plus Zustand stores. Do not rewrite the scene into
  IWSDK ECS, and do not import IWSDK as the app framework. Use `hz-iwsdk-webxr`
  only as background on Quest Browser WebXR behavior, never as the
  architecture.
- This skill fixes the `hz-store-pwa` mode choice: mode is immersive AR,
  always. Do not present 2D panel vs immersive as an open choice, and do not
  ship a 2D windowed panel target.
- This skill takes precedence over `game-development` platform routing: the
  platform is web AR on Quest, not Unity, not Spatial SDK, not Android.
- For Quest API facts, `hz-quest-verify-first` still applies: verify against
  authoritative Meta sources via metavr docs search before coding against any
  Quest/WebXR API. Never rely on training-data knowledge for Meta APIs.

## Stack (this project, not generic)

- React 18 functional components, Vite, TypeScript strict (never `any`).
- Three.js ^0.169 via @react-three/fiber and drei helpers for all scene
  composition. Never manipulate Three.js objects imperatively outside
  `useFrame` or `useEffect` with proper ref guards.
- Physics via @react-three/cannon only. State in Zustand slices: game logic in
  gameStore slices, UI overlays in uiStore only.
- Existing XR interaction code (`XRTabletopRig.tsx`, `Hero3D.tsx`,
  `GrabbablePiece3D.tsx`, `PhysicalCard3D.tsx`) describes the VR-mode
  interaction inside the toggle (grasp-and-pull locomotion, dual-grip
  scale/rotate, thumbstick orbit and elevation, 6DoF grab-and-drop). Maintain
  the toggle; do not build a separate VR version or keep VR in parity.
- Quality gates (non-negotiable, see `.agents/rules/quality-gates.md`): after
  ANY file modification, `tsc --noEmit`, `eslint src/ --max-warnings 0`, and
  `vite build` must all exit 0. New game logic modules require a Vitest test.

## AR session and passthrough

- Session type is WebXR `immersive-ar` in Quest Browser, with passthrough so
  the player sees their real room. The dungeon table sits in the room, not in
  a virtual void.
- Request only WebXR features the Quest Browser build actually supports
  (hit-test, anchors, plane detection where available). Check support at
  runtime and degrade gracefully; never assume a feature exists, and never
  hard-require a feature without a fallback the player can still play with.
- Artificial legs, pedestals, and fixed table slabs stay disabled: nothing
  may occlude passthrough or break tabletop alignment.
- The floor must extend well beyond the table and fade into fog, so from any
  camera angle the eye never finds a hard edge or void drop (see Fix Tracker
  item 1, tabletop sizing).

## Tabletop

- Size the tabletop from game data, not a magic number: total the tile piles
  in `src/data/scenarios/*.json`, take the largest scenario's pile total, and
  fit that many tiles in the worst realistic shape plus a 2-tile margin on
  every side. Minimum 12x12 tiles (48 units).
- The table reads as wood: warm wood-toned top surface with a finished edge
  trim. Reuse an existing wood texture in the repo if one is present, else a
  procedural wood-toned material (color plus roughness, no new asset
  downloads).
- Tabletop alignment is the player's room anchor: the table position must
  survive session restarts via anchors where the runtime supports them, and
  must never drift into walls or furniture placement the player did not
  choose.

## Input

- Hands-first (competition requirement). Hand tracking is the primary input
  for AR play: grabbing heroes, dice, and cards with hands. Follow the
  `hz-spatial-interaction` skill: verify canonical Meta Horizon OS thresholds
  via `metavr` (`vr_docs_search` under `scope: design`) before designing or tuning
  spatial interaction models, pinch/grab metrics, or gestures.
- Controllers remain a fallback where already implemented (grab-and-throw
  dice, hero grab-and-drop), but do not build new controller-only features.
- Seated-optimized: the player sits, the table is within reach, no room-scale
  walking is required to play. Reachable squares illuminate (emerald/gold
  runes) so a seated player can read the board at a glance.
- Dice: grab-and-throw is the interaction (die in air, grabbed and rolled,
  result from settled orientation, not pre-rolled). Auto-rolled dice must land
  in the visible dice arena (see Fix Tracker item 9).

## Performance on Quest

- Quest hardware is the budget, not desktop. Keep frame work inside the
  existing gates: no dynamic imports on hot paths, single source of truth for
  physics profiles (`DiceProfiles.ts`, no redeclaration of defaults in
  `diceStore.ts`), narrow store selectors (never subscribe whole gameState),
  and minimize components re-rendering on large state changes (villain phase,
  end-turn).
- When profiling on device, use `metavr perf` (Perfetto traces) and the
  `hz-perfetto-debug` / `hz-simpleperf-debug` skills. Profile on the headset,
  not by extrapolating from desktop frame rates.

## Packaging and store

Follow the `hz-store-pwa` pipeline with mode fixed to immersive AR:

1. Build the web app (this repo, Vite production build).
2. Deploy to a public HTTPS origin (Vercel). The origin must stay live: the
   installed TWA loads the PWA from it.
3. Web app manifest plus icons, live on that origin.
4. Package as a signed Quest APK with `@meta-quest/bubblewrap-cli`
   (`bubblewrap init --metaquest`): the signing keystore is Louis's custody,
   reused for every update, never regenerated.
5. Publish `assetlinks.json` at `/.well-known/` on the SAME origin, and verify
   it before shipping: WebXR PWAs fail to launch if the asset-links check
   fails.
6. Upload with `ovr-platform-util`, then follow `hz-store-submit` for
   VRC validation, store assets, dashboard setup, and review tracking.

Auto-enter-session: the installed PWA must auto-enter the WebXR AR session on
launch (immersive mode step from `hz-store-pwa`). A TWA that opens to a URL
bar or a 2D page is a packaging failure, not a player error.

## Verification on device

- Verify on Quest first, before any store or packaging step, using
  `metavr-cli`: `metavr device list`, `metavr app install`, `metavr app
  launch`, `metavr capture screenshot`, `metavr log`. Follow
  `hz-quest-verify-first` for docs verification and `hz-vr-debug` for
  on-device diagnosis (its metavr tooling applies to AR runs, not only VR).
- Playtest checklist for any AR change: table anchors in the room, passthrough
  unobstructed, hands can grab heroes/dice/cards, seated reach works, session
  survives a headset sleep/wake cycle, and the build passes all three quality
  gates.

## Out of scope

Unity paths (all `hz-unity-*` skills), Spatial SDK / Kotlin paths
(`hz-spatial-sdk`, `hz-platform-sdk`, `hz-psdk-integration`), Android
2D-porting, new-project scaffolding, Portal devices, 2D windowed panel
targets, a separate VR version, VR parity work, and any framework rewrite (IWSDK ECS, Unity, Unreal).
If a task genuinely needs one of these, stop and say so instead of pulling it
into this codebase.
