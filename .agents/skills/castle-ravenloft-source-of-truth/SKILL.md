---
name: castle-ravenloft-source-of-truth
description: Enforces source-of-truth rules for Castle Ravenloft card text, card art, JSON data, and verification workflows. Prevents invented card behavior, fake cards, fuzzy matching, and unverified asset remaps.
---
# Castle Ravenloft Source of Truth

## Canonical Content Root

All verified Castle Ravenloft card text and card art for this project live under `C:\antigravity\ravenloft\card-source-truth`.
This directory is the authoritative root for all card-related tasks.
JSON files, app asset folders, and current in-app values must be updated to match this directory — **not the reverse**.

## Legacy Content Rule

If a card exists in `src/data/cards/*.json` but has no matching verified entry in `card-source-truth`, mark it as **unverified legacy content**. Do not invent missing text. Do not preserve it as canon without approval. Do not synthesize replacement text from similar cards.

---

Use this skill for any task involving cards, treasures, encounters, powers, card JSON, image mapping, card scans, source-of-truth files, or any gameplay content derived from the physical game.

---

## Primary Rule

Do not invent card text, mechanics, card names, image mappings, placeholders, or replacement cards.

If a card cannot be verified from a trusted source, mark it **unresolved** and stop for approval.

---

## Source Hierarchy

Use this exact order of authority:

1. Physical Castle Ravenloft card text verified by the user
2. Manually entered source-of-truth files created from physical cards (`card-source-truth/*.md`)
3. Scanned card art in the verified scan directory
4. Existing structured data files such as `src/data/cards/*.json`
5. Public-facing copied assets such as `public/card-images/*`

Lower layers must be updated to match higher layers.
Higher layers must never be overwritten to match lower layers.

---

## Scenario Overrides vs. Base Card Rules

> **This is one of the most critical distinctions in this codebase. Read it before touching any item JSON.**

### The problem

`src/data/cards/treasures.json` contains two categories of entries that look similar but are fundamentally different:

1. **Base game items** — appear in the physical treasure deck and are drawn during normal play.
2. **Scenario props / implementation overrides** — items that exist only because a specific scenario requires a prop, OR items whose JSON behavior was simplified by a developer for a specific scenario's needs and does not reflect the full physical card text.

**An agent must never treat a scenario override as the canonical rule for a card.**

### How to identify the category

| Indicator | Meaning |
|---|---|
| `"type": "item"` or `"type": "weapon"` in JSON | Standard item — may or may not be fully verified |
| `"type": "quest"` in JSON | **Implementation shortcut** — this item was coded to serve a scenario prop role; its JSON description may be abridged or simplified |
| `"type": "scenario_item"` in JSON | **Explicit scenario override** — this entry exists to support a specific scenario and must not be treated as the base card's canonical rules |
| Entry exists in `card-source-truth/items.md` | **Verified from the physical card** — treat the source-of-truth file as authoritative |
| Entry exists only in JSON, not in `card-source-truth/` | **Unverified legacy** — do not promote it to canonical status |

### Mandatory behavior when editing item behavior

1. **Always read `card-source-truth/items.md` first** before reading JSON.
2. If the JSON entry has `"type": "quest"` or `"type": "scenario_item"`, do not use its `description` or `effects` as the authoritative rule. Check the source-of-truth file.
3. If the source-of-truth file has a verified entry, the JSON must be updated to match it — not the reverse.
4. If a scenario needs a different behavior from the base card (e.g., the Torch is used as a light source in a scenario rather than as a multi-attack weapon), that difference must be labeled as a **scenario override** in code comments and must not overwrite the base card entry.
5. **Do not merge scenario-specific behavior back into the base item card definition.**

### Known items with scenario-specific variants or legacy shortcuts

The following items currently have entries in `treasures.json` that reflect scenario props or simplified shortcuts, not the full physical card text. The source-of-truth entry (if one exists) governs.

