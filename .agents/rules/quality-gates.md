## Quality Gates (Non-Negotiable)
After ANY file modification, run in order:
1. `tsc --noEmit` — must exit 0
2. `eslint src/ --max-warnings 0` — must exit 0
3. `vite build` — must exit 0 (catches tree-shaking/import errors)
Do NOT mark a task complete if any command fails.
All new game logic modules require a corresponding Vitest test file.