import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const SHEET_ID = "1Yn8-DvcCCHG0dkb588tGdjruPXE8h7SDi2DM-yV_ZXg";
const CSV_URL = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/export?format=csv&gid=0`;

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST() {
  try {
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error(`Sheet fetch failed: ${res.status} ${res.statusText}`);

    const text = await res.text();
    const lines = text.split("\n");

    const headerIndex = lines.findIndex(
      (l) => l.split(",")[0].trim().toLowerCase() === "player"
    );
    if (headerIndex === -1) {
      return NextResponse.json({ error: "Could not find Player column in sheet" }, { status: 500 });
    }

    const header = lines[headerIndex].split(",").map((h) => h.trim().toLowerCase());
    const playerCol = header.indexOf("player");
    const positionCol = header.indexOf("position");
    const priceCol = header.indexOf("price");
    const imageCol = header.indexOf("image");
    const imageRotationCol = header.findIndex(
      (h) => h === "image rotation" || h === "image_rotation" || h === "rotation"
    );

    const rows: object[] = [];
    for (const line of lines.slice(headerIndex + 1)) {
      const cols = line.split(",");
      const name = cols[playerCol]?.trim().replace(/^"|"$/g, "");
      if (!name) continue;
      const price = parseFloat(cols[priceCol]?.trim() ?? "0") || 0;
      rows.push({
        name,
        position: cols[positionCol]?.trim() ?? "",
        start_price: price,
        current_price: price,
        image: imageCol >= 0 ? cols[imageCol]?.trim().replace(/^"|"$/g, "") || null : null,
        image_rotation: imageRotationCol >= 0 ? parseFloat(cols[imageRotationCol]?.trim() ?? "0") || 0 : 0,
      });
    }

    if (rows.length === 0) {
      return NextResponse.json({ error: "No players found in sheet" }, { status: 500 });
    }

    // ignoreDuplicates: true means existing players are left untouched (prices preserved)
    const { error } = await supabase
      .from("players")
      .upsert(rows, { onConflict: "name", ignoreDuplicates: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, seeded: rows.length });
  } catch (err) {
    console.error("[seed-players] error:", err);
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
