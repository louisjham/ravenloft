---
name: castle-ravenloft-source-of-truth
description: Enforces source-of-truth rules for Castle Ravenloft card text, card art, JSON data, and verification workflows. Prevents invented card behavior, fake cards, fuzzy matching, and unverified asset remaps.
---
# Castle Ravenloft Source of Truth

Canonical Content Root
All verified Castle Ravenloft card text and card art for this project live under C:\antigravity\ravenloft\card-source-truth.
This directory is the authoritative root for card-related tasks.
JSON files, app asset folders, and current in-app values must be updated to match this directory, not the reverse.

Legacy Content Rule
If a card exists in src/data/cards/*.json but has no matching verified entry in card-source-truth, mark it as unverified legacy content. Do not invent missing text. Do not preserve it as canon without approval. Do not synthesize replacement text from similar cards.



Use this skill for any task involving cards, treasures, encounters, powers, card JSON, image mapping, card scans, source-of-truth files, or any gameplay content derived from the physical game.

## Primary Rule

Do not invent card text, mechanics, card names, image mappings, placeholders, or replacement cards.

If a card cannot be verified from a trusted source, mark it unresolved and stop for approval.

## Source Hierarchy

Use this exact order of authority:

1. Physical Castle Ravenloft card text verified by the user
2. Manually entered source-of-truth files created from physical cards
3. Scanned card art in the verified scan directory
4. Existing structured data files such as `src/data/cards/*.json`
5. Public-facing copied assets such as `public/card-images/*`

Lower layers must be updated to match higher layers.
Higher layers must never be overwritten to match lower layers.

## Text Authority

For card text and mechanics:
- Treat manually entered card text from the user as authoritative
- Treat source-of-truth markdown or text files as authoritative if they were created from verified physical cards
- Do not rewrite card mechanics into “cleaner” or more generic effects unless explicitly instructed
- Do not infer missing text from similar cards
- Do not create synthetic or placeholder card text

If JSON conflicts with manually verified text, update JSON to match the verified text.

## Art Authority

For card art:
- Treat the verified scan directory as the authoritative source for image identity
- Treat `public/card-images/` as a deployment copy, not the source of truth
- Do not remap an image to a different card because it seems visually or semantically similar
- If no verified scan exists, leave the card unmapped or explicitly mark it pending approval

## Required Workflow

For any card-related edit:

1. Read the relevant source-of-truth file first
2. Read the current JSON or asset mapping second
3. Compare them explicitly
4. Produce a proposed diff or mapping table
5. Wait for approval before writing any JSON or remapping any image path

If the task is an audit, remain read-only.

## Verification Rules

Always distinguish these states clearly:
- verified
- derived
- assumed
- unresolved

Only verified or approved derived data may be written to canonical JSON.

## Forbidden Behaviors

Never do any of the following:
- invent a card
- invent missing effect text
- invent flavor text
- invent an image path
- use fuzzy matching to auto-assign art
- use “closest thematic match” without explicit approval
- overwrite manually verified source-of-truth files from JSON
- silently normalize rules text into a different mechanic

## Safe Output Format

For audits, provide:
- card id
- card name
- current JSON text
- source-of-truth text status
- image path
- scan verified yes/no
- recommended action

For edits, provide:
- exact file changes
- why each change is valid
- whether the change came from verified text or approved remediation

## Default Posture

When information is missing, incomplete, or contradictory:
- do not guess
- do not fill gaps creatively
- surface the discrepancy
- ask for approval or additional verification