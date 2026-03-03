import { NextResponse } from "next/server";

const SHEET_ID = "1Yn8-DvcCCHG0dkb588tGdjruPXE8h7SDi2DM-yV_ZXg";
const TEAMS_CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=760832495`;

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

export async function GET() {
  try {
    const res = await fetch(TEAMS_CSV_URL, { cache: "no-store" });
    if (!res.ok) return NextResponse.json({ teams: [] });

    const text = await res.text();
    const lines = text.split("\n").filter((l) => l.trim());
    if (lines.length === 0) return NextResponse.json({ teams: [] });

    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const teamCol = findColumnIndex(header, ["team", "name", "club"]);
    const imageCol = findColumnIndex(header, ["image"]);
    if (teamCol === -1 || imageCol === -1) return NextResponse.json({ teams: [] });

    const teams: TeamImage[] = [];
    for (const line of lines.slice(1)) {
      const cols = line.split(",");
      const name = cols[teamCol]?.trim().replace(/^"|"$/g, "");
      if (!name) continue;
      const imageRaw = cols[imageCol]?.trim().replace(/^"|"$/g, "").trim();
      if (!imageRaw) continue;
      const imageUrl = imageRaw.startsWith("http") ? imageRaw : `/${encodeURIComponent(imageRaw)}`;
      teams.push({ name, imageUrl });
    }

    return NextResponse.json({ teams });
  } catch {
    return NextResponse.json({ teams: [] });
  }
}
