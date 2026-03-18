# Castle Ravenloft Board Game - Physical Components Asset Tracking

This document tracks the conversion of physical board game components to digital game assets.

## Implementation Status Key
- [x] **Fully Implemented** - Complete implementation with working assets
- [~] **Partially Implemented** - Core logic exists, assets may be placeholders or incomplete
- [ ] **Not Implemented** - No implementation exists
- [?] **Needs Verification** - Implementation exists but needs testing

---

## Card Components

### Monster Cards
| Card Name | Status | Data File | Notes |
|-----------|--------|-----------|-------|
| Gargoyle | [~] | `src/data/cards/monsters.json` | Card data exists, 3D model placeholder |
| Goblin | [~] | `src/data/cards/monsters.json` | Card data exists, 3D model placeholder |
| Zombie | [~] | `src/data/cards/monsters.json` | Card data exists, 3D model placeholder |
| Skeleton | [~] | `src/data/cards/monsters.json` | Card data exists, 3D model placeholder |
| Wolf | [~] | `src/data/cards/monsters.json` | Card data exists, 3D model placeholder |
| Ghoul | [~] | `src/data/monsters.json` | Monster data exists, card data may need verification |
| Ghost | [~] | `src/data/monsters.json` | Monster data exists, card data may need verification |
| Vampire | [~] | `src/data/monsters.json` | Monster data exists, card data may need verification |
| Strahd (Villain) | [~] | `src/data/monsters.json` | Boss behavior exists, card data may need verification |
| Flesh Golem | [~] | `src/data/monsters.json` | Monster data exists, card data may need verification |
| Kobold Sorcerer | [~] | `src/data/monsters.json` | Monster data exists, card data may need verification |
| Howling Hag | [~] | `src/data/monsters.json` | Monster data exists, card data may need verification |
| Young Vampire | [~] | `src/data/monsters.json` | Monster data exists, card data may need verification |
| Zombie Dragon | [~] | `src/data/monsters.json` | Monster data exists, card data may need verification |
| Dragolich | [~] | `src/data/monsters.json` | Monster data exists, card data may need verification |

**Summary:** Monster data exists in JSON files, but full card deck implementation needs verification. AI behaviors implemented for many monster types.

### Encounter Cards
| Card Name | Status | Data File | Notes |
|-----------|--------|-----------|-------|
| Arrow Trap | [~] | `src/data/cards/encounters.json` | Basic trap implementation |
| Choking Fog | [~] | `src/data/cards/encounters.json` | Basic encounter implementation |
| Environment Cards | [?] | - | Need verification of implementation |
| Event Cards | [?] | - | Need verification of implementation |
| Trap Cards (various) | [?] | - | Need verification of implementation |

**Summary:** Only 2 encounter cards currently defined. Full encounter deck (30+ cards) needs implementation.

### Treasure Cards
| Card Name | Status | Data File | Notes |
|-----------|--------|-----------|-------|
| Healing Potion | [~] | `src/data/cards/treasures.json` | Basic item implementation |
| Icon of Ravenloft | [~] | `src/data/cards/treasures.json` | Item implementation exists |
| Heavy Shield | [~] | `src/data/cards/items.json` | Item with AC bonus |
| Boots of Speed | [~] | `src/data/cards/items.json` | Item with speed bonus |

**Summary:** Only 4 treasure items defined. Full treasure deck (30+ cards) needs implementation. Blessings and Fortunes types not implemented.

### Hero Cards
| Hero Name | Status | Data File | Notes |
|-----------|--------|-----------|-------|
| Arjhan (Dragonborn Paladin) | [~] | `src/data/heroes.json` | Full hero stats, abilities defined |
| Immeril (Eladrin Wizard) | [~] | `src/data/heroes.json` | Full hero stats, abilities defined |
| Kat (Human Rogue) | [~] | `src/data/heroes.json` | Full hero stats, abilities defined |
| Thorgrim (Dwarf Cleric) | [~] | `src/data/heroes.json` | Full hero stats, abilities defined |
| Vani (Human Ranger) | [~] | `src/data/heroes.json` | Full hero stats, abilities defined |

