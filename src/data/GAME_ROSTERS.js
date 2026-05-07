// Playoff series rosters keyed by ESPN game id. Used as fallback when live schedule lacks data.

export const GAME_ROSTERS = {
  // ── COMPLETED Apr 30 (archived — not in TODAYS_GAMES) ─────────────────────
  // ATL @ NYK — Game 6 (NYK leads 3-2, IN PROGRESS: NYK 46 ATL 15 Q2)
  // ATL: Murray GONE (traded SUM24), De'Andre Hunter GONE (traded)
  //      NAW signed 4yr/$62M from MIN, Risacher rookie
  "e16d4c61": {
    home: "ATL", away: "NYK", homeTeam: "Atlanta Hawks", awayTeam: "New York Knicks",
    time: "7:00 PM ET", title: "Game 6", series: "NYK leads 3-2",
    restDays: { ATL: 1, NYK: 1 },
    NYK: ["jalen brunson", "karl-anthony towns", "og anunoby", "mikal bridges", "josh hart", "tyler kolek", "precious achiuwa"],
    ATL: ["trae young", "nickeil alexander-walker", "jalen johnson", "dyson daniels", "onyeka okongwu", "zaccharie risacher"]
  },

  // DEN @ MIN — Game 6 (MIN leads 3-2)
  // MIN: Edwards OUT (knee), DiVincenzo OUT (Achilles), Dosunmu from CHI
  // DEN: MPJ gone (BKN), Westbrook gone (SAC), Dosunmu gone (MIN), Cam Johnson in
  "a97cb053": {
    home: "MIN", away: "DEN", homeTeam: "Minnesota Timberwolves", awayTeam: "Denver Nuggets",
    time: "9:30 PM ET", title: "Game 6", series: "MIN leads 3-2",
    restDays: { MIN: 2, DEN: 2 },
    MIN: ["anthony edwards", "julius randle", "rudy gobert", "jaden mcdaniels", "naz reid", "mike conley", "terrence shannon jr", "bones hyland", "kyle anderson"],
    // ayo dosunmu: OUT (injury May 2026) — removed from active roster
    DEN: ["nikola jokic", "jamal murray", "cameron johnson", "aaron gordon", "christian braun", "bruce brown", "peyton watson"]
  },

  // ── UPCOMING May 1 ─────────────────────────────────────────────────────────
  // BOS @ PHI — Game 6 (BOS leads 3-2) — May 1 @ PHI
  "7d05403c": {
    home: "PHI", away: "BOS", homeTeam: "Philadelphia 76ers", awayTeam: "Boston Celtics",
    time: "May 1, 8:00 PM ET", title: "Game 6", series: "BOS leads 3-2",
    restDays: { PHI: 1, BOS: 1 },
    PHI: ["joel embiid", "tyrese maxey", "paul george", "quentin grimes", "kelly oubre jr", "vj edgecombe", "kyle lowry", "andre drummond", "trendon watford"],
    BOS: ["jayson tatum", "jaylen brown", "payton pritchard", "derrick white", "nikola vucevic", "sam hauser"]
  },

  // DET @ ORL — Game 6 (ORL leads 3-2) — May 1 @ ORL
  // ORL: Bane traded from MEM (summer 2025 — 4 picks deal)
  "0f33197a": {
    home: "ORL", away: "DET", homeTeam: "Orlando Magic", awayTeam: "Detroit Pistons",
    time: "Fri May 1, 7:00 PM ET", title: "Game 6", series: "ORL leads 3-2",
    restDays: { ORL: 1, DET: 1 },
    DET: ["cade cunningham", "tobias harris", "ausar thompson", "jalen duren", "isaiah stewart", "duncan robinson", "daniss jenkins", "marcus sasser", "paul reed"],
    ORL: ["paolo banchero", "desmond bane", "franz wagner", "jalen suggs", "wendell carter jr", "anthony black", "tristan da silva"]
  },

  // TOR @ CLE — Game 6 (CLE leads 3-2) — May 1 @ TOR
  // CLE: Harden came from LAC (for Darius Garland)
  "560d20d6": {
    home: "TOR", away: "CLE", homeTeam: "Toronto Raptors", awayTeam: "Cleveland Cavaliers",
    time: "Fri May 1, 7:30 PM ET", title: "Game 6", series: "CLE leads 3-2",
    restDays: { TOR: 1, CLE: 1 },
    CLE: ["donovan mitchell", "james harden", "evan mobley", "jarrett allen", "sam merrill", "keon ellis", "dean wade", "dennis schroder", "max strus"],
    TOR: ["scottie barnes", "brandon ingram", "rj barrett", "immanuel quickley", "jakob poeltl", "gradey dick", "jamal shead", "jakobe walter", "collin murray-boyles", "sandro mamukelashvili"]
  },

  // ── MAY 2 CONFIRMED ───────────────────────────────────────────────────────
  // PHI @ BOS — Game 7 (series tied 3-3) — PHI won G6 at home, G7 at BOS (HCA)
  // Confirmed: ESPN May 1, 4:30 PM MT / 6:30 PM ET, NBC/Peacock
  // Embiid: PROB (appendectomy recovery, per DK Network Apr 30)
  "bos-phi-g7": {
    home: "BOS", away: "PHI", homeTeam: "Boston Celtics", awayTeam: "Philadelphia 76ers",
    time: "May 2, 6:30 PM ET", title: "Game 7", series: "Series tied 3-3",
    restDays: { BOS: 1, PHI: 1 },
    BOS: ["jayson tatum", "jaylen brown", "payton pritchard", "derrick white", "nikola vucevic", "sam hauser"],
    PHI: ["joel embiid", "tyrese maxey", "paul george", "quentin grimes", "kelly oubre jr", "vj edgecombe", "kyle lowry", "andre drummond", "trendon watford"],
  },

  // ── R2: SAS @ MIN — Game 1 — May 4 2026 @ MIN ────────────────────────────
  // SA beat POR 3-1 in R1. MIN beat DEN in R1.
  // SA: Wembanyama active. Vassell active.
  // MIN: Edwards ACTIVE (returned), Dosunmu OUT (injury)
  "sas-min-r2g1": {
    home: "MIN", away: "SAS", homeTeam: "Minnesota Timberwolves", awayTeam: "San Antonio Spurs",
    time: "Mon May 4, 6:30 PM ET", title: "R2 Game 1", series: "Series tied 0-0",
    restDays: { MIN: 3, SAS: 5 },
    SAS: ["victor wembanyama", "de'aaron fox", "devin vassell", "dylan harper", "stephon castle", "julian champagnie"],
    MIN: ["anthony edwards", "julius randle", "rudy gobert", "jaden mcdaniels", "naz reid", "mike conley", "terrence shannon jr", "bones hyland", "kyle anderson"],
  },

  // ── MAY 3+ Game 7s now pulled DYNAMICALLY from ESPN's public scoreboard API ──
  // (server.py /api/schedule v5.4+ calls site.api.espn.com which posts conditional
  // Game 7s before NBA stats API does). Static fallback no longer needed for these.

  // HOU @ LAL — Game 6 (LAL leads 3-2) — May 1 @ HOU
  // LAL: AD traded to DAL for Luka (Feb 2025). Ayton signed FA. Reaves GTD.
  //      Luka OUT (hamstring). LeBron active and playing.
  // HOU: Durant OUT (bone bruise ankle — confirmed out G6). VanVleet OUT (ACL season).
  "2b36e831": {
    home: "HOU", away: "LAL", homeTeam: "Houston Rockets", awayTeam: "Los Angeles Lakers",
    time: "Fri May 1, 9:30 PM ET", title: "Game 6", series: "LAL leads 3-2",
    restDays: { HOU: 1, LAL: 1 },
    LAL: ["lebron james", "deandre ayton", "austin reaves", "rui hachimura", "marcus smart", "max christie", "luka doncic"],
    HOU: ["amen thompson", "alperen sengun", "jabari smith jr", "reed sheppard", "tari eason", "kevin durant", "steven adams", "clint capela"]
  },
};
// ── MAY 2 (TODAY) — PHI@BOS Game 7 confirmed; live schedule API takes priority ──
// Static fallback only used if /api/schedule fails. Live API now returns today's
// games dynamically via live scoreboard + tomorrow's via stats scoreboard.
export const TODAYS_GAMES = ["bos-phi-g7"];

// ── UPCOMING GAMES — fully dynamic via /api/schedule (ESPN-driven) ────────
// No static fallback needed. Server v5.4+ pulls from ESPN's public API
// which includes conditional Game 7s and the full playoff bracket.
export const UPCOMING_GAMES = [];
