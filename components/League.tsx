"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Gameweek } from "@/app/api/gameweek/route";
import type { Player } from "@/app/api/players/route";
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
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [players, setPlayers] = useState<Player[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/gameweek").then((r) => r.json()),
      fetch("/api/players").then((r) => r.json()),
      supabase.from("user_teams").select("user_email, team_name, points_deducted, joined_gameweek"),
      supabase
        .from("gameweek_snapshots")
        .select("user_email, gameweek_number, slot_index, player_name, is_captain, boost_chip"),
    ]).then(([gwData, playersData, { data: teams }, { data: snapshots }]) => {
      const allGameweeks: Gameweek[] = gwData.gameweeks ?? [];
      const allPlayers: Player[] = playersData.players ?? [];
      setGameweeks(allGameweeks);
      setPlayers(allPlayers);

      // Pre-group snapshots by "email_gwNumber" for O(1) lookup
      const snapshotsByKey = new Map<string, Array<{ slot_index: number; player_name: string; is_captain: string; boost_chip?: string | null }>>();
      for (const s of snapshots ?? []) {
        const key = `${s.user_email}_${s.gameweek_number}`;
        if (!snapshotsByKey.has(key)) snapshotsByKey.set(key, []);
        snapshotsByKey.get(key)!.push(s);
      }

      // Pre-index player stats per gameweek for O(1) lookup
      const statsByGw = new Map<number, Map<string, { points: number }>>();
      for (const gw of allGameweeks) {
        const map = new Map<string, { points: number }>();
        for (const p of gw.players) map.set(p.name, p);
        statsByGw.set(gw.number, map);
      }

      const result: Standing[] = (teams ?? []).map((team) => {
        const email = team.user_email;
        let totalPoints = 0;

        const joinedGameweek: number | null = (team as { joined_gameweek?: number | null }).joined_gameweek ?? null;

        for (const gw of allGameweeks) {
          if (joinedGameweek !== null && gw.number < joinedGameweek) continue;

          const snapshotSlots = snapshotsByKey.get(`${email}_${gw.number}`) ?? [];
          if (snapshotSlots.length === 0) continue;

          const statsMap = statsByGw.get(gw.number) ?? new Map();
          const captainForGw = snapshotSlots.find((s) => s.is_captain === "CAPTAIN" || s.is_captain === "TRIPLE_CAPTAIN")?.player_name ?? null;
          const tcActiveForGw = snapshotSlots.some((s) => s.is_captain === "TRIPLE_CAPTAIN");
          const boostChipForGw = (snapshotSlots[0] as { boost_chip?: string | null }).boost_chip ?? null;

          for (const slot of snapshotSlots) {
            const stat = statsMap.get(slot.player_name);
            const base = stat?.points ?? 0;
            const captainMult = slot.player_name === captainForGw ? (tcActiveForGw ? 3 : 2) : 1;
            const isBoostSlot = !!(boostChipForGw && SLOTS[slot.slot_index]?.label === boostChipForGw.replace("_BOOST", ""));
            totalPoints += base * (captainMult + (isBoostSlot ? 1 : 0));
          }
        }

        return {
          teamName: team.team_name,
          userEmail: email,
          totalPoints: totalPoints - (team.points_deducted ?? 0),
        };
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
      <div className="md:w-96 md:mx-auto">
        <button
          onClick={() => setSelected(null)}
          className="flex items-center gap-1 text-sm text-gray-400 hover:text-gray-600 transition-colors mb-4"
        >
          ← Back to league
        </button>
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">{selected.teamName}</h2>
        <Points userEmail={selected.userEmail} initialGameweeks={gameweeks} initialPlayers={players} />
      </div>
    );
  }

  if (standings.length === 0) {
    return <p className="text-gray-400 text-sm">No teams yet.</p>;
  }

  return (
    <div className="w-full max-w-md md:mx-auto">
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