**Summary:** All 5 starting heroes implemented with stats and abilities.

### Power Cards (Hero Abilities)
| Hero | Power 1 | Power 2 | Status |
|------|---------|---------|--------|
| Arjhan | Valiant Strike | Lay on Hands | [~] Both defined in `src/data/cards/hero-abilities/arjhan.json` |
| Immeril | - | - | [~] Defined in `src/data/cards/hero-abilities/immeril.json` |
| Kat | - | - | [~] Defined in `src/data/cards/hero-abilities/kat.json` |
| Thorgrim | - | - | [~] Defined in `src/data/cards/hero-abilities/thorgrim.json` |
| Vani | - | - | [~] Defined in `src/data/cards/hero-abilities/vani.json` |

**Summary:** Hero ability files exist for all heroes, but Daily/At-Will/Utility power types not fully implemented.

---

## Board Components

### Dungeon Tiles
| Tile Name | Status | Data File | Notes |
|-----------|--------|-----------|-------|
| Start Tile | [~] | `src/data/tiles.json` | Basic tile implementation |
| Stone Corridor | [~] | `src/data/tiles.json` | Basic tile implementation |
| Vaulted Crossroads | [~] | `src/data/tiles.json` | Basic tile implementation |
| Named Rooms | [?] | - | Need verification |
| Quest Tiles | [?] | - | Need verification |

**Summary:** Basic tile system exists, but full tile deck (40+ tiles) needs implementation. Bone pile locations, danger level indicators, special features not fully implemented.

---

## Figure Components

### Hero Figures (3D Models)
| Hero | Model Path | Status | Notes |
|------|------------|--------|-------|
| Paladin (Arjhan) | `/models/heroes/paladin.glb` | [~] | Defined in `src/utils/modelLoader.ts`, DUMMY_MODE=true |
| Wizard (Immeril) | `/models/heroes/wizard.glb` | [~] | Defined in `src/utils/modelLoader.ts`, DUMMY_MODE=true |
| Rogue (Kat) | `/models/heroes/rogue.glb` | [~] | Defined in `src/utils/modelLoader.ts`, DUMMY_MODE=true |
| Cleric (Thorgrim) | `/models/heroes/cleric.glb` | [~] | Defined in `src/utils/modelLoader.ts`, DUMMY_MODE=true |
| Ranger (Vani) | `/models/heroes/ranger.glb` | [~] | Defined in `src/utils/modelLoader.ts`, DUMMY_MODE=true |

**Summary:** Model paths defined, but no actual GLB files exist. DUMMY_MODE returns empty Group, components use procedural fallbacks.

### Monster Figures (3D Models)
| Monster | Model Path | Status | Notes |
|---------|------------|--------|-------|
| Gargoyle | `/models/monsters/gargoyle.glb` | [~] | Defined, DUMMY_MODE=true |
| Goblin | `/models/monsters/goblin.glb` | [~] | Defined, DUMMY_MODE=true |
| Zombie | `/models/monsters/zombie.glb` | [~] | Defined, DUMMY_MODE=true |
| Skeleton | `/models/monsters/skeleton.glb` | [~] | Defined, DUMMY_MODE=true |
| Wolf | `/models/monsters/wolf.glb` | [~] | Defined, DUMMY_MODE=true |

**Summary:** Model paths defined for 5 monsters, but no actual GLB files exist. Other monsters need model paths defined.

### Villain Figures (3D Models)
| Villain | Model Path | Status | Notes |
|---------|------------|--------|-------|
| Strahd | - | [ ] | Not defined in modelLoader |

**Summary:** Villain 3D model not implemented.

---

## Token Components

### Healing Surge Tokens
| Status | Implementation | Notes |
|--------|----------------|-------|
| [~] | `src/store/gameStore.ts` (healingSurges) | Counter exists, visual token not implemented |

