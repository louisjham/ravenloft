# Hero Portrait Alignment Fix Plan

**Date:** 2026-05-24  
**Issue:** Portraits showing chests instead of heads  
**Status:** Ready for Implementation

---

## Problem Analysis

### Root Cause
The hero portraits are currently using `objectFit: 'cover'` without specifying an `object-position`. This CSS property combination causes the browser to:

1. **Scale the image** to fill the container while maintaining aspect ratio
2. **Center the image** by default (both horizontally and vertically)
3. **Crop overflow** from both top and bottom equally

Since portrait images are typically taller than the display containers, the centering behavior crops the top portion (heads) and bottom portion equally, resulting in only the chest area being visible.

### Affected Components
Three components display hero portraits with this issue:

1. **[`ScenarioSetupScreen.tsx:175`](../src/components/ui/ScenarioSetupScreen.tsx:175)** - Hero selection screen (140px height container)
2. **[`PartySidebar.tsx:63`](../src/components/ui/PartySidebar.tsx:63)** - In-game party sidebar (40px square container)
3. **[`HeroPanel.tsx:58`](../src/components/ui/HeroPanel.tsx:58)** - Current hero detail panel (80px circular container)

---

## Solution

### CSS Fix: Add `object-position: top`

By adding `objectPosition: 'top'` to the image style, we instruct the browser to:

1. **Anchor the image to the top** of the container
2. **Scale to fill width** while maintaining aspect ratio
3. **Crop from the bottom** only, preserving the head/face area

### Technical Details

**Before:**
```typescript
style={{ 
  width: '100%', 
  height: '100%', 
  objectFit: 'cover' 
}}
```

**After:**
```typescript
style={{ 
  width: '100%', 
  height: '100%', 
  objectFit: 'cover',
  objectPosition: 'top'  // ← Anchors image to top
}}
```

### Why This Works

The `object-position` CSS property controls the alignment of replaced content (like images) within their container when using `object-fit`. 

- **Default behavior:** `object-position: center` (50% 50%)
- **Our fix:** `object-position: top` (50% 0%)

This ensures that:
- The **top edge** of the portrait aligns with the **top edge** of the container
- The **head and face** are always visible
- Any cropping happens at the **bottom** of the image (feet/lower body)

---

## Implementation Plan

### Step 1: Update ScenarioSetupScreen.tsx
**Location:** Line 175  
**Container:** 140px height rectangular portrait  
**Change:** Add `objectPosition: 'top'` to image style

```typescript
<img
  src={`/ui/${h.name.toLowerCase()}.png`}
  alt={h.name}
  style={{ 
    height: '100%', 
    width: '100%', 
    objectFit: 'cover',
    objectPosition: 'top',  // ← ADD THIS
    opacity: isSelected ? 1 : 0.4 
  }}
  onError={(e) => (e.currentTarget.src = '/ui/arjhan.png')}
/>
```

### Step 2: Update PartySidebar.tsx
**Location:** Line 63  
**Container:** 40px square thumbnail  
**Change:** Add `objectPosition: 'top'` to image style

```typescript
<img 
  src={portraitMap[hero.name] || '/ui/arjhan.png'} 
  alt={hero.name}
  style={{ 
    width: '100%', 
    height: '100%', 
    objectFit: 'cover',
    objectPosition: 'top'  // ← ADD THIS
  }}
/>
```

### Step 3: Update HeroPanel.tsx
**Location:** Line 58  
**Container:** 80px circular portrait  
**Change:** Add `objectPosition: 'top'` to image style

```typescript
<img 
  src={portraitMap[currentHero.name] || '/ui/arjhan.png'} 
  alt={currentHero.name} 
  style={{ 
    width: '100%', 
    height: '100%', 
    objectFit: 'cover',
    objectPosition: 'top'  // ← ADD THIS
  }}
/>
```

---

## Expected Results

### Before Fix
- ❌ Portraits show chest/torso area
- ❌ Heads are cropped off the top
- ❌ Character faces not visible
- ❌ Poor visual identification

### After Fix
- ✅ Portraits show head and face
- ✅ Character features clearly visible
- ✅ Easy hero identification
- ✅ Professional appearance

---

## Testing Checklist

### Visual Verification
- [ ] **ScenarioSetupScreen:** All 5 hero portraits show heads/faces
- [ ] **PartySidebar:** Small thumbnails display heads clearly
- [ ] **HeroPanel:** Circular portrait shows face properly
- [ ] **Selection states:** Opacity changes don't affect alignment
- [ ] **Fallback images:** Error fallback still works correctly

### Cross-Component Consistency
- [ ] All three components show consistent portrait framing
- [ ] Heads are visible in all container sizes (40px, 80px, 140px)
- [ ] Circular and rectangular containers both work correctly

### Edge Cases
- [ ] Test with all 5 heroes (Arjhan, Immeril, Kat, Thorgrim, Alanni)
- [ ] Verify fallback behavior when portrait fails to load
- [ ] Check that aspect ratio variations are handled gracefully

---

## Alternative Solutions Considered

### Option 1: Change Container Aspect Ratio
**Rejected:** Would require redesigning UI layouts across multiple components

### Option 2: Use `object-fit: contain`
**Rejected:** Would show letterboxing/pillarboxing, breaking the visual design

### Option 3: Crop Images Before Import
**Rejected:** Would require manual image editing and lose flexibility for future adjustments

### Option 4: Use `object-position: top` ✅
**Selected:** Simple CSS change, no layout modifications, maintains design integrity

---

## Risk Assessment

### Low Risk ✅
- **CSS-only change:** No logic modifications
- **Non-breaking:** Existing functionality preserved
- **Reversible:** Easy to revert if needed
- **Browser support:** `object-position` widely supported (IE11+)

### Potential Issues
- **Portrait composition:** If portraits are composed with heads at bottom (unlikely)
  - *Mitigation:* Visual inspection during testing
- **Aspect ratio extremes:** Very wide or very tall portraits might look odd
  - *Mitigation:* Current portraits should be standard portrait orientation

---

## Browser Compatibility

`object-position` is supported in:
- ✅ Chrome 32+ (2014)
- ✅ Firefox 36+ (2015)
- ✅ Safari 10+ (2016)
- ✅ Edge 79+ (2020)
- ✅ Opera 19+ (2014)

**Conclusion:** Excellent browser support for all modern browsers.

---

## Documentation Updates

### Code Comments
Add inline comments explaining the `object-position` choice:

```typescript
// Anchor portrait to top to show heads/faces instead of chest
objectPosition: 'top'
```

### AGENTS.md Update
Consider adding to the "Critical Patterns" section:

```markdown
- **Portrait Display**: Always use `objectPosition: 'top'` with `objectFit: 'cover'` 
  for hero portraits to ensure heads/faces are visible
```

---

## Success Criteria

✅ **Primary Goal:** Hero heads and faces are clearly visible in all portrait displays

✅ **Secondary Goals:**
- No layout shifts or visual regressions
- Consistent appearance across all three components
- Maintains existing functionality (selection, opacity, fallbacks)

---

## Next Steps

1. **Switch to Code Mode** to implement the CSS changes
2. **Apply changes** to all three components
3. **Test visually** in development environment
4. **Verify** all heroes display correctly
5. **Document** the fix in commit message

---

## Conclusion

This is a straightforward CSS fix that addresses the portrait alignment issue by anchoring images to the top of their containers. The solution is low-risk, widely supported, and maintains all existing functionality while significantly improving the visual presentation of hero portraits.

**Recommendation:** Proceed with implementation in Code mode.