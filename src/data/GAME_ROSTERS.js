// Playoff game rosters — static fallback only.
// Live schedule is fully driven by the server's /api/schedule (ESPN scoreboard).
// Add entries here ONLY if the live API goes dark and you need a manual override.
// Key format: use the ESPN game ID (server prefixes with "espn-") or any unique slug.

export const GAME_ROSTERS = {};

// ── Static fallback — empty; live /api/schedule drives today's games ──
// Populate only if the live API is down.
export const TODAYS_GAMES = [];

// ── Upcoming — fully dynamic via /api/schedule ──
export const UPCOMING_GAMES = [];
