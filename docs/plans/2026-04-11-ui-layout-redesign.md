# UI Layout Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace hardcoded Vuetify VRow/VCol grids with CSS Grid layouts across all three views, reduce oversized font sizes, and make every page mobile-responsive at 960px and 600px breakpoints.

**Architecture:** Introduce a shared `layout.scss` with `.chart-grid` and `.chart-card` utilities imported globally. Each page template replaces `VRow`/`VCol` wrappers with semantic `<div class="chart-grid ...">` wrappers. Breakpoints are defined in `layout.scss` so all pages stay in sync. No changes to chart component internals, stores, or composables.

**Tech Stack:** Vue 3, Vuetify 3, SCSS, CSS Grid

---

## File Map

| File | Change |
|------|--------|
| `src/styles/layout.scss` | **Create** — shared `.chart-grid`, `.chart-card`, breakpoint variables |
| `src/styles/settings.scss` | **Modify** — `@use './layout'` at bottom |
| `src/components/KPI.vue` | **Modify** — reduce font sizes in `<style scoped>` |
| `src/pages/insight/index.vue` | **Modify** — KPI row grid + replace all VRow/VCol with `.chart-grid` sections |
| `src/pages/index.vue` | **Modify** — breadcrumb font sizes + top-controls mobile CSS |
| `src/components/PreviewCard.vue` | **Modify** — `width: clamp(...)`, `.title` font size |
| `src/pages/insight/[farm_name].vue` | **Modify** — replace all VRow/VCol with `.chart-grid` sections |

---

## Task 1: Shared layout CSS

**Files:**
- Create: `src/styles/layout.scss`
- Modify: `src/styles/settings.scss`

- [ ] **Step 1: Create `src/styles/layout.scss`**

```scss
// src/styles/layout.scss
// Shared grid utilities for chart pages.
// All chart grid sections use .chart-grid as the container and .chart-card for each cell.

.chart-grid {
  display: grid;
  gap: 16px;
  margin-top: 16px;

  // Prevent ApexCharts from overflowing their grid cell
  > .chart-card,
  > * {
    min-width: 0;
  }
}

.chart-card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
  height: 100%;
}

// Column helpers — apply as additional class on .chart-grid
.grid-2col { grid-template-columns: 1fr 1fr; }
.grid-3col { grid-template-columns: repeat(3, 1fr); }
.grid-4col-auto { grid-template-columns: repeat(4, 1fr) auto; }
.grid-col-5-7 { grid-template-columns: 5fr 7fr; }
.grid-col-4-5-3 { grid-template-columns: 4fr 5fr 3fr; }
.grid-col-8-4 { grid-template-columns: 8fr 4fr; }
.grid-full { grid-template-columns: 1fr; }

// Span full row
.col-full { grid-column: 1 / -1; }

@media (max-width: 960px) {
  .grid-3col,
  .grid-4col-auto,
  .grid-col-4-5-3,
  .grid-col-8-4 {
    grid-template-columns: 1fr 1fr;
  }

  .grid-4col-auto .col-full,
  .grid-col-4-5-3 .col-full {
    grid-column: 1 / -1;
  }
}

@media (max-width: 600px) {
  .chart-grid {
    grid-template-columns: 1fr !important;
    gap: 12px;
  }

  .col-full {
    grid-column: 1 / -1;
  }
}
```

- [ ] **Step 2: Import layout.scss in settings.scss**

Open `src/styles/settings.scss` and append at the bottom:

```scss
@use './layout';
```

- [ ] **Step 3: Run dev server to confirm no SCSS errors**

```bash
pnpm dev
```

Expected: server starts without SCSS compilation errors. Stop with Ctrl+C.

- [ ] **Step 4: Run lint**

```bash
pnpm lint
```

Expected: no new lint errors.

- [ ] **Step 5: Commit**

```bash
git add src/styles/layout.scss src/styles/settings.scss
git commit -m "style: add shared chart-grid layout utilities with responsive breakpoints"
```

