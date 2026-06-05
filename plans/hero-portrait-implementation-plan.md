# Hero Portrait Implementation Plan

## Current Situation Analysis

### Problem
The Adventure Setup screen ([`ScenarioSetupScreen.tsx`](../src/components/ui/ScenarioSetupScreen.tsx:171-177)) attempts to load hero portraits from `/ui/{heroname}.png` but these files don't exist, resulting in:
- Broken image placeholders in portrait boxes
- Fallback to a non-existent `/ui/arjhan.png`
- Poor user experience during hero selection

### Current Implementation
```typescript
// Line 172-177 in ScenarioSetupScreen.tsx
<img
  src={`/ui/${h.name.toLowerCase()}.png`}
  alt={h.name}
  style={{ height: '100%', width: '100%', objectFit: 'cover', opacity: isSelected ? 1 : 0.4 }}
  onError={(e) => (e.currentTarget.src = '/ui/arjhan.png')}
/>
```

### Heroes Requiring Portraits
Based on [`src/data/heroes.json`](../src/data/heroes.json):
1. **Arjhan** - Dragonborn Fighter
2. **Immeril** - Eladrin Wizard
3. **Kat** - Human Rogue
4. **Thorgrim** - Dwarf Cleric
5. **Alanni** - Human Ranger

### Available Assets in game_texts
**Status:** ❌ **No hero portrait assets found**

Search results show:
- No PNG files matching hero names
- No dedicated portrait/character art directory
- Only generic figure images in `Ravenloft_Figures/` (Hero_Cleric.png, monsters)
- 130+ webp reference images may contain hero card photos

---

## Asset Options

### Option 1: Extract from WebP Reference Images ⭐ (Recommended Short-term)
**Source:** `game_texts/pic*.webp` (130+ images)

**Pros:**
- Assets already available locally
- Authentic board game artwork
- Quick to implement
- No copyright concerns (official game photos)

**Cons:**
- Need to manually review images to find hero cards
- May require cropping/editing
- Quality depends on photo resolution
- Not all heroes may be photographed

**Effort:** Low-Medium (2-4 hours)

### Option 2: Use Figure Images as Placeholders
**Source:** `game_texts/Ravenloft_Figures/Hero_Cleric.png`

**Pros:**
- Immediately available
- Better than broken images
- Authentic game assets

**Cons:**
- Only 1 hero figure available (Cleric)
- Top-down miniature view, not portrait-style
- Not ideal for portrait boxes
- Missing 4 other heroes

**Effort:** Very Low (30 minutes)

### Option 3: Create AI-Generated Portraits 🎨
**Source:** AI art generation (Midjourney, DALL-E, Stable Diffusion)

**Pros:**
- Custom-designed for digital game
- Perfect portrait orientation
- Consistent art style
- High quality

**Cons:**
- Requires AI art generation access
- Time to generate and iterate
- May not match board game aesthetic
- Potential style inconsistency

**Effort:** Medium (4-8 hours including iterations)

### Option 4: Commission Custom Art 💰
**Source:** Professional artist

**Pros:**
- Highest quality
- Perfect fit for game
- Consistent style
- Unique to digital version

**Cons:**
- Expensive ($50-200 per portrait)
- Long turnaround time (weeks)
- Requires art direction

**Effort:** High (budget + time)

### Option 5: Extract from PDF Card Images 📄
**Source:** `game_texts/*.pdf` (card lists, manuals)

**Pros:**
- Official artwork
- Authentic to game
- Already in collection

**Cons:**
- PDFs may not contain high-res hero portraits
- Requires PDF extraction and editing
- Card artwork may be small/low quality

**Effort:** Medium (3-6 hours)

---

## Recommended Implementation Strategy

### Phase 1: Immediate Fix (Week 1) ⚡
**Goal:** Remove broken images, provide functional UI

**Actions:**
1. Review webp reference images to identify hero card photos
2. Extract and crop hero portraits from best quality images
3. Create 5 portrait images (180x140px minimum)
4. Save to `public/ui/` directory with correct naming:
   - `arjhan.png`
   - `immeril.png`
   - `kat.png`
   - `thorgrim.png`
   - `vani.png`
5. Test in Adventure Setup screen
6. Add fallback to generic placeholder if specific hero missing

**Deliverables:**
- 5 hero portrait images
- Updated fallback logic in ScenarioSetupScreen.tsx
- Tested hero selection UI

**Estimated Time:** 3-4 hours

### Phase 2: Quality Enhancement (Week 2-3) 🎨
**Goal:** Improve portrait quality and consistency

**Actions:**
1. Review all 130+ webp images systematically
2. Identify best quality hero card images
3. Use image editing to:
   - Crop to portrait orientation
   - Enhance contrast/brightness
   - Remove backgrounds if needed
   - Standardize dimensions (300x400px recommended)
4. Create consistent border/frame style
5. Add hover effects in UI

**Deliverables:**
- High-quality hero portraits
- Consistent visual style
- Enhanced UI interactions

**Estimated Time:** 6-8 hours

### Phase 3: Expansion Content (Future) 🚀
**Goal:** Add portraits for expansion heroes

**Actions:**
1. Research expansion hero lists
2. Source artwork from expansion PDFs
3. Maintain consistent style with base heroes
4. Update hero data structure to support portraits

**Deliverables:**
- Additional hero portraits
- Scalable portrait system
- Documentation for adding new heroes

**Estimated Time:** 4-6 hours per expansion

---

## Technical Implementation

