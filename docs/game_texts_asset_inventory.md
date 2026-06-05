# Game Texts Asset Inventory

## Overview
This document provides a comprehensive inventory of all assets in the `game_texts` directory, categorizing them by type and identifying potential uses for enhancing the Castle Ravenloft digital game.

---

## 1. Rule Documents & References

### Official Game Rules
| File | Type | Description | Potential Use |
|------|------|-------------|---------------|
| `Castle Ravenloft Board Game Rules.pdf` | PDF | Official board game rulebook | Reference for implementing game mechanics, validate current implementation |
| `Castle_Ravenloft_Revised.doc` | DOC | Revised/house rules document | Alternative rule variants, community improvements |
| `Castle_Ravenloft_Advanced_Rules.doc` | DOC | Advanced gameplay rules | Implement advanced mode, difficulty settings |
| `Ravenloft_Rules_Summary.pdf` | PDF | Quick reference rules summary | In-game help system, tutorial content |
| `Village_Combat_-_Ravenloft.pdf` | PDF | Village combat expansion rules | New game mode implementation |

### Expansion Content
| File | Type | Description | Potential Use |
|------|------|-------------|---------------|
| `Raven-s_Heroes_Expansion.pdf` | PDF | Heroes expansion content | Additional hero characters, abilities |
| `ravenloft_adv3_intro-converted.pdf` | PDF | Adventure 3 introduction | New scenario/adventure content |

---

## 2. Card & Deck Resources

### Card Lists & Decks
| File | Type | Description | Potential Use |
|------|------|-------------|---------------|
| `Castle_Ravenloft_Card_List_v1.0.pdf` | PDF | Complete card inventory | Validate card data, ensure completeness |
| `CR_DECK_2.pdf` | PDF | Secondary deck content | Additional card implementations |
| `CR-RoomEventDeck-v1.pdf` | PDF | Room/Event deck cards | Event system enhancement |
| `CR-RoomEventDeck-v1.rar` | RAR | Compressed room/event deck | Extractable card images |

### Spell Cards (Calavid Expansion)
**Directory:** `Calavid_-_RavenloftSpells_ActualSize/`

Contains 27 high-quality spell card images:
- **Spell Cards (13):** Acid Arrow, Armor of Agathys, Chain Lightning, Compulsion, Cone of Cold, Dawn, Forcecage, Invisibility, Mind Spike, Negative Energy Flood, Polymorph, Shatter, Sickening Radiance, Thorn Whip, True Strike, Vampiric Touch
- **Encounter Cards (5):** Hag Casts, Klak Casts, Spell Strike, Strahd Casts, Encounter-back
- **Treasure Cards (2):** Unidentified Scroll, Treasure-back
- **Token Cards (3):** Acid Arrow x1, Armor of Agathys x1, Invisibility x1
- **Marker:** Forcecage marker

**Potential Uses:**
- Implement spell casting system for villains
- Add spell scrolls as treasure items
- Create visual spell effects
- Enhance villain AI with spell abilities
- Add spell tokens to game board

---

## 3. Monster Resources

### Monster Manuals
| File | Type | Description | Potential Use |
|------|------|-------------|---------------|
| `Chromaticdragons_Monster_Manual (1).pdf` | PDF | Monster stats & abilities (Part 1) | Monster AI behaviors, stats validation |
| `Chromaticdragons_Monster_Manual_part_2.pdf` | PDF | Monster stats & abilities (Part 2) | Additional monster implementations |
| `Chromaticdragons_Monster_Manual_part_3 (1).pdf` | PDF | Monster stats & abilities (Part 3) | Extended monster roster |
| `Chromaticdragons_Monster_Manual_Villains (2).pdf` | PDF | Villain/boss monster details | Boss fight mechanics, special abilities |
| `Chromaticdragons_Monster_Manual_Villains.pdf` | PDF | Villain monster details (alt) | Boss AI patterns |

### Monster Tokens
| File | Type | Description | Potential Use |
|------|------|-------------|---------------|
| `Chromaticdragons_Monster_Tokens2.pdf` | PDF | Monster token images (Set 1) | 2D sprite fallbacks, UI elements |
| `Chromaticdragons_Monster_Tokens_pt2.pdf` | PDF | Monster token images (Set 2) | Additional monster visuals |
| `Chromaticdragons_Monster_Tokens_pt3.pdf` | PDF | Monster token images (Set 3) | Complete monster roster |

### Monster Database
| File | Type | Description | Potential Use |
|------|------|-------------|---------------|
| `Monster_List.xlsx` | XLSX | **Comprehensive monster database** with 115 entries | **Critical resource** - Contains monster names, levels, types, products, and wiki links for all D&D Adventure System monsters |

**Monster List Contents:**
- 115 unique monsters across multiple expansions
- Organized by: Name, Level (1-6), Type, Product Code, Wiki URL
- Types include: Aberrant, Animal, Construct, Devil, Drow, Elemental, Fey, Goblin, Human, Reptile, Undead, Villain, etc.
- Covers monsters from: CR (Castle Ravenloft), LoD (Legend of Drizzt), WoA (Wrath of Ashardalon), ToA (Tomb of Annihilation), DoMM (Dungeon of the Mad Mage), ToEE (Temple of Elemental Evil)

