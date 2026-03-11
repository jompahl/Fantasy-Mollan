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

  // Tally weighted votes to determine ranking
  const scores: Record<string, number> = {};
  const weights = [3, 2, 1] as const;
  for (const vote of votes) {
    ([vote.player_1, vote.player_2, vote.player_3] as string[]).forEach((player, i) => {
      if (!player) return;
      scores[player] = (scores[player] ?? 0) + weights[i];
    });
  }

  // Group players by weighted score (descending).
  // Prize rule: a group qualifies only if fewer than 3 individual players scored higher
  // (i.e. their starting slot is within top-3). Prize tier = group order (3→2→1 pts).
  // e.g. 25×1, 15×2, 14×1 → 3, 2, 2, 0  (14-scorer starts at slot 4 → no prize)
  //      25×2, 20×4       → 3, 3, 2, 2, 2, 2 (20-scorers start at slot 3 ≤ 3 → prize)
  const sorted = Object.entries(scores).sort((a, b) => b[1] - a[1]);
  const prizePoints = [3, 2, 1];

  // Build groups of tied players
  const groups: { score: number; players: string[] }[] = [];
  for (const [player, score] of sorted) {
    const last = groups[groups.length - 1];
    if (last && last.score === score) {
      last.players.push(player);
    } else {
      groups.push({ score, players: [player] });
    }
  }

  const bonuses: { gameweek_number: number; player_name: string; bonus_points: number }[] = [];
  let cumulative = 0;
  for (let g = 0; g < groups.length && g < prizePoints.length; g++) {
    if (cumulative >= 3) break; // starting slot > 3, no more prizes
    const pts = prizePoints[g];
    for (const player_name of groups[g].players) {
      bonuses.push({ gameweek_number: gwNumber, player_name, bonus_points: pts });
    }
    cumulative += groups[g].players.length;
  }

  const { error } = await supabase
    .from("player_vote_bonus")
    .upsert(bonuses, { onConflict: "gameweek_number,player_name" });

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true, bonuses });
}
