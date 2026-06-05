# Castle Ravenloft 3D - Complete Asset Requirements

**Date:** 2026-05-21  
**Purpose:** Comprehensive list of all 3D models and assets needed for the game

---

## 1. Hero Models (5 Required)

### Technical Requirements
- **Format:** GLB (GLTF Binary)
- **Scale:** 1-2 units tall in Blender
- **Poly Count:** 5,000-10,000 triangles per model
- **Textures:** Embedded in GLB, 1024x1024 or 512x512
- **File Size:** Under 3MB per model
- **Orientation:** Front-facing (facing +Z axis)
- **Base:** Circular or square base at feet
- **Pivot Point:** Centered at base (0,0,0)

### Hero List

| ID | Name | Class | Description | Model Path | Priority |
|----|------|-------|-------------|------------|----------|
| hero_arjhan | Arjhan | Fighter | Dragonborn in plate armor, sword & shield | `/models/heroes/arjhan.glb` | HIGH |
| hero_immeril | Immeril | Wizard | Eladrin wizard in robes, staff with crystal | `/models/heroes/immeril.glb` | HIGH |
| hero_kat | Kat | Rogue | Human rogue in leather, dual daggers | `/models/heroes/kat.glb` | HIGH |
| hero_thorgrim | Thorgrim | Cleric | Dwarf cleric in chainmail, mace & holy symbol | `/models/heroes/thorgrim.glb` | HIGH |
| hero_alanni | Alanni | Ranger | Human ranger with bow, green cloak | `/models/heroes/alanni.glb` | HIGH |

### Visual Attributes Per Hero

**Arjhan (Fighter)**
- Heavy plate armor (silver/steel)
- Longsword in right hand
- Shield with holy symbol in left hand
- Red or blue cape
- Dragonborn features (scaled skin, draconic head)
- Heroic standing pose

**Immeril (Wizard)**
- Long flowing robes (purple/blue)
- Pointed wizard hat
- Wooden staff with glowing crystal top
- Long beard
- Mystical pose (staff raised or casting)
- Arcane symbols on robes

**Kat (Rogue)**
- Dark leather armor
- Hood and cloak
- Dual daggers (one in each hand)
- Agile, crouched stance
- Light, mobile appearance
- Pouches and tools on belt

**Thorgrim (Cleric)**
- Chainmail armor
- White tabard with holy symbol
- Mace in right hand
- Shield with divine emblem in left
- Dwarf features (beard, stocky build)
- Righteous, defensive pose

**Alanni (Ranger)**
- Green cloak and hood
- Leather armor
- Bow in hand, arrow nocked
- Quiver on back
- Alert, ready stance
- Nature-themed details

---

## 2. Monster Models (15 Required)

### Technical Requirements
- **Format:** GLB (GLTF Binary)
- **Scale:** 0.8-1.5 units tall (smaller than heroes)
- **Poly Count:** 3,000-8,000 triangles per model
- **Textures:** Embedded in GLB, 512x512 or 1024x1024
- **File Size:** Under 2MB per model
- **Orientation:** Front-facing
- **Base:** Optional base at feet
- **Pivot Point:** Centered at base

### Monster List