**Key Uses:**
- Validate current monster implementations
- Identify missing monsters for future content
- Cross-reference monster abilities and behaviors
- Plan monster variety for scenarios
- Implement monster progression system

---

## 4. Tile System Resources

### TileSystem Application
**Directory:** `TileSystem/` and `TileSystem (1)/`

| File | Type | Description | Potential Use |
|------|------|-------------|---------------|
| `TileSystem.exe` | EXE | Map editor application | Reference for tile placement logic |
| `TileSystem.zip` | ZIP | Complete application package | Distribution/backup |
| `help.txt` | TXT | **593-line comprehensive manual** | Tile system implementation guide |
| `mfc71.dll`, `msvcp71.dll`, `msvcr71.dll` | DLL | Runtime dependencies | N/A (Windows-specific) |
| GUI button images (5 files) | PNG | UI elements for tile editor | UI design reference |

**Help.txt Contents:**
- Complete tile system specification
- XML-based tileset format
- Grid snapping and placement rules
- Tile rotation and scaling
- Layer management (locked/hidden)
- Export functionality

### Tile Images

#### Named/Special Tiles
**Directory:** `Ravenloft_NamedTiles/`
- Named_ArcaneCircle.png
- Named_Chapel.png
- Named_DarkFountain.png
- Named_FetidDen.png
- NamedTiles.set (configuration file)

**Current Status:** ✅ Already imported to `public/assets/tiles/`

