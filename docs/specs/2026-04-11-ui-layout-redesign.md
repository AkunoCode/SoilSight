# UI Layout Redesign Spec

**Date:** 2026-04-11
**Scope:** All three app views — Map page, Insight overview, Farm detail page
**Approach:** Full layout refactor — CSS Grid with named areas, responsive breakpoints, reduced font sizes, fluid PreviewCard

---

## Goals

1. Fix misaligned cards and uneven column sizing across all pages
2. Reduce oversized fonts (KPI values, breadcrumb title, card headings)
3. Make all three views mobile-responsive with proper breakpoints
4. Keep the map full-screen on mobile; collapse overlay controls into a compact top bar

---

## Breakpoints

| Name    | Max-width | Behavior                        |
|---------|-----------|---------------------------------|
| desktop | —         | Full multi-column layout        |
| tablet  | 960px     | 3-col grids collapse to 2-col   |
| mobile  | 600px     | All grids collapse to 1-col     |

---

## 1. KPI Component (`src/components/KPI.vue`)

**Font size reductions:**
- `.kpi-title`: `18px` → `13px`, uppercase, letter-spacing `0.5px`
- `.kpi-value`: `32px` → `20px`
- `.kpi-subtitle`: `18px` → `11px`
- `min-height`: `72px` → `auto`
- `padding`: `16px 20px` → `14px 16px`

---

## 2. Insight Overview Page (`src/pages/insight/index.vue`)

### KPI Row

Replace `.columns` CSS grid:

```css
/* current */
grid-template-columns: repeat(5, 1fr);

/* proposed */
grid-template-columns: repeat(4, 1fr) auto;
gap: 10px;
align-items: stretch;

@media (max-width: 960px) {
  grid-template-columns: repeat(2, 1fr);
}
@media (max-width: 600px) {
  grid-template-columns: 1fr;
}
```

The Print Report button sits in the `auto` column on desktop, and flows into the grid naturally on smaller screens (becomes full-width via `grid-column: 1 / -1`).

### Chart Grid

Replace all `VRow`/`VCol` with CSS Grid sections. Each section is a `<div class="chart-grid">` with column rules:

| Section | Desktop columns | Tablet (≤960px) | Mobile (≤600px) |
|---------|----------------|-----------------|-----------------|
| Row 1: AI Summary + Farms List | `1fr 1fr` | `1fr 1fr` | `1fr` |
| Row 2: Bar + Heatmap + Degradation | `repeat(3, 1fr)` | `1fr 1fr` (Degradation wraps) | `1fr` |
| Row 3: Donut + Bio Risk | `5fr 7fr` | `1fr 1fr` | `1fr` |
| Row 4: Boxplot + Color Drilldown | `1fr 1fr` | `1fr 1fr` | `1fr` |
| Row 5: Monthly Trend | `1fr` (full) | `1fr` | `1fr` |

Each chart is wrapped in a `.chart-card` div (same styles as existing `.card`).

Remove `VRow`/`VCol` imports and usage from this page entirely. Vuetify grid is not needed here since no Vuetify-specific responsive helpers are used.

### Page header

`<h1>` font size: keep as-is (uses Vuetify default), but add `white-space: nowrap; overflow: hidden; text-overflow: ellipsis` to prevent overflow on narrow screens.

---

## 3. Map Page (`src/pages/index.vue`)

### Breadcrumb

```css
/* current */
.breadcrumb-subtitle { font-size: 18px; }
.breadcrumb-title    { font-size: 32px; }

/* proposed */
.breadcrumb-subtitle { font-size: 13px; }
.breadcrumb-title    { font-size: 22px; }

@media (max-width: 600px) {
  .breadcrumb-subtitle { font-size: 11px; }
  .breadcrumb-title    { font-size: 16px; }
}
```

### Top Controls

On mobile, controls stack vertically and `min-width` is removed:

```css
@media (max-width: 600px) {
  .top-controls {
    flex-direction: column;
    align-items: stretch;
    top: 0.75rem;
    right: 0.75rem;
    left: 0.75rem;       /* span full width */
    gap: 6px;
  }
  .control-surface {
    width: 100%;
  }
  /* remove inline min-width from v-select and v-text-field */
}
```

The `style="min-width: 300px"` and `style="min-width: 360px"` inline styles on `v-select` and `v-text-field` are replaced with `style="width: 100%"`, controlled by the parent `.control-surface` width.

The `style="margin-left: 12px"` on the second `.control-surface` is removed (gap handles spacing).

---

## 4. PreviewCard (`src/components/PreviewCard.vue`)

### Width

```css
/* current */
width: 600px;

/* proposed */
width: clamp(300px, 90vw, 600px);
```

### Title font

```css
/* current */
.title { font-size: 2em; }

/* proposed */
.title { font-size: 1.4em; }
```

---

## 5. Farm Detail Page (`src/pages/insight/[farm_name].vue`)

Replace `VRow`/`VCol` with CSS Grid sections, same pattern as insight overview:

| Section | Desktop | Tablet (≤960px) | Mobile (≤600px) |
|---------|---------|-----------------|-----------------|
| Farm header / info block | full width | full width | full width |
| Donut + Bio Risk | `1fr 1fr` | `1fr 1fr` | `1fr` |
| Size Range + Source Degradation | `1fr 1fr` | `1fr 1fr` | `1fr` |
| Monthly Trend | full width | full width | full width |
| Color Drilldown | full width | full width | full width |

---

## Shared CSS Utility

Add a `.chart-grid` class to `src/styles/settings.scss` (or a new `src/styles/layout.scss` imported in `main.js`) with the base grid styles shared across both insight pages:

```scss
.chart-grid {
  display: grid;
  gap: 16px;
  margin-top: 16px;

  > .chart-card {
    background: white;
    padding: 20px;
    border-radius: 8px;
    box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
    height: 100%;
    min-width: 0; // prevent chart overflow
  }
}
```

`min-width: 0` on grid children is critical — without it, ApexCharts can overflow its grid cell.

---

## Out of Scope

- No changes to chart component internals (ApexCharts configs, data props)
- No changes to routing, stores, or composables
- No changes to `LeafletMap.vue` or map tile logic
- No changes to `mobile-warning.vue` or `useMobileWarning.js`

---

## Testing Checklist

- [ ] KPI row wraps correctly at 960px and 600px
- [ ] All chart rows collapse to single column at 600px
- [ ] No chart overflows its card on any breakpoint
- [ ] Map overlay controls stack vertically on mobile without clipping the map
- [ ] PreviewCard doesn't overflow viewport on screens < 600px
- [ ] `pnpm lint` passes
- [ ] `pnpm test` passes (no layout logic in tests, but verify no regressions)