| ID | Name | Type | HP | AC | Description | Model Path | Priority |
|----|------|------|----|----|-------------|------------|----------|
| monster_skeleton | Skeleton | Undead | 1 | 14 | Animated skeleton with rusty sword | `/models/monsters/skeleton.glb` | HIGH |
| monster_zombie | Zombie | Undead | 1 | 11 | Shambling undead, rotting flesh | `/models/monsters/zombie.glb` | HIGH |
| monster_ghoul | Ghoul | Undead | 2 | 12 | Hunched undead with claws | `/models/monsters/ghoul.glb` | MEDIUM |
| monster_wolf | Wolf | Animal | 1 | 13 | Dire wolf, aggressive pose | `/models/monsters/wolf.glb` | MEDIUM |
| monster_goblin | Goblin | Humanoid | 1 | 13 | Small goblin with dagger | `/models/monsters/goblin.glb` | MEDIUM |
| monster_gargoyle | Gargoyle | Construct | 2 | 15 | Stone gargoyle with wings | `/models/monsters/gargoyle.glb` | MEDIUM |
| monster_vampire | Vampire | Undead | 3 | 15 | Elegant vampire in cape | `/models/monsters/vampire.glb` | MEDIUM |
| monster_troll | Troll | Giant | 4 | 14 | Large troll with club | `/models/monsters/troll.glb` | LOW |
| monster_dragon | Dragon | Dragon | 5 | 16 | Small dragon, fire-breathing | `/models/monsters/dragon.glb` | LOW |
| monster_necromancer | Necromancer | Undead | 2 | 12 | Robed necromancer with staff | `/models/monsters/necromancer.glb` | LOW |
| monster_werewolf | Werewolf | Beast | 3 | 14 | Werewolf in attack pose | `/models/monsters/werewolf.glb` | LOW |
| monster_spider | Spider | Beast | 1 | 12 | Giant spider | `/models/monsters/spider.glb` | LOW |
| monster_strahd | Strahd | Boss | 10 | 18 | Vampire lord, ornate armor | `/models/monsters/strahd.glb` | HIGH |
| monster_vampire_lord | Vampire Lord | Boss | 8 | 17 | Powerful vampire | `/models/monsters/vampire_lord.glb` | MEDIUM |
| monster_young_red_dragon | Young Red Dragon | Boss | 6 | 16 | Red dragon, larger scale | `/models/monsters/young_red_dragon.glb` | MEDIUM |

### Visual Attributes Per Monster Type

**Common Monsters (HP 1-2)**
- Smaller scale (0.8-1.0 units)
- Simple poses
- Clear silhouette
- Menacing but not overwhelming

**Elite Monsters (HP 3-4)**
- Medium scale (1.0-1.2 units)
- More detailed
- Dynamic poses
- Unique features

**Boss Monsters (HP 5+)**
- Larger scale (1.5-2.0 units)
- Highly detailed
- Dramatic poses
- Imposing presence

---

## 3. Tile Models/Textures (41 Required)

### Technical Requirements
- **Format:** Textured planes OR simple 3D geometry
- **Size:** 4x4 units (each tile is 4 squares)
- **Textures:** 1024x1024 or 2048x2048 PNG
- **File Size:** Under 1MB per tile texture
- **Features:** Walls, doors, bone pile marker
- **Style:** Stone dungeon aesthetic

### Tile Categories

#### Start Tile (1)
- **ID:** start-tile
- **Type:** Named room
- **Connections:** All 4 edges open
- **Special:** Larger than normal, starting position
- **Texture:** `/assets/tiles/StartTile.png`

#### Generic Corridor Tiles (~20)
- **Type:** Corridor
- **Variations:** 
  - Straight (2 opposite edges open)
  - T-junction (3 edges open)
  - Crossroads (4 edges open)
  - L-corner (2 adjacent edges open)
- **Textures:** `/assets/tiles/corridor_*.png`

#### Named Room Tiles (8)
- Arcane Circle
- Chapel
- Dark Fountain
- Fetid Den
- Laboratory
- Rotting Nook
- Secret Stairway
- Workshop
- **Textures:** `/assets/tiles/named_*.png`

