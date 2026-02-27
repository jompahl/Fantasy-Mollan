import { NextResponse } from "next/server";

const SHEET_ID = "1Yn8-DvcCCHG0dkb588tGdjruPXE8h7SDi2DM-yV_ZXg";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=1520740865`;

const POINTS_PER_GOAL = 5;
const POINTS_PER_ASSIST = 3;

export interface PlayerPoints {
  name: string;
  goals: number;
  assists: number;
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
      const calculatedColIndex = headerCols.findIndex(
        (c) => c.trim().toLowerCase() === "calculated"
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

        const goals = parseInt(cols[2]) || 0;
        const assists = parseInt(cols[3]) || 0;
        players.push({ name, goals, assists, points: goals * POINTS_PER_GOAL + assists * POINTS_PER_ASSIST });
      }

      return [{ number: idx + 1, players }];
    });

    return NextResponse.json({ gameweeks });
  } catch {
    return NextResponse.json({ error: "Could not load gameweek data" }, { status: 500 });
  }
}
