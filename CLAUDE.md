# Claude Code Working Rules — nba-props (frontend)

These rules exist to keep token usage low. Follow them strictly.

## File reading
- **Use Grep, not Read,** to verify existence/location of code. Only Read when you need to edit a region.
- When Reading any file with >500 lines, **always pass `offset` + `limit`**. Never read the whole file.
- **Never re-read a file you already saw this session.** Work from memory + targeted Grep instead.
- `src/App.jsx` is large; the data constants live in `src/data/` and pure logic helpers live in `src/lib/`. Look there first before grepping App.jsx.

## Tone
- **No summary tables, no markdown recaps.** Respond in 1-3 lines unless explicitly asked to elaborate.
- After deploys/commits: confirm in one line (e.g., `Deployed v6.X — passing.`).
- Skip "verified live" smoke-test commentary unless something failed.
- Don't recap completed work.

## Tool use
- For broad searches, prefer the `Explore` subagent — it returns a summary instead of bloating main context.
- Batch Bash calls with `&&`; batch parallel tool calls in one message.
- Don't pipe verbose JSON into context; use `python -c "...print only what matters..."` to reduce noise.

## File structure (so you can grep instead of read)
- `src/App.jsx` — main component, JSX, hooks, render
- `src/data/PLAYER_DB.js` — static player stats fallback
- `src/data/TEAM_DATA.js` — team pace/eff dict
- `src/data/GAME_ROSTERS.js` — playoff series rosters
- `src/data/INJURIES.js` — static injury fallback (live data wins)
- `src/data/PROPS.js` — prop type definitions
- `src/lib/projection.js` — `computeProjection`, `lookupPlayer`, `dn`, `etToLocal`
- `src/lib/residuals.js` — residual storage + context capture
- `src/lib/grade.js` — `computeGrade` (LOCK/ACT/WATCH/SKIP)
- `src/styles.js` — exported `S` style string

## Deployment
- Frontend: `git push origin main` → Vercel auto-deploys.
- Backend repo is at `C:\Users\Brody\HelloWorld(python)\.claude\worktrees\serene-hamilton-fe3f00\` — separate CLAUDE.md there.

## Model
- Default to Sonnet for execution, edits, deploys, mechanical refactors.
- Only escalate to Opus for architecture decisions, novel algorithms, or hard debugging.