---

## Task 2: KPI component font reductions

**Files:**
- Modify: `src/components/KPI.vue`

- [ ] **Step 1: Replace `<style scoped>` in `src/components/KPI.vue`**

Find the existing `<style scoped>` block (lines 17–49) and replace it entirely:

```css
<style scoped>
.kpi-card {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  justify-content: center;
  background: white;
  padding: 14px 16px;
  border-radius: 10px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, 0.06);
}

.kpi-title {
  font-size: 13px;
  color: rgba(0, 0, 0, 0.6);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  margin-bottom: 4px;
}

.kpi-value {
  font-size: 20px;
  font-weight: 700;
  color: rgba(0, 0, 0, 0.9);
  line-height: 1.1;
}

.kpi-subtitle {
  margin-top: 3px;
  font-size: 11px;
  color: rgba(0, 0, 0, 0.55);
}
</style>
```

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/KPI.vue
git commit -m "style: reduce KPI card font sizes (value 32→20px, title 18→13px, subtitle 18→11px)"
```

---

## Task 3: Insight overview — KPI row grid

**Files:**
- Modify: `src/pages/insight/index.vue`

The KPI row currently uses `.columns` with `grid-template-columns: repeat(5, 1fr)` (line 283 in `<style scoped>`). The Print Report button uses hardcoded Vuetify utility classes with `text-h4` (large font).

- [ ] **Step 1: Update `.columns` CSS in `src/pages/insight/index.vue`**

Find in `<style scoped>`:
```css
.columns {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 16px;
  flex-wrap: wrap;
}
```

Replace with:
```css
.columns {
  display: grid;
  grid-template-columns: repeat(4, 1fr) auto;
  gap: 10px;
  align-items: stretch;
}

