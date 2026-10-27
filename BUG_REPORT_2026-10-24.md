# Ravenloft Playtest Bug Report — Sat Oct 24, 2026 (evening, desktop web build)

Branch: `feature/original-gothic-rebrand`. Repo state at report time: HEAD `dca42a41`
(log chronicle overhaul), with uncommitted changes to `README.md`,
`GAME_LOOP_FIX_LIST.md`, and `public/audio/` (13 new sound files).
Nothing in this report has been fixed — it is a record only.

## 1. Alissa's card on the adventure setup screen does not match the other cards

**Observed:** On `ScenarioSetupScreen`, Alissa's hero card looks different from the
other four heroes' cards.

**Root cause (verified in code):** The screen shows scanned board-game card
images for all five heroes (`/ui/heroes/*_card.jpg`), but Alissa is
special-cased: `isSingleSided('alissa')` is true, so her Level 1 view shows her
scan at 100% height (the others use a 200% crop/rotate of a double-sided
scan), and her Level 2 view is not a scan at all — it renders a synthetic
"Custom Card Back" panel (dark radial gradient, gold text) instead of a card
image. That panel also misspells her name "ALLISA" (data files spell her
"Alissa").

**Fix routes:** (a) supply a real 2nd-level scan of her card and remove the
special-case; (b) restyle the custom back to match the scanned cards; either
way, fix the spelling. Route (a) needs Louis — he owns the physical cards.

## 2. A diagonal divider crosses the board

**Observed:** A long straight diagonal seam runs across the play surface,
where the light floor stops and the background goes dark.

**Root cause (verified in code):** The tabletop is a finite slab, 28x28 units
(`TableSurface.tsx`). Beyond the slab there is nothing but dark background
(scene fog `#0e0a17`, page background `#050505`). The seam is the table's
edge — not a tile seam and not a dungeon bug.

**Fix directions:** bigger table, a visible floor plane under it, or fog
tuned so the edge falls off softer.

## 3. The table edge "goes up" — same item as #2, not a second bug

**Asked:** if it is the table's edge, why does it climb on screen?

**Answer:** perspective. The desktop camera sits at [5.5, 5.5, 5.5] (fov 38)
looking down at the table from a corner. The edge is horizontal in the world;
it climbs on screen because that direction is away from the camera, into the
distance. Screen-up here means farther away, not taller. The near edge of the
table is off-screen at the bottom; the visible diagonal is the far edge.

## 4. Ghost-like artifacts in the background

**Observed:** Faint shapes in the dark background around the table — a barrel,
desk/chair shapes, tall narrow shapes, tiny lights.

**What they are (verified in code):** room dressing, not glitches.
`TavernProps3D` places tavern props on the tabletop around the dungeon tiles:
barrels at (-10, -10) and (-11.2, -9.5), a desk at (11, -10), a chair at
(12.2, -9.2), an altar at (10, 11). `DungeonChamber` adds wall torches
(y = 3.2, around the walls) and hanging skeletons (±14, 2.6). They read as
ghost shapes because they sit far from the camera under dim light
(ambient 0.65, purple tint) and inside fog range (22–52 units). Note:
tavern props are hidden in VR (`TavernProps3D` returns null while presenting),
so this is a desktop-view dressing issue only.

**If the ghost look is unwanted:** brighten the dressing, move it closer to
the action, or hide it on desktop too. No fix applied.

## 5. Quick Reference (F1) modal does not match the rest of the UI

**Observed:** The F1 help modal looks plain next to the game's gothic panels.

**Confirmed — perception is correct (verified in code):** `HelpOverlay`
(`components/tutorial/TutorialSystem.tsx`) does use `.gothic-panel` (border,
shadow, stone texture), but `.help-content` has no CSS rules of its own, so
the heading, list, and button fall back to browser defaults: a sans-serif
white title instead of `.gothic-title` (Cinzel, gold, letter-spaced), default
disc bullets, and a flat gray button instead of `.gothic-button`.

**Fix:** style the modal's elements with the theme classes (gothic-title on
the heading, gothic-button on the button, themed list). No fix applied.

## 6. The Ghoul renders as a Warrior model

**Observed:** In-game, the Ghoul appears as an armored warrior figure.

**Root cause (verified in code):** The mapping is correct and the model
exists — `monster_ghoul` maps to `/models/ghoul.glb`, and the file is in
`public/models/`. But `Monster3D.tsx` (line 364) resolves the model with
`getMonsterModelPath(monster.monsterType)`, not the monster's id. The
Ghoul's `monsterType` is `"Undead"` — a creature category, not an id — and
no map key matches it, so resolution falls through to `MONSTER_GENERIC`,
which is `/models/knight.glb`: an armored knight, i.e. the "Warrior" seen
in-game. There is no `warrior.glb` file anywhere in the project.

**Likely broader than the Ghoul:** every monster's `monsterType` is a
category (`Undead`, `Animal`, `Reptile`, `Elemental`, `Giant`, …), none of
which match the `monster_*` map keys — so the same fallback probably applies
to all monsters. Suggested check before fixing: confirm whether skeletons
and zombies also render as knights.

**Fix:** pass the monster's id (not `monsterType`) to `getMonsterModelPath`
in `Monster3D`, or add category mappings. No fix applied — a real ghoul
model is NOT needed; the existing `ghoul.glb` should render once the lookup
key is fixed.

**Update (evening, Oct 24): FIXED in commit `c39bb4ef`.**
`Monster3D.tsx` now resolves by
`monster.templateId || monster.id || monster.name || monster.monsterType`.
All 41 monsters with authentic models now render their real sculpts, and the
"everything is a knight" suspicion is confirmed — all 61 monsters had been
falling back. Only 20 monsters still fall back to the knight, because they
have no dedicated `.glb`: Dread Warrior, Tomb Guardian, Battle Wight,
Wererat, Dread Howler (Vargouille), Rune-forged Thrall, Skull-rune Ember
Haunt (Flameskull), Direguard, Great Skull-rune Ember Haunt, Spirit
Devourer, Ocular Lich (Beholder Lich), Death Knight, Succubus, Drowned
Elemental (Bone Naga), Rat Swarm, Gloomwraith (Bodak), Insect Swarm,
Skull-rune Demon (Boneclaw), Larva Mage, Nightwalker. Also confirmed:
tokens (coffins, traps, chests, items, surges, markers) are procedural
geometry, not `.glb` (correct as-is); the D20 and dungeon tiles are
procedural too; unmapped heroes fall back to `arjhan.glb`.

## 7. Open rules question: encounter card after every hero's end turn?

**Asked:** are we supposed to draw an encounter card after every hero's end
turn?

**Board-game rule:** No — not after every end turn unconditionally. In
Castle Ravenloft you draw an Encounter card (a) when you explore a tile with
a black triangle, and (b) at the end of your turn **only if you did not
explore that turn**. A hero who explored draws no end-of-turn encounter card
(they may already have drawn one from the tile).

**Game code status:** the explore-path draw is verified (`coreSlice.ts`
draws on tile placement when the tile calls for it). Whether the game draws
an end-of-turn encounter card when a hero does not explore was NOT verified
— the end-of-turn code path was only partially inspected. This needs a code
check of the `storeEndTurn` tail before it can be called a bug or correct.

---

*Also tracked in `GAME_LOOP_FIX_LIST.md` (items 5–7: Alissa card, table edge,
F1 modal). Ghoul model and the encounter-card question live in this report
only, pending Louis's direction.*
