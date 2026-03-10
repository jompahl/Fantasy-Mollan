"use client";

import { useEffect, useState } from "react";
import { useVotePoll } from "@/components/useVotePoll";
import type { Gameweek, PlayerPoints } from "@/app/api/gameweek/route";

interface VoteBannerProps {
  userEmail: string | null;
}

export default function VoteBanner({ userEmail }: VoteBannerProps) {
  const { pollOpen, gwNumber, refresh } = useVotePoll(userEmail);
  const [modalOpen, setModalOpen] = useState(false);

  if (!pollOpen) return null;

  return (
    <>
      <div className="bg-amber-50 border-b border-amber-200 px-6 py-3 flex items-center justify-between">
        <span className="text-sm font-medium text-amber-800">
          Vote for GW {gwNumber} best players
        </span>
        <button
          onClick={() => setModalOpen(true)}
          className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-500 text-white hover:bg-amber-600 transition-colors"
        >
          Vote now
        </button>
      </div>

      {modalOpen && gwNumber !== null && (
        <VoteModal
          gwNumber={gwNumber}
          userEmail={userEmail!}
          onClose={() => setModalOpen(false)}
          onVoted={async () => {
            setModalOpen(false);
            await refresh();
          }}
        />
      )}
    </>
  );
}

interface VoteModalProps {
  gwNumber: number;
  userEmail: string;
  onClose: () => void;
  onVoted: () => void;
}

function VoteModal({ gwNumber, userEmail, onClose, onVoted }: VoteModalProps) {
  const [players, setPlayers] = useState<PlayerPoints[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<[string | null, string | null, string | null]>([null, null, null]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch players on mount
  useEffect(() => {
    fetch("/api/gameweek")
      .then((r) => r.json())
      .then((data: { gameweeks?: Gameweek[] }) => {
        const gw = (data.gameweeks ?? []).find((g) => g.number === gwNumber);
        if (gw) {
          const eligible = gw.players
            .filter((p) => p.minutes > 0)
            .sort((a, b) => b.points - a.points);
          setPlayers(eligible);
        } else {
          setPlayers([]);
        }
        setLoading(false);
      })
      .catch(() => {
        setPlayers([]);
        setLoading(false);
      });
  }, [gwNumber]);

  function handlePlayerClick(name: string) {
    setSelected((prev) => {
      const idx = prev.indexOf(name);
      if (idx !== -1) {
        // Remove
        const next = [...prev] as typeof prev;
        next[idx] = null;
        return next;
      }
      // Add to first empty slot
      const emptyIdx = prev.indexOf(null);
      if (emptyIdx === -1) return prev; // all 3 filled
      const next = [...prev] as typeof prev;
      next[emptyIdx] = name;
      return next;
    });
  }

  function rankLabel(name: string): string | null {
    const idx = selected.indexOf(name);
    if (idx === -1) return null;
    return ["1st", "2nd", "3rd"][idx];
  }

  async function submit() {
    if (!selected[0] || !selected[1] || !selected[2]) return;
    setSubmitting(true);
    setError(null);
    const res = await fetch("/api/vote", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        gwNumber,
        player1: selected[0],
        player2: selected[1],
        player3: selected[2],
      }),
    });
    if (res.ok) {
      onVoted();
    } else {
      const data = await res.json().catch(() => ({}));
      setError(data.error ?? "Failed to submit vote.");
      setSubmitting(false);
    }
  }

  const allSelected = selected[0] !== null && selected[1] !== null && selected[2] !== null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col max-h-[85vh]">
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">GW {gwNumber} Player Vote</h2>
            <p className="text-xs text-gray-500 mt-0.5">Select your top 3 players (in order)</p>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
            aria-label="Close"
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </div>

        {/* Selection slots */}
        <div className="px-5 pb-3 flex gap-2">
          {([0, 1, 2] as const).map((i) => (
            <div
              key={i}
              className={`flex-1 rounded-lg border text-center py-2 text-xs font-semibold ${
                selected[i]
                  ? "border-amber-400 bg-amber-50 text-amber-800"
                  : "border-gray-200 bg-gray-50 text-gray-400"
              }`}
            >
              <div className="text-[10px] text-gray-400 mb-0.5">{["1st", "2nd", "3rd"][i]}</div>
              <div className="truncate px-1">{selected[i] ?? "—"}</div>
            </div>
          ))}
        </div>

        {/* Player list */}
        <div className="flex-1 overflow-y-auto px-4 pb-2">
          {loading ? (
            <p className="text-sm text-gray-400 text-center py-8">Loading…</p>
          ) : players && players.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8">No player data for GW {gwNumber}.</p>
          ) : (
            <ul className="space-y-1">
              {(players ?? []).map((player) => {
                const label = rankLabel(player.name);
                const isSelected = label !== null;
                return (
                  <li key={player.name}>
                    <button
                      onClick={() => handlePlayerClick(player.name)}
                      className={`w-full flex items-center justify-between rounded-lg px-3 py-2.5 text-sm transition-colors ${
                        isSelected
                          ? "bg-amber-100 border border-amber-300 text-amber-900"
                          : "bg-gray-50 hover:bg-gray-100 text-gray-800 border border-transparent"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {isSelected && (
                          <span className="w-8 text-xs font-bold text-amber-600">{label}</span>
                        )}
                        {!isSelected && <span className="w-8" />}
                        <span className="font-medium">{player.name}</span>
                        <span className="text-xs text-gray-400">{player.position}</span>
                      </div>
                      <span className="font-semibold text-gray-700">{player.points} pts</span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {/* Footer */}
        <div className="px-5 py-4 border-t border-gray-100">
          {error && <p className="text-xs text-red-500 mb-2">{error}</p>}
          <button
            onClick={submit}
            disabled={!allSelected || submitting}
            className="w-full py-2.5 rounded-full text-sm font-semibold bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40 transition-colors"
          >
            {submitting ? "Submitting…" : "Submit vote"}
          </button>
        </div>
      </div>
    </div>
  );
}
