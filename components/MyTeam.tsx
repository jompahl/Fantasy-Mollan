"use client";

import { useEffect, useState } from "react";
import Pitch from "@/components/Pitch";
import { supabase } from "@/lib/supabase";

interface SlotPlayer {
  name: string;
}

interface Props {
  userEmail: string;
  onTotalPointsChange?: (points: number) => void;
}

export default function MyTeam({ userEmail, onTotalPointsChange }: Props) {
  const [slotPlayers, setSlotPlayers] = useState<(SlotPlayer | null)[]>(Array(5).fill(null));
  const [captainName, setCaptainName] = useState<string | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [savingCaptain, setSavingCaptain] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase
        .from("team_slots")
        .select("slot_index, player_name")
        .eq("user_email", userEmail),
      supabase
        .from("user_teams")
        .select("captain_name, points_deducted")
        .eq("user_email", userEmail)
        .single(),
      supabase
        .from("gameweek_snapshots")
        .select("gameweek_number, slot_index, player_name, is_captain")
        .eq("user_email", userEmail),
      fetch("/api/gameweek").then((r) => r.json()),
    ]).then(
      ([{ data: slotData }, { data: teamData }, { data: snapshotData }, gwData]) => {
        const snapshots =
          (snapshotData as Array<{
            gameweek_number: number;
            slot_index: number;
            player_name: string;
            is_captain?: boolean;
          }> | null) ?? [];

        if (slotData && slotData.length > 0) {
          const current: (SlotPlayer | null)[] = Array(5).fill(null);
          for (const row of slotData) {
            current[row.slot_index] = { name: row.player_name };
          }
          setSlotPlayers(current);
        }
        setCaptainName(teamData?.captain_name ?? null);

        if (!gwData.error && gwData.gameweeks?.length) {
          let total = 0;
          for (const gw of gwData.gameweeks as Array<{ number: number; players: Array<{ name: string; points: number }> }>) {
            const gwSnapshots = snapshots.filter((s) => s.gameweek_number === gw.number);
            const teamSlots =
              gwSnapshots.length > 0
                ? gwSnapshots
                : (slotData ?? []).map((s) => ({ player_name: s.player_name, is_captain: false }));

            const captainForGw =
              gwSnapshots.find((s) => s.is_captain)?.player_name ?? teamData?.captain_name ?? null;

            for (const slot of teamSlots) {
              const stat = gw.players.find((p) => p.name === slot.player_name);
              const base = stat?.points ?? 0;
              total += slot.player_name === captainForGw ? base * 2 : base;
            }
          }
          total -= teamData?.points_deducted ?? 0;
          onTotalPointsChange?.(total);
        } else {
          onTotalPointsChange?.(0);
        }

        setLoaded(true);
      }
    );
  }, [userEmail, onTotalPointsChange]);

  async function selectCaptain(slotIndex: number) {
    const slot = slotPlayers[slotIndex];
    if (!slot) return;

    const nextCaptain = slot.name;
    const previousCaptain = captainName;
    setCaptainName(nextCaptain);
    setSavingCaptain(true);

    // Freeze captain history in gameweek_snapshots for already-calculated gameweeks
    // before changing captain for upcoming gameweeks.
    if (previousCaptain) {
      const gwData = await fetch("/api/gameweek").then((r) => r.json());
      const calculatedGameweeks: { number: number }[] = gwData.gameweeks ?? [];
      if (calculatedGameweeks.length > 0) {
        const [{ data: existingSnapshots }, { data: teamSlots }] = await Promise.all([
          supabase
            .from("gameweek_snapshots")
            .select("gameweek_number, slot_index, player_name, player_position, player_price, is_captain")
            .eq("user_email", userEmail),
          supabase
            .from("team_slots")
            .select("slot_index, player_name, player_position, player_price")
            .eq("user_email", userEmail),
        ]);

        const snapshotByGw = new Map<number, {
          gameweek_number: number;
          slot_index: number;
          player_name: string;
          player_position: string;
          player_price: number;
          is_captain?: boolean;
        }[]>();
        for (const row of existingSnapshots ?? []) {
          if (!snapshotByGw.has(row.gameweek_number)) snapshotByGw.set(row.gameweek_number, []);
          snapshotByGw.get(row.gameweek_number)!.push(row);
        }

        // Insert missing gameweek snapshots and freeze previous captain there.
        const insertRows = [];
        for (const gw of calculatedGameweeks) {
          if (!snapshotByGw.has(gw.number)) {
            for (const row of teamSlots ?? []) {
              insertRows.push({
                user_email: userEmail,
                gameweek_number: gw.number,
                slot_index: row.slot_index,
                player_name: row.player_name,
                player_position: row.player_position,
                player_price: row.player_price,
                is_captain: row.player_name === previousCaptain,
              });
            }
          }
        }

        if (insertRows.length > 0) {
          await supabase.from("gameweek_snapshots").insert(insertRows);
        }

        // For existing snapshots, if captain wasn't frozen yet, set it now.
        const existingGwNumbers = calculatedGameweeks
          .map((g) => g.number)
          .filter((gwNumber) => snapshotByGw.has(gwNumber));

        for (const gwNumber of existingGwNumbers) {
          const gwRows = snapshotByGw.get(gwNumber) ?? [];
          const hasCaptain = gwRows.some((r) => r.is_captain);
          if (hasCaptain) continue;

          await supabase
            .from("gameweek_snapshots")
            .update({ is_captain: false })
            .eq("user_email", userEmail)
            .eq("gameweek_number", gwNumber);

          await supabase
            .from("gameweek_snapshots")
            .update({ is_captain: true })
            .eq("user_email", userEmail)
            .eq("gameweek_number", gwNumber)
            .eq("player_name", previousCaptain);
        }
      }
    }

    const { error } = await supabase
      .from("user_teams")
      .update({ captain_name: nextCaptain })
      .eq("user_email", userEmail);
    if (error) {
      console.error("[my-team] could not persist captain:", error.message);
    }
    setSavingCaptain(false);
  }

  if (!loaded) {
    return <p className="text-gray-400 text-sm">Loading…</p>;
  }

  return (
    <div className="w-full md:w-60">
      <p className="text-sm font-medium text-gray-600 mb-2">
        Select captain for the upcoming gameweek
      </p>
      <Pitch
        onSlotClick={selectCaptain}
        slotPlayers={slotPlayers.map((p) => p?.name ?? null)}
        slotCaptains={slotPlayers.map((p) => (p?.name ? p.name === captainName : false))}
      />
      <p className="mt-3 text-sm text-gray-600">
        Captain:{" "}
        <span className="font-semibold text-gray-900">
          {captainName ?? "Not selected"}
        </span>
      </p>
      {savingCaptain && (
        <p className="text-xs text-gray-400 mt-1">Saving captain…</p>
      )}
    </div>
  );
}
