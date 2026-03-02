"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Gameweek } from "@/app/api/gameweek/route";
import Points from "@/components/Points";
import { SLOTS } from "@/components/Pitch";

interface Standing {
  teamName: string;
  userEmail: string;
  totalPoints: number;
}

export default function League() {
  const [standings, setStandings] = useState<Standing[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [selected, setSelected] = useState<Standing | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/gameweek").then((r) => r.json()),
      supabase.from("user_teams").select("user_email, team_name, points_deducted, joined_gameweek, boost_chip"),
      supabase.from("team_slots").select("user_email, slot_index, player_name, is_captain"),
      supabase
        .from("gameweek_snapshots")
        .select("user_email, gameweek_number, slot_index, player_name, is_captain, boost_chip"),
    ]).then(([gwData, { data: teams }, { data: slots }, { data: snapshots }]) => {
      const gameweeks: Gameweek[] = gwData.gameweeks ?? [];

      const result: Standing[] = (teams ?? []).map((team) => {
        const email = team.user_email;
        let totalPoints = 0;

        const joinedGameweek: number | null = (team as { joined_gameweek?: number | null }).joined_gameweek ?? null;
        const userBoostChip = (team as { boost_chip?: string | null }).boost_chip ?? null;
        for (const gw of gameweeks) {
          if (joinedGameweek !== null && gw.number < joinedGameweek) continue;
          const snapshotSlots = (snapshots ?? []).filter(
            (s) => s.user_email === email && s.gameweek_number === gw.number
          );
          const currentCaptainSlot = (slots ?? []).find((s) => s.user_email === email && (s.is_captain === "CAPTAIN" || s.is_captain === "TRIPLE_CAPTAIN"));
          const captainForGw = snapshotSlots.length > 0
            ? (snapshotSlots.find((s) => s.is_captain === "CAPTAIN" || s.is_captain === "TRIPLE_CAPTAIN")?.player_name ?? null)
            : (currentCaptainSlot?.player_name ?? null);
          const tcActiveForGw = snapshotSlots.length > 0
            ? snapshotSlots.some((s) => s.is_captain === "TRIPLE_CAPTAIN")
            : currentCaptainSlot?.is_captain === "TRIPLE_CAPTAIN";
          const boostChipForGw = snapshotSlots.length > 0
            ? ((snapshotSlots[0] as { boost_chip?: string | null }).boost_chip ?? null)
            : userBoostChip;
          const teamSlots =
            snapshotSlots.length > 0
              ? snapshotSlots
              : (slots ?? []).filter((s) => s.user_email === email);

          for (const slot of teamSlots) {
            const stat = gw.players.find((p) => p.name === slot.player_name);
            const base = stat?.points ?? 0;
            const captainMult = slot.player_name === captainForGw ? (tcActiveForGw ? 3 : 2) : 1;
            const isBoostSlot = !!(boostChipForGw && SLOTS[slot.slot_index]?.label === boostChipForGw.replace("_BOOST", ""));
            totalPoints += base * (captainMult + (isBoostSlot ? 1 : 0));
          }
        }

        return { teamName: team.team_name, userEmail: email, totalPoints: totalPoints - (team.points_deducted ?? 0) };
      });

      result.sort((a, b) => b.totalPoints - a.totalPoints);
      setStandings(result);
      setLoaded(true);
    });
  }, []);

  if (!loaded) {
    return <p className="text-gray-400 text-sm">Loading…</p>;
  }

  if (selected) {
    return (
      <div>
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-4"
        >
          ← Back to league
        </button>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{selected.teamName}</h2>
        <Points userEmail={selected.userEmail} />
      </div>
    );
  }

  if (standings.length === 0) {
    return <p className="text-gray-400 text-sm">No teams yet.</p>;
  }

  return (
    <div className="w-full max-w-md">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider pb-2 w-8">#</th>
            <th className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wider pb-2">Team</th>
            <th className="text-right text-xs font-semibold text-gray-400 uppercase tracking-wider pb-2">Pts</th>
          </tr>
        </thead>
        <tbody>
          {standings.map((entry, i) => (
            <tr
              key={entry.teamName}
              onClick={() => setSelected(entry)}
              className={`border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors ${i === 0 ? "font-semibold" : ""}`}
            >
              <td className="py-3 text-sm text-gray-400">{i + 1}</td>
              <td className="py-3 text-sm text-gray-900">{entry.teamName}</td>
              <td className="py-3 text-sm text-gray-900 text-right">{entry.totalPoints}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
