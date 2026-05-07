// Static injury fallback. ONLY used when /api/injuries (live ESPN + NBA boxscore) is unreachable.
// Live data fully supersedes this dict in normal operation. Keep to confirmed long-term outs.

export const INJURIES = {
  "fred vanvleet":    { status: "OUT", detail: "Right knee ACL repair — out for season" },
  "donte divincenzo": { status: "OUT", detail: "Right Achilles repair — out for season" },
  "steven adams":     { status: "OUT", detail: "Left ankle surgery — out for season" },
  "luka doncic":      { status: "OUT", detail: "Left hamstring strain — no timetable" },
  "franz wagner":     { status: "OUT", detail: "Calf strain — confirmed OUT (ESPN May 3 2026)" },
  // ayo dosunmu — REMOVED May 7 2026: live boxscore confirmed playing.
  //   Dynamic clearance handled server-side via /api/injuries auto_cleared.
  // All other statuses (GTD, PROB, returning players) come from live ESPN feed
};

