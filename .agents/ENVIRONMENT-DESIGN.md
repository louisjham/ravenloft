# Environment design notes — board atmosphere and status effects (sketch)

Design sketch, Oct 25, 2026. Not a build prompt and not a tracker item:
no gameplay or rule changes, no new assets assumed. It records how
environment cards, encounter cards, and status effects could show up on
the virtual game board area only — not the whole VR/AR environment.

Grounding (verified in code Oct 25, 2026):
- The trigger already exists: `gameState.activeEnvironmentCard` is set by
  EncounterSystem when an environment activates, with a getter for it.
  Nothing visual reads it yet.
- Scene fog, stars, and mist motes are disabled in AR passthrough
  (desktop/VR only), so board-local effects are the approach that
  survives passthrough. In AR the room cannot be darkened; what changes
  is what sits on and just above the table (48-unit table, 4-unit tiles).
- Status today shows only as 2D chips in the hero panel
  (ConditionMarkers, emoji glyphs plus turns-remaining badge, red at
  1 turn left). Monsters show nothing, and no 3D figure shows anything.
- Related: spatial audio is a follow-on to Fix Tracker item 5, not part
  of this sketch (helper `src/audio/SpatialAudio.ts` exists, zero call
  sites).

## Environment board presets

One preset per active environment card. It lasts while the card is the
active environment, crossfades out (never snaps) when a new environment
replaces it, and reverts to the default gothic look on discard. All
presets are parameter changes — light color/intensity, mist density,
particle emission — not new geometry or shadow-casting lights, so they
stay inside the Quest budget. Pooled particles; particles dropped on
low graphics quality with rings/tints kept.

- **Bat Swarm** (ranged attacks roll twice, take lower — sight blocked):
  dark bat particles swarming above the board, board lights dimmed a
  notch. The swarm is the sight-block made visible.
- **Blood Fog** (natural 17+ deals +1 damage): low red fog hugging the
  board, board lights warmed red.
- **Cackling Skull** (using a Daily or Utility power costs 1 damage):
  a crystal skull prop hovering over board center, bobbing, pulsing
  purple. The tax has a face, so it is remembered before a power is
  spent.
- **Crippling Miasma** (heroes' Speed -1; the code applies slowed under
  this card): sickly green-yellow miasma lying low over the board, plus
  every hero showing the slowed treatment below. Two layers telling the
  same story.
- **Deadly Shadows** (ending a turn sharing a tile costs 1 damage):
  board lights dim, shadows deepen, and any tile holding two or more
  heroes gets a dark shadow pool under those figures. The danger is
  painted exactly where it lives.
- **Haunted Mists** (undead get +2 attack): pale cold mist, cold blue
  board tint, undead figures rimmed with cold light.
- **Music of the Damned** (monster placement draws two, keeps the higher
  XP one): drifting note particles, deep purple and gold tint. Pure
  mood — the rule itself needs no board marker.
- **Spirit of Doom** (discarding a treasure costs 1 damage): grey pall
  over the board, a grim specter figure hovering at the board's edge,
  slow wisps drifting. The specter is the reminder before a discard.

## Encounter flourishes (transient, not persistent)

Encounter cards resolve and discard, so they do not change board state.
They get a short flourish on resolution, seconds long, then gone: a
pulse or particle burst over the affected tile, a trap marker where a
trap is placed, a monster figure where one spawns. Card reveal and lore
stay manual (Demeo model: automate resolution, keep ceremony manual);
atmosphere reacts automatically around it.

## Status effects on figures

Principle: keep the 2D chips (they carry the exact type and turns
remaining) and add a 3D treatment on the figure itself, so status reads
at a glance in VR/AR without reading text. Same system for heroes and
monsters, same glyphs as the chips so 2D and 3D agree. Turns remaining
mirrors the chip rule: the ring reddens at 1 turn left; permanent
conditions (turns -1) get a steady, non-pulsing treatment. Icons
billboard to always face the camera, which matters in AR.

- **Stunned:** circling stars above the head, slight dizzy sway.
- **Blinded:** dark visor band over the eyes, dimmed halo.
- **Dazed:** single swirl plus a wobble — deliberately lighter than
  stunned so the two do not blur together.
- **Poisoned:** green bubbles rising, green tint on the figure.
- **Slowed:** blue-grey base ring, idle animation slowed only
  (cosmetic — no rule or timing change), turtle glyph.
- **Immobilized:** chain ring around the base, figure locked upright.
- **Weakened:** figure desaturated and dimmed, down-arrow glyph.
- **Marked:** bright pulsing target ring plus an outline, so an
  attacker spots it instantly.
- **Pushed:** instant effect, so no persistent visual — just a brief
  arrow trail on the push itself.
- **Prone:** figure laid flat on its tile.
- **Mummy rot:** brown-green rot particles, bandaged tint.

Stacking: the floating icon row above the head shows every condition
(mirroring the chips), while the base ring shows one priority color.
Suggested priority — stunned, then immobilized, then poisoned, then
the rest — but that order is a design call, not settled here.

Guardrails: pooled particles, one ring per figure, nothing that hides
the figure or its tile, particles dropped on low graphics quality with
rings kept. Board mist needs its own small volume: the current scene
fog runs at 22–52 units, which is scene scale, not board scale.
