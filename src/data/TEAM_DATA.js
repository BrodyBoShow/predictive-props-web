// Static team data fallback. Live data overrides at runtime via /api/teams.
// rsPace: NBA.com 2025-26 RS pace · oEFF/dEFF: nbastuffer.com PO efficiency.
export const TEAM_DATA = {
  DET: { rsPace: 99.88, oEFF: 99.5, dEFF: 102.0, eDIFF: -2.5, fullName: "Detroit Pistons" },
  ORL: { rsPace: 100.56, oEFF: 102.0, dEFF: 99.5, eDIFF: 2.5, fullName: "Orlando Magic" },
  CLE: { rsPace: 100.70, oEFF: 111.6, dEFF: 112.4, eDIFF: -0.8, fullName: "Cleveland Cavaliers" },
  TOR: { rsPace: 99.22, oEFF: 112.4, dEFF: 111.6, eDIFF: 0.8, fullName: "Toronto Raptors" },
  LAL: { rsPace: 99.22, oEFF: 110.0, dEFF: 109.7, eDIFF: 0.3, fullName: "Los Angeles Lakers" },
  HOU: { rsPace: 96.98, oEFF: 109.7, dEFF: 110.0, eDIFF: -0.3, fullName: "Houston Rockets" },
  NYK: { rsPace: 97.71, oEFF: 117.8, dEFF: 106.6, eDIFF: 11.2, fullName: "New York Knicks" },
  ATL: { rsPace: 102.50, oEFF: 106.6, dEFF: 117.8, eDIFF: -11.2, fullName: "Atlanta Hawks" },
  BOS: { rsPace: 95.58, oEFF: 119.3, dEFF: 110.3, eDIFF: 9.0, fullName: "Boston Celtics" },
  PHI: { rsPace: 100.40, oEFF: 110.3, dEFF: 119.3, eDIFF: -9.0, fullName: "Philadelphia 76ers" },
  MIN: { rsPace: 101.50, oEFF: 112.3, dEFF: 109.3, eDIFF: 3.0, fullName: "Minnesota Timberwolves" },
  DEN: { rsPace: 99.49, oEFF: 109.3, dEFF: 112.3, eDIFF: -3.0, fullName: "Denver Nuggets" },
  // ── SA added May 4 2026 — R2 vs MIN ──────────────────────────────────────
  // rsPace: NBA.com RS 2025-26 — NEEDS VERIFICATION from user screenshot
  // PO oEFF/dEFF: vs POR R1 — NEEDS VERIFICATION from NBAsuffer
  SAS: { rsPace: 99.20, oEFF: 113.5, dEFF: 107.8, eDIFF: 5.7, fullName: "San Antonio Spurs" },
};
export const LEAGUE_AVG_dEFF = 113.5;

export const LEAGUE_AVG_PACE = 100.0;   // NBA 2025-26 RS league average pace
export const LEAGUE_AVG_AST_CONV = 0.30; // ~30% of potential assists → actual assists (NBA PO baseline)
