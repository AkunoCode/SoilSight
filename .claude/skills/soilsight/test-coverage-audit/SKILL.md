---
name: soilsight-test-coverage-audit
description: Use when checking for untested composables or components in SoilSight
---

# Test Coverage Audit Agent

Dispatches a subagent to find gaps in test coverage across `src/`.

## Dispatch Prompt

```
Audit test coverage in the SoilSight project (src/ directory).

1. List all composables in src/composables/*.js (exclude useDirectus.js — it wraps an SDK)
2. For each composable, check if a co-located *.test.js file exists
3. List all components in src/components/ and src/components/graphs/
4. For each component, check if a co-located *.test.js exists
5. Check src/pages/ for any page-level test files

Report:
- Composables with tests ✓ / without tests ✗
- Components with tests ✓ / without tests ✗
- Priority gaps: composables with complex logic but no tests (flag these)
- Suggest which 3 gaps would give the most coverage value to address first
```

## When to Run

- When starting a testing sprint
- After adding several new composables or components
- To prioritize test-writing work
