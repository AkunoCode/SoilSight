---
name: soilsight-directus-schema-sync
description: Use when verifying that field names referenced in SoilSight composables match the actual Directus schema
---

# Directus Schema Sync Agent

Dispatches a subagent to verify composables reference valid Directus field names.

## Dispatch Prompt

```
Audit field name consistency between the SoilSight composables and Directus schema.

1. Read src/composables/useInsightData.js — extract all field names accessed on site/sample objects
   (e.g. fragment_count, fiber_count, soilsamples, mass_kg, site_name, etc.)
2. Read src/composables/useInsightKPIs.js — extract same
3. Read src/composables/useInsightCharts.js — extract same
4. Read src/composables/useMapMarkers.js — extract same
5. Cross-reference against src/assets/dummyData.json — this is the canonical field structure

Report:
- Fields used in composables but NOT present in dummyData.json (potential mismatches)
- Fields in dummyData.json that are never accessed (potentially unused data)
- Any inconsistencies like sheet_count vs sheets_count (flag these specifically)
```

## When to Run

- When Directus schema changes are made upstream
- After adding new data fields to composables
- When data appears missing or zero unexpectedly in the UI