### Hit Point Tokens
| Status | Implementation | Notes |
|--------|----------------|-------|
| [~] | `src/game/types.ts` (Entity.hp) | HP tracking exists, visual tokens not implemented |

### Condition Markers
| Condition | Status | Implementation | Notes |
|-----------|--------|----------------|-------|
| Slowed | [ ] | - | Not implemented |
| Immobilized | [ ] | - | Not implemented |

**Summary:** Token images exist in `game_texts/Ravenloft_Tokens/` but not integrated into game.

### Experience Pile
| Status | Implementation | Notes |
|--------|----------------|-------|
| [~] | `src/game/types.ts` (Hero.xp) | XP tracking exists, pile visualization not implemented |

### Item Tokens
| Item | Status | Notes |
|------|--------|-------|
| Icon of Ravenloft | [~] | Defined as treasure card |
| Holy Water | [?] | Token exists in Ravenloft_Tokens |
| Wooden Stake | [?] | Token exists in Ravenloft_Tokens |
| Dimensional Shackles | [?] | Token exists in Ravenloft_Tokens |
| Feywalk Amulet | [?] | Token exists in Ravenloft_Tokens |
| Mirror | [?] | Token exists in Ravenloft_Tokens |
| Portrait | [?] | Token exists in Ravenloft_Tokens |
| Skull | [?] | Token exists in Ravenloft_Tokens |
| Torch | [?] | Token exists in Ravenloft_Tokens |
| Food | [?] | Token exists in Ravenloft_Tokens |
| Animal | [?] | Token exists in Ravenloft_Tokens |
| Silver Dagger | [?] | Token exists in Ravenloft_Tokens |
| Gravestorm's Phylactery | [?] | Token exists in Ravenloft_Tokens |
| Kavan | [?] | Token exists in Ravenloft_Tokens |

**Summary:** Item token images exist but not integrated into game.

### Adventure Tokens
| Token | Status | Notes |
|-------|--------|-------|
| Adventure Token | [?] | Token exists in Ravenloft_Tokens |

---

## Dice Components

### d20 Die
| Status | Implementation | Notes |
|--------|----------------|-------|
| [~] | `src/components/3d/Dice3D.tsx` | 3D dice component exists, model placeholder |

**Summary:** 3D dice component exists but uses placeholder model.

---

## Audio Components

### Music Tracks
| Track | Status | Audio File | Notes |
|-------|--------|------------|-------|
| Main Theme | [~] | `/audio/music/main_theme.mp3` | Defined in `src/data/audioManifest.json`, DUMMY_MODE=true |
| Boss Theme | [~] | `/audio/music/boss_theme.mp3` | Defined in `src/data/audioManifest.json`, DUMMY_MODE=true |

**Summary:** Music tracks defined but no actual audio files exist. DUMMY_MODE logs to console instead of playing.

### Sound Effects
| SFX | Status | Audio File | Notes |
|-----|--------|------------|-------|
| Tile Place | [~] | `/audio/sfx/tile_place.mp3` | Defined, DUMMY_MODE=true |
| Dice Roll | [~] | `/audio/sfx/dice_roll.mp3` | Defined, DUMMY_MODE=true |
| Card Draw | [~] | `/audio/sfx/card_draw.mp3` | Defined, DUMMY_MODE=true |
| Card Play | [~] | `/audio/sfx/card_play.mp3` | Defined, DUMMY_MODE=true |
| Monster Die | [~] | `/audio/sfx/monster_die.mp3` | Defined, DUMMY_MODE=true |
| Hero Hurt | [~] | `/audio/sfx/hero_hurt.mp3` | Defined, DUMMY_MODE=true |
| Sword Hit | [~] | `/audio/sfx/sword_hit.mp3` | Defined, DUMMY_MODE=true |
| Spell Cast | [~] | `/audio/sfx/spell_cast.mp3` | Defined, DUMMY_MODE=true |
| Click | [~] | `/audio/sfx/click.mp3` | Defined, DUMMY_MODE=true |
| Hover | [~] | `/audio/sfx/hover.mp3` | Defined, DUMMY_MODE=true |