| JSON ID | JSON `type` | Status | Notes |
|---|---|---|---|
| `treasure_icon_ravenloft` | `"quest"` | **Scenario prop** | No physical treasure card with this exact rule; used as a scenario victory object |
| `treasure_skull` | `"quest"` | **Unverified legacy** | No matching source-of-truth entry; invented effect; mark as unresolved before any rule work |
| `treasure_portrait` | `"quest"` | **Unverified legacy** | No matching source-of-truth entry; invented effect; mark as unresolved before any rule work |
| `treasure_healing_potion` | `"consumable"` | **Unverified legacy** | Simplified effect; no source-of-truth entry; treat as placeholder |
| `treasure_blessing` | `"consumable"` | **Unverified legacy** | Simplified effect; not the same as verified Blessing cards in the base deck |
| `treasure_silver_dagger` | `"weapon"` | **Stale duplicate** | This is a leftover simplified entry that predates the verified `item_silver_dagger`; the `item_silver_dagger` entry is authoritative |
| `item_icon_of_strahd` | `"quest"` | **Scenario prop** | Exists to serve a specific scenario objective tracker; no physical item card with this name |
| `item_gravestorms_phylactery` | `"scenario_item"` | **Scenario prop** | Custom item for the Dracolich adventure; no physical card |
| `item_feywalk_amulet` | `"quest"` | **Unverified** | Description is a simplified placeholder; no source-of-truth entry |

Items with a verified source-of-truth entry:

| JSON ID | Source-of-Truth | Verified |
|---|---|---|
| `item_silver_dagger` | `card-source-truth/items.md` | ✅ Verified |
| `item_wooden_stake` | `card-source-truth/items.md` | ✅ Verified |
| `item_torch` | `card-source-truth/items.md` | ✅ Verified |
| `item_wand_of_teleportation` | `card-source-truth/items.md` | ✅ Verified |
| `item_sunsword` | `card-source-truth/items.md` | ✅ Verified |
| `item_tome_of_strahd` | `card-source-truth/items.md` | ✅ Verified |
| `item_thieves_tools` | `card-source-truth/items.md` | ✅ Verified |

---

## Text Authority

For card text and mechanics:
- Treat manually entered card text from the user as authoritative
- Treat source-of-truth markdown files as authoritative if they were created from verified physical cards
- Do not rewrite card mechanics into "cleaner" or more generic effects unless explicitly instructed
- Do not infer missing text from similar cards
- Do not create synthetic or placeholder card text

If JSON conflicts with manually verified text, update JSON to match the verified text.

---

## Art Authority

For card art:
- Treat the verified scan directory as the authoritative source for image identity
- Treat `public/card-images/` as a deployment copy, not the source of truth
- Do not remap an image to a different card because it seems visually or semantically similar
- If no verified scan exists, leave the card unmapped or explicitly mark it pending approval

---

## Required Workflow

For any card-related edit:

1. Read the relevant source-of-truth file first
2. Read the current JSON or asset mapping second
3. Compare them explicitly
4. Check whether the JSON entry is a base item, a scenario prop, or an unverified legacy entry
5. Produce a proposed diff or mapping table
6. Wait for approval before writing any JSON or remapping any image path

If the task is an audit, remain read-only.

---

## Verification Rules

Always distinguish these states clearly:
- **verified** — text confirmed from a physical card or user input; may be written to JSON
- **derived** — computed from a verified source with explicit transformation; document the derivation
- **assumed** — inferred without a physical source; flag for review before writing
- **scenario-override** — intentionally diverges from base card rules for a specific scenario; must not overwrite the base entry
- **unresolved** — no verified source; mark clearly and stop for approval

Only **verified** or **approved derived** data may be written to canonical JSON.

---

## Forbidden Behaviors

Never do any of the following:
- invent a card
- invent missing effect text
- invent flavor text
- invent an image path
- use fuzzy matching to auto-assign art
- use "closest thematic match" without explicit approval
- overwrite manually verified source-of-truth files from JSON
- silently normalize rules text into a different mechanic
- **treat a `"type": "quest"` or `"type": "scenario_item"` JSON entry as the canonical rule for a base card**
- **merge scenario-specific behavior back into a base card definition without explicit approval**
- **use a scenario prop entry to justify a rule change to the base card**

---

## Safe Output Format

For audits, provide:
- card id
- card name
- current JSON text
- source-of-truth text status (verified / unverified legacy / scenario prop / unresolved)
- image path
- scan verified yes/no
- recommended action

For edits, provide:
- exact file changes
- why each change is valid
- whether the change came from verified text or approved remediation
- whether the entry is a base card or a scenario override

---

## Default Posture

When information is missing, incomplete, or contradictory:
- do not guess
- do not fill gaps creatively
- surface the discrepancy
- ask for approval or additional verification