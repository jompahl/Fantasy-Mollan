"use client";

import { useEffect, useMemo, useState } from "react";
import Pitch from "@/components/Pitch";
import PlayerHistory from "@/components/PlayerHistory";
import type { Gameweek, PlayerPoints } from "@/app/api/gameweek/route";

interface PlayerAggregate {
  name: string;
  position: string;
  gamesPlayed: number;
  minutes: number;
  goals: number;
  assists: number;
  yellowCards: number;
  redCards: number;
  goalsConceded: number;
  points: number;
}

type SortKey =
  | "name"
  | "position"
  | "gamesPlayed"
  | "minutes"
  | "goals"
  | "assists"
  | "yellowCards"
  | "redCards"
  | "goalsConceded"
  | "points"
  | "goalsPer90"
  | "assistsPer90";

type SortDirection = "asc" | "desc";

function normalizePosition(position: string): "DEF" | "MID" | "FWD" | "UNKNOWN" {
  const p = position.trim().toUpperCase();
  if (p === "GK") return "DEF";
  if (p === "DEF" || p.startsWith("DEFEND")) return "DEF";
  if (p === "MID" || p.startsWith("MID")) return "MID";
  if (p === "FWD" || p === "FW" || p.startsWith("FORW") || p.startsWith("STRIK")) return "FWD";
  return "UNKNOWN";
}

function aggregatePlayers(gameweeks: Gameweek[]): PlayerAggregate[] {
  const map = new Map<string, PlayerAggregate>();

  for (const gw of gameweeks) {
    for (const p of gw.players) {
      const key = p.name.trim().toLowerCase();
      if (!map.has(key)) {
        map.set(key, {
          name: p.name,
          position: p.position,
          gamesPlayed: 0,
          minutes: 0,
          goals: 0,
          assists: 0,
          yellowCards: 0,
          redCards: 0,
          goalsConceded: 0,
          points: 0,
        });
      }

      const agg = map.get(key)!;
      agg.position = p.position || agg.position;
      agg.gamesPlayed += p.minutes > 0 ? 1 : 0;
      agg.minutes += p.minutes;
      agg.goals += p.goals;
      agg.assists += p.assists;
      agg.yellowCards += p.yellowCards;
      agg.redCards += p.redCards;
      agg.goalsConceded += p.goalsConceded;
      agg.points += p.points;
    }
  }

  return Array.from(map.values());
}

