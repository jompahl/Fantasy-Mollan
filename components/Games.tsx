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
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  image: string;
  imageRotation: number;
  hasCustomImage: boolean;
}

function normalizePosition(position: string): "DEF" | "MID" | "FWD" | "GK" | "UNKNOWN" {
  const p = position.trim().toUpperCase();
  if (p === "DEF" || p.startsWith("DEFEND")) return "DEF";
  if (p === "MID" || p.startsWith("MID")) return "MID";
  if (p === "FWD" || p === "FW" || p.startsWith("FORW") || p.startsWith("STRIK")) return "FWD";
  if (p === "GK" || p.startsWith("GOALKEEP")) return "GK";
  return "UNKNOWN";
}

type PlayerWithImage = PlayerPoints & {
  image: string;
  imageRotation: number;
  hasCustomImage: boolean;
};

function BootIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path d="M2 15.5V18h20v-2.5c-4.6 0-7-1.4-8.8-3.2l-1.4-1.5-2 2.1C8.1 14.6 5.9 15.5 2 15.5Z" fill="#111827" />
      <rect x="4" y="18.5" width="2.1" height="1.6" rx="0.4" fill="#111827" />
      <rect x="8" y="18.5" width="2.1" height="1.6" rx="0.4" fill="#111827" />
      <rect x="12" y="18.5" width="2.1" height="1.6" rx="0.4" fill="#111827" />
      <path d="M14.2 8.8c.9 1.3 2.3 2.6 4.7 3.1" stroke="#374151" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

function buildPositions(players: PlayerWithImage[]): PositionedPlayer[] {
  const withRole = players.map((p) => ({ ...p, role: normalizePosition(p.position) }));
  const rows: { y: string; players: PlayerWithImage[] }[] = [
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
      goals: player.goals,
      assists: player.assists,
      yellowCards: player.yellowCards,
      redCards: player.redCards,
      image: player.image,
      imageRotation: player.imageRotation,
      hasCustomImage: player.hasCustomImage,
    }))
  );
}

