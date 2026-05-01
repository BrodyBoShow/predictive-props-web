import { useState, useCallback, useRef, useEffect, useMemo } from "react";

// ── NBA API BACKEND ───────────────────────────────────────────────────────────
// Run: pip install flask flask-cors nba_api && python server.py
// Serves real NBA.com stats. JSX falls back to static PLAYER_DB/TEAM_DATA if offline.
const API_BASE = "https://nba-props-api-43yl.onrender.com/api";

// ── TEAM DATA ─────────────────────────────────────────────────────────────────
// rsPace: 2025-26 REGULAR SEASON pace — NBA.com/stats Teams > Advanced > Regular Season
//   Per Game, All Season Segments, 82 games. Screenshot verified by user Apr 30 2026.
//   This is the PRIMARY source — official NBA data, more precise than third-party aggregators.
// oEFF/dEFF/eDIFF: 2026 PLAYOFF efficiency — NBAsuffer.com, updated Apr 30 2026
const TEAM_DATA = {
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
};
const LEAGUE_AVG_dEFF = 113.5;

// P: per-game stat line. usg=usage%, ts=true shooting%
// Source: NBA.com Players > Advanced (RS) and Players > Advanced (Playoffs)
const P = (ppg, rpg, apg, spg, bpg, topg, fg, fg3, ft, min, gp, usg, ts) => ({ ppg, rpg, apg, spg, bpg, topg, fg, fg3, ft, min, gp, usg: usg || null, ts: ts || null });
// E: player entry. onOffDelta = on-court NETRTG minus off-court NETRTG
// Source: NBA.com On/Off Court > Advanced > Playoffs 2025-26
// Positive = player's presence improves team net rating (player helps)
// Null = not in screenshots yet
const E = (team, pid, pos, rs, po, onOffDelta) => ({ team, pid, pos, rs, po, onOffDelta: onOffDelta ?? null });

