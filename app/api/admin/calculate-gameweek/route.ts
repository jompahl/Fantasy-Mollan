import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

// Use service role key to bypass RLS for admin operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export async function POST(request: NextRequest) {
  try {
    const { gwNumber } = await request.json();
    if (!gwNumber || typeof gwNumber !== "number" || !Number.isInteger(gwNumber) || gwNumber < 1) {
      return NextResponse.json({ error: "Invalid GW number" }, { status: 400 });
    }

    // Verify the GW exists and is marked as calculated in the sheet
    const baseUrl = new URL(request.url).origin;
    const gwResponse = await fetch(`${baseUrl}/api/gameweek`);
    const gwData = await gwResponse.json();
    const calculatedGw = (gwData.gameweeks ?? []).find((gw: { number: number }) => gw.number === gwNumber);
    if (!calculatedGw) {
      return NextResponse.json(
        { error: "Gameweek was not calculated, please ensure that the sheet has been updated" },
        { status: 400 }
      );
    }

    const [{ data: teams }, { data: allSlots }, { data: existingSnapshots }] = await Promise.all([
      supabase.from("user_teams").select("user_email, joined_gameweek, boost_chip, transfers"),
      supabase.from("team_slots").select("user_email, slot_index, player_name, player_position, player_price, is_captain"),
      supabase.from("gameweek_snapshots").select("user_email").eq("gameweek_number", gwNumber),
    ]);

    if ((existingSnapshots ?? []).length > 0) {
      return NextResponse.json(
        { error: "There are already snapshots for this gameweek in the database" },
        { status: 400 }
      );
    }

    const alreadySnapshotted = new Set((existingSnapshots ?? []).map((s) => s.user_email));

    const snapshotRows: object[] = [];
    const usersToResetBoost: string[] = [];
    const usersToResetTC: Array<{ email: string; slotIndex: number }> = [];
    const usersToInitTransfers: string[] = [];
    const usersToIncrementTransfers: Array<{ email: string; newValue: number }> = [];

    for (const team of teams ?? []) {
      const email = team.user_email;
      const joinedGw: number | null = (team as { joined_gameweek?: number | null }).joined_gameweek ?? null;

      if (joinedGw !== null && gwNumber < joinedGw) continue;
      if (alreadySnapshotted.has(email)) continue;

      const userSlots = (allSlots ?? []).filter((s) => s.user_email === email);
      const boostChip = (team as { boost_chip?: string | null }).boost_chip ?? null;

      if (userSlots.length === 0) {
        // User never picked a team — record 5 placeholder rows so they appear in
        // the league/points history with 0 points for this GW.
        for (let i = 0; i < 5; i++) {
          snapshotRows.push({
            user_email: email,
            gameweek_number: gwNumber,
            slot_index: i,
            player_name: "NO_PLAYER_SELECTED",
            player_position: "",
            player_price: 0,
            is_captain: "NOT_CAPTAIN",
            boost_chip: null,
          });
        }
      } else {
        for (const slot of userSlots) {
          snapshotRows.push({
            user_email: email,
            gameweek_number: gwNumber,
            slot_index: slot.slot_index,
            player_name: slot.player_name,
            player_position: slot.player_position,
            player_price: slot.player_price,
            is_captain: slot.is_captain,
            boost_chip: boostChip,
          });
        }
        if (boostChip) usersToResetBoost.push(email);
        const tcSlot = userSlots.find((s) => s.is_captain === "TRIPLE_CAPTAIN");
        if (tcSlot) usersToResetTC.push({ email, slotIndex: tcSlot.slot_index });
      }

      const currentTransfers = (team as { transfers?: number | null }).transfers ?? null;
      if (currentTransfers === null) {
        usersToInitTransfers.push(email);
      } else {
        usersToIncrementTransfers.push({ email, newValue: Math.min(currentTransfers + 1, 5) });
      }
    }

    if (snapshotRows.length > 0) {
      const { error } = await supabase.from("gameweek_snapshots").insert(snapshotRows);
      if (error) return NextResponse.json({ error: `Snapshot insert failed: ${error.message}` }, { status: 500 });
    }

    for (const email of usersToResetBoost) {
      await supabase.from("user_teams").update({ boost_chip: null }).eq("user_email", email);
    }

    for (const { email, slotIndex } of usersToResetTC) {
      await supabase
        .from("team_slots")
        .update({ is_captain: "CAPTAIN" })
        .eq("user_email", email)
        .eq("slot_index", slotIndex);
    }

    // Grant 1 transfer to each snapshotted user.
    // NULL → 1 (first GW calculated for this user).
    // number → min(number + 1, 5) (rolling bank, capped at 5).
    if (usersToInitTransfers.length > 0) {
      await supabase.from("user_teams").update({ transfers: 1 }).in("user_email", usersToInitTransfers);
    }
    for (const { email, newValue } of usersToIncrementTransfers) {
      await supabase.from("user_teams").update({ transfers: newValue }).eq("user_email", email);
    }

    const usersSnapshotted = new Set(snapshotRows.map((r) => (r as { user_email: string }).user_email)).size;

    // Update player prices based on net transfers vs previous GW
    let pricesUpdated = 0;
    if (gwNumber > 1) {
      const { data: prevSnapshots } = await supabase
        .from("gameweek_snapshots")
        .select("user_email, player_name")
        .eq("gameweek_number", gwNumber - 1);

      if (prevSnapshots && prevSnapshots.length > 0) {
        // Build previous squad per user
        const prevByUser = new Map<string, Set<string>>();
        for (const s of prevSnapshots) {
          if (s.player_name === "NO_PLAYER_SELECTED") continue;
          if (!prevByUser.has(s.user_email)) prevByUser.set(s.user_email, new Set());
          prevByUser.get(s.user_email)!.add(s.player_name);
        }

        // Build current squad per user (allSlots already fetched above)
        const currentByUser = new Map<string, Set<string>>();
        for (const s of allSlots ?? []) {
          if (!currentByUser.has(s.user_email)) currentByUser.set(s.user_email, new Set());
          currentByUser.get(s.user_email)!.add(s.player_name);
        }

        // Count transfers in / out per player across all users who had a previous GW
        const transfersIn = new Map<string, number>();
        const transfersOut = new Map<string, number>();
        for (const [email, prevPlayers] of prevByUser) {
          const currPlayers = currentByUser.get(email) ?? new Set<string>();
          for (const p of prevPlayers) {
            if (!currPlayers.has(p)) transfersOut.set(p, (transfersOut.get(p) ?? 0) + 1);
          }
          for (const p of currPlayers) {
            if (!prevPlayers.has(p)) transfersIn.set(p, (transfersIn.get(p) ?? 0) + 1);
          }
        }

        // Apply ±0.1 price changes
        const { data: playerRows } = await supabase.from("players").select("name, current_price");
        for (const player of playerRows ?? []) {
          const inCount = transfersIn.get(player.name) ?? 0;
          const outCount = transfersOut.get(player.name) ?? 0;
          if (inCount === outCount) continue;
          const delta = inCount > outCount ? 0.1 : -0.1;
          const newPrice = Math.max(0.1, Math.round((player.current_price + delta) * 10) / 10);
          await supabase.from("players").update({ current_price: newPrice }).eq("name", player.name);
          pricesUpdated++;
        }
      }
    }

    return NextResponse.json({
      success: true,
      gwNumber,
      usersSnapshotted,
      chipsReset: usersToResetBoost.length + usersToResetTC.length,
      pricesUpdated,
    });
  } catch {
    return NextResponse.json({ error: "Failed to calculate gameweek" }, { status: 500 });
  }
}
