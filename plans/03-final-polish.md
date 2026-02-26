# Final Polish Pass

## Bugs Found

### 1. Keyboard shortcuts fire while typing in inputs
**File:** `TimeSlider.tsx`
**Issue:** Global keydown handler (ArrowLeft/Right, Space) fires even when user is typing in SearchBar or FilterPanel flag search. Space toggles play/pause while typing. Arrows change year instead of moving cursor.
**Fix:** Check if `e.target` is input/textarea and bail early.

### 2. Stale `selectedIndex` when selecting a company from search
**File:** `store.ts`
**Issue:** `setSelectedCompany` doesn't clear `selectedIndex`. If user clicks a vessel on the globe (sets selectedIndex), then searches and selects a company, the old selectedIndex persists. VesselCard then shows the stale globe-clicked vessel alongside the company selection label.
**Fix:** `setSelectedCompany` should also set `selectedIndex: -1`.

### 3. Year change leaves stale hover/selection state
**Files:** `store.ts`, `VesselCard.tsx`
**Issue:** Year change clears selections via a VesselCard useEffect, but (a) doesn't clear `hoveredIndex`, causing VesselCard to briefly show wrong vessel data, and (b) clearing in a component effect is fragile.
**Fix:** Move clearing to store's `setYear` action. Clear `hoveredIndex`, `selectedIndex`, `selectedVessel`. Remove redundant VesselCard effect.

### 4. Missing dark-scroll on search dropdown
**File:** `SearchBar.tsx`
**Issue:** Search results dropdown uses default browser scrollbar. FilterPanel uses custom `dark-scroll` class. Inconsistent.
**Fix:** Add `dark-scroll` class to search results container.

## Status
- [ ] Fix 1: Keyboard shortcuts in inputs
- [ ] Fix 2: Stale selectedIndex on company select
- [ ] Fix 3: Year change state clearing
- [ ] Fix 4: dark-scroll on search dropdown
