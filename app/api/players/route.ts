import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export interface Player {
  name: string;
  position: string;
  price: number;
  image?: string;
  imageRotation?: number;
}

const POSITION_ORDER = ["GK", "DEF", "MID", "FWD"];

export async function GET() {
  try {
    const { data, error } = await supabase
      .from("players")
      .select("name, position, current_price, image, image_rotation");

    if (error) throw error;

    const players: Player[] = (data ?? []).map((row) => ({
      name: row.name,
      position: row.position,
      price: row.current_price,
      image: row.image ?? undefined,
      imageRotation: row.image_rotation ?? 0,
    }));

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