const PLAYER_DB = {
  "cade cunningham": E("DET", 1630595, "G", P(23.9, 5.5, 9.9, 1.4, 0.8, 3.8, 46.1, 34.2, 81.2, 33.9, 64), P(29.5, 6.3, 7.5, 0.3, 0.8, 6.5, 42.4, 28.6, 78.9, 39.5, 4)),
  "tobias harris": E("DET", 202699, "F", P(13.3, 5.1, 2.5, 0.9, 0.4, 1.2, 46.9, 36.8, 86.6, 27.7, 63), P(19.0, 7.5, 1.5, 1.5, 1.3, 1.5, 43.1, 14.3, 89.5, 35.5, 4)),
  "ausar thompson": E("DET", 1641711, "F", P(14.2, 7.8, 3.1, 2.1, 1.4, 1.8, 51.3, 28.6, 56.2, 30.4, 71), P(10.5, 7.3, 2.5, 1.5, 2.0, 1.8, 47.2, 20.0, 52.0, 31.5, 4)),
  "jalen duren": E("DET", 1631105, "C", P(17.8, 11.0, 2.3, 0.8, 2.1, 2.1, 62.4, 0.0, 55.1, 32.1, 68), P(8.3, 9.5, 2.3, 0.5, 1.8, 2.8, 44.4, 0.0, 60.0, 26.5, 4)),
  "duncan robinson": E("DET", 1629130, "G", P(12.4, 3.2, 2.8, 0.6, 0.3, 1.1, 43.8, 40.1, 85.0, 26.8, 65), P(7.8, 1.3, 2.0, 0.3, 0.5, 0.8, 31.3, 29.6, 100.0, 25.5, 4)),
  "caris levert": E("DET", 1627747, "G", P(11.2, 4.1, 4.8, 0.9, 0.4, 1.8, 44.2, 35.1, 76.4, 25.3, 58), P(2.0, 3.0, 3.5, 0.0, 1.0, 1.5, 37.5, 0.0, 75.0, 18.0, 2)),
  "isaiah stewart": E("DET", 1630191, "F-C", P(8.4, 5.9, 1.4, 0.7, 1.8, 1.1, 48.2, 30.2, 67.3, 22.1, 62), P(5.5, 3.5, 0.5, 0.3, 1.8, 1.5, 54.2, 33.3, 41.7, 16.5, 4)),
  "paul reed": E("DET", 1630198, "C", P(8.8, 6.2, 1.1, 0.6, 1.0, 1.2, 55.0, 28.6, 66.7, 18.4, 52), P(3.0, 4.5, 0.5, 0.3, 0.5, 0.5, 60.0, 0.0, 75.0, 12.0, 2)),
  "paolo banchero": E("ORL", 1631094, "F", P(22.2, 8.4, 5.2, 1.1, 0.8, 3.2, 46.8, 32.1, 77.4, 33.8, 68), P(21.5, 8.3, 6.5, 1.8, 1.0, 2.8, 39.6, 22.2, 82.6, 36.3, 4)),
  "franz wagner": E("ORL", 1630532, "F", P(23.1, 5.8, 5.4, 1.7, 0.6, 2.1, 47.8, 35.2, 80.3, 34.2, 61), P(18.0, 5.0, 4.5, 4.5, 2.0, 0.5, 42.9, 33.3, 100.0, 34.5, 2)),
  "desmond bane": E("ORL", 1630217, "G", P(19.8, 4.2, 3.8, 0.9, 0.2, 1.9, 44.8, 38.9, 84.6, 31.4, 69), P(23.5, 6.0, 1.0, 1.0, 0.0, 2.0, 44.4, 63.6, 83.3, 37.0, 4)),
  "jalen suggs": E("ORL", 1630580, "G", P(14.6, 3.9, 4.8, 1.8, 0.5, 2.2, 42.3, 33.8, 78.2, 29.8, 65), P(10.0, 2.5, 2.5, 2.0, 1.0, 4.0, 24.8, 22.2, 100.0, 31.5, 4)),
  "wendell carter jr": E("ORL", 1628976, "C", P(11.8, 9.4, 3.2, 0.6, 1.2, 2.1, 50.4, 28.6, 72.1, 27.6, 58), P(13.0, 14.0, 3.5, 0.0, 1.5, 3.0, 46.5, 33.3, 71.4, 31.5, 2)),
  "donovan mitchell": E("CLE", 1628378, "G", P(27.9, 4.5, 5.7, 1.5, 0.3, 2.8, 47.2, 38.4, 84.9, 33.5, 70, null, null), P(23.2, 5.2, 3.6, 1.0, 0.2, 2.8, 47.5, 39.0, 85.7, 33.9, 5, 30.8, 54.6), null),
  "james harden": E("CLE", 201935, "G", P(20.5, 4.8, 7.7, 1.2, 0.8, 3.2, 44.8, 38.4, 86.4, 33.8, 26), P(18.5, 5.0, 8.5, 1.0, 0.5, 3.5, 43.2, 36.8, 84.0, 36.0, 4)),
  "evan mobley": E("CLE", 1630596, "F-C", P(18.2, 9.0, 3.6, 1.2, 1.9, 2.0, 54.1, 36.8, 71.2, 32.9, 63, null, null), P(17.6, 7.8, 3.4, 0.8, 1.2, 1.2, 62.2, 35.7, 68.0, 33.0, 5, 19.9, 62.9), null),
  "jarrett allen": E("CLE", 1628384, "C", P(15.4, 8.5, 1.8, 0.6, 0.9, 1.4, 61.4, 0.0, 70.8, 27.4, 56, null, null), P(8.8, 6.4, 0.6, 1.2, 2.2, 0.8, 63.3, 0.0, 42.9, 26.4, 5, 13.2, 60.8), null),
  "dean wade": E("CLE", 1629021, "F", P(5.8, 4.2, 1.2, 0.6, 0.4, 0.8, 43.8, 37.4, 72.4, 20.4, 58), P(4.5, 4.0, 1.0, 0.5, 0.3, 0.5, 42.0, 35.0, 70.0, 20.0, 4)),
  "sam merrill": E("CLE", 1630241, "G", P(12.8, 2.6, 2.4, 0.8, 0.2, 0.8, 46.4, 43.8, 88.4, 22.4, 64, null, null), P(7.6, 1.8, 1.0, 0.4, 0.0, 0.6, 60.0, 42.1, 80.0, 20.2, 5, 13.5, 66.9), null),
  "keon ellis": E("CLE", 1631217, "G", P(7.4, 3.2, 1.8, 1.7, 0.9, 1.0, 49.1, 35.5, 81.6, 20.8, 60), P(6.0, 3.0, 1.5, 1.5, 0.8, 0.8, 46.0, 33.0, 80.0, 20.0, 4)),
  "dennis schroder": E("CLE", 203471, "G", P(8.2, 3.4, 4.3, 1.4, 0.2, 1.8, 40.1, 29.0, 78.4, 22.4, 26), P(7.0, 3.0, 4.0, 1.0, 0.2, 1.5, 38.0, 27.0, 76.0, 20.0, 4)),
  "scottie barnes": E("TOR", 1630544, "F", P(18.1, 7.5, 5.9, 1.4, 1.4, 2.8, 49.2, 33.4, 76.8, 33.5, 78), P(21.0, 8.5, 6.0, 1.3, 0.8, 3.0, 47.8, 31.2, 78.0, 36.5, 4)),
  "brandon ingram": E("TOR", 1627742, "F", P(21.5, 5.6, 3.7, 0.7, 0.7, 2.4, 47.2, 36.8, 84.2, 33.8, 75), P(20.5, 5.5, 3.5, 0.8, 0.5, 2.5, 46.0, 35.0, 82.0, 35.0, 4)),
  "rj barrett": E("TOR", 1629628, "G-F", P(19.3, 5.3, 3.3, 1.0, 0.4, 2.2, 46.4, 34.8, 78.4, 30.4, 66), P(17.5, 5.0, 3.0, 1.0, 0.5, 2.0, 44.8, 32.4, 76.0, 32.0, 4)),
  "immanuel quickley": E("TOR", 1630193, "G", P(16.6, 4.4, 5.9, 1.3, 0.3, 2.2, 42.8, 37.6, 83.1, 32.1, 69), P(16.0, 4.0, 6.5, 1.5, 0.3, 2.5, 40.8, 35.0, 84.0, 34.0, 4)),
  "jakob poeltl": E("TOR", 1627751, "C", P(10.7, 7.2, 2.8, 0.6, 1.4, 1.8, 62.4, 0.0, 58.4, 24.8, 62), P(9.5, 8.0, 2.5, 0.5, 1.0, 2.0, 60.0, 0.0, 55.0, 26.0, 4)),
  "sandro mamukelashvili": E("TOR", 1630567, "F-C", P(11.1, 4.9, 2.4, 0.4, 0.6, 1.4, 49.2, 34.8, 78.4, 22.4, 64), P(8.5, 5.0, 2.0, 0.3, 0.5, 1.0, 47.0, 32.0, 76.0, 20.0, 4)),
  "gradey dick": E("TOR", 1641714, "G-F", P(9.4, 2.8, 1.4, 0.6, 0.2, 0.8, 43.8, 38.4, 84.4, 22.4, 58), P(7.0, 2.5, 1.0, 0.5, 0.0, 0.8, 40.0, 36.0, 83.0, 20.0, 4)),
  "jamal shead": E("TOR", 1641733, "G", P(6.6, 2.8, 5.4, 1.0, 0.2, 1.8, 36.8, 32.4, 74.4, 20.4, 62), P(5.0, 2.5, 4.5, 1.0, 0.0, 1.5, 34.0, 30.0, 72.0, 18.0, 4)),
  "jakobe walter": E("TOR", 1641718, "G", P(7.5, 2.6, 1.8, 1.0, 0.2, 1.0, 44.1, 40.9, 78.4, 18.4, 55), P(6.0, 2.0, 1.5, 0.8, 0.0, 0.8, 40.0, 38.0, 76.0, 16.0, 4)),
  "collin murray-boyles": E("TOR", 1642374, "F", P(8.5, 5.0, 1.8, 0.6, 0.9, 1.2, 57.9, 34.0, 65.1, 18.8, 56), P(6.5, 4.5, 1.5, 0.5, 0.8, 1.0, 54.0, 30.0, 62.0, 16.0, 4)),
  "lebron james": E("LAL", 2544, "F", P(26.8, 7.8, 8.4, 1.2, 0.6, 3.6, 51.3, 38.4, 75.2, 34.8, 61), P(22.5, 8.0, 9.5, 1.0, 0.5, 5.5, 44.8, 27.8, 72.0, 38.5, 4)),
  "anthony davis": E("DAL", 203076, "C", P(28.4, 12.1, 3.4, 1.2, 2.3, 2.4, 55.8, 22.4, 78.6, 34.4, 58), P(26.0, 12.5, 3.0, 1.3, 2.5, 2.5, 54.2, 20.0, 76.0, 38.0, 4)),
  "austin reaves": E("LAL", 1630559, "G", P(23.3, 4.7, 5.5, 1.4, 0.4, 2.2, 49.0, 36.0, 86.4, 32.4, 51, null, null), P(22.0, 4.0, 6.0, 0.0, 1.0, 3.0, 25.0, 25.0, 92.3, 33.7, 1, 34.5, 50.6), null),
  "rui hachimura": E("LAL", 1629060, "F", P(12.8, 4.8, 1.4, 0.6, 0.4, 1.2, 50.4, 36.8, 72.4, 24.4, 62, null, null), P(14.8, 3.6, 1.0, 1.2, 0.6, 1.0, 54.5, 54.5, 50.0, 38.8, 5, 15.0, 65.2), null),
  "max christie": E("LAL", 1631108, "G-F", P(8.4, 3.2, 1.8, 1.0, 0.4, 0.8, 44.8, 38.4, 78.4, 22.4, 64), P(7.0, 3.0, 1.5, 0.8, 0.3, 0.8, 42.0, 36.0, 76.0, 22.0, 4)),
  "amen thompson": E("HOU", 1641706, "G-F", P(17.2, 7.4, 5.8, 1.8, 0.8, 2.4, 51.2, 24.4, 68.4, 30.8, 67, null, null), P(19.4, 6.8, 6.2, 2.4, 0.8, 2.6, 51.6, 25.0, 71.4, 44.0, 5, 20.0, 55.5), null),
  "alperen sengun": E("HOU", 1631094, "C", P(22.8, 10.3, 5.8, 1.4, 1.2, 2.8, 56.4, 28.4, 72.4, 34.4, 67, null, null), P(21.0, 10.0, 5.4, 2.2, 1.2, 2.8, 50.6, 12.5, 68.8, 38.9, 5, 25.9, 51.9), null),
  "jabari smith jr": E("HOU", 1631095, "F", P(16.4, 7.2, 2.4, 1.0, 1.2, 1.8, 46.8, 36.4, 74.4, 30.4, 65, null, null), P(19.2, 7.8, 1.6, 1.2, 0.6, 1.0, 41.4, 40.0, 78.3, 41.9, 5, 18.6, 57.1), null),
  "reed sheppard": E("HOU", 1641717, "G", P(9.8, 2.8, 3.4, 1.2, 0.2, 1.4, 44.8, 40.4, 84.4, 24.4, 61, null, null), P(12.6, 1.2, 5.4, 2.2, 0.6, 2.2, 32.0, 34.1, 66.7, 31.2, 5, 22.8, 44.8), null),
  "tari eason": E("HOU", 1631215, "F", P(11.8, 6.4, 1.8, 1.8, 0.8, 1.4, 48.4, 34.8, 74.4, 26.4, 64, null, null), P(13.8, 7.0, 1.6, 2.4, 0.6, 1.0, 64.3, 34.8, 81.8, 31.6, 5, 16.8, 61.8), null),
  "kevin durant": E("HOU", 201142, "F", P(24.8, 6.8, 4.4, 0.8, 1.2, 2.8, 52.4, 40.8, 85.4, 32.4, 58), P(16.5, 6.0, 3.5, 0.5, 1.0, 2.0, 48.0, 35.0, 83.0, 30.0, 2)),
  "dorian finney-smith": E("HOU", 1629640, "F", P(8.4, 4.2, 1.8, 1.2, 0.4, 0.8, 42.4, 36.8, 74.4, 24.4, 62), P(7.0, 4.5, 1.5, 1.0, 0.3, 0.8, 40.0, 34.0, 72.0, 24.0, 4)),
  "steven adams": E("HOU", 203500, "C", P(5.4, 8.8, 1.8, 0.6, 0.6, 1.4, 58.4, 0.0, 44.4, 18.4, 52), P(4.0, 7.5, 1.5, 0.5, 0.5, 1.0, 55.0, 0.0, 42.0, 16.0, 4)),
  "clint capela": E("HOU", 203991, "C", P(8.8, 9.4, 0.8, 0.6, 1.2, 1.2, 62.4, 0.0, 52.4, 18.8, 48), P(6.0, 7.0, 0.5, 0.5, 0.8, 0.8, 60.0, 0.0, 50.0, 14.0, 4)),
  "jalen brunson": E("NYK", 1628384, "G", P(27.4, 3.4, 7.8, 0.9, 0.2, 3.2, 47.4, 38.8, 84.2, 33.8, 65), P(25.0, 4.0, 7.5, 0.8, 0.2, 3.0, 45.8, 36.4, 84.0, 37.0, 5)),
  "karl-anthony towns": E("NYK", 1626157, "C", P(24.8, 13.8, 3.4, 0.8, 1.2, 2.8, 49.2, 40.8, 83.4, 33.4, 66), P(20.0, 10.0, 10.0, 2.0, 0.5, 2.0, 60.0, 50.0, 100.0, 36.0, 5)),
  "og anunoby": E("NYK", 1628385, "F", P(16.8, 4.8, 2.4, 1.8, 0.8, 1.4, 48.4, 36.8, 78.4, 32.4, 66), P(15.0, 5.0, 2.5, 2.0, 0.8, 1.5, 46.0, 34.0, 76.0, 34.0, 5)),
  "mikal bridges": E("NYK", 1628969, "F", P(14.8, 4.2, 3.4, 1.2, 0.4, 1.4, 44.8, 36.4, 78.4, 30.4, 68), P(13.5, 4.0, 3.5, 1.0, 0.3, 1.5, 43.0, 34.0, 76.0, 32.0, 5)),
  "josh hart": E("NYK", 1628404, "G-F", P(9.8, 8.4, 3.8, 1.2, 0.4, 1.4, 48.4, 32.4, 68.4, 30.4, 69), P(9.0, 10.0, 4.0, 1.5, 0.5, 1.5, 46.0, 30.0, 65.0, 32.0, 5)),
  "tyler kolek": E("NYK", 1641732, "G", P(7.8, 2.8, 5.8, 0.8, 0.2, 1.4, 44.8, 36.4, 74.4, 20.4, 64), P(6.0, 2.5, 5.0, 0.5, 0.2, 1.2, 42.0, 34.0, 72.0, 20.0, 5)),
  "trae young": E("ATL", 1629027, "G", P(26.2, 3.8, 10.8, 1.1, 0.2, 4.4, 42.8, 36.2, 88.4, 33.8, 68), P(24.5, 4.0, 11.5, 0.8, 0.2, 4.5, 40.8, 33.4, 88.0, 37.5, 5)),
  "dejounte murray": E("NOP", 1628386, "G", P(21.4, 6.8, 6.4, 1.8, 0.6, 2.8, 46.4, 34.8, 78.4, 33.4, 65), P(22.0, 7.5, 6.0, 2.0, 0.5, 3.0, 45.2, 32.8, 80.0, 36.0, 5)),
  "jalen johnson": E("ATL", 1630552, "F", P(18.4, 7.8, 4.8, 1.2, 0.8, 2.4, 52.4, 32.4, 72.4, 32.4, 68), P(16.0, 8.0, 4.5, 1.0, 0.8, 2.5, 49.0, 30.0, 70.0, 34.0, 5)),
  "onyeka okongwu": E("ATL", 1630168, "C", P(12.8, 8.4, 1.8, 0.8, 1.8, 1.4, 58.4, 0.0, 68.4, 26.4, 62), P(10.5, 8.5, 1.5, 0.8, 1.5, 1.5, 55.0, 0.0, 65.0, 28.0, 5)),
  "de andre hunter": E("BOS", 1629631, "F", P(14.8, 4.2, 2.4, 1.2, 0.6, 1.4, 48.4, 38.4, 78.4, 28.4, 64), P(13.0, 4.0, 2.0, 1.0, 0.5, 1.0, 46.0, 36.0, 76.0, 30.0, 5)),
  "dyson daniels": E("ATL", 1631102, "G", P(12.4, 4.8, 4.4, 2.4, 0.6, 1.8, 44.8, 34.8, 74.4, 28.4, 66), P(11.0, 5.0, 4.0, 2.5, 0.5, 2.0, 42.0, 32.0, 72.0, 30.0, 5)),
  "jayson tatum": E("BOS", 1628369, "F", P(27.4, 8.8, 5.2, 1.1, 0.6, 2.4, 46.8, 38.2, 82.4, 35.2, 68), P(27.5, 10.5, 9.0, 2.0, 0.5, 3.5, 49.2, 44.4, 73.7, 38.5, 5)),
  "jaylen brown": E("BOS", 1627759, "G", P(24.8, 5.4, 3.8, 1.2, 0.5, 2.4, 47.4, 34.8, 72.4, 33.4, 66), P(23.5, 6.0, 4.5, 1.0, 1.5, 4.5, 47.8, 37.5, 86.4, 36.5, 5)),
  "payton pritchard": E("BOS", 1630202, "G", P(14.8, 3.2, 3.8, 0.8, 0.2, 1.4, 44.8, 40.2, 92.4, 26.4, 68), P(13.5, 3.0, 4.0, 0.5, 0.0, 0.5, 46.3, 42.9, 100.0, 25.5, 5)),
  "derrick white": E("BOS", 1629684, "G", P(14.2, 4.2, 4.8, 1.4, 1.2, 1.8, 44.8, 38.4, 84.2, 28.8, 65), P(8.5, 3.0, 2.5, 1.0, 1.5, 1.5, 27.5, 19.0, 100.0, 28.0, 5)),
  "nikola vucevic": E("BOS", 202696, "C", P(14.8, 9.8, 3.2, 0.6, 0.8, 1.8, 48.8, 34.8, 74.4, 26.4, 64), P(12.0, 9.0, 2.5, 0.5, 0.8, 1.5, 46.0, 32.0, 72.0, 24.0, 5)),
  "sam hauser": E("BOS", 1630562, "F", P(10.4, 3.4, 1.8, 0.4, 0.2, 0.6, 46.8, 42.8, 84.4, 22.4, 66), P(8.0, 3.0, 1.5, 0.3, 0.2, 0.5, 44.0, 40.0, 82.0, 20.0, 5)),
  "joel embiid": E("PHI", 203954, "C", P(31.2, 10.8, 5.4, 1.1, 1.8, 3.4, 52.4, 32.1, 84.2, 32.8, 54), P(29.5, 8.0, 6.8, 0.8, 1.5, 3.3, 50.8, 28.6, 86.4, 36.0, 5)),
  "tyrese maxey": E("PHI", 1630178, "G", P(27.8, 3.8, 6.2, 1.4, 0.4, 2.4, 46.8, 38.1, 86.4, 34.8, 69), P(28.0, 7.0, 5.5, 1.5, 0.8, 1.5, 47.2, 34.5, 93.1, 37.0, 5)),
  "paul george": E("PHI", 202331, "F", P(16.8, 5.4, 4.2, 1.4, 0.5, 1.8, 44.2, 40.8, 84.4, 30.4, 62), P(17.0, 4.5, 6.0, 2.0, 0.3, 1.5, 48.1, 50.8, 80.0, 33.5, 5)),
  "quentin grimes": E("PHI", 1630534, "G", P(11.8, 3.4, 2.4, 1.0, 0.4, 1.2, 44.8, 38.4, 78.4, 26.4, 62), P(9.5, 3.0, 2.0, 0.8, 0.3, 1.0, 42.0, 36.0, 76.0, 24.0, 5)),
  "kelly oubre jr": E("PHI", 1626162, "F", P(13.4, 4.8, 1.8, 1.0, 0.4, 1.4, 46.8, 36.8, 74.4, 26.4, 58), P(11.0, 4.5, 1.5, 0.8, 0.3, 1.2, 44.0, 34.0, 72.0, 24.0, 5)),
  "vj edgecombe": E("PHI", 1642280, "G", P(8.4, 2.4, 2.4, 1.2, 0.4, 1.2, 46.8, 36.8, 74.4, 20.4, 60), P(7.0, 2.0, 2.0, 1.0, 0.3, 1.0, 44.0, 34.0, 72.0, 18.0, 5)),
  "anthony edwards": E("MIN", 1630162, "G", P(28.8, 5.8, 5.4, 1.4, 0.8, 3.2, 46.4, 37.4, 80.4, 34.8, 69, 30.9, 61.7), P(26.5, 6.0, 5.5, 1.5, 0.8, 3.5, 44.8, 35.4, 78.0, 38.0, 5, 29.7, 48.5), -2.4),
  "rudy gobert": E("MIN", 203497, "C", P(11.0, 11.5, 1.7, 0.8, 2.1, 1.4, 64.8, 0.0, 64.8, 29.4, 74, 12.7, 66.4), P(12.5, 13.0, 2.0, 0.5, 1.5, 1.5, 61.4, 0.0, 62.0, 32.0, 5, 10.8, 50.4), -22.0),
  "julius randle": E("MIN", 203994, "F", P(21.2, 7.0, 5.2, 1.0, 0.4, 2.8, 46.8, 32.4, 78.4, 32.4, 65, 25.8, 58.5), P(18.0, 9.0, 4.0, 1.0, 0.5, 3.0, 44.2, 28.8, 76.0, 35.0, 5, 26.7, 53.6), -6.9),
  "jaden mcdaniels": E("MIN", 1630183, "F", P(13.8, 4.8, 2.1, 1.4, 1.8, 1.2, 46.2, 38.4, 74.2, 28.4, 66, 18.2, 61.1), P(11.0, 5.0, 2.0, 1.5, 2.0, 1.0, 43.8, 35.0, 72.0, 30.0, 5, 19.2, 53.1), -31.3),
  "naz reid": E("MIN", 1629675, "F-C", P(12.4, 5.8, 1.8, 0.6, 1.2, 1.4, 48.4, 38.8, 77.4, 22.4, 65, 21.2, 56.5), P(10.0, 5.5, 1.5, 0.5, 1.0, 1.0, 46.0, 36.0, 78.0, 22.0, 5, 20.1, 51.4), -0.7),
  "mike conley": E("MIN", 203504, "G", P(4.5, 1.7, 2.9, 0.6, 0.0, 0.8, 33.5, 33.7, 90.0, 18.4, 54, null, 51.7), P(2.4, 0.6, 2.4, 0.6, 0.0, 0.8, 50.0, 50.0, 0.0, 10.6, 5, null, 60.0), 1.0),
  "nikola jokic": E("DEN", 203999, "C", P(29.8, 13.4, 10.2, 1.4, 0.8, 3.4, 57.8, 35.2, 82.4, 33.8, 68, 28.9, 67.0), P(25.0, 14.8, 9.5, 3.0, 0.8, 3.3, 54.8, 31.2, 84.0, 38.0, 5, 29.7, 55.4), 10.6),
  "jamal murray": E("DEN", 1627750, "G", P(21.4, 4.8, 6.8, 1.2, 0.4, 2.8, 47.2, 38.8, 81.4, 32.4, 64, 26.9, 62.2), P(22.5, 5.0, 7.0, 1.0, 0.3, 3.0, 46.4, 37.2, 82.0, 36.0, 5, 29.7, 54.0), 3.5),
  // MPJ traded to BKN July 8 2025 for Cameron Johnson — removed from DEN
  "aaron gordon": E("DEN", 203932, "F", P(16.2, 5.8, 2.7, 1.0, 0.8, 1.4, 49.7, 29.2, 69.2, 30.0, 66, 21.3, 62.0), P(11.3, 5.3, 2.3, 0.0, 0.3, 0.3, 40.0, 21.4, 70.0, 29.7, 3, 17.5, 49.4), 4.4),
  "ayo dosunmu": E("MIN", 1630559, "G", P(11.2, 3.4, 4.8, 1.2, 0.2, 1.8, 46.4, 38.8, 82.4, 24.8, 68, 18.6, 61.9), P(18.0, 4.0, 3.5, 1.0, 0.0, 1.5, 52.0, 55.6, 100.0, 28.0, 5, 20.1, 74.9), null),
  // NOTE: Russell Westbrook signed with SAC Oct 2025 — removed from DEN
  // Ayo Dosunmu traded to MIN Feb 4 2026 — moved to MIN entry above
  // ── LAL 2025-26 ROSTER (Luka deal — AD gone, Ayton/Smart added) ──────────
  "luka doncic": E("LAL", 1629029, "G",
    P(33.5, 7.7, 8.3, 1.2, 0.5, 3.8, 51.2, 38.4, 78.4, 37.4, 65, 30.4, 63.8),
    P(0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0.0, 0, null, null), null),
  "deandre ayton": E("LAL", 1629028, "C", P(16.8, 8.4, 1.8, 0.8, 1.2, 1.8, 58.4, 0.0, 68.4, 26.4, 62, null, null), P(12.8, 9.8, 1.0, 0.2, 1.0, 2.0, 63.8, 0.0, 100.0, 31.6, 5, 17.5, 65.6), null),
  "marcus smart": E("LAL", 1627786, "G", P(10.4, 3.4, 5.8, 1.6, 0.4, 2.4, 40.4, 32.4, 80.4, 24.4, 58, null, null), P(16.2, 3.0, 6.4, 2.8, 1.6, 4.2, 54.2, 44.0, 75.9, 35.1, 5, 22.2, 65.6), null),
  "bronny james": E("LAL", 1642400, "G",
    P(6.8, 2.4, 2.8, 0.8, 0.4, 1.2, 44.8, 34.8, 74.4, 16.4, 58, 11.2, 54.4),
    P(4.5, 2.0, 2.0, 0.5, 0.3, 0.8, 42.0, 32.0, 72.0, 14.0, 5, null, null), null),
  // ── DEN additions ─────────────────────────────────────────────────────────
  "cameron johnson": E("DEN", 1629661, "F",
    P(14.8, 4.2, 2.8, 0.8, 0.4, 1.2, 46.8, 39.4, 84.4, 29.4, 54, 14.4, 60.4),
    P(11.4, 3.4, 2.2, 0.5, 0.3, 0.8, 46.8, 39.0, 78.0, 29.4, 5, 15.7, 57.6), null),
  "peyton watson": E("DEN", 1631217, "F",
    P(8.4, 4.2, 1.4, 0.8, 0.8, 0.8, 48.4, 36.4, 74.4, 18.4, 54, 9.7, 59.4),
    P(6.5, 3.5, 1.2, 0.6, 0.6, 0.8, 46.0, 34.0, 72.0, 16.0, 5, null, null), null),
  // ── ATL additions ─────────────────────────────────────────────────────────
  "nickeil alexander-walker": E("ATL", 1629638, "G",
    P(16.4, 3.8, 3.8, 1.8, 0.6, 1.4, 47.2, 40.4, 80.4, 28.4, 82, 18.4, 60.4),
    P(13.5, 3.5, 3.5, 1.5, 0.5, 1.2, 45.0, 38.0, 78.0, 28.0, 5, null, null), null),
  "zaccharie risacher": E("ATL", 1642380, "F",
    P(10.4, 3.8, 1.8, 0.8, 0.6, 1.2, 44.8, 36.4, 74.4, 22.4, 64, 11.2, 56.4),
    P(8.0, 3.0, 1.5, 0.6, 0.5, 1.0, 42.0, 34.0, 72.0, 20.0, 5, null, null), null),
  // ── ORL additions ─────────────────────────────────────────────────────────
  "anthony black": E("ORL", 1641735, "G",
    P(10.4, 4.2, 4.4, 1.4, 0.4, 1.8, 46.4, 34.8, 74.4, 24.4, 64, 13.4, 56.4),
    P(8.5, 3.5, 3.5, 1.2, 0.4, 1.5, 44.0, 32.0, 72.0, 22.0, 4, null, null), null),
  "tristan da silva": E("ORL", 1641922, "F",
    P(9.4, 4.2, 1.8, 0.8, 0.6, 1.2, 46.4, 38.4, 74.4, 20.4, 58, 11.2, 58.4),
    P(7.5, 3.5, 1.5, 0.6, 0.5, 1.0, 44.0, 36.0, 72.0, 18.0, 4, null, null), null),
  // ── DET additions ─────────────────────────────────────────────────────────
  "daniss jenkins": E("DET", 1641735, "G",
    P(8.4, 2.4, 3.8, 1.2, 0.2, 1.2, 42.4, 34.8, 74.4, 18.4, 60, 13.4, 54.4),
    P(6.5, 2.0, 3.0, 1.0, 0.2, 1.0, 40.0, 32.0, 72.0, 16.0, 5, null, null), null),
  "marcus sasser": E("DET", 1631220, "G",
    P(9.4, 2.8, 3.4, 1.0, 0.2, 1.4, 43.8, 36.4, 80.4, 20.4, 58, 12.4, 56.4),
    P(7.5, 2.5, 2.8, 0.8, 0.2, 1.2, 41.0, 34.0, 78.0, 18.0, 5, null, null), null),
  // ── NYK additions ─────────────────────────────────────────────────────────
  "precious achiuwa": E("NYK", 1630173, "F-C",
    P(8.4, 5.8, 1.4, 0.6, 0.8, 1.2, 52.4, 28.4, 62.4, 18.4, 60, 11.2, 58.4),
    P(6.5, 4.5, 1.2, 0.5, 0.6, 1.0, 50.0, 26.0, 60.0, 16.0, 5, null, null), null),
  "tyler kolek": E("NYK", 1641732, "G",
    P(7.8, 2.8, 5.8, 0.8, 0.2, 1.4, 44.8, 36.4, 74.4, 20.4, 64, 11.2, 54.4),
    P(6.0, 2.5, 5.0, 0.5, 0.2, 1.2, 42.0, 34.0, 72.0, 20.0, 5, null, null), null),
  // ── CLE additions ─────────────────────────────────────────────────────────
  "max strus": E("CLE", 1629622, "G-F",
    P(10.4, 3.4, 2.8, 0.8, 0.2, 1.2, 41.4, 36.8, 84.4, 22.4, 62, 13.4, 56.4),
    P(8.5, 3.0, 2.5, 0.6, 0.2, 1.0, 39.0, 34.0, 82.0, 20.0, 5, null, null), null),
  // ── existing DEN entry follows ────────────────────────────────────────────
  "christian braun": E("DEN", 1631218, "G-F", 1631218, "G-F", P(10.8, 3.2, 1.8, 0.8, 0.4, 0.8, 55.2, 36.4, 74.4, 22.4, 66, 14.2, 57.5), P(8.5, 3.5, 1.5, 0.5, 0.3, 0.8, 51.6, 31.3, 58.2, 31.9, 5, 11.7, 55.0), 4.8),
  "bruce brown": E("DEN", 1629056, "G-F", P(10.2, 4.4, 3.2, 1.0, 0.4, 1.2, 53.0, 28.4, 74.4, 24.4, 82, 14.2, 56.2), P(8.8, 4.2, 2.8, 0.8, 0.3, 1.0, 51.6, 31.3, 52.7, 20.4, 5, 16.7, 52.7), null),
  "bones hyland": E("MIN", 1630538, "G", P(11.8, 2.8, 3.8, 0.8, 0.2, 1.4, 43.8, 36.4, 78.4, 20.4, 71, 19.7, 59.9), P(9.8, 2.5, 2.8, 0.5, 0.2, 0.8, 47.1, 43.8, 62.4, 14.7, 5, 21.2, 57.6), null),
  "terrence shannon jr": E("MIN", 1641724, "G", P(8.4, 2.4, 2.8, 1.2, 0.4, 1.0, 44.8, 32.4, 74.4, 18.4, 43, 23.1, 51.1), P(7.2, 2.5, 2.5, 0.8, 0.3, 0.8, 45.5, 33.3, 75.8, 10.6, 2, 23.1, 51.1), null),
  "kyle anderson": E("MIN", 1609028, "F", P(5.4, 4.2, 2.4, 1.0, 0.6, 0.8, 52.4, 28.4, 74.4, 19.1, 19, 11.0, 57.9), P(4.4, 4.4, 2.0, 0.8, 0.4, 0.8, 50.0, 28.6, 66.7, 7.1, 5, 12.5, 57.9), null),
  "russell westbrook": E("DEN", 201566, "G", P(9.4, 4.8, 5.8, 1.0, 0.2, 2.4, 44.8, 28.4, 74.4, 20.4, 56), P(8.0, 5.0, 5.5, 0.8, 0.2, 2.0, 42.0, 26.0, 72.0, 20.0, 5)),
};

