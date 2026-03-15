"use client";

import { useEffect, useMemo, useState } from "react";
import Pitch from "@/components/Pitch";
import PlayerHistory from "@/components/PlayerHistory";
import { supabase } from "@/lib/supabase";
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
  bonusPoints: number;
  votePoints: number;
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
  | "bonusPoints"
  | "votePoints"
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
          bonusPoints: 0,
          votePoints: 0,
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
      agg.bonusPoints += p.bonusPoints;
      agg.votePoints += p.breakdown.find((b) => b.label === "Players vote bonus")?.points ?? 0;
      agg.points += p.points;
    }
  }

  return Array.from(map.values());
}

interface VoteEntry {
  gameweek_number: number;
  user_email: string;
  player_1: string;
  player_2: string;
  player_3: string;
}

interface PlayerVoteTally {
  name: string;
  score: number;
  voters: { email: string; rank: 1 | 2 | 3 }[];
}

function tallyVotes(votes: VoteEntry[]): PlayerVoteTally[] {
  const map = new Map<string, PlayerVoteTally>();
  const weights = [3, 2, 1] as const;

  for (const vote of votes) {
    ([vote.player_1, vote.player_2, vote.player_3] as string[]).forEach((player, i) => {
      if (!player) return;
      if (!map.has(player)) {
        map.set(player, { name: player, score: 0, voters: [] });
      }
      const t = map.get(player)!;
      t.score += weights[i];
      t.voters.push({ email: vote.user_email, rank: (i + 1) as 1 | 2 | 3 });
    });
  }

  return Array.from(map.values()).sort((a, b) => b.score - a.score);
}

