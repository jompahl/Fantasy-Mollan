"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { Gameweek, PlayerPoints } from "@/app/api/gameweek/route";
import type { Player } from "@/app/api/players/route";

interface PositionedPlayer {
  name: string;
  x: string;
  y: string;
  points: number;
}

function normalizePosition(position: string): "DEF" | "MID" | "FWD" | "GK" | "UNKNOWN" {
  const p = position.trim().toUpperCase();
  if (p === "DEF" || p.startsWith("DEFEND")) return "DEF";
  if (p === "MID" || p.startsWith("MID")) return "MID";
  if (p === "FWD" || p === "FW" || p.startsWith("FORW") || p.startsWith("STRIK")) return "FWD";
  if (p === "GK" || p.startsWith("GOALKEEP")) return "GK";
  return "UNKNOWN";
}

function buildPositions(players: PlayerPoints[]): PositionedPlayer[] {
  const withRole = players.map((p) => ({ ...p, role: normalizePosition(p.position) }));
  const rows: { y: string; players: PlayerPoints[] }[] = [
    { y: "16%", players: withRole.filter((p) => p.role === "FWD") },
    { y: "41%", players: withRole.filter((p) => p.role === "MID") },
    { y: "66%", players: withRole.filter((p) => p.role === "DEF") },
    { y: "90%", players: withRole.filter((p) => p.role === "GK") },
  ];

  const assigned = new Set(rows.flatMap((row) => row.players.map((p) => p.name)));
  const untyped = withRole.filter((p) => !assigned.has(p.name));
  if (untyped.length > 0) {
    rows.push({ y: "84%", players: untyped });
  }

  return rows.flatMap((row) =>
    row.players.map((player, i) => ({
      name: player.name,
      x: `${((i + 1) * 100) / (row.players.length + 1)}%`,
      y: row.y,
      points: player.points,
    }))
  );
}

export default function Games() {
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [playerPositions, setPlayerPositions] = useState<Map<string, string>>(new Map());
  const [currentGwIndex, setCurrentGwIndex] = useState(0);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/gameweek").then((r) => r.json() as Promise<{ gameweeks?: Gameweek[]; error?: string }>),
      fetch("/api/players").then((r) => r.json() as Promise<{ players?: Player[]; error?: string }>),
    ])
      .then(([gameweekData, playersData]) => {
        const calculatedGameweeks = gameweekData.gameweeks ?? [];
        const players = playersData.players ?? [];

        const positionMap = new Map<string, string>();
        for (const player of players) {
          positionMap.set(player.name.trim().toLowerCase(), player.position);
        }

        setPlayerPositions(positionMap);
        setGameweeks(calculatedGameweeks);
        setCurrentGwIndex(Math.max(0, calculatedGameweeks.length - 1));
        setLoaded(true);
      })
      .catch(() => {
        setGameweeks([]);
        setPlayerPositions(new Map());
        setCurrentGwIndex(0);
        setLoaded(true);
      });
  }, []);

  if (!loaded) {
    return <p className="text-gray-400 text-sm">Loading…</p>;
  }

  if (gameweeks.length === 0) {
    return <p className="text-gray-400 text-sm">No calculated gameweeks found in Games 2026.</p>;
  }

  const currentGameweek = gameweeks[currentGwIndex];
  const startedPlayers = currentGameweek.players
    .filter((p) => p.started)
    .map((p) => ({
      ...p,
      position: playerPositions.get(p.name.trim().toLowerCase()) ?? p.position,
    }));
  const benchPlayers = currentGameweek.players
    .filter((p) => !p.started)
    .map((p) => ({
      ...p,
      position: playerPositions.get(p.name.trim().toLowerCase()) ?? p.position,
    }));
  const positioned = buildPositions(startedPlayers);

  return (
    <div className="w-full md:w-[34rem]">
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
            Gameweek {currentGameweek.number}
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
        Started players: {startedPlayers.length}
      </p>
      <div
        className="relative w-full overflow-hidden rounded-2xl"
        style={{
          height: 520,
          background:
            "repeating-linear-gradient(180deg,#2b7a47 0px,#2b7a47 30px,#32904f 30px,#32904f 60px)",
        }}
      >
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 400 520"
          preserveAspectRatio="none"
        >
          <rect x="16" y="10" width="368" height="500" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
          <line x1="16" y1="260" x2="384" y2="260" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
          <circle cx="200" cy="260" r="50" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
          <circle cx="200" cy="260" r="3" fill="white" fillOpacity="0.35" />
          <rect x="112" y="10" width="176" height="88" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
          <rect x="150" y="10" width="100" height="32" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
          <rect x="112" y="422" width="176" height="88" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
          <rect x="150" y="478" width="100" height="32" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
        </svg>

        {positioned.map((player) => (
          <div
            key={player.name}
            className="absolute flex flex-col items-center"
            style={{ left: player.x, top: player.y, transform: "translate(-50%, -50%)" }}
          >
            <div className="w-10 h-10 rounded-full overflow-hidden border border-white/60 bg-white/20">
              <Image
                src="/avatar.webp"
                alt={player.name}
                width={40}
                height={40}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="mt-1 bg-black/35 rounded px-2 py-0.5 max-w-[120px]">
              <span className="text-white text-xs font-semibold truncate block text-center">
                {player.name}
              </span>
            </div>
            <div className="mt-1 bg-yellow-400 rounded px-1.5 py-0.5">
              <span className="text-yellow-900 text-xs font-bold">{player.points} pts</span>
            </div>
          </div>
        ))}
      </div>

      <div className="mt-5 w-full">
        <div className="mb-2 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-700">Bench</h3>
          <span className="text-xs font-medium text-gray-500">{benchPlayers.length} players</span>
        </div>
        <div className="w-full rounded-2xl border border-gray-200 bg-white px-3 py-4">
          {benchPlayers.length === 0 ? (
            <p className="text-xs text-gray-500 text-center py-2">
              No bench players this gameweek.
            </p>
          ) : (
            <div className="flex items-start justify-between gap-1.5 flex-nowrap">
              {benchPlayers.map((player) => (
                <div key={player.name} className="flex flex-col items-center w-14 min-w-0">
                  <div className="w-8 h-8 rounded-full overflow-hidden border border-gray-300 bg-white">
                    <Image
                      src="/avatar.webp"
                      alt={player.name}
                      width={32}
                      height={32}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="mt-1 bg-black/35 rounded px-1.5 py-0.5 w-full">
                    <span className="text-white text-[10px] font-semibold truncate block text-center">
                      {player.name}
                    </span>
                  </div>
                  <div className="mt-1 bg-yellow-400 rounded px-1 py-0.5">
                    <span className="text-yellow-900 text-[10px] font-bold">{player.points} pts</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
