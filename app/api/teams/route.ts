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

async function fetchImages(url: string): Promise<TeamImage[]> {
  try {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) return [];

    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length === 0) return [];

    // Scan for the header row — it's whichever row contains an "image" column
    let headerIdx = -1;
    let nameCol = -1;
    let imageCol = -1;
    for (let i = 0; i < lines.length; i++) {
      const cols = lines[i].split(",").map((h) => h.trim().toLowerCase().replace(/^"|"$/g, ""));
      const nc = findColumnIndex(cols, ["team", "name", "club"]);
      const ic = findColumnIndex(cols, ["image"]);
      if (ic !== -1) {
        headerIdx = i;
        nameCol = nc;
        imageCol = ic;
        break;
      }
    }
    if (headerIdx === -1 || imageCol === -1) return [];

    const results: TeamImage[] = [];
    for (const line of lines.slice(headerIdx + 1)) {
      const cols = line.split(",");
      const imageRaw = cols[imageCol]?.trim().replace(/^"|"$/g, "").trim();
      if (!imageRaw || !imageRaw.startsWith("http")) continue;
      const name = nameCol !== -1 ? (cols[nameCol]?.trim().replace(/^"|"$/g, "") ?? "") : "";
      results.push({ name, imageUrl: imageRaw });
    }
    return results;
  } catch {
    return [];
  }
}

export async function GET() {
  const [teams, premierLeague] = await Promise.all([
    fetchImages(TEAMS_CSV_URL),
    fetchImages(EMBLEMS_CSV_URL),
  ]);

  return NextResponse.json({ teams, premierLeague });
}
