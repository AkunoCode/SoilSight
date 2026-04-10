---
name: soilsight-deploy-checklist
description: Use before running pnpm deploy to GitHub Pages in the SoilSight project
---

# Deploy Checklist

Run before every `pnpm deploy`.

## Steps

**1. Verify environment**
```bash
grep VITE_BASE_PATH .env
# Must be: VITE_BASE_PATH=/SoilSight/
```

**2. Run tests**
```bash
pnpm test
# All tests must pass — no failures, no skipped
```

**3. Lint**
```bash
pnpm lint
# Must complete with no errors
```

**4. Production build**
```bash
pnpm build
# Must complete without errors; check dist/ was created
```

**5. Preview smoke test** (optional but recommended)
```bash
pnpm preview
# Open http://localhost:4173/SoilSight/ — verify the app loads
```

**6. Deploy**
```bash
pnpm deploy
```

## Common Failures

| Symptom | Fix |
|---------|-----|
| App loads blank on GitHub Pages | `VITE_BASE_PATH` missing or wrong — must be `/SoilSight/` |
| 401/403 on Directus calls | `DIRECTUS_TOKEN` blank; app falls back to demo data (OK for deploy) |
| Build fails on type error | Fix the error — do not skip lint/type checks |
| `gh-pages` push rejected | Pull latest `gh-pages` branch or force-push only if safe |
