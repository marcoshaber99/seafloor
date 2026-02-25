# Seafloor Audit — February 2026

Complete codebase review, production build analysis, and comparison against world-class globe visualizations (GitHub Globe, Stripe Globe, Shopify BFCM Globe).

---

## P0 — Bugs

### 1. VesselCard ref access during render (9 lint errors)
`useMemo` at line 102 reads `cardRef.current` during render — violates React 19's ref rules. The card dimensions (`offsetWidth`/`offsetHeight`) won't track correctly if the card resizes. Fix: track card dimensions via state + ResizeObserver or useEffect, not useMemo.

### 2. Metadata says "six years" — it's seven
`layout.tsx:6` — "six years" should be "seven years" (2018–2024).

---

## P1 — Conference-Critical

### 3. No title or context visible
Someone walking up to the demo sees colored dots on a black globe. No explanation of what it is. Needs a visible title: "Seafloor — EU Shipping Emissions" with year range. Should be prominent on first load, then fade to subtle.

### 4. Country outlines too faint
`GlobeCore.tsx:32` — `rgba(80, 120, 180, 0.15)` makes country borders nearly invisible. Without geographic context, the clusters of dots floating over a dark globe are hard to interpret. Bump to ~0.25.

### 5. Far-side vessels render through the globe
With additive blending + no depth write, far-side vessels bleed through the globe, creating a faint glow on the wrong side. The raycaster culls them for hover, but the shader still renders all instances. A vertex-shader check against camera position can discard back-facing instances entirely — both visual fix and performance win.

### 6. No loading indicator for initial data
First load shows empty globe for ~500ms+ while binary data fetches. No visual feedback.

---

## P2 — UX Issues

### 7. CompanySearch: no "No results" state
Typing a company name that doesn't match → dropdown simply doesn't appear. User wonders if the search is broken. Should show "No results found."

### 8. Escape key conflict
Both `VesselCard` (line 59) and `CompanySearch` (line 61) add global keydown listeners for Escape. Pressing Escape clears both simultaneously. Should prioritize: dismiss pinned vessel card first, then company selection on second press.

### 9. Auto-rotate toggle icon is confusing
`RotateCw` when ON, tiny `Square` (8px, no stroke) when OFF. The square reads as a "stop" icon but has no visual affordance — users won't know what it does. Both states should use the same icon with visual differentiation (e.g., always RotateCw, with active/inactive styling).

### 10. No keyboard shortcut hints
Arrow keys for year navigation, space for play/pause — completely hidden. Conference attendees won't discover these.

---

## P3 — Code Quality

### 11. Duplicate `companyIndices` computation
`VesselLayer.tsx:111-118` and `StatsOverlay.tsx:62-69` — identical logic. Should be a shared hook or computed in the store.

### 12. Duplicate format functions
`formatCO2` in StatsOverlay (returns "125K") and VesselCard (returns "125.0K t") — different behavior for the same concept. `formatEUR` also duplicated with slight differences. Should consolidate into `lib/format.ts`.

### 13. Bundle size exceeds budget
645KB gzipped JS vs 400KB target in ARCHITECTURE.md. The 2.1MB chunk is dominated by three-globe pulling in d3-geo and h3-js WASM. Not fixable without replacing three-globe. Document as accepted risk.

---

## P4 — Visual Polish (Recommendations)

### 14. Entrance animation
Globe and UI appear instantly. A staged reveal (globe fade in → vessels animate on → UI slides in) would make a dramatically stronger first impression. Every reference globe (GitHub, Stripe, Shopify) has this.

### 15. Year switch globe transition
Stats counters animate smoothly, but globe vessel data swaps instantly. A brief fade-out/fade-in or opacity pulse would make year transitions feel intentional.

### 16. No data source attribution
The THETIS-MRV source should be credited somewhere. Add "Source: EU THETIS-MRV" to bottom of stats panel or as small text on screen.

### 17. Custom font
System fonts work but lack character. A geometric sans-serif (Inter, Space Grotesk, or JetBrains Mono for numbers) would significantly upgrade perceived quality for a conference demo.

---

## P5 — Future Enhancements (Discussion)

### 18. Attract/idle mode
Auto-cycle camera fly-tos to interesting clusters with narrative text when nobody's interacting. Conference demo essential, but significant scope.

### 19. Ship type and flag state filter UI
Store supports filters (shipTypes, flagIsos sets) but no UI exists. Worth adding for explorability.

### 20. Year-over-year trend insights
COVID dip (2020-2021), ETS impact (2024) — these stories are in the data but not surfaced.

### 21. Custom atmosphere shader
Replace three-globe's default with a backface-rendered gradient sphere (GitHub Globe technique) for a more premium halo effect.

---

## Implementation Plan

Clear improvements to implement now:
- [x] Fix VesselCard lint errors (ref access during render)
- [x] Fix metadata "six" → "seven"
- [x] Add "No results" to CompanySearch
- [x] Fix Escape key conflict
- [x] Add title overlay
- [x] Brighter country outlines
- [x] Far-side vertex discard in shader
- [x] Deduplicate format functions
- [x] Add data source attribution
- [x] Fix auto-rotate toggle icon
