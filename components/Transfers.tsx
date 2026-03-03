"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Image from "next/image";
import type { Player } from "@/app/api/players/route";
import type { Gameweek } from "@/app/api/gameweek/route";
import Pitch, { SLOTS } from "@/components/Pitch";
import PlayerHistory from "@/components/PlayerHistory";
import { supabase } from "@/lib/supabase";
import { useGameweekDeadlineLock } from "@/components/useGameweekDeadlineLock";

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

function fantasyPosition(position: string): string {
  return position === "GK" ? "DEF" : position;
}

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
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [transfersBalance, setTransfersBalance] = useState<number | null>(null);
  const [pointsDeducted, setPointsDeducted] = useState(0);
  const [joinedGameweek, setJoinedGameweek] = useState<number | null>(null);
  const [isNewUser, setIsNewUser] = useState(false);
  const [captainName, setCaptainName] = useState<string | null>(null);
  const [tripleCaptainActive, setTripleCaptainActive] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [historyPlayer, setHistoryPlayer] = useState<string | null>(null);
  const { isLocked: deadlineLocked } = useGameweekDeadlineLock();

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
        setGameweeks(gwData.gameweeks ?? []);
      })
      .catch(() => setError(true));
  }, []);

  // Load saved slot selections and transfers_used from Supabase
  useEffect(() => {
    (async () => {
      const [{ data: slotData }, { data: teamData }] = await Promise.all([
        supabase
          .from("team_slots")
          .select("slot_index, player_name, player_position, player_price, is_captain")
          .eq("user_email", userEmail),
        supabase
          .from("user_teams")
          .select("transfers, points_deducted, joined_gameweek")
          .eq("user_email", userEmail)
          .single(),
      ]);

      if (!slotData || slotData.length === 0) setIsNewUser(true);
      if (slotData && slotData.length > 0) {
        const loaded: (Player | null)[] = Array(5).fill(null);
        let captain: string | null = null;
        for (const row of slotData) {
          loaded[row.slot_index] = {
            name: row.player_name,
            position: row.player_position,
            price: row.player_price,
          };
          if (row.is_captain === "CAPTAIN" || row.is_captain === "TRIPLE_CAPTAIN") captain = row.player_name;
          if (row.is_captain === "TRIPLE_CAPTAIN") setTripleCaptainActive(true);
        }
        setSlotPlayers(loaded);
        setSavedSlotPlayers(loaded);
        setCaptainName(captain);
      }

      setTransfersBalance((teamData as { transfers?: number | null } | null)?.transfers ?? null);
      setPointsDeducted(teamData?.points_deducted ?? 0);
      setJoinedGameweek(teamData?.joined_gameweek ?? null);
      setSlotsLoaded(true);
    })();
  }, [userEmail]);

  const budget = slotPlayers.reduce(
    (remaining, p) => Math.round((remaining - (p?.price ?? 0)) * 10) / 10,
    BUDGET_START
  );

  const pendingChanges = slotPlayers.filter((p, i) => p?.name !== savedSlotPlayers[i]?.name).length;

  // transfersBalance === null means unlimited (user hasn't had their first GW calculated yet)
  const isUnlimited = !slotsLoaded || transfersBalance === null;
  const freeTransfers: number | null =
    !slotsLoaded ? null
    : isUnlimited ? Infinity
    : Math.max(0, transfersBalance! - pendingChanges);
  const extraTransfers = isUnlimited ? 0 : Math.max(0, pendingChanges - transfersBalance!);
  const pointDeduction = extraTransfers * 4;

  function openSlot(index: number) {
    if (deadlineLocked) return;
    setActiveSlot(index);
    setSelecting(false);
    setShowHistory(false);
  }

  function closeModal() {
    setActiveSlot(null);
    setSelecting(false);
    setShowHistory(false);
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
    if (deadlineLocked) return;
    setSaving(true);

    const rows = slotPlayers
      .map((p, i) => p ? {
        user_email: userEmail,
        slot_index: i,
        player_name: p.name,
        player_position: p.position,
        player_price: p.price,
        is_captain: p.name === captainName ? (tripleCaptainActive ? "TRIPLE_CAPTAIN" : "CAPTAIN") : "NOT_CAPTAIN",
      } : null)
      .filter(Boolean);

    await supabase.from("team_slots").delete().eq("user_email", userEmail);
    if (rows.length > 0) await supabase.from("team_slots").insert(rows);

    // First-time save while GWs already exist — record which GW they start from
    if (isNewUser && joinedGameweek === null && calculatedGwCount && calculatedGwCount > 0) {
      const newJoinedGw = calculatedGwCount + 1;
      await supabase.from("user_teams").update({ joined_gameweek: newJoinedGw }).eq("user_email", userEmail);
      setJoinedGameweek(newJoinedGw);
      setIsNewUser(false);
    }

    // Deduct transfers from the bank. Unlimited (null) users pay nothing.
    if (transfersBalance !== null) {
      const changes = slotPlayers.filter((p, i) => p?.name !== savedSlotPlayers[i]?.name).length;
      const extras = Math.max(0, changes - transfersBalance);
      const newBalance = Math.max(0, transfersBalance - changes);
      const updates: Record<string, number> = { transfers: newBalance };
      if (extras > 0) updates.points_deducted = pointsDeducted + extras * 4;
      await supabase.from("user_teams").update(updates).eq("user_email", userEmail);
      setTransfersBalance(newBalance);
      if (extras > 0) setPointsDeducted(pointsDeducted + extras * 4);
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
    .map((pos) => ({
      pos,
      label: POSITION_LABELS[pos],
      players: players.filter((p) => fantasyPosition(p.position) === pos),
    }))
    .filter((g) => g.players.length > 0);

  const eligiblePlayers = activeSlot !== null
    ? players.filter((p) => {
        if (fantasyPosition(p.position) !== SLOTS[activeSlot].label) return false;
        return !slotPlayers.some((sp, i) => i !== activeSlot && sp?.name === p.name);
      })
    : [];
  const playerByName = new Map(players.map((p) => [p.name, p]));
  const activeSlotPlayer = activeSlot !== null ? slotPlayers[activeSlot] : null;
  const activePlayerMeta = activeSlotPlayer ? playerByName.get(activeSlotPlayer.name) : null;
  const activePlayerImage = activePlayerMeta?.image ?? "/avatar.webp";
  const activePlayerHasCustomImage = Boolean(activePlayerMeta?.image);
  const activePlayerImageRotation =
    typeof activePlayerMeta?.imageRotation === "number" ? activePlayerMeta.imageRotation : 0;

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
                    <tr
                      key={player.name}
                      className="border-b border-gray-100 cursor-pointer hover:bg-gray-50 transition-colors"
                      onClick={() => gameweeks.length > 0 && setHistoryPlayer(player.name)}
                    >
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
          {isNewUser && (
            <h2 className="text-lg font-semibold text-gray-900 mb-3">Choose your five a side team</h2>
          )}
          {deadlineLocked && (
            <p className="text-sm text-red-600 mb-2">
              The deadline for the upcoming gameweek has passed, no transfers or captain selections can be made until the gameweek is unlocked
            </p>
          )}
          <p className="text-sm font-medium text-gray-600 mb-0.5">
            Free transfers:{" "}
            {freeTransfers === null ? "…" : freeTransfers === Infinity ? "∞" : freeTransfers}
          </p>
          <p className="text-sm font-medium text-gray-600 mb-0.5">
            Budget: £{(activeSlot !== null && slotPlayers[activeSlot]
              ? Math.round((budget + slotPlayers[activeSlot]!.price) * 10) / 10
              : budget
            ).toFixed(1)}m
          </p>
          {budget < 0 && (
            <p className="text-xs text-red-500 mb-1">You have insufficient funds</p>
          )}
          {pointDeduction > 0 && (
            <div className="mb-1 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <p className="text-xs text-red-600 font-medium">
                -{pointDeduction} pt{pointDeduction !== 1 ? "s" : ""} deduction ({extraTransfers} extra transfer{extraTransfers !== 1 ? "s" : ""})
              </p>
            </div>
          )}
          {budget >= 0 && pointDeduction === 0 && <div className="mb-2" />}
          <Pitch
            onSlotClick={deadlineLocked ? undefined : openSlot}
            slotPlayers={slotPlayers.map((p) => p?.name ?? null)}
            slotPrices={slotPlayers.map((p) => p?.price ?? null)}
            highlightEmpty={isNewUser}
          />
          <div className="mt-3 flex gap-2">
            <button
              onClick={() => { setSlotPlayers([...savedSlotPlayers]); setSaved(false); }}
              disabled={deadlineLocked || saving || !slotPlayers.some((p, i) => p?.name !== savedSlotPlayers[i]?.name)}
              className="flex-1 py-2.5 rounded-full text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:hover:bg-white"
            >
              Reset
            </button>
            <button
              onClick={saveTeam}
              disabled={deadlineLocked || budget < 0 || saving || !slotPlayers.some((p, i) => p?.name !== savedSlotPlayers[i]?.name)}
              className="flex-1 py-2.5 rounded-full text-sm font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed bg-gray-900 text-white hover:bg-gray-700 disabled:hover:bg-gray-900"
            >
              {saving ? "Saving…" : saved ? "Team saved!" : "Save team"}
            </button>
          </div>
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
              {(selecting || showHistory) && (
                <button
                  onClick={() => { setSelecting(false); setShowHistory(false); }}
                  className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
                >
                  ←
                </button>
              )}
              <h3 className="font-semibold text-gray-900 flex-1">
                {selecting
                  ? "Select player"
                  : showHistory
                  ? `${slotPlayers[activeSlot]?.name ?? "Player"} — History`
                  : SLOT_POSITION_LABEL[SLOTS[activeSlot].label]}
              </h3>
              <button
                onClick={closeModal}
                className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>

            {selecting ? (
              <>
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
              </>
            ) : showHistory ? (
              <div className="px-6 py-4">
                <PlayerHistory playerName={slotPlayers[activeSlot]!.name} gameweeks={gameweeks} />
              </div>
            ) : (
              <div className="px-6 py-5">
                {slotPlayers[activeSlot] ? (
                  <div className="mb-5">
                    <div className="w-12 h-12 rounded-xl overflow-hidden border border-gray-200 bg-white mb-2">
                      <Image
                        src={activePlayerImage}
                        alt={slotPlayers[activeSlot]!.name}
                        width={48}
                        height={48}
                        className="w-full h-full object-cover"
                        style={
                          activePlayerHasCustomImage
                            ? {
                                objectPosition: "center 22%",
                                transform: `scale(1.18) rotate(${activePlayerImageRotation}deg)`,
                              }
                            : undefined
                        }
                        unoptimized
                      />
                    </div>
                    <p className="text-gray-900 font-medium">{slotPlayers[activeSlot]!.name}</p>
                    <p className="text-sm text-gray-400 mt-0.5">
                      {slotPlayers[activeSlot]!.position} · £{slotPlayers[activeSlot]!.price.toFixed(1)}m
                    </p>
                  </div>
                ) : (
                  <p className="text-gray-400 text-sm mb-5">No player selected</p>
                )}
                {slotPlayers[activeSlot] && gameweeks.length > 0 && (
                  <button
                    onClick={() => setShowHistory(true)}
                    className="w-full mb-3 py-2.5 rounded-full text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Show history
                  </button>
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
      {/* Player history modal */}
      {historyPlayer !== null && createPortal(
        <div
          className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4"
          onClick={() => setHistoryPlayer(null)}
        >
          <div
            className="bg-white rounded-2xl w-full max-w-sm shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100">
              <h3 className="font-semibold text-gray-900 flex-1">{historyPlayer} — History</h3>
              <button
                onClick={() => setHistoryPlayer(null)}
                className="text-gray-400 hover:text-gray-600 transition-colors text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-6 py-4">
              <PlayerHistory playerName={historyPlayer} gameweeks={gameweeks} />
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
}
