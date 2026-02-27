import { NextResponse } from "next/server";

const SHEET_ID = "1Yn8-DvcCCHG0dkb588tGdjruPXE8h7SDi2DM-yV_ZXg";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

export interface Player {
  name: string;
  position: string;
  price: number;
}

export async function GET() {
  try {
    const res = await fetch(CSV_URL, { cache: "no-store" });
    console.log("[players] fetch status:", res.status, res.statusText);
    if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${res.statusText}`);

    const text = await res.text();
    console.log("[players] first 300 chars:", text.slice(0, 300));
    const lines = text.split("\n");

    // Find the header row that starts with "Player"
    const headerIndex = lines.findIndex(
      (l) => l.split(",")[0].trim().toLowerCase() === "player"
    );
    if (headerIndex === -1) {
      console.log("[players] no Player header found. First line:", lines[0]);
      return NextResponse.json({ error: "Could not find Player column in sheet" }, { status: 500 });
    }

    const header = lines[headerIndex].split(",").map((h) => h.trim().toLowerCase());
    const playerCol = header.indexOf("player");
    const positionCol = header.indexOf("position");
    const priceCol = header.indexOf("price");

    const players: Player[] = [];

    for (const line of lines.slice(headerIndex + 1)) {
      const cols = line.split(",");
      const name = cols[playerCol]?.trim().replace(/^"|"$/g, "");
      if (!name) continue;

      players.push({
        name,
        position: cols[positionCol]?.trim() ?? "",
        price: parseFloat(cols[priceCol]?.trim() ?? "0") || 0,
      });
    }

    const POSITION_ORDER = ["GK", "DEF", "MID", "FWD"];
    players.sort((a, b) => {
      const posA = POSITION_ORDER.indexOf(a.position);
      const posB = POSITION_ORDER.indexOf(b.position);
      if (posA !== posB) return posA - posB;
      return a.name.localeCompare(b.name, "sv");
    });

    return NextResponse.json({ players });
  } catch (err) {
    console.error("[players] error:", err);
    return NextResponse.json({ error: "Could not load players" }, { status: 500 });
  }
}
