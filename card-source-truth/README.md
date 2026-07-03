Card Source of Truth Schema Guide
This directory is the authoritative source of truth for verified Castle Ravenloft card content used by this project. Any card text, hero text, power text, flavor text, image identity, or rules text that has been manually verified from the physical game or trusted scans must be stored here first.

Downstream files such as src/data/cards/*.json, image mappings, and public asset references are derived artifacts. They must be updated to match the files in this directory. They are not the canonical source of truth.

Purpose
The purpose of this directory is to prevent drift, invented rules, fake cards, fuzzy image remaps, and accidental overwrites of verified game content. This directory exists so that all future agent sessions and manual edits have one clear content authority.

Authority Order
When multiple sources disagree, use this order of authority:

Physical Castle Ravenloft cards verified by the user

Manually verified content stored in this card-source-truth/ directory

Trusted scanned card art or text placed in this directory

Existing structured data files such as src/data/cards/*.json

Public-facing asset copies such as public/card-images/*

Current in-app behavior or placeholder content

Lower-priority layers must be updated to match higher-priority layers. Higher-priority layers must never be rewritten to match lower-priority derived data without explicit approval.

Edit Rule
All content corrections begin here.

If a card, hero, power, treasure, encounter, or image mapping is changed, verified, corrected, or backfilled, update the relevant file in card-source-truth/ first. Only after that should the corresponding JSON, public asset paths, or in-app data be changed.

Required Workflow
For any content-related task:

Read the relevant file in card-source-truth/ first.

Compare it against the downstream JSON or asset mapping.

Identify any mismatch explicitly.

Produce a proposed diff or mapping table when changes are needed.

Wait for approval before modifying derived files.

If information is missing or unverified, mark it as unresolved or pending verification. Do not invent or infer missing rules text.

Forbidden Behaviors
The following are not allowed unless the user explicitly requests them:

Inventing card text, mechanics, flavor text, or names

Creating fake cards to fill gaps

Using fuzzy matching to assign card art automatically

Using a “closest thematic match” without explicit approval

Treating JSON as authoritative when it conflicts with verified source text

Overwriting this directory from downstream data files

Quietly normalizing rules text into a different mechanic

File Structure Standard
Each file in this directory should follow a consistent human-readable record format.

Required file sections
Each source-of-truth file should include:

A top-level title

A short description explaining what the file contains

A main content section

One record per entity

A consistent separator between records

Record format
Use this general pattern for records:

text
**ENTITY NAME**
* **Field Name:** Value
* **Field Name:** Value
* **Field Name:** Value

---
This format is preferred because it is both easy for humans to audit against physical cards and stable enough for agents to parse consistently.

Schema Principles
The schema is intentionally markdown-first, not JSON-first.

That means:

Preserve verbatim physical wording where possible

Use stable field labels

Keep one entity per record

Keep records readable enough for visual comparison to the physical card

Add structure only where it helps verification and downstream derivation

Standard Record Rules
Apply these rules across all source-of-truth files:

Entity names should be uppercase when that improves visual scanning, matching the existing heroes.md convention

Each property should be a single bullet line using * **Field Name:** Value

Repeated sections such as levels should use fixed labels like 1st Level Stats, 2nd Level Stats, 1st Level Special Ability, and so on

Separate records with ---

Keep wording verbatim unless a field is explicitly marked as normalized or derived

If a field is not yet verified, mark it clearly rather than guessing

Recommended Metadata Header
At the top of each file, include lightweight metadata in prose or bullets when useful. Recommended fields:

Source

Verification status

Last verified date

Derived targets

Notes

Example:

text
# Heroes Source of Truth

This file contains the verbatim text transcribed from the physical Hero cards. Any changes or updates should be made here first, and then propagated to the game data files.

- Source: Physical Castle Ravenloft hero cards
- Verification status: Verified
- Derived targets: hero data files, in-app hero definitions
Entity-Specific Field Guidance
Different files can use different field sets, but should preserve the same record grammar.

Heroes
Recommended fields:

Hero Class/Race

Flavor Text

1st Level Stats

1st Level Special Ability

1st Level Powers

2nd Level Stats

2nd Level Special Ability

2nd Level Level Up Rule

2nd Level Critical Hit or other additional ability

Treasures
Recommended fields:

Treasure Type

Flavor Text

Rules Text

Usage or Timing

Image Filename

Verification Status

Notes

Encounters
Recommended fields:

Encounter Type

Flavor Text

Rules Text

Trigger or Timing

Ongoing Effect

Verification Status

Powers
Recommended fields:

Hero Class

Power Type

Action Type

Range

Attack Bonus

Hit

Miss

Effect

Special

Level

Monsters or Villains
Recommended fields:

Monster Type

AC

HP

Speed

Attack

Damage

Tactics or Card Text

Triggered Effects

Verification Status

Verification States
When content is not fully settled, use explicit verification labels. Recommended values:

Verified

Partially Verified

Pending Scan

Pending Transcription

Legacy Unverified

Approved Derived Mapping

Never leave uncertainty implicit.

Derived Data Policy
Files outside this directory may be generated or synchronized from this content, but they should never be treated as more authoritative than this directory.

If a downstream file differs from the source-of-truth content:

assume the downstream file is wrong or stale first

verify against the physical card or verified source file

update the downstream file after approval

Review Standard
Any agent or human making card-related changes should be able to answer these questions:

What exact source-of-truth file was used?

Was the text verified from the physical card or a trusted scan?

Was any field inferred rather than verified?

Which downstream files need to be updated?

Was a diff shown before write operations?

If those questions cannot be answered clearly, the content is not ready to be treated as canonical.

Default Posture
When uncertain, stop and mark the gap.

This directory exists to preserve fidelity to the real Castle Ravenloft game. It is better to leave a field unresolved than to let an agent silently invent content that appears authoritative.