export default function Stats() {
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("points");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  useEffect(() => {
    fetch("/api/gameweek")
      .then((r) => r.json())
      .then((data: { gameweeks?: Gameweek[]; error?: string }) => {
        setGameweeks(data.gameweeks ?? []);
        setLoaded(true);
      })
      .catch(() => {
        setGameweeks([]);
        setLoaded(true);
      });
  }, []);

  const aggregates = useMemo(() => aggregatePlayers(gameweeks), [gameweeks]);

  const dreamTeam = useMemo(() => {
    const defenders = aggregates
      .filter((p) => normalizePosition(p.position) === "DEF")
      .sort((a, b) => b.points - a.points)
      .slice(0, 2);
    const midfielders = aggregates
      .filter((p) => normalizePosition(p.position) === "MID")
      .sort((a, b) => b.points - a.points)
      .slice(0, 2);
    const forwards = aggregates
      .filter((p) => normalizePosition(p.position) === "FWD")
      .sort((a, b) => b.points - a.points)
      .slice(0, 1);

    return [forwards[0] ?? null, midfielders[0] ?? null, midfielders[1] ?? null, defenders[0] ?? null, defenders[1] ?? null];
  }, [aggregates]);

  const sortedAggregates = useMemo(() => {
    return aggregates
      .slice()
      .sort((a, b) => {
        const aGoalsPer90 = a.minutes > 0 ? (a.goals * 90) / a.minutes : 0;
        const bGoalsPer90 = b.minutes > 0 ? (b.goals * 90) / b.minutes : 0;
        const aAssistsPer90 = a.minutes > 0 ? (a.assists * 90) / a.minutes : 0;
        const bAssistsPer90 = b.minutes > 0 ? (b.assists * 90) / b.minutes : 0;

        let compare = 0;
        switch (sortKey) {
          case "name":
            compare = a.name.localeCompare(b.name);
            break;
          case "position":
            compare = normalizePosition(a.position).localeCompare(normalizePosition(b.position));
            break;
          case "gamesPlayed":
            compare = a.gamesPlayed - b.gamesPlayed;
            break;
          case "minutes":
            compare = a.minutes - b.minutes;
            break;
          case "goals":
            compare = a.goals - b.goals;
            break;
          case "assists":
            compare = a.assists - b.assists;
            break;
          case "yellowCards":
            compare = a.yellowCards - b.yellowCards;
            break;
          case "redCards":
            compare = a.redCards - b.redCards;
            break;
          case "goalsConceded":
            compare = a.goalsConceded - b.goalsConceded;
            break;
          case "points":
            compare = a.points - b.points;
            break;
          case "goalsPer90":
            compare = aGoalsPer90 - bGoalsPer90;
            break;
          case "assistsPer90":
            compare = aAssistsPer90 - bAssistsPer90;
            break;
        }

        if (compare === 0) return b.points - a.points;
        return sortDirection === "asc" ? compare : -compare;
      });
  }, [aggregates, sortDirection, sortKey]);

  const toggleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDirection((d) => (d === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDirection("desc");
  };

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return "";
    return sortDirection === "asc" ? " ↑" : " ↓";
  };

  if (!loaded) {
    return <p className="text-gray-400 text-sm">Loading…</p>;
  }

  return (
    <div className="w-full max-w-5xl flex flex-col items-center mx-auto">
      <div className="w-full md:w-96">
        <h2 className="text-2xl font-semibold text-gray-900 mb-4">Dream team ⭐</h2>
        <Pitch
          slotPlayers={dreamTeam.map((p) => p?.name ?? null)}
          slotPoints={dreamTeam.map((p) => p?.points ?? null)}
          onSlotClick={(i) => { const p = dreamTeam[i]; if (p) setSelectedPlayer(p.name); }}
        />
        <button
          onClick={() => setShowDetails(true)}
          className="mt-4 px-4 py-2 rounded-full text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
        >
          Open detailed stats view
        </button>
      </div>

      {showDetails && (
        <div
          className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center"
          onClick={() => setShowDetails(false)}
        >
          <div
            className="w-full max-w-6xl max-h-[85vh] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Detailed stats</h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="overflow-auto">
              {gameweeks.length === 0 ? (
                <p className="px-5 py-8 text-sm text-gray-500">No matches has been played yet</p>
              ) : null}
              {gameweeks.length > 0 && <table className="min-w-[1200px] w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-3 py-2">
                      <button onClick={() => toggleSort("name")} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Player{sortArrow("name")}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right">
                      <button onClick={() => toggleSort("gamesPlayed")} className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Games{sortArrow("gamesPlayed")}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right">
                      <button onClick={() => toggleSort("minutes")} className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Minutes{sortArrow("minutes")}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right">
                      <button onClick={() => toggleSort("goals")} className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Goals{sortArrow("goals")}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right">
                      <button onClick={() => toggleSort("assists")} className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Assists{sortArrow("assists")}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right">
                      <button onClick={() => toggleSort("yellowCards")} className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Yellow{sortArrow("yellowCards")}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right">
                      <button onClick={() => toggleSort("redCards")} className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Red{sortArrow("redCards")}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right">
                      <button onClick={() => toggleSort("goalsConceded")} className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Conceded{sortArrow("goalsConceded")}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right">
                      <button onClick={() => toggleSort("points")} className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Points{sortArrow("points")}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right">
                      <button onClick={() => toggleSort("goalsPer90")} className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Goals/90{sortArrow("goalsPer90")}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right">
                      <button onClick={() => toggleSort("assistsPer90")} className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Assists/90{sortArrow("assistsPer90")}
                      </button>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {sortedAggregates.map((p) => {
                    const goalsPer90 = p.minutes > 0 ? (p.goals * 90) / p.minutes : 0;
                    const assistsPer90 = p.minutes > 0 ? (p.assists * 90) / p.minutes : 0;
                    return (
                      <tr key={p.name} className="border-b border-gray-100">
                        <td className="px-3 py-2 text-sm text-gray-900">{p.name}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{p.gamesPlayed}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{p.minutes}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{p.goals}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{p.assists}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{p.yellowCards}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{p.redCards}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{p.goalsConceded}</td>
                        <td className="px-3 py-2 text-sm font-semibold text-gray-900 text-right">{p.points}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{goalsPer90.toFixed(2)}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{assistsPer90.toFixed(2)}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>}
            </div>
          </div>
        </div>
      )}

      {selectedPlayer && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setSelectedPlayer(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">{selectedPlayer}</h3>
              <button
                onClick={() => setSelectedPlayer(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-5 py-4">
              <PlayerHistory playerName={selectedPlayer} gameweeks={gameweeks} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
