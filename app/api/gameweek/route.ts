import { NextResponse } from "next/server";

const SHEET_ID = "1Yn8-DvcCCHG0dkb588tGdjruPXE8h7SDi2DM-yV_ZXg";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=1520740865`;

const POINTS_PER_GOAL = 5;
const POINTS_PER_ASSIST = 3;

export interface PlayerPoints {
  name: string;
  position: string;
  goals: number;
  assists: number;
  started: boolean;
  points: number;
}

export interface Gameweek {
  number: number;
  players: PlayerPoints[];
}

export async function GET() {
  try {
    const res = await fetch(CSV_URL, { cache: "no-store" });
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
      const calculatedColIndex = headerCols.findIndex(
        (c) => c.trim().toLowerCase() === "calculated"
      );
      const goalsColIndex = normalizedHeader.indexOf("goals");
      const assistsColIndex = normalizedHeader.indexOf("assists");
      const startedColIndex = normalizedHeader.indexOf("started");
      const positionColIndex = normalizedHeader.findIndex(
        (c) => c === "position" || c === "pos"
      );

      // Skip this gameweek if Calculated is not TRUE on the first player row
      const firstDataLine = lines.slice(start + 1, end).find((l) => {
        const name = l.split(",")[0].trim().replace(/^"|"$/g, "");
        return name && /[a-zA-ZäöåÄÖÅ]/.test(name);
      });
      if (!firstDataLine) return [];
      const firstCols = firstDataLine.split(",");
      const calculated = calculatedColIndex >= 0
        ? firstCols[calculatedColIndex]?.trim().toUpperCase()
        : "";
      if (calculated !== "TRUE") return [];

      const players: PlayerPoints[] = [];
      for (const line of lines.slice(start + 1, end)) {
        const cols = line.split(",");
        const name = cols[0].trim().replace(/^"|"$/g, "");
        if (!name) continue;
        // Skip summary/total rows (e.g. "990" minutes row — no letters in name)
        if (!/[a-zA-ZäöåÄÖÅ]/.test(name)) continue;

        const goals = parseInt(cols[goalsColIndex]) || 0;
        const assists = parseInt(cols[assistsColIndex]) || 0;
        const startedValue =
          startedColIndex >= 0 ? cols[startedColIndex]?.trim().toUpperCase() : "";
        const started = startedValue === "TRUE";
        const position = positionColIndex >= 0 ? cols[positionColIndex]?.trim() ?? "" : "";
        players.push({ name, position, goals, assists, started, points: goals * POINTS_PER_GOAL + assists * POINTS_PER_ASSIST });
      }

      return [{ number: idx + 1, players }];
    });

    return NextResponse.json({ gameweeks });
  } catch {
    return NextResponse.json({ error: "Could not load gameweek data" }, { status: 500 });
  }
}