export default function Games() {
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [playerPositions, setPlayerPositions] = useState<Map<string, string>>(new Map());
  const [playerImages, setPlayerImages] = useState<Map<string, string>>(new Map());
  const [playerImageRotations, setPlayerImageRotations] = useState<Map<string, number>>(new Map());
  const [selectedPlayerName, setSelectedPlayerName] = useState<string | null>(null);
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
        const imageMap = new Map<string, string>();
        const imageRotationMap = new Map<string, number>();
        for (const player of players) {
          const normalizedName = player.name.trim().toLowerCase();
          positionMap.set(normalizedName, player.position);
          if (player.image) imageMap.set(normalizedName, player.image);
          if (typeof player.imageRotation === "number") {
            imageRotationMap.set(normalizedName, player.imageRotation);
          }
        }

        setPlayerPositions(positionMap);
        setPlayerImages(imageMap);
        setPlayerImageRotations(imageRotationMap);
        setGameweeks(calculatedGameweeks);
        setCurrentGwIndex(Math.max(0, calculatedGameweeks.length - 1));
        setLoaded(true);
      })
      .catch(() => {
        setGameweeks([]);
        setPlayerPositions(new Map());
        setPlayerImages(new Map());
        setPlayerImageRotations(new Map());
        setCurrentGwIndex(0);
        setLoaded(true);
      });
  }, []);

  if (!loaded) {
    return <p className="text-gray-400 text-sm">Loading…</p>;
  }

  if (gameweeks.length === 0) {
    return <p className="text-gray-400 text-sm">No matches has been played yet</p>;
  }

  const currentGameweek = gameweeks[currentGwIndex];
  const startedPlayers = currentGameweek.players
    .filter((p) => p.started)
    .map((p) => ({
      ...p,
      position: playerPositions.get(p.name.trim().toLowerCase()) ?? p.position,
      image: playerImages.get(p.name.trim().toLowerCase()) ?? "/avatar.webp",
      imageRotation: playerImageRotations.get(p.name.trim().toLowerCase()) ?? 0,
      hasCustomImage: playerImages.has(p.name.trim().toLowerCase()),
    }));
  const benchPlayers = currentGameweek.players
    .filter((p) => !p.started)
    .map((p) => ({
      ...p,
      position: playerPositions.get(p.name.trim().toLowerCase()) ?? p.position,
      image: playerImages.get(p.name.trim().toLowerCase()) ?? "/avatar.webp",
      imageRotation: playerImageRotations.get(p.name.trim().toLowerCase()) ?? 0,
      hasCustomImage: playerImages.has(p.name.trim().toLowerCase()),
    }));
  const positioned = buildPositions(startedPlayers);
  const allPlayers = [...startedPlayers, ...benchPlayers];
  const selectedPlayerStat = selectedPlayerName
    ? currentGameweek.players.find((p) => p.name === selectedPlayerName)
    : null;
  const selectedPlayerWithImage = selectedPlayerName
    ? allPlayers.find((p) => p.name === selectedPlayerName)
    : null;

  const { opponent, homeAway, score, opponentImage } = currentGameweek;
  const leftTeam  = homeAway === "away" ? opponent : "FC Möllan";
  const rightTeam = homeAway === "away" ? "FC Möllan" : opponent;

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

      {/* Match scoreline card */}
      {(opponent || score) && (
        <div className="mb-4 rounded-2xl border border-gray-200 bg-white px-6 py-4 flex items-center justify-between gap-4">
          {/* Left team */}
          <div className="flex flex-col items-center gap-1.5 w-24">
            <div className="w-14 h-14 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
              {leftTeam === "FC Möllan" ? (
                <Image src="/fc-mollan-logo.svg" alt="FC Möllan" width={48} height={48} className="object-contain" />
              ) : opponentImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={opponentImage} alt={leftTeam ?? "Opponent"} className="w-12 h-12 object-contain" />
              ) : (
                <span className="text-lg font-bold text-gray-500">
                  {leftTeam?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <span className="text-xs font-semibold text-gray-700 text-center leading-tight">{leftTeam}</span>
          </div>

          {/* Score */}
          <div className="flex flex-col items-center flex-1">
            {score ? (
              <>
                <span className="text-3xl font-bold text-gray-900 tracking-tight">{score}</span>
                <span className="text-xs text-gray-400 font-medium mt-0.5">FT</span>
              </>
            ) : (
              <span className="text-sm text-gray-400">vs</span>
            )}
          </div>

          {/* Right team */}
          <div className="flex flex-col items-center gap-1.5 w-24">
            <div className="w-14 h-14 rounded-full border border-gray-200 bg-gray-50 flex items-center justify-center overflow-hidden">
              {rightTeam === "FC Möllan" ? (
                <Image src="/fc-mollan-logo.svg" alt="FC Möllan" width={48} height={48} className="object-contain" />
              ) : opponentImage ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={opponentImage} alt={rightTeam ?? "Opponent"} className="w-12 h-12 object-contain" />
              ) : (
                <span className="text-lg font-bold text-gray-500">
                  {rightTeam?.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
                </span>
              )}
            </div>
            <span className="text-xs font-semibold text-gray-700 text-center leading-tight">{rightTeam}</span>
          </div>
        </div>
      )}

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
            <button
              type="button"
              onClick={() => setSelectedPlayerName(player.name)}
              className="relative w-10 h-10"
            >
              <div className="w-10 h-10 rounded-full overflow-hidden">
                <Image
                  src={player.image}
                  alt={player.name}
                  width={40}
                  height={40}
                  className="w-full h-full object-cover"
                  style={{
                    objectPosition: "center 22%",
                    transform: `scale(1.18) rotate(${player.imageRotation}deg)`,
                  }}
                  unoptimized
                />
              </div>
              {player.assists > 0 && (
                <span className="absolute -top-1.5 -left-1.5 leading-none bg-white/90 rounded-full p-[1px] shadow-sm">
                  <BootIcon />
                </span>
              )}
              {player.goals > 0 && (
                <span className="absolute -top-1.5 -right-1.5 text-sm leading-none">⚽</span>
              )}
              {player.yellowCards > 0 && (
                <span className="absolute -bottom-1.5 -left-1.5 w-2.5 h-3.5 rounded-[2px] bg-yellow-400 border border-yellow-500 shadow-sm" />
              )}
              {player.redCards > 0 && (
                <span className="absolute -bottom-1.5 -right-1.5 w-2.5 h-3.5 rounded-[2px] bg-red-500 border border-red-600 shadow-sm" />
              )}
            </button>
            <div className="mt-1 bg-black/35 rounded px-2 py-0.5 max-w-[120px]">
              <span className="text-white text-xs font-semibold truncate block text-center">
                {player.name}
              </span>
              <span className="text-yellow-300 text-xs font-bold block text-center">{player.points} pts</span>
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
                  <button
                    type="button"
                    onClick={() => setSelectedPlayerName(player.name)}
                    className="relative w-8 h-8"
                  >
                    <div className="w-8 h-8 rounded-full overflow-hidden">
                      <Image
                        src={player.image}
                        alt={player.name}
                        width={32}
                        height={32}
                        className="w-full h-full object-cover"
                        style={{
                          objectPosition: "center 22%",
                          transform: `scale(1.18) rotate(${player.imageRotation}deg)`,
                        }}
                        unoptimized
                      />
                    </div>
                    {player.assists > 0 && (
                      <span className="absolute -top-1 -left-1 leading-none bg-white/90 rounded-full p-[1px] shadow-sm">
                        <BootIcon />
                      </span>
                    )}
                    {player.goals > 0 && (
                      <span className="absolute -top-1 -right-1 text-xs leading-none">⚽</span>
                    )}
                    {player.yellowCards > 0 && (
                      <span className="absolute -bottom-1 -left-1 w-2 h-3 rounded-[2px] bg-yellow-400 border border-yellow-500 shadow-sm" />
                    )}
                    {player.redCards > 0 && (
                      <span className="absolute -bottom-1 -right-1 w-2 h-3 rounded-[2px] bg-red-500 border border-red-600 shadow-sm" />
                    )}
                  </button>
                  <div className="mt-1 bg-black/65 rounded px-1.5 py-0.5 w-full">
                    <span className="text-white text-[10px] font-semibold truncate block text-center">
                      {player.name}
                    </span>
                    <span className="text-yellow-300 text-[10px] font-bold block text-center">{player.points} pts</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {selectedPlayerName && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setSelectedPlayerName(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-end">
              <button
                onClick={() => setSelectedPlayerName(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-5 py-4">
              {!selectedPlayerStat ? (
                <p className="text-sm text-gray-500">No game data found for this player in this gameweek.</p>
              ) : (
                <>
                  <div className="rounded-2xl overflow-hidden border border-gray-200 bg-gray-50 mb-4">
                    <div className="px-4 py-3 flex items-center gap-3">
                      <div className="w-20 h-20 rounded-xl overflow-hidden border border-gray-200 bg-white flex-shrink-0">
                        <Image
                          src={selectedPlayerWithImage?.hasCustomImage ? selectedPlayerWithImage.image : "/avatar.webp"}
                          alt={selectedPlayerName}
                          width={80}
                          height={80}
                          className="w-full h-full object-cover"
                          style={
                            selectedPlayerWithImage?.hasCustomImage
                              ? {
                                  objectPosition: "center 22%",
                                  transform: `scale(1.18) rotate(${selectedPlayerWithImage.imageRotation}deg)`,
                                }
                              : undefined
                          }
                          unoptimized
                        />
                      </div>
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                          {selectedPlayerStat.position || "Player"}
                        </p>
                        <p className="text-gray-900 text-3xl font-bold leading-tight">
                          {selectedPlayerName}
                        </p>
                      </div>
                    </div>
                  </div>
                  <p className="text-sm font-medium text-gray-700 mb-3">
                    Total: {selectedPlayerStat.points} pts
                  </p>
                  {selectedPlayerStat.breakdown.length > 0 ? (
                    <ul className="space-y-2">
                      {selectedPlayerStat.breakdown.map((item, i) => (
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
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
