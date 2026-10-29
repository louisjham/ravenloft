---
name: hz-spatial-interaction
description: >-
  MANDATORY workflow whenever designing, tuning, reviewing, or debugging spatial
  interactions in Meta Quest and Horizon OS — including hand tracking, pinch/grab
  gestures, direct manipulation colliders, raycasting, spatial UI, locomotion, and
  haptics. Forces querying authoritative Meta design specs and interaction metrics
  via metavr (vr_docs_search / vr_docs_get_page under scope 'design') BEFORE
  implementing or modifying spatial interaction code.
---

# Spatial Interaction & Hand Tracking Design

## Overview & Core Mandate

Whenever a request involves **designing, tuning, reviewing, or debugging spatial interactions** in Meta Quest and Horizon OS (WebXR or native):
- **NEVER guess thresholds, hysteresis values, or interaction paradigms from training memory.**
- **ALWAYS query Meta's authoritative developer documentation via `metavr` first.**
- Extract the canonical physical dimensions, dwell timings, and gesture detection formulas directly from Horizon OS design specifications.

---

## The `metavr` Design Verification Workflow

Before writing or modifying any spatial interaction code:

### Step 1: Query Authoritative Design Specs via `metavr`
Run `vr_docs_search` with `scope: "design"` (or `scope: "web"` for WebXR specifics):
```json
{
  "query": "grab specs pinch threshold release distance hand tracking",
  "scope": "design",
  "mode": "search",
  "max_results": 5
}
```
Relevant design topics to search:
- **Pinch & Grab**: `"grab specs pinch threshold release distance"`, `"direct pinch collider"`
- **Hand Gestures & Poses**: `"hands gesture hierarchy palm pinch"`, `"hand tracking dwell duration"`
- **Targeting & Rays**: `"indirect cone casting raycast magnetic"`, `"direct targeting collider"`
- **Spatial UI & Anchoring**: `"spatial layout depth placement readability"`, `"billboard orientation"`
- **Haptic Affordances**: `"haptic profiles hover select error"`

### Step 2: Fetch the Full Canonical Specification
Pass the exact document path from search results to `vr_docs_get_page`:
```json
{
  "url": "design/grab_specs.md"
}
```
Key canonical documentation pages:
- `design/grab_specs.md`: Metric thresholds for direct pinch, indirect cone casting, alignment, and release.
- `design/grab_usage.md`: Input modalities, direct vs. indirect interaction models, and grab mechanics.
- `design/hands.md`: Hand tracking biomechanics, comfort, and gesture affordances.
- `design/interactions-input-mappings.md`: One-point and two-point manipulation specifications.

### Step 3: Extract & Apply Canonical Metrics

From Meta's canonical design specifications, enforce these core standards:

| Parameter | Canonical Metric | Purpose & Implementation Rule |
|---|---|---|
| **Direct Pinch Start Threshold** | **$\le 1.8\text{ cm}$** ($0.016\text{ m} - 0.018\text{ m}$) | Fingers must physically close to commit intent. Prevents brushing and loose hand curvature from accidentally grabbing. |
| **Pinch Release Threshold** | **$> 2.6\text{ cm}$** ($0.026\text{ m} - 0.030\text{ m}$) | Hysteresis band. Opening fingers beyond this releases immediately on the exact frame (guaranteed drop, no lag). |
| **Neutral Re-Arm Threshold** | **$> 3.8\text{ cm}$** ($0.038\text{ m} - 0.045\text{ m}$) | Hand must open to neutral before it can initiate another grab. Prevents per-frame re-grabs while hovering. |
| **Direct Grab Proximity Collider** | **$0.05\text{ m} - 0.24\text{ m}$** | Direct piece manipulation requires fingertips to be in physical proximity. Infinite laser rays must NOT trigger direct piece grabs. |
| **Pinch Intent Dwell** | **$60\text{ ms} - 100\text{ ms}$** | Filters out transient 1-frame tracking jitter or noise without adding perceptible latency. |

---

## Architectural Principles for WebXR Spatial Interactions

1. **Direct Touch vs. Indirect Raycasting Separation**:
   - Near tabletop items (miniatures, cards, dice, tokens) must require physical fingertip proximity (`DEFAULT_MAX_GRAB_DISTANCE`).
   - Waving hands or pinching empty air (e.g. to move the world/table) must never grab a distant board piece via an unconstrained raycast.
2. **Decoupled Locomotion & Object Manipulation**:
   - Hands actively manipulating a held 3D piece (`isHandHoldingObject`) must be excluded from room locomotion / tabletop translation. Moving a hero must never drag the world under the player's hand.
   - Dual-grip table scaling and rotation requires both hands on empty air.
3. **Guaranteed Frame-Rate Independent Release**:
   - Never rely exclusively on WebXR `selectend` events if raycast unhovering can discard the event.
   - Poll active pinch state (`isGrabActive`) in `useFrame` at 90Hz.
   - If tracking confidence drops or joints are occluded, release immediately rather than latching in an infinite hold.
4. **Re-Arming State Machine**:
   - Every drop action disarms that hand (`isReArmed = false`).
   - Re-arming requires the hand to open to neutral pose ($> 3.8\text{ cm}$) and cooldown expiry, eliminating sticky re-grabs.

---

## Spatial Interaction Verification Checklist

Before declaring any spatial interaction task complete:
- [ ] Queried `metavr` (`vr_docs_search` / `vr_docs_get_page`) and cited canonical Meta Horizon OS thresholds.
- [ ] Confirmed direct piece grabbing requires physical proximity (no accidental across-the-room ray snatches).
- [ ] Confirmed opening fingers drops the object first try on the exact frame (0ms latency, no sticky latch).
- [ ] Confirmed hand must return to neutral ($> 3.8\text{ cm}$) before picking up again (zero noisy re-grabs).
- [ ] Confirmed holding an object does not drag or disturb the tabletop playspace (`XRTabletopRig`).
- [ ] Passed automated interaction test suites (`npx tsx runTests.ts`).
- [ ] Passed production compile (`npm run build`).
