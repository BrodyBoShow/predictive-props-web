// Prop type definitions: id, label, icon, statKey extractor for static fallback baseline.

export const PROPS = [
  { id: "points", label: "Points", icon: "🏀", short: "PTS", statKey: p => p.ppg, label3: "PPG" },
  { id: "rebounds", label: "Rebounds", icon: "💪", short: "REB", statKey: p => p.rpg, label3: "RPG" },
  { id: "assists", label: "Assists", icon: "🎯", short: "AST", statKey: p => p.apg, label3: "APG" },
  { id: "three_pointers", label: "3-Pointers Made", icon: "🔥", short: "3PM", statKey: p => +(p.ppg * (p.fg3 / 100) / 3).toFixed(1), label3: "3PM" },
  { id: "pra", label: "Pts+Reb+Ast", icon: "⚡", short: "PRA", statKey: p => +(p.ppg + p.rpg + p.apg).toFixed(1), label3: "PRA" },
  { id: "pa", label: "Pts+Ast", icon: "📊", short: "P+A", statKey: p => +(p.ppg + p.apg).toFixed(1), label3: "P+A" },
  { id: "pr", label: "Pts+Reb", icon: "📈", short: "P+R", statKey: p => +(p.ppg + p.rpg).toFixed(1), label3: "P+R" },
  { id: "ra", label: "Reb+Ast", icon: "🔄", short: "R+A", statKey: p => +(p.rpg + p.apg).toFixed(1), label3: "R+A" },
  { id: "steals", label: "Steals", icon: "🦅", short: "STL", statKey: p => p.spg, label3: "SPG" },
  { id: "blocks", label: "Blocks", icon: "🧱", short: "BLK", statKey: p => p.bpg, label3: "BPG" },
  { id: "turnovers", label: "Turnovers", icon: "❌", short: "TO", statKey: p => p.topg, label3: "TOV" },
];
