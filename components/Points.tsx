"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Pitch from "@/components/Pitch";
import PlayerHistory from "@/components/PlayerHistory";
import { supabase } from "@/lib/supabase";
import type { PlayerPoints, Gameweek } from "@/app/api/gameweek/route";
import type { Player } from "@/app/api/players/route";

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
  const [captainName, setCaptainName] = useState<string | null>(null);
  const [snapshotCaptains, setSnapshotCaptains] = useState<Map<number, string>>(new Map());
  const [playerImages, setPlayerImages] = useState<Map<string, string>>(new Map());
  const [playerImageRotations, setPlayerImageRotations] = useState<Map<string, number>>(new Map());
  const [currentGwIndex, setCurrentGwIndex] = useState<number>(0);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [showHistory, setShowHistory] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      supabase
        .from("team_slots")
        .select("slot_index, player_name, player_position, player_price, is_captain")
        .eq("user_email", userEmail),
      supabase
        .from("gameweek_snapshots")
        .select("gameweek_number, slot_index, player_name, player_position, player_price, is_captain")
        .eq("user_email", userEmail),
      fetch("/api/players").then((r) => r.json() as Promise<{ players?: Player[]; error?: string }>),
      fetch("/api/gameweek").then((r) => r.json()),
    ]).then(([{ data: slotData }, { data: snapshotData }, playersData, gwData]) => {
      // Current team (fallback when no snapshot exists)
      let currentCaptainName: string | null = null;
      if (slotData && slotData.length > 0) {
        const current: (SlotPlayer | null)[] = Array(5).fill(null);
        for (const row of slotData) {
          current[row.slot_index] = {
            name: row.player_name,
            position: row.player_position,
            price: row.player_price,
          };
          if (row.is_captain) currentCaptainName = row.player_name;
        }
        setCurrentSlotPlayers(current);
      }

      // Build snapshot map: gameweek_number → slot array
      if (snapshotData && snapshotData.length > 0) {
        const map = new Map<number, (SlotPlayer | null)[]>();
        const captainMap = new Map<number, string>();
        for (const row of snapshotData) {
          if (!map.has(row.gameweek_number)) {
            map.set(row.gameweek_number, Array(5).fill(null));
          }
          map.get(row.gameweek_number)![row.slot_index] = {
            name: row.player_name,
            position: row.player_position,
            price: row.player_price,
          };
          if (row.is_captain) {
            captainMap.set(row.gameweek_number, row.player_name);
          }
        }
        setSnapshots(map);
        setSnapshotCaptains(captainMap);
      }

      if (!gwData.error && gwData.gameweeks?.length > 0) {
        setGameweeks(gwData.gameweeks);
        setCurrentGwIndex(gwData.gameweeks.length - 1);
      }

      const imageMap = new Map<string, string>();
      const imageRotationMap = new Map<string, number>();
      for (const player of playersData.players ?? []) {
        const key = player.name.trim().toLowerCase();
        if (player.image) imageMap.set(key, player.image);
        if (typeof player.imageRotation === "number") imageRotationMap.set(key, player.imageRotation);
      }
      setPlayerImages(imageMap);
      setPlayerImageRotations(imageRotationMap);

      setCaptainName(currentCaptainName);
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
  const captainForCurrentGw = currentGameweek
    ? (snapshots.has(currentGameweek.number)
        ? (snapshotCaptains.get(currentGameweek.number) ?? null)
        : captainName)
    : captainName;

  const slotPoints = slotPlayers.map((p) => {
    if (!p) return null;
    const stat = gameweekStats.find((s) => s.name === p.name);
    const basePoints = stat?.points ?? 0;
    return captainForCurrentGw && p.name === captainForCurrentGw ? basePoints * 2 : basePoints;
  });

  const slotGoals = slotPlayers.map((p) => {
    if (!p) return null;
    const stat = gameweekStats.find((s) => s.name === p.name);
    return stat?.goals ?? 0;
  });
  const slotAssists = slotPlayers.map((p) => {
    if (!p) return null;
    const stat = gameweekStats.find((s) => s.name === p.name);
    return stat?.assists ?? 0;
  });
  const slotYellowCards = slotPlayers.map((p) => {
    if (!p) return null;
    const stat = gameweekStats.find((s) => s.name === p.name);
    return stat?.yellowCards ?? 0;
  });
  const slotRedCards = slotPlayers.map((p) => {
    if (!p) return null;
    const stat = gameweekStats.find((s) => s.name === p.name);
    return stat?.redCards ?? 0;
  });

  const totalPoints = slotPoints.reduce<number>((sum, pts) => sum + (pts ?? 0), 0);
  const selectedPlayer = selectedSlotIndex !== null ? slotPlayers[selectedSlotIndex] : null;
  const selectedStat = selectedPlayer
    ? gameweekStats.find((s) => s.name === selectedPlayer.name)
    : null;
  const selectedPoints = selectedSlotIndex !== null ? slotPoints[selectedSlotIndex] ?? 0 : 0;
  const selectedPlayerImage = selectedPlayer
    ? playerImages.get(selectedPlayer.name.trim().toLowerCase()) ?? "/avatar.webp"
    : "/avatar.webp";
  const selectedPlayerHasCustomImage =
    selectedPlayer !== null && playerImages.has(selectedPlayer.name.trim().toLowerCase());
  const selectedPlayerImageRotation = selectedPlayer
    ? playerImageRotations.get(selectedPlayer.name.trim().toLowerCase()) ?? 0
    : 0;
  const selectedIsCaptain =
    selectedPlayer !== null && captainForCurrentGw !== null && selectedPlayer.name === captainForCurrentGw;
  const selectedBreakdown = selectedStat
    ? [
        ...selectedStat.breakdown,
        ...(selectedIsCaptain
          ? [{ label: "Captain bonus (double points)", value: true, points: selectedStat.points }]
          : []),
      ]
    : [];

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
        onSlotClick={(i) => { setSelectedSlotIndex(i); setShowHistory(false); }}
        slotPlayers={slotPlayers.map((p) => p?.name ?? null)}
        slotPoints={slotPoints}
        slotGoals={slotGoals}
        slotAssists={slotAssists}
        slotYellowCards={slotYellowCards}
        slotRedCards={slotRedCards}
        slotCaptains={slotPlayers.map((p) => (p?.name ? p.name === captainForCurrentGw : false))}
      />

      {selectedSlotIndex !== null && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => { setSelectedSlotIndex(null); setShowHistory(false); }}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
              {showHistory ? (
                <button
                  onClick={() => setShowHistory(false)}
                  className="text-gray-400 hover:text-gray-600 text-lg leading-none mr-2"
                >
                  ←
                </button>
              ) : null}
              {!showHistory && selectedPlayer && (
                <div className="w-10 h-10 rounded-xl overflow-hidden border border-gray-200 bg-white mr-2">
                  <Image
                    src={selectedPlayerImage}
                    alt={selectedPlayer.name}
                    width={40}
                    height={40}
                    className="w-full h-full object-cover"
                    style={
                      selectedPlayerHasCustomImage
                        ? {
                            objectPosition: "center 22%",
                            transform: `scale(1.18) rotate(${selectedPlayerImageRotation}deg)`,
                          }
                        : undefined
                    }
                    unoptimized
                  />
                </div>
              )}
              <h3 className="text-base font-semibold text-gray-900 flex-1">
                {showHistory ? `${selectedPlayer?.name ?? "Player"} — History` : (selectedPlayer?.name ?? "Empty slot")}
              </h3>
              <button
                onClick={() => { setSelectedSlotIndex(null); setShowHistory(false); }}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="px-5 py-4">
              {!selectedPlayer ? (
                <p className="text-sm text-gray-500">No player selected in this slot.</p>
              ) : showHistory ? (
                <PlayerHistory playerName={selectedPlayer.name} gameweeks={gameweeks} />
              ) : !selectedStat ? (
                <p className="text-sm text-gray-500">No game data found for this player in this gameweek.</p>
              ) : (
                <>
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Total: {selectedPoints} pts
                  </p>
                  {selectedBreakdown.length > 0 ? (
                    <ul className="space-y-2">
                      {selectedBreakdown.map((item, i) => (
                        <li key={`${item.label}-${i}`} className="flex items-center justify-between text-sm border-b border-gray-100 pb-2">
                          <span className="text-gray-700">
                            {item.label}{" "}
                            <span className="text-gray-400">
                              ({typeof item.value === "boolean" ? (item.value ? "yes" : "no") : item.value})
                            </span>
                          </span>
                          <span className={`font-semibold ${item.points >= 0 ? "text-green-600" : "text-red-600"}`}>
                            {item.points > 0 ? `+${item.points}` : item.points}
                          </span>
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-gray-500">No scoring events for this gameweek.</p>
                  )}
                  <button
                    onClick={() => setShowHistory(true)}
                    className="mt-4 w-full py-2 rounded-full text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Show history
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