@media (max-width: 960px) {
  .columns {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (max-width: 600px) {
  .columns {
    grid-template-columns: 1fr;
  }
}
```

Also remove the now-irrelevant rule below it:
```css
@media (max-width: 900px) {
  .columns {
    flex-direction: column;
  }

  .crop-list {
    columns: 1;
  }
}
```

And update it to only keep the crop-list part (the columns rule is replaced above):
```css
@media (max-width: 600px) {
  .crop-list {
    columns: 1;
  }
}
```

- [ ] **Step 2: Reduce Print Report button font**

Find in the template (around line 115–128):
```html
<p class="text-h4 text-white font-weight-bold">Print Report</p>
```

Replace with:
```html
<p class="text-body-1 text-white font-weight-bold">Print Report</p>
```

Also remove the `ga-2` class on the same div (spacing is now handled by padding):
```html
class="d-flex align-center justify-center bg-blue ga-2 pa-4 px-6 rounded-lg cursor-pointer"
```
→
```html
class="d-flex align-center justify-center bg-blue pa-3 px-5 rounded-lg cursor-pointer"
```

- [ ] **Step 3: Run lint**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/pages/insight/index.vue
git commit -m "style: fix KPI row grid — fluid 4-col+auto layout with responsive breakpoints"
```

---

## Task 4: Insight overview — chart grid refactor

**Files:**
- Modify: `src/pages/insight/index.vue`

Replace the five `VRow`/`VCol` chart sections (lines 130–258) with `.chart-grid` divs. Remove the unused `kpi`, `kpi-num`, `v-separator`, `kpi-body`, `bottom-card`, `summary-box`, `report-preview`, `report-content`, `crop-list` CSS rules that are no longer needed after this change.

- [ ] **Step 1: Replace chart rows in template**

Find the block starting at line 130 (`<VRow class="mt-2">`) through line 258 (`</VRow>`) and replace with:

```html
<!-- Row 1: AI Summary + Farms List -->
<div class="chart-grid grid-2col">
  <div class="chart-card">
    <VSkeletonLoader v-if="loading" type="article" />
    <AISummary v-else />
  </div>
  <div class="chart-card list-card">
    <VSkeletonLoader v-if="loading" type="heading, list-item-two-line" />
    <template v-else>
      <h3 class="mb-2">Contamination Density by Farm Practice</h3>
      <SampledFarms :sampled-sites="sites" />
    </template>
  </div>
</div>

<!-- Row 2: Bar + Heatmap + Degradation -->
<div class="chart-grid grid-3col">
  <div class="chart-card">
    <VSkeletonLoader v-if="loading" height="400" type="image" />
    <MPPracticeBar
      v-else
      :filter-key="app.selectedMorphology"
      :height="400"
      :options="contaminationByPracticeOptions"
      :series="contaminationByPracticeSeries"
      :subtitle="`Data as of ${displayLatestSampleDate}`"
      title="Contamination Comparison by Farm Practices"
    />
  </div>
  <div class="chart-card">
    <template v-if="loading">
      <VSkeletonLoader type="heading" />
      <VSkeletonLoader class="mt-2" height="400" type="image" />
    </template>
    <template v-else>
      <h3>Source Identification Heatmap</h3>
      <p class="subtitle mb-2">Microplastic Counts by Source and Plastic Type</p>
      <SourceIdentificationHeatmap height="400" :sites="sites" />
    </template>
  </div>
  <div class="chart-card">
    <VSkeletonLoader v-if="loading" height="400" type="image" />
    <SourceDegradationIndex v-else height="400" :sites="sites" />
  </div>
</div>

<!-- Row 3: Donut + Bio Risk -->
<div class="chart-grid grid-col-5-7">
  <div aria-label="Microplastic morphology distribution donut chart" class="chart-card">
    <VSkeletonLoader v-if="loading" height="360" type="image" />
    <MPDonutChart
      v-else
      :active-key="app.selectedMorphology"
      :colors="donutColors"
      :height="360"
      :labels-map="donutLabelsMap"
      :microplastic-data="microplasticData"
      :subtitle="`Data as of ${displayLatestSampleDate}`"
      @selection="handleLegendClick"
    />
  </div>
  <div class="chart-card">
    <VSkeletonLoader v-if="loading" height="360" type="image" />
    <BiologicalRiskChart
      v-else
      :data="biologicalRiskData"
      :height="360"
      :loading="!sizeComparisonAll || !sizeComparisonAll.categories?.length"
      :subtitle="`Data as of ${displayLatestSampleDate}`"
    />
  </div>
</div>

<!-- Row 4: Boxplot + Color Drilldown -->
<div class="chart-grid grid-2col">
  <div aria-label="Soil trap efficiency boxplot chart" class="chart-card">
    <VSkeletonLoader v-if="loading" height="360" type="image" />
    <SoilTrapEfficiencyBoxplot v-else height="360" :sites="sites" />
  </div>
  <div class="chart-card">
    <VSkeletonLoader v-if="loading || colorComparisonLoading" height="360" type="image" />
    <template v-else-if="colorComparisonAll && colorComparisonAll.totals && colorComparisonAll.totals.length > 0">
      <SiteDrilldownChart
        :categories="colorComparisonAll.categories"
        :category-labels="['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets']"
        :colors="mpColors"
        :drilldown="colorComparisonAll.drilldown"
        :filter-key="app.selectedMorphology"
        :height="360"
        title="Microplastic Count by Color"
        :totals="colorComparisonAll.totals"
      />
    </template>
    <template v-else>
      <div style="padding: 20px; text-align:center; color: #666;">
        <p style="margin:0; font-weight:600">Microplastic Count by Color</p>
        <p style="margin:8px 0 0;">No color aggregation data available yet.</p>
      </div>
    </template>
  </div>
</div>

<!-- Row 5: Monthly Trend -->
<div class="chart-grid grid-full">
  <div class="chart-card">
    <VSkeletonLoader v-if="loading" height="340" type="image" />
    <MonthlyTrendChart
      v-else
      :colors="mpColors"
      :filter-key="app.selectedMorphology"
      :height="340"
      :microplastic-data="microplasticData"
      :subtitle="`Data as of ${displayLatestSampleDate}`"
    />
  </div>
</div>
```

- [ ] **Step 2: Clean up unused CSS rules in `<style scoped>`**

Remove these now-unused rules from `src/pages/insight/index.vue` `<style scoped>`:
- `.kpi { ... }`
- `.kpi-num { ... }`
- `.v-separator { ... }`
- `.kpi-body { ... }`
- `.card { ... }` (replaced by global `.chart-card`)
- `.bottom-card { ... }`
- `.bottom-card:not(:first-of-type) { ... }`
- `.summary-box { ... }`
- `.report-preview { ... }`
- `.report-content { ... }`
- `.report-content :deep(li) { ... }`
- `.crop-list { ... }`

Keep: `.insight-page`, `.page-header`, `.subtitle`, `.columns` and the responsive rules added in Task 3.

- [ ] **Step 3: Run lint**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: all pass (no tests cover layout structure).

- [ ] **Step 5: Commit**

```bash
git add src/pages/insight/index.vue
git commit -m "refactor: replace VRow/VCol with CSS Grid in insight overview page"
```

---

## Task 5: Map page — breadcrumb fonts + mobile controls

**Files:**
- Modify: `src/pages/index.vue`

- [ ] **Step 1: Reduce breadcrumb font sizes**

Find in `<style>` (not scoped — global styles):

```css
.breadcrumb-subtitle {
  color: rgb(74, 74, 74);
  font-weight: 600;
  font-size: 18px;
  margin: 0;
}

.breadcrumb-title {
  margin: 0;
  color: rgb(0, 0, 0);
  font-weight: 800;
  font-size: 32px;
  letter-spacing: -0.5px;
  line-height: 1em;
}
```

Replace with:

```css
.breadcrumb-subtitle {
  color: rgb(74, 74, 74);
  font-weight: 600;
  font-size: 13px;
  margin: 0;
}

.breadcrumb-title {
  margin: 0;
  color: rgb(0, 0, 0);
  font-weight: 800;
  font-size: 22px;
  letter-spacing: -0.5px;
  line-height: 1.1em;
}
```

- [ ] **Step 2: Add mobile responsive rules for breadcrumb and top controls**

Append to the end of the `<style>` block (before the closing `</style>`):

```css
@media (max-width: 600px) {
  .breadcrumb-subtitle {
    font-size: 11px;
  }

  .breadcrumb-title {
    font-size: 16px;
  }

  .top-controls {
    flex-direction: column;
    align-items: stretch;
    top: 0.75rem;
    right: 0.75rem;
    left: 0.75rem;
    gap: 6px;
  }

  .control-surface {
    width: 100%;
  }
}
```

- [ ] **Step 3: Remove inline min-width styles from v-select and v-text-field**

Find in the template:
```html
<v-select
  ...
  style="min-width: 300px;"
  ...
/>
```
Replace `style="min-width: 300px;"` with `style="width: 100%;"`.

Find:
```html
<v-text-field
  ...
  style="min-width: 360px;"
  ...
/>
```
Replace `style="min-width: 360px;"` with `style="width: 100%;"`.

Find the `style="margin-left: 12px;"` on the second `.control-surface` div and remove it (the `gap` on `.top-controls` handles spacing).

- [ ] **Step 4: Run lint**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/pages/index.vue
git commit -m "style: reduce breadcrumb font sizes and add mobile-responsive map overlay controls"
```

---

## Task 6: PreviewCard — fluid width + title font

**Files:**
- Modify: `src/components/PreviewCard.vue`

- [ ] **Step 1: Update `.preview-card` width and `.title` font**

Find in `<style scoped>`:
```css
.preview-card {
  position: fixed;
  right: 20px;
  background: white;
  padding: 1em 1.5em;
  border-radius: 1em 1em 0 0;
  box-shadow: 0 4px 8px rgba(0, 0, 0, 0.385);
  width: 600px;
  z-index: 1000;
  user-select: none;
  transition: box-shadow 0.2s ease, bottom 0.4s cubic-bezier(0.4, 0, 0.2, 1);
}
```

Change `width: 600px;` to `width: clamp(300px, 90vw, 600px);`.

Find:
```css
.title {
  margin: 0;
  font-weight: bold;
  font-size: 2em;
}
```

Change `font-size: 2em;` to `font-size: 1.4em;`.

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/PreviewCard.vue
git commit -m "style: make PreviewCard fluid width (clamp 300–600px) and reduce title font"
```

---

## Task 7: Farm detail page — info row (Row 1)

**Files:**
- Modify: `src/pages/insight/[farm_name].vue`

The current layout is a single `VRow` with `VCol cols="4"` (map), `VCol cols="5"` (nested rows), `VCol cols="3"` (activities). The nested rows have further VCol splits.

- [ ] **Step 1: Replace Row 1 outer VRow with CSS Grid**

Find in the template (around line 577):
```html
<!-- Row 1: location / farm info / activities -->
<VRow>
  <VCol cols="4">
    ...
  </VCol>
  <VCol cols="5">
    <VRow>
      <VCol cols="8">...</VCol>
      <VCol cols="4">...</VCol>
    </VRow>
    <VRow>
      <VCol cols="4">...</VCol>
      <VCol cols="4">...</VCol>
      <VCol cols="4">...</VCol>
    </VRow>
  </VCol>
  <VCol cols="3">
    ...
  </VCol>
</VRow>
```

Replace with (keep all inner content unchanged, only change the wrapper divs):

```html
<!-- Row 1: location / farm info / activities -->
<div class="chart-grid grid-col-4-5-3">
  <div class="chart-card">
    <!-- Geographic Location content unchanged -->
    <VSkeletonLoader v-if="!farm" type="heading, image" />
    <template v-else>
      <h3 class="text-h5 font-weight-bold">Geographic Location</h3>
      <p class="mb-2">{{ farm.latitude }}, {{ farm.longitude }}</p>
      <div v-if="farm.latitude != null && farm.longitude != null" class="map-wrapper">
        <LeafletMap :lat="Number(farm.latitude)" :lng="Number(farm.longitude)" :zoom="13" />
      </div>
      <div v-else class="card">
        <p>No coordinates available for this farm.</p>
      </div>
    </template>
  </div>

  <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
    <!-- Cultivation + Crops -->
    <div style="display:grid;grid-template-columns:2fr 1fr;gap:16px;min-width:0">
      <div class="chart-card">
        <VSkeletonLoader v-if="!farm" type="article" />
        <template v-else>
          <h3 class="text-h5 font-weight-bold mb-4">{{ titleCase(farm.cultivation_practice) }} Farming</h3>
          <p>{{ getCultivationDefinition(farm.cultivation_practice) }}</p>
          <div class="card-footer">
            <a
              class="learn-more"
              :href="`https://www.google.com/search?q=${encodeURIComponent(farm.cultivation_practice ? farm.cultivation_practice + ' cultivation practice' : 'cultivation practice')}`"
              rel="noopener noreferrer"
              target="_blank"
            >
              <VIcon class="mr-2" size="small">mdi-open-in-new</VIcon>
              Learn more
            </a>
          </div>
        </template>
      </div>
      <div class="chart-card">
        <VSkeletonLoader v-if="!farm" type="list-item-two-line@3" />
        <template v-else>
          <h3 class="text-h5 font-weight-bold mb-4">Crops Grown</h3>
          <div class="crops-list">
            <ul>
              <li v-for="(crop, index) in farm.crops" :key="index">{{ titleCase(crop) }}</li>
            </ul>
          </div>
        </template>
      </div>
    </div>

    <!-- Land Area + Water Source + Soil Texture -->
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;min-width:0">
      <div class="chart-card">
        <VSkeletonLoader v-if="!farm" type="heading, subtitle" />
        <template v-else>
          <h3 class="text-h6 font-weight-bold text-center">Land Area</h3>
          <p class="text-h3 font-weight-bold text-center">{{ farm.land_area_ha }}</p>
          <p class="text-h5 font-weight-bold text-center">hectares</p>
        </template>
      </div>
      <div class="chart-card">
        <VSkeletonLoader v-if="!farm" type="heading, avatar, subtitle" />
        <template v-else>
          <h3 class="text-h6 font-weight-bold text-center">Water Source</h3>
          <div class="icon-container bg-blue">
            <VIcon color="white" size="x-large">{{ waterIcon }}</VIcon>
          </div>
          <p class="text-h5 font-weight-bold text-center">{{ titleCase(farm.water_source) }}</p>
        </template>
      </div>
      <div class="chart-card">
        <VSkeletonLoader v-if="!farm" type="heading, avatar, subtitle" />
        <template v-else>
          <h3 class="text-h6 font-weight-bold text-center">Soil Texture</h3>
          <div class="icon-container bg-brown">
            <VIcon color="white" size="x-large">mdi-image-filter-hdr</VIcon>
          </div>
          <p class="text-h5 font-weight-bold text-center">{{ titleCase(farm.soil_type) }}</p>
        </template>
      </div>
    </div>
  </div>

  <div class="chart-card">
    <!-- Plastic Activities content unchanged -->
    <VSkeletonLoader v-if="!farm" type="list-item-two-line@5" />
    <template v-else>
      <h3 class="text-h5 font-weight-bold mb-4">Plastic-Related Activities</h3>
      <template v-for="activity in plasticActivityList" :key="activity">
        <div class="d-flex align-center justify-space-between mb-2">
          <p>{{ activity }}</p>
          <VIcon :color="farmHasActivity(activity) ? 'green' : 'red'" size="large">
            {{ farmHasActivity(activity) ? 'mdi-check-circle' : 'mdi-close-circle' }}
          </VIcon>
        </div>
        <div class="horizontal-bar" />
      </template>
    </template>
  </div>
</div>
```

- [ ] **Step 2: Run lint**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/pages/insight/[farm_name].vue
git commit -m "refactor: replace farm detail Row 1 VRow/VCol with CSS Grid"
```

---

## Task 8: Farm detail page — charts rows (Rows 2 & 3)

**Files:**
- Modify: `src/pages/insight/[farm_name].vue`

- [ ] **Step 1: Replace Row 2 (charts) and Row 3 (AI summary)**

Find (around line 686):
```html
<!-- Row 2: charts -->
<VRow class="mt-4">
  <VCol cols="4">
    <div class="d-flex flex-column ga-4">
      ...donut + site drilldown...
    </div>
  </VCol>
  <VCol cols="8">
    <div class="d-flex flex-column ga-4">
      ...monthly trend...
      <VRow>
        <VCol cols="5">...source degradation...</VCol>
        <VCol cols="7">...bio risk...</VCol>
      </VRow>
    </div>
  </VCol>
</VRow>

<!-- Row 3: AI summary -->
<VRow class="mt-4">
  <VCol cols="12">
    <div class="card">...</div>
  </VCol>
</VRow>
```

Replace with:

```html
<!-- Row 2: charts -->
<div class="chart-grid grid-col-8-4" style="align-items:start">
  <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
    <div class="chart-card">
      <VSkeletonLoader v-if="!farm" height="320" type="image" />
      <MonthlyTrendChart
        v-else
        :date="displaySampleDate"
        :filter-key="app.selectedMorphology"
        :height="320"
        :site-id="farm.id"
        :title="`Monthly Microplastic Trend for ${farm.site_name}`"
      />
    </div>
    <div style="display:grid;grid-template-columns:5fr 7fr;gap:16px;min-width:0">
      <div class="chart-card">
        <VSkeletonLoader v-if="!farm" height="260" type="image" />
        <SourceDegradationIndex v-else :height="260" :sites="farmAsArray" />
      </div>
      <div class="chart-card">
        <VSkeletonLoader v-if="!farm || sizeComparisonLoading" height="260" type="image" />
        <BiologicalRiskChart v-else :data="biologicalRiskData" :height="260" :loading="false" />
      </div>
    </div>
  </div>

  <div style="display:flex;flex-direction:column;gap:16px;min-width:0">
    <div class="chart-card">
      <VSkeletonLoader v-if="!farm" height="300" type="image" />
      <MPDonutChart
        v-else
        :active-key="app.selectedMorphology"
        :date="displaySampleDate"
        :microplastic-data="microplasticData"
        @selection="handleDonutSelection"
      />
    </div>
    <div class="chart-card">
      <VSkeletonLoader v-if="!farm || colorComparisonLoading" height="250" type="image" />
      <SiteDrilldownChart
        v-else
        :categories="anonymizedComparison.categories"
        :category-labels="['Fragments', 'Fibers', 'Foam', 'Films', 'Sheets']"
        :colors="mpColors"
        :date="displaySampleDate"
        :drilldown="anonymizedComparison.drilldown"
        :filter-key="app.selectedMorphology"
        :height="250"
        :title="farm.cultivation_practice ? `Contamination Comparison to Other ${titleCase(farm.cultivation_practice)} Farms` : 'Contamination Comparison to Other Farms'"
        :totals="anonymizedComparison.totals"
      />
    </div>
  </div>
</div>

<!-- Row 3: AI summary -->
<div class="chart-grid grid-full">
  <div class="chart-card">
    <VSkeletonLoader v-if="!farm" type="article" />
    <AISummary
      v-else
      :is-overview="false"
      :item="farm"
      :max-height="'200px'"
      :title="'AI Diagnosis'"
    />
  </div>
</div>
```

- [ ] **Step 2: Remove `.card` rule from `<style scoped>` since `.chart-card` is now global**

Find in `<style scoped>`:
```css
.card {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 1px 6px rgba(0, 0, 0, .06);
  height: 100%;
  display: flex;
  flex-direction: column;
}
```

Remove it. The global `.chart-card` from `layout.scss` provides the same styles. Keep all other rules (`horizontal-bar`, `crops-list`, `icon-container`, `card-footer`, `learn-more`, `map-wrapper`, `.insight-page`).

- [ ] **Step 3: Run lint**

```bash
pnpm lint
```

Expected: no errors.

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add src/pages/insight/[farm_name].vue
git commit -m "refactor: replace farm detail chart rows VRow/VCol with CSS Grid"
```

---

## Task 9: Final verification

- [ ] **Step 1: Start dev server and do a visual pass**

```bash
pnpm dev
```

Open http://localhost:3000 and check:
- [ ] Map page: breadcrumb text is smaller, controls side-by-side on desktop
- [ ] Map page at 600px viewport: controls stack vertically, breadcrumb shrinks
- [ ] Insight overview page: KPI row shows 4 KPIs + print button in one row on desktop, wraps to 2-col at 960px
- [ ] Insight overview page: all chart rows align cleanly with no overflow
- [ ] Insight overview at 600px: all charts stack single column
- [ ] Farm detail page: 3-column info row on desktop, collapses at 960px
- [ ] Farm detail page: charts align without horizontal overflow
- [ ] PreviewCard on map page: draggable card width shrinks on narrow viewports

- [ ] **Step 2: Run full test suite**

```bash
pnpm test
```

Expected: all pass.

- [ ] **Step 3: Run lint**

```bash
pnpm lint
```

Expected: no errors.
