import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { createClient } from "@supabase/supabase-js";

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  const session = await getServerSession();
  const userEmail = session?.user?.email;
  if (!userEmail) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const { gwNumber, player1, player2, player3 } = body ?? {};

  if (
    typeof gwNumber !== "number" ||
    !Number.isInteger(gwNumber) ||
    gwNumber < 1 ||
    typeof player1 !== "string" ||
    typeof player2 !== "string" ||
    typeof player3 !== "string" ||
    !player1.trim() ||
    !player2.trim() ||
    !player3.trim()
  ) {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  // Check vote deadline hasn't passed
  const { data: deadlineRow } = await supabase
    .from("gameweek_deadline")
    .select("vote_deadline_at")
    .eq("id", 1)
    .maybeSingle<{ vote_deadline_at: string | null }>();

  const deadline = deadlineRow?.vote_deadline_at;
  if (!deadline || new Date(deadline).getTime() <= Date.now()) {
    return NextResponse.json({ error: "Vote deadline has passed" }, { status: 403 });
  }

  const { error } = await supabase.from("gw_votes").insert({
    user_email: userEmail,
    gameweek_number: gwNumber,
    player_1: player1.trim(),
    player_2: player2.trim(),
    player_3: player3.trim(),
  });

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json({ error: "You have already voted for this gameweek" }, { status: 409 });
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
