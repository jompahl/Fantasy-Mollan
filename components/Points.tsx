"use client";

import { useEffect, useState } from "react";
import Pitch from "@/components/Pitch";
import { supabase } from "@/lib/supabase";
import type { PlayerPoints, Gameweek } from "@/app/api/gameweek/route";

interface SlotPlayer {
  name: string;
  position: string;
  price: number;
}

interface Props {
  userEmail: string;
}

export default function Points({ userEmail }: Props) {
  const [currentSlotPlayers, setCurrentSlotPlayers] = useState<(SlotPlayer | null)[]>(Array(5).fill(null));
  const [snapshots, setSnapshots] = useState<Map<number, (SlotPlayer | null)[]>>(new Map());
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [currentGwIndex, setCurrentGwIndex] = useState<number>(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase
        .from("team_slots")
        .select("slot_index, player_name, player_position, player_price")
        .eq("user_email", userEmail),
      supabase
        .from("gameweek_snapshots")
        .select("gameweek_number, slot_index, player_name, player_position, player_price")
        .eq("user_email", userEmail),
      fetch("/api/gameweek").then((r) => r.json()),
    ]).then(([{ data: slotData }, { data: snapshotData }, gwData]) => {
      // Current team (fallback when no snapshot exists)
      if (slotData && slotData.length > 0) {
        const current: (SlotPlayer | null)[] = Array(5).fill(null);
        for (const row of slotData) {
          current[row.slot_index] = {
            name: row.player_name,
            position: row.player_position,
            price: row.player_price,
          };
        }
        setCurrentSlotPlayers(current);
      }

      // Build snapshot map: gameweek_number → slot array
      if (snapshotData && snapshotData.length > 0) {
        const map = new Map<number, (SlotPlayer | null)[]>();
        for (const row of snapshotData) {
          if (!map.has(row.gameweek_number)) {
            map.set(row.gameweek_number, Array(5).fill(null));
          }
          map.get(row.gameweek_number)![row.slot_index] = {
            name: row.player_name,
            position: row.player_position,
            price: row.player_price,
          };
        }
        setSnapshots(map);
      }

      if (!gwData.error && gwData.gameweeks?.length > 0) {
        setGameweeks(gwData.gameweeks);
        setCurrentGwIndex(gwData.gameweeks.length - 1);
      }
      setLoaded(true);
    });
  }, [userEmail]);

  if (!loaded) {
    return <p className="text-gray-400 text-sm">Loading…</p>;
  }

  const currentGameweek = gameweeks[currentGwIndex];

  // Use snapshot for this gameweek if available, otherwise fall back to current team
  const slotPlayers = currentGameweek
    ? (snapshots.get(currentGameweek.number) ?? currentSlotPlayers)
    : currentSlotPlayers;

  const gameweekStats: PlayerPoints[] = currentGameweek?.players ?? [];

  const slotPoints = slotPlayers.map((p) => {
    if (!p) return null;
    const stat = gameweekStats.find((s) => s.name === p.name);
    return stat?.points ?? 0;
  });

  const totalPoints = slotPoints.reduce<number>((sum, pts) => sum + (pts ?? 0), 0);

  return (
    <div className="w-full md:w-60">
      {/* Gameweek navigation */}
      {gameweeks.length > 0 && (
        <div className="flex items-center justify-between mb-3">
          <button
            onClick={() => setCurrentGwIndex((i) => Math.max(0, i - 1))}
            disabled={currentGwIndex === 0}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-lg leading-none px-1"
          >
            ←
          </button>
          <span className="text-sm font-semibold text-gray-700">
            Gameweek {currentGameweek?.number ?? "—"}
          </span>
          <button
            onClick={() => setCurrentGwIndex((i) => Math.min(gameweeks.length - 1, i + 1))}
            disabled={currentGwIndex === gameweeks.length - 1}
            className="text-gray-400 hover:text-gray-600 disabled:opacity-30 text-lg leading-none px-1"
          >
            →
          </button>
        </div>
      )}
      <p className="text-sm font-medium text-gray-600 mb-2">
        Total points: {totalPoints}
      </p>
      <Pitch
        slotPlayers={slotPlayers.map((p) => p?.name ?? null)}
        slotPoints={slotPoints}
      />
    </div>
  );
}
