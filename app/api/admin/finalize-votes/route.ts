import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const { gwNumber } = body ?? {};

  if (!gwNumber || typeof gwNumber !== "number" || !Number.isInteger(gwNumber) || gwNumber < 1) {
    return NextResponse.json({ error: "Invalid GW number" }, { status: 400 });
  }

  const { data: votes } = await supabase
    .from("gw_votes")
    .select("player_1, player_2, player_3")
    .eq("gameweek_number", gwNumber);

  if (!votes || votes.length === 0) {
    return NextResponse.json({ ok: true, bonuses: [], message: "No votes found for this GW." });
  }

  const scores: Record<string, number> = {};
  const weights = [3, 2, 1] as const;
  for (const vote of votes) {
    ([vote.player_1, vote.player_2, vote.player_3] as string[]).forEach((player, i) => {
      if (!player) return;
      scores[player] = (scores[player] ?? 0) + weights[i];
    });
  }

  const bonuses = Object.entries(scores).map(([player_name, bonus_points]) => ({
    gameweek_number: gwNumber,
    player_name,
    bonus_points,
  }));

  const { error } = await supabase
    .from("player_vote_bonus")
    .upsert(bonuses, { onConflict: "gameweek_number,player_name" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, bonuses });
}
