import { supabase } from "@/lib/supabase";

/**
 * Creates gameweek snapshots for any calculated GWs that don't have one yet.
 * Also stamps the Triple Captain and boost chips into the snapshot and resets
 * the chip state so each chip is consumed exactly once.
 *
 * Safe to call on every page load — it is a no-op when all snapshots exist.
 */
export async function ensureSnapshots(userEmail: string): Promise<void> {
  const [gwData, { data: existingSnapshots }, { data: teamSlots }, { data: teamData }] = await Promise.all([
    fetch("/api/gameweek").then((r) => r.json()),
    supabase
      .from("gameweek_snapshots")
      .select("gameweek_number")
      .eq("user_email", userEmail),
    supabase
      .from("team_slots")
      .select("slot_index, player_name, player_position, player_price, is_captain")
      .eq("user_email", userEmail),
    supabase
      .from("user_teams")
      .select("joined_gameweek, boost_chip")
      .eq("user_email", userEmail)
      .single(),
  ]);

  const gameweeks: { number: number }[] = gwData.gameweeks ?? [];
  if (gameweeks.length === 0 || !teamSlots || teamSlots.length === 0) return;

  const joinedGameweek: number | null = (teamData as { joined_gameweek?: number | null; boost_chip?: string | null } | null)?.joined_gameweek ?? null;
  const boostChip: string | null = (teamData as { joined_gameweek?: number | null; boost_chip?: string | null } | null)?.boost_chip ?? null;

  const alreadySnapshotted = new Set(
    (existingSnapshots ?? []).map((s: { gameweek_number: number }) => s.gameweek_number)
  );

  const captainSlot = teamSlots.find(
    (s: { is_captain: string }) => s.is_captain === "CAPTAIN" || s.is_captain === "TRIPLE_CAPTAIN"
  );
  const captainName = captainSlot?.player_name ?? null;
  const tcActive = captainSlot?.is_captain === "TRIPLE_CAPTAIN";

  const rows: object[] = [];
  for (const gw of gameweeks) {
    if (alreadySnapshotted.has(gw.number)) continue;
    if (joinedGameweek !== null && gw.number < joinedGameweek) continue;
    for (const slot of teamSlots) {
      const isCap = captainName !== null && slot.player_name === captainName;
      rows.push({
        user_email: userEmail,
        gameweek_number: gw.number,
        slot_index: slot.slot_index,
        player_name: slot.player_name,
        player_position: slot.player_position,
        player_price: slot.player_price,
        is_captain: isCap ? (tcActive ? "TRIPLE_CAPTAIN" : "CAPTAIN") : "NOT_CAPTAIN",
        boost_chip: boostChip,
      });
    }
  }

  if (rows.length === 0) return;

  await supabase.from("gameweek_snapshots").insert(rows);

  // TC chip consumed — reset captain slot back to CAPTAIN for future GWs
  if (rows.some((r) => (r as { is_captain: string }).is_captain === "TRIPLE_CAPTAIN")) {
    await supabase
      .from("team_slots")
      .update({ is_captain: "CAPTAIN" })
      .eq("user_email", userEmail)
      .eq("is_captain", "TRIPLE_CAPTAIN");
  }

  // Boost chip consumed — reset boost_chip in user_teams
  if (rows.some((r) => (r as { boost_chip: string | null }).boost_chip !== null)) {
    await supabase
      .from("user_teams")
      .update({ boost_chip: null })
      .eq("user_email", userEmail);
  }
}
