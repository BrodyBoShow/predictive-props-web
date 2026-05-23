import React, { useState, useCallback, useRef, useEffect, useMemo } from "react";
import { BarChart, Bar, XAxis, YAxis, ReferenceLine, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { TEAM_DATA, LEAGUE_AVG_dEFF, LEAGUE_AVG_PACE, LEAGUE_AVG_AST_CONV } from './data/TEAM_DATA.js';
import { PLAYER_DB } from './data/PLAYER_DB.js';
import { INJURIES } from './data/INJURIES.js';
import { GAME_ROSTERS, TODAYS_GAMES, UPCOMING_GAMES } from './data/GAME_ROSTERS.js';
import { PROPS } from './data/PROPS.js';
import { S } from './styles.js';

// ── NBA API BACKEND ───────────────────────────────────────────────────────────
// Run: pip install flask flask-cors nba_api && python server.py
// Serves real NBA.com stats. JSX falls back to static PLAYER_DB/TEAM_DATA if offline.
const API_BASE = "https://nba-props-api-43yl.onrender.com/api";

// ── TEAM DATA ─────────────────────────────────────────────────────────────────
// rsPace: 2025-26 REGULAR SEASON pace — NBA.com/stats Teams > Advanced > Regular Season
//   Per Game, All Season Segments, 82 games. Screenshot verified by user Apr 30 2026.
//   This is the PRIMARY source — official NBA data, more precise than third-party aggregators.
// oEFF/dEFF/eDIFF: 2026 PLAYOFF efficiency — NBAsuffer.com, updated Apr 30 2026

// P: per-game stat line. usg=usage%, ts=true shooting%
// Source: NBA.com Players > Advanced (RS) and Players > Advanced (Playoffs)
// E: player entry. onOffDelta = on-court NETRTG minus off-court NETRTG
// Source: NBA.com On/Off Court > Advanced > Playoffs 2025-26
// Positive = player's presence improves team net rating (player helps)
// Null = not in screenshots yet


// ── INJURY FLAGS — OFFLINE FALLBACK ONLY ─────────────────────────────────────
// This dict is ONLY used when /api/injuries is completely unreachable.
// In normal operation the live ESPN feed from /api/injuries takes full priority.
// Keep only confirmed season-ending / long-term OUT injuries here.
// DO NOT add day-to-day or returning players — live API handles those.
// Updated: May 4 2026

// ── LIVE SCHEDULE — built from Sportradar API Apr 30 2026 ─────────────────────
// Game 5 results from last night (Apr 29):
//   DET 116 ORL 109  → DET leads 3-2
//   CLE 125 TOR 120  → CLE leads 3-2
//   HOU 99  LAL 93   → HOU wins, LAL still leads series 3-2
// PHI beat BOS in Game 5 (PHI 113 BOS 97) → PHI leads 3-2
// ── GAME ROSTERS ─────────────────────────────────────────────────────────────
// restDays: days since each team's last game — pure arithmetic from Sportradar start_time.
//   Sportradar game dates (UTC converted to ET):
//   ATL/NYK G5: Apr 28 ET → G6 Apr 30 → 1 day rest each
//   PHI/BOS G5: Apr 28 ET → G6 Apr 30 → 1 day rest each
//   MIN/DEN G5: Apr 27 ET → G6 Apr 30 → 2 days rest each
//   DET/ORL G5: Apr 29 ET → G6 May 1  → 1 day rest each
//   CLE/TOR G5: Apr 29 ET → G6 May 1  → 1 day rest each
//   HOU/LAL G5: Apr 29 ET → G6 May 1  → 1 day rest each
// ── GAME ROSTERS — verified from Sportradar live API Apr 30 2026 ──────────────
// Series records from playoff_series endpoint (record = wins)
// Rosters verified against ESPN, NBA.com, Basketball-Reference Apr 30 2026
// ── MAY 2 (TODAY) — PHI@BOS Game 7 confirmed; live schedule API takes priority ──
// Static fallback only used if /api/schedule fails. Live API now returns today's
// games dynamically via live scoreboard + tomorrow's via stats scoreboard.

// ── UPCOMING GAMES — fully dynamic via /api/schedule (ESPN-driven) ────────
// No static fallback needed. Server v5.4+ pulls from ESPN's public API
// which includes conditional Game 7s and the full playoff bracket.


function lookupPlayer(name, db = PLAYER_DB) {
  const lc = (name || "").toLowerCase().replace(/[^a-z '-]/g, "").trim();
  if (!lc) return null;
  if (db[lc]) return { key: lc, ...db[lc] };
  const parts = lc.split(" ").filter(p => p.length > 2);
  for (const [k, v] of Object.entries(db)) { if (parts.length && parts.every(p => k.includes(p))) return { key: k, ...v }; }
  const last = parts[parts.length - 1];
  for (const [k, v] of Object.entries(db)) { if (last && last.length > 3 && k.includes(last)) return { key: k, ...v }; }
  return null;
}

function dn(k) { return k.split(" ").map(w => w[0].toUpperCase() + w.slice(1)).join(" "); }

function etToLocal(timeStr) {
  const timeMatch = timeStr.match(/(\d+):(\d+)\s*(AM|PM)/i);
  if (!timeMatch) return timeStr;
  let h = parseInt(timeMatch[1]);
  const m = parseInt(timeMatch[2]);
  if (timeMatch[3].toUpperCase() === "PM" && h !== 12) h += 12;
  if (timeMatch[3].toUpperCase() === "AM" && h === 12) h = 0;
  const MONTHS = { Jan:0,Feb:1,Mar:2,Apr:3,May:4,Jun:5,Jul:6,Aug:7,Sep:8,Oct:9,Nov:10,Dec:11 };
  const dateMatch = timeStr.match(/(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun)[,.]?\s+(\w{3})\s+(\d+)/i);
  const now = new Date();
  const month = dateMatch ? (MONTHS[dateMatch[1]] ?? now.getMonth()) : now.getMonth();
  const day = dateMatch ? parseInt(dateMatch[2]) : now.getDate();
  // EDT = UTC-4 in May/June playoffs
  const utc = new Date(Date.UTC(now.getFullYear(), month, day, h + 4, m));
  const isToday = utc.toLocaleDateString() === now.toLocaleDateString();
  const timePart = utc.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", timeZoneName: "short" });
  if (isToday) return timePart;
  return utc.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" }) + ", " + timePart;
}

// playerSplits = {home, road} from /api/splits · teamDef from /api/team-defense
// scoring = {pctPts3pt, pctPtsPaint, ...} from /api/scoring (LeagueDashPlayerStats Scoring)
// clutch  = {ppg, gp, ...} from /api/clutch (LeagueDashPlayerClutch Playoffs)
// injuryAdj = multiplier computed from teammate OUT status + NBA.com USG% redistribution
// tracking = {potentialAst, astConvRate, rebChancePct, ...} from /api/tracking (LeagueDashPtStats Passing+Rebounding)
// matchupDelta = full dict keyed by team abbr from /api/matchup-delta (L5-game dEFF vs season dEFF)
function computeProjection(prop, player, playerTeam, oppTeam, isHome, restDays, teamData = TEAM_DATA, recent = null, vsOpponent = null, playerSplits = null, teamDef = null, scoring = null, clutch = null, injuryAdj = 1.0, tracking = null, matchupDelta = null) {
  const rs = player.rs, po = player.po;
  const propRS = prop.statKey(rs), propPO = prop.statKey(po);
  const propRecent = recent ? +prop.statKey(recent).toFixed(2) : null;
  const propVsOpp = vsOpponent ? +prop.statKey(vsOpponent).toFixed(2) : null;
  // If last-5 available, blend in recent form (35% weight); otherwise standard 60/40
  const blended = propRecent !== null && propRecent > 0
    ? +(propPO * 0.40 + propRS * 0.25 + propRecent * 0.35).toFixed(2)
    : +(propPO * 0.60 + propRS * 0.40).toFixed(2);
  const ptd = teamData[playerTeam], otd = teamData[oppTeam];
  const isScoringProp = ["points", "pra", "pa", "pr"].includes(prop.id);

  // ── PACE ADJUSTMENT ────────────────────────────────────────────────────────
  // Source: NBA.com RS pace (LeagueDashTeamStats)
  const gamePace = ptd && otd ? +((ptd.rsPace + otd.rsPace) / 2).toFixed(1) : null;
  let paceAdj = 1.0;
  if (gamePace && ptd) paceAdj = +(gamePace / ptd.rsPace).toFixed(4);

  // ── OPPONENT DEFENSIVE EFFICIENCY — zone-weighted for points, flat otherwise ──
  // Source: NBA.com LeagueDashTeamStats PO (dEFF) + LeagueDashPtTeamDefend PO (zones)
  //         + LeagueDashPlayerStats PO Scoring (shot profile)
  // For POINTS prop: weights zone defense by player's actual shot distribution.
  //   pct3 * fg3VsAvg = how much the opp 3pt defense matters for THIS player's scoring
  //   pctPaint * rimVsAvg = same for paint scoring
  //   pctOther * flatDEFF = midrange/FT portion uses overall dEFF delta
  // For all other scoring props: flat dEFF (opp dEFF / league avg).
  // NOTE: higher dEFF = worse defense = boost. Lower dEFF = elite defense = penalty.
  // Formula is opp/avg (not avg/opp) so direction is correct.
  let defAdj = 1.0;
  if (isScoringProp) {
    const s = scoring; const td = teamDef?.[oppTeam];
    if (prop.id === "points" && s && td && otd?.dEFF) {
      const pct3     = (s.pctPts3pt   ?? 0) / 100;
      const pctPaint = (s.pctPtsPaint ?? 0) / 100;
      const pctOther = Math.max(0, 1 - pct3 - pctPaint);
      const fg3Impact  = pct3     * (td.fg3VsAvg ?? 0);
      const rimImpact  = pctPaint * (td.rimVsAvg ?? 0);
      const flatImpact = pctOther * (otd.dEFF / LEAGUE_AVG_dEFF - 1);
      defAdj = +Math.max(0.88, Math.min(1.12, 1 + fg3Impact + rimImpact + flatImpact)).toFixed(4);
    } else if (otd?.dEFF) {
      defAdj = +(otd.dEFF / LEAGUE_AVG_dEFF).toFixed(4);
    }
  }

  // ── HOME / ROAD ADJUSTMENT — per player, per stat, live NBA.com data ───────
  // Source: NBA.com LeagueDashPlayerStats Playoffs, location_nullable=Home/Road
  // Uses player's actual home vs road splits for this specific stat.
  // Requires ≥2 games on each side to use; otherwise falls back to flat ±3%.
  // Applied to ALL props (not just scoring) since data is stat-specific.
  let homeAdj = 1.0;
  if (isHome !== null) {
    const hStat = playerSplits?.home ? prop.statKey(playerSplits.home) : null;
    const rStat = playerSplits?.road ? prop.statKey(playerSplits.road) : null;
    const hGP = playerSplits?.home?.gp ?? 0;
    const rGP = playerSplits?.road?.gp ?? 0;
    if (hStat > 0 && rStat > 0 && hGP >= 2 && rGP >= 2) {
      // Live per-player, per-stat ratio from NBA.com
      const ratio = isHome ? (hStat / rStat) : (rStat / hStat);
      homeAdj = +Math.max(0.88, Math.min(1.12, ratio)).toFixed(4); // cap ±12%
    } else if (isScoringProp) {
      // Fallback: league-wide flat ±3% when splits not available
      homeAdj = isHome ? 1.030 : +(1 / 1.030).toFixed(4);
    }
  }

  // ── REST DAYS ADJUSTMENT ───────────────────────────────────────────────────
  // Source: NBAsuffer 2025-26 rest days stats. 1d=baseline, 2d=+1.5%, 3d+=+2.0%
  // Applies to ALL prop types — rest affects every stat category equally.
  let restAdj = 1.0;
  if (restDays !== null) {
    if (restDays >= 3) restAdj = 1.0200;
    else if (restDays === 2) restAdj = 1.0150;
    else restAdj = 1.0000;
  }

  // ── ON/OFF DELTA ADJUSTMENT (WOWY) ─────────────────────────────────────────
  // Source: NBA.com On/Off Court Advanced, Playoffs 2025-26
  // Scale: each 1.0 NETRTG delta ≈ 0.04% impact. Cap ±2.5%.
  // Applies to ALL prop types — lineup quality affects assists/rebounds equally.
  let onOffAdj = 1.0;
  if (player.onOffDelta !== null && player.onOffDelta !== undefined) {
    const rawAdj = player.onOffDelta * 0.0004;
    const cappedAdj = Math.max(-0.025, Math.min(0.025, rawAdj));
    onOffAdj = +(1 + cappedAdj).toFixed(4);
  }

  // ── TS% PLAYOFF vs RS ADJUSTMENT ──────────────────────────────────────────
  // Source: NBA.com Players Advanced Playoffs vs RS. Cap ±4%.
  let tsAdj = 1.0;
  if (isScoringProp && po.ts > 0 && rs.ts > 0) {
    const rawTS = (po.ts / rs.ts) - 1.0;
    tsAdj = +(1 + Math.max(-0.04, Math.min(0.04, rawTS))).toFixed(4);
  }

  // ── OPPONENT 3-POINT DEFENSE ADJUSTMENT ────────────────────────────────────
  // Source: NBA.com LeagueDashPtTeamDefend Playoffs, category="3 Pointers"
  // fg3VsAvg = PCT_PLUSMINUS (decimal): how much better/worse opponents shoot 3s
  //   vs league avg against this team. Negative = strong 3pt D (reduce projection).
  // Only applied to three_pointers prop. Cap ±8%.
  let fg3DefAdj = 1.0;
  if (prop.id === "three_pointers" && teamDef?.[oppTeam]?.fg3VsAvg !== undefined) {
    const pctVsAvg = teamDef[oppTeam].fg3VsAvg; // e.g. -0.030 decimal
    fg3DefAdj = +Math.max(0.92, Math.min(1.08, 1 + pctVsAvg)).toFixed(4);
  }

  // ── CLUTCH ADJUSTMENT ─────────────────────────────────────────────────────
  // Source: NBA.com LeagueDashPlayerClutch Playoffs (last 5 min, within 5 pts)
  // Compares player's clutch PPG to their overall PO PPG. Playoff games have
  // more clutch possessions than regular season → performance matters more.
  // Effect weighted at 25% (clutch isn't the whole game). Cap ±5%.
  // Applied to scoring props only. Requires ≥2 clutch GP to use.
  let clutchAdj = 1.0;
  if (isScoringProp && clutch && po.ppg > 0 && clutch.gp >= 2) {
    const clutchRatio = clutch.ppg / po.ppg;
    const rawAdj = (clutchRatio - 1) * 0.25; // 25% weight
    clutchAdj = +Math.max(0.95, Math.min(1.05, 1 + rawAdj)).toFixed(4);
  }

  // ── VS OPPONENT ADJUSTMENT ────────────────────────────────────────────────
  // Source: nba_api PlayerGameLog filtered by opponent (PO first, RS fallback)
  // Ratio of player's historical avg vs this team vs their PO avg, capped ±8%.
  // Applies to ALL prop types — history vs specific opponent is prop-type agnostic.
  let vsOppAdj = 1.0;
  if (propVsOpp !== null && propVsOpp > 0 && propPO > 0 && vsOpponent?.gp >= 2) {
    const rawAdj = (propVsOpp / propPO) - 1.0;
    vsOppAdj = +(1 + Math.max(-0.08, Math.min(0.08, rawAdj))).toFixed(4);
  }

  // ── INJURY USAGE REDISTRIBUTION ────────────────────────────────────────────
  // When a teammate is OUT, their scoring load redistributes to remaining players
  // proportional to each player's current usage share. Uses real NBA.com USG% + PPG.
  // injuryAdj is computed externally (useMemo in component) and passed in.
  // Cap: +25% max — prevents single-player spikes when a star is unexpectedly OUT.
  const injAdj = Math.max(1.0, Math.min(1.25, injuryAdj)); // floor at 1.0 (never reduces)

  // ── MATCHUP DELTA — rolling L5 dEFF vs season dEFF ────────────────────────
  // Source: NBA.com LeagueDashTeamStats Playoffs, last_n_games=5 vs full season
  // dEFF_delta = L5_dEFF − season_dEFF
  //   Positive (e.g. +3.2) = opponent's defense has weakened recently → boost projection
  //   Negative (e.g. -2.8) = opponent has tightened up defensively recently → reduce projection
  // Formula: season_dEFF / L5_dEFF (inverted so better defense = lower adj)
  // Cap ±6%. Applied to scoring props when at least 3 L5 games tracked.
  let matchupDeltaAdj = 1.0;
  const otDelta = matchupDelta?.[oppTeam];
  if (isScoringProp && otDelta && otDelta.season_dEFF > 0 && otDelta.l5_dEFF > 0 && otDelta.gp >= 3) {
    // If L5 dEFF > season dEFF: defense softened → project higher (season_dEFF/L5_dEFF > 1)
    // If L5 dEFF < season dEFF: defense tightened → project lower (season_dEFF/L5_dEFF < 1)
    const rawDelta = otDelta.season_dEFF / otDelta.l5_dEFF;
    matchupDeltaAdj = +Math.max(0.94, Math.min(1.06, rawDelta)).toFixed(4);
  }

  // ── ASSIST CONVERSION REGRESSION ──────────────────────────────────────────
  // Source: NBA.com LeagueDashPtStats Playoffs, Passing measure type
  // AST conversion rate = actual PO assists / potential assists per game.
  // If a player's current conversion rate deviates ≥15% from the ~30% PO league
  // baseline (i.e., they're on an unsustainable hot/cold streak), regress the
  // projection 30% toward the mean — which corrects for luck in assist opportunities.
  // Only applies to assists prop. Requires ≥3 GP of PO tracking data.
  let astConvAdj = 1.0;
  if (prop.id === "assists" && tracking && tracking.gp >= 3 && tracking.potentialAst > 0.5) {
    const convRate = tracking.astConvRate ?? LEAGUE_AVG_AST_CONV;
    const deviation = Math.abs(convRate - LEAGUE_AVG_AST_CONV) / LEAGUE_AVG_AST_CONV;
    if (deviation > 0.15 && tracking.ast > 0) {
      // Mean-regression — but ONLY downward (correct unsustainably HIGH conversion).
      // Residual data showed +60% under-projection on assists, primarily because
      // we were regressing elite passers (Murray/Trae/Jokic) DOWN to league mean
      // when they convert above mean for a real, structural reason. Now we only
      // apply astConvAdj when convRate is meaningfully ABOVE the mean (i.e., the
      // player is converting unsustainably hot), not when they're elite-stable.
      if (convRate > LEAGUE_AVG_AST_CONV * 1.25) {
        const meanAst  = tracking.potentialAst * LEAGUE_AVG_AST_CONV;
        const regressedAst = tracking.ast * 0.80 + meanAst * 0.20; // weaker regression
        const rawAdj   = regressedAst / tracking.ast;
        astConvAdj = +Math.max(0.92, Math.min(1.0, rawAdj)).toFixed(4); // downward only
      }
    }
  }

  // ── Hybrid multiplier (audit fix #4) ─────────────────────────────────────────
  // Volume factors (Pace, Defense, Injury, Matchup Delta, FG3 def) are TRUE
  // multipliers — they scale the underlying opportunity. Efficiency factors
  // (Home, Rest, On/Off, TS%, Clutch, vs-Opp history, AstConv) are ADDITIVE
  // shifts — stacking them multiplicatively over-amplified correlated signals
  // (e.g., +Home + Rest + WOWY + TS all pushing same direction compounded to
  // +12% before damping, guaranteeing false LOCK flags).
  const volumeMult =
    paceAdj * defAdj * injAdj * matchupDeltaAdj * fg3DefAdj;
  const efficiencyShift =
    (homeAdj    - 1) +
    (restAdj    - 1) +
    (onOffAdj   - 1) +
    (tsAdj      - 1) +
    (clutchAdj  - 1) +
    (vsOppAdj   - 1) +
    (astConvAdj - 1);
  // Cap efficiency stack at ±12% before damping (no single multiplier alone
  // can exceed ~5%, so this only bites when 3+ factors align in same direction)
  const cappedEffShift = Math.max(-0.12, Math.min(0.12, efficiencyShift));
  const rawAdjusted = blended * volumeMult * (1 + cappedEffShift);
  // Final ±25% total-swing cap with 0.75 damping factor on the delta
  const rawDeltaPct = blended > 0 ? (rawAdjusted - blended) / blended : 0;
  const dampedDelta = Math.max(-0.25, Math.min(0.25, rawDeltaPct * 0.75));
  const adjustedProjection = +(blended * (1 + dampedDelta)).toFixed(1);
  return { propRS, propPO, propRecent, propVsOpp, blended, gamePace, paceAdj, defAdj, homeAdj, restAdj, onOffAdj, tsAdj, fg3DefAdj, clutchAdj, injAdj, vsOppAdj, matchupDeltaAdj, astConvAdj, isHome, restDays, adjustedProjection };
}


// ── BetCard — bulk winning props board ────────────────────────────────────────
const TIER_META = {
  LOCK:       { label:"BEST BET", short:"BEST", color:"#a855f7", help:"Strong edge with clean support" },
  ACTIONABLE: { label:"PLAY",     short:"PLAY", color:"#3b82f6", help:"Bettable edge" },
  WATCH:      { label:"LEAN",     short:"LEAN", color:"#f59e0b", help:"Edge exists, but one filter is weak" },
  SKIP:       { label:"PASS",     short:"PASS", color:"#475569", help:"Not enough edge or too much model risk" },
};
const GRADE_COLOR = Object.fromEntries(Object.entries(TIER_META).map(([k, v]) => [k, v.color]));

const edgeTagsFor = (r) => {
  const tags = [];
  const absEv = Math.abs(Number(r.ev || 0));
  const trust = r.band?.trust_score ?? r.trustScore ?? null;
  if (absEv >= 15) tags.push({ label:"BIG EDGE", tone:"#10b981" });
  else if (absEv >= 8) tags.push({ label:"EDGE", tone:"#10b981" });
  else if (absEv >= 4) tags.push({ label:"THIN EDGE", tone:"#f59e0b" });
  if (trust != null && trust >= 70) tags.push({ label:"STABLE", tone:"#10b981" });
  else if (r.cv != null && r.cv >= 0.45) tags.push({ label:"VOLATILE", tone:"#f59e0b" });
  if (r.modelLift != null && r.modelLift < 0.10) tags.push({ label:"MODEL OK", tone:"#38bdf8" });
  else if (r.modelLift != null && r.modelLift >= 0.20) tags.push({ label:"MODEL REACH", tone:"#f59e0b" });
  if (r.mcSideProb != null && r.mcSideProb >= 0.60) tags.push({ label:"SIM OK", tone:"#10b981" });
  if (r.driftDown) tags.push({ label:"DRIFT", tone:"#f59e0b" });
  // WIDE TAIL — opposite quantile crosses the book line by ≥10% (variance too
  // high for confident lean; this is the role-player-explosion pattern that
  // crushed historical UNDER picks like Conley/Caruso/Hart). Shows up most
  // often on bench players in high-leverage games.
  if (r.wideTail) tags.push({ label:"WIDE TAIL", tone:"#ef4444" });
  return tags.slice(0, 4);
};

const betQualityScore = (r) => {
  const absEv = Math.abs(Number(r.ev || 0));
  const sideProb = r.mcSideProb ?? null;
  const trust = r.band?.trust_score ?? r.trustScore ?? null;
  const cv = r.cv ?? r.band?.cv ?? null;
  const line = Number(r.line || 0);
  const q25 = r.q25 ?? r.band?.floor ?? null;
  const q75 = r.q75 ?? r.band?.ceiling ?? null;
  const isOver = r.lean === "OVER";
  const clamp01 = v => Math.max(0, Math.min(1, v));
  let score = 0;
  score += clamp01((absEv - 4) / 16) * 34;
  score += sideProb != null ? clamp01((sideProb - 0.52) / 0.16) * 24 : 8;
  score += trust != null ? clamp01((trust - 40) / 45) * 18 : cv != null ? clamp01((0.48 - cv) / 0.26) * 18 : 7;
  score += r.modelLift != null ? (r.modelLift < 0.10 ? 14 : r.modelLift < 0.18 ? 7 : r.modelLift < 0.25 ? 1 : -10) : 4;
  if (line > 0) {
    if (isOver) score += q25 == null ? 3 : q25 >= line ? 10 : q25 >= line * 0.90 ? 4 : -10;
    else score += q75 == null ? 3 : q75 <= line ? 10 : q75 <= line * 1.10 ? 4 : -10;
  }
  if (r.corrStack) score += 5;
  if (r.resourceAllocated) score -= 4;
  if (r.sharedConflict || r.corrMixed) score -= 7;
  if (r.driftDown) score -= 12;
  if (r.wideTail)  score -= 18;   // wide-tail bets historically blew up — heavy penalty
  if (r.grade === "LOCK") score += 6;
  if (r.grade === "SKIP") score -= 10;
  return Math.max(0, Math.min(100, Math.round(score)));
};

const betBlockReason = (r) => {
  const absEv = Math.abs(Number(r.ev || 0));
  const trust = r.band?.trust_score ?? r.trustScore ?? null;
  const cv = r.cv ?? r.band?.cv ?? null;
  const sideProb = r.mcSideProb ?? null;
  if (r.grade === "LOCK" || r.grade === "ACTIONABLE") return r.grade === "LOCK" ? "Clean bet profile" : "Bettable edge";
  if (absEv < 4) return "Edge too thin";
  if (r.modelLift != null && r.modelLift >= 0.20) return "Model reach";
  if (sideProb != null && sideProb < 0.585) return "Simulation weak";
  if (trust != null && trust < 55) return "Trust low";
  if (cv != null && cv >= 0.40) return "Volatile";
  if (r.corrMixed) return "Mixed player signals";
  if (r.resourceAllocated) return "Pool trimmed";
  return "Needs cleaner support";
};

const BetCard = ({ r, propLabels, onOpen }) => {
  const isOver  = r.lean === "OVER";
  const ac      = isOver ? "#10b981" : "#ef4444";
  const tier    = TIER_META[r.grade] || TIER_META.SKIP;
  const gc      = tier.color;
  const fmt     = n => n.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
  const delta   = r.proj - r.line;
  const tags    = edgeTagsFor(r);
  const score   = r.betScore ?? betQualityScore(r);

  return (
    <div className="bet-card" style={{ borderColor:`${gc}40` }} onClick={onOpen}>
      <div className="bet-card-stripe" style={{ background:`linear-gradient(90deg,${gc},${gc}55)` }} />
      <div className="bet-card-head">
        <span className="bet-card-grade" style={{ color:gc }} title={tier.help}>{tier.label}</span>
        <span style={{ marginLeft:"auto", fontFamily:"'Azeret Mono',monospace", fontSize:9, color:score >= 70 ? "#10b981" : score >= 55 ? "#f59e0b" : "#64748b" }}>
          SCORE {score}
        </span>
        <span className="bet-card-player">{fmt(r.name)}</span>
        <span className="bet-card-sub">
          {r.team} · {propLabels[r.propId]}
          {r.sharedConflict && <span title="Teammate conflict"> ⚡</span>}
          {r.driftDown      && <span title="Recent over-projection"> ↘</span>}
        </span>
      </div>
      <div className="bet-card-core">
        {/* Left: direction + line → proj */}
        <div>
          <div className="bet-card-dir" style={{ color:ac }}>{isOver ? "OVER" : "UNDER"}</div>
          <div className="bet-card-nums">
            <span className="bet-card-line">{r.line}</span>
            <span className="bet-card-arr">→</span>
            <span className="bet-card-proj" style={{ color:ac }}>{r.proj.toFixed(1)}</span>
          </div>
          <div className="bet-card-delta" style={{ color:ac }}>{delta >= 0 ? "+" : ""}{delta.toFixed(1)}</div>
        </div>
        {/* Right: EV — the primary edge signal */}
        <div style={{ textAlign:"right" }}>
          <div className="bet-card-ev" style={{ color:gc }}>
            {r.ev >= 0 ? "+" : ""}{r.ev}%
          </div>
          <div className="bet-card-ev-label">EV EDGE</div>
        </div>
      </div>
      <div className="bet-card-foot">
        {tags.map((t, i) => (
          <span key={`${t.label}-${i}`} style={{ fontSize:9, color:t.tone, background:`${t.tone}14`,
            border:`1px solid ${t.tone}33`, borderRadius:3, padding:"1px 5px", letterSpacing:".04em" }}>
            {t.label}
          </span>
        ))}
        {r.corrStack && (
          <span style={{ fontSize:9, fontWeight:800, color:"#10b981", background:"rgba(16,185,129,.12)",
            border:"1px solid rgba(16,185,129,.3)", borderRadius:3, padding:"1px 5px", letterSpacing:".06em" }}
            title="Multiple props for this player align — correlated positive stack">
            STACK ↗
          </span>
        )}
        {r.corrMixed && !r.corrStack && (
          <span style={{ fontSize:9, color:"#f59e0b", background:"rgba(245,158,11,.08)",
            border:"1px solid rgba(245,158,11,.25)", borderRadius:3, padding:"1px 5px" }}
            title="This player's props send mixed signals — verify before stacking">
            MIXED
          </span>
        )}
        {r.resourceAllocated && (
          <span style={{ fontSize:9, color:"#38bdf8", background:"rgba(56,189,248,.08)",
            border:"1px solid rgba(56,189,248,.25)", borderRadius:3, padding:"1px 5px" }}
            title={`${r.resourceType || "Shared pool"} allocation trimmed ${r.resourceTrim?.toFixed?.(1) ?? r.resourceTrim} from original ${r.originalProj?.toFixed?.(1) ?? r.originalProj}`}>
            POOL
          </span>
        )}
        {r.sharedConflict && <span className="bet-card-flag" style={{ color:"#f59e0b" }} title="Teammate conflict">⚡</span>}
        {r.driftDown      && <span className="bet-card-flag" style={{ color:"#f59e0b" }} title="Recent over-projection">↘</span>}
        {onOpen && (
          <button onClick={e => { e.stopPropagation(); onOpen(); }}
            style={{ marginLeft:"auto", padding:"2px 8px", background:"rgba(99,102,241,.08)",
              border:"1px solid rgba(99,102,241,.2)", borderRadius:4, color:"#6366f1", cursor:"pointer", fontSize:8,
              fontFamily:"'Azeret Mono',monospace" }}>
            OPEN →
          </button>
        )}
      </div>
    </div>
  );
};

// ── ConfidenceMeter — single-player projection band ───────────────────────────
const PlayerShotChart = ({ chart, loading, defense, opponent }) => {
  if (loading) {
    return (
      <div className="shot-chart-card">
        <div className="shot-chart-title">SHOT CHART</div>
        <div style={{ color:"#64748b", fontSize:12 }}>Loading NBA.com shot locations...</div>
      </div>
    );
  }
  if (!chart?.shots?.length) return null;
  const shots = chart.shots;
  const made = chart.summary?.fgm ?? shots.filter(s => s.made).length;
  const fga = chart.summary?.fga ?? shots.length;
  const fgPct = chart.summary?.fgPct != null ? `${(chart.summary.fgPct * 100).toFixed(1)}%` : "n/a";
  const toXY = (s) => {
    const x = Math.max(16, Math.min(484, 250 + Number(s.x || 0)));
    const y = Math.max(18, Math.min(430, 430 - Number(s.y || 0)));
    return { x, y };
  };
  const zoneDefense = (zone = "", range = "") => {
    const z = `${zone} ${range}`.toLowerCase();
    let key = null;
    if (z.includes("3")) key = "fg3";
    else if (z.includes("restricted")) key = "rim";
    else if (z.includes("less than 8") || z.includes("less than 10") || z.includes("paint")) key = "close";
    else if (z.includes("mid") || z.includes("greater than 15")) key = "mid";
    else if (z.includes("less than 6")) key = "rim";
    const val = key === "fg3" ? defense?.fg3VsAvg
      : key === "mid" ? defense?.midVsAvg
      : key === "close" ? (defense?.closeVsAvg ?? defense?.rimVsAvg)
      : key === "rim" ? defense?.rimVsAvg
      : null;
    if (val == null) return { label:"no def data", color:"#64748b", impact:null };
    const pct = +(val * 100).toFixed(1);
    if (pct >= 1.5) return { label:`soft +${pct}pp`, color:"#10b981", impact:val };
    if (pct <= -1.5) return { label:`tough ${pct}pp`, color:"#ef4444", impact:val };
    return { label:`neutral ${pct >= 0 ? "+" : ""}${pct}pp`, color:"#f59e0b", impact:val };
  };
  const zoneReads = (chart.zones || []).slice(0, 5).map(z => ({ ...z, defense: zoneDefense(z.zone, z.range) }));
  return (
    <div className="shot-chart-card">
      <div className="shot-chart-head">
        <div>
          <div className="shot-chart-title">SHOT CHART</div>
          <div className="shot-chart-sub">{chart.seasonType} - NBA.com locations - last {shots.length} FGA{opponent ? ` vs ${opponent} defense` : ""}</div>
        </div>
        <div className="shot-chart-summary">{made}/{fga} - {fgPct}</div>
      </div>
      <div className="shot-chart-body">
        <svg className="shot-chart-svg" viewBox="0 0 500 450" role="img" aria-label="Player shot chart">
          <rect x="0" y="0" width="500" height="450" rx="12" fill="#071122" />
          <path d="M40 430 H460" stroke="#22304a" strokeWidth="2" />
          <path d="M80 430 V250 H420 V430" stroke="#22304a" strokeWidth="2" fill="none" />
          <path d="M170 430 V310 H330 V430" stroke="#22304a" strokeWidth="2" fill="none" />
          <circle cx="250" cy="390" r="7" stroke="#22304a" strokeWidth="2" fill="none" />
          <path d="M190 310 A60 60 0 0 0 310 310" stroke="#22304a" strokeWidth="2" fill="none" />
          <path d="M30 430 V285 M470 430 V285" stroke="#22304a" strokeWidth="2" />
          <path d="M30 285 A220 220 0 0 1 470 285" stroke="#22304a" strokeWidth="2" fill="none" />
          <path d="M110 430 A140 140 0 0 1 390 430" stroke="#17243a" strokeWidth="1.5" fill="none" />
          {shots.map((s, i) => {
            const p = toXY(s);
            const color = s.made ? "#10b981" : "#ef4444";
            return <circle key={i} cx={p.x} cy={p.y} r={2.7} fill={color} opacity={s.made ? 0.86 : 0.52} />;
          })}
        </svg>
        <div className="shot-zone-list">
          {zoneReads.map((z, i) => (
            <div key={`${z.zone}-${i}`} className="shot-zone-row">
              <span>{z.zone.replace(" Zone", "")}</span>
              <b>{z.fgm}/{z.fga}</b>
              <em>{z.fgPct != null ? `${(z.fgPct * 100).toFixed(0)}%` : "n/a"}</em>
              <strong style={{ color:z.defense.color }}>{z.defense.label}</strong>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

const ConfidenceMeter = ({ proj, line, floor, ceiling, trustScore, source, std, n }) => {
  if (floor == null || ceiling == null) return null;
  const span     = Math.max(ceiling - floor, 1);
  const projPct  = Math.max(0, Math.min(100, ((proj  - floor) / span) * 100));
  const linePct  = line != null ? Math.max(0, Math.min(100, ((line  - floor) / span) * 100)) : null;
  const trustColor = trustScore >= 70 ? "#10b981" : trustScore >= 40 ? "#f59e0b" : "#ef4444";

  return (
    <div style={{ background:"rgba(99,102,241,.07)", border:"1px solid rgba(99,102,241,.22)",
      borderRadius:12, padding:"16px", fontFamily:"'Azeret Mono',monospace" }}>
      {/* Header */}
      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:12, flexWrap:"wrap", gap:6 }}>
        <span style={{ fontSize:10, letterSpacing:".18em", color:"#6366f1" }}>
          ⚡ {source === "xgb_quantile" ? "XGB QUANTILE BAND" : `CONFIDENCE BAND · σ${std} · n${n}`}
        </span>
        {trustScore != null && <span style={{ fontSize:10, fontWeight:700, color:trustColor }}>TRUST {trustScore}</span>}
      </div>

      {/* Floor / Ceiling labels */}
      <div style={{ display:"flex", justifyContent:"space-between", fontSize:11, color:"#94a3b8", marginBottom:8 }}>
        <span>Floor: {floor}</span>
        <span>Ceil: {ceiling}</span>
      </div>

      {/* Track — margin so markers don't clip edges */}
      <div style={{ position:"relative", height:8, background:"rgba(255,255,255,.05)", borderRadius:4, margin:"0 8px" }}>
        <div style={{ position:"absolute", inset:0, background:"rgba(99,102,241,.2)", borderRadius:4 }} />
        {/* Proj marker */}
        <div style={{ position:"absolute", left:`${projPct}%`, top:-4, width:16, height:16,
          borderRadius:"50%", background:"#6366f1", transform:"translateX(-50%)",
          border:"2px solid #0f172a", zIndex:2, boxShadow:"0 0 8px rgba(99,102,241,.7)" }} />
        {/* Line marker */}
        {linePct != null && (
          <div style={{ position:"absolute", left:`${linePct}%`, top:-6, width:4, height:20,
            background:"#f59e0b", borderRadius:2, transform:"translateX(-50%)", zIndex:1 }} />
        )}
      </div>

      {/* Bottom labels */}
      <div style={{ display:"flex", justifyContent:"center", gap:16, marginTop:16, fontSize:11 }}>
        <span style={{ color:"#6366f1", fontWeight:700 }}>Proj: {proj?.toFixed?.(1) ?? "?"}</span>
        {line != null && <span style={{ color:"#f59e0b", fontWeight:700 }}>Line: {line}</span>}
      </div>
    </div>
  );
};

export default function NBAPropsModel() {
  const [gid, setGid] = useState(null);
  const [liveSched, setLiveSched] = useState(null); // null = loading, false = failed, object = loaded
  const [liveInjuries, setLiveInjuries] = useState(null); // null = loading, false = failed, object = loaded
  const [livePlayerDB, setLivePlayerDB] = useState(null); // null = loading, false = failed, object = loaded
  const [liveTeamData, setLiveTeamData] = useState(null); // null = loading, false = failed, object = loaded
  const [nbaApiStatus, setNbaApiStatus] = useState("loading"); // "loading" | "warming" | "live" | "offline"
  const [homeAwaySplits, setHomeAwaySplits] = useState(null); // per-player home/road PO splits
  const [teamDefense, setTeamDefense] = useState(null);       // per-team zone defense (3pt, rim)
  const [teamContext, setTeamContext] = useState(null);       // per-team style context (four factors/misc/advanced)
  const [scoringBreakdown, setScoringBreakdown] = useState(null); // % pts from 3s/paint/FTs/MR
  const [clutchStats, setClutchStats] = useState(null);           // clutch PO stats per player
  const [hustleStats, setHustleStats] = useState(null);           // deflections, box-outs, etc
  const [trackingStats, setTrackingStats] = useState(null);       // potential assists, rebound chance %, passes
  const [matchupDelta, setMatchupDelta] = useState(null);         // rolling L5-game dEFF vs season dEFF per team
  const [recentStats, setRecentStats] = useState(null);
  const [vsOpponentStats, setVsOpponentStats] = useState(null);
  const [pname, setPname] = useState("");
  const [pkey, setPkey] = useState(null);
  const [prop, setProp] = useState(null);
  const [line, setLine] = useState("");
  const [oddsStatus, setOddsStatus] = useState("");
  const [oddsLoading, setOddsLoading] = useState(false);
  const [ddOpen, setDdOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const [shotChart, setShotChart] = useState(null);
  const [shotChartLoading, setShotChartLoading] = useState(false);
  const [actualInput, setActualInput] = useState("");
  const [fetchedBox, setFetchedBox] = useState(null);
  const [fetchingBox, setFetchingBox] = useState(false);
  const [showMath, setShowMath] = useState(false);
  const [showAnalysis, setShowAnalysis] = useState(false);
  const [showBulkLog, setShowBulkLog] = useState(false);
  const [bulkText, setBulkText] = useState("");
  const [bulkResult, setBulkResult] = useState(null);
  // ── Bulk projection panel ──
  const [showBulk, setShowBulk] = useState(false);
  const [bulkLines, setBulkLines] = useState({});        // { playerName: { propId: "line" } }
  const [bulkLinePulledAt, setBulkLinePulledAt] = useState({});  // { playerName: { propId: timestamp } }
  const [bulkProjResults, setBulkProjResults] = useState([]);
  const [bulkRunning, setBulkRunning] = useState(false);
  const [bulkProgress, setBulkProgress] = useState({ done: 0, total: 0 });
  const [bulkSkipped, setBulkSkipped] = useState(null);   // { noPid: [], apiError: [], notSuccess: [] }
  const [bulkProps, setBulkProps] = useState(["points", "rebounds", "assists"]);
  const [bulkOddsLoading, setBulkOddsLoading] = useState(false);
  const [bulkOddsStatus, setBulkOddsStatus] = useState("");
  // ── Auto residual logger ──
  const [autoLogRunning, setAutoLogRunning] = useState(false);
  const [autoLogProgress, setAutoLogProgress] = useState({ done: 0, total: 0 });
  const [autoLogResult, setAutoLogResult] = useState(null);   // { logged, skipped, players }
  const ref = useRef(null);

  useEffect(() => {
    const pid = result?.player?.pid;
    const propId = result?.prop?.id;
    if (!pid || propId !== "points") {
      setShotChart(null);
      setShotChartLoading(false);
      return;
    }
    let alive = true;
    setShotChartLoading(true);
    fetch(`${API_BASE}/shot-chart/${pid}`)
      .then(r => r.json())
      .then(d => { if (alive) setShotChart(d?.success ? d : null); })
      .catch(() => { if (alive) setShotChart(null); })
      .finally(() => { if (alive) setShotChartLoading(false); });
    return () => { alive = false; };
  }, [result?.player?.pid, result?.prop?.id]);

  // ── Residual learning — localStorage stores actual outcomes per player/prop ──
  // Enables the model to learn its systematic bias over time (no server needed).
  // Projection/actual pairs sent to /api/project → server applies Adjustment 14.
  // ── Dedupe helper ───────────────────────────────────────────────────────────
  // Pass 1: collapse same-date entries (latest write wins).
  // Pass 2: collapse same-game entries — if two entries share the same actual
  //   AND projected values within a 2-day window, they came from the same box
  //   score (UTC midnight re-log bug). Keep the entry with the later date.
  const dedupeResidualsArray = useCallback((arr) => {
    if (!Array.isArray(arr)) return [];

    // Pass 1 — by date (existing behaviour)
    const byDate = new Map();
    for (const e of arr) {
      if (!e || typeof e !== "object") continue;
      const d = e.date || "_undated_";
      byDate.set(d, e);
    }
    let entries = Array.from(byDate.values()).sort((a, b) =>
      (a.date || "").localeCompare(b.date || "")
    );

    // Pass 2 — same box score across adjacent dates
    // Key = `${actual}__${projected}`. Within ±2 days, dedupe to later date.
    const seen = new Map();   // gameKey → index in `out`
    const out  = [];
    for (const e of entries) {
      const gameKey = `${+(e.actual ?? 0).toFixed(2)}__${+(e.projected ?? 0).toFixed(2)}`;
      if (seen.has(gameKey)) {
        const prevIdx = seen.get(gameKey);
        // Replace earlier entry with this one (later date wins)
        out[prevIdx] = e;
      } else {
        seen.set(gameKey, out.length);
        out.push(e);
      }
    }

    return out.slice(-20);
  }, []);

  const getResiduals = useCallback((playerKey, propId) => {
    try {
      const raw = localStorage.getItem(`res_${playerKey}_${propId}`);
      const arr = raw ? JSON.parse(raw) : [];
      // Read-time dedupe ensures stale dupe-laden storage still passes clean data to server
      return dedupeResidualsArray(arr);
    } catch { return []; }
  }, [dedupeResidualsArray]);

  // Context capture — what circumstances was this projection made under?
  // Used by server's Adj 14 to apply bucket-aware calibration:
  //   • home/away  — does the model over-project on the road?
  //   • po/rs      — does playoff intensity throw off projections?
  //   • b2b        — back-to-back fatigue
  //   • leverage   — game 7s, eliminations
  //   • out        — list of OUT teammates (cascade cases)
  // Stored on each residual entry so future projections can match similar contexts.
  const buildResidualCtx = useCallback((info) => {
    if (!info) return null;
    const { isHome, gameTitle, restDays, outPlayers } = info;
    return {
      home:     isHome === true,
      po:       /game|playoff|round|finals|elimination|conference/i.test(gameTitle || ""),
      b2b:      restDays === 0,
      leverage: /game\s*7|elimination|finals/i.test(gameTitle || ""),
      out:      Array.isArray(outPlayers) ? outPlayers.slice(0, 5).map(p => p.name || p).filter(Boolean) : [],
    };
  }, []);

  const saveResidual = useCallback((playerKey, propId, projected, actual, ctx = null) => {
    try {
      const key  = `res_${playerKey}_${propId}`;
      const prev = (() => { try { return JSON.parse(localStorage.getItem(key) || "[]"); } catch { return []; } })();
      const entry = {
        projected: +projected.toFixed(2),
        actual:    +parseFloat(actual).toFixed(2),
        date:      new Date().toISOString().slice(0, 10),
        ...(ctx ? { ctx } : {}),
      };
      // Dedupe on write — if user re-saves for same date, the new entry wins
      const updated = dedupeResidualsArray([...prev, entry]);
      localStorage.setItem(key, JSON.stringify(updated));
    } catch {}
  }, [dedupeResidualsArray]);

  // ── One-shot global cleanup — run over EVERY res_ key in localStorage ──
  // Returns { keysScanned, dupesRemoved, totalBefore, totalAfter, perKey: [...] }
  const cleanAllResiduals = useCallback(() => {
    const report = { keysScanned: 0, dupesRemoved: 0, totalBefore: 0, totalAfter: 0, perKey: [] };
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        if (!k || !k.startsWith("res_")) continue;
        try {
          const raw = JSON.parse(localStorage.getItem(k) || "[]");
          if (!Array.isArray(raw)) continue;
          const cleaned = dedupeResidualsArray(raw);
          report.keysScanned += 1;
          report.totalBefore += raw.length;
          report.totalAfter  += cleaned.length;
          if (cleaned.length !== raw.length) {
            report.dupesRemoved += (raw.length - cleaned.length);
            report.perKey.push({ key: k.replace("res_", ""), before: raw.length, after: cleaned.length });
            localStorage.setItem(k, JSON.stringify(cleaned));
          }
        } catch {}
      }
    } catch {}
    return report;
  }, [dedupeResidualsArray]);

  // ── Fetch live schedule directly from ESPN (CORS-enabled, no server needed) ──
  // ESPN's public scoreboard API is CORS-open so we hit it from the browser.
  // This eliminates Render cold-start failures and server-side date bugs entirely.
  // Game-night convention: before 6 AM ET we're still "last night", so roll back one day.
  useEffect(() => {
    const ESPN_ABBR = { SA:"SAS", GS:"GSW", NY:"NYK", NO:"NOP", UTAH:"UTA" };
    const normAbbr = a => ESPN_ABBR[(a||"").toUpperCase()] || (a||"").toUpperCase();

    const toIso = d =>
      `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,"0")}${String(d.getDate()).padStart(2,"0")}`;

    const parseEspn = async (iso) => {
      try {
        const r = await fetch(
          `https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard?dates=${iso}`,
          { cache: "no-store" }
        );
        if (!r.ok) return [];
        const d = await r.json();
        return (d.events || []).map(ev => {
          const comps = ev.competitions?.[0] || {};
          const home = comps.competitors?.find(c => c.homeAway === "home");
          const away = comps.competitors?.find(c => c.homeAway === "away");
          const homeAbbr = normAbbr(home?.team?.abbreviation || "");
          const awayAbbr = normAbbr(away?.team?.abbreviation || "");
          const status   = comps.status?.type?.name || "";
          const statusTxt = status === "STATUS_FINAL" ? "Final"
                          : status === "STATUS_IN_PROGRESS" ? "Live"
                          : "Scheduled";
          const note  = comps.notes?.find(n => n.type === "event")?.headline || "";
          const series = comps.series?.summary || note || "";
          const rawTime = ev.date ? new Date(ev.date).toLocaleTimeString("en-US",
            { timeZone:"America/New_York", hour:"numeric", minute:"2-digit" }) : "TBD";
          const time = statusTxt === "Final" ? "Final"
                     : statusTxt === "Live"  ? "Live"
                     : rawTime;
          return {
            id:        ev.id,
            home:      homeAbbr,
            away:      awayAbbr,
            homeTeam:  home?.team?.shortDisplayName || homeAbbr,
            awayTeam:  away?.team?.shortDisplayName || awayAbbr,
            time,
            title:     ev.name || `${awayAbbr} @ ${homeAbbr}`,
            series,
            restDays:  {},
            [homeAbbr]: [],
            [awayAbbr]: [],
          };
        });
      } catch { return []; }
    };

    const fetchSchedule = async () => {
      // Game-night date rollback: before 6 AM ET we're still on "last night"
      const nowET = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
      const displayDate = nowET.getHours() < 6
        ? new Date(nowET.getFullYear(), nowET.getMonth(), nowET.getDate() - 1)
        : new Date(nowET.getFullYear(), nowET.getMonth(), nowET.getDate());

      const todayIso   = toIso(displayDate);
      const todayLabel = displayDate.toLocaleDateString("en-US", { month:"short", day:"numeric", year:"numeric" });
      const todayGames = await parseEspn(todayIso);

      // Scan forward for the next day that has scheduled games
      let upcomingGames = [];
      let upcomingLabel = "";
      for (let offset = 1; offset <= 6; offset++) {
        const d = new Date(displayDate.getFullYear(), displayDate.getMonth(), displayDate.getDate() + offset);
        const games = await parseEspn(toIso(d));
        if (games.length > 0) {
          upcomingGames = games;
          upcomingLabel = d.toLocaleDateString("en-US", { month:"short", day:"numeric" });
          break;
        }
      }

      setLiveSched({ today: todayLabel, todayGames, upcomingGames, upcomingLabel });
    };

    fetchSchedule();
    const interval = setInterval(fetchSchedule, 5 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Fetch live injury report from /api/injuries endpoint ───────────────────
  // Backend merges ESPN live injury feed + static _INJURY_OVERRIDES (manually verified).
  // No browser API keys required — no AI hallucination possible.
  // Static overrides always win: Franz Wagner OUT, KD OUT, etc. are authoritative.
  useEffect(() => {
    const fetchInjuries = async () => {
      try {
        const resp = await fetch(`${API_BASE}/injuries`, { cache: "no-store" });
        if (!resp.ok) { setLiveInjuries(false); return; }
        const data = await resp.json();
        if (!data?.success) { setLiveInjuries(false); return; }
        // Normalize ESPN status strings → our format (OUT/GTD/PROB)
        const normalized = {};
        for (const [name, info] of Object.entries(data.injuries || {})) {
          const s = (info.status || "").toLowerCase();
          const d = (info.detail || "").toLowerCase();
          const hardOut = /ruled out|will not play|won't play|not play|out for|out indefinitely|inactive|not active/.test(d);
          const probable = /probable|expected to play|will play|available|fully practiced|full practice/.test(d);
          const questionable = /questionable|game-time decision|day-to-day|day to day|gtd/.test(d);
          normalized[name] = {
            ...info,
            status: hardOut ? "OUT"
                  : probable ? "PROB"
                  : questionable ? "GTD"
                  : s.includes("probable") ? "PROB"
                  : s.includes("questionable") || s.includes("gtd") || s.includes("day-to-day") ? "GTD"
                  : s.includes("out") || s === "out" ? "OUT"
                  : info.status,
          };
        }
        setLiveInjuries({ injuries: normalized, updated: data.updated });
      } catch (e) { setLiveInjuries(false); }
    };
    fetchInjuries();
    // Refresh every 10 minutes so late scratches are caught
    const interval = setInterval(fetchInjuries, 10 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // ── Fetch all NBA.com data from Render backend (9 endpoints cached server-side) ──
  // Render free tier: cold-start ~30-90s, NBA API warmup ~3-4 min (9 calls).
  // Strategy: poll /api/ready (lightweight) every 8s. Once ready, fetch all data.
  // Old server (no /api/ready): probe /api/players directly until it responds with real data.
  // Data fetches use 300s timeout so a blocking _warmup_done.wait(240) never races the client.
  useEffect(() => {
    let cancelled = false;
    // fetchT: universal AbortController timeout — works in all browsers.
    const fetchT = (url, ms = 300000) => {
      const ctrl = new AbortController();
      const tid  = setTimeout(() => ctrl.abort(), ms);
      return fetch(url, { signal: ctrl.signal }).finally(() => clearTimeout(tid));
    };

    // Phase 1 — wait for server warmup via SSE (1 persistent connection instead of 20 polls).
    // Falls back to 8s polling if SSE isn't supported or returns 404.
    // Render cold start + NBA API warmup ≈ 2-4 min; SSE heartbeats keep the connection alive.
    const waitForReady = () => new Promise((resolve) => {
      if (cancelled) return resolve(false);

      // Try SSE first
      let es;
      try {
        es = new EventSource(`${API_BASE}/ready-stream`);
      } catch {
        es = null;
      }

      if (es) {
        const cleanup = () => { try { es.close(); } catch {} };
        const timeout = setTimeout(() => { cleanup(); resolve(false); }, 330000);

        es.onmessage = (e) => {
          clearTimeout(timeout);
          cleanup();
          try {
            const data = JSON.parse(e.data);
            if (data.ready) return resolve(true);
            // Server up but players build failed — proceed to Phase 2 anyway.
            // Individual endpoints have their own _warmup_done.wait() fallback.
            if (data.warmupDone || data.failed) return resolve(true);
          } catch {}
          resolve(false);
        };

        es.onerror = () => {
          clearTimeout(timeout);
          cleanup();
          // SSE not available (404 / network error) — fall back to polling
          pollFallback().then(resolve);
        };

        return; // SSE path active — polling path below won't run
      }

      // No EventSource support — go straight to polling
      pollFallback().then(resolve);
    });

    // Poll fallback: 8s interval, 40 attempts (320s max)
    const pollFallback = async () => {
      for (let i = 0; i < 40; i++) {
        if (cancelled) return false;
        try {
          const resp = await fetchT(`${API_BASE}/ready`, 8000);
          if (resp.ok) {
            const data = await resp.json();
            if (data.ready) return true;
            // Server alive but players build failed — don't stay stuck in poll loop
            if (data.warmupDone && !data.ready) return true;
          }
        } catch {}
        if (cancelled) return false;
        setNbaApiStatus("warming");
        await new Promise(res => setTimeout(res, 8000));
      }
      return false;
    };

    // Phase 2 — server is ready; fetch all endpoints using allSettled so one 500/404
    // can't kill the whole load. Only /api/players is required — everything else falls
    // back to static constants already baked into the model.
    const fetchAllData = async () => {
      const safeJson = async (url) => {
        try {
          const r = await fetchT(url);
          if (!r.ok) return null;
          return await r.json();
        } catch { return null; }
      };
      const [playersData, teamsData, splitsData, teamDefData, teamCtxData, scoringData, clutchData, hustleData, trackingData, matchupData] = await Promise.all([
        safeJson(`${API_BASE}/players`),
        safeJson(`${API_BASE}/teams`),
        safeJson(`${API_BASE}/splits`),
        safeJson(`${API_BASE}/team-defense`),
        safeJson(`${API_BASE}/team-context`),
        safeJson(`${API_BASE}/scoring`),
        safeJson(`${API_BASE}/clutch`),
        safeJson(`${API_BASE}/hustle`),
        safeJson(`${API_BASE}/tracking`),
        safeJson(`${API_BASE}/matchup-delta`),
      ]);
      if (cancelled) return;
      // Players is the only hard requirement — if missing, fall back to static.
      if (!playersData?.success) throw new Error("players endpoint failed");
      if (playersData.success)     setLivePlayerDB(playersData.players);
      if (teamsData?.success)      setLiveTeamData(teamsData.teams);
      if (splitsData?.success)     setHomeAwaySplits(splitsData.splits);
      if (teamDefData?.success)    setTeamDefense(teamDefData.teamDefense);
      if (teamCtxData?.success)    setTeamContext(teamCtxData.teamContext);
      if (scoringData?.success)    setScoringBreakdown(scoringData.scoring);
      if (clutchData?.success)     setClutchStats(clutchData.clutch);
      if (hustleData?.success)     setHustleStats(hustleData.hustle);
      if (trackingData?.success)   setTrackingStats(trackingData.tracking);
      if (matchupData?.success)    setMatchupDelta(matchupData.matchupDelta);
      setNbaApiStatus("live");
    };

    const run = async () => {
      setNbaApiStatus("warming");
      const ready = await waitForReady();
      if (cancelled) return;
      if (!ready) { setNbaApiStatus("offline"); return; }
      try {
        await fetchAllData();
      } catch {
        if (!cancelled) setNbaApiStatus("offline");
      }
    };
    run();
    return () => { cancelled = true; };
  }, []);

  // Merge live schedule into rosters — update existing static entries AND add new dynamic games
  const activeRosters = useMemo(() => {
    const base = { ...GAME_ROSTERS };
    if (!liveSched || liveSched === false) return base;
    [...(liveSched.todayGames || []), ...(liveSched.upcomingGames || [])].forEach(lg => {
      if (!lg?.id) return;
      if (base[lg.id]) {
        // Update metadata on existing static entry
        base[lg.id] = { ...base[lg.id],
          series: lg.series || base[lg.id].series,
          time:   lg.time   || base[lg.id].time,
          title:  lg.title  || base[lg.id].title,
          date:   lg.date   || base[lg.id].date,
        };
        // Overlay dynamic rosters if static ones are empty
        if (lg.home && (!base[lg.id][lg.home] || base[lg.id][lg.home].length === 0))
          base[lg.id][lg.home] = lg[lg.home] || [];
        if (lg.away && (!base[lg.id][lg.away] || base[lg.id][lg.away].length === 0))
          base[lg.id][lg.away] = lg[lg.away] || [];
      } else if (lg.home && lg.away) {
        // Brand-new game (tomorrow or round 2+) — build entry from live data
        base[lg.id] = {
          home: lg.home, away: lg.away,
          homeTeam: lg.homeTeam || lg.home,
          awayTeam: lg.awayTeam || lg.away,
          time: lg.time || "TBD", date: lg.date || "", title: lg.title || "Playoff Game",
          series: lg.series || "",
          restDays: lg.restDays || {},
          [lg.home]: lg[lg.home] || [],
          [lg.away]: lg[lg.away] || [],
        };
      }
    });
    // Build a combined player-by-team lookup: live API first, static PLAYER_DB as fallback
    // livePlayerDB has every active NBA player; PLAYER_DB covers historical/inactive ones
    const allPlayers = livePlayerDB
      ? { ...PLAYER_DB, ...livePlayerDB }  // live wins on overlap
      : PLAYER_DB;
    // Auto-fill any empty roster slots from the combined lookup
    for (const gid of Object.keys(base)) {
      const g = base[gid];
      for (const abbr of [g.home, g.away]) {
        if (!abbr) continue;
        if (!g[abbr] || g[abbr].length === 0) {
          g[abbr] = Object.keys(allPlayers).filter(k => allPlayers[k]?.team === abbr);
        }
      }
    }
    return base;
  }, [liveSched, livePlayerDB]);

  // Dynamic game ID lists — driven by live schedule when available, static fallback otherwise
  const activeTodayIds    = useMemo(() =>
    liveSched?.todayGames?.length    > 0 ? liveSched.todayGames.map(g => g.id)    : TODAYS_GAMES,
  [liveSched]);
  const activeUpcomingIds = useMemo(() =>
    liveSched?.upcomingGames?.length > 0 ? liveSched.upcomingGames.map(g => g.id) : UPCOMING_GAMES,
  [liveSched]);
  // Merge live NBA.com stats over static PLAYER_DB — live takes priority for rs/po, static kept for pos/onOffDelta
  const effectiveDB = useMemo(() => {
    // Live API is the base — covers ALL NBA players with real RS+PO stats.
    // Static PLAYER_DB only supplements with fields the API doesn't return:
    // onOffDelta (requires On/Off endpoint) and pos (position string).
    // If API is offline, fall back to static DB entirely.
    if (!livePlayerDB) return PLAYER_DB;
    const merged = {};
    // Step 1: seed every live player the API returned
    for (const [name, live] of Object.entries(livePlayerDB)) {
      const stat = PLAYER_DB[name]; // may be undefined — that's fine
      merged[name] = {
        team: live.team,
        pid: live.pid,
        pos: stat?.pos ?? live.pos ?? "?",
        rs: live.rs,
        po: live.po,
        onOffDelta: stat?.onOffDelta ?? null, // only in static; null = not tracked
      };
    }
    // Step 2: add any static-only players the API didn't return (e.g. DNP / G-League)
    for (const [name, stat] of Object.entries(PLAYER_DB)) {
      if (!merged[name]) merged[name] = stat;
    }
    return merged;
  }, [livePlayerDB]);

  // Live team data is primary; static fills teams the API didn't return
  const effectiveTeamData = useMemo(() => {
    if (!liveTeamData) return TEAM_DATA;
    return { ...TEAM_DATA, ...liveTeamData }; // live wins for any team it returns
  }, [liveTeamData]);

  // ── Auto-fetch box score from server → pre-fill "log actual" field ──────────
  // Declared here so effectiveDB is already in scope (avoids TDZ crash)
  const BOX_STAT_KEY = { points: "pts", rebounds: "reb", assists: "ast",
                         steals: "stl", blocks: "blk", turnovers: "tov",
                         three_pointers: "fg3m", three_point_attempts: "fg3a",
                         field_goal_attempts: "fga", two_point_attempts: "fg2a",
                         field_goal_made: "fgm" };
  const handleFetchBox = useCallback(async (propId) => {
    const pid = pkey ? effectiveDB[pkey]?.pid : null;
    if (!pid) return;
    setFetchingBox(true);
    setFetchedBox(null);
    try {
      const today = new Date().toISOString().slice(0, 10);
      const res = await fetch(`${API_BASE}/box-results/${pid}/${today}`);
      const data = await res.json();
      if (data.success && data.game) {
        setFetchedBox(data.game);
        const statKey = BOX_STAT_KEY[propId];
        if (statKey && data.game[statKey] !== undefined) {
          setActualInput(String(data.game[statKey]));
        }
      }
    } catch {}
    setFetchingBox(false);
  }, [pkey, effectiveDB]);

  // Fetch last-5 game logs + vs-opponent splits — placed here so effectiveDB is already initialized
  useEffect(() => {
    setRecentStats(null);
    setVsOpponentStats(null);
    if (!pkey || !gid) return;
    const player = effectiveDB[pkey];
    if (!player?.pid) return;
    const g = activeRosters[gid];
    if (!g) return;
    const opp = player.team === g.home ? g.away : g.home;
    Promise.all([
      fetch(`${API_BASE}/recent/${player.pid}`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/vs-opponent/${player.pid}/${opp}`).then(r => r.json()).catch(() => null),
    ]).then(([recentData, vsData]) => {
      if (recentData?.success) setRecentStats(recentData.recent ? { ...recentData.recent, _gp: recentData.gp, _gameLog: recentData.gameLog || [], _gameLogFull: recentData.gameLogFull || [] } : null);
      if (vsData?.success) setVsOpponentStats(vsData.vsOpponent ? { ...vsData.vsOpponent, gp: vsData.gp, source: vsData.source } : null);
    });
  }, [pkey, gid, effectiveDB]);

  const game = gid ? activeRosters[gid] : null;
  const db = pkey ? lookupPlayer(pkey, effectiveDB) : null;
  const canRun = !!game && !!db && !!prop && !!line && !isNaN(parseFloat(line));

  // ── Bulk projection helpers — declared after game/effectiveDB to avoid TDZ ──
  const bulkRosterPlayers = useMemo(() => {
    if (!game || !gid) return [];
    const awayList = (activeRosters[gid]?.[game.away] || []).map(n => ({ name: n, team: game.away, isHome: false }));
    const homeList = (activeRosters[gid]?.[game.home] || []).map(n => ({ name: n, team: game.home, isHome: true }));
    return [...awayList, ...homeList];
  }, [game, gid, activeRosters]);

  const runBulkProjections = useCallback(async () => {
    if (!game) return;
    const L5_KEY = { points: "pts", rebounds: "reb", assists: "ast", steals: "stl", blocks: "blk", turnovers: "tov",
      three_pointers: "fg3m", three_point_attempts: "fg3a", field_goal_attempts: "fga", two_point_attempts: "fg2a", field_goal_made: "fgm" };
    const tasks = [];
    for (const player of bulkRosterPlayers) {
      const propsForPlayer = bulkLines[player.name] || {};
      for (const propId of bulkProps) {
        const lineStr = propsForPlayer[propId];
        const line = parseFloat(lineStr);
        if (!lineStr || isNaN(line) || line <= 0) continue;
        tasks.push({ ...player, propId, line });
      }
    }
    if (tasks.length === 0) return;
    setBulkRunning(true);
    setBulkProjResults([]);
    setBulkProgress({ done: 0, total: tasks.length });
    const recentCache = {};
    const results = [];
    const skipReasons = { noPid: [], apiError: [], notSuccess: [] };
    for (const task of tasks) {
      // Normalize via lookupPlayer FIRST — fixes "De'Aaron Fox" (roster casing) vs
      // "de'aaron fox" (DB normalized) mismatch that was silently dropping players.
      const lp = lookupPlayer(task.name, effectiveDB);
      const playerKey = lp?.key || task.name;
      const pid = lp?.pid ?? effectiveDB[task.name]?.pid ?? effectiveDB[playerKey]?.pid;
      if (!pid) {
        skipReasons.noPid.push(`${task.name} (${task.propId})`);
        setBulkProgress(p => ({ ...p, done: p.done + 1 }));
        continue;
      }
      if (!recentCache[playerKey]) {
        try {
          const r = await fetch(`${API_BASE}/recent/${pid}`);
          recentCache[playerKey] = await r.json();
        } catch { recentCache[playerKey] = null; }
      }
      const recent = recentCache[playerKey];
      const gameLogFull = recent?.gameLogFull || recent?.gameLog || [];
      const gameLog = recent?.gameLog || [];
      // Use server-aggregated L5 avg (same source as single-player)
      const L5_AGG_KEY = { points: "ppg", rebounds: "rpg", assists: "apg", steals: "spg", blocks: "bpg", turnovers: "topg",
        three_pointers: "fg3mpg", three_point_attempts: "fg3apg", field_goal_attempts: "fgapg", two_point_attempts: "fg2apg", field_goal_made: "fgmpg" };
      const l5AggKey = L5_AGG_KEY[task.propId];
      const l5avg = l5AggKey && recent?.recent?.[l5AggKey] != null
        ? +Number(recent.recent[l5AggKey]).toFixed(2)
        : null;
      // Use extractL5StatValues — handles combo props (PRA/PA/PR/RA) and new props (3PA/FGA/FGM)
      const l5vals = extractL5StatValues(gameLog, task.propId);
      const opp = task.team === game.home ? game.away : game.home;
      // Pass actual rest days (same as single-player) — null causes wrong is_b2b/is_well_rested features
      const taskRestDays = game.restDays?.[task.team] ?? null;
      const priorResiduals = getResiduals(playerKey, task.propId).map(r => ({ projected: r.projected, actual: r.actual, ctx: r.ctx || null }));
      const last3 = priorResiduals.slice(-3);
      const driftDown = last3.length >= 3 && (last3.reduce((s, r) => s + ((r.actual ?? 0) - (r.projected ?? 0)), 0) / 3) < -2;
      try {
        const resp = await fetch(`${API_BASE}/project`, {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            player_name: playerKey, prop_type: task.propId, book_line: task.line,
            opponent_abbr: opp, team_abbr: task.team, is_home: task.isHome,
            game_date: game?.date || null,
            rest_days: typeof taskRestDays === "number" ? taskRestDays : null,
            l5_avg: l5avg, l5_min: recent?.recent?.min || null, l5_stat_values: l5vals,
            high_leverage: /game\s*7|elimination|finals/i.test(game.title || ""),
            prior_residuals: priorResiduals,
            game_log_context: gameLogFull,
            current_ctx: buildResidualCtx({
              isHome: task.isHome, gameTitle: game?.title, restDays: taskRestDays,
              outPlayers: [],  // bulk has no per-player injury context; injuryContext is single-player only
            }),
          }),
        });
        const data = await resp.json();
        if (data.success) {
          const proj = data.correlated_projection;
          const base = data.base_projection;
          const ev   = +((proj / task.line - 1) * 100).toFixed(2);
          const cv         = data.confidence_band?.cv ?? null;
          const poGp       = data.data_quality?.po_gp ?? 0;
          const q25        = data.breakdown?.xgb_q25 ?? null;
          const q75        = data.breakdown?.xgb_q75 ?? null;
          const trustScore = data.confidence_band?.trust_score ?? null;
          const injAdj     = data.breakdown?.injCascadeAdj ?? 0;
          const mc = data.monte_carlo ?? null;
          const grade = computeGrade({ evPct: ev, cv, poGp, projection: proj, baseline: base, q25, q75, line: task.line, monteCarlo: mc, trustScore, injCascadeAdj: injAdj, driftDown });
          const modelLift = base > 0 ? Math.abs((proj - base) / base) : 0;
          // Quarter-Kelly: uses MC win probability (real signal) vs. EV-derived p_win (circular).
          // b = 10/11 assumes standard -110 juice.
          const isOv = proj > task.line;
          const mcSideProb = mc ? (isOv ? mc.prob_over : mc.prob_under) : null;
          const qKelly = (() => {
            if (!mcSideProb || !task.line) return null;
            const p = Math.min(0.85, Math.max(0.15, mcSideProb));
            const b = 10 / 11;
            const k = Math.max(0, (b * p - (1 - p)) / b);
            return +(k * 0.25 * 100).toFixed(1);
          })();
          const pulledAt = bulkLinePulledAt[task.name]?.[task.propId] ?? null;
          // ── Quantile-gated lean (residual data showed UNDER leans on role
          // players blew up by +120–300% when upside tail was wide). Refuse to
          // lean UNDER when q75 says the player can easily clear the line.
          // Refuse to lean OVER when q25 says the floor sits well below.
          // Keep simple OVER/UNDER lean so all cards remain visible
          const _qLean = proj > task.line ? "OVER" : proj < task.line ? "UNDER" : "HOLD";
          // Detect wide-variance bets where the OPPOSITE tail clears the book
          // line — these are the 100%+-error blowups (Conley/Caruso/Hart/etc).
          // Don't hide them; just demote the grade one tier so they never
          // appear in BEST BETS, and tag them so the user can see why.
          const _wideTail = (q25 != null && q75 != null) && (
            (_qLean === "OVER"  && q25 < task.line * 0.90) ||
            (_qLean === "UNDER" && q75 > task.line * 1.10)
          );
          const _demote = { LOCK: "ACTIONABLE", ACTIONABLE: "WATCH", WATCH: "SKIP", SKIP: "SKIP" };
          const _finalGrade = _wideTail ? _demote[grade] : grade;
          results.push({
            name: playerKey, team: task.team, propId: task.propId, line: task.line,
            proj, base, ev, cv, grade: _finalGrade, poGp, modelLift,
            lean: _qLean,
            wideTail: _wideTail,
            band: data.confidence_band ?? null,
            gameCtx: data.game_context ?? null,
            monteCarlo: mc,
            mcSideProb,
            q25,
            q75,
            trustScore,
            injAdj,
            qKelly,
            pulledAt,
            driftDown,
          });
        } else {
          skipReasons.notSuccess.push(`${playerKey} (${task.propId}): ${data.error || "server returned success:false"}`);
        }
      } catch (e) {
        skipReasons.apiError.push(`${playerKey} (${task.propId}): ${e.message || "fetch failed"}`);
      }
      setBulkProgress(p => ({ ...p, done: p.done + 1 }));
      await new Promise(r => setTimeout(r, 120));
    }
    const totalSkipped = skipReasons.noPid.length + skipReasons.apiError.length + skipReasons.notSuccess.length;
    setBulkSkipped(totalSkipped > 0 ? skipReasons : null);
    if (totalSkipped > 0) {
      console.warn(`Bulk run skipped ${totalSkipped}/${tasks.length}:`, skipReasons);
    }
    // ── Shared-opportunity allocation ─────────────────────────────────────────
    // Guardrail, not a blanket nerf: only activates when entered props for the
    // same team/stat pool materially exceed the market-implied opportunity pool.
    // Strong matchup/EV plays are protected; weaker overs absorb most trims.
    const POOL_CFG = {
      // Tightened from 1.08 → 1.03 — observed all-OVER bulk runs were slipping
      // through because the old threshold allowed 8% of total team-points
      // over-projection before any trimming kicked in. Now any team-points
      // pool exceeding implied total + 3% gets trimmed.
      points:               { minRows: 3, lift: 1.03, label: "points pool", useTeamImplied: true },
      assists:              { minRows: 2, lift: 1.10, label: "assist pool", env: 0.20 },
      rebounds:             { minRows: 2, lift: 1.10, label: "rebound pool", env: 0.08 },
      three_pointers:       { minRows: 2, lift: 1.10, label: "3PM pool", env: 0.18 },
      field_goal_attempts:  { minRows: 2, lift: 1.08, label: "shot-volume pool", env: 0.18 },
      two_point_attempts:   { minRows: 2, lift: 1.08, label: "2PA pool", env: 0.14 },
      field_goal_made:      { minRows: 2, lift: 1.08, label: "FGM pool", env: 0.16 },
      pra:                  { minRows: 2, lift: 1.08, label: "PRA combo pool", env: 0.14 },
      pa:                   { minRows: 2, lift: 1.08, label: "P+A combo pool", env: 0.16 },
      pr:                   { minRows: 2, lift: 1.08, label: "P+R combo pool", env: 0.12 },
      ra:                   { minRows: 2, lift: 1.08, label: "R+A combo pool", env: 0.10 },
    };
    const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
    const recalcAfterAllocation = (r) => {
      r.ev = +((r.proj / r.line - 1) * 100).toFixed(2);
      const projAbove = r.proj > r.line;
      const projBelow = r.proj < r.line;
      r.lean = projAbove ? "OVER" : projBelow ? "UNDER" : "HOLD";
      // Re-check wide-tail flag with new proj
      r.wideTail = (r.q25 != null && r.q75 != null) && (
        (r.lean === "OVER"  && r.q25 < r.line * 0.90) ||
        (r.lean === "UNDER" && r.q75 > r.line * 1.10)
      );
      r.grade = computeGrade({
        evPct: r.ev, cv: r.cv, poGp: r.poGp, projection: r.proj,
        baseline: r.base, q25: r.q25, q75: r.q75, line: r.line,
        monteCarlo: r.monteCarlo, trustScore: r.trustScore ?? r.band?.trust_score,
        injCascadeAdj: r.injAdj ?? 0, driftDown: r.driftDown,
      });
      const sideProb = r.monteCarlo ? (r.lean === "OVER" ? r.monteCarlo.prob_over : r.monteCarlo.prob_under) : null;
      r.mcSideProb = sideProb;
      if (sideProb) {
        const p = Math.min(0.85, Math.max(0.15, sideProb));
        const b = 10 / 11;
        const k = Math.max(0, (b * p - (1 - p)) / b);
        r.qKelly = +(k * 0.25 * 100).toFixed(1);
      } else {
        r.qKelly = null;
      }
      // Apply wide-tail demotion AFTER grade recompute (one tier down, never below SKIP)
      if (r.wideTail) {
        const _demote = { LOCK: "ACTIONABLE", ACTIONABLE: "WATCH", WATCH: "SKIP", SKIP: "SKIP" };
        r.grade = _demote[r.grade] || r.grade;
      }
    };
    const groups = {};
    results.forEach(r => {
      if (!POOL_CFG[r.propId]) return;
      const key = `${r.team}__${r.propId}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(r);
    });
    Object.values(groups).forEach(rows => {
      const cfg = POOL_CFG[rows[0]?.propId];
      if (!cfg || rows.length < cfg.minRows) return;
      const overCount = rows.filter(r => r.lean === "OVER").length;
      if (rows[0].propId === "points" && overCount / rows.length >= 0.75) {
        rows.forEach(r => { r.teamOverWarn = true; });
      }

      const ctx = rows.find(r => r.gameCtx?.total)?.gameCtx;
      const spread = Number(ctx?.spread ?? 0);
      const implied = ctx?.total ? (Number(ctx.total) - spread) / 2 : null;
      const enteredLineSum = rows.reduce((s, r) => s + Number(r.line || 0), 0);
      const projectedSum = rows.reduce((s, r) => s + Number(r.proj || 0), 0);
      if (enteredLineSum <= 0 || projectedSum <= 0) return;

      let allowance = enteredLineSum * cfg.lift;
      if (Number.isFinite(implied) && implied > 0) {
        const envBoost = clamp(((implied - 114) / 114) * (cfg.env ?? 0), -0.035, 0.06);
        allowance = enteredLineSum * (cfg.lift + envBoost);
        // For team-implied props (points), cap the allowance at implied total
        // exactly (was implied * 0.94, which let the pool exceed truth by 6%).
        if (cfg.useTeamImplied) allowance = Math.min(allowance, implied);
      }
      const excess = projectedSum - allowance;
      if (excess <= Math.max(0.65, enteredLineSum * 0.025)) return;

      const overRows = rows
        .filter(r => r.lean === "OVER" && r.proj > r.line)
        .map(r => {
          const edgePts = Math.max(0, r.proj - r.line);
          const mcBoost = r.mcSideProb ? Math.max(0, (r.mcSideProb - 0.52) * 8) : 0;
          const gradeBoost = r.grade === "LOCK" ? 2.4 : r.grade === "ACTIONABLE" ? 1.2 : 0;
          const matchupStrength = 1 + Math.max(0, r.ev) / 18 + mcBoost + gradeBoost + Math.min(1.5, r.modelLift * 4);
          return { r, edgePts, trimWeight: 1 / Math.pow(matchupStrength, 1.35) };
        })
        .filter(x => x.edgePts > 0.05);
      if (!overRows.length) return;

      let remaining = excess;
      let active = overRows;
      for (let pass = 0; pass < 3 && remaining > 0.05 && active.length; pass++) {
        const totalWeight = active.reduce((s, x) => s + x.trimWeight, 0);
        const next = [];
        active.forEach(x => {
          const desired = remaining * (x.trimWeight / totalWeight);
          const maxTrim = x.r.grade === "LOCK" ? x.edgePts * 0.35
                        : x.r.grade === "ACTIONABLE" ? x.edgePts * 0.65
                        : x.edgePts * 0.90;
          const prevTrim = Number(x.r.resourceTrim || 0);
          const trim = Math.min(desired, Math.max(0, maxTrim - prevTrim));
          if (trim > 0) {
            x.r.originalProj = x.r.originalProj ?? x.r.proj;
            x.r.resourceTrim = +(prevTrim + trim).toFixed(2);
            x.r.proj = +Math.max(0, x.r.proj - trim).toFixed(1);
            x.r.resourceAllocated = true;
            x.r.resourceType = cfg.label;
            x.r.poolProjectedBefore = +projectedSum.toFixed(1);
            x.r.poolAllowance = +allowance.toFixed(1);
            if (x.r.propId === "points") {
              x.r.teamTotalAllocated = true;
              x.r.teamTotalTrim = x.r.resourceTrim;
              x.r.teamImplied = Number.isFinite(implied) ? +implied.toFixed(1) : null;
              x.r.teamProjectedBefore = x.r.poolProjectedBefore;
              x.r.teamAllowance = x.r.poolAllowance;
            }
            recalcAfterAllocation(x.r);
            remaining -= trim;
          }
          if ((x.r.resourceTrim || 0) < maxTrim - 0.05) next.push(x);
        });
        active = next;
      }
      if (remaining > 0.25) rows.forEach(r => { r.resourceResidual = +remaining.toFixed(2); });
    });

    // ── Shared-resource conflict check (REB, AST) ──────────────────────────────
    // If 2+ teammates are both LOCK on the same shared-resource prop, they compete
    // for the same pool. Keep the player with the highest EV as LOCK; downgrade
    // the rest to ACTIONABLE and flag them so the UI can show a conflict warning.
    const SHARED_PROPS = new Set(["rebounds", "assists"]);
    const sharedGroups = {};
    results.forEach(r => {
      if (r.grade === "LOCK" && SHARED_PROPS.has(r.propId)) {
        const key = `${r.team}__${r.propId}`;
        if (!sharedGroups[key]) sharedGroups[key] = [];
        sharedGroups[key].push(r);
      }
    });
    Object.values(sharedGroups).forEach(group => {
      if (group.length < 2) return;
      // Sort by EV descending — keep top player as LOCK, downgrade others
      group.sort((a, b) => Math.abs(b.ev) - Math.abs(a.ev));
      group.slice(1).forEach(r => {
        r.grade = "ACTIONABLE";
        r.sharedConflict = true;
        // Re-compute Kelly with updated grade
        if (r.ev && r.line) {
          const p_win = Math.min(0.85, Math.max(0.15, (Math.abs(r.ev) / 100 + 1) / 2));
          const b = Math.abs(r.ev) / 100;
          const k = b > 0 ? Math.max(0, (b * p_win - (1 - p_win)) / b) : 0;
          r.qKelly = +(k * 0.25 * 100).toFixed(1);
        }
      });
    });

    // ── Correlated stack detection ─────────────────────────────────────────
    // Group results by player. Detect when the same player has multiple OVERs
    // on statistically correlated props — this is a genuine positive signal
    // (the model agrees across different markets for the same player).
    // Positive stacks: pts+ast (playmaker usage), pts+reb (volume game),
    //   pts+ast+reb (full PRA stack). Mixed signals are flagged too.
    const CORR_POSITIVE = [
      new Set(["points","assists"]),          // playmaker: pts+ast go together
      new Set(["points","rebounds"]),         // volume: fast game lifts both
      new Set(["points","assists","rebounds"]),
      new Set(["assists","rebounds"]),
    ];
    const byPlayer = {};
    results.forEach(r => {
      if (!byPlayer[r.name]) byPlayer[r.name] = [];
      byPlayer[r.name].push(r);
    });
    Object.values(byPlayer).forEach(group => {
      if (group.length < 2) return;
      const overProps  = new Set(group.filter(r => r.lean === "OVER"  && r.grade !== "SKIP").map(r => r.propId));
      const underProps = new Set(group.filter(r => r.lean === "UNDER" && r.grade !== "SKIP").map(r => r.propId));
      // Check for positive correlated stacks
      const isStack = CORR_POSITIVE.some(s => {
        const sArr = [...s];
        return sArr.every(p => overProps.has(p));
      });
      if (isStack && overProps.size >= 2) {
        group.forEach(r => { if (r.lean === "OVER" && r.grade !== "SKIP") r.corrStack = true; });
      }
      // Flag mixed: player has OVER on one correlated prop but UNDER on another
      const mixedPairs = [["points","assists"],["points","rebounds"]];
      const isMixed = mixedPairs.some(([a, b]) =>
        (overProps.has(a) && underProps.has(b)) || (underProps.has(a) && overProps.has(b))
      );
      if (isMixed) {
        group.forEach(r => { r.corrMixed = true; });
      }
    });

    results.forEach(r => {
      r.betScore = betQualityScore(r);
      r.blockReason = betBlockReason(r);
    });
    const gradeOrder = { LOCK: 0, ACTIONABLE: 1, WATCH: 2, SKIP: 3 };
    results.sort((a, b) =>
      (gradeOrder[a.grade] - gradeOrder[b.grade]) ||
      ((b.betScore ?? 0) - (a.betScore ?? 0)) ||
      (Math.abs(b.ev) - Math.abs(a.ev))
    );
    setBulkProjResults(results);
    setBulkRunning(false);
  }, [game, bulkRosterPlayers, bulkLines, bulkProps, effectiveDB, getResiduals, buildResidualCtx]);

  // ── Bulk live-line fetch — ONE server call, server does combined-markets per game ──
  const fetchBulkLines = useCallback(async () => {
    if (!bulkRosterPlayers.length || !bulkProps.length) return;
    setBulkOddsLoading(true);
    setBulkOddsStatus("Fetching live lines…");
    try {
      const r = await fetch(`${API_BASE}/live-lines-bulk`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          players: bulkRosterPlayers.map(p => p.name),
          props:   bulkProps,
        }),
      });
      const d = await r.json();
      if (r.status === 503 && d.error?.includes("quota")) {
        setBulkOddsStatus(`⚠ Odds API quota exhausted — upgrade plan at the-odds-api.com (remaining: ${d.quota_remaining ?? "?"})`);
        setBulkOddsLoading(false);
        return;
      }
      if (!r.ok) {
        setBulkOddsStatus(`⚠ ${d.error || "fetch failed"}`);
        setBulkOddsLoading(false);
        return;
      }
      const linesByPlayer = d.lines || {};
      const now = Date.now();
      const updates = {};
      const timestamps = {};
      for (const player of bulkRosterPlayers) {
        const lower = player.name.toLowerCase();
        const per = linesByPlayer[lower] || linesByPlayer[player.name] || {};
        updates[player.name] = {};
        timestamps[player.name] = {};
        for (const propId of bulkProps) {
          const v = per[propId];
          if (v != null) {
            updates[player.name][propId] = String(v);
            timestamps[player.name][propId] = now;
          }
        }
      }
      setBulkLines(prev => {
        const next = { ...prev };
        for (const [name, props] of Object.entries(updates)) {
          next[name] = { ...(next[name] || {}), ...props };
        }
        return next;
      });
      setBulkLinePulledAt(prev => {
        const next = { ...prev };
        for (const [name, ts] of Object.entries(timestamps)) {
          next[name] = { ...(next[name] || {}), ...ts };
        }
        return next;
      });
      const filled  = d.filled  ?? 0;
      const missing = d.missing ?? 0;
      const qLeft   = d.quota_remaining;
      setBulkOddsStatus(
        `${filled} line${filled !== 1 ? "s" : ""} filled · ${missing} not posted` +
        (qLeft != null ? ` · quota left: ${qLeft}` : "")
      );
    } catch (e) {
      setBulkOddsStatus(`⚠ ${e.message || "network error"}`);
    }
    setBulkOddsLoading(false);
  }, [bulkRosterPlayers, bulkProps]);

  // ── Auto residual logger — no lines needed, proj vs box-score actual ─────────
  // Runs after a game completes. For each roster player: fetches box score,
  // runs /api/project (using l5avg as dummy line so the projection is unaffected),
  // then saves proj vs actual for pts + reb + ast simultaneously.
  const runAutoLog = useCallback(async () => {
    if (!game || !gid) return;
    const LOG_PROPS = ["points", "rebounds", "assists"];
    const L5_KEY   = { points: "pts", rebounds: "reb", assists: "ast" };
    setAutoLogRunning(true);
    setAutoLogResult(null);
    setAutoLogProgress({ done: 0, total: bulkRosterPlayers.length });

    const recentCache = {};
    let logged = 0, skipped = 0;
    const playerSummary = [];

    for (const player of bulkRosterPlayers) {
      const pid = effectiveDB[player.name]?.pid;
      if (!pid) { setAutoLogProgress(p => ({ ...p, done: p.done + 1 })); skipped++; continue; }

      // 1. Fetch box score for today's game
      let box = null;
      try {
        const r = await fetch(`${API_BASE}/box-results/${pid}`);
        const d = await r.json();
        if (d.success && d.game) box = d.game;
      } catch {}
      if (!box) { setAutoLogProgress(p => ({ ...p, done: p.done + 1 })); skipped++; continue; }

      // 2. Fetch recent for l5 data (cached server-side)
      if (!recentCache[player.name]) {
        try {
          const r = await fetch(`${API_BASE}/recent/${pid}`);
          recentCache[player.name] = await r.json();
        } catch { recentCache[player.name] = null; }
      }
      const recent = recentCache[player.name];
      const gameLog = recent?.gameLog || [];
      const opp = player.team === game.home ? game.away : game.home;
      const playerLogged = [];

      // 3. Project + log each prop
      for (const propId of LOG_PROPS) {
        const actualKey = L5_KEY[propId];
        const actual = box[actualKey];
        if (actual === undefined || actual === null) continue;

        const l5vals = gameLog.map(g => g[actualKey] || 0);
        const l5avg  = l5vals.length
          ? +(l5vals.reduce((a, b) => a + b, 0) / l5vals.length).toFixed(2)
          : actual;  // fallback: use actual itself (residual = 0, harmless)

        const priorResiduals = getResiduals(player.name, propId)
          .map(r => ({ projected: r.projected, actual: r.actual, ctx: r.ctx || null }));

        try {
          const resp = await fetch(`${API_BASE}/project`, {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              player_name: player.name, prop_type: propId,
              book_line: l5avg,          // dummy — doesn't affect projection value
              opponent_abbr: opp, team_abbr: player.team, is_home: player.isHome,
              game_date: game?.date || null,
              rest_days: null,
              l5_avg: l5avg, l5_min: recent?.recent?.min || null, l5_stat_values: l5vals,
              high_leverage: /game\s*7|elimination|finals/i.test(game.title || ""),
              prior_residuals: priorResiduals,
            }),
          });
          const data = await resp.json();
          if (data.success) {
            const proj = data.correlated_projection;
            const ctx = {
              home: player.isHome, po: true,
              b2b: false,
              leverage: /game\s*7|elimination|finals/i.test(game.title || ""),
              out: [],
              fullStats: box,
            };
            saveResidual(player.name, propId, proj, actual, ctx);
            logged++;
            playerLogged.push(`${propId[0].toUpperCase()}:${actual}`);
          }
        } catch {}
        await new Promise(r => setTimeout(r, 80));
      }

      if (playerLogged.length > 0) {
        playerSummary.push({ name: player.name, team: player.team, logged: playerLogged });
      }
      setAutoLogProgress(p => ({ ...p, done: p.done + 1 }));
      await new Promise(r => setTimeout(r, 100));
    }

    setAutoLogResult({ logged, skipped, players: playerSummary });
    setAutoLogRunning(false);
  }, [game, gid, bulkRosterPlayers, effectiveDB, getResiduals, saveResidual]);

  // Merge live injury report (API) over static INJURIES baseline — live takes priority
  const getInjury = useCallback((playerKey) => {
    const k = (playerKey || "").toLowerCase();
    // Live data is authoritative when loaded successfully.
    // The server's /api/injuries already merges ESPN + live boxscore + overrides
    // and auto-clears players who are actually playing right now. If the live
    // response loaded and this player isn't in it, they are NOT injured —
    // do NOT fall back to the static dict (it can have stale OUT statuses
    // for players the server has dynamically cleared).
    if (liveInjuries && liveInjuries.injuries) {
      const live = liveInjuries.injuries[k];
      return live ? { ...live, isLive: true } : null;
    }
    // Static fallback ONLY when the live API completely failed (offline mode).
    const stat = INJURIES[k];
    if (stat) return { ...stat, isLive: false };
    return null;
  }, [liveInjuries]);

  // ── Injury usage redistribution — computed live from roster + injury status + NBA.com USG% ──
  // When teammate(s) are OUT, their scoring load gets redistributed to remaining players
  // proportional to current PO usage share. Uses real nba_api USG% — no guessing.
  const injuryContext = useMemo(() => {
    if (!gid || !pkey || !game) return { adj: 1.0, outPlayers: [], boostPPG: 0 };
    const player = effectiveDB[pkey];
    if (!player) return { adj: 1.0, outPlayers: [], boostPPG: 0 };

    const teamKey = player.team;
    const roster = (game[teamKey] || []);

    // Identify OUT teammates (not the player themselves)
    const outPlayers = [];
    const remainingKeys = [];
    roster.forEach(name => {
      if (name === pkey) { remainingKeys.push(name); return; }
      const inj = getInjury(name);
      if (inj?.status === "OUT") {
        const p = effectiveDB[name];
        if (p) outPlayers.push({ name, ppg: p.po?.ppg ?? p.rs?.ppg ?? 0, usg: p.po?.usg ?? p.rs?.usg ?? 0, min: p.po?.min ?? p.rs?.min ?? 0 });
      } else {
        remainingKeys.push(name);
      }
    });

    if (outPlayers.length === 0) return { adj: 1.0, outPlayers: [], boostPPG: 0 };

    // Sum remaining players' usage shares (for denominator)
    const remainingUsgTotal = remainingKeys.reduce((sum, name) => {
      const p = effectiveDB[name];
      return sum + (p?.po?.usg ?? p?.rs?.usg ?? 0);
    }, 0);
    if (remainingUsgTotal <= 0) return { adj: 1.0, outPlayers, boostPPG: 0 };

    // Total freed PPG from all OUT players
    const freedPPG = outPlayers.reduce((sum, p) => sum + p.ppg, 0);

    // My share of remaining usage
    const myUsg = player.po?.usg ?? player.rs?.usg ?? 0;
    const myShare = myUsg / remainingUsgTotal; // e.g., 0.22 = I absorb 22% of freed load

    // Estimated scoring boost this player absorbs
    const boostPPG = +(freedPPG * myShare).toFixed(2);
    const myPPG = player.po?.ppg ?? player.rs?.ppg ?? 1;
    const rawAdj = 1 + (boostPPG / Math.max(myPPG, 1));
    const adj = +Math.max(1.0, Math.min(1.25, rawAdj)).toFixed(4);

    return { adj, outPlayers, boostPPG, myShare: +(myShare * 100).toFixed(1), freedPPG: +freedPPG.toFixed(1) };
  }, [gid, pkey, game, effectiveDB, liveInjuries, getInjury]);

  const allP = game ? [game.home, game.away].flatMap(t => ((activeRosters[gid] || {})[t] || []).map(k => ({ key: k, team: t, ...effectiveDB[k] }))) : [];
  const filtered = ddOpen && game ? (pname.trim() ? allP.filter(p => p.key.includes(pname.toLowerCase().trim())) : allP) : [];
  const byTeam = {};
  filtered.forEach(p => { if (!byTeam[p.team]) byTeam[p.team] = []; byTeam[p.team].push(p); });

  const reset = () => { setResult(null); setErr(null); setPname(""); setPkey(null); setProp(null); setLine(""); setOddsStatus(""); setDdOpen(false); setActualInput(""); };
  const selGame = id => { setGid(id); setPname(""); setPkey(null); setResult(null); setErr(null); setDdOpen(false); };

  // ── Auto-fetch live sportsbook line when player + prop are selected ──
  useEffect(() => {
    if (!pkey || !prop) { setOddsStatus(""); return; }
    setOddsLoading(true);
    setOddsStatus("Fetching live line…");
    const encoded = encodeURIComponent(pkey);
    fetch(`${API_BASE}/live-line/${encoded}/${prop.id}`)
      .then(async r => {
        const d = await r.json();
        if (r.ok) {
          setLine(String(d.consensus_line));
          setOddsStatus(`Live: ${d.consensus_line} · ${d.books_tracked} book${d.books_tracked !== 1 ? "s" : ""}`);
        } else {
          setOddsStatus(d.error || "No line posted yet");
        }
      })
      .catch(() => setOddsStatus("Odds unavailable"))
      .finally(() => setOddsLoading(false));
  }, [pkey, prop]);

  // ── Extract L5 game-by-game stat values for the active prop type ──
  // Feeds server's _confidence_band → variance/floor/ceiling/trust score.
  const extractL5StatValues = (gameLog, propId) => {
    if (!gameLog || gameLog.length === 0) return [];
    const id = (propId || "").toLowerCase();
    if (id === "pra")            return gameLog.map(g => (g.pts||0) + (g.reb||0) + (g.ast||0));
    if (id === "pa")             return gameLog.map(g => (g.pts||0) + (g.ast||0));
    if (id === "pr")             return gameLog.map(g => (g.pts||0) + (g.reb||0));
    if (id === "ra")             return gameLog.map(g => (g.reb||0) + (g.ast||0));
    if (id === "three_pointers")        return gameLog.map(g => g.fg3m || 0);
    if (id === "three_point_attempts")  return gameLog.map(g => g.fg3a || 0);
    if (id === "field_goal_attempts")   return gameLog.map(g => g.fga  || 0);
    if (id === "two_point_attempts")    return gameLog.map(g => Math.max(0, (g.fga||0) - (g.fg3a||0)));
    if (id === "field_goal_made")       return gameLog.map(g => g.fgm  || 0);
    const propStatKey = { points:"pts", assists:"ast", rebounds:"reb", steals:"stl", blocks:"blk" };
    const k = propStatKey[id] || "pts";
    return gameLog.map(g => g[k] || 0);
  };

  // ── 4-tier grading: LOCK / ACTIONABLE / WATCH / SKIP ──
  // Combines edge with model trust signals:
  //   • EV%        — model edge over book line
  //   • CV         — coefficient of variation from L5 game log (volatility check)
  //   • po_gp      — playoff sample size (rookies / debuts get filtered)
  //   • modelLift  — directional projection move vs baseline (catches unsupported reaching)
  //
  // Why modelLift instead of bookGap: a 30%+ disagreement with the book can mean
  // EITHER (a) book is mispriced — model just stamps the player's averages
  // correctly while the book sits below them (BET IT), OR (b) model is reaching —
  // adjustments pushed projection far above the player's own baseline (SKIP IT).
  // modelLift distinguishes these: tiny lift = book is wrong; big lift can be model reach.
  const computeGrade = ({ evPct, cv, poGp, projection, baseline, q25 = null, q75 = null, line = null, monteCarlo = null, trustScore = null, injCascadeAdj = 0, driftDown = false }) => {
    // ── Kelly-driven grading (replaces the old EV-threshold heuristic) ─────
    // Compute the quarter-Kelly bet size from MC win probability and map to
    // tiers. This naturally handles wide tails (low MC prob → tiny Kelly →
    // demoted automatically) without arbitrary EV thresholds.
    //
    // qKelly thresholds (% of bankroll):
    //   ≥ 2.0%   → LOCK         (big confident edge, low variance)
    //   0.8–2.0% → ACTIONABLE   (clean edge)
    //   0.2–0.8% → WATCH        (small edge or moderate variance)
    //   < 0.2%   → SKIP         (no meaningful bet)
    //
    // EV-based fallback kicks in only when MC simulation didn't run.
    const absEv     = Math.abs(evPct || 0);
    const liftSigned = baseline > 0 ? (projection - baseline) / baseline : 0;
    const modelLift = Math.abs(liftSigned);
    const isOver  = projection > (line || 0);
    const mcProb  = isOver ? (monteCarlo?.prob_over ?? null) : (monteCarlo?.prob_under ?? null);
    const order = ["LOCK", "ACTIONABLE", "WATCH", "SKIP"];

    let tier = "SKIP";
    if (mcProb != null && line && line > 0) {
      // Quarter-Kelly with -110 juice (b = 10/11)
      const p = Math.min(0.85, Math.max(0.15, mcProb));
      const b = 10 / 11;
      const kelly = Math.max(0, (b * p - (1 - p)) / b);
      const qKellyPct = kelly * 0.25 * 100;   // quarter-Kelly, in % of bankroll
      // Tightened thresholds — 10/45 BEST BETs was too generous. New mapping:
      //   ≥ 3.5%  → LOCK (MC p ≥ ~0.60, strong signal)
      //   1.2–3.5%→ ACTIONABLE
      //   0.3–1.2%→ WATCH
      //   < 0.3%  → SKIP
      if (qKellyPct >= 3.5)       tier = "LOCK";
      else if (qKellyPct >= 1.2)  tier = "ACTIONABLE";
      else if (qKellyPct >= 0.3)  tier = "WATCH";
      else                        tier = "SKIP";

      // Low-line guardrail — small absolute edges on small lines inflate to
      // huge EV% but variance can easily swallow them (the Alvarado 2.5→5.3
      // pattern). Require minimum 1.5pt absolute spread for LOCK and 1.0pt
      // for ACTIONABLE when line < 6.
      if (line < 6 && line > 0) {
        const absSpread = Math.abs(projection - line);
        if (tier === "LOCK" && absSpread < 1.5)         tier = "ACTIONABLE";
        if (tier === "ACTIONABLE" && absSpread < 1.0)   tier = "WATCH";
      }
    } else {
      // Fallback when MC didn't run — use legacy EV thresholds with safety nets
      const trustOk   = trustScore != null ? trustScore >= 70 : (cv != null && cv < 0.30);
      const cvOk40    = cv != null && cv < 0.40;
      const cvKnown   = cv != null;
      const sampleOk  = (poGp || 0) >= 3;
      const liftAligned = line == null || line <= 0 || Math.abs(projection - line) < 0.01
        ? true
        : isOver ? liftSigned >= -0.01 : liftSigned <= 0.01;
      const liftOk15  = liftAligned ? modelLift < 0.20 : modelLift < 0.10;
      const liftOk20  = liftAligned ? modelLift < 0.25 : modelLift < 0.15;
      const quantileSafe = line == null || line <= 0
        ? true
        : isOver
          ? (q25 == null || q25 >= line * 0.90)
          : (q75 == null || q75 <= line * 1.10);
      const lockLiftOk = liftAligned ? modelLift < 0.20 : modelLift < 0.08;
      if (absEv > 10 && trustOk && sampleOk && quantileSafe && lockLiftOk) tier = "LOCK";
      else if (absEv > 7 && (cvOk40 || !cvKnown) && sampleOk && liftOk15) tier = "ACTIONABLE";
      else if (absEv > 4 && liftOk20) tier = "WATCH";
    }

    // Model-reach guardrail: extreme lifts on small samples still get capped
    // (this was the audit's modelLift fix — Gemini agreed it stays in)
    if (tier === "LOCK" && modelLift >= 0.20) tier = "ACTIONABLE";
    // Systematic over-projection: model has missed high 3+ times in a row → drop one tier.
    if (driftDown) tier = order[Math.min(order.indexOf(tier) + 1, 3)];
    return tier;
  };

  const run = useCallback(async () => {
    if (!canRun) return;
    setErr(null);
    const l = parseFloat(line);
    const player = db;
    const pt = player.team;
    const ot = pt === game.home ? game.away : game.home;
    if (!(game[pt] || []).includes(player.key)) { setErr(`${dn(player.key)} (${pt}) is not in this game (${game.away} @ ${game.home}).`); return; }
    const isHome = pt === game.home;
    const restDays = game.restDays?.[pt] ?? null;
    const playerSplits   = homeAwaySplits?.[pkey]   ?? null;
    const playerScoring  = scoringBreakdown?.[pkey] ?? null;
    const playerClutch   = clutchStats?.[pkey]      ?? null;
    const playerTracking = trackingStats?.[pkey]    ?? null;
    let runRecentStats = recentStats;
    let runVsOpponentStats = vsOpponentStats;

    if (nbaApiStatus === "live" && player.pid && (!runRecentStats || !runRecentStats._gameLog?.length)) {
      try {
        const [recentData, vsData] = await Promise.all([
          fetch(`${API_BASE}/recent/${player.pid}`).then(r => r.json()).catch(() => null),
          fetch(`${API_BASE}/vs-opponent/${player.pid}/${ot}`).then(r => r.json()).catch(() => null),
        ]);
        if (recentData?.success && recentData.recent) {
          runRecentStats = {
            ...recentData.recent,
            _gp: recentData.gp,
            _gameLog: recentData.gameLog || [],
            _gameLogFull: recentData.gameLogFull || [],
          };
          setRecentStats(runRecentStats);
        }
        if (vsData?.success && vsData.vsOpponent) {
          runVsOpponentStats = { ...vsData.vsOpponent, gp: vsData.gp, source: vsData.source };
          setVsOpponentStats(runVsOpponentStats);
        }
      } catch {}
    }

    // ── Phase A: client-side projection (instant, no network) ─────────────
    const proj = computeProjection(prop, player, pt, ot, isHome, restDays, effectiveTeamData, runRecentStats, runVsOpponentStats, playerSplits, teamDefense, playerScoring, playerClutch, injuryContext.adj, playerTracking, matchupDelta);
    const edge    = +(proj.adjustedProjection - l).toFixed(2);
    const verdict = Math.abs(edge) < 0.3 ? "push" : edge > 0 ? "over" : "under";
    const evPct   = l > 0 ? +((proj.adjustedProjection - l) / l * 100).toFixed(2) : 0;
    const absEv   = Math.abs(evPct);
    const confGrade = absEv > 12 ? "S-TIER" : absEv > 8 ? "A-TIER" : absEv > 4 ? "B-TIER" : "NO BET";
    const conf      = absEv >= (3/l*100) && player.po.gp >= 4 ? "HIGH" : absEv >= (1.5/l*100) ? "MEDIUM" : "LOW";
    const impactList = [
      { name: "Pace",              impact: (proj.paceAdj - 1) * 100 },
      { name: "Zone Defense",      impact: (proj.defAdj - 1) * 100 },
      { name: `Matchup Δ (L5 ${ot})`, impact: (proj.matchupDeltaAdj - 1) * 100 },
      { name: "Home/Road",         impact: (proj.homeAdj - 1) * 100 },
      { name: "Rest Days",         impact: (proj.restAdj - 1) * 100 },
      { name: "On/Off NETRTG",     impact: (proj.onOffAdj - 1) * 100 },
      { name: "TS% Shift",         impact: (proj.tsAdj - 1) * 100 },
      { name: "3pt Defense",       impact: (proj.fg3DefAdj - 1) * 100 },
      { name: "Clutch Rate",       impact: (proj.clutchAdj - 1) * 100 },
      { name: "Injury/USG",        impact: (proj.injAdj - 1) * 100 },
      { name: `vs ${ot} History`,  impact: (proj.vsOppAdj - 1) * 100 },
      { name: "AST Conv Regress",  impact: (proj.astConvAdj - 1) * 100 },
    ].filter(v => Math.abs(v.impact) > 0.05).sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

    // Show client result immediately so user isn't waiting
    setResult({ player, prop, game, pt, ot, l, proj, verdict, edge, evPct, confGrade, impactList, conf,
                ptd: effectiveTeamData[pt], otd: effectiveTeamData[ot], isHome, restDays,
                serverCorr: null }); // serverCorr null = server layer pending

    // ── Phase B: server Correlation Logic Layer (async, enriches the result) ──
    // Only fires when backend is live — falls back to client result gracefully.
    const spResiduals = getResiduals(player.key, prop.id);
    const spLast3 = spResiduals.slice(-3);
    const spDriftDown = spLast3.length >= 3 && (spLast3.reduce((s, r) => s + ((r.actual ?? 0) - (r.projected ?? 0)), 0) / 3) < -2;
    if (nbaApiStatus === "live") {
      try {
        const ctrl = new AbortController();
        const tid  = setTimeout(() => ctrl.abort(), 12000); // 12s timeout
        const resp = await fetch(`${API_BASE}/project`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          signal: ctrl.signal,
          body: JSON.stringify({
            player_name:    player.key,
            prop_type:      prop.id,
            book_line:      l || null,
            opponent_abbr:  ot,
            // ── Verified context for server correlation engine ──
            team_abbr:      pt,
            is_home:        isHome,
            game_date:      game?.date || null,
            rest_days:      typeof restDays === "number" ? restDays : null,
            l5_avg:         proj.propRecent ?? null,           // client-computed L5 PO avg
            l5_min:         runRecentStats?.min ?? null,          // client-computed L5 PO minutes/game
            l5_stat_values: extractL5StatValues(runRecentStats?._gameLog, prop.id),  // for variance band
            high_leverage:  /game\s*7|elimination|finals/i.test(game?.title || ""),
            // ── Residual calibration — historical projection/actual pairs from localStorage ──
            prior_residuals: getResiduals(player.key, prop.id),
            // ── KNN Monte Carlo — full game log for contextual neighbor selection ──
            game_log_context: runRecentStats?._gameLogFull || runRecentStats?._gameLog || [],
            // ── Current game context for bucket-aware Adj 14 (server matches similar samples) ──
            current_ctx: buildResidualCtx({
              isHome, gameTitle: game?.title, restDays,
              outPlayers: injuryContext?.outPlayers || [],
            }),
          }),
        });
        clearTimeout(tid);
        if (resp.ok) {
          const sd = await resp.json();
          if (sd.success) {
            // Re-grade using server correlated_projection
            const sProj   = sd.correlated_projection;
            const sEdge   = +(sProj - l).toFixed(2);
            const sVerdict= Math.abs(sEdge) < 0.3 ? "push" : sEdge > 0 ? "over" : "under";
            const sEvPct  = l > 0 ? +((sProj - l) / l * 100).toFixed(2) : evPct;
            // 4-tier grade: LOCK / ACTIONABLE / WATCH / SKIP
            // baseline = blended pre-correlation baseline (catches "model is reaching")
            const sGrade  = computeGrade({
              evPct:         sEvPct,
              cv:            sd.confidence_band?.cv,
              poGp:          sd.data_quality?.po_gp,
              projection:    sProj,
              baseline:      sd.base_projection,
              q25:           sd.breakdown?.xgb_q25 ?? null,
              q75:           sd.breakdown?.xgb_q75 ?? null,
              line:          l,
              monteCarlo:    sd.monte_carlo ?? null,
              trustScore:    sd.confidence_band?.trust_score ?? null,
              injCascadeAdj: sd.breakdown?.injCascadeAdj ?? 0,
              driftDown:     spDriftDown,
            });
            // Server drivers replace the client impactList in the terminal panel
            const serverDrivers = (sd.drivers || []).map(d => ({ name: d, impact: null }));
            setResult(prev => prev ? { ...prev,
              verdict: sVerdict, edge: sEdge, evPct: sEvPct, confGrade: sGrade,
              serverCorr: { projection: sProj, base: sd.base_projection,
                            evEdge: sd.ev_edge, breakdown: sd.breakdown,
                            drivers: sd.drivers, dataQuality: sd.data_quality,
                            confidenceBand: sd.confidence_band, bookGap: sd.book_gap,
                            monteCarlo: sd.monte_carlo,
                            analystNarrative: sd.analyst_narrative },
              impactList: serverDrivers.length > 0 ? serverDrivers : prev.impactList,
            } : prev);
          }
        }
      } catch { /* server layer failed — keep client result unchanged */ }
    }
  }, [canRun, game, db, prop, line, pkey, effectiveTeamData, recentStats, vsOpponentStats, homeAwaySplits, teamDefense, scoringBreakdown, clutchStats, injuryContext, nbaApiStatus, getResiduals, buildResidualCtx]);

  const exportToExcel = useCallback(() => {
    if (!result) return;
    const { player, prop: pr, game: g, pt, ot, l, proj, verdict, edge, conf, isHome, restDays, ptd, otd } = result;
    const dname = dn(player.key);
    const ts = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    // Build CSV content that opens cleanly in Excel
    const rows = [
      ["PROP EDGE MODEL — NBA PLAYOFF PROJECTION", "", "", "", ""],
      ["Generated", ts, "", "", ""],
      ["", "", "", "", ""],
      ["PLAYER", dname, "", "", ""],
      ["TEAM", pt, "vs", ot, ""],
      ["GAME", `${g.away} @ ${g.home}`, "", "", ""],
      ["SERIES", g.series, "", "", ""],
      ["PROP", pr.label, "", "", ""],
      ["BOOK LINE", l, "", "", ""],
      ["", "", "", "", ""],
      ["STAT AVERAGES", "RS (40% wt)", "PO (60% wt)", "BLENDED", ""],
      [pr.label3, proj.propRS, proj.propPO, proj.blended, ""],
      ["GP", player.rs.gp, player.po.gp, "", ""],
      ["MIN/G", player.rs.min, player.po.min, "", ""],
      player.rs.usg ? ["USG%", player.rs.usg, player.po.usg || "—", "", ""] : [],
      player.rs.ts ? ["TS%", player.rs.ts, player.po.ts || "—", "", ""] : [],
      ["", "", "", "", ""],
      ["PROJECTION MATH", "MULTIPLIER", "IMPACT", "SOURCE", ""],
      ["Blended baseline", proj.blended, "—", "Verified DB", ""],
      [`RS Pace (${pt} ${ptd?.rsPace} · ${ot} ${otd?.rsPace})`, proj.paceAdj.toFixed(4), `${((proj.paceAdj - 1) * 100).toFixed(2)}%`, "NBA.com RS", ""],
      proj.defAdj !== 1.0 ? [`${ot} dEFF (${otd?.dEFF} vs lg avg ${LEAGUE_AVG_dEFF})`, proj.defAdj.toFixed(4), `${((proj.defAdj - 1) * 100).toFixed(2)}%`, "NBAsuffer PO", ""] : [],
      proj.homeAdj !== 1.0 ? [`Home/Road (${isHome ? "HOME" : "ROAD"})`, proj.homeAdj.toFixed(4), `${((proj.homeAdj - 1) * 100).toFixed(2)}%`, "NBAsuffer RS splits", ""] : [],
      proj.restAdj !== 1.0 ? [`Rest days (${restDays}d)`, proj.restAdj.toFixed(4), `${((proj.restAdj - 1) * 100).toFixed(2)}%`, "Sportradar + NBAsuffer", ""] : [],
      proj.onOffAdj !== 1.0 ? [`On/Off delta (${player.onOffDelta > 0 ? "+" : ""}${player.onOffDelta})`, proj.onOffAdj.toFixed(4), `${((proj.onOffAdj - 1) * 100).toFixed(2)}%`, "NBA.com On/Off PO", ""] : [],
      proj.tsAdj !== 1.0 ? [`TS% shift (${player.rs.ts}% RS → ${player.po.ts}% PO)`, proj.tsAdj.toFixed(4), `${((proj.tsAdj - 1) * 100).toFixed(2)}%`, "NBA.com Players Advanced", ""] : [],
      ["MODEL PROJECTION", proj.adjustedProjection, "", "", ""],
      ["", "", "", "", ""],
      ["RESULT", "", "", "", ""],
      ["VERDICT", verdict.toUpperCase(), "", "", ""],
      ["CONFIDENCE", conf, "", "", ""],
      ["EDGE vs LINE", `${edge > 0 ? "+" : ""}${edge} ${pr.label3}`, "", "", ""],
      ["EDGE %", `${proj.blended > 0 ? (((proj.adjustedProjection - l) / proj.blended) * 100).toFixed(2) : 0}%`, "", "", ""],
      ["vs RS avg", `${proj.propRS > 0 ? (((proj.adjustedProjection - proj.propRS) / proj.propRS) * 100).toFixed(2) : 0}%`, "", "", ""],
      ["vs PO avg", `${proj.propPO > 0 ? (((proj.adjustedProjection - proj.propPO) / proj.propPO) * 100).toFixed(2) : 0}%`, "", "", ""],
      ["Total adj from multipliers", `${proj.blended > 0 ? (((proj.adjustedProjection - proj.blended) / proj.blended) * 100).toFixed(2) : 0}%`, "", "", ""],
      ["", "", "", "", ""],
      ["TEAM DATA", "PACE (RS)", "oEFF (PO)", "dEFF (PO)", "Net"],
      [pt, ptd?.rsPace, ptd?.oEFF, ptd?.dEFF, ptd?.eDIFF],
      [ot, otd?.rsPace, otd?.oEFF, otd?.dEFF, otd?.eDIFF],
      ["", "", "", "", ""],
      ["DATA SOURCES", "", "", "", ""],
      ["Player RS/PO stats", "StatMuse · SportBusy · Basketball-Reference · Fadeaway World", "", "", ""],
      ["Team RS Pace", "NBA.com Teams > Advanced > Regular Season 2025-26", "", "", ""],
      ["Team PO Efficiency", "NBAsuffer.com 2026 Playoff splits", "", "", ""],
      ["On/Off delta", "NBA.com On/Off Court > Advanced > Playoffs 2025-26", "", "", ""],
      ["USG% / TS%", "NBA.com Players > Advanced (RS and Playoffs)", "", "", ""],
      ["Rest Days", "Sportradar schedule API", "", "", ""],
      ["Home/Road", "NBAsuffer 2025-26 RS home/away splits", "", "", ""],
      ["Model generated", ts, "", "", ""],
    ].filter(r => r.length > 0);

    // Convert to CSV
    const csv = rows.map(r => r.map(c => {
      const s = String(c ?? '');
      return s.includes(',') || s.includes('"') ? `"${s.replace(/"/g, '""')}"` : s;
    }).join(',')).join('\n');

    // Download
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `PropEdge_${dname.replace(/ /g, '_')}_${pr.short}_${ts.replace(/ /g, '_')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }, [result]);

  // ── Dynamic date labels — always reflects current date, no hardcoded strings ──
  // NBA game-night convention: before 6 AM ET, tonight's games belong to yesterday
  const _nowET = new Date(new Date().toLocaleString("en-US", { timeZone: "America/New_York" }));
  const _displayDate = _nowET.getHours() < 6
    ? new Date(_nowET.getFullYear(), _nowET.getMonth(), _nowET.getDate() - 1)
    : new Date(_nowET.getFullYear(), _nowET.getMonth(), _nowET.getDate());
  const _upcomingDate = new Date(_displayDate); _upcomingDate.setDate(_displayDate.getDate() + 1);
  const todayStr    = liveSched?.today         || _displayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  const upcomingStr = liveSched?.upcomingLabel || _upcomingDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

  return (
    <>
      <style>{S}</style>
      <div className="root">
        <div className="header">
          <div className="htag">NBA Prop Engine · 2025-26 Playoffs</div>
          <h1>PROP<br /><span>EDGE</span></h1>
          <div className="dbanner">
            ALL DATA VERIFIED · ZERO AI GUESSING · {todayStr.toUpperCase()}
            {" "}{liveInjuries === null ? "· ⟳ LOADING INJURIES..." : liveInjuries === false ? "· INJURIES OFFLINE" : liveInjuries?.updated ? `· ✓ INJURIES LIVE (${liveInjuries.updated})` : "· ✓ INJURIES LIVE"}
            {" "}{nbaApiStatus === "loading" ? "· ⟳ NBA.COM..." : nbaApiStatus === "warming" ? "· ⟳ WARMING SERVER (retrying)..." : nbaApiStatus === "live" ? "· ✓ NBA.COM LIVE" : "· ◎ STATIC STATS"}
          </div>
        </div>

        {/* ── Bulk Result Logger ─────────────────────────────────────────── */}
        {showBulkLog && (
          <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,.75)", zIndex:9999, display:"flex", alignItems:"center", justifyContent:"center", padding:16 }}
               onClick={e => { if(e.target===e.currentTarget){ setShowBulkLog(false); setBulkResult(null); setBulkText(""); } }}>
            <div style={{ background:"#0d1627", border:"1px solid rgba(37,99,235,.35)", borderRadius:16, padding:28, width:"100%", maxWidth:560, maxHeight:"90vh", overflow:"auto" }}>
              <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:16 }}>
                <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:11, letterSpacing:".18em", color:"#2563eb" }}>📋 BULK LOG RESULTS</div>
                <button onClick={() => { setShowBulkLog(false); setBulkResult(null); setBulkText(""); }}
                  style={{ background:"none", border:"none", color:"#64748b", cursor:"pointer", fontSize:18, lineHeight:1 }}>✕</button>
              </div>
              <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:9, color:"#64748b", marginBottom:12, lineHeight:1.7 }}>
                Paste results in any of these formats:<br/>
                <span style={{color:"#c8d4e8"}}>  Anthony Edwards, 22.15, 18</span>  ← Name, Projected, Actual<br/>
                <span style={{color:"#c8d4e8"}}>  Julius Randle | 22.54 | 21</span>  ← pipes also work<br/>
                <span style={{color:"#c8d4e8"}}>  Julius Randle    22.54    21</span>  ← or tab-separated<br/>
                Projected is optional — if omitted, only actual is recorded but residual calibration won't fire.
              </div>
              <textarea
                value={bulkText}
                onChange={e => { setBulkText(e.target.value); setBulkResult(null); }}
                placeholder={"Anthony Edwards, 22.15, 18\nJulius Randle, 22.54, 21\nRudy Gobert, 7.56, 7\n..."}
                style={{ width:"100%", minHeight:180, background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.1)",
                  borderRadius:8, color:"#c8d4e8", fontSize:12, fontFamily:"'Azeret Mono',monospace",
                  padding:12, resize:"vertical", outline:"none", boxSizing:"border-box" }}
              />
              {bulkResult && (
                <div style={{ marginTop:12, fontFamily:"'Azeret Mono',monospace", fontSize:10 }}>
                  {bulkResult.saved.length > 0 && (
                    <div style={{ color:"#10b981", marginBottom:6 }}>
                      ✓ LOGGED {bulkResult.saved.length} player{bulkResult.saved.length !== 1 ? "s" : ""}:<br/>
                      {bulkResult.saved.map(r => (
                        <span key={r.name} style={{ display:"block", paddingLeft:12, color:"#6ee7b7" }}>
                          {r.name} — proj {r.projected} → actual {r.actual} (now {r.n} sample{r.n!==1?"s":""})
                        </span>
                      ))}
                    </div>
                  )}
                  {bulkResult.skipped.length > 0 && (
                    <div style={{ color:"#f59e0b" }}>
                      ⚠ Skipped {bulkResult.skipped.length} (player not found in DB):<br/>
                      {bulkResult.skipped.map(s => (
                        <span key={s} style={{ display:"block", paddingLeft:12, color:"#fcd34d" }}>{s}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div style={{ display:"flex", gap:8, marginTop:14 }}>
                <button
                  onClick={() => {
                    const lines = bulkText.split("\n").map(l => l.trim()).filter(Boolean);
                    const saved = [], skipped = [];
                    const today = new Date().toISOString().slice(0, 10);
                    lines.forEach(line => {
                      // split on comma, pipe, or 2+ spaces/tabs
                      const parts = line.split(/[,|]|\s{2,}|\t/).map(s => s.trim()).filter(Boolean);
                      if (parts.length < 2) return;
                      const name = parts[0].toLowerCase().trim();
                      let projected = null, actual = null;
                      if (parts.length >= 3) {
                        projected = parseFloat(parts[1]);
                        actual    = parseFloat(parts[2]);
                      } else {
                        actual = parseFloat(parts[1]);
                      }
                      if (isNaN(actual) || actual < 0) return;
                      // Find closest match in effectiveDB (exact then startsWith then includes)
                      let matchKey = Object.keys(effectiveDB).find(k => k === name)
                        || Object.keys(effectiveDB).find(k => k.startsWith(name))
                        || Object.keys(effectiveDB).find(k => k.includes(name)
                            || name.split(" ").every(w => k.includes(w)));
                      if (!matchKey) { skipped.push(parts[0]); return; }
                      // Save to localStorage — same format as saveResidual
                      const key = `res_${matchKey}_points`;
                      let prev = [];
                      try { prev = JSON.parse(localStorage.getItem(key) || "[]"); } catch {}
                      const entry = {
                        actual: +actual.toFixed(2),
                        ...(projected !== null && !isNaN(projected) ? { projected: +projected.toFixed(2) } : {}),
                        date: today,
                      };
                      const updated = [...prev, entry].slice(-20);
                      localStorage.setItem(key, JSON.stringify(updated));
                      saved.push({ name: matchKey, projected: projected?.toFixed(2) ?? "—", actual: actual.toFixed(1), n: updated.length });
                    });
                    setBulkResult({ saved, skipped });
                  }}
                  style={{ flex:1, padding:"9px 16px", background:"rgba(37,99,235,.15)", border:"1px solid rgba(37,99,235,.35)",
                    borderRadius:8, color:"#60a5fa", cursor:"pointer", fontSize:10, fontFamily:"'Azeret Mono',monospace", letterSpacing:".12em" }}>
                  SAVE ALL ✓
                </button>
                <button onClick={() => { setBulkText(""); setBulkResult(null); }}
                  style={{ padding:"9px 14px", background:"none", border:"1px solid rgba(255,255,255,.08)",
                    borderRadius:8, color:"#64748b", cursor:"pointer", fontSize:10, fontFamily:"'Azeret Mono',monospace" }}>
                  CLEAR
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="sec">
          <div className="slabel">01 — Select Game</div>
          <div className="card">
            <div className="ggl">● TONIGHT — {todayStr}</div>
            <div className="glist">{activeTodayIds.map(id => {
              const g = activeRosters[id]; if (!g) return null; return (
                <div key={id} className={`grow ${gid === id ? "sel" : ""}`} onClick={() => selGame(id)}>
                  <div><div className="gteams">{g.away}<span className="gvs">@</span>{g.home}</div><div className="gmeta">{g.awayTeam} @ {g.homeTeam} · {g.title} · {g.series}</div></div>
                  <div className="gtime">{etToLocal(g.time)}</div>
                </div>
              );
            })}</div>
            <div className="ggl up">◎ UPCOMING — {upcomingStr}</div>
            <div className="glist">{activeUpcomingIds.length > 0 ? activeUpcomingIds.map(id => {
              const g = activeRosters[id]; if (!g) return null; return (
                <div key={id} className={`grow ${gid === id ? "sel" : ""}`} onClick={() => selGame(id)}>
                  <div><div className="gteams">{g.away}<span className="gvs">@</span>{g.home}</div><div className="gmeta">{g.awayTeam} @ {g.homeTeam} · {g.title} · {g.series}</div></div>
                  <div className="gtime up">{etToLocal(g.time)}</div>
                </div>
              );
            }) : <div style={{color:"#2a3550",fontSize:11,padding:"10px 12px"}}>No games confirmed for tomorrow yet.</div>}</div>
          </div>
          {/* Bulk log + bulk project triggers */}
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginTop:8, gap:8 }}>
            <button onClick={() => { setShowBulkLog(true); setBulkResult(null); }}
              style={{ background:"rgba(16,185,129,.08)", border:"1px solid rgba(16,185,129,.2)", borderRadius:8,
                color:"#10b981", cursor:"pointer", fontSize:9, fontFamily:"'Azeret Mono',monospace",
                letterSpacing:".14em", padding:"6px 12px" }}>
              📋 BULK LOG PAST RESULTS
            </button>
            {game && (
              <div style={{ display:"flex", gap:6 }}>
                <button onClick={() => { setShowBulk(v => !v); setBulkProjResults([]); setBulkProgress({ done:0,total:0 }); }}
                  style={{ background: showBulk ? "rgba(99,102,241,.18)" : "rgba(99,102,241,.08)",
                    border: `1px solid ${showBulk ? "rgba(99,102,241,.5)" : "rgba(99,102,241,.2)"}`,
                    borderRadius:8, color:"#818cf8", cursor:"pointer", fontSize:9,
                    fontFamily:"'Azeret Mono',monospace", letterSpacing:".14em", padding:"6px 12px" }}>
                  {showBulk ? "✕ CLOSE BULK" : "📊 BULK PROJECT"}
                </button>
                <button
                  onClick={() => { setAutoLogResult(null); runAutoLog(); }}
                  disabled={autoLogRunning}
                  title="Auto-log pts/reb/ast residuals for all players from tonight's box scores"
                  style={{ background:"rgba(16,185,129,.08)", border:"1px solid rgba(16,185,129,.2)",
                    borderRadius:8, color:"#10b981", cursor: autoLogRunning ? "not-allowed" : "pointer",
                    fontSize:9, fontFamily:"'Azeret Mono',monospace", letterSpacing:".14em", padding:"6px 12px",
                    opacity: autoLogRunning ? 0.6 : 1 }}>
                  {autoLogRunning
                    ? `📝 LOGGING ${autoLogProgress.done}/${autoLogProgress.total}…`
                    : "📝 AUTO-LOG RESIDUALS"}
                </button>
              </div>
            )}
          </div>
        </div>

        {/* ── Auto-log result summary ───────────────────────────────────────── */}
        {autoLogResult && (
          <div className="sec">
            <div className="card" style={{ padding:"12px 16px", fontFamily:"'Azeret Mono',monospace" }}>
              <div style={{ fontSize:10, color:"#10b981", marginBottom:8, letterSpacing:".1em" }}>
                ✓ AUTO-LOG COMPLETE — {autoLogResult.logged} residuals saved · {autoLogResult.skipped} players skipped (no box score yet)
              </div>
              {autoLogResult.players.length > 0 && (
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  {autoLogResult.players.map((p, i) => (
                    <span key={i} style={{ background:"rgba(16,185,129,.08)", border:"1px solid rgba(16,185,129,.15)",
                      borderRadius:4, padding:"2px 8px", fontSize:9, color:"#64748b" }}>
                      <span style={{ color:"#c8d4e8" }}>{p.name.split(" ").map(w=>w[0].toUpperCase()+w.slice(1)).join(" ")}</span>
                      {" "}{p.logged.join(" ")}
                    </span>
                  ))}
                </div>
              )}
              <button onClick={() => setAutoLogResult(null)}
                style={{ marginTop:8, background:"none", border:"none", color:"#334155",
                  cursor:"pointer", fontSize:9, fontFamily:"'Azeret Mono',monospace", padding:0 }}>
                dismiss
              </button>
            </div>
          </div>
        )}

        {/* ── Bulk Projection Panel ──────────────────────────────────────────── */}
        {showBulk && game && (() => {
          const PROP_LABELS = {
            points:"PTS", rebounds:"REB", assists:"AST", steals:"STL", blocks:"BLK", turnovers:"TOV",
            three_pointers:"3PM", three_point_attempts:"3PA",
            field_goal_attempts:"FGA", two_point_attempts:"2PA", field_goal_made:"FGM",
          };
          const GRADE_COLOR = { LOCK:"#10b981", ACTIONABLE:"#3b82f6", WATCH:"#f59e0b", SKIP:"#475569" };
          const filledCount = bulkRosterPlayers.reduce((acc, pl) => {
            const row = bulkLines[pl.name] || {};
            return acc + bulkProps.filter(p => row[p] && !isNaN(parseFloat(row[p]))).length;
          }, 0);

          return (
            <div className="sec">
              <div className="slabel">📊 BULK PROJECT — {game.away} @ {game.home} · {game.title}</div>
              <div className="card" style={{ padding:0, overflow:"hidden" }}>

                {/* ── Prop selector ── */}
                <div style={{ padding:"12px 16px", borderBottom:"1px solid rgba(255,255,255,.06)", display:"flex", gap:7, alignItems:"center", flexWrap:"wrap" }}>
                  <span style={{ fontFamily:"'Azeret Mono',monospace", fontSize:9, color:"#475569", letterSpacing:".12em", marginRight:2 }}>PROPS:</span>
                  {Object.entries(PROP_LABELS).map(([pid, label]) => {
                    const on = bulkProps.includes(pid);
                    return (
                      <button key={pid}
                        onClick={() => setBulkProps(prev => { const s = new Set(prev); s.has(pid) ? s.delete(pid) : s.add(pid); return [...s]; })}
                        style={{ padding:"4px 11px", borderRadius:99, fontSize:9, fontFamily:"'Azeret Mono',monospace", cursor:"pointer",
                          background: on ? "rgba(99,102,241,.18)" : "rgba(255,255,255,.04)",
                          border: `1px solid ${on ? "rgba(99,102,241,.5)" : "rgba(255,255,255,.1)"}`,
                          color: on ? "#818cf8" : "#475569", display:"flex", alignItems:"center", gap:4 }}>
                        {on && <span style={{ fontSize:7, lineHeight:1 }}>✓</span>}{label}
                      </button>
                    );
                  })}
                  <span style={{ marginLeft:"auto", fontFamily:"'Azeret Mono',monospace", fontSize:9, color:"#475569" }}>
                    {filledCount} line{filledCount !== 1 ? "s" : ""} entered
                  </span>
                </div>

                {/* ── Player × Prop input grid ── */}
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse", fontFamily:"'Azeret Mono',monospace", fontSize:11 }}>
                    <thead>
                      <tr style={{ borderBottom:"1px solid rgba(255,255,255,.08)" }}>
                        <th style={{ textAlign:"left", padding:"8px 12px", color:"#475569", fontSize:9, letterSpacing:".1em", minWidth:160 }}>PLAYER</th>
                        <th style={{ textAlign:"center", padding:"8px 6px", color:"#475569", fontSize:9, width:48 }}>TEAM</th>
                        {bulkProps.map(pid => (
                          <th key={pid} style={{ textAlign:"center", padding:"8px 6px", color:"#6366f1", fontSize:9, minWidth:80 }}>{PROP_LABELS[pid]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {bulkRosterPlayers.map((pl, idx) => {
                        const isAway = pl.team === game.away;
                        const rowBg = idx % 2 === 0 ? "rgba(255,255,255,.01)" : "transparent";
                        const teamColor = isAway ? "#94a3b8" : "#c8d4e8";
                        return (
                          <tr key={pl.name} style={{ background: rowBg, borderBottom:"1px solid rgba(255,255,255,.03)" }}>
                            <td style={{ padding:"5px 12px", color:"#c8d4e8" }}>
                              {pl.name.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")}
                            </td>
                            <td style={{ padding:"5px 6px", textAlign:"center", color: teamColor, fontSize:9 }}>{pl.team}</td>
                            {bulkProps.map(pid => {
                              const val = (bulkLines[pl.name] || {})[pid] || "";
                              return (
                                <td key={pid} style={{ padding:"3px 4px", textAlign:"center" }}>
                                  <input
                                    type="number" step="0.5" min="0"
                                    value={val}
                                    placeholder="—"
                                    onChange={e => setBulkLines(prev => ({
                                      ...prev,
                                      [pl.name]: { ...(prev[pl.name] || {}), [pid]: e.target.value }
                                    }))}
                                    style={{ width:72, padding:"4px 6px", background:"rgba(255,255,255,.04)",
                                      border:"1px solid rgba(255,255,255,.08)", borderRadius:4, color:"#c8d4e8",
                                      fontSize:12, fontFamily:"'Azeret Mono',monospace", outline:"none", textAlign:"center" }}
                                  />
                                </td>
                              );
                            })}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* ── Run button + progress ── */}
                <div style={{ padding:"12px 16px", borderTop:"1px solid rgba(255,255,255,.06)", display:"flex", gap:12, alignItems:"center", flexWrap:"wrap" }}>
                  <button
                    disabled={bulkOddsLoading || bulkRunning}
                    onClick={fetchBulkLines}
                    style={{ padding:"8px 16px", background:"rgba(16,185,129,.12)", border:"1px solid rgba(16,185,129,.35)",
                      borderRadius:6, color:"#10b981", cursor: bulkOddsLoading || bulkRunning ? "not-allowed" : "pointer",
                      fontSize:10, fontFamily:"'Azeret Mono',monospace", letterSpacing:".12em",
                      opacity: bulkOddsLoading || bulkRunning ? 0.5 : 1 }}>
                    {bulkOddsLoading ? "PULLING…" : "⚡ PULL LIVE LINES"}
                  </button>
                  {bulkOddsStatus && !bulkOddsLoading && (
                    <span style={{ fontFamily:"'Azeret Mono',monospace", fontSize:9, color:"#10b981" }}>{bulkOddsStatus}</span>
                  )}
                  <button
                    disabled={bulkRunning || filledCount === 0}
                    onClick={runBulkProjections}
                    style={{ padding:"8px 20px", background: bulkRunning ? "rgba(99,102,241,.1)" : "rgba(99,102,241,.2)",
                      border:"1px solid rgba(99,102,241,.4)", borderRadius:6, color:"#818cf8",
                      cursor: filledCount > 0 && !bulkRunning ? "pointer" : "not-allowed",
                      fontSize:10, fontFamily:"'Azeret Mono',monospace", letterSpacing:".12em",
                      opacity: filledCount > 0 ? 1 : 0.4 }}>
                    {bulkRunning ? `RUNNING ${bulkProgress.done}/${bulkProgress.total}…` : `▶ RUN ALL (${filledCount} prop${filledCount !== 1 ? "s" : ""})`}
                  </button>
                  {bulkRunning && (
                    <div style={{ flex:1, height:4, background:"rgba(255,255,255,.06)", borderRadius:2, minWidth:120 }}>
                      <div style={{ height:"100%", borderRadius:2, background:"#6366f1",
                        width: `${bulkProgress.total > 0 ? (bulkProgress.done / bulkProgress.total * 100) : 0}%`,
                        transition:"width .2s ease" }} />
                    </div>
                  )}
                  {!bulkRunning && bulkProjResults.length > 0 && (
                    <span style={{ fontFamily:"'Azeret Mono',monospace", fontSize:9, color:"#475569" }}>
                      {bulkProjResults.length} results · {bulkProjResults.filter(r => r.grade === "LOCK").length} BEST · {bulkProjResults.filter(r => r.grade === "ACTIONABLE").length} PLAY
                      {bulkSkipped && (() => {
                        const n = (bulkSkipped.noPid?.length || 0) + (bulkSkipped.apiError?.length || 0) + (bulkSkipped.notSuccess?.length || 0);
                        return (
                          <span style={{ marginLeft:8, color:"#ef4444", cursor:"pointer" }}
                                onClick={() => {
                                  const lines = [
                                    `=== ${n} props skipped ===`,
                                    ...(bulkSkipped.noPid?.length ? ["", `No PID resolved (${bulkSkipped.noPid.length}):`, ...bulkSkipped.noPid.map(s => `  • ${s}`)] : []),
                                    ...(bulkSkipped.notSuccess?.length ? ["", `Server returned success:false (${bulkSkipped.notSuccess.length}):`, ...bulkSkipped.notSuccess.map(s => `  • ${s}`)] : []),
                                    ...(bulkSkipped.apiError?.length ? ["", `Network/parse error (${bulkSkipped.apiError.length}):`, ...bulkSkipped.apiError.map(s => `  • ${s}`)] : []),
                                  ];
                                  alert(lines.join("\n"));
                                }}>
                            · ⚠ {n} skipped (click)
                          </span>
                        );
                      })()}
                    </span>
                  )}
                  {bulkProjResults.length > 0 && (
                    <button onClick={() => setBulkProjResults([])}
                      style={{ marginLeft:"auto", background:"rgba(239,68,68,.06)", border:"1px solid rgba(239,68,68,.2)",
                        borderRadius:4, color:"#ef4444", cursor:"pointer", fontSize:9,
                        fontFamily:"'Azeret Mono',monospace", padding:"4px 10px" }}>
                      CLEAR
                    </button>
                  )}
                </div>

                {/* ── Bulk results ── */}
                {bulkProjResults.length > 0 && (
                  <div className="bulk-table-container" style={{ marginTop: 12 }}>

                  {/* ── Game context strip (Vegas totals + spreads) ── */}
                  {(() => {
                    const gameCtxMap = {};
                    bulkProjResults.forEach(r => {
                      if (r.gameCtx?.total && r.team) {
                        const key = r.team;
                        if (!gameCtxMap[key]) gameCtxMap[key] = { ...r.gameCtx, team: r.team };
                      }
                    });
                    const games = Object.values(gameCtxMap);
                    if (!games.length) return null;
                    const uniqueGames = [];
                    const seen = new Set();
                    games.forEach(g => {
                      const k = [g.total, g.spread].join("_");
                      if (!seen.has(k)) { seen.add(k); uniqueGames.push(g); }
                    });
                    return (
                      <div style={{ padding:"6px 14px", borderBottom:"1px solid rgba(99,102,241,.1)", background:"rgba(99,102,241,.03)", display:"flex", gap:16, flexWrap:"wrap" }}>
                        {uniqueGames.map((g, i) => (
                          <span key={i} style={{ fontFamily:"'Azeret Mono',monospace", fontSize:11, color:"#64748b" }}>
                            <span style={{ color:"#475569" }}>Total </span>
                            <span style={{ color:"#c8d4e8", fontWeight:700 }}>{g.total}</span>
                            {g.spread != null && <>
                              <span style={{ color:"#475569", marginLeft:6 }}>Spread </span>
                              <span style={{ color: g.spread < 0 ? "#10b981" : "#f59e0b", fontWeight:700 }}>{g.spread > 0 ? "+" : ""}{g.spread}</span>
                            </>}
                          </span>
                        ))}
                      </div>
                    );
                  })()}

                  {/* ── Shared-pool warning banners ── */}
                  {(() => {
                    const ptsByTeam = {};
                    bulkProjResults.filter(r => r.propId === "points").forEach(r => {
                      if (!ptsByTeam[r.team]) ptsByTeam[r.team] = { overs: 0, playableOvers: 0, leanOvers: 0, passOvers: 0, total: 0, allocated: false, trim: 0 };
                      ptsByTeam[r.team].total++;
                      if (r.lean === "OVER") {
                        ptsByTeam[r.team].overs++;
                        if (r.grade === "LOCK" || r.grade === "ACTIONABLE") ptsByTeam[r.team].playableOvers++;
                        else if (r.grade === "WATCH") ptsByTeam[r.team].leanOvers++;
                        else ptsByTeam[r.team].passOvers++;
                      }
                      if (r.teamTotalAllocated) {
                        ptsByTeam[r.team].allocated = true;
                        ptsByTeam[r.team].trim += Number(r.teamTotalTrim || 0);
                      }
                    });
                    const warnings = Object.entries(ptsByTeam).filter(([, v]) => v.allocated || (v.total >= 3 && v.overs / v.total >= 0.75));
                    if (!warnings.length) return null;
                    return (
                      <div style={{ padding:"6px 14px", borderBottom:"1px solid rgba(245,158,11,.12)", background:"rgba(245,158,11,.025)" }}>
                        {warnings.map(([team, v]) => (
                          <div key={team} style={{ fontFamily:"'Azeret Mono',monospace", fontSize:0, color:"#d97706", marginBottom:2 }}>
                            <span style={{ fontSize:10 }}>WARN {team} - {v.overs}/{v.total} raw pts OVER ({v.playableOvers} playable, {v.leanOvers} lean, {v.passOvers} pass){v.allocated ? ` - allocator trimmed ${v.trim.toFixed(1)} pts from weaker overs` : " - raw lean cluster only"}</span>
                          </div>
                        ))}
                      </div>
                    );
                  })()}
                  {(() => {
                    const poolGroups = {};
                    bulkProjResults.filter(r => r.resourceAllocated && r.propId !== "points").forEach(r => {
                      const key = `${r.team}__${r.resourceType || r.propId}`;
                      if (!poolGroups[key]) poolGroups[key] = { team: r.team, label: r.resourceType || r.propId, count: 0, trim: 0 };
                      poolGroups[key].count++;
                      poolGroups[key].trim += Number(r.resourceTrim || 0);
                    });
                    const groups = Object.values(poolGroups);
                    if (!groups.length) return null;
                    return (
                      <div style={{ padding:"8px 14px", borderBottom:"1px solid rgba(56,189,248,.15)", background:"rgba(56,189,248,.045)" }}>
                        {groups.map(g => (
                          <div key={`${g.team}-${g.label}`} style={{ fontFamily:"'Azeret Mono',monospace", fontSize:11, color:"#38bdf8", marginBottom:2 }}>
                            POOL {g.team} — {g.label} allocator trimmed {g.trim.toFixed(1)} from {g.count} weaker over{g.count !== 1 ? "s" : ""}
                          </div>
                        ))}
                      </div>
                    );
                  })()}

                  {/* ── Two-axis spotlight — removed; LOCK/ACT card board replaces this ── */}
                  {false && (() => {
                    const highFloor = [];
                    const highAlpha = [];
                    if (!highFloor.length && !highAlpha.length) return null;
                    const Row = ({ r, accent }) => (
                      <div style={{ padding:"7px 16px", borderBottom:"1px solid rgba(255,255,255,.03)", display:"flex", gap:10, alignItems:"center", flexWrap:"wrap", fontFamily:"'Azeret Mono',monospace", fontSize:11 }}>
                        <span style={{ color:"#e8f0ff", minWidth:130, fontWeight:600 }}>{r.name.split(" ").map(w=>w[0].toUpperCase()+w.slice(1)).join(" ")}</span>
                        <span style={{ color:"#475569", minWidth:30 }}>{r.team}</span>
                        <span style={{ color:"#64748b", minWidth:55 }}>{PROP_LABELS[r.propId]}</span>
                        <span style={{ color: r.lean==="OVER"?"#10b981":"#ef4444", fontWeight:700, minWidth:44 }}>{r.lean}</span>
                        <span style={{ color:"#94a3b8" }}>line {r.line}</span>
                        <span style={{ color:"#c8d4e8" }}>proj <b>{r.proj.toFixed(1)}</b></span>
                        <span style={{ color: accent, fontWeight:700 }}>EV {r.ev>=0?"+":""}{r.ev}%</span>
                        {r.cv != null && <span style={{ color:"#475569" }}>CV {r.cv.toFixed(2)}</span>}
                        {r.band?.trust_score != null && <span style={{ color: r.band.trust_score>=70?"#10b981":"#f59e0b" }}>TRUST {r.band.trust_score}</span>}
                        {r.qKelly != null && r.qKelly > 0 && <span style={{ color:"#818cf8" }}>¼K {r.qKelly}%</span>}
                      </div>
                    );
                    return (
                      <div style={{ borderTop:"1px solid rgba(255,255,255,.06)", marginBottom:8 }}>
                        {highFloor.length > 0 && (
                          <div>
                            <div style={{ padding:"7px 16px", background:"rgba(16,185,129,.06)", borderBottom:"1px solid rgba(255,255,255,.05)", fontFamily:"'Azeret Mono',monospace", fontSize:10, color:"#10b981", letterSpacing:".14em", fontWeight:700 }}>
                              HIGH FLOOR ({highFloor.length}) — tight variance, consistent hitter
                            </div>
                            {highFloor.map((r,i) => <Row key={i} r={r} accent="#10b981" />)}
                          </div>
                        )}
                        {highAlpha.length > 0 && (
                          <div>
                            <div style={{ padding:"7px 16px", background:"rgba(245,158,11,.06)", borderBottom:"1px solid rgba(255,255,255,.05)", fontFamily:"'Azeret Mono',monospace", fontSize:10, color:"#f59e0b", letterSpacing:".14em", fontWeight:700 }}>
                              HIGH ALPHA ({highAlpha.length}) — structural edge, play smaller
                            </div>
                            {highAlpha.map((r,i) => <Row key={i} r={r} accent="#f59e0b" />)}
                          </div>
                        )}
                      </div>
                    );
                  })()}

                  {/* ── Results — Winning Props Board ── */}
                  {bulkProjResults.length > 0 && (() => {
                    const fmt   = n => n.split(" ").map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(" ");
                    const locks = bulkProjResults.filter(r => r.grade === "LOCK");
                    const acts  = bulkProjResults.filter(r => r.grade === "ACTIONABLE");
                    const watch = bulkProjResults.filter(r => r.grade === "WATCH");
                    const skip  = bulkProjResults.filter(r => r.grade === "SKIP");
                    // Cap BEST BETS at top 5 by betScore — demote extras to ACTIONABLE
                    // so the BEST BET section stays focused on the genuine top tier.
                    const MAX_LOCKS = 5;
                    const locksRanked = [...locks].sort((a, b) => (b.betScore ?? 0) - (a.betScore ?? 0));
                    const lockKeep    = locksRanked.slice(0, MAX_LOCKS);
                    const lockDemote  = locksRanked.slice(MAX_LOCKS);
                    lockDemote.forEach(r => { r.grade = "ACTIONABLE"; r.lockCapDemoted = true; });
                    const actsAll = [...acts, ...lockDemote];
                    const actsRanked = actsAll.sort((a, b) => (b.betScore ?? 0) - (a.betScore ?? 0));
                    // Group LOCK first then ACTIONABLE, sorted by betScore within each tier
                    const best = [...lockKeep, ...actsRanked];
                    const watchRanked = [...watch].sort((a, b) => (b.betScore ?? 0) - (a.betScore ?? 0));
                    const skipRanked = [...skip].sort((a, b) => (b.betScore ?? 0) - (a.betScore ?? 0));
                    const visibleSkip = skipRanked;
                    const topScore = best[0]?.betScore ?? watchRanked[0]?.betScore ?? 0;
                    const blockCounts = [...watchRanked, ...skipRanked].reduce((acc, r) => {
                      const reason = r.blockReason || betBlockReason(r);
                      acc[reason] = (acc[reason] || 0) + 1;
                      return acc;
                    }, {});
                    const topBlocks = Object.entries(blockCounts)
                      .sort((a, b) => b[1] - a[1])
                      .slice(0, 3);
                    const rawPtClusters = {};
                    bulkProjResults.filter(r => r.propId === "points").forEach(r => {
                      if (!rawPtClusters[r.team]) rawPtClusters[r.team] = { overs: 0, total: 0 };
                      rawPtClusters[r.team].total++;
                      if (r.lean === "OVER") rawPtClusters[r.team].overs++;
                    });
                    const rawPtClusterCount = Object.values(rawPtClusters).filter(v => v.total >= 3 && v.overs / v.total >= 0.75).length;
                    return (
                      <div style={{ borderTop:"1px solid rgba(255,255,255,.06)" }}>
                        <div style={{ padding:"10px 16px", display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(120px,1fr))", gap:8, borderBottom:"1px solid rgba(255,255,255,.06)", background:"rgba(15,23,42,.22)" }}>
                          {[
                            ["PLAYABLE", best.length, "#3b82f6"],
                            ["BEST SCORE", topScore, topScore >= 70 ? "#10b981" : topScore >= 55 ? "#f59e0b" : "#64748b"],
                            ["WATCHLIST", watch.length, "#f59e0b"],
                            ["NO-BET", skip.length, "#64748b"],
                          ].map(([label, value, color]) => (
                            <div key={label} style={{ border:"1px solid rgba(148,163,184,.12)", borderRadius:6, padding:"9px 10px", background:"rgba(15,23,42,.38)" }}>
                              <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:8, letterSpacing:".18em", color:"#64748b", marginBottom:5 }}>{label}</div>
                              <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:18, color, fontWeight:800 }}>{value}</div>
                            </div>
                          ))}
                        </div>

                        {/* ── BEST BETS card grid (LOCK + ACTIONABLE) ── */}
                        {best.length > 0 && (
                          <div style={{ padding:"14px 16px 12px" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:12 }}>
                              <span style={{ fontSize:9, fontWeight:800, letterSpacing:".22em", color:"#475569", fontFamily:"'Azeret Mono',monospace" }}>
                                BETTING CARD
                              </span>
                              {lockKeep.length > 0 && (
                                <span style={{ fontSize:9, fontWeight:700, color:"#a855f7", fontFamily:"'Azeret Mono',monospace" }}>
                                  ● {lockKeep.length} BEST BET
                                </span>
                              )}
                              {actsRanked.length > 0 && (
                                <span style={{ fontSize:9, fontWeight:700, color:"#3b82f6", fontFamily:"'Azeret Mono',monospace" }}>
                                  ● {actsRanked.length} PLAY
                                </span>
                              )}
                            </div>
                            <div style={{ display:"flex", gap:8, flexWrap:"wrap", margin:"-4px 0 12px",
                              fontFamily:"'Azeret Mono',monospace", fontSize:9, color:"#64748b" }}>
                              <span><b style={{ color:"#a855f7" }}>BEST BET</b> strong edge + clean support</span>
                              <span><b style={{ color:"#3b82f6" }}>PLAY</b> bettable edge</span>
                              <span><b style={{ color:"#f59e0b" }}>LEAN</b> edge with a weak filter</span>
                              <span><b style={{ color:"#64748b" }}>PASS</b> no play</span>
                            </div>
                            {/* BEST BET section — its own grid so it doesn't visually blend with PLAY */}
                            {lockKeep.length > 0 && (
                              <>
                                <div style={{ fontSize:9, fontWeight:800, letterSpacing:".22em",
                                  color:"#a855f7", fontFamily:"'Azeret Mono',monospace",
                                  margin:"6px 0 6px", borderTop:"1px solid rgba(168,85,247,.2)", paddingTop:8 }}>
                                  BEST BET — TOP {lockKeep.length}
                                </div>
                                <div className="bet-cards-grid">
                                  {lockKeep.map((r, i) => (
                                    <BetCard key={`L${i}`} r={r} propLabels={PROP_LABELS}
                                      onOpen={() => { selGame(gid); setPname(fmt(r.name)); setPkey(r.name); setShowBulk(false); }} />
                                  ))}
                                </div>
                              </>
                            )}
                            {/* PLAY section — separate grid below BEST BETS */}
                            {actsRanked.length > 0 && (
                              <>
                                <div style={{ fontSize:9, fontWeight:800, letterSpacing:".22em",
                                  color:"#3b82f6", fontFamily:"'Azeret Mono',monospace",
                                  margin:"14px 0 6px", borderTop:"1px solid rgba(59,130,246,.2)", paddingTop:8 }}>
                                  PLAY — {actsRanked.length}
                                </div>
                                <div className="bet-cards-grid">
                                  {actsRanked.map((r, i) => (
                                    <BetCard key={`A${i}`} r={r} propLabels={PROP_LABELS}
                                      onOpen={() => { selGame(gid); setPname(fmt(r.name)); setPkey(r.name); setShowBulk(false); }} />
                                  ))}
                                </div>
                              </>
                            )}
                            {/* Legacy single-grid render — kept commented for reference */}
                            <div className="bet-cards-grid" style={{ display:"none" }}>
                              {best.map((r, i) => (
                                <BetCard key={i} r={r} propLabels={PROP_LABELS}
                                  onOpen={() => { selGame(gid); setPname(fmt(r.name)); setPkey(r.name); setShowBulk(false); }} />
                              ))}
                              <div style={{ flex:"1 1 300px", minWidth:280, border:"1px solid rgba(59,130,246,.16)", borderRadius:10, background:"rgba(15,23,42,.36)", padding:"13px 14px", alignSelf:"stretch" }}>
                                <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:9, letterSpacing:".18em", color:"#3b82f6", fontWeight:800, marginBottom:9 }}>
                                  BOARD READ
                                </div>
                                <div style={{ color:"#cbd5e1", fontSize:12, lineHeight:1.65, marginBottom:10 }}>
                                  {best.length === 1
                                    ? "One prop cleared the full card. The rest are being held as watchlist/no-bet because the support is thinner than the raw edge."
                                    : `${best.length} props cleared the full card. Use the score to size conviction, then open the prop for matchup details before betting.`}
                                </div>
                                {topBlocks.length > 0 && (
                                  <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:10 }}>
                                    {topBlocks.map(([reason, count]) => (
                                      <span key={reason} style={{ fontFamily:"'Azeret Mono',monospace", fontSize:9, color:"#94a3b8", border:"1px solid rgba(148,163,184,.14)", borderRadius:999, padding:"3px 7px", background:"rgba(15,23,42,.42)" }}>
                                        {reason}: {count}
                                      </span>
                                    ))}
                                  </div>
                                )}
                                <div style={{ display:"grid", gridTemplateColumns:"repeat(3,minmax(0,1fr))", gap:8 }}>
                                  {[
                                    ["Top watch", watchRanked[0] ? `${fmt(watchRanked[0].name)} ${PROP_LABELS[watchRanked[0].propId]}` : "None", "#f59e0b"],
                                    ["Main block", skipRanked[0]?.blockReason || "None", "#64748b"],
                                    ["Raw pts clusters", rawPtClusterCount ? `${rawPtClusterCount} team${rawPtClusterCount !== 1 ? "s" : ""}` : "None", "#f59e0b"],
                                  ].map(([label, value, color]) => (
                                    <div key={label} style={{ border:"1px solid rgba(148,163,184,.10)", borderRadius:7, padding:"8px", background:"rgba(2,6,23,.26)" }}>
                                      <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:8, letterSpacing:".12em", color:"#64748b", marginBottom:5 }}>{label}</div>
                                      <div style={{ fontSize:11, color, fontWeight:800, lineHeight:1.35 }}>{value}</div>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* ── WATCH — compact rows ── */}
                        {watchRanked.length > 0 && (
                          <div style={{ padding:"4px 16px 10px", borderTop:"1px solid rgba(245,158,11,.08)" }}>
                            <div style={{ padding:"8px 0 5px", fontWeight:800, letterSpacing:".18em",
                              color:"#f59e0b", fontFamily:"'Azeret Mono',monospace", fontSize:0 }}>
                              <span style={{ fontSize:9 }}>EDGE WATCHLIST - {watch.length}</span>
                            </div>
                            {watchRanked.map((r, i) => {
                              const isOver = r.lean === "OVER";
                              const ac = isOver ? "#10b981" : "#ef4444";
                              return (
                                <div key={i} className="bet-watch-row"
                                  onClick={() => { selGame(gid); setPname(fmt(r.name)); setPkey(r.name); setShowBulk(false); }}>
                                  <span style={{ color:"#94a3b8", fontWeight:600, flex:"0 0 128px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{fmt(r.name)}</span>
                                  <span style={{ color:"#334155", fontSize:9, flex:"0 0 28px" }}>{r.team}</span>
                                  <span style={{ background:"rgba(245,158,11,.08)", color:"#f59e0b",
                                    border:"1px solid rgba(245,158,11,.2)", borderRadius:3,
                                    padding:"0 5px", fontSize:8, flex:"0 0 32px", textAlign:"center" }}>
                                    {PROP_LABELS[r.propId]}
                                  </span>
                                  <span style={{ color:"#334155", fontSize:11, marginLeft:10, flex:"0 0 28px" }}>{r.line}</span>
                                  <span style={{ color:ac, fontSize:11, fontWeight:600, flex:"0 0 40px", marginLeft:4 }}>
                                    → {r.proj.toFixed(1)}
                                  </span>
                                  <span style={{ color:ac, fontSize:9, flex:"0 0 42px" }}>
                                    {isOver ? "OVER" : "UNDER"}
                                  </span>
                                  <span style={{ color:"#f59e0b", fontSize:10, fontWeight:700 }}>
                                    EV {r.ev >= 0 ? "+" : ""}{r.ev}%
                                  </span>
                                  <span style={{ color:(r.betScore ?? 0) >= 55 ? "#f59e0b" : "#64748b", fontSize:9, marginLeft:10 }}>
                                    SCORE {r.betScore ?? betQualityScore(r)}
                                  </span>
                                  <span style={{ color:"#94a3b8", fontSize:9, marginLeft:10 }}>
                                    {r.blockReason || betBlockReason(r)}
                                  </span>
                                  {edgeTagsFor(r).slice(0, 2).map((t, ti) => (
                                    <span key={ti} style={{ color:t.tone, fontSize:9, marginLeft:10 }}>
                                      {t.label}
                                    </span>
                                  ))}
                                </div>
                              );
                            })}
                          </div>
                        )}

                        {/* ── SKIP — compact rows ── */}
                        {skip.length > 0 && (
                          <div style={{ padding:"4px 16px 8px", borderTop:"1px solid rgba(71,85,105,.1)" }}>
                            <div style={{ padding:"8px 0 5px", fontWeight:800, letterSpacing:".18em",
                              color:"#475569", fontFamily:"'Azeret Mono',monospace", fontSize:0 }}>
                              <span style={{ fontSize:9 }}>NO-BET ARCHIVE - {skip.length}{skip.length > visibleSkip.length ? ` (showing top ${visibleSkip.length})` : ""}</span>
                            </div>
                            {visibleSkip.map((r, i) => {
                              const isOver = r.lean === "OVER";
                              const ac = isOver ? "#334155" : "#334155";
                              return (
                                <div key={i} className="bet-watch-row" style={{ opacity:0.55 }}
                                  onClick={() => { selGame(gid); setPname(fmt(r.name)); setPkey(r.name); setShowBulk(false); }}>
                                  <span style={{ color:"#64748b", fontWeight:500, flex:"0 0 128px", overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{fmt(r.name)}</span>
                                  <span style={{ color:"#334155", fontSize:9, flex:"0 0 28px" }}>{r.team}</span>
                                  <span style={{ background:"rgba(71,85,105,.08)", color:"#475569",
                                    border:"1px solid rgba(71,85,105,.2)", borderRadius:3,
                                    padding:"0 5px", fontSize:8, flex:"0 0 32px", textAlign:"center" }}>
                                    {PROP_LABELS[r.propId]}
                                  </span>
                                  <span style={{ color:"#334155", fontSize:11, marginLeft:10, flex:"0 0 28px" }}>{r.line}</span>
                                  <span style={{ color:"#475569", fontSize:11, fontWeight:500, flex:"0 0 40px", marginLeft:4 }}>
                                    → {r.proj.toFixed(1)}
                                  </span>
                                  <span style={{ color:"#475569", fontSize:9, flex:"0 0 42px" }}>
                                    {isOver ? "OVER" : "UNDER"}
                                  </span>
                                  <span style={{ color:"#334155", fontSize:10 }}>
                                    EV {r.ev >= 0 ? "+" : ""}{r.ev}%
                                  </span>
                                  <span style={{ color:"#475569", fontSize:9, marginLeft:10 }}>
                                    SCORE {r.betScore ?? betQualityScore(r)}
                                  </span>
                                  <span style={{ color:"#64748b", fontSize:9, marginLeft:10 }}>
                                    {r.blockReason || betBlockReason(r)}
                                  </span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })()}
                  </div>
                )}
              </div>
            </div>
          );
        })()}

        <div className="sec">
          <div className="slabel">02 — Player</div>
          <div className="card">
            <div className="acw">
              <input ref={ref} className="ti" placeholder={game ? `Search ${game.away} or ${game.home} players...` : "Select a game first..."} value={pname} disabled={!game} autoComplete="off"
                onChange={e => { setPname(e.target.value); setPkey(null); setDdOpen(true); }}
                onFocus={() => { if (game) setDdOpen(true); }}
                onBlur={() => setTimeout(() => setDdOpen(false), 160)}
              />
              {ddOpen && game && Object.keys(byTeam).length > 0 && (
                <div className="dd">
                  {Object.entries(byTeam).map(([team, players]) => (
                    <div key={team}>
                      <div className="ddt">{team} — {team === game.home ? game.homeTeam : game.awayTeam}</div>
                      {players.map(p => {
                        const inj = getInjury(p.key);
                        const ps = prop ? prop.statKey(p.po) : null;
                        return (
                          <div key={p.key} className={`ddp ${pkey === p.key ? "sel" : ""}`}
                            onMouseDown={() => { setPname(dn(p.key)); setPkey(p.key); setDdOpen(false); }}>
                            <div><span className="ddn">{dn(p.key)}</span>{inj && <span className={`dinj ${inj.status.includes("OUT") ? "out" : "gtd"}`}>{inj.status}</span>}</div>
                            <div className="ddr">{ps !== null && <span className="ddst">{ps} {prop.label3}/PO</span>}<span className="ddpos">{p.pos}</span></div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
            {db && (
              <div className="pconf">
                <span className="pcn">✓ {dn(db.key)} ({db.team})</span>
                <span className="pcs">RS: {db.rs.ppg}pts/{db.rs.rpg}reb/{db.rs.apg}ast</span>
                <span className="pcs">PO: {db.po.ppg}pts/{db.po.rpg}reb/{db.po.apg}ast ({db.po.gp}g)</span>
              </div>
            )}
          </div>
        </div>

        <div className="sec">
          <div className="slabel">03 — Prop Market</div>
          <div className="card">
            <div className="pgrid">
              {PROPS.map(p => (
                <div key={p.id} className={`pbtn ${prop?.id === p.id ? "sel" : ""}`} onClick={() => setProp(p)}>
                  <div className="pico">{p.icon}</div><div className="psh">{p.short}</div><div className="pnm">{p.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {prop && (
          <div className="sec">
            <div className="slabel">
              04 — Sportsbook Line
              {oddsStatus && (
                <span style={{ marginLeft: 8, fontSize: 11, fontWeight: 500, color: oddsLoading ? "#f59e0b" : oddsStatus.startsWith("Live:") ? "#10b981" : "#64748b" }}>
                  {oddsStatus}
                </span>
              )}
            </div>
            <div className="card">
              <div className="lwrap">
                <div style={{ fontSize: 13, color: "#3a4a62" }}>{prop.label} O/U</div>
                <input className="li" type="number" step="0.5" min="0" placeholder="—" value={line} onChange={e => setLine(e.target.value)} disabled={oddsLoading} />
                <div className="lh">{oddsLoading ? "Pulling live line…" : "Override or confirm the auto-filled line"}</div>
              </div>
            </div>
          </div>
        )}

        <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8, flexWrap: "wrap" }}>
          <button className="btnr" onClick={run} disabled={!canRun}>Run Model →</button>
          {result && <button className="btng" onClick={reset}>New Prop</button>}
          {result && <button className="btng" onClick={exportToExcel} style={{ borderColor: "rgba(16,185,129,.4)", color: "#10b981" }}>⬇ Export Excel</button>}
        </div>
        {err && <div className="err">⚠ {err}</div>}

        {result && (() => {
          const { player, prop: pr, game: g, pt, ot, l, proj, verdict, edge, evPct, confGrade, impactList, conf, ptd, otd, isHome, restDays, serverCorr } = result;
          // ── SINGLE SOURCE OF TRUTH: server projection wins when available ──
          // Server applies 14 correlation factors. Client is the instant estimate only.
          // ALL final-answer displays (projection card, edge, EV) use finalProj.
          const finalProj = serverCorr?.projection ?? proj.adjustedProjection;
          const finalEdge = +(finalProj - l).toFixed(2);
          const finalVerdict = Math.abs(finalEdge) < 0.3 ? "push" : finalEdge > 0 ? "over" : "under";
          const finalEvPct = l > 0 ? +((finalProj - l) / l * 100).toFixed(2) : 0;
          const finalEc = finalVerdict === "over" ? "#10b981" : finalVerdict === "under" ? "#ef4444" : "#f59e0b";
          const finalEpct = Math.min(Math.abs(finalEdge) / 5, 1);
          const inj = getInjury(player.key);
          const dname = dn(player.key);
          const playerInitials = dname.split(/\s+/).filter(Boolean).slice(0, 2).map(x => x[0]).join("").toUpperCase();
          const playerHeadshot = player.pid ? `https://cdn.nba.com/headshots/nba/latest/1040x760/${player.pid}.png` : null;
          const ec = finalEc;
          const epct = Math.min(Math.abs(edge) / 5, 1);
          const confGradeColor =
            confGrade === "LOCK"       ? "#a855f7" :
            confGrade === "ACTIONABLE" ? "#10b981" :
            confGrade === "WATCH"      ? "#2563eb" :
            confGrade === "SKIP"       ? "#64748b" :
            // legacy S/A/B/NO BET fallback (client-only result before server replies)
            confGrade === "S-TIER" ? "#a855f7" : confGrade === "A-TIER" ? "#10b981" : confGrade === "B-TIER" ? "#2563eb" : "#64748b";
          const analysisBand = serverCorr?.confidenceBand || null;
          const analysisMC = serverCorr?.monteCarlo || {};
          const analysisDataQuality = serverCorr?.dataQuality || {};
          const analysisBreakdown = serverCorr?.breakdown || {};
          const analysisFeatures = analysisBreakdown.xgb_features_debug || {};
          const baseline = serverCorr?.base ?? proj.blended;
          const baselineMovePct = baseline > 0 ? ((finalProj - baseline) / baseline) * 100 : 0;
          const sideProb = finalVerdict === "over" ? analysisMC.prob_over : finalVerdict === "under" ? analysisMC.prob_under : null;
          const lineInBand = analysisBand && l > 0 && analysisBand.floor <= l && analysisBand.ceiling >= l;
          const edgeText = `${Math.abs(finalEvPct).toFixed(1)}%`;
          const moveSupportsSide = finalVerdict === "over" ? baselineMovePct >= -1 : finalVerdict === "under" ? baselineMovePct <= 1 : true;
          const signalPros = [];
          const signalCons = [];
          const addSignal = (list, title, text) => list.push({ title, text });
          if (Math.abs(finalEvPct) >= 7) addSignal(signalPros, "Book Gap", `${edgeText} model edge to the ${finalVerdict.toUpperCase()}.`);
          else addSignal(signalCons, "Thin Edge", `${edgeText} edge is not enough by itself.`);
          if (sideProb != null && sideProb >= 0.585) addSignal(signalPros, "Simulation", `${(sideProb * 100).toFixed(1)}% hit rate in model distribution.`);
          else if (sideProb != null) addSignal(signalCons, "Simulation", `${(sideProb * 100).toFixed(1)}% is below premium confidence.`);
          if (analysisBand?.cv != null && analysisBand.cv < 0.35) addSignal(signalPros, "Variance", `Stable L5 band, CV ${analysisBand.cv.toFixed(3)}.`);
          else if (analysisBand?.cv != null) addSignal(signalCons, "Variance", `Wide L5 band, CV ${analysisBand.cv.toFixed(3)}.`);
          if (lineInBand) addSignal(signalCons, "Line Inside Band", `Book line ${l} sits inside ${analysisBand.floor}-${analysisBand.ceiling}.`);
          if (Math.abs(baselineMovePct) >= 25) addSignal(signalCons, "Large Calibration Move", `${Math.abs(baselineMovePct).toFixed(1)}% ${baselineMovePct >= 0 ? "above" : "below"} baseline needs stronger confirmation.`);
          else if (Math.abs(baselineMovePct) >= 8 && moveSupportsSide) addSignal(signalPros, "Calibration Move", `${Math.abs(baselineMovePct).toFixed(1)}% ${baselineMovePct >= 0 ? "above" : "below"} baseline and aligned with ${finalVerdict.toUpperCase()}.`);
          else if (Math.abs(baselineMovePct) >= 8) addSignal(signalCons, "Calibration Move", `${Math.abs(baselineMovePct).toFixed(1)}% move cuts against the side.`);
          if (analysisDataQuality.has_tracking) addSignal(signalPros, "Tracking", "Player tracking data was included in calibration.");
          else addSignal(signalCons, "Tracking", "No player tracking signal for this run.");
          if (analysisDataQuality.has_team_context) addSignal(signalPros, "Team Style", "Live four-factor and misc team profile was included.");
          if (analysisFeatures.opp_def_roll10 != null) {
            const def = +analysisFeatures.opp_def_roll10;
            const defText = def >= 115 ? "weaker defensive environment" : def <= 111 ? "tough defensive environment" : "neutral defensive environment";
            (finalVerdict === "over" && def >= 115) || (finalVerdict === "under" && def <= 111)
              ? addSignal(signalPros, "Matchup", `${ot} rates as a ${defText}.`)
              : addSignal(signalCons, "Matchup", `${ot} is a ${defText}.`);
          }
          const oppDefVal = analysisFeatures.opp_def_roll10 != null ? +analysisFeatures.opp_def_roll10 : +(otd?.dEFF || 0);
          const oppPaceVal = analysisFeatures.opp_pace_roll10 != null ? +analysisFeatures.opp_pace_roll10 : +(otd?.rsPace || proj.gamePace || 0);
          const fg3Vs = analysisFeatures.fg3_vs_avg != null ? +analysisFeatures.fg3_vs_avg : +(teamDefense?.[ot]?.fg3VsAvg || 0);
          const rimVs = analysisFeatures.rim_vs_avg != null ? +analysisFeatures.rim_vs_avg : +(teamDefense?.[ot]?.rimVsAvg || 0);
          const styleDebug = analysisBreakdown.team_context_debug || {};
          const ownStyle = { ...(teamContext?.[pt] || {}), ...(styleDebug.own || {}) };
          const oppStyle = { ...(teamContext?.[ot] || {}), ...(styleDebug.opp || {}) };
          const fmtPct = (v) => v == null ? null : `${(+v * 100).toFixed(1)}%`;
          const playerTrack = { ...(trackingStats?.[pkey] || {}), ...(analysisBreakdown.tracking_debug || {}) };
          const shotMix = { ...(scoringBreakdown?.[pkey] || {}), ...(analysisBreakdown.scoring_debug || {}) };
          const hasScoringComponent = ["points","three_pointers","field_goal_attempts","field_goal_made","two_point_attempts","three_point_attempts","pra","pa","pr"].includes(pr.id);
          const hasAssistComponent = ["assists","pa","pra","ra"].includes(pr.id);
          const hasReboundComponent = ["rebounds","pra","pr","ra"].includes(pr.id);
          const teamUsage = (g?.[pt] || [])
            .map(name => {
              const p = effectiveDB[name];
              return { name, team: p?.team, usg: +(p?.po?.usg ?? p?.rs?.usg ?? 0), min: +(p?.po?.min ?? p?.rs?.min ?? 0) };
            })
            .filter(x => x.team === pt && x.usg > 0 && x.min >= 8)
            .sort((a, b) => b.usg - a.usg);
          const myUsage = +(player.po?.usg ?? player.rs?.usg ?? 0);
          const usageRank = teamUsage.findIndex(x => x.name === player.key) + 1;
          const usagePeers = teamUsage.filter(x => x.name !== player.key).slice(0, 2).map(x => `${dn(x.name)} ${x.usg.toFixed(1)}%`);
          const matchupChips = [
            oppDefVal ? { k:"OPP DEF", v:oppDefVal.toFixed(1), c:oppDefVal >= 115 ? "#10b981" : oppDefVal <= 111 ? "#ef4444" : "#f59e0b" } : null,
            oppPaceVal ? { k:"PACE", v:oppPaceVal.toFixed(1), c:oppPaceVal >= 99 ? "#10b981" : oppPaceVal <= 94 ? "#ef4444" : "#94a3b8" } : null,
            oppStyle.oppEFG != null ? { k:"OPP eFG", v:fmtPct(oppStyle.oppEFG), c:+oppStyle.oppEFG >= .56 ? "#10b981" : +oppStyle.oppEFG <= .525 ? "#ef4444" : "#f59e0b" } : null,
            oppStyle.oppTovPct != null ? { k:"TO PRESS", v:fmtPct(oppStyle.oppTovPct), c:+oppStyle.oppTovPct >= .145 ? "#ef4444" : +oppStyle.oppTovPct <= .12 ? "#10b981" : "#f59e0b" } : null,
            oppStyle.drebPct != null ? { k:"OPP DREB", v:fmtPct(oppStyle.drebPct), c:+oppStyle.drebPct >= .725 ? "#ef4444" : +oppStyle.drebPct <= .68 ? "#10b981" : "#94a3b8" } : null,
            ownStyle.offEFG != null ? { k:"OWN eFG", v:fmtPct(ownStyle.offEFG), c:+ownStyle.offEFG >= .56 ? "#10b981" : +ownStyle.offEFG <= .525 ? "#ef4444" : "#94a3b8" } : null,
            myUsage ? { k:"USAGE", v:`${myUsage.toFixed(1)}%`, c:"#818cf8" } : null,
            player.po?.min ? { k:"MIN", v:player.po.min, c:"#60a5fa" } : null,
          ].filter(Boolean);
          const matchupNotes = [];
          if (usageRank > 0) {
            matchupNotes.push({
              title: `Role: ${usageRank === 1 ? "primary option" : `usage rank #${usageRank}`}`,
              text: `${dname} owns ${myUsage.toFixed(1)}% usage${usagePeers.length ? `; next ${pt} pressure comes from ${usagePeers.join(" and ")}.` : "."}`,
            });
          }
          if (oppDefVal) {
            matchupNotes.push({
              title: oppDefVal >= 115 ? "Opponent defense gives room" : oppDefVal <= 111 ? "Opponent defense is a headwind" : "Opponent defense is neutral",
              text: `${ot} defensive efficiency sits at ${oppDefVal.toFixed(1)}. That ${oppDefVal >= 115 ? "raises" : oppDefVal <= 111 ? "lowers" : "does not strongly move"} the raw scoring environment.`,
            });
          }
          if (ownStyle.offEFG != null || oppStyle.oppEFG != null || oppStyle.oppTovPct != null) {
            const styleBits = [];
            if (oppStyle.oppEFG != null) styleBits.push(`${ot} allows ${fmtPct(oppStyle.oppEFG)} eFG`);
            if (oppStyle.oppTovPct != null) styleBits.push(`${fmtPct(oppStyle.oppTovPct)} forced turnover rate`);
            if (oppStyle.oppFtRate != null) styleBits.push(`${fmtPct(oppStyle.oppFtRate)} FT rate allowed`);
            if (ownStyle.offEFG != null) styleBits.push(`${pt} creates ${fmtPct(ownStyle.offEFG)} eFG`);
            matchupNotes.push({
              title: "Team style fit",
              text: `${styleBits.slice(0, 4).join("; ")}. This is the live proxy layer for scheme pressure, shot quality, and offensive shape.`,
            });
          }
          if (hasScoringComponent) {
            const scoringBits = [];
            const attemptBits = [];
            if (shotMix.pctPts3pt != null) scoringBits.push(`${shotMix.pctPts3pt}% pts from 3`);
            if (shotMix.pctPtsPaint != null) scoringBits.push(`${shotMix.pctPtsPaint}% paint pts`);
            if (shotMix.pctPtsFt != null) scoringBits.push(`${shotMix.pctPtsFt}% FT pts`);
            if (shotMix.pctFga3pt != null) attemptBits.push(`${shotMix.pctFga3pt}% 3PA rate`);
            if (playerTrack.driveFga) attemptBits.push(`${playerTrack.driveFga} drive FGA/g`);
            if (playerTrack.pullUpFga) attemptBits.push(`${playerTrack.pullUpFga} pull-up FGA/g`);
            if (playerTrack.catchShootFga) attemptBits.push(`${playerTrack.catchShootFga} C&S FGA/g`);
            const scoringText = scoringBits.length ? `Scoring mix: ${scoringBits.slice(0, 3).join(" / ")}.` : "";
            const attemptText = attemptBits.length ? ` Attempt profile: ${attemptBits.slice(0, 3).join(" / ")}.` : "";
            const schemeText = fg3Vs > .02 ? `${ot} allows extra 3PA.` : rimVs > .02 ? `${ot} is soft at the rim.` : "No obvious scheme boost from available profile.";
            matchupNotes.push({
              title: "Scoring mix vs matchup",
              text: scoringText || attemptText
                ? `${scoringText}${attemptText} ${schemeText}`.trim()
                : "Scoring-mix data is limited for this player/prop.",
            });
          }
          if (hasAssistComponent) {
            const potAst = playerTrack.potentialAst ?? analysisFeatures.l5_potential_ast;
            const convRate = playerTrack.astConvRate;
            matchupNotes.push({
              title: "Creation profile",
              text: potAst
                ? `${potAst} potential assists/g${convRate != null ? ` with ${(convRate * 100).toFixed(0)}% conversion` : ""}. This tells us whether the assist side is volume-backed or make-dependent.`
                : analysisDataQuality.has_tracking
                  ? "Tracking was included by the server, but no potential-assist volume was exposed for this player."
                  : "No reliable potential-assist tracking for this run.",
            });
          }
          if (hasReboundComponent) {
            matchupNotes.push({
              title: "Board chances",
              text: playerTrack.rebChancePct
                ? `${playerTrack.rebChancePct}% of rebound chances secured; chance volume matters more than raw RPG here.`
                : "No reliable rebound-chance tracking for this run.",
            });
          }
          if (injuryContext?.outPlayers?.length) {
            matchupNotes.push({
              title: "Usage opened up",
              text: `${injuryContext.outPlayers.slice(0, 3).map(x => dn(x.name)).join(", ")} OUT creates ${injuryContext.boostPPG} projected scoring load to redistribute.`,
            });
          }
          const visibleMatchupNotes = matchupNotes.slice(0, 5);
          const visiblePros = signalPros.slice(0, 2);
          const visibleCons = signalCons.slice(0, 2);
          const AnalystList = ({ title, items, tone }) => (
            <div style={{ background:"rgba(15,23,42,.52)", border:`1px solid ${tone}33`, borderRadius:10, padding:"10px 12px" }}>
              <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:8, letterSpacing:".18em", color:tone, fontWeight:800, marginBottom:8 }}>{title}</div>
              <div style={{ display:"grid", gap:6 }}>
                {(items.length ? items : [{ title:"Neutral", text:"No strong signal fired here." }]).map((x, i) => (
                  <div key={`${title}-${i}`} style={{ display:"grid", gap:2 }}>
                    <div style={{ fontSize:10, color:"#e8f0ff", fontWeight:800 }}>{x.title}</div>
                    <div style={{ fontSize:10, color:"#94a3b8", lineHeight:1.3 }}>{x.text}</div>
                  </div>
                ))}
              </div>
            </div>
          );
          const decisionLabel =
            confGrade === "LOCK" ? "BEST BET" :
            confGrade === "ACTIONABLE" ? "PLAY" :
            confGrade === "WATCH" ? "LEAN" :
            "PASS";
          const decisionCopy =
            confGrade === "LOCK" ? "Strong enough to lead the card." :
            confGrade === "ACTIONABLE" ? "Good enough for a standard play." :
            confGrade === "WATCH" ? "There is an edge, but it needs restraint." :
            lineInBand ? "Lean exists, but the line lives inside the normal range." :
            Math.abs(finalEvPct) < 7 ? "Projection clears the line, but the edge is thin." :
            "The model does not have enough clean support.";
          return (
            <div className="rp" data-grade={confGrade}>
              {/* ── HERO — slot-machine reveal ───────────────────────── */}
              <div style={{ marginBottom: 22 }}>

                {/* Player + live badge */}
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", gap:16, marginBottom:18, paddingBottom:16, borderBottom:"1px solid rgba(255,255,255,.06)" }}>
                  <div style={{ display:"flex", alignItems:"center", gap:14, minWidth:0 }}>
                    <div style={{ width:82, height:72, borderRadius:14, background:`linear-gradient(135deg, ${confGradeColor}24, rgba(15,23,42,.75))`, border:`1px solid ${confGradeColor}44`, position:"relative", overflow:"hidden", flexShrink:0, display:"grid", placeItems:"center" }}>
                      <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:22, fontWeight:900, color:confGradeColor, opacity:.35 }}>{playerInitials}</div>
                      {playerHeadshot && (
                        <img
                          src={playerHeadshot}
                          alt={dname}
                          loading="lazy"
                          onError={e => { e.currentTarget.style.display = "none"; }}
                          style={{ position:"absolute", inset:"-8px -6px 0 -6px", width:"calc(100% + 12px)", height:"calc(100% + 8px)", objectFit:"cover", objectPosition:"center top" }}
                        />
                      )}
                    </div>
                    <div style={{ minWidth:0 }}>
                    <div className="rpn">{dname}</div>
                    <div className="rpm">{pt} vs {ot} · {g.title} · {pr.label}</div>
                    </div>
                  </div>
                  <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:6 }}>
                    <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:10, color:"#10b981", background:"rgba(16,185,129,.08)", border:"1px solid rgba(16,185,129,.22)", borderRadius:99, padding:"4px 12px" }}>
                      {nbaApiStatus === "live" ? "● NBA.COM LIVE" : "◎ STATIC DB"}
                    </div>
                    {serverCorr && <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:10, color:"#6366f1", background:"rgba(99,102,241,.08)", border:"1px solid rgba(99,102,241,.2)", borderRadius:99, padding:"4px 12px" }}>⚡ SERVER CORR LIVE</div>}
                  </div>
                </div>

                {/* Big number + grade — the slot machine moment */}
                <div style={{ display:"grid", gridTemplateColumns:"minmax(230px,.78fr) minmax(390px,1.55fr)", gap:12, alignItems:"start", marginBottom:14 }}>
                  <div style={{ background:`linear-gradient(160deg, ${confGradeColor}18, rgba(15,23,42,.68))`, border:`1px solid ${confGradeColor}44`, borderRadius:12, padding:"14px 16px", overflow:"hidden" }}>
                    <div>
                      <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:9, letterSpacing:".2em", color:"#64748b", fontWeight:800, marginBottom:10 }}>PROJECTION</div>
                      <div style={{ display:"grid", gap:4 }}>
                        <div className="proj-hero-num" style={{ fontSize:52, fontWeight:900, fontFamily:"'Azeret Mono',monospace", color:"#e8f0ff", lineHeight:.95, letterSpacing:0 }}>{finalProj}</div>
                        <div>
                          <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:18, color:"#3b82f6", fontWeight:800, lineHeight:1 }}>{pr.label3}</div>
                          <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:9, color:"#475569", letterSpacing:".12em", marginTop:4 }}>{serverCorr ? "SERVER MODEL" : "CLIENT MODEL"}</div>
                        </div>
                      </div>
                      <div style={{ height:1, background:"rgba(255,255,255,.08)", margin:"14px 0 12px" }} />
                      <div style={{ display:"grid", gap:7 }}>
                        <div style={{ display:"flex", alignItems:"center", gap:8, flexWrap:"wrap" }}>
                          <div style={{ background:`${confGradeColor}1e`, border:`1px solid ${confGradeColor}`, borderRadius:8, padding:"7px 12px", color:confGradeColor, fontWeight:900, fontSize:16, fontFamily:"'Azeret Mono',monospace", letterSpacing:".08em" }}>{decisionLabel}</div>
                          <div style={{ color:finalEc, fontFamily:"'Azeret Mono',monospace", fontSize:13, fontWeight:800 }}>{finalVerdict.toUpperCase()} lean · {finalEdge > 0 ? "+" : ""}{finalEdge}</div>
                        </div>
                        <div style={{ color:"#94a3b8", fontSize:12, lineHeight:1.35 }}>{decisionCopy}</div>
                      </div>
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:12 }}>
                      <div>
                        <div style={{ fontFamily:"'Azeret Mono',monospace", color:"#64748b", fontSize:9, letterSpacing:".14em" }}>BOOK</div>
                        <div style={{ color:"#e8f0ff", fontSize:18, fontWeight:800 }}>{l || "—"}</div>
                      </div>
                      <div>
                        <div style={{ fontFamily:"'Azeret Mono',monospace", color:"#64748b", fontSize:9, letterSpacing:".14em" }}>EDGE</div>
                        <div style={{ color:finalEc, fontSize:18, fontWeight:800 }}>{finalEvPct > 0 ? "+" : ""}{finalEvPct}%</div>
                      </div>
                    </div>
                  </div>

                  <div style={{ background:"rgba(15,23,42,.46)", border:"1px solid rgba(255,255,255,.08)", borderRadius:12, padding:14 }}>
                    <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", gap:10, marginBottom:12 }}>
                      <div>
                        <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:9, letterSpacing:".2em", color:"#64748b", fontWeight:800 }}>MATCHUP READ</div>
                        <div style={{ color:"#e8f0ff", fontSize:16, fontWeight:900, marginTop:4 }}>{pt} vs {ot}</div>
                      </div>
                      <div className="grade-badge-hero" style={{ background:`${confGradeColor}18`, border:`1px solid ${confGradeColor}`, borderRadius:10, padding:"9px 12px", textAlign:"center", minWidth:86 }}>
                        <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:8, letterSpacing:".2em", color:confGradeColor, marginBottom:4, opacity:.75 }}>VERDICT</div>
                        <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:17, fontWeight:900, color:confGradeColor, lineHeight:1 }}>{decisionLabel}</div>
                      </div>
                    </div>
                    <div style={{ fontSize:12, color:"#c8d4e8", lineHeight:1.45, marginBottom:10 }}>
                      {decisionCopy} {dname} projects <strong style={{ color:finalEc }}>{finalVerdict.toUpperCase()}</strong> by <strong>{Math.abs(finalEdge)} {pr.label3}</strong>, but the matchup read decides whether that lean is actually playable.
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(4,minmax(72px,1fr))", gap:7, marginBottom:10 }}>
                      {matchupChips.map(x => (
                        <div key={x.k} style={{ background:"rgba(255,255,255,.035)", border:"1px solid rgba(255,255,255,.07)", borderRadius:8, padding:"7px 8px" }}>
                          <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:8, color:"#64748b", letterSpacing:".12em" }}>{x.k}</div>
                          <div style={{ color:x.c, fontSize:14, fontWeight:900, marginTop:2 }}>{x.v}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(160px,1fr))", gap:8 }}>
                      {(visibleMatchupNotes.length ? visibleMatchupNotes : [{ title:"Context", text:"No strong matchup-specific signal fired; projection leans more on baseline and line value." }]).map((x, i) => (
                        <div key={i} style={{ background:"rgba(0,0,0,.14)", border:"1px solid rgba(255,255,255,.055)", borderRadius:8, padding:"8px 10px" }}>
                          <div style={{ color:"#e8f0ff", fontSize:11, fontWeight:900, marginBottom:2 }}>{x.title}</div>
                          <div style={{ color:"#94a3b8", fontSize:11, lineHeight:1.35 }}>{x.text}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginTop:10 }}>
                      <AnalystList title="PROS" items={visiblePros} tone="#10b981" />
                      <AnalystList title="CONS" items={visibleCons} tone="#ef4444" />
                    </div>
                    <button type="button" onClick={() => setShowAnalysis(v => !v)} style={{ marginTop:12, width:"100%", border:"1px solid rgba(99,102,241,.35)", background:"rgba(99,102,241,.09)", color:"#818cf8", borderRadius:8, padding:"8px 10px", cursor:"pointer", fontFamily:"'Azeret Mono',monospace", fontSize:10, fontWeight:800, letterSpacing:".12em" }}>
                      {showAnalysis ? "HIDE DATA" : "MORE DATA"}
                    </button>
                  </div>

                  {pr.id === "points" && (
                    <div style={{ gridColumn:"1 / -1" }}>
                      <PlayerShotChart chart={shotChart} loading={shotChartLoading} defense={teamDefense?.[ot]} opponent={ot} />
                    </div>
                  )}

                  <div style={{ display:"none" }}>
                    <AnalystList title="PROS" items={visiblePros} tone="#10b981" />
                    <AnalystList title="CONS" items={visibleCons} tone="#ef4444" />
                  </div>
                </div>

                <div style={{ display:"none", gridTemplateColumns:"1fr auto", gap:16, alignItems:"center", marginBottom:18 }}>
                  <div>
                    {/* Projection number */}
                    <div style={{ display:"flex", alignItems:"baseline", gap:12, marginBottom:12 }}>
                      <div className="proj-hero-num" style={{ fontSize:76, fontWeight:800, fontFamily:"'Azeret Mono',monospace", color:"#e8f0ff", lineHeight:1, letterSpacing:"-.04em" }}>
                        {finalProj}
                      </div>
                      <div style={{ paddingBottom:6 }}>
                        <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:20, color:"#3b82f6", fontWeight:700, lineHeight:1 }}>{pr.label3}</div>
                        <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:10, color:"#2a3a52", letterSpacing:".12em", marginTop:4 }}>
                          {serverCorr ? "14-FACTOR MODEL" : "CLIENT ESTIMATE"}
                        </div>
                      </div>
                    </div>
                    {/* Verdict + EV row */}
                    <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
                      <div style={{ background:`${finalEc}1e`, border:`2px solid ${finalEc}`, borderRadius:10, padding:"8px 18px", display:"inline-flex", alignItems:"center", gap:10 }}>
                        <span style={{ color:finalEc, fontWeight:900, fontSize:20, fontFamily:"'Azeret Mono',monospace", letterSpacing:".1em" }}>{finalVerdict.toUpperCase()}</span>
                        <span style={{ color:finalEc, fontFamily:"'Azeret Mono',monospace", fontSize:14, opacity:.9 }}>
                          {finalEdge > 0 ? "▲" : "▼"} {Math.abs(finalEdge)} {pr.label3}
                        </span>
                      </div>
                      <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:20, fontWeight:700, color:finalEvPct > 0 ? "#10b981" : "#ef4444" }}>
                        {finalEvPct > 0 ? "+" : ""}{finalEvPct}%
                        <span style={{ fontSize:11, color:"#2a3550", marginLeft:5, fontWeight:400 }}>EV</span>
                      </div>
                    </div>
                  </div>

                  {/* GRADE badge */}
                  <div className="grade-badge-hero" style={{ background:`${confGradeColor}18`, border:`2px solid ${confGradeColor}`, borderTop:`3px solid ${confGradeColor}`, borderRadius:16, padding:"18px 22px", textAlign:"center", minWidth:118, boxShadow:`0 0 48px ${confGradeColor}28,0 8px 24px rgba(0,0,0,.25)` }}>
                    <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:9, letterSpacing:".25em", color:confGradeColor, marginBottom:6, opacity:.65 }}>GRADE</div>
                    <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:30, fontWeight:900, color:confGradeColor, lineHeight:1, letterSpacing:".04em" }}>{confGrade}</div>
                    {l > 0 && <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:10, color:"#3a4a62", marginTop:8 }}>O/U {l}</div>}
                  </div>
                </div>

                {/* Quick stat pills */}
                <div style={{ display: showAnalysis ? "flex" : "none", gap:8, flexWrap:"wrap", marginBottom:14 }}>
                  {[
                    { label:"BOOK LINE", val: l || "—",               color:"#94a3b8" },
                    { label:"PO AVG",    val: proj.propPO ?? "—",     color:"#60a5fa" },
                    { label:"L5 AVG",    val: proj.propRecent ?? "—", color:"#f59e0b" },
                    ...(serverCorr?.confidenceBand ? [
                      { label:"FLOOR",  val: serverCorr.confidenceBand.floor,   color:"#475569" },
                      { label:"CEILING",val: serverCorr.confidenceBand.ceiling, color:"#475569" },
                      ...(serverCorr.confidenceBand.trust_score != null ? [{
                        label:"TRUST",
                        val: serverCorr.confidenceBand.trust_score,
                        color: serverCorr.confidenceBand.trust_score >= 70 ? "#10b981" : serverCorr.confidenceBand.trust_score >= 40 ? "#f59e0b" : "#ef4444"
                      }] : []),
                    ] : []),
                  ].map(({ label, val, color }) => (
                    <div key={label} style={{ background:"rgba(255,255,255,.04)", border:"1px solid rgba(255,255,255,.09)", borderRadius:10, padding:"8px 14px", textAlign:"center", minWidth:66 }}>
                      <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:17, fontWeight:700, color, lineHeight:1 }}>{val}</div>
                      <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:9, color:"#2a3550", marginTop:4, letterSpacing:".12em" }}>{label}</div>
                    </div>
                  ))}
                  {/* ¼ Kelly */}
                  {false && l > 0 && finalEvPct !== 0 && (() => {
                    const spMc = serverCorr?.monteCarlo ?? null;
                    const spIsOver = finalEvPct > 0;
                    const spMcProb = spMc ? (spIsOver ? spMc.prob_over : spMc.prob_under) : null;
                    const p = spMcProb != null ? Math.min(0.85, Math.max(0.15, spMcProb)) : Math.min(0.85, Math.max(0.15, (finalEvPct / 100 + 1) / 2));
                    const b = spMcProb != null ? (10 / 11) : Math.abs(finalEvPct) / 100;
                    const k = b > 0 ? Math.max(0, (b * p - (1 - p)) / b) : 0;
                    const qk = +(k * 0.25 * 100).toFixed(1);
                    if (qk <= 0) return null;
                    return (
                      <div style={{ background:"rgba(129,140,248,.09)", border:"1px solid rgba(129,140,248,.3)", borderRadius:10, padding:"8px 14px", textAlign:"center", minWidth:66 }}>
                        <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:17, fontWeight:700, color:"#818cf8", lineHeight:1 }}>{qk}%</div>
                        <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:9, color:"#2a3550", marginTop:4, letterSpacing:".12em" }}>¼ KELLY</div>
                      </div>
                    );
                  })()}
                </div>

                <div style={{ display: showAnalysis ? "block" : "none", background:"rgba(15,23,42,.36)", border:"1px solid rgba(255,255,255,.07)", borderRadius:10, padding:"10px 12px", marginBottom:14 }}>
                  <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:9, letterSpacing:".18em", color:"#64748b", fontWeight:800, marginBottom:9 }}>CALIBRATION PATH</div>
                  <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(130px,1fr))", gap:8 }}>
                    {[
                      ["Baseline", `${baseline} ${pr.label3}`, "#60a5fa"],
                      ["Context", `${baselineMovePct >= 0 ? "+" : ""}${baselineMovePct.toFixed(1)}%`, moveSupportsSide ? "#10b981" : "#ef4444"],
                      ["Variance", analysisBand?.cv != null ? `CV ${analysisBand.cv.toFixed(3)}` : "n/a", analysisBand?.cv != null && analysisBand.cv < .35 ? "#10b981" : "#f59e0b"],
                      ["Final", `${finalProj} ${pr.label3}`, finalEc],
                    ].map(([label, val, color]) => (
                      <div key={label} style={{ display:"flex", justifyContent:"space-between", gap:10, alignItems:"center", background:"rgba(255,255,255,.03)", border:"1px solid rgba(255,255,255,.06)", borderRadius:8, padding:"8px 10px" }}>
                        <span style={{ fontFamily:"'Azeret Mono',monospace", color:"#64748b", fontSize:9, letterSpacing:".12em" }}>{label}</span>
                        <strong style={{ color, fontSize:12 }}>{val}</strong>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Confidence band visual */}
                {showAnalysis && serverCorr?.confidenceBand && (() => {
                  const cb = serverCorr.confidenceBand;
                  return (
                    <ConfidenceMeter
                      proj={finalProj ?? cb.floor}
                      line={l}
                      floor={cb.floor}
                      ceiling={cb.ceiling}
                      trustScore={cb.trust_score ?? null}
                      source={cb.source}
                      std={cb.std}
                      n={cb.n}
                    />
                  );
                })()}
              </div>

              {/* ── Record Actual — log real outcome to calibrate future projections ── */}
              {showAnalysis && (() => {
                const residuals = getResiduals(player.key, pr.id);
                const n = residuals.length;
                return (
                  <div style={{ display: "flex", gap: 8, alignItems: "center", marginBottom: 12, flexWrap: "wrap" }}>
                    {result.actualLogged !== undefined ? (
                      <div style={{ fontFamily: "'Azeret Mono',monospace", fontSize: 10, color: "#10b981",
                        background: "rgba(16,185,129,.08)", border: "1px solid rgba(16,185,129,.2)",
                        borderRadius: 6, padding: "6px 12px", display: "flex", gap: 10, alignItems: "center" }}>
                        <span>✓ LOGGED {result.actualLogged} {pr.label3}</span>
                        <span style={{ color: "#3a4a62" }}>│</span>
                        <span style={{ color: "#3a4a62" }}>MODEL NOW HAS {n} SAMPLE{n !== 1 ? "S" : ""} — RESIDUAL CALIBRATION {n >= 3 ? "ACTIVE" : "NEEDS " + (3 - n) + " MORE"}</span>
                      </div>
                    ) : (
                      <>
                        <input
                          type="number" step="0.5" min="0"
                          placeholder={`Log actual ${pr.label3}...`}
                          value={actualInput}
                          onChange={e => { setActualInput(e.target.value); setFetchedBox(null); }}
                          style={{ width: 170, padding: "7px 12px", background: "rgba(255,255,255,.04)",
                            border: "1px solid rgba(255,255,255,.1)", borderRadius: 6, color: "#c8d4e8",
                            fontSize: 13, fontFamily: "'Azeret Mono',monospace", outline: "none" }}
                        />
                        {/* Auto-fill from NBA box score */}
                        <button
                          onClick={() => handleFetchBox(pr.id)}
                          disabled={fetchingBox || !effectiveDB[pkey]?.pid}
                          title="Auto-fill from NBA box score"
                          style={{ padding: "7px 10px", background: fetchedBox ? "rgba(99,102,241,.18)" : "rgba(99,102,241,.08)",
                            border: `1px solid ${fetchedBox ? "rgba(99,102,241,.5)" : "rgba(99,102,241,.2)"}`, borderRadius: 6, color: "#818cf8",
                            cursor: "pointer", fontSize: 10, fontFamily: "'Azeret Mono',monospace", letterSpacing: ".1em",
                            opacity: effectiveDB[pkey]?.pid ? 1 : 0.4 }}>
                          {fetchingBox ? "…" : fetchedBox ? "✓ BOX" : "📊 FETCH"}
                        </button>
                        <button
                          disabled={!actualInput || isNaN(parseFloat(actualInput))}
                          onClick={() => {
                            const actual = parseFloat(actualInput);
                            if (!isNaN(actual) && actual >= 0) {
                              const proj2 = serverCorr?.projection ?? proj.adjustedProjection;
                              const ctx = {
                                ...buildResidualCtx({
                                  isHome: result.isHome,
                                  gameTitle: g?.title,
                                  restDays: result.restDays,
                                  outPlayers: injuryContext?.outPlayers || [],
                                }),
                                ...(fetchedBox ? { fullStats: fetchedBox } : {}),
                              };
                              saveResidual(player.key, pr.id, proj2, actual, ctx);
                              setResult(prev => ({ ...prev, actualLogged: actual }));
                              setActualInput("");
                              setFetchedBox(null);
                            }
                          }}
                          style={{ padding: "7px 14px", background: "rgba(16,185,129,.12)",
                            border: "1px solid rgba(16,185,129,.25)", borderRadius: 6, color: "#10b981",
                            cursor: "pointer", fontSize: 10, fontFamily: "'Azeret Mono',monospace",
                            letterSpacing: ".1em", opacity: actualInput ? 1 : 0.4 }}>
                          SAVE ✓
                        </button>
                        {n > 0 && (
                          <span style={{ fontFamily: "'Azeret Mono',monospace", fontSize: 9, color: n >= 3 ? "#10b981" : "#f59e0b" }}>
                            {n >= 3 ? `● ${n} samples — calibrated` : `◎ ${n} sample${n > 1 ? "s" : ""} — need ${3 - n} more`}
                          </span>
                        )}
                      </>
                    )}
                  </div>
                );
              })()}

              {/* ── Fetched box score preview ──────────────────────────────────── */}
              {showAnalysis && fetchedBox && (() => {
                const b = fetchedBox;
                const fgStr = b.fga > 0 ? `${b.fgm}/${b.fga} (${b.fg_pct}%)` : "—";
                const fg3Str = b.fg3a > 0 ? `${b.fg3m}/${b.fg3a} (${b.fg3_pct}%)` : "—";
                const ftStr  = b.fta > 0  ? `${b.ftm}/${b.fta} (${b.ft_pct}%)` : "—";
                return (
                  <div style={{ marginBottom: 12, padding: "10px 14px", background: "rgba(99,102,241,.06)",
                    border: "1px solid rgba(99,102,241,.2)", borderRadius: 8,
                    fontFamily: "'Azeret Mono',monospace", fontSize: 10 }}>
                    <div style={{ color: "#818cf8", marginBottom: 6, letterSpacing: ".1em", fontSize: 9 }}>
                      📊 BOX SCORE · {b.matchup} · {b.date} · {b.wl} · {b.min}min · {b.pm >= 0 ? "+" : ""}{b.pm} PM
                    </div>
                    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
                      {[
                        ["PTS", b.pts], ["REB", b.reb, "(" + b.oreb + "/" + b.dreb + ")"], ["AST", b.ast],
                        ["STL", b.stl], ["BLK", b.blk], ["TOV", b.tov],
                      ].map(([label, val, sub]) => (
                        <div key={label} style={{ textAlign: "center" }}>
                          <div style={{ color: "#c8d4e8", fontWeight: 700, fontSize: 13 }}>{val}</div>
                          <div style={{ color: "#475569", fontSize: 8 }}>{label}{sub ? " " + sub : ""}</div>
                        </div>
                      ))}
                      <div style={{ borderLeft: "1px solid rgba(255,255,255,.07)", paddingLeft: 16, display: "flex", gap: 16 }}>
                        {[["FG", fgStr], ["3P", fg3Str], ["FT", ftStr]].map(([label, val]) => (
                          <div key={label} style={{ textAlign: "center" }}>
                            <div style={{ color: "#94a3b8", fontWeight: 600, fontSize: 11 }}>{val}</div>
                            <div style={{ color: "#475569", fontSize: 8 }}>{label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* ── Residuals Manager — view, dedupe, clear logged outcomes ── */}
              {showAnalysis && (() => {
                const residuals = getResiduals(player.key, pr.id);
                if (residuals.length === 0) return null;
                return (
                  <details style={{ marginBottom: 12, background: "rgba(255,255,255,.025)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 8, padding: "8px 14px" }}>
                    <summary style={{ cursor: "pointer", fontFamily: "'Azeret Mono',monospace", fontSize: 10, color: "#94a3b8", letterSpacing: ".12em", listStyle: "none", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span>📋 RESIDUAL HISTORY ({residuals.length} sample{residuals.length !== 1 ? "s" : ""})</span>
                      <span style={{ color: "#475569", fontSize: 9 }}>▼ EXPAND</span>
                    </summary>
                    <div style={{ marginTop: 12, fontSize: 11, fontFamily: "'Azeret Mono',monospace" }}>
                      <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 12 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(255,255,255,.1)" }}>
                            <th style={{ textAlign: "left",  padding: "6px 8px", color: "#64748b" }}>DATE</th>
                            <th style={{ textAlign: "left",  padding: "6px 8px", color: "#64748b" }}>CONTEXT</th>
                            <th style={{ textAlign: "right", padding: "6px 8px", color: "#64748b" }}>PROJECTED</th>
                            <th style={{ textAlign: "right", padding: "6px 8px", color: "#64748b" }}>ACTUAL</th>
                            <th style={{ textAlign: "right", padding: "6px 8px", color: "#64748b" }}>RESIDUAL</th>
                            <th style={{ textAlign: "right", padding: "6px 8px", color: "#64748b" }}>—</th>
                          </tr>
                        </thead>
                        <tbody>
                          {residuals.map((r, i) => {
                            const resid = r.actual - r.projected;
                            const pct = r.projected > 0 ? (resid / r.projected * 100) : 0;
                            const color = Math.abs(pct) < 8 ? "#10b981" : Math.abs(pct) < 20 ? "#f59e0b" : "#ef4444";
                            // Context tag pills — small visual badges per residual entry
                            const ctxTags = [];
                            if (r.ctx) {
                              if (r.ctx.home === true)  ctxTags.push({ t: "🏠 H",  c: "#3b82f6" });
                              if (r.ctx.home === false) ctxTags.push({ t: "✈️ A",  c: "#94a3b8" });
                              if (r.ctx.po)             ctxTags.push({ t: "PO",    c: "#a855f7" });
                              if (r.ctx.b2b)            ctxTags.push({ t: "B2B",   c: "#f59e0b" });
                              if (r.ctx.leverage)       ctxTags.push({ t: "🔥G7",  c: "#ef4444" });
                              if (Array.isArray(r.ctx.out) && r.ctx.out.length > 0) {
                                ctxTags.push({ t: `⚡${r.ctx.out.length} OUT`, c: "#10b981" });
                              }
                            }
                            const fs = r.ctx?.fullStats;
                            return (
                              <React.Fragment key={i}>
                              <tr style={{ borderBottom: fs ? "none" : "1px solid rgba(255,255,255,.04)" }}>
                                <td style={{ padding: "5px 8px", color: "#c8d4e8" }}>{r.date || "n/a"}</td>
                                <td style={{ padding: "5px 8px" }}>
                                  {ctxTags.length === 0 && !fs ? (
                                    <span style={{ color: "#475569", fontSize: 9 }}>—</span>
                                  ) : (
                                    <div style={{ display: "flex", gap: 3, flexWrap: "wrap" }}>
                                      {ctxTags.map((tag, idx) => (
                                        <span key={idx} title={Array.isArray(r.ctx?.out) && tag.t.includes("OUT") ? r.ctx.out.join(", ") : ""} style={{
                                          background: `${tag.c}15`,
                                          color: tag.c,
                                          border: `1px solid ${tag.c}55`,
                                          fontSize: 8.5, padding: "1px 5px", borderRadius: 3,
                                          fontWeight: 700, letterSpacing: ".05em",
                                        }}>{tag.t}</span>
                                      ))}
                                      {fs && <span style={{ background: "rgba(99,102,241,.12)", color: "#818cf8", border: "1px solid rgba(99,102,241,.3)", fontSize: 8.5, padding: "1px 5px", borderRadius: 3, fontWeight: 700 }}>📊</span>}
                                    </div>
                                  )}
                                </td>
                                <td style={{ padding: "5px 8px", textAlign: "right", color: "#94a3b8" }}>{r.projected}</td>
                                <td style={{ padding: "5px 8px", textAlign: "right", color: "#e8f0ff", fontWeight: 600 }}>{r.actual}</td>
                                <td style={{ padding: "5px 8px", textAlign: "right", color }}>{resid >= 0 ? "+" : ""}{resid.toFixed(2)} ({pct >= 0 ? "+" : ""}{pct.toFixed(1)}%)</td>
                                <td style={{ padding: "5px 8px", textAlign: "right" }}>
                                  <button
                                    onClick={() => {
                                      const key = `res_${player.key}_${pr.id}`;
                                      const filtered = residuals.filter((_, idx) => idx !== i);
                                      try { localStorage.setItem(key, JSON.stringify(filtered)); } catch {}
                                      setResult(prev => ({ ...prev, _residualVer: (prev?._residualVer || 0) + 1 }));
                                    }}
                                    style={{ background: "rgba(239,68,68,.1)", border: "1px solid rgba(239,68,68,.25)", color: "#ef4444", borderRadius: 4, padding: "2px 8px", fontSize: 9, fontFamily: "'Azeret Mono',monospace", cursor: "pointer" }}
                                    title="Delete this entry"
                                  >×</button>
                                </td>
                              </tr>
                              {fs && (
                                <tr style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                                  <td colSpan={6} style={{ padding: "3px 8px 7px 8px" }}>
                                    <div style={{ display: "flex", gap: 10, flexWrap: "wrap", fontFamily: "'Azeret Mono',monospace", fontSize: 8.5, color: "#475569" }}>
                                      <span style={{ color: "#6366f1" }}>{fs.matchup} {fs.wl}</span>
                                      <span>{fs.min}min</span>
                                      <span style={{ color: "#c8d4e8" }}>{fs.pts}pts {fs.reb}reb {fs.ast}ast {fs.stl}stl {fs.blk}blk {fs.tov}tov</span>
                                      {fs.fga > 0 && <span>FG {fs.fgm}/{fs.fga} ({fs.fg_pct}%)</span>}
                                      {fs.fg3a > 0 && <span>3P {fs.fg3m}/{fs.fg3a} ({fs.fg3_pct}%)</span>}
                                      {fs.fta > 0  && <span>FT {fs.ftm}/{fs.fta} ({fs.ft_pct}%)</span>}
                                      <span style={{ color: fs.pm >= 0 ? "#10b981" : "#ef4444" }}>{fs.pm >= 0 ? "+" : ""}{fs.pm} PM</span>
                                    </div>
                                  </td>
                                </tr>
                              )}
                              </React.Fragment>
                            );
                          })}
                        </tbody>
                      </table>
                      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                        <button
                          onClick={() => {
                            const report = cleanAllResiduals();
                            alert(`🧹 Cleanup complete\n\nKeys scanned: ${report.keysScanned}\nDuplicates removed: ${report.dupesRemoved}\nTotal samples: ${report.totalBefore} → ${report.totalAfter}\n\n${report.perKey.length > 0 ? "Cleaned:\n" + report.perKey.slice(0, 10).map(p => `  ${p.key}: ${p.before} → ${p.after}`).join("\n") : "(no duplicates found)"}`);
                            setResult(prev => ({ ...prev, _residualVer: (prev?._residualVer || 0) + 1 }));
                          }}
                          style={{ background: "rgba(245,158,11,.12)", border: "1px solid rgba(245,158,11,.3)", color: "#f59e0b", borderRadius: 6, padding: "7px 14px", fontSize: 10, fontFamily: "'Azeret Mono',monospace", cursor: "pointer", letterSpacing: ".1em", fontWeight: 700 }}
                        >🧹 DEDUPE ALL PLAYERS</button>
                        <button
                          onClick={() => {
                            if (confirm(`Clear ALL residuals for ${dn(player.key)} ${pr.label}?\n\nCurrent samples: ${residuals.length}\n\nThis cannot be undone.`)) {
                              try { localStorage.removeItem(`res_${player.key}_${pr.id}`); } catch {}
                              setResult(prev => ({ ...prev, _residualVer: (prev?._residualVer || 0) + 1, actualLogged: undefined }));
                            }
                          }}
                          style={{ background: "rgba(239,68,68,.08)", border: "1px solid rgba(239,68,68,.25)", color: "#ef4444", borderRadius: 6, padding: "7px 14px", fontSize: 10, fontFamily: "'Azeret Mono',monospace", cursor: "pointer", letterSpacing: ".1em", fontWeight: 700 }}
                        >🗑 CLEAR THIS PROP</button>
                      </div>
                      <div style={{ marginTop: 10, fontSize: 10, color: "#64748b", lineHeight: 1.5 }}>
                        <strong style={{ color: "#94a3b8" }}>How it works:</strong> Adj 14 (Residual Calibration) uses these samples to detect systematic over/under-projection.
                        <strong style={{ color: "#a855f7" }}> Context-aware:</strong> samples are matched by similar conditions (home/road, PO/RS, B2B, key teammates OUT) so calibration applies only when context resembles tonight's game. Falls back to global mean when ≥3 context-similar samples aren't available.
                        Duplicates skew the bias signal — dedupe collapses entries with the same date. Latest write wins.
                      </div>
                    </div>
                  </details>
                );
              })()}

              {showAnalysis && inj && <div className={`injb ${inj.status === "GTD" || inj.status === "PROB" ? "gtd" : ""}`}>
                {inj.status === "PROB" ? "📋" : "⚠"} {dname} — {inj.status}: {inj.detail}
                <span style={{ marginLeft: 8, opacity: 0.7, fontSize: 8 }}>{inj.isLive ? "● LIVE REPORT" : "◎ STATIC"}</span>
              </div>}


              {/* ── Stat baseline cards (always visible) ── */}
              <div className="sr" style={{ display: showAnalysis ? undefined : "none" }}>
                <div className="sb"><div className="sbl">RS AVG · {proj.propRecent !== null ? "25%" : "40%"} wt</div><div className="sbv">{proj.propRS}</div><div className="sbs">{player.rs.gp}g · {pr.label3}</div></div>
                <div className="sb"><div className="sbl">PO AVG · {proj.propRecent !== null ? "40%" : "60%"} wt</div><div className="sbv">{proj.propPO}</div><div className="sbs">{player.po.gp}g · {pr.label3}</div></div>
                {proj.propRecent !== null && <div className="sb"><div className="sbl">L5 AVG · 35% wt</div><div className="sbv" style={{color:"#f59e0b"}}>{proj.propRecent}</div><div className="sbs">Last 5 PO games</div></div>}
                {proj.propVsOpp !== null && vsOpponentStats?.gp >= 2 && <div className="sb"><div className="sbl">vs {ot} ({vsOpponentStats.source})</div><div className="sbv" style={{color:"#a78bfa"}}>{proj.propVsOpp}</div><div className="sbs">{vsOpponentStats.gp}g · {pr.label3}</div></div>}
                <div className="sb hi"><div className="sbl">BLENDED BASE</div><div className="sbv bl">{proj.blended}</div><div className="sbs">{proj.propRecent !== null ? "PO×0.4+RS×0.25+L5×0.35" : "PO×0.6+RS×0.4"}</div></div>
              </div>

              {/* ── L5 GAME-BY-GAME BAR CHART ── */}
              {showAnalysis && (() => {
                const gameLog = recentStats?._gameLog;
                if (!gameLog || gameLog.length === 0) return null;
                const rawVals = extractL5StatValues(gameLog, pr.id);
                // Show last 10 games max, chronological (oldest → newest)
                const vals = rawVals.slice(-10);
                const chartData = vals.map((v, i) => ({
                  game: `G${rawVals.length - vals.length + i + 1}`,
                  value: v,
                  over: v > l,
                }));
                if (chartData.length === 0) return null;
                const maxVal = Math.max(...vals, l, finalProj) * 1.18;
                const CustomTooltip = ({ active, payload, label }) => {
                  if (!active || !payload?.length) return null;
                  const v = payload[0].value;
                  const hit = l > 0 ? (v > l ? "OVER" : v === l ? "PUSH" : "UNDER") : null;
                  const hitColor = hit === "OVER" ? "#10b981" : hit === "UNDER" ? "#ef4444" : "#f59e0b";
                  return (
                    <div style={{ background: "#0a101e", border: "1px solid rgba(37,99,235,.35)", borderRadius: 8, padding: "8px 14px", fontFamily: "'Azeret Mono',monospace", fontSize: 11 }}>
                      <div style={{ color: "#64748b", marginBottom: 4, fontSize: 9 }}>{label}</div>
                      <div style={{ color: "#e8f0ff", fontWeight: 700, fontSize: 16 }}>{v} <span style={{ fontSize: 10, color: "#64748b" }}>{pr.label3}</span></div>
                      {hit && <div style={{ color: hitColor, fontSize: 10, marginTop: 2 }}>{hit} {l}</div>}
                    </div>
                  );
                };
                const hitRate = l > 0 ? vals.filter(v => v > l).length : null;
                return (
                  <div style={{ marginBottom: 16, background: "rgba(255,255,255,.02)", border: "1px solid rgba(255,255,255,.07)", borderRadius: 12, padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <div style={{ fontFamily: "'Azeret Mono',monospace", fontSize: 9, letterSpacing: ".18em", color: "#94a3b8", textTransform: "uppercase" }}>
                        L5 GAME LOG ({chartData.length} PO games)
                        {hitRate !== null && <span style={{ marginLeft: 12, color: hitRate / vals.length >= 0.6 ? "#10b981" : hitRate / vals.length <= 0.4 ? "#ef4444" : "#f59e0b" }}>· {hitRate}/{vals.length} OVER {l}</span>}
                      </div>
                      <div style={{ display: "flex", gap: 12, fontFamily: "'Azeret Mono',monospace", fontSize: 9 }}>
                        <span style={{ color: "#2563eb" }}>─ PROJ {finalProj}</span>
                        {l > 0 && <span style={{ color: "#f59e0b" }}>── LINE {l}</span>}
                      </div>
                    </div>
                    <ResponsiveContainer width="100%" height={120}>
                      <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -28 }}>
                        <defs>
                          <linearGradient id="barGradOver" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#10b981" stopOpacity={0.9} />
                            <stop offset="100%" stopColor="#10b981" stopOpacity={0.35} />
                          </linearGradient>
                          <linearGradient id="barGradUnder" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#ef4444" stopOpacity={0.85} />
                            <stop offset="100%" stopColor="#ef4444" stopOpacity={0.3} />
                          </linearGradient>
                          <linearGradient id="barGradNeutral" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3b82f6" stopOpacity={0.85} />
                            <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.35} />
                          </linearGradient>
                        </defs>
                        <XAxis dataKey="game" tick={{ fontSize: 10, fill: "#3a4a62", fontFamily: "Azeret Mono" }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, maxVal]} tick={{ fontSize: 10, fill: "#2a3550" }} axisLine={false} tickLine={false} />
                        <Tooltip content={<CustomTooltip />} cursor={{ fill: "rgba(255,255,255,.04)" }} />
                        {/* Book line */}
                        {l > 0 && <ReferenceLine y={l} stroke="#f59e0b" strokeWidth={1.5} strokeDasharray="4 3" />}
                        {/* Final projection line */}
                        <ReferenceLine y={finalProj} stroke="#3b82f6" strokeWidth={2} strokeDasharray="6 3" />
                        <Bar dataKey="value" radius={[5, 5, 0, 0]} maxBarSize={40}>
                          {chartData.map((entry, index) => (
                            <Cell
                              key={index}
                              fill={l > 0 ? (entry.over ? "url(#barGradOver)" : "url(#barGradUnder)") : "url(#barGradNeutral)"}
                            />
                          ))}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                );
              })()}

              {/* Edge bar */}
              {showAnalysis && <div className="et" style={{ marginBottom: 14 }}><div className="ef" style={{ width:`${finalEpct*100}%`, background:finalEc }} /></div>}

              {/* ── MONTE CARLO — 10K bootstrap simulations from L5 distribution ── */}
              {showAnalysis && (() => {
                const mc = serverCorr?.monteCarlo;
                if (!mc) return null;
                const pOver  = mc.prob_over;
                const pUnder = mc.prob_under;
                const pPush  = mc.prob_push || 0;
                const fairLine = mc.implied_fair_line;
                const fairLineGap = l > 0 ? +(fairLine - l).toFixed(2) : 0;
                const fairLineColor = Math.abs(fairLineGap) < 0.5 ? "#f59e0b" : fairLineGap > 0 ? "#10b981" : "#ef4444";

                // Probability bar: width % for over and under
                const overPct  = pOver  != null ? Math.round(pOver  * 100) : 50;
                const underPct = pUnder != null ? Math.round(pUnder * 100) : 50;
                const pushPct  = Math.max(0, 100 - overPct - underPct);

                // Strong-side highlight
                const strongSide = pOver > pUnder ? "OVER" : pUnder > pOver ? "UNDER" : "EVEN";
                const strongPct  = Math.max(overPct, underPct);
                const strongColor = strongSide === "OVER" ? "#10b981" : strongSide === "UNDER" ? "#ef4444" : "#f59e0b";

                // Fair-odds (decimal). Vegas typically vigs both sides to ~1.91 (–110).
                // If our fair_odds_over < 1.91, the OVER is +EV at standard juice.
                const fairOddsOver  = mc.fair_odds_over;
                const fairOddsUnder = mc.fair_odds_under;
                const overEdgeVsVig  = fairOddsOver  ? +((1.91 / fairOddsOver  - 1) * 100).toFixed(1) : null;
                const underEdgeVsVig = fairOddsUnder ? +((1.91 / fairOddsUnder - 1) * 100).toFixed(1) : null;

                return (
                  <div style={{ marginBottom: 14, background: "rgba(168,85,247,.04)", border: "1px solid rgba(168,85,247,.25)", borderRadius: 14, padding: "16px 18px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12, flexWrap: "wrap", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <div style={{ fontFamily: "'Azeret Mono',monospace", fontSize: 9, letterSpacing: ".22em", color: "#a855f7", fontWeight: 700 }}>🎲 MONTE CARLO</div>
                        <span style={{ fontFamily: "'Azeret Mono',monospace", fontSize: 9, color: "#475569" }}>{(mc.n_sims/1000).toFixed(0)}K bootstrap sims · empirical L5 distribution</span>
                      </div>
                      <div style={{ fontFamily: "'Azeret Mono',monospace", fontSize: 10, color: "#94a3b8" }}>
                        FAIR LINE <span style={{ color: fairLineColor, fontWeight: 700, fontSize: 13 }}>{fairLine}</span>
                        {l > 0 && <span style={{ color: fairLineColor, marginLeft: 6 }}>({fairLineGap >= 0 ? "+" : ""}{fairLineGap} vs book)</span>}
                      </div>
                    </div>

                    {/* Stacked horizontal probability bar */}
                    {pOver != null && (
                      <>
                        <div style={{ display: "flex", height: 28, borderRadius: 6, overflow: "hidden", background: "rgba(0,0,0,.3)", marginBottom: 8 }}>
                          {overPct > 0 && (
                            <div style={{
                              width: `${overPct}%`,
                              background: "linear-gradient(90deg,rgba(16,185,129,.8) 0%,rgba(16,185,129,.5) 100%)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontFamily: "'Azeret Mono',monospace", fontSize: 11, fontWeight: 700, color: "#fff",
                              borderRight: pushPct > 0 || underPct > 0 ? "1px solid rgba(0,0,0,.3)" : "none",
                            }}>{overPct >= 12 && `OVER ${overPct}%`}</div>
                          )}
                          {pushPct > 0 && (
                            <div style={{
                              width: `${pushPct}%`,
                              background: "rgba(245,158,11,.6)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontFamily: "'Azeret Mono',monospace", fontSize: 10, color: "#fff",
                            }}>{pushPct >= 8 && `PUSH ${pushPct}%`}</div>
                          )}
                          {underPct > 0 && (
                            <div style={{
                              width: `${underPct}%`,
                              background: "linear-gradient(90deg,rgba(239,68,68,.5) 0%,rgba(239,68,68,.8) 100%)",
                              display: "flex", alignItems: "center", justifyContent: "center",
                              fontFamily: "'Azeret Mono',monospace", fontSize: 11, fontWeight: 700, color: "#fff",
                            }}>{underPct >= 12 && `UNDER ${underPct}%`}</div>
                          )}
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 12, fontFamily: "'Azeret Mono',monospace", fontSize: 10 }}>
                          <span style={{ color: "#10b981" }}>OVER {l} → {(pOver * 100).toFixed(1)}%{fairOddsOver && <span style={{ color: "#475569" }}> · fair {fairOddsOver}</span>}{overEdgeVsVig != null && overEdgeVsVig > 0 && <span style={{ color: "#10b981", marginLeft: 4, fontWeight: 700 }}>+{overEdgeVsVig}% vs -110</span>}</span>
                          <span style={{ color: "#ef4444" }}>{underEdgeVsVig != null && underEdgeVsVig > 0 && <span style={{ color: "#ef4444", fontWeight: 700, marginRight: 4 }}>+{underEdgeVsVig}% vs -110</span>}{fairOddsUnder && <span style={{ color: "#475569" }}>fair {fairOddsUnder} · </span>}UNDER {l} → {(pUnder * 100).toFixed(1)}%</span>
                        </div>
                      </>
                    )}

                    {/* Percentile distribution */}
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6, marginBottom: 4 }}>
                      {[
                        { p: "P10", v: mc.p10, label: "Floor", color: "#64748b" },
                        { p: "P25", v: mc.p25, label: "", color: "#64748b" },
                        { p: "P50", v: mc.p50, label: "Median", color: "#a855f7" },
                        { p: "P75", v: mc.p75, label: "", color: "#64748b" },
                        { p: "P90", v: mc.p90, label: "Ceiling", color: "#64748b" },
                      ].map(x => {
                        const isLineSide = l > 0 && ((x.v > l && pOver > pUnder) || (x.v < l && pUnder > pOver));
                        return (
                          <div key={x.p} style={{
                            background: x.p === "P50" ? "rgba(168,85,247,.10)" : "rgba(255,255,255,.025)",
                            border: `1px solid ${x.p === "P50" ? "rgba(168,85,247,.35)" : "rgba(255,255,255,.06)"}`,
                            borderRadius: 6, padding: "8px 6px", textAlign: "center",
                          }}>
                            <div style={{ fontFamily: "'Azeret Mono',monospace", fontSize: 8, letterSpacing: ".12em", color: x.color, marginBottom: 2 }}>{x.p}</div>
                            <div style={{ fontFamily: "'Azeret Mono',monospace", fontSize: 14, fontWeight: 700, color: x.p === "P50" ? "#a855f7" : "#e8f0ff" }}>{x.v}</div>
                            {x.label && <div style={{ fontFamily: "'Azeret Mono',monospace", fontSize: 8, color: "#475569", marginTop: 2 }}>{x.label}</div>}
                          </div>
                        );
                      })}
                    </div>

                    {/* Interpretation footnote */}
                    <div style={{ marginTop: 10, padding: "8px 12px", background: "rgba(0,0,0,.2)", borderRadius: 6, fontSize: 10.5, color: "#94a3b8", lineHeight: 1.55 }}>
                      {pOver != null ? (
                        <>
                          <strong style={{ color: strongColor }}>{strongSide}</strong> hits in <strong style={{ color: strongColor }}>{strongPct}%</strong> of 10K simulations.
                          {l > 0 && Math.abs(fairLineGap) >= 0.5 && <> Model's fair line ({fairLine}) sits <strong>{Math.abs(fairLineGap)} {pr.label3}</strong> {fairLineGap > 0 ? "above" : "below"} the book — {Math.abs(fairLineGap) > 1.5 ? "significant mispricing." : "modest edge."}</>}
                          {(overEdgeVsVig != null && overEdgeVsVig > 5) || (underEdgeVsVig != null && underEdgeVsVig > 5) ? <> Both sides priced at standard -110 vig — {strongSide} clears the vig comfortably.</> : null}
                        </>
                      ) : (
                        <>Distribution percentiles only — no book line provided.</>
                      )}
                    </div>
                  </div>
                );
              })()}

              {/* ── GRADE REASON STRIP ───────────────────────────────── */}
              {(() => {
                const cb = serverCorr?.confidenceBand;
                const baseline = serverCorr?.base ?? proj.blended;
                const liftSigned = baseline > 0 ? (finalProj - baseline) / baseline : 0;
                const modelLift = Math.abs(liftSigned);
                const liftSideText = liftSigned >= 0 ? "moved above baseline" : "moved below baseline";
                const gradeReason =
                  confGrade === "LOCK"       ? `Strong edge (+${Math.abs(finalEvPct).toFixed(1)}%) — tight L5 variance, healthy sample, model close to baseline.` :
                  confGrade === "ACTIONABLE" ? `Solid edge (+${Math.abs(finalEvPct).toFixed(1)}%) with acceptable variance — good single-unit play.` :
                  confGrade === "WATCH"      ? `Edge exists but ${cb && cb.cv >= 0.30 ? `L5 volatility high (CV ${cb.cv})` : modelLift >= 0.15 ? `model ${liftSideText} by ${(modelLift*100).toFixed(0)}%` : "trust signals mixed"} — small unit only.` :
                  confGrade === "SKIP"       ? `Model trust insufficient — ${Math.abs(finalEvPct) < 4 ? "edge below 4%" : `model ${liftSideText} by ${(modelLift*100).toFixed(0)}%`}.` :
                  "EV-based grade.";
                return (
                  <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:14, padding:"10px 16px", background:`${confGradeColor}0d`, border:`1px solid ${confGradeColor}44`, borderRadius:10, flexWrap:"wrap" }}>
                    <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:11, fontWeight:800, color:confGradeColor, letterSpacing:".1em", flexShrink:0 }}>{confGrade}</div>
                    <div style={{ fontFamily:"'Azeret Mono',monospace", fontSize:11, color:"#94a3b8", flex:1 }}>{gradeReason}</div>
                    <div style={{ display:"flex", gap:8 }}>
                      {[{n:"LOCK",c:"#a855f7"},{n:"ACT",c:"#10b981"},{n:"WATCH",c:"#2563eb"},{n:"SKIP",c:"#64748b"}].map(t => (
                        <div key={t.n} style={{ width:8, height:8, borderRadius:"50%", background:t.c, opacity: confGrade.startsWith(t.n.substring(0,3)) ? 1 : 0.25 }} />
                      ))}
                    </div>
                  </div>
                );
              })()}

              {/* ── ANALYST NARRATIVE — client-side dynamic handicapper prose ── */}
              {serverCorr && (() => {
                const bd   = serverCorr.breakdown || {};
                const xfd  = bd.xgb_features_debug || {};   // XGBoost feature dict — all matchup signals
                const mc   = serverCorr.monteCarlo  || {};
                const cb   = serverCorr.confidenceBand || {};

                const isOver  = finalVerdict === "over";
                const isUnder = finalVerdict === "under";
                const side    = finalVerdict.toUpperCase();
                const statLow = pr.label.toLowerCase();
                const base    = serverCorr.base ?? proj.blended;

                // ── Matchup signals from XGBoost feature dict ──────────────
                const oppDef      = xfd.opp_def_roll10  != null ? +xfd.opp_def_roll10  : null;
                const oppPace     = xfd.opp_pace_roll10 != null ? +xfd.opp_pace_roll10 : null;
                const fg3vs       = xfd.fg3_vs_avg      != null ? +xfd.fg3_vs_avg      : null;
                const rimvs       = xfd.rim_vs_avg      != null ? +xfd.rim_vs_avg      : null;
                const inactUsg    = xfd.inactive_usg_pool            != null ? +xfd.inactive_usg_pool            : 0;
                const potAst      = xfd.l5_potential_ast             != null ? +xfd.l5_potential_ast             : null;
                const inactPotAst = xfd.inactive_potential_ast_pool  != null ? +xfd.inactive_potential_ast_pool  : 0;
                const effD        = xfd.efficiency_delta != null ? +xfd.efficiency_delta : null;
                const xpps        = xfd.xPPS_base       != null ? +xfd.xPPS_base       : null;

                // ── Player baseline stats ──────────────────────────────────
                const _getStat = obj => {
                  if (!obj) return null;
                  const keyMap = { points: ["ppg","pts"], rebounds: ["rpg","reb"], assists: ["apg","ast"],
                                   three_pointers: ["fg3m"], steals: ["spg"], blocks: ["bpg"],
                                   pra: ["pra"], pa: ["pa"], pr: ["pr"], ra: ["ra"] };
                  for (const k of (keyMap[pr.id] || ["ppg"])) { const v = obj[k]; if (v != null) return +v; }
                  return null;
                };
                const poAvg = _getStat(player?.po);
                const poGp  = +(player?.po?.gp || 0);
                const rsAvg = _getStat(player?.rs);
                const rsGp  = +(player?.rs?.gp || 0);

                // ── Series / game context ──────────────────────────────────
                const seriesRaw = g?.series || "";
                const gameTitle = g?.title  || "";
                const seriesLow = seriesRaw.toLowerCase();

                let seriesOpen = "";
                if (seriesRaw && gameTitle) {
                  if (/tied|tied \d/.test(seriesLow))
                    seriesOpen = `In a winner-take-momentum ${gameTitle} (${seriesRaw}), `;
                  else if (/leads 3/.test(seriesLow))
                    seriesOpen = `With a commanding ${seriesRaw} heading into ${gameTitle}, `;
                  else
                    seriesOpen = `Heading into ${gameTitle} (${seriesRaw}), `;
                } else if (gameTitle) {
                  seriesOpen = `In ${gameTitle}, `;
                }

                // ── Conviction opener ──────────────────────────────────────
                const absPct = Math.abs(finalEvPct);
                let convOpen;
                if (l > 0) {
                  if (isOver) {
                    if (absPct >= 5)      convOpen = `Play ${dname} OVER ${l} ${pr.label3} tonight.`;
                    else if (absPct >= 3) convOpen = `${dname} OVER ${l} ${pr.label3} is the lean here.`;
                    else                  convOpen = `There's a slim edge on ${dname} OVER ${l} ${pr.label3}.`;
                  } else if (isUnder) {
                    if (absPct >= 5)      convOpen = `Fade ${dname} UNDER ${l} ${pr.label3} tonight.`;
                    else if (absPct >= 3) convOpen = `The number looks a touch high — ${dname} UNDER ${l} ${pr.label3}.`;
                    else                  convOpen = `Slight lean toward ${dname} UNDER ${l} ${pr.label3}.`;
                  } else {
                    convOpen = `${dname} projects at ${finalProj} ${pr.label3} — nearly on the number.`;
                  }
                } else {
                  convOpen = `${dname} projects to ${finalProj} ${pr.label3} tonight — no live line posted.`;
                }

                // ── MC / CB helpers ────────────────────────────────────────
                const mcSimK = mc.n_sims ? (mc.n_sims / 1000).toFixed(0) : "10";
                const mcSide = isOver ? mc.prob_over : mc.prob_under;
                const mcPct  = mcSide != null ? (mcSide * 100).toFixed(1) : null;
                const cbRange = (cb.floor != null && cb.ceiling != null) ? +(cb.ceiling - cb.floor).toFixed(1) : null;

                // ── Build scheme/usage sentence fragments ──────────────────
                const schemeFrags = [];

                if (inactUsg > 9)
                  schemeFrags.push(`With ${inactUsg.toFixed(1)} usage points sidelined tonight, ${dname} inherits a primary workload elevation that structurally unlocks the ceiling on this ${statLow} prop. When active personnel thins this far, his true-talent floor elevates well past season-long baselines.`);
                else if (inactUsg > 4)
                  schemeFrags.push(`Teammate absences rotate roughly ${inactUsg.toFixed(1)} usage points into ${dname}'s workload — incremental, but real.`);

                if (oppDef != null) {
                  if (oppDef > 116)
                    schemeFrags.push(`Defensively, ${ot} has been one of the softest assignments in the field — surrendering ${oppDef.toFixed(1)} points per 100 possessions on a rolling basis. Opposing players have found clean, repeatable looks, and ${dname} has the toolkit to exploit it.`);
                  else if (oppDef > 112)
                    schemeFrags.push(`${ot} is a below-average defensive unit at ${oppDef.toFixed(1)} points per 100 possessions — not a sieve, but the kind of team that cedes space to skilled offensive initiators.`);
                  else if (oppDef < 107)
                    schemeFrags.push(`The defensive matchup is legitimately difficult. ${ot} grades as an elite unit at ${oppDef.toFixed(1)} points per 100 possessions — they shrink windows, force contested shots, and punish anything but the most efficient shot diet.`);
                  else if (oppDef < 110)
                    schemeFrags.push(`${ot} is a quality defensive team at ${oppDef.toFixed(1)} points per 100 possessions — they won't gift this number.`);
                }

                if (pr.id === "points") {
                  if (fg3vs != null && fg3vs > 0.025)
                    schemeFrags.push(`Their arc coverage has been exploitable — ${(fg3vs*100).toFixed(1)}pp above average in three-point attempts conceded, opening clean volume for perimeter-oriented scorers.`);
                  else if (fg3vs != null && fg3vs < -0.025)
                    schemeFrags.push(`They consistently funnel opponents off the arc (${(fg3vs*100).toFixed(1)}pp below average in 3PA rate), tightening the shot menu for outside-oriented players.`);
                  if (rimvs != null && rimvs > 0.025)
                    schemeFrags.push(`Interior defense has been a liability — opposing players convert ${(rimvs*100).toFixed(1)}pp above average at the rim. That's a real edge for anyone who can get downhill.`);
                  else if (rimvs != null && rimvs < -0.025)
                    schemeFrags.push(`Their rim protection is legitimate, holding drivers ${(Math.abs(rimvs)*100).toFixed(1)}pp below average on interior looks.`);
                }

                if (pr.id === "three_point_attempts") {
                  if (fg3vs != null && fg3vs > 0.02)
                    schemeFrags.push(`${ot} concedes three-point attempts at a generous rate — ${(fg3vs*100).toFixed(1)}pp above league average. That's a direct volume uplift for this 3PA prop.`);
                  else if (fg3vs != null && fg3vs < -0.02)
                    schemeFrags.push(`${ot} actively forces opponents off the arc (${(fg3vs*100).toFixed(1)}pp below league in 3PA rate). This is the primary headwind on this 3PA number.`);
                }

                if (pr.id === "two_point_attempts") {
                  if (rimvs != null && rimvs > 0.02)
                    schemeFrags.push(`${ot}'s interior defense has been soft — opponents convert ${(rimvs*100).toFixed(1)}pp above average at the rim, meaning more drives get rewarded and 2PA volume inflates.`);
                  else if (rimvs != null && rimvs < -0.02)
                    schemeFrags.push(`${ot} protects the paint well — ${(Math.abs(rimvs)*100).toFixed(1)}pp below average on interior FG% conceded. Fewer rewarding drives means lower 2PA volume incentive.`);
                }

                if (pr.id === "field_goal_attempts") {
                  if (fg3vs != null && fg3vs > 0.02)
                    schemeFrags.push(`${ot} gives up shots from the arc at an above-average rate (+${(fg3vs*100).toFixed(1)}pp), which expands total FGA opportunity for perimeter-heavy players.`);
                  if (rimvs != null && rimvs > 0.02)
                    schemeFrags.push(`Soft paint resistance (${(rimvs*100).toFixed(1)}pp above average on rim FG% conceded) adds further FGA volume through rewarded drives.`);
                  if ((fg3vs == null || fg3vs <= 0.02) && (rimvs == null || rimvs <= 0.02) && fg3vs != null && fg3vs < -0.02)
                    schemeFrags.push(`${ot} compresses shot selection on the arc — a headwind for FGA volume on this number.`);
                }

                if (pr.id === "field_goal_made") {
                  if (rimvs != null && rimvs > 0.02)
                    schemeFrags.push(`${ot} is leaking at the rim — opponents convert ${(rimvs*100).toFixed(1)}pp above average on interior looks. That's higher FGM output per drive, a direct volume boost on this makes number.`);
                  else if (rimvs != null && rimvs < -0.02)
                    schemeFrags.push(`${ot} holds the paint — ${(Math.abs(rimvs)*100).toFixed(1)}pp below average on rim FG% conceded. Fewer rewarded drives suppress the FGM ceiling.`);
                  if (fg3vs != null && fg3vs > 0.025)
                    schemeFrags.push(`Arc volume is also elevated (+${(fg3vs*100).toFixed(1)}pp above average in 3PA rate), adding another channel for FGM accumulation.`);
                }

                if (pr.id === "assists" || pr.id === "pa" || pr.id === "pra" || pr.id === "ra") {
                  if (potAst != null && potAst >= 4)
                    schemeFrags.push(`Passing-tracking logs ${potAst.toFixed(1)} potential assists per game — a creation workload that establishes a high-volume floor for tonight's assist projection.`);
                  if (inactPotAst > 3)
                    schemeFrags.push(`With ${inactPotAst.toFixed(1)} potential assists per game removed from the rotation, ${dname} absorbs added facilitation responsibility — a direct boost to the assist ceiling.`);
                }

                if (oppPace != null && oppPace > 99.5)
                  schemeFrags.push(`The pace environment adds to the case — ${ot} runs at ${oppPace.toFixed(1)} possessions per game, well above average, inflating counting-stat opportunity across the board.`);
                else if (oppPace != null && oppPace < 93)
                  schemeFrags.push(`Pace is a headwind. ${ot} grinds at ${oppPace.toFixed(1)} possessions per game, structurally compressing volume floors for both teams.`);

                if (effD != null && effD < -0.03)
                  schemeFrags.push(`Shot-tracking is a quiet tailwind: ${dname}'s been converting ${(Math.abs(effD)*100).toFixed(1)}pp below his expected shot-quality baseline — positive efficiency regression is in play.`);
                else if (effD != null && effD > 0.03)
                  schemeFrags.push(`Tracking introduces a mild caveat — he's finishing ${(effD*100).toFixed(1)}pp above his expected shot-quality baseline, efficiency that historically normalizes.`);

                // ── Sizing close ───────────────────────────────────────────
                let sizingClose = "";
                if (l > 0) {
                  if (absPct >= 5 && cb.trust_score >= 65)
                    sizingClose = `Full unit on the ${side}. The edge, the variance profile, and the matchup structure are all aligned.`;
                  else if (absPct >= 4 && cb.trust_score >= 55)
                    sizingClose = `Half-to-full unit ${side} — solid edge with manageable variance.`;
                  else if (absPct >= 2)
                    sizingClose = `Small unit ${side} — real edge, thin margin. Don't overweight.`;
                  else
                    sizingClose = `Thin play. If anything, small-unit ${side} or a watch.`;
                }

                return (
                  <div style={{ display: showAnalysis ? "block" : "none", marginBottom: 12, padding: "18px 20px", background: `${confGradeColor}07`, border: `1px solid ${confGradeColor}28`, borderRadius: 12 }}>
                    {/* Header */}
                    <div style={{ fontFamily: "'Azeret Mono',monospace", fontSize: 9, color: confGradeColor, letterSpacing: ".14em", marginBottom: 14, fontWeight: 700, opacity: 0.8 }}>
                      ◆ ANALYST BREAKDOWN
                    </div>

                    {/* Headline from server (still computed there) */}
                    {serverCorr.analystNarrative?.headline && (
                      <div style={{ fontSize: 11, color: confGradeColor, fontFamily: "'Azeret Mono',monospace", marginBottom: 14, fontWeight: 700, lineHeight: 1.4 }}>
                        {serverCorr.analystNarrative.headline}
                      </div>
                    )}

                    <div style={{ display: "flex", flexDirection: "column", gap: 14, fontSize: 12, color: "#cbd5e1", lineHeight: 1.75, fontFamily: "system-ui,-apple-system,sans-serif" }}>

                      {/* ── THE HANDICAP ─────────────────────────────────── */}
                      <p style={{ margin: 0 }}>
                        <strong style={{ color: "#e8f0ff", fontFamily: "'Azeret Mono',monospace", fontSize: 11 }}>The Handicap: </strong>
                        {seriesOpen}
                        {l > 0 ? <>
                          our models back{" "}
                          <strong style={{ color: finalEc }}>{dname} {side} {l} {pr.label3}</strong>
                          {" "}— projecting{" "}
                          <strong style={{ color: confGradeColor }}>{finalProj}</strong>
                          {" "}against the book number, a {Math.abs(finalEdge).toFixed(1)}-unit gap worth{" "}
                          <strong style={{ color: finalEvPct > 0 ? "#10b981" : "#ef4444" }}>
                            {finalEvPct > 0 ? "+" : ""}{finalEvPct}% in expected value
                          </strong>.
                          {base > 0 && <>{" "}The raw historical baseline sat at {base} before contextual adjustments pushed the median to its current read.</>}
                        </> : <>
                          {dname} projects to{" "}
                          <strong style={{ color: confGradeColor }}>{finalProj} {pr.label3}</strong>
                          {" "}tonight. No live line for EV calculation.
                        </>}
                      </p>

                      {/* ── USAGE & SCHEME ───────────────────────────────── */}
                      {schemeFrags.length > 0 && (
                        <p style={{ margin: 0 }}>
                          <strong style={{ color: "#e8f0ff", fontFamily: "'Azeret Mono',monospace", fontSize: 11 }}>Usage & Scheme: </strong>
                          {schemeFrags.join(" ")}
                        </p>
                      )}

                      {/* ── VARIANCE SECURITY ────────────────────────────── */}
                      <p style={{ margin: 0 }}>
                        <strong style={{ color: "#e8f0ff", fontFamily: "'Azeret Mono',monospace", fontSize: 11 }}>Variance Security: </strong>
                        {poAvg != null && poGp >= 3
                          ? <>{dname} is averaging {poAvg.toFixed(1)} {statLow} across {poGp} playoff appearances{rsAvg != null && rsGp >= 10 ? `, backed by a ${rsAvg.toFixed(1)} regular-season baseline over ${rsGp} games` : ""}. </>
                          : rsAvg != null
                          ? <>{dname}'s {rsAvg.toFixed(1)} regular-season average over {rsGp} games provides the historical anchor. </>
                          : null}
                        {mcPct != null && <>
                          Empirical evaluation across {mcSimK}K Monte Carlo simulations gives the{" "}
                          <strong style={{ color: finalEc }}>{side}</strong> a{" "}
                          <strong style={{ color: +mcPct >= 58 ? "#10b981" : "#94a3b8" }}>{mcPct}%</strong> probability
                          {mc.implied_fair_line
                            ? <>, with a model-implied fair line of <strong style={{ color: confGradeColor }}>{mc.implied_fair_line}</strong></>
                            : null}. {" "}
                        </>}
                        {cbRange != null
                          ? cbRange <= 4
                            ? <>The 68% outcome range — <strong>{cb.floor}–{cb.ceiling} {pr.label3}</strong> — is tight, insulating against dead-money floor games. </>
                            : cbRange > 7
                            ? <>Wide 68% range of <strong>{cb.floor}–{cb.ceiling} {pr.label3}</strong> — variance is real, size with discipline. </>
                            : <>The 68% range spans <strong>{cb.floor}–{cb.ceiling} {pr.label3}</strong>. </>
                          : null}
                        {cb.cv != null
                          ? cb.cv < 0.30
                            ? <>CV of {cb.cv.toFixed(3)} — elite floor compression that protects against dead-money outcomes.</>
                            : cb.cv < 0.40
                            ? <>CV of {cb.cv.toFixed(3)} reflects moderate variance — standard bankroll discipline applies.</>
                            : <>CV of {cb.cv.toFixed(3)} flags elevated volatility — small-unit territory.</>
                          : cb.trust_score != null
                          ? cb.trust_score >= 70
                            ? <>Trust score {cb.trust_score}/100 — variance is controlled.</>
                            : cb.trust_score >= 50
                            ? <>Trust score {cb.trust_score}/100 — moderate variance.</>
                            : <>Trust score {cb.trust_score}/100 — elevated volatility.</>
                          : null}
                        {sizingClose && <> {sizingClose}</>}
                      </p>
                    </div>
                  </div>
                );
              })()}

              {/* ── FULL ANALYSIS DROPDOWN — deep-dive write-up of the prop ── */}
              <button
                onClick={() => setShowAnalysis(v => !v)}
                style={{ width: "100%", padding: "12px 18px", marginBottom: showAnalysis ? 0 : 12,
                  background: showAnalysis ? `${confGradeColor}18` : `${confGradeColor}0a`,
                  border: `1px solid ${confGradeColor}55`,
                  borderRadius: showAnalysis ? "10px 10px 0 0" : 10,
                  color: confGradeColor,
                  cursor: "pointer", fontFamily: "'Azeret Mono',monospace", fontSize: 11,
                  letterSpacing: ".14em", fontWeight: 700,
                  display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  transition: "all .15s" }}>
                {showAnalysis ? "▲ HIDE ANALYSIS" : "▼ FULL PROP ANALYSIS"}
              </button>
              {showAnalysis && (() => {
                const cb = serverCorr?.confidenceBand;
                const dq = serverCorr?.dataQuality || {};
                const baseline = serverCorr?.base ?? proj.blended;
                const modelLift = baseline > 0 ? Math.abs(finalProj - baseline) / baseline : 0;
                const liftPct = (finalProj - baseline) / baseline * 100;
                const liftAligned = finalVerdict === "over" ? liftPct >= -1 : finalVerdict === "under" ? liftPct <= 1 : true;
                const liftDirection = liftPct >= 0 ? "above" : "below";
                const liftContext = liftAligned
                  ? `supports the ${finalVerdict.toUpperCase()} side`
                  : `cuts against the ${finalVerdict.toUpperCase()} side`;
                const liftTier = liftAligned
                  ? (modelLift < 0.10 ? "LOCK" : modelLift < 0.20 ? "ACT" : modelLift < 0.25 ? "WATCH" : "FAIL")
                  : (modelLift < 0.05 ? "ACT" : modelLift < 0.10 ? "WATCH" : "FAIL");
                const liftReq = liftAligned
                  ? "aligned: <25% max"
                  : "against side: <10% max";
                const bookGap = l > 0 ? Math.abs(finalProj - l) / l * 100 : 0;
                const straddles = cb && l > 0 && cb.floor <= l && cb.ceiling >= l;
                const trustLabel = !cb ? "n/a" : cb.trust_score >= 70 ? "HIGH" : cb.trust_score >= 40 ? "MODERATE" : "LOW";
                const trustColor = !cb ? "#64748b" : cb.trust_score >= 70 ? "#10b981" : cb.trust_score >= 40 ? "#f59e0b" : "#ef4444";
                const Section = ({ title, children, color = "#94a3b8" }) => (
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 9, letterSpacing: ".22em", color, marginBottom: 8, fontFamily: "'Azeret Mono',monospace", fontWeight: 700 }}>
                      {title}
                    </div>
                    <div style={{ fontSize: 12, color: "#c8d4e8", lineHeight: 1.65 }}>{children}</div>
                  </div>
                );
                const Stat = ({ k, v, hl }) => (
                  <div style={{ display: "flex", justifyContent: "space-between", padding: "5px 0", borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                    <span style={{ color: "#64748b", fontFamily: "'Azeret Mono',monospace", fontSize: 11 }}>{k}</span>
                    <span style={{ color: hl || "#e8f0ff", fontFamily: "'Azeret Mono',monospace", fontSize: 11, fontWeight: 600 }}>{v}</span>
                  </div>
                );
                const filterRows = [
                  { label: "EV Edge",       value: `${finalEvPct > 0 ? "+" : ""}${finalEvPct.toFixed(1)}%`, ok: Math.abs(finalEvPct) > 4, req: ">4%", tier: Math.abs(finalEvPct) > 10 ? "LOCK" : Math.abs(finalEvPct) > 7 ? "ACT" : Math.abs(finalEvPct) > 4 ? "WATCH" : "FAIL" },
                  { label: "L5 Variance (CV)", value: cb ? cb.cv.toFixed(3) : "n/a", ok: cb && cb.cv < 0.40, req: "<0.40 (ACT) · <0.30 (LOCK)", tier: cb ? (cb.cv < 0.30 ? "LOCK" : cb.cv < 0.40 ? "ACT" : "WATCH") : "—" },
                  { label: "Sample Size",   value: `${dq.po_gp || 0} PO games`, ok: (dq.po_gp || 0) >= 3, req: "≥3", tier: (dq.po_gp || 0) >= 3 ? "LOCK" : "FAIL" },
                  { label: "Baseline Move", value: `${liftPct >= 0 ? "+" : ""}${liftPct.toFixed(1)}%`, ok: liftTier !== "FAIL", req: liftReq, tier: liftTier },
                ];

                return (
                  <div style={{ background: `${confGradeColor}06`, border: `1px solid ${confGradeColor}55`, borderTop: 0, borderRadius: "0 0 10px 10px", padding: "20px 22px", marginBottom: 14 }}>

                    {/* — Quick Summary — */}
                    <Section title="◆ EXECUTIVE SUMMARY" color={confGradeColor}>
                      <p style={{ margin: 0 }}>
                        <strong style={{ color: "#e8f0ff" }}>{dname}</strong> ({pt}) projects to <strong style={{ color: confGradeColor }}>{finalProj} {pr.label3}</strong> tonight vs {ot},
                        compared to a book line of <strong>{l}</strong>. The model leans <strong style={{ color: finalEc }}>{finalVerdict.toUpperCase()}</strong> with a
                        <strong style={{ color: finalEvPct > 0 ? "#10b981" : "#ef4444" }}> {finalEvPct > 0 ? "+" : ""}{finalEvPct}% expected value edge</strong>.
                        Final grade: <strong style={{ color: confGradeColor }}>{confGrade}</strong>.
                        {confGrade === "LOCK" && " This is the model's highest-confidence type of play — strong edge with reliable supporting signals."}
                        {confGrade === "ACTIONABLE" && " Solid edge with acceptable trust signals — bet it, single unit."}
                        {confGrade === "WATCH" && " Edge exists but at least one trust signal is weak. Bet small or skip if you have better plays available."}
                        {confGrade === "SKIP" && " The model can't honestly support this play at high confidence. Skip."}
                      </p>
                    </Section>

                    {/* — Baseline Math — */}
                    <Section title="◆ HOW THE BASELINE WAS BUILT">
                      <Stat k="Regular Season Avg" v={`${proj.propRS} ${pr.label3} (${player.rs.gp}g)`} />
                      <Stat k="Playoff Avg"        v={`${proj.propPO} ${pr.label3} (${player.po.gp}g)`} />
                      {proj.propRecent !== null && <Stat k="L5 PO Avg" v={`${proj.propRecent} ${pr.label3}`} hl="#f59e0b" />}
                      <Stat k="Blended Baseline"   v={`${baseline} ${pr.label3}`} hl="#2563eb" />
                      {dq.use_rate_base && (
                        <p style={{ margin: "10px 0 0 0", fontSize: 11, color: "#94a3b8", fontStyle: "italic" }}>
                          ✓ Rate×Minutes baseline active — model used per-minute production rates × projected minutes (more robust than per-game averages).
                        </p>
                      )}
                    </Section>

                    {/* — Adjustment Cascade — */}
                    {serverCorr?.drivers && serverCorr.drivers.length > 0 && (
                      <Section title="◆ ADJUSTMENT CASCADE (server output)">
                        <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11.5, lineHeight: 1.65 }}>
                          {serverCorr.drivers.map((d, i) => (
                            <li key={i} style={{ color: "#c8d4e8", marginBottom: 6 }}>{d}</li>
                          ))}
                        </ul>
                        <div style={{ marginTop: 12, padding: "10px 14px", background: "rgba(37,99,235,.08)", borderRadius: 6, fontSize: 11.5 }}>
                          <span style={{ color: "#64748b" }}>Net effect: baseline </span>
                          <strong style={{ color: "#94a3b8" }}>{baseline}</strong>
                          <span style={{ color: "#64748b" }}> → corrected </span>
                          <strong style={{ color: "#2563eb" }}>{finalProj}</strong>
                          <span style={{ color: liftPct >= 0 ? "#10b981" : "#ef4444", marginLeft: 8 }}>
                            ({liftPct >= 0 ? "+" : ""}{liftPct.toFixed(1)}%)
                          </span>
                        </div>
                      </Section>
                    )}

                    {/* — Confidence Analysis — */}
                    {cb && (
                      <Section title="◆ CONFIDENCE BAND (variance from L5)">
                        <Stat k="L5 Mean"         v={`${cb.mean} ${pr.label3}`} />
                        <Stat k="Std Dev (σ)"     v={`${cb.std} ${pr.label3}`} />
                        <Stat k="Coefficient of Variation" v={cb.cv.toFixed(3)} hl={cb.cv < 0.30 ? "#10b981" : cb.cv < 0.40 ? "#f59e0b" : "#ef4444"} />
                        <Stat k="68% Probability Range" v={`${cb.floor} – ${cb.ceiling} ${pr.label3}`} />
                        <Stat k="Trust Score"     v={`${cb.trust_score}/100 — ${trustLabel}`} hl={trustColor} />
                        <Stat k="Sample Size"     v={`${cb.n} games`} />
                        {straddles && (
                          <p style={{ margin: "10px 0 0 0", padding: "10px 14px", background: "rgba(239,68,68,.10)", border: "1px solid rgba(239,68,68,.3)", borderRadius: 6, fontSize: 11.5, color: "#fca5a5" }}>
                            ⚠ <strong>Band straddles the line</strong> — book line of {l} sits inside the model's 68% probability range ({cb.floor}–{cb.ceiling}). Both outcomes are within normal variance.
                          </p>
                        )}
                      </Section>
                    )}

                    {/* — Filter Verdict — */}
                    <Section title="◆ FILTER VERDICT">
                      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
                        <thead>
                          <tr style={{ borderBottom: "1px solid rgba(255,255,255,.1)" }}>
                            <th style={{ textAlign: "left", padding: "6px 8px", color: "#64748b", fontWeight: 600 }}>FILTER</th>
                            <th style={{ textAlign: "right", padding: "6px 8px", color: "#64748b", fontWeight: 600 }}>VALUE</th>
                            <th style={{ textAlign: "right", padding: "6px 8px", color: "#64748b", fontWeight: 600 }}>REQUIRES</th>
                            <th style={{ textAlign: "right", padding: "6px 8px", color: "#64748b", fontWeight: 600 }}>TIER</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filterRows.map((f, i) => (
                            <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,.04)" }}>
                              <td style={{ padding: "6px 8px", color: "#c8d4e8", fontFamily: "'Azeret Mono',monospace" }}>{f.label}</td>
                              <td style={{ padding: "6px 8px", textAlign: "right", color: "#e8f0ff", fontFamily: "'Azeret Mono',monospace", fontWeight: 600 }}>{f.value}</td>
                              <td style={{ padding: "6px 8px", textAlign: "right", color: "#64748b", fontFamily: "'Azeret Mono',monospace", fontSize: 10 }}>{f.req}</td>
                              <td style={{ padding: "6px 8px", textAlign: "right", color: f.tier === "LOCK" ? "#a855f7" : f.tier === "ACT" ? "#10b981" : f.tier === "WATCH" ? "#2563eb" : "#ef4444", fontFamily: "'Azeret Mono',monospace", fontWeight: 700 }}>{f.tier}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      <p style={{ margin: "12px 0 0 0", fontSize: 11.5, color: "#94a3b8" }}>
                        Final tier = <strong style={{ color: confGradeColor }}>{confGrade}</strong> (edge, variance, sample, probability, quantile safety, and baseline move).
                        {bookGap > 0 && <> Book disagreement: <strong>{bookGap.toFixed(1)}%</strong>.</>}
                        <> Baseline move: <strong>{Math.abs(liftPct).toFixed(1)}% {liftDirection}</strong> baseline; it {liftContext}.</>
                      </p>
                    </Section>

                    {/* — Recommendation — */}
                    <Section title="◆ ACTION" color={confGradeColor}>
                      <div style={{ padding: "14px 18px", background: `${confGradeColor}10`, border: `1px solid ${confGradeColor}55`, borderRadius: 8 }}>
                        {confGrade === "LOCK" && (
                          <p style={{ margin: 0, fontSize: 13, color: "#e8f0ff" }}>
                            🔒 <strong>Bet hard.</strong> Strong edge ({finalEvPct > 0 ? "+" : ""}{finalEvPct}%), tight L5 variance (CV {cb?.cv?.toFixed(3) || "n/a"}), and the baseline move is controlled. This is the kind of play that drives long-term EV.
                          </p>
                        )}
                        {confGrade === "ACTIONABLE" && (
                          <p style={{ margin: 0, fontSize: 13, color: "#e8f0ff" }}>
                            ✅ <strong>Single unit.</strong> Solid edge with acceptable variance. One filter prevented LOCK — typically CV slightly above 0.30 or lift slightly above 10%. Bet at standard size.
                          </p>
                        )}
                        {confGrade === "WATCH" && (
                          <p style={{ margin: 0, fontSize: 13, color: "#e8f0ff" }}>
                            👀 <strong>Small unit or skip.</strong> Edge exists but trust signals are weak ({cb && cb.cv >= 0.40 ? `high CV ${cb.cv.toFixed(3)}` : modelLift >= 0.15 ? `projection moved ${Math.abs(liftPct).toFixed(0)}% ${liftDirection} baseline` : "mixed signals"}). Use as a flex pick or pass on it.
                          </p>
                        )}
                        {confGrade === "SKIP" && (
                          <p style={{ margin: 0, fontSize: 13, color: "#e8f0ff" }}>
                            ⛔ <strong>Don't bet.</strong> {Math.abs(finalEvPct) < 4 ? `Edge is too thin (${finalEvPct > 0 ? "+" : ""}${finalEvPct}%) — projection sits effectively on the line.` : liftTier === "FAIL" ? `Projection moved ${Math.abs(liftPct).toFixed(0)}% ${liftDirection} baseline and ${liftAligned ? "needs stronger supporting context" : "cuts against the recommended side"}.` : "Filters blocked all higher tiers."}
                          </p>
                        )}
                      </div>
                    </Section>

                    {/* — Data Quality — */}
                    <Section title="◆ DATA QUALITY (which signals fired)">
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 6, fontSize: 11 }}>
                        {[
                          ["Tracking", dq.has_tracking],
                          ["Matchup Δ", dq.has_matchup],
                          ["Scoring", dq.has_scoring],
                          ["Team Defense", dq.has_team_def],
                          ["Team Style", dq.has_team_context],
                          ["Splits H/R", dq.has_splits],
                          ["Clutch", dq.has_clutch],
                          ["Pace", dq.has_pace],
                          ["L5 Avg", dq.has_l5],
                          ["L5 Minutes", dq.has_l5_min],
                          ["L5 Game Log", dq.has_l5_games],
                          ["Rate×Min Base", dq.use_rate_base],
                          ["Rest Days", dq.has_rest],
                        ].map(([k, v]) => (
                          <div key={k} style={{ display: "flex", alignItems: "center", gap: 6, padding: "4px 8px", background: v ? "rgba(16,185,129,.08)" : "rgba(100,116,139,.05)", border: `1px solid ${v ? "rgba(16,185,129,.2)" : "rgba(100,116,139,.1)"}`, borderRadius: 4 }}>
                            <span style={{ color: v ? "#10b981" : "#475569", fontWeight: 700 }}>{v ? "✓" : "·"}</span>
                            <span style={{ color: v ? "#c8d4e8" : "#64748b", fontFamily: "'Azeret Mono',monospace", fontSize: 10 }}>{k}</span>
                          </div>
                        ))}
                      </div>
                    </Section>

                  </div>
                );
              })()}

              {/* ── SHOW CALCULATION TOGGLE ── */}
              <button
                onClick={() => setShowMath(v => !v)}
                style={{ width: "100%", padding: "11px 16px", marginBottom: showMath ? 0 : 14,
                  background: showMath ? "rgba(255,255,255,.05)" : "rgba(255,255,255,.03)",
                  border: "1px solid rgba(255,255,255,.1)",
                  borderRadius: showMath ? "8px 8px 0 0" : 8,
                  color: showMath ? "#c8d4e8" : "#64748b",
                  cursor: "pointer", fontFamily: "'Azeret Mono',monospace", fontSize: 10,
                  letterSpacing: ".12em", display: "flex", alignItems: "center", justifyContent: "center", gap: 10,
                  transition: "all .15s" }}>
                {showMath ? "▲ HIDE CALCULATION" : "▼ HOW DID WE GET HERE?"}
              </button>

              {/* ── COLLAPSIBLE CALCULATION PROCESS (chronological) ── */}
              {showMath && (
                <div style={{ border: "1px solid rgba(255,255,255,.1)", borderTop: "none", borderRadius: "0 0 8px 8px", padding: "18px 14px", marginBottom: 14, background: "rgba(0,0,0,.15)" }}>

                  {/* STEP 1 — BLENDED BASELINE */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 9, letterSpacing: ".18em", color: "#10b981", marginBottom: 10, fontFamily: "'Azeret Mono',monospace", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ background: "#10b98122", border: "1px solid #10b98144", borderRadius: 4, padding: "2px 8px" }}>STEP 1</span>
                      BLENDED BASELINE
                    </div>
                    <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                      <div style={{ background: "rgba(255,255,255,.05)", borderRadius: 6, padding: "6px 12px", fontSize: 11 }}>
                        <span style={{ color: "#64748b" }}>RS avg </span>
                        <span style={{ color: "#c8d4e8", fontWeight: 600 }}>{proj.propRS}</span>
                        <span style={{ color: "#3a4a62" }}> × {proj.propRecent !== null ? "25%" : "40%"}</span>
                      </div>
                      <span style={{ color: "#3a4a62" }}>+</span>
                      <div style={{ background: "rgba(255,255,255,.05)", borderRadius: 6, padding: "6px 12px", fontSize: 11 }}>
                        <span style={{ color: "#64748b" }}>PO avg </span>
                        <span style={{ color: "#c8d4e8", fontWeight: 600 }}>{proj.propPO}</span>
                        <span style={{ color: "#3a4a62" }}> × {proj.propRecent !== null ? "40%" : "60%"}</span>
                      </div>
                      {proj.propRecent !== null && <>
                        <span style={{ color: "#3a4a62" }}>+</span>
                        <div style={{ background: "rgba(245,158,11,.07)", border: "1px solid rgba(245,158,11,.2)", borderRadius: 6, padding: "6px 12px", fontSize: 11 }}>
                          <span style={{ color: "#64748b" }}>L5 avg </span>
                          <span style={{ color: "#f59e0b", fontWeight: 600 }}>{proj.propRecent}</span>
                          <span style={{ color: "#3a4a62" }}> × 35%</span>
                        </div>
                      </>}
                      <span style={{ color: "#3a4a62" }}>=</span>
                      <div style={{ background: "rgba(37,99,235,.1)", border: "1px solid rgba(37,99,235,.25)", borderRadius: 6, padding: "6px 14px", fontSize: 13, fontWeight: 700 }}>
                        <span style={{ color: "#2563eb" }}>{proj.blended} {pr.label3}</span>
                      </div>
                    </div>
                  </div>

                  {/* STEP 2 — CLIENT ADJUSTMENTS */}
                  <div style={{ marginBottom: 20 }}>
                    <div style={{ fontSize: 9, letterSpacing: ".18em", color: "#f59e0b", marginBottom: 10, fontFamily: "'Azeret Mono',monospace", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ background: "#f59e0b22", border: "1px solid #f59e0b44", borderRadius: 4, padding: "2px 8px" }}>STEP 2</span>
                      CLIENT ADJUSTMENTS (multiplied sequentially)
                    </div>
                    {result?.serverCorr?.breakdown?.xgb_active && (
                      <div style={{ marginBottom: 10, padding: "6px 12px", background: "rgba(37,99,235,.08)", border: "1px solid rgba(37,99,235,.2)", borderRadius: 6, fontSize: 11, color: "#64748b" }}>
                        ⚡ XGBoost active — heuristic factors below are superseded by the ML base (Step 3). Only injury cascade &amp; residual still fire.
                      </div>
                    )}
                    <div className="mr"><span className="mk">Starting point</span><span className="mv">{proj.blended} {pr.label3}</span></div>
                    {proj.gamePace && <div className="mr">
                      <span className="mk">Pace ({pt} {ptd?.rsPace} · {ot} {otd?.rsPace} → avg {proj.gamePace})</span>
                      <span className={`mv ${proj.paceAdj > 1.005 ? "pos" : proj.paceAdj < 0.995 ? "neg" : ""}`}>×{proj.paceAdj.toFixed(3)} ({proj.paceAdj > 1.001 ? "+" : ""}{((proj.paceAdj - 1) * 100).toFixed(1)}%)</span>
                    </div>}
                    {proj.defAdj !== 1.0 && <div className="mr">
                      <span className="mk">{ot} dEFF {otd?.dEFF} vs league avg {LEAGUE_AVG_dEFF}</span>
                      <span className={`mv ${proj.defAdj > 1.005 ? "pos" : proj.defAdj < 0.995 ? "neg" : ""}`}>×{proj.defAdj.toFixed(3)} ({proj.defAdj > 1.001 ? "+" : ""}{((proj.defAdj - 1) * 100).toFixed(1)}%)</span>
                    </div>}
                    {proj.homeAdj !== 1.0 && <div className="mr">
                      <span className="mk">Home/Road ({isHome ? "HOME" : "ROAD"} · {homeAwaySplits?.[pkey]?.home?.gp >= 2 && homeAwaySplits?.[pkey]?.road?.gp >= 2 ? "per-player PO splits" : "flat ±3% fallback"})</span>
                      <span className={`mv ${proj.homeAdj > 1.005 ? "pos" : proj.homeAdj < 0.995 ? "neg" : ""}`}>×{proj.homeAdj.toFixed(4)} ({proj.homeAdj > 1.001 ? "+" : ""}{((proj.homeAdj - 1) * 100).toFixed(2)}%)</span>
                    </div>}
                    {proj.restAdj !== 1.0 && <div className="mr">
                      <span className="mk">Rest days ({restDays}d)</span>
                      <span className={`mv ${proj.restAdj > 1.005 ? "pos" : proj.restAdj < 0.995 ? "neg" : ""}`}>×{proj.restAdj.toFixed(4)} ({proj.restAdj > 1.001 ? "+" : ""}{((proj.restAdj - 1) * 100).toFixed(2)}%)</span>
                    </div>}
                    {proj.onOffAdj !== 1.0 && <div className="mr">
                      <span className="mk">On/Off NETRTG ({player.onOffDelta > 0 ? "+" : ""}{player.onOffDelta})</span>
                      <span className={`mv ${proj.onOffAdj > 1.001 ? "pos" : proj.onOffAdj < 0.999 ? "neg" : ""}`}>×{proj.onOffAdj.toFixed(4)} ({proj.onOffAdj > 1.001 ? "+" : ""}{((proj.onOffAdj - 1) * 100).toFixed(2)}%)</span>
                    </div>}
                    {proj.tsAdj !== 1.0 && <div className="mr">
                      <span className="mk">TS% shift (RS {player.rs.ts}% → PO {player.po.ts}%)</span>
                      <span className={`mv ${proj.tsAdj > 1.001 ? "pos" : proj.tsAdj < 0.999 ? "neg" : ""}`}>×{proj.tsAdj.toFixed(4)} ({proj.tsAdj > 1.001 ? "+" : ""}{((proj.tsAdj - 1) * 100).toFixed(2)}%)</span>
                    </div>}
                    {proj.fg3DefAdj !== 1.0 && <div className="mr">
                      <span className="mk">{ot} 3pt defense ({teamDefense?.[ot]?.fg3VsAvg >= 0 ? "+" : ""}{teamDefense?.[ot] ? (teamDefense[ot].fg3VsAvg * 100).toFixed(1) : "?"}% vs lg avg)</span>
                      <span className={`mv ${proj.fg3DefAdj > 1.005 ? "pos" : proj.fg3DefAdj < 0.995 ? "neg" : ""}`}>×{proj.fg3DefAdj.toFixed(4)} ({proj.fg3DefAdj > 1.001 ? "+" : ""}{((proj.fg3DefAdj - 1) * 100).toFixed(2)}%)</span>
                    </div>}
                    {proj.injAdj > 1.001 && <div className="mr" style={{ background: "rgba(239,68,68,.05)", borderRadius: 4, padding: "4px 6px" }}>
                      <span className="mk" style={{ color: "#ef4444" }}>🚨 Injury usage boost — {injuryContext.outPlayers.map(p => `${dn(p.name)} OUT (${p.ppg} PPG)`).join(" · ")} → +{injuryContext.boostPPG} PPG freed</span>
                      <span className="mv pos">×{proj.injAdj.toFixed(4)} (+{((proj.injAdj - 1) * 100).toFixed(2)}%)</span>
                    </div>}
                    {proj.clutchAdj !== 1.0 && <div className="mr">
                      <span className="mk">Clutch ({clutchStats?.[pkey]?.ppg} PPG clutch vs {player.po.ppg} PO avg · {clutchStats?.[pkey]?.gp}g)</span>
                      <span className={`mv ${proj.clutchAdj > 1.001 ? "pos" : proj.clutchAdj < 0.999 ? "neg" : ""}`}>×{proj.clutchAdj.toFixed(4)} ({proj.clutchAdj > 1.001 ? "+" : ""}{((proj.clutchAdj - 1) * 100).toFixed(2)}%)</span>
                    </div>}
                    {proj.vsOppAdj !== 1.0 && <div className="mr">
                      <span className="mk">vs {ot} historical ({vsOpponentStats?.gp}g · {vsOpponentStats?.source})</span>
                      <span className={`mv ${proj.vsOppAdj > 1.001 ? "pos" : proj.vsOppAdj < 0.999 ? "neg" : ""}`}>×{proj.vsOppAdj.toFixed(4)} ({proj.vsOppAdj > 1.001 ? "+" : ""}{((proj.vsOppAdj - 1) * 100).toFixed(2)}%)</span>
                    </div>}
                    {proj.matchupDeltaAdj !== 1.0 && <div className="mr">
                      <span className="mk">Matchup Δ — {ot} L5 dEFF {matchupDelta?.[ot]?.l5_dEFF} vs season {matchupDelta?.[ot]?.season_dEFF} (Δ {matchupDelta?.[ot]?.dEFF_delta > 0 ? "+" : ""}{matchupDelta?.[ot]?.dEFF_delta})</span>
                      <span className={`mv ${proj.matchupDeltaAdj > 1.001 ? "pos" : proj.matchupDeltaAdj < 0.999 ? "neg" : ""}`}>×{proj.matchupDeltaAdj.toFixed(4)} ({proj.matchupDeltaAdj > 1.001 ? "+" : ""}{((proj.matchupDeltaAdj - 1) * 100).toFixed(2)}%)</span>
                    </div>}
                    {proj.astConvAdj !== 1.0 && <div className="mr">
                      <span className="mk">AST conversion ({trackingStats?.[pkey]?.potentialAst} pot. → {trackingStats?.[pkey]?.ast} actual · {((trackingStats?.[pkey]?.astConvRate ?? 0) * 100).toFixed(0)}% conv rate)</span>
                      <span className={`mv ${proj.astConvAdj > 1.001 ? "pos" : proj.astConvAdj < 0.999 ? "neg" : ""}`}>×{proj.astConvAdj.toFixed(4)} ({proj.astConvAdj > 1.001 ? "+" : ""}{((proj.astConvAdj - 1) * 100).toFixed(2)}%)</span>
                    </div>}
                    <div className="mr" style={{ borderTop: "1px solid rgba(245,158,11,.2)", marginTop: 6, paddingTop: 8 }}>
                      <span className="mk" style={{ color: "#f59e0b", fontWeight: 600 }}>Client result{serverCorr ? " — superseded by server" : ""}</span>
                      <span className="mv" style={{ color: serverCorr ? "#4a6090" : "#2563eb", fontWeight: 700 }}>{proj.adjustedProjection} {pr.label3}</span>
                    </div>
                    {!serverCorr && <div className="mf">
                      {proj.blended} × {proj.paceAdj.toFixed(4)} (pace){proj.defAdj !== 1.0 ? ` × ${proj.defAdj.toFixed(4)} (def)` : ""}{proj.homeAdj !== 1.0 ? ` × ${proj.homeAdj.toFixed(4)} (${isHome ? "home" : "road"})` : ""}{proj.restAdj !== 1.0 ? ` × ${proj.restAdj.toFixed(4)} (rest)` : ""}{proj.onOffAdj !== 1.0 ? ` × ${proj.onOffAdj.toFixed(4)} (on/off)` : ""}{proj.tsAdj !== 1.0 ? ` × ${proj.tsAdj.toFixed(4)} (TS%)` : ""}{proj.fg3DefAdj !== 1.0 ? ` × ${proj.fg3DefAdj.toFixed(4)} (3pt def)` : ""}{proj.injAdj > 1.001 ? ` × ${proj.injAdj.toFixed(4)} (inj boost)` : ""}{proj.clutchAdj !== 1.0 ? ` × ${proj.clutchAdj.toFixed(4)} (clutch)` : ""}{proj.vsOppAdj !== 1.0 ? ` × ${proj.vsOppAdj.toFixed(4)} (vs opp)` : ""}{proj.matchupDeltaAdj !== 1.0 ? ` × ${proj.matchupDeltaAdj.toFixed(4)} (matchup Δ)` : ""}{proj.astConvAdj !== 1.0 ? ` × ${proj.astConvAdj.toFixed(4)} (ast conv)` : ""} = {proj.adjustedProjection}
                    </div>}
                  </div>

                  {/* STEP 3 — SERVER 14-FACTOR CORRELATION */}
                  {serverCorr && (
                    <div style={{ marginBottom: 20 }}>
                      <div style={{ fontSize: 9, letterSpacing: ".18em", color: "#a855f7", marginBottom: 10, fontFamily: "'Azeret Mono',monospace", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <span style={{ background: "#a855f722", border: "1px solid #a855f744", borderRadius: 4, padding: "2px 8px" }}>STEP 3</span>
                        SERVER 14-FACTOR CORRELATION
                        {serverCorr.breakdown?.residualN > 0 && <span style={{ color: "#10b981" }}>● CALIBRATED ({serverCorr.breakdown.residualN} samples)</span>}
                      </div>
                      {serverCorr.breakdown && (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "3px 16px", fontSize: 10, padding: "10px 12px", background: "rgba(168,85,247,.04)", border: "1px solid rgba(168,85,247,.12)", borderRadius: 8, marginBottom: 10, fontFamily: "'Azeret Mono',monospace" }}>
                          {[
                            ["Matchup Δ",    serverCorr.breakdown.matchupAdj,       "%"],
                            ["Shot Profile", serverCorr.breakdown.shotProfileAdj,   "pts"],
                            ["Pace",         serverCorr.breakdown.paceAdj,          "%"],
                            ["Home/Road",    serverCorr.breakdown.splitsAdj,        "%"],
                            ["Def Tier",     serverCorr.breakdown.defMatchAdj,      "%"],
                            ["AST Conv",     serverCorr.breakdown.astConvAdj,       "pts"],
                            ["Reb Realize",  serverCorr.breakdown.hustleAdj,        "reb"],
                            ["Rest",         serverCorr.breakdown.restAdj,          "%"],
                            ["Clutch",       serverCorr.breakdown.clutchAdj,        "pts"],
                            ["Usage×TS%",    serverCorr.breakdown.usageAdj,         "%"],
                            ["PO Form",      serverCorr.breakdown.playoffFormAdj,   "%"],
                            ["Inj Cascade",  serverCorr.breakdown.injCascadeAdj,    "%"],
                            ["Residual Cal", serverCorr.breakdown.residualCalibAdj, "%"],
                          ].filter(([, val]) => val !== 0 && val !== null && val !== undefined).map(([label, val, unit]) => (
                            <span key={label} style={{ color: val > 0 ? "#10b981" : "#ef4444" }}>
                              {label}: {val > 0 ? "+" : ""}{typeof val === "number" ? val.toFixed(unit === "pts" || unit === "reb" ? 2 : 1) : val}{unit}
                            </span>
                          ))}
                        </div>
                      )}
                      {serverCorr.drivers?.length > 0 && (
                        <div style={{ marginBottom: 8 }}>
                          {serverCorr.drivers.map((d, i) => (
                            <div key={i} style={{ fontSize: 9.5, color:
                              d.includes("COLD") || d.includes("MISMATCH") || d.includes("Uncertainty") ? "#ef4444"
                              : d.includes("HOT") || d.includes("BOOST") || d.includes("Cascade") || d.includes("Residual") || d.includes("ABOVE") ? "#10b981"
                              : "#64748b",
                              marginBottom: 4, lineHeight: 1.5 }}>
                              › {d}
                            </div>
                          ))}
                        </div>
                      )}
                      <div className="mr" style={{ borderTop: "1px solid rgba(168,85,247,.2)", marginTop: 6, paddingTop: 8 }}>
                        <span className="mk" style={{ color: "#a855f7", fontWeight: 600 }}>Server output ← FINAL</span>
                        <span className="mv" style={{ color: "#2563eb", fontWeight: 700 }}>{finalProj} {pr.label3}</span>
                      </div>
                    </div>
                  )}

                  {/* STEP 4 — EV ANALYSIS */}
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 9, letterSpacing: ".18em", color: "#64748b", marginBottom: 10, fontFamily: "'Azeret Mono',monospace", display: "flex", alignItems: "center", gap: 8 }}>
                      <span style={{ background: "rgba(255,255,255,.06)", border: "1px solid rgba(255,255,255,.12)", borderRadius: 4, padding: "2px 8px" }}>STEP 4</span>
                      EXPECTED VALUE ANALYSIS
                    </div>
                    <div className="mr">
                      <span className="mk">Final projection vs book line</span>
                      <span className={`mv ${finalEdge > 0 ? "pos" : finalEdge < 0 ? "neg" : ""}`}>{finalEdge > 0 ? "+" : ""}{finalEdge} {pr.label3} ({finalVerdict.toUpperCase()})</span>
                    </div>
                    <div className="mr">
                      <span className="mk" style={{ fontWeight: 600 }}>EV edge vs line</span>
                      <span className={`mv ${finalEvPct > 0 ? "pos" : finalEvPct < 0 ? "neg" : ""}`} style={{ fontSize: 18, fontWeight: 800 }}>{finalEvPct > 0 ? "+" : ""}{finalEvPct}%</span>
                    </div>
                    <div className="mr">
                      <span className="mk">Final vs RS avg ({proj.propRS})</span>
                      <span className={`mv ${finalProj > proj.propRS ? "pos" : finalProj < proj.propRS ? "neg" : ""}`}>{proj.propRS > 0 ? (((finalProj - proj.propRS) / proj.propRS) * 100).toFixed(2) : 0}% shift</span>
                    </div>
                    <div className="mr">
                      <span className="mk">Final vs PO avg ({proj.propPO})</span>
                      <span className={`mv ${finalProj > proj.propPO ? "pos" : finalProj < proj.propPO ? "neg" : ""}`}>{proj.propPO > 0 ? (((finalProj - proj.propPO) / proj.propPO) * 100).toFixed(2) : 0}% shift</span>
                    </div>
                    <div className="mr" style={{ borderTop: "1px solid rgba(37,99,235,.1)", marginTop: 4, paddingTop: 6 }}>
                      <span className="mk">Total lift vs blended baseline ({proj.blended})</span>
                      <span className={`mv ${finalProj > proj.blended ? "pos" : finalProj < proj.blended ? "neg" : ""}`}>{proj.blended > 0 ? (((finalProj - proj.blended) / proj.blended) * 100).toFixed(2) : 0}% ({finalProj > proj.blended ? "+" : ""}{+(finalProj - proj.blended).toFixed(2)})</span>
                    </div>
                  </div>

                  {/* Context grid */}
                  <div className="div" />
                  <div className="cg">
                    <div className="cc"><div className="ccl">{pt} RS Pace</div><div className="ccv">{ptd?.rsPace}</div><div className="ccs">NBA.COM · 82 RS GAMES</div></div>
                    <div className="cc"><div className="ccl">{ot} RS Pace</div><div className="ccv">{otd?.rsPace}</div><div className="ccs">NBA.COM · 82 RS GAMES</div></div>
                    <div className="cc"><div className="ccl">{pt} Net Eff</div><div className="ccv" style={{ color: ptd?.eDIFF > 0 ? "#10b981" : "#ef4444" }}>{ptd?.eDIFF > 0 ? "+" : ""}{ptd?.eDIFF}</div><div className="ccs">oEFF {ptd?.oEFF} · dEFF {ptd?.dEFF}</div></div>
                    <div className="cc"><div className="ccl">{ot} Def Eff</div><div className="ccv">{otd?.dEFF}</div><div className="ccs">Lg avg {LEAGUE_AVG_dEFF} · {otd?.dEFF < LEAGUE_AVG_dEFF ? "stronger" : "weaker"} than avg</div></div>
                    <div className="cc"><div className="ccl">Home/Road</div><div className="ccv" style={{ color: isHome ? "#10b981" : "#f59e0b" }}>{isHome ? "🏠 HOME" : "✈ ROAD"}</div><div className="ccs">SPORTRADAR · {isHome ? "+3.16%" : "-3.06%"} adj{["points","pra","pa","pr"].includes(pr.id) ? "" : " (N/A)"}</div></div>
                    <div className="cc"><div className="ccl">Rest Days</div><div className="ccv">{restDays !== null ? restDays + "d" : "—"}</div><div className="ccs">SPORTRADAR · {restDays === 2 ? "+1.5% adj" : restDays >= 3 ? "+2.0% adj" : "baseline"}</div></div>
                  </div>

                  {(ownStyle.offEFG != null || oppStyle.oppEFG != null) && (
                    <div className="cg" style={{ marginTop: 8 }}>
                      <div className="cc"><div className="ccl">{pt} Shot Quality</div><div className="ccv">{fmtPct(ownStyle.offEFG)}</div><div className="ccs">NBA.COM FOUR FACTORS eFG</div></div>
                      <div className="cc"><div className="ccl">{ot} Shot Suppression</div><div className="ccv">{fmtPct(oppStyle.oppEFG)}</div><div className="ccs">OPPONENT eFG ALLOWED</div></div>
                      <div className="cc"><div className="ccl">{ot} Ball Pressure</div><div className="ccv">{fmtPct(oppStyle.oppTovPct)}</div><div className="ccs">OPPONENT TOV FORCED RATE</div></div>
                      <div className="cc"><div className="ccl">{ot} Glass Control</div><div className="ccv">{fmtPct(oppStyle.drebPct)}</div><div className="ccs">DEFENSIVE REBOUND RATE</div></div>
                    </div>
                  )}

                  {/* Player profile */}
                  <div className="mb" style={{ marginTop: 10 }}>
                    <div className="mbt">PLAYER PROFILE — VERIFIED DB + NBA.COM</div>
                    <div className="mr"><span className="mk">RS FG% / 3P% / FT%</span><span className="mv">{player.rs.fg}% / {player.rs.fg3}% / {player.rs.ft}%</span></div>
                    <div className="mr"><span className="mk">PO FG% / 3P% / FT%</span><span className="mv">{player.po.fg}% / {player.po.fg3}% / {player.po.ft}%</span></div>
                    {player.rs.usg && <div className="mr"><span className="mk">RS Usage% / TS%</span><span className="mv">{player.rs.usg}% / {player.rs.ts}%<span style={{ fontFamily: "Azeret Mono,monospace", fontSize: 9, color: "#3a4a62", marginLeft: 6 }}>NBA.COM</span></span></div>}
                    {player.po.usg && <div className="mr"><span className="mk">PO Usage% / TS%</span><span className={`mv ${player.po.ts && player.rs.ts && player.po.ts > player.rs.ts ? "pos" : player.po.ts && player.rs.ts && player.po.ts < player.rs.ts ? "neg" : ""}`}>{player.po.usg}% / {player.po.ts}%<span style={{ fontFamily: "Azeret Mono,monospace", fontSize: 9, color: "#3a4a62", marginLeft: 6 }}>NBA.COM</span></span></div>}
                    {player.onOffDelta !== null && player.onOffDelta !== undefined && <div className="mr"><span className="mk">On/Off NETRTG delta</span><span className={`mv ${player.onOffDelta > 0 ? "pos" : player.onOffDelta < 0 ? "neg" : ""}`}>{player.onOffDelta > 0 ? "+" : ""}{player.onOffDelta}<span style={{ fontFamily: "Azeret Mono,monospace", fontSize: 9, color: "#3a4a62", marginLeft: 6 }}>NBA.COM ON/OFF</span></span></div>}
                    <div className="mr"><span className="mk">PO min/game</span><span className="mv">{player.po.min} ({player.po.gp}g)</span></div>
                    {scoringBreakdown?.[pkey] && <div className="mr"><span className="mk">PO scoring mix (pts from 3 / paint / FT / midrange)</span><span className="mv">{scoringBreakdown[pkey].pctPts3pt}% / {scoringBreakdown[pkey].pctPtsPaint}% / {scoringBreakdown[pkey].pctPtsFt}% / {scoringBreakdown[pkey].pctPtsMr}%{scoringBreakdown[pkey].pctFga3pt != null ? ` / ${scoringBreakdown[pkey].pctFga3pt}% 3PA rate` : ""}<span style={{ fontFamily: "Azeret Mono,monospace", fontSize: 9, color: "#3a4a62", marginLeft: 6 }}>NBA.COM SCORING</span></span></div>}
                    {clutchStats?.[pkey]?.gp >= 2 && <div className="mr"><span className="mk">PO clutch (last 5min ±5pts) — {clutchStats[pkey].gp}g</span><span className={`mv ${clutchStats[pkey].ppg > player.po.ppg ? "pos" : clutchStats[pkey].ppg < player.po.ppg ? "neg" : ""}`}>{clutchStats[pkey].ppg} PPG · {clutchStats[pkey].rpg} RPG · {clutchStats[pkey].apg} APG · {clutchStats[pkey].pm > 0 ? "+" : ""}{clutchStats[pkey].pm} PM<span style={{ fontFamily: "Azeret Mono,monospace", fontSize: 9, color: "#3a4a62", marginLeft: 6 }}>NBA.COM CLUTCH</span></span></div>}
                    {hustleStats?.[pkey] && (pr.id === "rebounds" || pr.id === "pra") && <div className="mr"><span className="mk">PO hustle — def box-outs / off box-outs / box-out rebs</span><span className="mv">{hustleStats[pkey].defBoxouts} / {hustleStats[pkey].offBoxouts} / {hustleStats[pkey].boxoutRebounds} per game<span style={{ fontFamily: "Azeret Mono,monospace", fontSize: 9, color: "#3a4a62", marginLeft: 6 }}>NBA.COM HUSTLE</span></span></div>}
                    {hustleStats?.[pkey] && (pr.id === "steals") && <div className="mr"><span className="mk">PO hustle — deflections / charges drawn / contested shots</span><span className="mv">{hustleStats[pkey].deflections} / {hustleStats[pkey].chargesDrawn} / {hustleStats[pkey].contestedShots} per game<span style={{ fontFamily: "Azeret Mono,monospace", fontSize: 9, color: "#3a4a62", marginLeft: 6 }}>NBA.COM HUSTLE</span></span></div>}
                    {hustleStats?.[pkey] && pr.id === "three_pointers" && <div className="mr"><span className="mk">PO contested 3pt shots</span><span className="mv">{hustleStats[pkey].contested3pt} contested 3PA/g<span style={{ fontFamily: "Azeret Mono,monospace", fontSize: 9, color: "#3a4a62", marginLeft: 6 }}>NBA.COM HUSTLE</span></span></div>}
                    {trackingStats?.[pkey] && (pr.id === "assists" || pr.id === "pra" || pr.id === "pa") && trackingStats[pkey].gp >= 3 && <div className="mr">
                      <span className="mk">PO passing — potential ast / actual ast / conv rate</span>
                      <span className={`mv ${proj.astConvAdj < 0.999 ? "neg" : proj.astConvAdj > 1.001 ? "pos" : ""}`}>
                        {trackingStats[pkey].potentialAst} pot. → {trackingStats[pkey].ast} ast ({((trackingStats[pkey].astConvRate ?? 0)*100).toFixed(0)}% conv · lg avg 30%)
                        <span style={{ fontFamily: "Azeret Mono,monospace", fontSize: 9, color: "#3a4a62", marginLeft: 6 }}>NBA.COM TRACKING</span>
                      </span>
                    </div>}
                    {trackingStats?.[pkey] && (pr.id === "rebounds" || pr.id === "pra") && trackingStats[pkey].gp >= 3 && <div className="mr">
                      <span className="mk">PO rebound chances — oreb / dreb / secured %</span>
                      <span className="mv">
                        {trackingStats[pkey].orebChance} / {trackingStats[pkey].drebChance} → {trackingStats[pkey].rebChancePct}% of chances secured
                        <span style={{ fontFamily: "Azeret Mono,monospace", fontSize: 9, color: "#3a4a62", marginLeft: 6 }}>NBA.COM TRACKING</span>
                      </span>
                    </div>}
                    {matchupDelta?.[ot] && <div className="mr">
                      <span className="mk">{ot} L5 dEFF vs season dEFF</span>
                      <span className={`mv ${matchupDelta[ot].dEFF_delta > 0.5 ? "pos" : matchupDelta[ot].dEFF_delta < -0.5 ? "neg" : ""}`}>
                        L5: {matchupDelta[ot].l5_dEFF} vs season: {matchupDelta[ot].season_dEFF} (Δ {matchupDelta[ot].dEFF_delta > 0 ? "+" : ""}{matchupDelta[ot].dEFF_delta})
                        <span style={{ fontFamily: "Azeret Mono,monospace", fontSize: 9, color: "#3a4a62", marginLeft: 6 }}>NBA.COM L5</span>
                      </span>
                    </div>}
                    {pr.id === "pra" && <div className="mr"><span className="mk">PO PRA total</span><span className="mv acc">{(player.po.ppg + player.po.rpg + player.po.apg).toFixed(1)}</span></div>}
                    {pr.id === "pa" && <div className="mr"><span className="mk">PO P+A total</span><span className="mv acc">{(player.po.ppg + player.po.apg).toFixed(1)}</span></div>}
                    {pr.id === "pr" && <div className="mr"><span className="mk">PO P+R total</span><span className="mv acc">{(player.po.ppg + player.po.rpg).toFixed(1)}</span></div>}
                  </div>

                </div>
              )}

              <div className="dn">
                ALL STATS LIVE FROM NBA.COM VIA NBA_API ·
                Player RS/PO base + advanced: LeagueDashPlayerStats · Home/Road PO splits: location_nullable · Shot profile: Scoring measure ·
                Clutch PO: LeagueDashPlayerClutch · Hustle PO: LeagueHustleStatsPlayer · Team zone defense: LeagueDashPtTeamDefend ·
                Team pace+efficiency: LeagueDashTeamStats · vs-opponent + L5: PlayerGameLog ·
                Passing/Assists/Rebound tracking: LeagueDashPtStats (Passing + Rebounding) · Rolling matchup dEFF: LeagueDashTeamStats last_n_games=5 ·
                ENGINE v3: PO×0.6+RS×0.4 (or +L5×0.35) × Pace × Zone-weighted Defense × Matchup Delta (L5) × Home/Road × Rest × On/Off × TS% × 3pt Defense × Clutch × vs-Opponent × AST Conversion Regression
              </div>
            </div>
          );
        })()}
      </div>
    </>
  );
}
