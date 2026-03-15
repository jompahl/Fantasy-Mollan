import { NextResponse } from "next/server";

const SHEET_ID = "1Yn8-DvcCCHG0dkb588tGdjruPXE8h7SDi2DM-yV_ZXg";
const TEAMS_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=760832495`;
const EMBLEMS_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=1102277657`;

function findColumnIndex(header: string[], aliases: string[]): number {
  for (const alias of aliases) {
    const idx = header.indexOf(alias);
    if (idx !== -1) return idx;
  }
  return -1;
}

export interface TeamImage {
  name: string;
  imageUrl: string;
}

export interface ImageTable {
  label: string;
  images: TeamImage[];
}

// Fetches all labelled image tables from a CSV.
// Each table is preceded by a label row (e.g. "Premier League") then a header
// row containing an "image" column (and optionally a "name"/"team"/"club" column).
async function fetchAllImageTables(url: string): Promise<ImageTable[]> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];

    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length === 0) return [];

    const tables: ImageTable[] = [];
    let currentLabel = "";
    let nameCol = -1;
    let imageCol = -1;
    let inTable = false;
    let current: TeamImage[] = [];

    for (const line of lines) {
      const cols = line.split(",").map((c) => c.trim().replace(/^"|"$/g, ""));
      const lower = cols.map((c) => c.toLowerCase());

      // Header row — contains the word "image"
      const ic = findColumnIndex(lower, ["image"]);
      if (ic !== -1) {
        if (inTable && current.length > 0) tables.push({ label: currentLabel, images: current });
        current = [];
        nameCol = findColumnIndex(lower, ["team", "name", "club"]);
        imageCol = ic;
        inTable = true;
        continue;
      }

      // Data row — first cell is a URL
      if (inTable && cols[imageCol]?.startsWith("http")) {
        const name = nameCol !== -1 ? (cols[nameCol]?.trim() ?? "") : "";
        current.push({ name, imageUrl: cols[imageCol].trim() });
        continue;
      }

      // Anything else is treated as a label row for the next table
      const firstCell = cols.find((c) => c.length > 0) ?? "";
      if (firstCell && !firstCell.startsWith("http")) {
        if (inTable && current.length > 0) {
          tables.push({ label: currentLabel, images: current });
          current = [];
          inTable = false;
        }
        currentLabel = firstCell;
      }
    }

    if (inTable && current.length > 0) tables.push({ label: currentLabel, images: current });
    return tables;
  } catch {
    return [];
  }
}

async function fetchImages(url: string): Promise<TeamImage[]> {
  const tables = await fetchAllImageTables(url);
  return tables[0]?.images ?? [];
}

export async function GET() {
  const [teams, emblemTables] = await Promise.all([
    fetchImages(TEAMS_CSV_URL),
    fetchAllImageTables(EMBLEMS_CSV_URL),
  ]);

  const premierLeague = emblemTables[0]?.images ?? [];
  const laLiga = emblemTables[1]?.images ?? [];

  return NextResponse.json({ teams, premierLeague, laLiga });
}
