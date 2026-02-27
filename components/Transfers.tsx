"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import type { Player } from "@/app/api/players/route";
import Pitch, { SLOTS } from "@/components/Pitch";
import { supabase } from "@/lib/supabase";

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

const SLOT_POSITION_LABEL: Record<string, string> = {
  FWD: "Forward",
  MID: "Midfielder",
  DEF: "Defender",
};

const BUDGET_START = 50;

interface Props {
  userEmail: string;
}

export default function Transfers({ userEmail }: Props) {
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [error, setError] = useState(false);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);
  const [selecting, setSelecting] = useState(false);
  const [slotPlayers, setSlotPlayers] = useState<(Player | null)[]>(Array(5).fill(null));
  const [savedSlotPlayers, setSavedSlotPlayers] = useState<(Player | null)[]>(Array(5).fill(null));
  const [slotsLoaded, setSlotsLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [calculatedGwCount, setCalculatedGwCount] = useState<number | null>(null);
  const [transfersUsed, setTransfersUsed] = useState(0);

  // Load players from sheet + number of calculated gameweeks
  useEffect(() => {
    Promise.all([
      fetch("/api/players").then((r) => r.json()),
      fetch("/api/gameweek").then((r) => r.json()),
    ])
      .then(([playerData, gwData]) => {
        if (playerData.error) throw new Error();
        setPlayers(playerData.players);
        setCalculatedGwCount(gwData.gameweeks?.length ?? 0);
      })
      .catch(() => setError(true));
  }, []);

  // Load saved slot selections and transfers_used from Supabase
  useEffect(() => {
    (async () => {
      const [{ data: slotData }, { data: teamData }] = await Promise.all([
        supabase
          .from("team_slots")
          .select("slot_index, player_name, player_position, player_price")
          .eq("user_email", userEmail),
        supabase
          .from("user_teams")
          .select("transfers_used")
          .eq("user_email", userEmail)
          .single(),
      ]);

      if (slotData && slotData.length > 0) {
        const loaded: (Player | null)[] = Array(5).fill(null);
        for (const row of slotData) {
          loaded[row.slot_index] = {
            name: row.player_name,
            position: row.player_position,
            price: row.player_price,
          };
        }
        setSlotPlayers(loaded);
        setSavedSlotPlayers(loaded);
      }

      setTransfersUsed(teamData?.transfers_used ?? 0);
      setSlotsLoaded(true);
    })();
  }, [userEmail]);

  const budget = slotPlayers.reduce(
    (remaining, p) => Math.round((remaining - (p?.price ?? 0)) * 10) / 10,
    BUDGET_START
  );

  // null = still loading, Infinity = no gameweeks yet (unlimited), number = count
  const freeTransfers: number | null =
    calculatedGwCount === null ? null
    : calculatedGwCount === 0 ? Infinity
    : Math.max(0, calculatedGwCount - transfersUsed);

  function openSlot(index: number) {
    setActiveSlot(index);
    setSelecting(false);
  }

  function closeModal() {
    setActiveSlot(null);
    setSelecting(false);
  }

  function selectPlayer(player: Player) {
    if (activeSlot === null) return;
    setSlotPlayers((prev) => {
      const next = [...prev];
      next[activeSlot] = player;
      return next;
    });
    setSaved(false);
    closeModal();
  }

  async function saveTeam() {
    setSaving(true);

    // Snapshot the current saved team for any calculated GWs that don't have one yet
    if (calculatedGwCount && calculatedGwCount > 0) {
      const { data: existingSnapshots } = await supabase
        .from("gameweek_snapshots")
        .select("gameweek_number")
        .eq("user_email", userEmail);

      const alreadySnapshotted = new Set(
        (existingSnapshots ?? []).map((s: { gameweek_number: number }) => s.gameweek_number)
      );

      const snapshotRows = [];
      for (let gw = 1; gw <= calculatedGwCount; gw++) {
        if (!alreadySnapshotted.has(gw)) {
          for (let i = 0; i < savedSlotPlayers.length; i++) {
            const p = savedSlotPlayers[i];
            if (p) {
              snapshotRows.push({
                user_email: userEmail,
                gameweek_number: gw,
                slot_index: i,
                player_name: p.name,
                player_position: p.position,
                player_price: p.price,
              });
            }
          }
        }
      }

      if (snapshotRows.length > 0) {
        await supabase.from("gameweek_snapshots").insert(snapshotRows);
      }
    }

    const rows = slotPlayers
      .map((p, i) => p ? { user_email: userEmail, slot_index: i, player_name: p.name, player_position: p.position, player_price: p.price } : null)
      .filter(Boolean);

    await supabase.from("team_slots").delete().eq("user_email", userEmail);
    if (rows.length > 0) await supabase.from("team_slots").insert(rows);

    // Count changed slots and record transfers used (only after first gameweek)
    if (calculatedGwCount && calculatedGwCount > 0) {
      const changes = slotPlayers.filter((p, i) => p?.name !== savedSlotPlayers[i]?.name).length;
      if (changes > 0) {
        const newTotal = transfersUsed + changes;
        await supabase
          .from("user_teams")
          .update({ transfers_used: newTotal })
          .eq("user_email", userEmail);
        setTransfersUsed(newTotal);
      }
    }

    setSavedSlotPlayers([...slotPlayers]);
    setSaving(false);
    setSaved(true);
  }

  if (error) {
    return <p className="text-red-500 text-sm">Could not load players. Try refreshing.</p>;
  }

  if (!players || !slotsLoaded) {
    return <p className="text-gray-400 text-sm">Loading…</p>;
  }

  const groups = POSITION_ORDER
    .map((pos) => ({ pos, label: POSITION_LABELS[pos], players: players.filter((p) => p.position === pos) }))
    .filter((g) => g.players.length > 0);

  const eligiblePlayers = activeSlot !== null
    ? players.filter((p) => {
        if (p.position !== SLOTS[activeSlot].label) return false;
        return !slotPlayers.some((sp, i) => i !== activeSlot && sp?.name === p.name);
      })
    : [];

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
                        <span className={`text-xs font-semibold px-1.5 py-0.5 rounded inline-block ${POSITION_STYLES[player.position] ?? "bg-gray-100 text-gray-600"}`}>
                          {player.position}
                        </span>
                      </td>
                      <td className="py-2 pr-4 text-gray-900 text-sm">{player.name}</td>
                      <td className="py-2 text-sm text-gray-400 whitespace-nowrap">£{player.price.toFixed(1)}m</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>

        {/* Pitch */}
        <div className="w-full md:w-60 md:flex-shrink-0 md:sticky md:top-8 order-first md:order-last">
          <p className="text-sm font-medium text-gray-600 mb-0.5">
            Free transfers:{" "}
            {freeTransfers === null ? "…" : freeTransfers === Infinity ? "∞" : freeTransfers}
          </p>
          <p className="text-sm font-medium text-gray-600 mb-2">Budget: £{budget.toFixed(1)}m</p>
          <Pitch onSlotClick={openSlot} slotPlayers={slotPlayers.map((p) => p?.name ?? null)} />
          <button
            onClick={saveTeam}
            disabled={budget < 0 || saving || freeTransfers === 0}
            className="mt-3 w-full py-2.5 rounded-full text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-gray-900 text-white hover:bg-gray-700 disabled:hover:bg-gray-900"
          >
            {saving ? "Saving…" : saved ? "Team saved!" : "Save team"}
          </button>
          {freeTransfers === 0 && (
            <p className="mt-2 text-xs text-red-500 text-center">
              You don&apos;t have any transfers left, wait until the next gameweek
            </p>
          )}
        </div>
      </div>

      {/* Modal */}
      {activeSlot !== null && createPortal(
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
              {selecting && (
                <button
                  onClick={() => setSelecting(false)}
                  className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
                >
                  ←
                </button>
              )}
              <h3 className="font-semibold text-gray-900 flex-1">
                {selecting ? "Select player" : SLOT_POSITION_LABEL[SLOTS[activeSlot].label]}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>

            {selecting ? (
              <ul className="divide-y divide-gray-100 max-h-80 overflow-y-auto">
                {eligiblePlayers.map((player) => (
                  <li key={player.name}>
                    <button
                      className="w-full flex items-center gap-3 px-6 py-3 hover:bg-gray-50 transition-colors text-left"
                      onClick={() => selectPlayer(player)}
                    >
                      <span className={`text-xs font-semibold px-1.5 py-0.5 rounded flex-shrink-0 ${POSITION_STYLES[player.position] ?? "bg-gray-100 text-gray-600"}`}>
                        {player.position}
                      </span>
                      <span className="flex-1 text-gray-900 text-sm">{player.name}</span>
                      <span className="text-sm text-gray-400 flex-shrink-0">£{player.price.toFixed(1)}m</span>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-6 py-5">
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
                <button
                  onClick={() => setSelecting(true)}
                  className="w-full bg-gray-900 text-white rounded-full py-2.5 text-sm font-medium hover:bg-gray-700 transition-colors"
                >
                  Select replacement
                </button>
              </div>
            )}
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
