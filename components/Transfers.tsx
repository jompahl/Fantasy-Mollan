"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Player } from "@/app/api/players/route";
import Pitch, { SLOTS } from "@/components/Pitch";

const POSITION_STYLES: Record<string, string> = {
  GK:  "bg-yellow-100 text-yellow-800",
  DEF: "bg-green-100  text-green-800",
  MID: "bg-blue-100   text-blue-800",
  FWD: "bg-red-100    text-red-800",
};

const POSITION_ORDER = ["GK", "DEF", "MID", "FWD"] as const;
const POSITION_LABELS: Record<string, string> = {
  GK:  "Goalkeepers",
  DEF: "Defenders",
  MID: "Midfielders",
  FWD: "Forwards",
};

export default function Transfers() {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [error, setError] = useState(false);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [slotPlayers, setSlotPlayers] = useState<(Player | null)[]>(Array(5).fill(null));

  useEffect(() => {
    fetch("/api/players")
      .then((r) => r.json())
      .then((data) => {
        if (data.error) throw new Error();
        setPlayers(data.players);
      })
      .catch(() => setError(true));
  }, []);

  if (error) {
    return <p className="text-red-500 text-sm">Could not load players. Try refreshing.</p>;
  }

  if (!players) {
    return <p className="text-gray-400 text-sm">Loading players…</p>;
  }

  const groups = POSITION_ORDER
    .map((pos) => ({ pos, label: POSITION_LABELS[pos], players: players.filter((p) => p.position === pos) }))
    .filter((g) => g.players.length > 0);

  return (
    <>
    <div className="flex flex-col md:flex-row gap-4 items-start">
      {/* Player list */}
      <div className="w-full md:w-64 md:flex-shrink-0">
        {groups.map(({ pos, label, players: group }) => (
          <div key={pos} className="mb-6">
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1">
              {label}
            </h3>
            <table className="w-full">
              <tbody>
                {group.map((player) => (
                  <tr key={player.name} className="border-b border-gray-100">
                    <td className="py-2 pr-2">
                      <span
                        className={`text-xs font-semibold px-1.5 py-0.5 rounded inline-block ${
                          POSITION_STYLES[player.position] ?? "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {player.position}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-gray-900 text-sm">{player.name}</td>
                    <td className="py-2 text-sm text-gray-400 whitespace-nowrap">
                      £{player.price.toFixed(1)}m
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}
      </div>

      {/* Pitch */}
      <div className="w-full md:w-60 md:flex-shrink-0 md:sticky md:top-8 order-first md:order-last">
        <p className="text-sm font-medium text-gray-600 mb-2">Budget: £50m</p>
        <Pitch onSlotClick={setActiveSlot} />
      </div>
    </div>

    {/* Slot popup — rendered in a portal so it is never clipped by any ancestor */}
    {activeSlot !== null && createPortal(
      <div
        className="fixed inset-0 bg-black/40 z-50 flex flex-col justify-end sm:justify-center sm:items-center sm:px-4"
        onClick={() => setActiveSlot(null)}
      >
        <div
          className="bg-white rounded-t-2xl sm:rounded-2xl p-6 w-full sm:max-w-sm shadow-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-gray-900">
              {SLOTS[activeSlot].label === "FWD" && "Forward"}
              {SLOTS[activeSlot].label === "MID" && "Midfielder"}
              {SLOTS[activeSlot].label === "DEF" && "Defender"}
            </h3>
            <button
              onClick={() => setActiveSlot(null)}
              className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
            >
              ×
            </button>
          </div>

          {slotPlayers[activeSlot] ? (
            <div className="mb-5">
              <p className="text-gray-900 font-medium">{slotPlayers[activeSlot]!.name}</p>
              <p className="text-sm text-gray-400 mt-0.5">
                {slotPlayers[activeSlot]!.position} · £{slotPlayers[activeSlot]!.price.toFixed(1)}m
              </p>
            </div>
          ) : (
            <p className="text-gray-400 text-sm mb-5">No player selected</p>
          )}

          <button className="w-full bg-gray-900 text-white rounded-full py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors">
            Select replacement
          </button>
        </div>
      </div>,
      document.body
    )}
    </>
  );
}