export default function Stats() {
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [selectedPlayer, setSelectedPlayer] = useState<string | null>(null);
  const [sortKey, setSortKey] = useState<SortKey>("points");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [showVotePoll, setShowVotePoll] = useState(false);
  const [voteData, setVoteData] = useState<VoteEntry[] | null>(null);
  const [voteGw, setVoteGw] = useState<number | null>(null);
  const [teamNames, setTeamNames] = useState<Record<string, string>>({});
  const [expandedVoters, setExpandedVoters] = useState<Set<string>>(new Set());

  useEffect(() => {
    Promise.all([
      fetch("/api/gameweek").then((r) => r.json()),
      supabase.from("gameweek_snapshots").select("gameweek_number"),
    ])
      .then(([data, { data: snapshotData }]: [{ gameweeks?: Gameweek[]; error?: string }, { data: { gameweek_number: number }[] | null }]) => {
        const snapshotGwNumbers = new Set((snapshotData ?? []).map((r) => r.gameweek_number));
        const allGameweeks: Gameweek[] = data.gameweeks ?? [];
        setGameweeks(allGameweeks.filter((gw) => snapshotGwNumbers.has(gw.number)));
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
          case "bonusPoints":
            compare = a.bonusPoints - b.bonusPoints;
            break;
          case "votePoints":
            compare = a.votePoints - b.votePoints;
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

  async function openVotePoll() {
    if (voteData === null) {
      const [{ data: votes }, { data: teams }] = await Promise.all([
        supabase
          .from("gw_votes")
          .select("gameweek_number, user_email, player_1, player_2, player_3")
          .order("gameweek_number", { ascending: false }),
        supabase.from("user_teams").select("user_email, team_name"),
      ]);
      const rows = (votes ?? []) as VoteEntry[];
      setVoteData(rows);
      const nameMap: Record<string, string> = {};
      for (const t of teams ?? []) {
        if (t.user_email && t.team_name) nameMap[t.user_email] = t.team_name;
      }
      setTeamNames(nameMap);
      if (rows.length > 0 && voteGw === null) {
        const latestGw = Math.max(...rows.map((r) => r.gameweek_number));
        setVoteGw(latestGw);
      }
    }
    setShowVotePoll(true);
  }

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
        <div className="mt-4 flex flex-col items-start gap-2">
          <button
            onClick={() => setShowDetails(true)}
            className="px-4 py-2 rounded-full text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50"
          >
            Open detailed stats view
          </button>
          <button
            onClick={openVotePoll}
            className="px-4 py-2 rounded-full text-sm font-medium border border-amber-300 text-amber-700 hover:bg-amber-50"
          >
            Vote poll results
          </button>
        </div>
      </div>

      {showDetails && (
        <div
          className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center"
          onClick={() => setShowDetails(false)}
        >
          <div
            className="w-full max-w-6xl max-h-[85vh] bg-white rounded-2xl shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0 rounded-t-2xl">
              <h3 className="text-base font-semibold text-gray-900">Detailed stats</h3>
              <button
                onClick={() => setShowDetails(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>

            <div className="overflow-auto rounded-b-2xl">
              {gameweeks.length === 0 ? (
                <p className="px-5 py-8 text-sm text-gray-500">No matches has been played yet</p>
              ) : null}
              {gameweeks.length > 0 && <table className="min-w-[1200px] w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-3 py-2 sticky left-0 bg-gray-50 z-10">
                      <button onClick={() => toggleSort("name")} className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Player{sortArrow("name")}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right">
                      <button onClick={() => toggleSort("points")} className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Points{sortArrow("points")}
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
                      <button onClick={() => toggleSort("bonusPoints")} className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Bonus{sortArrow("bonusPoints")}
                      </button>
                    </th>
                    <th className="px-3 py-2 text-right">
                      <button onClick={() => toggleSort("votePoints")} className="text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">
                        Vote pts{sortArrow("votePoints")}
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
                        <td className="px-3 py-2 text-sm text-gray-900 sticky left-0 bg-white">{p.name}</td>
                        <td className="px-3 py-2 text-sm font-semibold text-gray-900 text-right">{p.points}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{p.gamesPlayed}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{p.minutes}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{p.goals}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{p.assists}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{p.yellowCards}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{p.redCards}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{p.goalsConceded}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{p.bonusPoints}</td>
                        <td className="px-3 py-2 text-sm text-gray-900 text-right">{p.votePoints}</td>
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

      {showVotePoll && (() => {
        const gwNumbers = voteData
          ? Array.from(new Set(voteData.map((r) => r.gameweek_number))).sort((a, b) => b - a)
          : [];
        const currentGw = voteGw ?? gwNumbers[0] ?? null;
        const gwVotes = (voteData ?? []).filter((r) => r.gameweek_number === currentGw);
        const tally = tallyVotes(gwVotes);

        return (
          <div
            className="fixed inset-0 z-50 bg-black/40 p-4 flex items-center justify-center"
            onClick={() => setShowVotePoll(false)}
          >
            <div
              className="w-full max-w-sm bg-white rounded-2xl shadow-xl flex flex-col max-h-[85vh]"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
                <h3 className="text-base font-semibold text-gray-900">Vote poll results</h3>
                <button
                  onClick={() => setShowVotePoll(false)}
                  className="text-gray-400 hover:text-gray-600 text-xl leading-none"
                >
                  ×
                </button>
              </div>

              {gwNumbers.length === 0 ? (
                <p className="px-5 py-8 text-sm text-gray-500">No votes have been recorded yet.</p>
              ) : (
                <>
                  {gwNumbers.length > 1 && (
                    <div className="px-5 pt-3 pb-1 flex gap-2 flex-wrap">
                      {gwNumbers.map((gw) => (
                        <button
                          key={gw}
                          onClick={() => { setVoteGw(gw); setExpandedVoters(new Set()); }}
                          className={`px-3 py-1 rounded-full text-xs font-semibold border transition-colors ${
                            currentGw === gw
                              ? "bg-amber-500 border-amber-500 text-white"
                              : "border-gray-300 text-gray-600 hover:bg-gray-50"
                          }`}
                        >
                          GW {gw}
                        </button>
                      ))}
                    </div>
                  )}

                  <div className="px-5 pt-3 pb-1 flex-shrink-0">
                    <p className="text-xs text-gray-400">{gwVotes.length} vote{gwVotes.length !== 1 ? "s" : ""} cast</p>
                  </div>

                  <div className="overflow-y-auto px-5 pb-5">
                    {tally.length === 0 ? (
                      <p className="text-sm text-gray-500 py-4">No votes for GW {currentGw}.</p>
                    ) : (
                      <ol className="space-y-2 mt-2">
                        {tally.map((player, idx) => {
                          const medal = idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : null;
                          const isOpen = expandedVoters.has(player.name);
                          return (
                            <li key={player.name} className="rounded-xl border border-gray-100 bg-gray-50 overflow-hidden">
                              <button
                                className="w-full flex items-center justify-between px-4 py-3 text-left"
                                onClick={() => setExpandedVoters((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(player.name)) next.delete(player.name);
                                  else next.add(player.name);
                                  return next;
                                })}
                              >
                                <div className="flex items-center gap-2">
                                  <span className="w-5 text-center text-sm">
                                    {medal ?? <span className="text-xs text-gray-400">{idx + 1}</span>}
                                  </span>
                                  <span className="text-sm font-medium text-gray-900">{player.name}</span>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-semibold text-amber-700">{player.score} pts</span>
                                  <span className="text-gray-400 text-xs">{isOpen ? "▲" : "▼"}</span>
                                </div>
                              </button>
                              {isOpen && (
                                <ul className="border-t border-gray-100 divide-y divide-gray-100">
                                  {player.voters.map((v, vi) => (
                                    <li key={vi} className="flex items-center justify-between px-4 py-2">
                                      <span className="text-sm text-gray-700">
                                        {teamNames[v.email] ?? v.email.split("@")[0]}
                                      </span>
                                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                                        v.rank === 1 ? "bg-amber-100 text-amber-700" :
                                        v.rank === 2 ? "bg-gray-100 text-gray-600" :
                                        "bg-orange-50 text-orange-600"
                                      }`}>
                                        {v.rank === 1 ? "1st" : v.rank === 2 ? "2nd" : "3rd"}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              )}
                            </li>
                          );
                        })}
                      </ol>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        );
      })()}

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