#### Crypt Tiles (12)
- Various crypt chambers
- Corner markers
- Named crypts (Strahd's Crypt, etc.)
- **Textures:** `/assets/tiles/crypt_*.png`

### Tile Attributes Required

Each tile needs:
- **Edge Configuration:** Which edges are open/closed
- **Bone Square:** Position for monster spawn (sqX, sqZ coordinates 0-3)
- **Danger Level:** White or black triangle indicator
- **Rotation:** 0, 90, 180, or 270 degrees
- **Special Features:** Traps, treasures, objectives

---

## 4. Token Models (Optional but Recommended)

### Technical Requirements
- **Format:** GLB or 2D sprites (PNG with transparency)
- **Scale:** 0.3-0.5 units (smaller than heroes)
- **Style:** Consistent with game aesthetic

### Token List

| Token Type | Count | Description | Path | Priority |
|------------|-------|-------------|------|----------|
| Coffin | 8 | Searchable coffins for Scenario 1 | `/models/tokens/coffin.glb` | MEDIUM |
| Treasure Chest | 1 | Generic treasure marker | `/models/tokens/treasure.glb` | LOW |
| Trap Marker | 5 | Various trap types | `/models/tokens/trap_*.glb` | LOW |
| HP Token | 10 | Hit point markers | `/models/tokens/hp.glb` | LOW |
| Healing Surge | 2 | Healing surge tokens | `/models/tokens/surge.glb` | LOW |
| Condition Markers | 6 | Status effect markers | `/models/tokens/condition_*.glb` | LOW |

---

## 5. Dice Model (1 Required)

### Technical Requirements
- **Format:** GLB
- **Type:** d20 (20-sided die)
- **Scale:** 0.5 units
- **Textures:** Numbers 1-20 clearly visible
- **Animation:** Rolling animation support
- **Path:** `/models/dice/d20.glb`
- **Priority:** MEDIUM

### Visual Attributes
- Clear number markings
- Gothic/medieval style
- Dark color scheme (black, red, or bone)
- Readable from camera distance

---

## 6. Card Art (2D Images)

### Technical Requirements
- **Format:** PNG with transparency
- **Size:** 512x768 pixels (portrait orientation)
- **Style:** Consistent art style across all cards
- **File Size:** Under 500KB per image

### Card Categories

#### Hero Portraits (5)
- One portrait per hero
- **Path:** `/assets/cards/heroes/hero_*.png`
- **Priority:** HIGH

#### Power Cards (~50)
- Hero ability cards
- Daily, At-Will, Utility powers
- **Path:** `/assets/cards/powers/power_*.png`
- **Priority:** MEDIUM

#### Monster Cards (28)
- Monster spawn cards
- **Path:** `/assets/cards/monsters/monster_*.png`
- **Priority:** MEDIUM

#### Treasure Cards (34)
- Blessings, Fortunes, Items
- **Path:** `/assets/cards/treasures/treasure_*.png`
- **Priority:** MEDIUM

#### Encounter Cards (35)
- Events, Traps, Environments
- **Path:** `/assets/cards/encounters/encounter_*.png`
- **Priority:** MEDIUM

#### Card Back (1)
- Generic card back design
- **Path:** `/assets/cards/card_back.png`
- **Priority:** HIGH

---

## 7. UI Assets (2D Images)

### Technical Requirements
- **Format:** PNG with transparency
- **Style:** Gothic/medieval theme
- **Colors:** Dark palette with gold/red accents

### UI Asset List

| Asset | Size | Description | Path | Priority |
|-------|------|-------------|------|----------|
| Main Menu BG | 1920x1080 | Background image | `/ui/main_menu_bg.png` | ✅ EXISTS |
| Button Frame | 256x64 | Gothic button border | `/ui/button_frame.png` | MEDIUM |
| Panel Frame | 512x512 | Panel border (9-slice) | `/ui/panel_frame.png` | MEDIUM |
| Health Bar | 128x16 | HP bar texture | `/ui/health_bar.png` | LOW |
| Phase Icons | 64x64 each | Hero/Exploration/Villain icons | `/ui/phase_*.png` | LOW |
| Cursor | 32x32 | Custom cursor | `/ui/cursor.png` | LOW |

---

## 8. Audio Assets

### Technical Requirements
- **Format:** MP3 or OGG
- **Quality:** 128-192 kbps
- **Length:** 2-5 minutes (music), 0.5-2 seconds (SFX)

### Audio List

#### Music (2-3 tracks)
- Main theme (looping)
- Combat theme (looping)
- Boss theme (looping)
- **Path:** `/audio/music/*.mp3`
- **Priority:** LOW

#### Sound Effects (10-15)
- Dice roll
- Card draw
- Card play
- Tile place
- Sword hit
- Spell cast
- Monster die
- Hero hurt
- Door open
- Treasure found
- **Path:** `/audio/sfx/*.mp3`
- **Priority:** LOW

#### Ambient (1-2)
- Dungeon ambience (looping)
- Wind/echo effects
- **Path:** `/audio/ambient/*.mp3`
- **Priority:** LOW

---

## 9. Particle Effect Textures

### Technical Requirements
- **Format:** PNG with alpha channel
- **Size:** 64x64 or 128x128
- **Style:** Soft, glowing effects

### Particle Texture List

| Effect | Description | Path | Priority |
|--------|-------------|------|----------|
| Fire | Orange/red flame particle | `/textures/particles/fire.png` | MEDIUM |
| Ice | Blue crystal/frost | `/textures/particles/ice.png` | MEDIUM |
| Lightning | White/blue spark | `/textures/particles/lightning.png` | MEDIUM |
| Healing | Green glow | `/textures/particles/healing.png` | MEDIUM |
| Necrotic | Purple/black smoke | `/textures/particles/necrotic.png` | LOW |
| Blood | Red splatter | `/textures/particles/blood.png` | LOW |
| Dust | Gray/brown dust | `/textures/particles/dust.png` | LOW |

---

## 10. Implementation Priority

### Phase 1: Minimum Viable Assets (Week 1)
**Goal:** Get game visually functional

1. **Hero Models (5)** - Use simple colored cylinders if needed
   - Arjhan (blue cylinder)
   - Immeril (purple cylinder)
   - Kat (black cylinder)
   - Thorgrim (white cylinder)
   - Alanni (green cylinder)

2. **Monster Models (3 most common)**
   - Skeleton
   - Zombie
   - Strahd (boss)

3. **Tile Textures (3)**
   - Start tile
   - Generic corridor
   - Generic room

4. **Card Back (1)**
   - Generic card back design

### Phase 2: Core Content (Week 2)
**Goal:** Complete gameplay experience

5. **Remaining Monster Models (12)**
6. **Hero Portraits (5)**
7. **Power Card Art (20 most used)**
8. **Dice Model (1)**

### Phase 3: Polish (Week 3)
**Goal:** Professional appearance

9. **All Card Art (remaining ~100)**
10. **All Tile Textures (remaining ~38)**
11. **Token Models (8)**
12. **UI Assets (6)**

### Phase 4: Audio & Effects (Week 4)
**Goal:** Immersive experience

13. **Music Tracks (3)**
14. **Sound Effects (15)**
15. **Particle Textures (7)**

---

## 11. Asset Creation Workflow

### Using Adobe Firefly (Recommended)

**For Hero/Monster Models:**
1. Generate image in Firefly with prompt
2. Remove background
3. Convert to 3D using Firefly's tool
4. Download GLB
5. Test in game

**Estimated Time:** 1-2 hours per model

### Using Blender (Alternative)

**For Custom Models:**
1. Model in Blender (low-poly)
2. UV unwrap
3. Texture in Substance Painter or Photoshop
4. Export as GLB with embedded textures
5. Test in game

**Estimated Time:** 4-8 hours per model

### Using AI Art (For Cards)

**For Card Art:**
1. Generate with Midjourney/DALL-E
2. Edit in Photoshop (add text, borders)
3. Export as PNG
4. Test in game

**Estimated Time:** 30 minutes per card

---

## 12. File Organization

```
public/
├── models/
│   ├── heroes/
│   │   ├── arjhan.glb
│   │   ├── immeril.glb
│   │   ├── kat.glb
│   │   ├── thorgrim.glb
│   │   └── vani.glb
│   ├── monsters/
│   │   ├── skeleton.glb
│   │   ├── zombie.glb
│   │   ├── strahd.glb
│   │   └── ... (12 more)
│   ├── tokens/
│   │   ├── coffin.glb
│   │   └── ... (7 more)
│   └── dice/
│       └── d20.glb
├── assets/
│   ├── tiles/
│   │   ├── StartTile.png
│   │   ├── corridor_*.png
│   │   ├── named_*.png
│   │   └── crypt_*.png
│   └── cards/
│       ├── heroes/
│       ├── powers/
│       ├── monsters/
│       ├── treasures/
│       ├── encounters/
│       └── card_back.png
├── ui/
│   ├── main_menu_bg.png (✅ EXISTS)
│   ├── button_frame.png
│   ├── panel_frame.png
│   └── ... (more UI)
├── textures/
│   └── particles/
│       ├── fire.png
│       ├── ice.png
│       └── ... (more particles)
└── audio/
    ├── music/
    ├── sfx/
    └── ambient/
```

---

## 13. Budget Estimate

### DIY Approach (Time Investment)
- **Hero Models:** 5 × 2 hours = 10 hours
- **Monster Models:** 15 × 1.5 hours = 22.5 hours
- **Card Art:** 150 × 0.5 hours = 75 hours
- **Tile Textures:** 41 × 1 hour = 41 hours
- **UI Assets:** 6 × 1 hour = 6 hours
- **Total:** ~155 hours

### Commissioned Approach (Cost)
- **Hero Models:** 5 × $50 = $250
- **Monster Models:** 15 × $30 = $450
- **Card Art Pack:** $200-300
- **Tile Texture Pack:** $100-150
- **UI Asset Pack:** $50-100
- **Audio Pack:** $100-150
- **Total:** $1,150-1,400

### Hybrid Approach (Recommended)
- **Commission hero models:** $250
- **Use AI for card art:** $50 (Midjourney subscription)
- **DIY tile textures:** 20 hours
- **Free audio from OpenGameArt:** $0
- **Total:** $300 + 20 hours

---

## 14. Quality Checklist

Before importing each asset, verify:

### 3D Models
- [ ] Correct scale (1-2 units for heroes)
- [ ] Proper orientation (facing +Z)
- [ ] Textures embedded in GLB
- [ ] Poly count under limit
- [ ] File size under 3MB
- [ ] No missing faces or holes
- [ ] Pivot point at base

### Textures
- [ ] Correct resolution (power of 2)
- [ ] Proper format (PNG for transparency)
- [ ] File size optimized
- [ ] Consistent art style
- [ ] Readable at game distance

### Audio
- [ ] Correct format (MP3/OGG)
- [ ] Proper length
- [ ] Volume normalized
- [ ] No clipping or distortion
- [ ] Loops seamlessly (for music)

---

## 15. Testing Procedure

After importing each asset:

1. **Visual Test:** Does it look correct in-game?
2. **Scale Test:** Is it the right size relative to other objects?
3. **Performance Test:** Does it maintain 60 FPS?
4. **Interaction Test:** Does it respond to game events?
5. **Cross-browser Test:** Works in Chrome, Firefox, Safari?

---

## Summary

**Total Assets Required:**
- 3D Models: 22 (5 heroes + 15 monsters + 1 dice + 1 token)
- Tile Textures: 41
- Card Images: ~150
- UI Images: 6
- Audio Files: ~20
- Particle Textures: 7

**Estimated Time (DIY):** 155 hours
**Estimated Cost (Commissioned):** $1,150-1,400
**Recommended Approach:** Hybrid (commission heroes, AI for cards, DIY tiles)

**Next Step:** Start with Phase 1 (Minimum Viable Assets) to get the game visually functional, then iterate.