import { NextResponse } from "next/server";

const SHEET_ID = "1Yn8-DvcCCHG0dkb588tGdjruPXE8h7SDi2DM-yV_ZXg";
const GAMEWEEK_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=1520740865`;
const PLAYERS_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;
const TEAMS_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=760832495`;

const APPEARANCE_POINTS_UNDER_45 = 1;
const APPEARANCE_POINTS_45_OR_MORE = 2;
const GOAL_POINTS = {
  DEF: 6,
  MID: 5,
  FWD: 4,
} as const;
const ASSIST_POINTS = 3;
const CLEAN_SHEET_POINTS = {
  DEF: 4,
  MID: 1,
} as const;
const PENALTY_MISS_POINTS = -2;
const MAN_OF_THE_MATCH_POINTS = 3;
const GOALS_CONCEDED_PENALTY_PER_2 = -1;
const YELLOW_CARD_POINTS = -1;
const RED_CARD_POINTS = -3;
const OWN_GOAL_POINTS = -2;

export interface PointsBreakdownItem {
  label: string;
  value: number | boolean;
  points: number;
}

export interface PlayerPoints {
  name: string;
  position: string;
  goals: number;
  assists: number;
  minutes: number;
  goalsConceded: number;
  penaltyMisses: number;
  yellowCards: number;
  redCards: number;
  ownGoals: number;
  manOfTheMatch: boolean;
  started: boolean;
  breakdown: PointsBreakdownItem[];
  points: number;
}

export interface Gameweek {
  number: number;
  players: PlayerPoints[];
  opponent?: string;
  homeAway?: "home" | "away";
  score?: string;
  opponentImage?: string;
}

function normalizeName(name: string): string {
  return name.trim().toLowerCase();
}

function normalizePosition(position: string): "DEF" | "MID" | "FWD" | "GK" | "UNKNOWN" {
  const p = position.trim().toUpperCase();
  if (p === "DEF" || p.startsWith("DEFEND")) return "DEF";
  if (p === "MID" || p.startsWith("MID")) return "MID";
  if (p === "FWD" || p === "FW" || p.startsWith("FORW") || p.startsWith("STRIK")) return "FWD";
  if (p === "GK" || p.startsWith("GOALKEEP")) return "GK";
  return "UNKNOWN";
}

function fantasyPosition(position: string): "DEF" | "MID" | "FWD" | "UNKNOWN" {
  const normalized = normalizePosition(position);
  if (normalized === "GK") return "DEF";
  if (normalized === "DEF" || normalized === "MID" || normalized === "FWD") return normalized;
  return "UNKNOWN";
}

function findColumnIndex(header: string[], aliases: string[]): number {
  return header.findIndex((c) => aliases.includes(c.trim().toLowerCase()));
}

function toNumber(value: string | undefined): number {
  if (!value) return 0;
  const parsed = parseFloat(value.trim());
  return Number.isFinite(parsed) ? parsed : 0;
}

function toBoolean(value: string | undefined): boolean {
  if (!value) return false;
  const normalized = value.trim().toLowerCase();
  return normalized === "true" || normalized === "1" || normalized === "yes" || normalized === "x";
}

async function fetchTeamImageMap(): Promise<Map<string, string>> {
  const res = await fetch(TEAMS_CSV_URL, { cache: "no-store" });
  if (!res.ok) return new Map();

  const text = await res.text();
  const lines = text.split("\n").filter((l) => l.trim());
  if (lines.length === 0) return new Map();

  const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
  const teamCol = findColumnIndex(header, ["team", "name", "club"]);
  const imageCol = findColumnIndex(header, ["image"]);
  if (teamCol === -1 || imageCol === -1) return new Map();

  const map = new Map<string, string>();
  for (const line of lines.slice(1)) {
    const cols = line.split(",");
    const team = cols[teamCol]?.trim().replace(/^"|"$/g, "");
    if (!team) continue;
    const imageRaw = cols[imageCol]?.trim().replace(/^"|"$/g, "").trim();
    if (!imageRaw) continue;
    const image = imageRaw.startsWith("http") ? imageRaw : `/${encodeURIComponent(imageRaw)}`;
    map.set(team.toLowerCase(), image);
  }
  return map;
}

async function fetchPlayerPositionMap(): Promise<Map<string, string>> {
  const res = await fetch(PLAYERS_CSV_URL, { cache: "no-store" });
  if (!res.ok) return new Map();

  const text = await res.text();
  const lines = text.split("\n");
  const headerIndex = lines.findIndex(
    (l) => l.split(",")[0].trim().toLowerCase() === "player"
  );
  if (headerIndex === -1) return new Map();

  const header = lines[headerIndex].split(",").map((h) => h.trim().toLowerCase());
  const playerCol = header.indexOf("player");
  const positionCol = findColumnIndex(header, ["position", "pos"]);
  if (playerCol === -1 || positionCol === -1) return new Map();

  const map = new Map<string, string>();
  for (const line of lines.slice(headerIndex + 1)) {
    const cols = line.split(",");
    const name = cols[playerCol]?.trim().replace(/^"|"$/g, "");
    if (!name) continue;
    const position = cols[positionCol]?.trim() ?? "";
    map.set(normalizeName(name), position);
  }
  return map;
}