#### Crypt Tiles
**Directory:** `Ravenloft_CryptTiles/`
- 8 named crypt tiles (Artimus, Barov & Ravenovia, Sergei, Ireena, King's, Lonely, Prince Aurel's, Strahd's)
- 20 corner tiles (4 sets of 5)
- CryptTiles.set (configuration file)

**Current Status:** ⚠️ Only 2 imported (Ireena's, King's)

#### Normal Tiles
**Directories:** `Ravenloft_NormalTilesBlack/`, `Ravenloft_NormalTilesWhite/`
- Black variants: 4 tiles (2x x2 tiles, 2x x4 tiles)
- White variants: 2 tiles + back image
- NormalTiles.set (configuration file)

**Current Status:** ⚠️ Not imported - these are the standard dungeon tiles

#### Basic Tile System
**Directory:** `CastleRavenloft_Basic/`
- CastleRavenloft.set (main configuration)
- RavenloftPartInstructions.txt (installation guide)
- RavenloftSample.ts, RavenloftSample2.ts (example maps)
- CastleRavenloft/ subdirectory

---

## 5. Token Resources

### Token Collections
**Directories:** `Ravenloft_Tokens/`, `Ravenloft_Tokens (1)/`, `Ravenloft_Tokens.zip`

**Ravenloft_Tokens/ Contents:**
- Adventure tokens (e.g., Klak's Artifact)
- Encounter tokens (Sliding Walls, Spear Gauntlet)
- Item tokens (Glyph of Warding)
- Misc tokens (Coffin variants)
- Token back images
- Tokens.set (configuration file)

**Ravenloft_Tokens (1)/ Contents:**
- 6 webp images (pic1041719, pic1041720, pic1046190, pic1047003, pic1048330, pic1048500)

**Current Status:** ⚠️ Only 4 coffin tokens imported to `public/assets/tokens/`

**Potential Uses:**
- Implement token placement system
- Add interactive objects (coffins, traps)
- Create treasure markers
- Add environmental hazards
- Implement quest item tracking

---

## 6. Figure/Miniature Resources

**Directory:** `Ravenloft_Figures/`

| File | Type | Description | Potential Use |
|------|------|-------------|---------------|
| `Hero_Cleric.png` | PNG | Cleric hero figure | Hero sprite/icon |
| `Monster_RatSwarm.png` | PNG | Rat swarm figure | Monster sprite |
| `Monster_Skeleton.png` | PNG | Skeleton figure | Monster sprite |
| `Monster_Spider.png` | PNG | Spider figure | Monster sprite |
| `Monster_Wolf.png` | PNG | Wolf figure | Monster sprite |
| `Monster_Wraith.png` | PNG | Wraith figure | Monster sprite |
| `Heroes.set` | SET | Hero configuration | Hero data reference |

**Potential Uses:**
- 2D sprite fallbacks when 3D models unavailable
- Minimap icons
- Card artwork
- UI portraits
- Token representations

---

## 7. Reference Images (WebP Collection)

**130+ WebP images** (pic1041719.webp through pic1276525.webp)

These appear to be BoardGameGeek reference photos showing:
- Physical game components
- Card layouts
- Tile arrangements
- Token designs
- Box contents
- Setup examples
- Gameplay scenarios

**Potential Uses:**
- Visual reference for asset creation
- UI/UX design inspiration
- Tutorial screenshots
- Marketing materials
- Validate physical component accuracy
- Identify missing components

**Recommended Action:** Review images to identify specific content types and create categorized reference library

---

## 8. Additional Resources

### Image Collections
**Directories:** `Castle Ravenloft JPG's/`, `Castle_Ravenloft_PNG's/`

Status: Empty or contain subdirectories - requires further investigation

### Flowchart
| File | Type | Description | Potential Use |
|------|------|-------------|---------------|
| `Flowchart_v4.pdf` | PDF | Game flow diagram | Validate turn structure, phase implementation |

### 3D Elements
| File | Type | Description | Potential Use |
|------|------|-------------|---------------|
| `cr-3d-elements.pdf` | PDF | 3D component reference | 3D model creation guide, asset requirements |

---

## Priority Recommendations

### High Priority (Immediate Value)

1. **Monster_List.xlsx** ⭐⭐⭐
   - Import into game database
   - Validate current monster implementations
   - Identify gaps in monster roster
   - Use for monster AI development

2. **Spell Cards (Calavid Directory)** ⭐⭐⭐
   - Implement spell casting system
   - Add spell scrolls as treasure
   - Enhance villain abilities
   - Create visual spell effects

3. **Normal Tiles (Black/White)** ⭐⭐⭐
   - Import standard dungeon tiles
   - Essential for map variety
   - Currently missing from game

4. **Crypt Tiles** ⭐⭐
   - Complete crypt tile set (6 more needed)
   - Add corner tiles for variety
   - Enhance dungeon aesthetics

5. **Token System** ⭐⭐
   - Implement interactive objects
   - Add treasure markers
   - Create environmental hazards

### Medium Priority (Enhanced Features)

6. **Monster Manuals (PDFs)** ⭐⭐
   - Extract monster abilities
   - Validate AI behaviors
   - Add special attacks

7. **Advanced Rules Documents** ⭐⭐
   - Implement difficulty modes
   - Add rule variants
   - Create advanced scenarios

8. **TileSystem Help Documentation** ⭐
   - Reference for tile placement logic
   - Understand grid system
   - Implement tile rotation/scaling

9. **Figure Images** ⭐
   - 2D sprite fallbacks
   - UI icons and portraits
   - Minimap representations

### Low Priority (Reference/Future)

10. **WebP Image Collection**
    - Visual reference library
    - Tutorial content
    - Marketing materials

11. **Flowchart & 3D Elements PDFs**
    - Validate game flow
    - 3D modeling reference

12. **Expansion Content**
    - Future content additions
    - New scenarios
    - Additional heroes

---

## Implementation Roadmap

### Phase 1: Core Content (Week 1-2)
- [ ] Import Monster_List.xlsx into database
- [ ] Add all normal dungeon tiles (black/white variants)
- [ ] Complete crypt tile collection
- [ ] Implement basic token system

### Phase 2: Enhanced Gameplay (Week 3-4)
- [ ] Implement spell casting system using Calavid cards
- [ ] Add spell scrolls as treasure items
- [ ] Extract monster abilities from PDFs
- [ ] Enhance villain AI with special abilities

### Phase 3: Polish & Expansion (Week 5-6)
- [ ] Add 2D sprite fallbacks from figure images
- [ ] Implement advanced rules variants
- [ ] Create new scenarios from expansion content
- [ ] Add interactive tokens (coffins, traps, etc.)

### Phase 4: Documentation & Reference (Ongoing)
- [ ] Categorize WebP reference images
- [ ] Create visual asset library
- [ ] Document tile placement rules
- [ ] Validate game flow against flowchart

---

## Asset Statistics

| Category | Count | Status |
|----------|-------|--------|
| PDF Documents | 17 | Partially reviewed |
| Word Documents | 2 | Reviewed |
| Excel Spreadsheets | 1 | ✅ Reviewed (115 monsters) |
| WebP Images | 130+ | Not reviewed |
| PNG Tile Images | 50+ | Partially imported |
| PNG Token Images | 20+ | Partially imported |
| PNG Figure Images | 6 | Not imported |
| Spell Card Images | 27 | Not imported |
| Configuration Files (.set) | 5+ | Reference only |
| Compressed Archives | 3 | Not extracted |
| Executable/DLL | 4 | Reference only |

**Total Assets:** 250+ files

---

## Next Steps

1. **Extract compressed archives** (RAR, ZIP) to access additional content
2. **Review WebP images** to categorize and identify useful references
3. **Parse Monster_List.xlsx** into game database format
4. **Import missing tiles** (normal tiles, remaining crypts)
5. **Implement spell system** using Calavid card assets
6. **Create token interaction system** for gameplay objects
7. **Validate monster data** against PDF manuals
8. **Document tile placement rules** from TileSystem help

---

## Conclusion

The `game_texts` directory contains a wealth of assets that can significantly enhance the Castle Ravenloft digital game:

- **115 monsters** documented with full stats and abilities
- **27 spell cards** ready for implementation
- **50+ tile images** for map variety
- **20+ tokens** for interactive gameplay
- **17 PDF documents** with rules, monsters, and expansions
- **130+ reference images** for visual guidance

The most impactful additions would be:
1. Complete tile set import for map variety
2. Spell casting system implementation
3. Monster database integration
4. Token interaction system
5. Advanced rules and difficulty modes

This represents months of potential content additions and gameplay enhancements.