**Summary:** All SFX defined but no actual audio files exist. DUMMY_MODE logs to console instead of playing.

### Ambient Sounds
| Ambient | Status | Audio File | Notes |
|---------|--------|------------|-------|
| Dungeon Loop | [~] | `/audio/ambient/dungeon_loop.mp3` | Defined, DUMMY_MODE=true |

**Summary:** Ambient sounds defined but no actual audio files exist.

---

## UI Components

### UI Assets
| Asset | Status | File | Notes |
|-------|--------|------|-------|
| Main Menu Background | [x] | `public/ui/main_menu_bg.png` | Exists and in use |
| Gothic Panel Style | [x] | CSS in `src/index.css` | Implemented |
| Card UI | [~] | `src/components/3d/Card3D.tsx` | 3D card component exists |
| Hero Panel | [~] | `src/components/ui/HeroPanel.tsx` | UI component exists |
| Combat Log | [~] | `src/components/ui/CombatLog.tsx` | UI component exists |

**Summary:** Basic UI exists but needs more visual assets.

---

## Scenario Components

### Scenarios
| Scenario | Status | Data File | Notes |
|----------|--------|-----------|-------|
| Find the Icon of Ravenloft | [~] | `src/data/scenarios/scenario1.json` | Basic implementation |
| Reset the Beacon | [~] | `src/data/scenarios/scenario2.json` | Basic implementation |
| Scenario 3 | [?] | `src/data/scenarios/scenario3.json` | Needs verification |
| Scenario 4 | [?] | `src/data/scenarios/scenario4.json` | Needs verification |
| Scenario 5 | [?] | `src/data/scenarios/scenario5.json` | Needs verification |

**Summary:** 5 scenario files exist, implementation status needs verification.

---

## Summary Statistics

### Cards
- **Monster Cards:** ~15 defined (partial implementation)
- **Encounter Cards:** ~2 defined out of ~30 total
- **Treasure Cards:** ~4 defined out of ~30 total
- **Hero Cards:** 5/5 implemented
- **Power Cards:** Files exist for all heroes

### Board Components
- **Dungeon Tiles:** ~3 defined out of ~40 total

### Figures
- **Hero Figures:** 5/5 model paths defined (no actual models)
- **Monster Figures:** 5/15 model paths defined (no actual models)
- **Villain Figures:** 0/1 implemented

### Tokens
- **Healing Surge:** Logic exists, no visual token
- **HP Tokens:** Logic exists, no visual tokens
- **Condition Markers:** Not implemented
- **Item Tokens:** Images exist but not integrated
- **Adventure Tokens:** Images exist but not integrated

### Audio
- **Music:** 2/2 defined (no actual files)
- **SFX:** 10/10 defined (no actual files)
- **Ambient:** 1/1 defined (no actual files)

### Scenarios
- **Scenarios:** 5/5 files exist (implementation needs verification)

---

## Priority Recommendations

### High Priority
1. **Implement full encounter deck** - Critical for gameplay
2. **Implement full treasure deck** - Critical for gameplay
3. **Add condition markers (Slowed, Immobilized)** - Core mechanic
4. **Implement Daily/At-Will/Utility power types** - Core mechanic

### Medium Priority
5. **Add 3D models for heroes and monsters** - Visual polish
6. **Add audio files** - Audio polish
7. **Implement visual tokens** - UI polish
8. **Verify scenario implementations** - Ensure gameplay works

### Low Priority
9. **Add remaining monster models** - Visual polish
10. **Add villain 3D model** - Visual polish

---

## Notes

- **DUMMY_MODE:** Currently set to `true` in `src/utils/modelLoader.ts`, causing all 3D models and audio to return placeholders
- **Token Images:** Located in `game_texts/Ravenloft_Tokens/` but not integrated into game code
- **Card List PDF:** `game_texts/Castle_Ravenloft_Card_List_v1.0.pdf` contains full card lists for reference
- **Asset Paths:** All asset paths are defined but actual files don't exist in `public/` directory