export async function GET() {
  try {
    const [res, playerPositionMap, teamImageMap] = await Promise.all([
      fetch(GAMEWEEK_CSV_URL, { cache: "no-store" }),
      fetchPlayerPositionMap(),
      fetchTeamImageMap(),
    ]);
    if (!res.ok) throw new Error("Failed to fetch");

    const text = await res.text();
    const lines = text.split("\n");

    // Find all "Players" header rows — each one marks a new gameweek table
    const headerIndices: number[] = [];
    lines.forEach((line, i) => {
      if (line.split(",")[0].trim() === "Players") headerIndices.push(i);
    });

    const gameweeks: Gameweek[] = headerIndices.flatMap((start, idx) => {
      const end = idx + 1 < headerIndices.length ? headerIndices[idx + 1] : lines.length;
      const headerCols = lines[start].split(",");
      const normalizedHeader = headerCols.map((c) => c.trim().toLowerCase());
      const calculatedColIndex = findColumnIndex(normalizedHeader, ["calculated"]);
      const opponentColIndex = findColumnIndex(normalizedHeader, ["opponent"]);
      const homeAwayColIndex = findColumnIndex(normalizedHeader, ["home/away", "homeaway", "home_away"]);
      const scoreColIndex = findColumnIndex(normalizedHeader, ["score"]);
      const minutesColIndex = findColumnIndex(normalizedHeader, ["minutes", "minutes played", "mins"]);
      const goalsColIndex = findColumnIndex(normalizedHeader, ["goals", "goal"]);
      const assistsColIndex = findColumnIndex(normalizedHeader, ["assists", "assist"]);
      const concededColIndex = findColumnIndex(normalizedHeader, ["goals conceded", "conceded", "goals_conceded"]);
      const penaltyMissColIndex = findColumnIndex(normalizedHeader, ["penalty miss", "penalties missed", "penalty missed", "penalty misses"]);
      const motmColIndex = findColumnIndex(normalizedHeader, ["man of the match", "motm"]);
      const yellowCardsColIndex = findColumnIndex(normalizedHeader, ["yellow card", "yellow cards", "yellow"]);
      const redCardsColIndex = findColumnIndex(normalizedHeader, ["red card", "red cards", "red"]);
      const ownGoalsColIndex = findColumnIndex(normalizedHeader, ["own goal", "own goals"]);
      const startedColIndex = findColumnIndex(normalizedHeader, ["started"]);
      const positionColIndex = findColumnIndex(normalizedHeader, ["position", "pos"]);

      // Skip this gameweek if Calculated is not TRUE on the first player row
      const firstDataLine = lines.slice(start + 1, end).find((l) => {
        const name = l.split(",")[0].trim().replace(/^"|"$/g, "");
        return name && /[a-zA-ZäöåÄÖÅ]/.test(name);
      });
      if (!firstDataLine) return [];
      const firstCols = firstDataLine.split(",");
      const calculated = calculatedColIndex >= 0 ? toBoolean(firstCols[calculatedColIndex]) : false;
      if (!calculated) return [];

      const opponent = (opponentColIndex >= 0 ? firstCols[opponentColIndex]?.trim() : "")
        ?.replace(/^"|"$/g, "").trim() || undefined;
      const homeAwayRaw = (homeAwayColIndex >= 0 ? firstCols[homeAwayColIndex]?.trim() : "")
        ?.replace(/^"|"$/g, "").trim().toLowerCase() ?? "";
      const homeAway: "home" | "away" | undefined =
        homeAwayRaw === "home" || homeAwayRaw === "hemma" || homeAwayRaw === "h" ? "home"
        : homeAwayRaw === "away" || homeAwayRaw === "borta" || homeAwayRaw === "b" ? "away"
        : undefined;
      const score = (scoreColIndex >= 0 ? firstCols[scoreColIndex]?.trim() : "")
        ?.replace(/^"|"$/g, "").trim() || undefined;
      const opponentImage = opponent ? teamImageMap.get(opponent.toLowerCase()) : undefined;

      const players: PlayerPoints[] = [];
      for (const line of lines.slice(start + 1, end)) {
        const cols = line.split(",");
        const name = cols[0].trim().replace(/^"|"$/g, "");
        if (!name) continue;
        // Skip summary/total rows (e.g. "990" minutes row — no letters in name)
        if (!/[a-zA-ZäöåÄÖÅ]/.test(name)) continue;

        const minutes = minutesColIndex >= 0 ? toNumber(cols[minutesColIndex]) : 0;
        const goals = goalsColIndex >= 0 ? toNumber(cols[goalsColIndex]) : 0;
        const assists = assistsColIndex >= 0 ? toNumber(cols[assistsColIndex]) : 0;
        const goalsConceded = concededColIndex >= 0 ? toNumber(cols[concededColIndex]) : 0;
        const penaltyMisses = penaltyMissColIndex >= 0 ? toNumber(cols[penaltyMissColIndex]) : 0;
        const yellowCards = yellowCardsColIndex >= 0 ? toNumber(cols[yellowCardsColIndex]) : 0;
        const redCards = redCardsColIndex >= 0 ? toNumber(cols[redCardsColIndex]) : 0;
        const ownGoals = ownGoalsColIndex >= 0 ? toNumber(cols[ownGoalsColIndex]) : 0;
        const manOfTheMatch = motmColIndex >= 0 ? toBoolean(cols[motmColIndex]) : false;
        const started = startedColIndex >= 0 ? toBoolean(cols[startedColIndex]) : false;

        const sheetPosition = positionColIndex >= 0 ? cols[positionColIndex]?.trim() ?? "" : "";
        const position = playerPositionMap.get(normalizeName(name)) ?? sheetPosition;
        const posForRules = fantasyPosition(position);

        const breakdown: PointsBreakdownItem[] = [];
        let points = 0;
        if (minutes > 0 && minutes < 45) {
          points += APPEARANCE_POINTS_UNDER_45;
          breakdown.push({ label: "Played up to 45 min", value: minutes, points: APPEARANCE_POINTS_UNDER_45 });
        }
        if (minutes >= 45) {
          points += APPEARANCE_POINTS_45_OR_MORE;
          breakdown.push({ label: "Played 45+ min", value: minutes, points: APPEARANCE_POINTS_45_OR_MORE });
        }

        if (posForRules === "DEF" || posForRules === "MID" || posForRules === "FWD") {
          const goalPoints = goals * GOAL_POINTS[posForRules];
          points += goalPoints;
          if (goals > 0) {
            breakdown.push({ label: `${posForRules} goals`, value: goals, points: goalPoints });
          }
        }

        const assistPoints = assists * ASSIST_POINTS;
        points += assistPoints;
        if (assists > 0) {
          breakdown.push({ label: "Assists", value: assists, points: assistPoints });
        }

        if (goalsConceded === 0) {
          if (posForRules === "DEF") {
            points += CLEAN_SHEET_POINTS.DEF;
            breakdown.push({ label: "Defender clean sheet", value: true, points: CLEAN_SHEET_POINTS.DEF });
          }
          if (posForRules === "MID") {
            points += CLEAN_SHEET_POINTS.MID;
            breakdown.push({ label: "Midfielder clean sheet", value: true, points: CLEAN_SHEET_POINTS.MID });
          }
        }

        if (posForRules === "DEF") {
          const concededPenaltyChunks = Math.floor(goalsConceded / 2);
          const concededPenalty = concededPenaltyChunks * GOALS_CONCEDED_PENALTY_PER_2;
          points += concededPenalty;
          if (concededPenaltyChunks > 0) {
            breakdown.push({
              label: "Defender goals conceded (per 2)",
              value: goalsConceded,
              points: concededPenalty,
            });
          }
        }

        const penaltyMissPoints = penaltyMisses * PENALTY_MISS_POINTS;
        points += penaltyMissPoints;
        if (penaltyMisses > 0) {
          breakdown.push({ label: "Penalty misses", value: penaltyMisses, points: penaltyMissPoints });
        }

        const yellowCardPoints = yellowCards * YELLOW_CARD_POINTS;
        points += yellowCardPoints;
        if (yellowCards > 0) {
          breakdown.push({ label: "Yellow cards", value: yellowCards, points: yellowCardPoints });
        }

        const redCardPoints = redCards * RED_CARD_POINTS;
        points += redCardPoints;
        if (redCards > 0) {
          breakdown.push({ label: "Red cards", value: redCards, points: redCardPoints });
        }

        const ownGoalPoints = ownGoals * OWN_GOAL_POINTS;
        points += ownGoalPoints;
        if (ownGoals > 0) {
          breakdown.push({ label: "Own goals", value: ownGoals, points: ownGoalPoints });
        }

        if (manOfTheMatch) {
          points += MAN_OF_THE_MATCH_POINTS;
          breakdown.push({ label: "Man of the match", value: true, points: MAN_OF_THE_MATCH_POINTS });
        }

        players.push({
          name,
          position,
          goals,
          assists,
          minutes,
          goalsConceded,
          penaltyMisses,
          yellowCards,
          redCards,
          ownGoals,
          manOfTheMatch,
          started,
          breakdown,
          points,
        });
      }

      return [{ number: idx + 1, players, opponent, homeAway, score, opponentImage }];
    });

    return NextResponse.json({ gameweeks });
  } catch {
    return NextResponse.json({ error: "Could not load gameweek data" }, { status: 500 });
  }
}