### File Structure
```
public/
  ui/
    heroes/
      arjhan.png          (300x400px)
      immeril.png         (300x400px)
      kat.png             (300x400px)
      thorgrim.png        (300x400px)
      vani.png            (300x400px)
      placeholder.png     (generic fallback)
```

### Code Changes Required

#### 1. Update ScenarioSetupScreen.tsx
```typescript
// Improved image loading with better fallback
<img
  src={`/ui/heroes/${h.name.toLowerCase()}.png`}
  alt={h.name}
  style={{ 
    height: '100%', 
    width: '100%', 
    objectFit: 'cover', 
    opacity: isSelected ? 1 : 0.4 
  }}
  onError={(e) => {
    e.currentTarget.src = '/ui/heroes/placeholder.png';
  }}
/>
```

#### 2. Add Portrait Field to Hero Type (Optional)
```typescript
// In src/game/types.ts
export interface Hero {
  id: string;
  name: string;
  heroClass: string;
  portraitUrl?: string;  // Optional custom portrait path
  // ... other fields
}
```

#### 3. Create Placeholder Image
Generate a generic gothic-themed placeholder for missing portraits:
- Dark background with gold border
- Question mark or silhouette
- Matches game aesthetic

---

## Asset Extraction Workflow

### Step 1: Review WebP Images
```bash
# Navigate to game_texts directory
cd game_texts

# Review images in batches
# Look for hero card photos showing character artwork
```

### Step 2: Identify Hero Cards
Look for images containing:
- Character portraits/artwork
- Hero names (Arjhan, Immeril, Kat, Thorgrim, Alanni)
- Character class indicators
- D&D Adventure System card layouts

### Step 3: Extract and Process
For each identified hero image:
1. Open in image editor (Photoshop, GIMP, etc.)
2. Crop to character portrait area
3. Resize to 300x400px (portrait orientation)
4. Adjust brightness/contrast for visibility
5. Save as PNG with transparency if possible
6. Name according to hero: `{heroname}.png`

### Step 4: Create Placeholder
1. Create 300x400px canvas
2. Dark gothic background (#1a1a1a)
3. Gold border (2px, #c4a060)
4. Center question mark or silhouette icon
5. Save as `placeholder.png`

---

## Quality Standards

### Portrait Requirements
- **Dimensions:** 300x400px (portrait orientation)
- **Format:** PNG with transparency preferred
- **File Size:** < 200KB per image
- **Quality:** Clear, recognizable character features
- **Style:** Consistent across all heroes
- **Background:** Dark or transparent to match UI

### UI Integration
- Portraits should be clearly visible at 180x140px (current UI size)
- Must work with opacity changes (selected vs unselected)
- Should maintain aspect ratio without distortion
- Fallback must be visually distinct from actual portraits

---

## Testing Checklist

- [ ] All 5 hero portraits load correctly
- [ ] Portraits display at correct size (180x140px in grid)
- [ ] Selected state shows full opacity
- [ ] Unselected state shows reduced opacity (0.4)
- [ ] Fallback placeholder works for missing images
- [ ] Images maintain aspect ratio
- [ ] No visual distortion or pixelation
- [ ] Portraits match gothic theme
- [ ] File sizes are optimized
- [ ] Cross-browser compatibility verified

---

## Alternative: Temporary Text-Based Solution

If asset extraction takes longer than expected, implement a temporary text-based solution:

```typescript
// Replace image with styled div
<div style={{
  height: '140px',
  background: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  borderBottom: '1px solid #333'
}}>
  <div style={{
    fontSize: '3rem',
    color: 'var(--color-gold)',
    fontFamily: 'var(--font-title)',
    textShadow: '0 0 10px rgba(196, 160, 96, 0.5)'
  }}>
    {h.name.charAt(0)}
  </div>
  <div style={{
    fontSize: '0.7rem',
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: '2px',
    marginTop: '8px'
  }}>
    {h.heroClass}
  </div>
</div>
```

This provides:
- Immediate visual improvement
- Character initial as identifier
- Class name for context
- Gothic styling matching theme
- No broken images

---

## Timeline Summary

| Phase | Duration | Deliverable |
|-------|----------|-------------|
| **Phase 1: Immediate Fix** | 3-4 hours | Functional portraits from webp extraction |
| **Phase 2: Quality Enhancement** | 6-8 hours | High-quality, consistent portraits |
| **Phase 3: Expansion** | Future | Additional hero portraits |
| **Alternative: Text Solution** | 1 hour | Temporary styled placeholders |

---

## Next Steps

1. **Immediate (Today):**
   - Review first 50 webp images for hero cards
   - Extract any found hero portraits
   - Implement text-based fallback if no images found

2. **Short-term (This Week):**
   - Complete webp image review
   - Extract and process all 5 hero portraits
   - Create placeholder image
   - Update ScenarioSetupScreen.tsx
   - Test hero selection UI

3. **Medium-term (Next Week):**
   - Enhance portrait quality
   - Add consistent styling/borders
   - Optimize file sizes
   - Document portrait system

4. **Long-term (Future):**
   - Add expansion hero portraits
   - Consider AI-generated alternatives
   - Create portrait management system

---

## Conclusion

**Recommended Approach:** Phase 1 (WebP Extraction) + Text-based Fallback

This provides:
- ✅ Immediate improvement to user experience
- ✅ Uses existing assets (no external dependencies)
- ✅ Low effort, high impact
- ✅ Authentic board game artwork
- ✅ Scalable for future heroes

**Estimated Total Time:** 4-5 hours for complete implementation

**Priority:** High - directly impacts user experience in Adventure Setup screen