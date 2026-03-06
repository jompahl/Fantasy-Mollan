"use client";

import { useEffect, useState } from "react";
import type { Gameweek } from "@/app/api/gameweek/route";
import { supabase } from "@/lib/supabase";

interface Props {
  playerName: string;
  gameweeks: Gameweek[];
}

export default function PlayerHistory({ playerName, gameweeks }: Props) {
  const [expandedGw, setExpandedGw] = useState<number | null>(null);
  const [snapshotGwNumbers, setSnapshotGwNumbers] = useState<Set<number> | null>(null);

  useEffect(() => {
    supabase
      .from("gameweek_snapshots")
      .select("gameweek_number")
      .then(({ data }) => {
        setSnapshotGwNumbers(new Set((data ?? []).map((r) => r.gameweek_number)));
      });
  }, []);

  const displayGameweeks = snapshotGwNumbers !== null
    ? gameweeks.filter((gw) => snapshotGwNumbers.has(gw.number))
    : gameweeks;

  return (
    <div className="max-h-80 overflow-y-auto -mx-5 px-5">
      {/* Header */}
      <div className="flex items-center gap-2 pb-2 border-b border-gray-200">
        <span className="w-7 text-xs font-semibold text-gray-400 uppercase tracking-wider">GW</span>
        <span className="w-24 flex-shrink-0" />
        <span className="w-14 text-center text-xs font-semibold text-gray-400 uppercase tracking-wider">Result</span>
        <span className="flex-1 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Stats</span>
        <span className="w-7 text-right text-xs font-semibold text-gray-400 uppercase tracking-wider">Pts</span>
      </div>

      {displayGameweeks.map((gw) => {
        const stat = gw.players.find((p) => p.name === playerName);
        const [rawHome, rawAway] = (gw.score ?? "").split("-").map(Number);
        const mollanGoals = gw.homeAway === "home" ? rawHome : rawAway;
        const oppGoals = gw.homeAway === "home" ? rawAway : rawHome;
        const resultClass = !gw.score
          ? "bg-gray-100 text-gray-500"
          : mollanGoals > oppGoals
          ? "bg-green-500 text-white"
          : mollanGoals < oppGoals
          ? "bg-red-500 text-white"
          : "bg-gray-200 text-gray-600";
        const oppAbbrev = gw.opponent ? gw.opponent.slice(0, 3).toUpperCase() : "—";
        const homeAwayLabel = gw.homeAway === "home" ? "H" : "A";
        const isExpanded = expandedGw === gw.number;
        const hasBreakdown = stat && stat.breakdown.length > 0;

        return (
          <div key={gw.number} className="border-b border-gray-100">
            {/* Row */}
            <button
              className={`w-full flex items-center gap-2 py-2.5 text-left transition-colors ${hasBreakdown ? "cursor-pointer hover:bg-gray-50" : "cursor-default"}`}
              onClick={() => hasBreakdown && setExpandedGw(isExpanded ? null : gw.number)}
            >
              <span className="w-7 text-xs text-gray-400 flex-shrink-0">{gw.number}</span>
              <div className="flex items-center gap-1 w-24 flex-shrink-0">
                {gw.opponentImage ? (
                  <img src={gw.opponentImage} alt={gw.opponent} className="w-5 h-5 object-contain flex-shrink-0" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center flex-shrink-0">
                    <span className="text-[7px] font-bold text-gray-400">{oppAbbrev.slice(0, 2)}</span>
                  </div>
                )}
                <span className="text-xs text-gray-900 font-medium truncate">
                  {oppAbbrev} <span className="text-gray-400 font-normal">({homeAwayLabel})</span>
                </span>
              </div>
              <span className={`w-12 text-center text-xs font-bold px-1 py-0.5 rounded flex-shrink-0 ${resultClass}`}>
                {gw.score ?? "—"}
              </span>
              <div className="flex-1 text-right">
                {stat ? (
                  <span className="text-xs text-gray-400 leading-tight">
                    {stat.minutes}&apos;
                    {stat.goals > 0 && <> · {stat.goals}G</>}
                    {stat.assists > 0 && <> · {stat.assists}A</>}
                    {stat.yellowCards > 0 && <> · <span className="inline-block w-1.5 h-2 rounded-[1px] bg-yellow-400 align-middle" /></>}
                    {stat.redCards > 0 && <> · <span className="inline-block w-1.5 h-2 rounded-[1px] bg-red-500 align-middle" /></>}
                  </span>
                ) : <span className="text-xs text-gray-300">—</span>}
              </div>
              <span className="w-7 text-right text-sm font-semibold text-gray-900 flex-shrink-0">
                {stat ? stat.points : "—"}
              </span>
            </button>

            {/* Breakdown */}
            {isExpanded && stat && (
              <div className="pb-3 pt-1 px-2 space-y-1">
                {stat.breakdown.map((item, i) => (
                  <div key={i} className="flex items-center justify-between text-xs">
                    <span className="text-gray-500">
                      {item.label}
                      {typeof item.value === "number" && item.value !== 1 && (
                        <span className="text-gray-400"> ×{item.value}</span>
                      )}
                    </span>
                    <span className={`font-semibold ${item.points > 0 ? "text-green-600" : item.points < 0 ? "text-red-500" : "text-gray-400"}`}>
                      {item.points > 0 ? "+" : ""}{item.points}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