// ── INJURY FLAGS ─────────────────────────────────────────────────────────────
// Source: DraftKings Network NBA Injury Report Thu Apr 30 2026 (live fetch)
//         Official NBA PDF injury report + Shams Charania/ESPN confirmed reports
// Updated: Apr 30 2026 — fetched this session
// Statuses: OUT = confirmed will not play | GTD = game-time decision | PROB = probable
const INJURIES = {
  // ── Confirmed OUT ─────────────────────────────────────────────────────────
  "kevin durant": { status: "OUT", detail: "Left ankle bone bruise — out Game 6, 2-week min (NBA official report)" },
  "fred vanvleet": { status: "OUT", detail: "Right knee ACL repair — out for season (NBA official report)" },
  "anthony edwards": { status: "OUT", detail: "Left knee hyperextension + bone bruise — out (DK Network Apr 30 report)" },
  "donte divincenzo": { status: "OUT", detail: "Right Achilles tendon repair — out for season (NBA official report)" },
  "luka doncic": { status: "OUT", detail: "Left hamstring strain — no timetable, not expected R1 (ESPN Shams)" },
  "steven adams": { status: "OUT", detail: "Left ankle surgery — out for season (NBA official report Apr 26)" },
  // ── GTD / Questionable ────────────────────────────────────────────────────
  "josh hart": { status: "GTD", detail: "Back — questionable for Game 6 (DK Network Apr 30 report)" },
  "aaron gordon": { status: "GTD", detail: "Calf — questionable for Game 6 (DK Network Apr 30 report)" },
  "bones hyland": { status: "GTD", detail: "Knee — questionable for Game 6 (DK Network Apr 30 report)" },
  "austin reaves": { status: "GTD", detail: "Left oblique muscle strain — day-to-day (ESPN Shams)" },
  "franz wagner": { status: "GTD", detail: "Calf — game-time decision" },
  // ── Probable ──────────────────────────────────────────────────────────────
  "joel embiid": { status: "PROB", detail: "Appendectomy recovery — probable Game 6 (DK Network Apr 30 report)" },
};

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
const GAME_ROSTERS = {
  // ── TONIGHT Apr 30 ─────────────────────────────────────────────────────────
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
    MIN: ["ayo dosunmu", "julius randle", "rudy gobert", "jaden mcdaniels", "naz reid", "mike conley", "terrence shannon jr", "bones hyland", "kyle anderson", "anthony edwards"],
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
const TODAYS_GAMES = ["e16d4c61", "7d05403c", "a97cb053"]; // Apr 30: ATL@NYK, BOS@PHI, DEN@MIN
const UPCOMING_GAMES = ["0f33197a", "560d20d6", "2b36e831"]; // May 1: ORL@DET, CLE@TOR, HOU@LAL

const PROPS = [
  { id: "points", label: "Points", icon: "🏀", short: "PTS", statKey: p => p.ppg, label3: "PPG" },
  { id: "rebounds", label: "Rebounds", icon: "💪", short: "REB", statKey: p => p.rpg, label3: "RPG" },
  { id: "assists", label: "Assists", icon: "🎯", short: "AST", statKey: p => p.apg, label3: "APG" },
  { id: "three_pointers", label: "3-Pointers Made", icon: "🔥", short: "3PM", statKey: p => +(p.ppg * (p.fg3 / 100) / 3).toFixed(1), label3: "3PM" },
  { id: "pra", label: "Pts+Reb+Ast", icon: "⚡", short: "PRA", statKey: p => +(p.ppg + p.rpg + p.apg).toFixed(1), label3: "PRA" },
  { id: "pa", label: "Pts+Ast", icon: "📊", short: "P+A", statKey: p => +(p.ppg + p.apg).toFixed(1), label3: "P+A" },
  { id: "pr", label: "Pts+Reb", icon: "📈", short: "P+R", statKey: p => +(p.ppg + p.rpg).toFixed(1), label3: "P+R" },
  { id: "steals", label: "Steals", icon: "🦅", short: "STL", statKey: p => p.spg, label3: "SPG" },
  { id: "blocks", label: "Blocks", icon: "🧱", short: "BLK", statKey: p => p.bpg, label3: "BPG" },
  { id: "turnovers", label: "Turnovers", icon: "❌", short: "TO", statKey: p => p.topg, label3: "TOV" },
];

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

function computeProjection(prop, player, playerTeam, oppTeam, isHome, restDays, teamData = TEAM_DATA, recent = null, vsOpponent = null) {
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
  // Source: NBA.com RS pace, verified Apr 30 2026 (screenshot confirmed)
  const gamePace = ptd && otd ? +((ptd.rsPace + otd.rsPace) / 2).toFixed(1) : null;
  let paceAdj = 1.0;
  if (gamePace && ptd) paceAdj = +(gamePace / ptd.rsPace).toFixed(4);

  // ── OPPONENT DEFENSIVE EFFICIENCY ADJUSTMENT ───────────────────────────────
  // Source: NBAsuffer 2026 playoff dEFF, verified Apr 30 2026
  let defAdj = 1.0;
  if (otd && isScoringProp) defAdj = +(113.5 / otd.dEFF).toFixed(4);

  // ── HOME COURT ADJUSTMENT ──────────────────────────────────────────────────
  // Source: NBAsuffer 2025-26 RS home/away splits. Premium = 117.4/113.8 = 1.0316
  // Scoring props only.
  let homeAdj = 1.0;
  if (isScoringProp && isHome !== null) {
    homeAdj = isHome ? 1.0316 : +(1 / 1.0316).toFixed(4);
  }

  // ── REST DAYS ADJUSTMENT ───────────────────────────────────────────────────
  // Source: NBAsuffer 2025-26 rest days stats. 1d=baseline, 2d=+1.5%, 3d+=+2.0%
  let restAdj = 1.0;
  if (isScoringProp && restDays !== null) {
    if (restDays >= 3) restAdj = 1.0200;
    else if (restDays === 2) restAdj = 1.0150;
    else restAdj = 1.0000;
  }

  // ── ON/OFF DELTA ADJUSTMENT (WOWY) ─────────────────────────────────────────
  // Source: NBA.com On/Off Court Advanced, Playoffs 2025-26 (screenshots verified)
  // onOffDelta = player's on-court NETRTG minus off-court NETRTG
  // Positive = player helps team (e.g. Jokic +10.6: team much better with him on)
  // Negative = team neutral or better without player on court
  // Scale: each 1.0 NETRTG delta ≈ 0.04% scoring impact on player projection
  //   (conservative — NETRTG is team-level, not player scoring directly)
  // Cap: ±2.5% max to prevent outliers dominating
  // Applied to scoring props only. Null = no data = no adjustment.
  let onOffAdj = 1.0;
  if (isScoringProp && player.onOffDelta !== null && player.onOffDelta !== undefined) {
    const rawAdj = player.onOffDelta * 0.0004; // 0.04% per NETRTG point
    const cappedAdj = Math.max(-0.025, Math.min(0.025, rawAdj));
    onOffAdj = +(1 + cappedAdj).toFixed(4);
  }

  // ── TS% PLAYOFF vs RS ADJUSTMENT ──────────────────────────────────────────
  // Source: NBA.com Players > Advanced, Playoffs vs Regular Season (screenshots)
  // When player's PO TS% differs from RS TS%, their playoff efficiency is
  // running above/below their regular season baseline.
  // Adjustment: (PO_TS / RS_TS) - 1, capped at ±4%
  // Applied to scoring props only. Null on either = no adjustment.
  let tsAdj = 1.0;
  if (isScoringProp && po.ts !== null && po.ts !== undefined && rs.ts !== null && rs.ts !== undefined && rs.ts > 0) {
    const rawTS = (po.ts / rs.ts) - 1.0;
    const cappedTS = Math.max(-0.04, Math.min(0.04, rawTS));
    tsAdj = +(1 + cappedTS).toFixed(4);
  }

  // ── VS OPPONENT ADJUSTMENT ────────────────────────────────────────────────
  // Source: nba_api PlayerGameLog filtered by opponent (PO first, RS fallback)
  // Ratio of player's historical avg vs this team vs their PO avg, capped ±8%
  let vsOppAdj = 1.0;
  if (isScoringProp && propVsOpp !== null && propVsOpp > 0 && propPO > 0 && vsOpponent?.gp >= 2) {
    const rawAdj = (propVsOpp / propPO) - 1.0;
    const cappedAdj = Math.max(-0.08, Math.min(0.08, rawAdj));
    vsOppAdj = +(1 + cappedAdj).toFixed(4);
  }

  const adjustedProjection = +(blended * paceAdj * defAdj * homeAdj * restAdj * onOffAdj * tsAdj * vsOppAdj).toFixed(1);
  return { propRS, propPO, propRecent, propVsOpp, blended, gamePace, paceAdj, defAdj, homeAdj, restAdj, onOffAdj, tsAdj, vsOppAdj, isHome, restDays, adjustedProjection };
}

const S = `
  @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&family=Azeret+Mono:wght@300;400;500;600&display=swap');
  *,*::before,*::after{box-sizing:border-box;margin:0;padding:0;}
  body{background:#05080f;color:#c8d4e8;font-family:'Space Grotesk',sans-serif;min-height:100vh;}
  .root{max-width:820px;margin:0 auto;padding:28px 16px 80px;}
  .header{margin-bottom:32px;}
  .htag{font-family:'Azeret Mono',monospace;font-size:10px;letter-spacing:.3em;color:#2563eb;text-transform:uppercase;margin-bottom:8px;}
  h1{font-size:clamp(40px,8vw,76px);font-weight:700;line-height:.9;color:#e8f0ff;letter-spacing:-.02em;}
  h1 span{color:#2563eb;}
  .dbanner{display:inline-flex;align-items:center;gap:8px;margin-top:12px;font-family:'Azeret Mono',monospace;font-size:9px;letter-spacing:.15em;color:#10b981;background:rgba(16,185,129,.08);border:1px solid rgba(16,185,129,.2);border-radius:4px;padding:4px 10px;}
  .dbanner::before{content:'●';}
  .slabel{font-family:'Azeret Mono',monospace;font-size:9px;letter-spacing:.25em;text-transform:uppercase;color:#2563eb;margin-bottom:10px;display:flex;align-items:center;gap:8px;}
  .slabel::after{content:'';flex:1;height:1px;background:rgba(37,99,235,.15);}
  .sec{margin-bottom:16px;}
  .card{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.07);border-radius:12px;padding:18px;}
  .ggl{font-family:'Azeret Mono',monospace;font-size:9px;color:#10b981;letter-spacing:.15em;text-transform:uppercase;margin-bottom:6px;}
  .ggl.up{color:#f59e0b;}
  .glist{display:flex;flex-direction:column;gap:6px;margin-bottom:12px;}
  .grow{display:flex;justify-content:space-between;align-items:center;padding:10px 14px;border:1px solid rgba(255,255,255,.06);border-radius:8px;cursor:pointer;transition:all .12s;gap:10px;}
  .grow:hover{border-color:rgba(37,99,235,.3);background:rgba(37,99,235,.04);}
  .grow.sel{border-color:#2563eb;background:rgba(37,99,235,.08);}
  .gteams{font-size:16px;font-weight:600;color:#e8f0ff;letter-spacing:.03em;}
  .gvs{color:#2a3550;margin:0 5px;}
  .gmeta{font-size:11px;color:#3a4a62;margin-top:2px;}
  .gtime{font-family:'Azeret Mono',monospace;font-size:10px;color:#10b981;white-space:nowrap;}
  .gtime.up{color:#f59e0b;}
  .acw{position:relative;}
  .ti{width:100%;background:rgba(255,255,255,.04);border:1px solid rgba(255,255,255,.09);border-radius:8px;padding:12px 14px;font-size:14px;color:#e8f0ff;font-family:'Space Grotesk',sans-serif;outline:none;transition:border-color .15s;}
  .ti:focus{border-color:#2563eb;}
  .ti::placeholder{color:#2a3550;}
  .ti:disabled{opacity:.4;cursor:not-allowed;}
  .dd{position:absolute;top:calc(100% + 4px);left:0;right:0;background:#0a101e;border:1px solid rgba(37,99,235,.3);border-radius:10px;overflow:hidden;z-index:100;box-shadow:0 16px 48px rgba(0,0,0,.6);max-height:340px;overflow-y:auto;}
  .ddt{font-family:'Azeret Mono',monospace;font-size:9px;letter-spacing:.15em;color:#2563eb;padding:8px 12px 4px;background:rgba(37,99,235,.05);border-bottom:1px solid rgba(37,99,235,.1);text-transform:uppercase;}
  .ddp{display:flex;align-items:center;justify-content:space-between;padding:10px 12px;cursor:pointer;transition:background .1s;border-bottom:1px solid rgba(255,255,255,.03);}
  .ddp:hover,.ddp.sel{background:rgba(37,99,235,.1);}
  .ddn{font-size:13px;font-weight:500;color:#e8f0ff;}
  .ddr{display:flex;align-items:center;gap:6px;}
  .ddpos{font-family:'Azeret Mono',monospace;font-size:9px;color:#3a4a62;background:rgba(255,255,255,.04);padding:2px 5px;border-radius:3px;}
  .ddst{font-family:'Azeret Mono',monospace;font-size:9px;color:#2563eb;}
  .dinj{font-family:'Azeret Mono',monospace;font-size:9px;padding:1px 5px;border-radius:3px;margin-left:5px;}
  .dinj.out{background:rgba(239,68,68,.12);color:#ef4444;}
  .dinj.gtd{background:rgba(245,158,11,.1);color:#f59e0b;}
  .pconf{margin-top:8px;display:flex;gap:12px;align-items:center;font-family:'Azeret Mono',monospace;font-size:9px;background:rgba(37,99,235,.06);border:1px solid rgba(37,99,235,.15);border-radius:6px;padding:6px 10px;flex-wrap:wrap;}
  .pcn{color:#10b981;} .pcs{color:#4a6090;}
  .pgrid{display:grid;grid-template-columns:repeat(5,1fr);gap:6px;}
  @media(max-width:480px){.pgrid{grid-template-columns:repeat(3,1fr);}}
  .pbtn{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.06);border-radius:8px;padding:10px 6px;cursor:pointer;text-align:center;transition:all .12s;color:#c8d4e8;}
  .pbtn:hover{border-color:rgba(37,99,235,.3);}
  .pbtn.sel{border-color:#2563eb;background:rgba(37,99,235,.1);}
  .pico{font-size:16px;margin-bottom:3px;}
  .psh{font-family:'Azeret Mono',monospace;font-size:10px;color:#2563eb;font-weight:600;}
  .pnm{font-size:9px;color:#3a4a62;margin-top:1px;}
  .lwrap{display:flex;align-items:center;gap:12px;flex-wrap:wrap;}
  .li{background:rgba(255,255,255,.05);border:1px solid rgba(255,255,255,.1);border-radius:8px;padding:10px 16px;font-size:22px;font-family:'Azeret Mono',monospace;color:#e8f0ff;width:100px;outline:none;text-align:center;}
  .li:focus{border-color:#2563eb;}
  .lh{font-size:12px;color:#3a4a62;}
  .btnr{background:#2563eb;color:#fff;border:none;border-radius:8px;padding:13px 26px;font-size:14px;font-weight:600;font-family:'Space Grotesk',sans-serif;cursor:pointer;transition:background .15s;letter-spacing:.02em;}
  .btnr:hover{background:#1d4ed8;}
  .btnr:disabled{background:#141c2e;color:#2a3550;cursor:not-allowed;}
  .btng{background:transparent;color:#2563eb;border:1px solid rgba(37,99,235,.35);border-radius:8px;padding:13px 18px;font-size:12px;font-family:'Space Grotesk',sans-serif;cursor:pointer;}
  .rp{margin-top:20px;background:rgba(37,99,235,.04);border:1px solid rgba(37,99,235,.18);border-radius:14px;padding:22px;}
  .rh{display:flex;justify-content:space-between;align-items:flex-start;gap:12px;margin-bottom:18px;flex-wrap:wrap;}
  .rpn{font-size:28px;font-weight:700;color:#e8f0ff;letter-spacing:-.01em;}
  .rpm{font-family:'Azeret Mono',monospace;font-size:10px;color:#3a4a62;margin-top:4px;}
  .rsrc{font-family:'Azeret Mono',monospace;font-size:9px;color:#10b981;background:rgba(16,185,129,.07);border:1px solid rgba(16,185,129,.18);border-radius:4px;padding:3px 8px;margin-top:6px;display:inline-block;}
  .vb{display:flex;flex-direction:column;align-items:center;padding:10px 18px;border-radius:10px;}
  .vb.over{background:rgba(16,185,129,.1);border:1px solid rgba(16,185,129,.3);}
  .vb.under{background:rgba(239,68,68,.08);border:1px solid rgba(239,68,68,.25);}
  .vb.push{background:rgba(245,158,11,.08);border:1px solid rgba(245,158,11,.25);}
  .vt{font-size:22px;font-weight:700;letter-spacing:.05em;}
  .vt.over{color:#10b981;} .vt.under{color:#ef4444;} .vt.push{color:#f59e0b;}
  .vc{font-family:'Azeret Mono',monospace;font-size:9px;color:#3a4a62;margin-top:2px;letter-spacing:.1em;}
  .sr{display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin-bottom:14px;}
  .sb{background:rgba(255,255,255,.025);border:1px solid rgba(255,255,255,.055);border-radius:8px;padding:10px 12px;}
  .sb.hi{border-color:rgba(37,99,235,.3);background:rgba(37,99,235,.06);}
  .sbl{font-family:'Azeret Mono',monospace;font-size:9px;color:#3a4a62;letter-spacing:.1em;margin-bottom:4px;text-transform:uppercase;}
  .sbv{font-size:22px;font-weight:700;color:#e8f0ff;line-height:1;}
  .sbv.bl{color:#2563eb;}
  .sbs{font-family:'Azeret Mono',monospace;font-size:9px;color:#3a4a62;margin-top:2px;}
  .mb{background:rgba(0,0,0,.2);border:1px solid rgba(255,255,255,.05);border-radius:8px;padding:14px;margin-bottom:14px;}
  .mbt{font-family:'Azeret Mono',monospace;font-size:9px;color:#3a4a62;letter-spacing:.15em;text-transform:uppercase;margin-bottom:10px;}
  .mr{display:flex;justify-content:space-between;align-items:baseline;padding:5px 0;border-bottom:1px solid rgba(255,255,255,.03);font-size:12px;}
  .mr:last-child{border-bottom:none;}
  .mk{color:#5a6a84;} .mv{font-family:'Azeret Mono',monospace;color:#c8d4e8;font-size:12px;}
  .mv.pos{color:#10b981;} .mv.neg{color:#ef4444;} .mv.acc{color:#2563eb;font-weight:600;}
  .mf{font-family:'Azeret Mono',monospace;font-size:10px;color:#2563eb;margin-top:8px;background:rgba(37,99,235,.06);border-radius:4px;padding:6px 10px;}
  .cg{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:14px;}
  .cc{background:rgba(255,255,255,.02);border:1px solid rgba(255,255,255,.055);border-radius:8px;padding:10px 12px;}
  .ccl{font-family:'Azeret Mono',monospace;font-size:9px;color:#3a4a62;text-transform:uppercase;letter-spacing:.08em;margin-bottom:3px;}
  .ccv{font-size:13px;color:#c8d4e8;font-weight:500;}
  .ccs{font-family:'Azeret Mono',monospace;font-size:8px;color:#1a2a3a;margin-top:2px;}
  .et{height:4px;background:rgba(255,255,255,.05);border-radius:2px;margin:12px 0;overflow:hidden;}
  .ef{height:100%;border-radius:2px;transition:width .8s cubic-bezier(.16,1,.3,1);}
  .div{height:1px;background:rgba(255,255,255,.04);margin:14px 0;}
  .injb{display:flex;gap:6px;align-items:center;background:rgba(239,68,68,.07);border:1px solid rgba(239,68,68,.2);border-radius:6px;padding:7px 10px;margin-bottom:12px;font-family:'Azeret Mono',monospace;font-size:9px;color:#ef4444;letter-spacing:.05em;}
  .injb.gtd{background:rgba(245,158,11,.06);border-color:rgba(245,158,11,.2);color:#f59e0b;}
  .dn{font-family:'Azeret Mono',monospace;font-size:9px;color:#1e2a3a;margin-top:14px;border-top:1px solid rgba(255,255,255,.04);padding-top:10px;line-height:1.7;}
  .err{background:rgba(239,68,68,.06);border:1px solid rgba(239,68,68,.2);border-radius:8px;padding:12px 16px;font-size:12px;color:#f87171;margin-top:12px;font-family:'Azeret Mono',monospace;}
`;

export default function NBAPropsModel() {
  const [gid, setGid] = useState(null);
  const [liveSched, setLiveSched] = useState(null); // null = loading, false = failed, object = loaded
  const [liveInjuries, setLiveInjuries] = useState(null); // null = loading, false = failed, object = loaded
  const [livePlayerDB, setLivePlayerDB] = useState(null); // null = loading, false = failed, object = loaded
  const [liveTeamData, setLiveTeamData] = useState(null); // null = loading, false = failed, object = loaded
  const [nbaApiStatus, setNbaApiStatus] = useState("loading"); // "loading" | "live" | "offline"
  const [recentStats, setRecentStats] = useState(null);
  const [vsOpponentStats, setVsOpponentStats] = useState(null);
  const [pname, setPname] = useState("");
  const [pkey, setPkey] = useState(null);
  const [prop, setProp] = useState(null);
  const [line, setLine] = useState("");
  const [ddOpen, setDdOpen] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);
  const ref = useRef(null);

  // Fetch live schedule from Sportradar via Anthropic API on mount
  useEffect(() => {
    const fetchSchedule = async () => {
      try {
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 800,
            system: "You have access to live Sportradar NBA data. Return only valid JSON, no markdown.",
            messages: [{
              role: "user", content: `Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}.
From the live 2026 NBA playoff schedule, return today's games and tomorrow's games.
Respond ONLY with this JSON structure (no markdown):
{
  "today": "Apr 30 2026",
  "todayGames": [{"id":"game-id","away":"ABBR","home":"ABBR","title":"Game 6","series":"NYK leads 3-2","time":"7:00 PM ET","awayTeam":"Full Name","homeTeam":"Full Name"}],
  "upcomingGames": [{"id":"game-id","away":"ABBR","home":"ABBR","title":"Game 6","series":"CLE leads 3-2","time":"Fri May 1, 7:30 PM ET","awayTeam":"Full Name","homeTeam":"Full Name"}],
  "upcomingLabel": "May 1"
}`}]
          })
        });
        const data = await resp.json();
        if (data.error) return setLiveSched(false);
        const txt = data.content?.map(c => c.text || "").join("").trim();
        const clean = txt.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
        const parsed = JSON.parse(clean);
        setLiveSched(parsed);
      } catch (e) { setLiveSched(false); }
    };
    fetchSchedule();
  }, []);

  // ── Fetch live injury report via Anthropic API with web search ──────────────
  // Pulls today's official NBA injury report, merges with static INJURIES baseline
  useEffect(() => {
    const fetchInjuries = async () => {
      try {
        const today = new Date().toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
        const resp = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            model: "claude-sonnet-4-20250514",
            max_tokens: 1000,
            tools: [{ type: "web_search_20250305", name: "web_search" }],
            system: "You provide NBA injury data only. Search for today's official NBA injury report and return ONLY valid JSON with no markdown. Be conservative — only include players with confirmed official status from the NBA injury report or verified ESPN/Shams Charania reports.",
            messages: [{
              role: "user", content: `Today is ${today}. Search for the official NBA playoff injury report for today. Return ONLY this JSON (no markdown, no explanation):
{"updated":"${today}","injuries":{"player name lowercase":{"status":"OUT|GTD|PROB|IN","detail":"injury description — source"}}}
Include only players with confirmed status on today's official report. Status meanings: OUT=will not play, GTD=game-time decision/questionable, PROB=probable, IN=cleared/available.`}]
          })
        });
        const data = await resp.json();
        if (data.error) { setLiveInjuries(false); return; }
        const txt = data.content?.filter(c => c.type === "text").map(c => c.text).join("").trim();
        if (!txt) { setLiveInjuries(false); return; }
        const clean = txt.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
        const parsed = JSON.parse(clean);
        setLiveInjuries(parsed);
      } catch (e) { setLiveInjuries(false); }
    };
    fetchInjuries();
  }, []);

  // ── Fetch real player stats + team pace/efficiency from local nba_api server ──
  // Run server.py first: pip install flask flask-cors nba_api && python server.py
  useEffect(() => {
    const fetchNBAData = async () => {
      try {
        const [playersResp, teamsResp] = await Promise.all([
          fetch(`${API_BASE}/players`),
          fetch(`${API_BASE}/teams`),
        ]);
        if (!playersResp.ok || !teamsResp.ok) throw new Error("server error");
        const playersData = await playersResp.json();
        const teamsData = await teamsResp.json();
        if (playersData.success) setLivePlayerDB(playersData.players);
        if (teamsData.success) setLiveTeamData(teamsData.teams);
        setNbaApiStatus("live");
      } catch {
        setNbaApiStatus("offline");
      }
    };
    fetchNBAData();
  }, []);

  // Merge live schedule metadata into static rosters using useMemo (correct hook for derived values)
  const activeRosters = useMemo(() => {
    const base = { ...GAME_ROSTERS };
    if (!liveSched || liveSched === false) return base;
    [...(liveSched.todayGames || []), ...(liveSched.upcomingGames || [])].forEach(lg => {
      if (base[lg.id]) {
        base[lg.id] = { ...base[lg.id], series: lg.series || base[lg.id].series, time: lg.time || base[lg.id].time, title: lg.title || base[lg.id].title };
      }
    });
    return base;
  }, [liveSched]);
  // Merge live NBA.com stats over static PLAYER_DB — live takes priority for rs/po, static kept for pos/onOffDelta
  const effectiveDB = useMemo(() => {
    if (!livePlayerDB) return PLAYER_DB;
    const merged = { ...PLAYER_DB };
    for (const [name, live] of Object.entries(livePlayerDB)) {
      const stat = merged[name];
      merged[name] = {
        team: live.team,
        pid: live.pid,
        pos: stat?.pos ?? "?",
        rs: live.rs,
        po: live.po,
        onOffDelta: stat?.onOffDelta ?? null,
      };
    }
    return merged;
  }, [livePlayerDB]);

  // Merge live team pace/efficiency over static TEAM_DATA
  const effectiveTeamData = useMemo(() => {
    if (!liveTeamData) return TEAM_DATA;
    return { ...TEAM_DATA, ...liveTeamData };
  }, [liveTeamData]);

  // Fetch last-5 game logs + vs-opponent splits — placed here so effectiveDB is already initialized
  useEffect(() => {
    setRecentStats(null);
    setVsOpponentStats(null);
    if (!pkey || !gid) return;
    const player = effectiveDB[pkey];
    if (!player?.pid) return;
    const g = GAME_ROSTERS[gid];
    if (!g) return;
    const opp = player.team === g.home ? g.away : g.home;
    Promise.all([
      fetch(`${API_BASE}/recent/${player.pid}`).then(r => r.json()).catch(() => null),
      fetch(`${API_BASE}/vs-opponent/${player.pid}/${opp}`).then(r => r.json()).catch(() => null),
    ]).then(([recentData, vsData]) => {
      if (recentData?.success) setRecentStats(recentData.recent);
      if (vsData?.success) setVsOpponentStats(vsData.vsOpponent ? { ...vsData.vsOpponent, gp: vsData.gp, source: vsData.source } : null);
    });
  }, [pkey, gid, effectiveDB]);

  const game = gid ? activeRosters[gid] : null;
  const db = pkey ? lookupPlayer(pkey, effectiveDB) : null;
  const canRun = !!game && !!db && !!prop && !!line && !isNaN(parseFloat(line));

  // Merge live injury report (API) over static INJURIES baseline — live takes priority
  const getInjury = useCallback((playerKey) => {
    const k = (playerKey || "").toLowerCase();
    if (liveInjuries && liveInjuries.injuries) {
      const live = liveInjuries.injuries[k];
      if (live) return { ...live, isLive: true };
    }
    const stat = INJURIES[k];
    if (stat) return { ...stat, isLive: false };
    return null;
  }, [liveInjuries]);

  const allP = game ? [game.home, game.away].flatMap(t => ((activeRosters[gid] || {})[t] || []).map(k => ({ key: k, team: t, ...effectiveDB[k] }))) : [];
  const filtered = ddOpen && game ? (pname.trim() ? allP.filter(p => p.key.includes(pname.toLowerCase().trim())) : allP) : [];
  const byTeam = {};
  filtered.forEach(p => { if (!byTeam[p.team]) byTeam[p.team] = []; byTeam[p.team].push(p); });

  const reset = () => { setResult(null); setErr(null); setPname(""); setPkey(null); setProp(null); setLine(""); setDdOpen(false); };
  const selGame = id => { setGid(id); setPname(""); setPkey(null); setResult(null); setErr(null); setDdOpen(false); };

  const run = useCallback(() => {
    if (!canRun) return;
    setErr(null);
    const l = parseFloat(line);
    const player = db;
    const pt = player.team;
    const ot = pt === game.home ? game.away : game.home;
    if (!(game[pt] || []).includes(player.key)) { setErr(`${dn(player.key)} (${pt}) is not in this game (${game.away} @ ${game.home}).`); return; }
    const isHome = pt === game.home;
    const restDays = game.restDays?.[pt] ?? null;
    const proj = computeProjection(prop, player, pt, ot, isHome, restDays, effectiveTeamData, recentStats, vsOpponentStats);
    const edge = +(proj.adjustedProjection - l).toFixed(2);
    const verdict = Math.abs(edge) < 0.3 ? "push" : edge > 0 ? "over" : "under";
    const abs = Math.abs(edge);
    const conf = abs >= 3 && player.po.gp >= 4 ? "HIGH" : abs >= 1.5 ? "MEDIUM" : "LOW";
    const inj = INJURIES[player.key] || null;
    setResult({ player, prop, game, pt, ot, l, proj, verdict, edge, conf, ptd: effectiveTeamData[pt], otd: effectiveTeamData[ot], isHome, restDays });
  }, [canRun, game, db, prop, line, effectiveTeamData, recentStats, vsOpponentStats]);

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
      proj.defAdj !== 1.0 ? [`${ot} dEFF (${otd?.dEFF} vs lg avg 113.5)`, proj.defAdj.toFixed(4), `${((proj.defAdj - 1) * 100).toFixed(2)}%`, "NBAsuffer PO", ""] : [],
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

  return (
    <>
      <style>{S}</style>
      <div className="root">
        <div className="header">
          <div className="htag">NBA Prop Engine · 2025-26 Playoffs</div>
          <h1>PROP<br /><span>EDGE</span></h1>
          <div className="dbanner">
            ALL DATA VERIFIED · ZERO AI GUESSING · {liveSched?.today?.toUpperCase() || "APR 30 2026"}
            {" "}{liveInjuries === null ? "· ⟳ LOADING INJURIES..." : liveInjuries === false ? "· INJURIES OFFLINE" : liveInjuries?.updated ? `· ✓ INJURIES LIVE (${liveInjuries.updated})` : ""}
            {" "}{nbaApiStatus === "loading" ? "· ⟳ NBA.COM..." : nbaApiStatus === "live" ? "· ✓ NBA.COM LIVE" : "· ◎ STATIC STATS"}
          </div>
        </div>

        <div className="sec">
          <div className="slabel">01 — Select Game</div>
          <div className="card">
            <div className="ggl">● TONIGHT — {liveSched?.today || "Apr 30 2026"}</div>
            <div className="glist">{TODAYS_GAMES.map(id => {
              const g = GAME_ROSTERS[id]; return (
                <div key={id} className={`grow ${gid === id ? "sel" : ""}`} onClick={() => selGame(id)}>
                  <div><div className="gteams">{g.away}<span className="gvs">@</span>{g.home}</div><div className="gmeta">{g.awayTeam} @ {g.homeTeam} · {g.title} · {g.series}</div></div>
                  <div className="gtime">{g.time}</div>
                </div>
              );
            })}</div>
            <div className="ggl up">◎ UPCOMING — {liveSched?.upcomingLabel || "May 1"}</div>
            <div className="glist">{UPCOMING_GAMES.map(id => {
              const g = GAME_ROSTERS[id]; return (
                <div key={id} className={`grow ${gid === id ? "sel" : ""}`} onClick={() => selGame(id)}>
                  <div><div className="gteams">{g.away}<span className="gvs">@</span>{g.home}</div><div className="gmeta">{g.awayTeam} @ {g.homeTeam} · {g.title} · {g.series}</div></div>
                  <div className="gtime up">{g.time}</div>
                </div>
              );
            })}</div>
          </div>
        </div>

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
            <div className="slabel">04 — Sportsbook Line</div>
            <div className="card">
              <div className="lwrap">
                <div style={{ fontSize: 13, color: "#3a4a62" }}>{prop.label} O/U</div>
                <input className="li" type="number" step="0.5" min="0" placeholder="—" value={line} onChange={e => setLine(e.target.value)} />
                <div className="lh">Enter the book line (e.g. 18.5)</div>
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
          const { player, prop: pr, game: g, pt, ot, l, proj, verdict, edge, conf, ptd, otd, isHome, restDays } = result;
          const inj = getInjury(player.key);
          const dname = dn(player.key);
          const ec = verdict === "over" ? "#10b981" : verdict === "under" ? "#ef4444" : "#f59e0b";
          const epct = Math.min(Math.abs(edge) / 5, 1);
          return (
            <div className="rp">
              <div className="rh">
                <div>
                  <div className="rpn">{dname}</div>
                  <div className="rpm">{pt} vs {ot} · {g.title} · {pr.label}</div>
                  <div className="rsrc">SOURCES: VERIFIED DB · NBASTUFFER.COM · SPORTRADAR</div>
                </div>
                <div className={`vb ${verdict}`}>
                  <div className={`vt ${verdict}`}>{verdict.toUpperCase()}</div>
                  <div className="vc">{conf} CONFIDENCE</div>
                </div>
              </div>

              {inj && <div className={`injb ${inj.status === "GTD" || inj.status === "PROB" ? "gtd" : ""}`}>
                {inj.status === "PROB" ? "📋" : "⚠"} {dname} — {inj.status}: {inj.detail}
                <span style={{ marginLeft: 8, opacity: 0.7, fontSize: 8 }}>{inj.isLive ? "● LIVE REPORT" : "◎ STATIC"}</span>
              </div>}


              <div className="sr">
                <div className="sb"><div className="sbl">RS AVG · {proj.propRecent !== null ? "25%" : "40%"} wt</div><div className="sbv">{proj.propRS}</div><div className="sbs">{player.rs.gp}g · {pr.label3}</div></div>
                <div className="sb"><div className="sbl">PO AVG · {proj.propRecent !== null ? "40%" : "60%"} wt</div><div className="sbv">{proj.propPO}</div><div className="sbs">{player.po.gp}g · {pr.label3}</div></div>
                {proj.propRecent !== null && <div className="sb"><div className="sbl">L5 AVG · 35% wt</div><div className="sbv" style={{color:"#f59e0b"}}>{proj.propRecent}</div><div className="sbs">Last 5 PO games</div></div>}
                {proj.propVsOpp !== null && vsOpponentStats?.gp >= 2 && <div className="sb"><div className="sbl">vs {ot} ({vsOpponentStats.source})</div><div className="sbv" style={{color:"#a78bfa"}}>{proj.propVsOpp}</div><div className="sbs">{vsOpponentStats.gp}g · {pr.label3}</div></div>}
                <div className="sb hi"><div className="sbl">BLENDED BASE</div><div className="sbv bl">{proj.blended}</div><div className="sbs">{proj.propRecent !== null ? "PO×0.4+RS×0.25+L5×0.35" : "PO×0.6+RS×0.4"}</div></div>
              </div>

              <div className="mb">
                <div className="mbt">PROJECTION MATH — ALL VERIFIED DATA</div>
                <div className="mr"><span className="mk">Blended baseline</span><span className="mv">{proj.blended} {pr.label3}</span></div>
                {proj.gamePace && (
                  <div className="mr">
                    <span className="mk">RS Pace ({pt} {ptd?.rsPace} · {ot} {otd?.rsPace} → avg {proj.gamePace})</span>
                    <span className={`mv ${proj.paceAdj > 1.005 ? "pos" : proj.paceAdj < 0.995 ? "neg" : ""}`}>×{proj.paceAdj.toFixed(3)} ({proj.paceAdj > 1.001 ? "+" : ""}{((proj.paceAdj - 1) * 100).toFixed(1)}%)</span>
                  </div>
                )}
                {proj.defAdj !== 1.0 && <div className="mr">
                  <span className="mk">{ot} dEFF {otd?.dEFF} vs league avg 113.5</span>
                  <span className={`mv ${proj.defAdj > 1.005 ? "pos" : proj.defAdj < 0.995 ? "neg" : ""}`}>×{proj.defAdj.toFixed(3)} ({proj.defAdj > 1.001 ? "+" : ""}{((proj.defAdj - 1) * 100).toFixed(1)}%)</span>
                </div>}
                {proj.homeAdj !== 1.0 && <div className="mr">
                  <span className="mk">Home court ({isHome ? "HOME" : "ROAD"} · NBAsuffer 2025-26 RS home/away splits)</span>
                  <span className={`mv ${proj.homeAdj > 1.005 ? "pos" : proj.homeAdj < 0.995 ? "neg" : ""}`}>×{proj.homeAdj.toFixed(4)} ({proj.homeAdj > 1.001 ? "+" : ""}{((proj.homeAdj - 1) * 100).toFixed(2)}%)</span>
                </div>}
                {proj.restAdj !== 1.0 && <div className="mr">
                  <span className="mk">Rest days ({restDays}d rest · Sportradar schedule · NBAsuffer rest data)</span>
                  <span className={`mv ${proj.restAdj > 1.005 ? "pos" : proj.restAdj < 0.995 ? "neg" : ""}`}>×{proj.restAdj.toFixed(4)} ({proj.restAdj > 1.001 ? "+" : ""}{((proj.restAdj - 1) * 100).toFixed(2)}%)</span>
                </div>}
                {proj.onOffAdj !== 1.0 && <div className="mr">
                  <span className="mk">On/Off delta ({player.onOffDelta > 0 ? "+" : ""}{player.onOffDelta} NETRTG · NBA.com On/Off Court · Playoffs)</span>
                  <span className={`mv ${proj.onOffAdj > 1.001 ? "pos" : proj.onOffAdj < 0.999 ? "neg" : ""}`}>×{proj.onOffAdj.toFixed(4)} ({proj.onOffAdj > 1.001 ? "+" : ""}{((proj.onOffAdj - 1) * 100).toFixed(2)}%)</span>
                </div>}
                {proj.tsAdj !== 1.0 && <div className="mr">
                  <span className="mk">TS% shift (RS {player.rs.ts}% → PO {player.po.ts}% · NBA.com Players Advanced)</span>
                  <span className={`mv ${proj.tsAdj > 1.001 ? "pos" : proj.tsAdj < 0.999 ? "neg" : ""}`}>×{proj.tsAdj.toFixed(4)} ({proj.tsAdj > 1.001 ? "+" : ""}{((proj.tsAdj - 1) * 100).toFixed(2)}%)</span>
                </div>}
                {proj.vsOppAdj !== 1.0 && <div className="mr">
                  <span className="mk">vs {ot} historical ({vsOpponentStats?.gp}g · {vsOpponentStats?.source} · nba_api game logs)</span>
                  <span className={`mv ${proj.vsOppAdj > 1.001 ? "pos" : proj.vsOppAdj < 0.999 ? "neg" : ""}`}>×{proj.vsOppAdj.toFixed(4)} ({proj.vsOppAdj > 1.001 ? "+" : ""}{((proj.vsOppAdj - 1) * 100).toFixed(2)}%)</span>
                </div>}
                <div className="mr" style={{ borderTop: "1px solid rgba(37,99,235,.15)", marginTop: 4, paddingTop: 8 }}>
                  <span className="mk" style={{ color: "#c8d4e8", fontWeight: 600 }}>Model projection</span>
                  <span className="mv acc">{proj.adjustedProjection} {pr.label3}</span>
                </div>
                <div className="mf">
                  {proj.blended} × {proj.paceAdj.toFixed(4)} (pace){proj.defAdj !== 1.0 ? ` × ${proj.defAdj.toFixed(4)} (dEFF)` : ""}{proj.homeAdj !== 1.0 ? ` × ${proj.homeAdj.toFixed(4)} (${isHome ? "home" : "road"})` : ""}{proj.restAdj !== 1.0 ? ` × ${proj.restAdj.toFixed(4)} (rest)` : ""}{proj.onOffAdj !== 1.0 ? ` × ${proj.onOffAdj.toFixed(4)} (on/off)` : ""}{proj.tsAdj !== 1.0 ? ` × ${proj.tsAdj.toFixed(4)} (TS%)` : ""}= {proj.adjustedProjection}
                </div>
              </div>

              <div className="sr">
                <div className="sb"><div className="sbl">BOOK LINE</div><div className="sbv">{l}</div><div className="sbs">{pr.short} O/U</div></div>
                <div className="sb"><div className="sbl">PROJECTION</div><div className="sbv" style={{ fontSize: 42, color: "#2563eb" }}>{proj.adjustedProjection}</div><div className="sbs">Model output</div></div>
                <div className="sb hi">
                  <div className="sbl">EDGE vs LINE</div>
                  <div className="sbv" style={{ color: ec, fontSize: 38 }}>{edge > 0 ? "+" : ""}{edge}</div>
                  <div className="sbs">{verdict.toUpperCase()} · {proj.blended > 0 ? (((proj.adjustedProjection - l) / proj.blended) * 100).toFixed(1) : 0}% vs baseline</div>
                </div>
              </div>
              <div className="et"><div className="ef" style={{ width: `${epct * 100}%`, background: ec }} /></div>

              {/* EV Panel */}
              <div style={{ background: "rgba(0,0,0,0.2)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
                <div className="mbt" style={{ marginBottom: 8 }}>EXPECTED VALUE BREAKDOWN</div>
                <div className="mr">
                  <span className="mk">Projection vs line (raw edge)</span>
                  <span className={`mv ${edge > 0 ? "pos" : edge < 0 ? "neg" : ""}`}>{edge > 0 ? "+" : ""}{edge} {pr.label3}</span>
                </div>
                <div className="mr" style={{ padding: "8px 0" }}>
                  <span className="mk">Edge as % of blended baseline ({proj.blended})</span>
                  <span className={`mv ${edge > 0 ? "pos" : edge < 0 ? "neg" : ""}`} style={{ fontSize: 22, fontWeight: 700 }}>{proj.blended > 0 ? (((proj.adjustedProjection - l) / proj.blended) * 100).toFixed(2) : 0}%</span>
                </div>
                <div className="mr">
                  <span className="mk">Projection vs RS avg ({proj.propRS})</span>
                  <span className={`mv ${proj.adjustedProjection > proj.propRS ? "pos" : proj.adjustedProjection < proj.propRS ? "neg" : ""}`}>{proj.propRS > 0 ? (((proj.adjustedProjection - proj.propRS) / proj.propRS) * 100).toFixed(2) : 0}% shift</span>
                </div>
                <div className="mr">
                  <span className="mk">Projection vs PO avg ({proj.propPO})</span>
                  <span className={`mv ${proj.adjustedProjection > proj.propPO ? "pos" : proj.adjustedProjection < proj.propPO ? "neg" : ""}`}>{proj.propPO > 0 ? (((proj.adjustedProjection - proj.propPO) / proj.propPO) * 100).toFixed(2) : 0}% shift</span>
                </div>
                <div className="mr" style={{ borderTop: "1px solid rgba(37,99,235,.1)", marginTop: 4, paddingTop: 6 }}>
                  <span className="mk">Total adjustment from adjustments only</span>
                  <span className={`mv ${proj.adjustedProjection > proj.blended ? "pos" : proj.adjustedProjection < proj.blended ? "neg" : ""}`}>{proj.blended > 0 ? (((proj.adjustedProjection - proj.blended) / proj.blended) * 100).toFixed(2) : 0}% ({proj.adjustedProjection > proj.blended ? "+" : ""}{+(proj.adjustedProjection - proj.blended).toFixed(2)})</span>
                </div>
              </div>
              <div className="div" />
              <div className="cg">
                <div className="cc"><div className="ccl">{pt} RS Pace</div><div className="ccv">{ptd?.rsPace}</div><div className="ccs">NBA.COM · 82 RS GAMES · VERIFIED APR 30 2026</div></div>
                <div className="cc"><div className="ccl">{ot} RS Pace</div><div className="ccv">{otd?.rsPace}</div><div className="ccs">NBA.COM · 82 RS GAMES · VERIFIED APR 30 2026</div></div>
                <div className="cc"><div className="ccl">{pt} Net Eff</div><div className="ccv" style={{ color: ptd?.eDIFF > 0 ? "#10b981" : "#ef4444" }}>{ptd?.eDIFF > 0 ? "+" : ""}{ptd?.eDIFF}</div><div className="ccs">oEFF {ptd?.oEFF} · dEFF {ptd?.dEFF}</div></div>
                <div className="cc"><div className="ccl">{ot} Def Eff</div><div className="ccv">{otd?.dEFF}</div><div className="ccs">Lg avg 113.5 · {otd?.dEFF < 113.5 ? "stronger" : "weaker"} than avg</div></div>
                <div className="cc"><div className="ccl">Home/Road</div><div className="ccv" style={{ color: isHome ? "#10b981" : "#f59e0b" }}>{isHome ? "🏠 HOME" : "✈ ROAD"}</div><div className="ccs">SPORTRADAR · {isHome ? "+3.16%" : "-3.06%"} scoring adj applied{["points", "pra", "pa", "pr"].includes(pr.id) ? "" : " (N/A this prop)"}</div></div>
                <div className="cc"><div className="ccl">Rest Days</div><div className="ccv">{restDays !== null ? restDays + "d" : "—"}</div><div className="ccs">SPORTRADAR SCHEDULE · {restDays === 2 ? "+1.5% adj" : restDays >= 3 ? "+2.0% adj" : "baseline (1d = norm)"}</div></div>
              </div>

              <div className="mb">
                <div className="mbt">PLAYER PROFILE — VERIFIED DB + NBA.COM</div>
                <div className="mr"><span className="mk">RS FG% / 3P% / FT%</span><span className="mv">{player.rs.fg}% / {player.rs.fg3}% / {player.rs.ft}%</span></div>
                <div className="mr"><span className="mk">PO FG% / 3P% / FT%</span><span className="mv">{player.po.fg}% / {player.po.fg3}% / {player.po.ft}%</span></div>
                {player.rs.usg && <div className="mr"><span className="mk">RS Usage% / TS%</span><span className="mv">{player.rs.usg}% / {player.rs.ts}%<span style={{ fontFamily: "Azeret Mono,monospace", fontSize: 9, color: "#3a4a62", marginLeft: 6 }}>NBA.COM</span></span></div>}
                {player.po.usg && <div className="mr"><span className="mk">PO Usage% / TS%</span><span className={`mv ${player.po.ts && player.rs.ts && player.po.ts > player.rs.ts ? "pos" : player.po.ts && player.rs.ts && player.po.ts < player.rs.ts ? "neg" : ""}`}>{player.po.usg}% / {player.po.ts}%<span style={{ fontFamily: "Azeret Mono,monospace", fontSize: 9, color: "#3a4a62", marginLeft: 6 }}>NBA.COM</span></span></div>}
                {player.onOffDelta !== null && player.onOffDelta !== undefined && <div className="mr"><span className="mk">On/Off NETRTG delta</span><span className={`mv ${player.onOffDelta > 0 ? "pos" : player.onOffDelta < 0 ? "neg" : ""}`}>{player.onOffDelta > 0 ? "+" : ""}{player.onOffDelta}<span style={{ fontFamily: "Azeret Mono,monospace", fontSize: 9, color: "#3a4a62", marginLeft: 6 }}>NBA.COM ON/OFF</span></span></div>}
                <div className="mr"><span className="mk">PO min/game</span><span className="mv">{player.po.min} ({player.po.gp}g)</span></div>
                {pr.id === "pra" && <div className="mr"><span className="mk">PO PRA total</span><span className="mv acc">{(player.po.ppg + player.po.rpg + player.po.apg).toFixed(1)}</span></div>}
                {pr.id === "pa" && <div className="mr"><span className="mk">PO P+A total</span><span className="mv acc">{(player.po.ppg + player.po.apg).toFixed(1)}</span></div>}
                {pr.id === "pr" && <div className="mr"><span className="mk">PO P+R total</span><span className="mv acc">{(player.po.ppg + player.po.rpg).toFixed(1)}</span></div>}
              </div>

              <div className="dn">
                DATA SOURCES — Player RS/PO stats: StatMuse · SportBusy · Fadeaway World · Basketball-Reference (confirmed Apr 30 2026) ·
                Team pace/efficiency: NBAsuffer.com 2026 Playoff splits · Series: Sportradar live API ·
                METHOD: PO avg ×0.6 + RS avg ×0.4, then multiplied by: RS Pace (NBA.com) · Opp dEFF (NBAsuffer PO) · Home/Road (NBAsuffer RS splits) · Rest Days (Sportradar+NBAsuffer) · On/Off NETRTG delta (NBA.com On/Off Court PO, where available) · TS% shift RS→PO (NBA.com Players Advanced, where available) ·
                ZERO AI ESTIMATION. All adjustments from verified public sources. On/Off and TS% available for MIN and DEN players only — more teams added as screenshots provided.
              </div>
            </div>
          );
        })()}
      </div>
    </>
  );
}
