---
name: soilsight-chart-audit
description: Use when auditing all chart components in SoilSight for consistency, correctness, and shared config reuse
---

# Chart Audit Agent

Dispatches a subagent to audit all files in `src/components/graphs/`.

## Dispatch Prompt

```
Audit all Vue chart components in src/components/graphs/ of the SoilSight project.

For each component (skip ApexChartBase.vue itself), check:
1. Extends ApexChartBase — uses <ApexChartBase> in template, NOT <apexchart> directly
2. Sets fontFamily: 'inherit' in chart options
3. Sets toolbar: { show: false } in chart options
4. Has a hasData guard with a no-data fallback in the template
5. Does NOT duplicate config that belongs in useApexChart.js

Report as a table: component name, each check pass/fail, and specific fix needed.
Also list any chart config patterns duplicated across 2+ components that should be extracted to useApexChart.js.
```

## When to Run

- After adding 2+ new chart components
- Before a major refactor of the charts layer
- When `useApexChart.js` is updated and you want to verify consistency
