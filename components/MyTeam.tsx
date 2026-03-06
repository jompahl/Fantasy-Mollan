"use client";

import { useEffect, useState } from "react";
import Pitch, { SLOTS } from "@/components/Pitch";
import PlayerHistory from "@/components/PlayerHistory";
import { supabase } from "@/lib/supabase";
import { useGameweekDeadlineLock } from "@/components/useGameweekDeadlineLock";
import type { Gameweek } from "@/app/api/gameweek/route";

type CaptainRole = "CAPTAIN" | "TRIPLE_CAPTAIN" | "NOT_CAPTAIN";

interface SlotPlayer {
  name: string;
}

interface Props {
  userEmail: string;
}

export default function MyTeam({ userEmail }: Props) {
  const [slotPlayers, setSlotPlayers] = useState<(SlotPlayer | null)[]>(Array(5).fill(null));
  const [captainSlotIndex, setCaptainSlotIndex] = useState<number | null>(null);
  const [tripleCaptainActive, setTripleCaptainActive] = useState(false);
  const [tripleCaptainGw, setTripleCaptainGw] = useState<number | null>(null);
  const [activeBoostChip, setActiveBoostChip] = useState<string | null>(null);
  const [defBoostGw, setDefBoostGw] = useState<number | null>(null);
  const [midBoostGw, setMidBoostGw] = useState<number | null>(null);
  const [fwdBoostGw, setFwdBoostGw] = useState<number | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [savingCaptain, setSavingCaptain] = useState(false);
  const [upcomingGwNumber, setUpcomingGwNumber] = useState<number | null>(null);
  const [gameweeks, setGameweeks] = useState<Gameweek[]>([]);
  const [selectedSlotIndex, setSelectedSlotIndex] = useState<number | null>(null);
  const [chipInfoModal, setChipInfoModal] = useState(false);
  const { isLocked, deadlineAt } = useGameweekDeadlineLock();

  useEffect(() => {
    Promise.all([
      supabase
        .from("team_slots")
        .select("slot_index, player_name, is_captain")
        .eq("user_email", userEmail),
      supabase
        .from("user_teams")
        .select("joined_gameweek, boost_chip")
        .eq("user_email", userEmail)
        .single(),
      supabase
        .from("gameweek_snapshots")
        .select("gameweek_number, slot_index, player_name, is_captain, boost_chip")
        .eq("user_email", userEmail),
      supabase
        .from("gameweek_snapshots")
        .select("gameweek_number")
        .order("gameweek_number", { ascending: false })
        .limit(1)
        .maybeSingle(),
      fetch("/api/gameweek").then((r) => r.json()),
    ]).then(
      ([{ data: slotData }, { data: teamData }, { data: snapshotData }, { data: latestSnapshot }, gwData]) => {
        const snapshots =
          (snapshotData as Array<{
            gameweek_number: number;
            slot_index: number;
            player_name: string;
            is_captain?: string | null;
            boost_chip?: string | null;
          }> | null) ?? [];

        const tcSnapshot = snapshots.find((s) => s.is_captain === "TRIPLE_CAPTAIN");
        setTripleCaptainGw(tcSnapshot?.gameweek_number ?? null);

        setDefBoostGw(snapshots.find((s) => s.boost_chip === "DEF_BOOST")?.gameweek_number ?? null);
        setMidBoostGw(snapshots.find((s) => s.boost_chip === "MID_BOOST")?.gameweek_number ?? null);
        setFwdBoostGw(snapshots.find((s) => s.boost_chip === "FWD_BOOST")?.gameweek_number ?? null);
        setActiveBoostChip((teamData as { boost_chip?: string | null } | null)?.boost_chip ?? null);

        const current: (SlotPlayer | null)[] = Array(5).fill(null);
        let captainIdx: number | null = null;
        let tcActive = false;
        if (slotData && slotData.length > 0) {
          for (const row of slotData) {
            current[row.slot_index] = { name: row.player_name };
            if (row.is_captain === "CAPTAIN" || row.is_captain === "TRIPLE_CAPTAIN") {
              captainIdx = row.slot_index;
            }
            if (row.is_captain === "TRIPLE_CAPTAIN") tcActive = true;
          }
          setSlotPlayers(current);
        }
        setCaptainSlotIndex(captainIdx);
        setTripleCaptainActive(tcActive);

        const maxGw = (latestSnapshot as { gameweek_number?: number } | null)?.gameweek_number ?? null;
        setUpcomingGwNumber(maxGw !== null ? maxGw + 1 : null);

        setGameweeks(gwData.gameweeks ?? []);
        setLoaded(true);
      }
    );
  }, [userEmail]);

  async function toggleBoostChip(chip: "DEF_BOOST" | "MID_BOOST" | "FWD_BOOST") {
    if (isLocked) return;
    const chipGw = chip === "DEF_BOOST" ? defBoostGw : chip === "MID_BOOST" ? midBoostGw : fwdBoostGw;
    if (chipGw !== null) return;
    const next = activeBoostChip === chip ? null : chip;
    setActiveBoostChip(next);
    await supabase.from("user_teams").update({ boost_chip: next }).eq("user_email", userEmail);
    if (next !== null && tripleCaptainActive && captainSlotIndex !== null) {
      setTripleCaptainActive(false);
      await supabase
        .from("team_slots")
        .update({ is_captain: "CAPTAIN" })
        .eq("user_email", userEmail)
        .eq("slot_index", captainSlotIndex);
    }
  }

  async function toggleTripleCaptain() {
    if (isLocked || tripleCaptainGw !== null || captainSlotIndex === null) return;
    const next = !tripleCaptainActive;
    const newRole: CaptainRole = next ? "TRIPLE_CAPTAIN" : "CAPTAIN";
    setTripleCaptainActive(next);
    await supabase
      .from("team_slots")
      .update({ is_captain: newRole })
      .eq("user_email", userEmail)
      .eq("slot_index", captainSlotIndex);
    if (next && activeBoostChip !== null) {
      setActiveBoostChip(null);
      await supabase.from("user_teams").update({ boost_chip: null }).eq("user_email", userEmail);
    }
  }

  async function selectCaptain(slotIndex: number) {
    if (isLocked) return;
    const slot = slotPlayers[slotIndex];
    if (!slot) return;

    setCaptainSlotIndex(slotIndex);
    setSavingCaptain(true);

    // Update team_slots: clear all captains then set the new one
    await supabase
      .from("team_slots")
      .update({ is_captain: "NOT_CAPTAIN" })
      .eq("user_email", userEmail);
    const { error } = await supabase
      .from("team_slots")
      .update({ is_captain: tripleCaptainActive ? "TRIPLE_CAPTAIN" : "CAPTAIN" })
      .eq("user_email", userEmail)
      .eq("slot_index", slotIndex);
    if (error) {
      console.error("[my-team] could not persist captain:", error.message);
    }
    setSavingCaptain(false);
  }

  if (!loaded) {
    return <p className="text-gray-400 text-sm">Loading…</p>;
  }

  const captainName = captainSlotIndex !== null ? slotPlayers[captainSlotIndex]?.name ?? null : null;

  function formatDeadline(iso: string): string {
    const d = new Date(iso);
    const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
  }

  const headingText = deadlineAt && !isLocked && upcomingGwNumber !== null
    ? `Gameweek ${upcomingGwNumber} - Deadline: ${formatDeadline(deadlineAt)}`
    : "Select captain for the upcoming gameweek";

  return (
    <div className="flex flex-col items-center">
      <div className="w-full md:w-96">
        <p className="text-sm font-medium text-gray-600 mb-2">
          {headingText}
        </p>
        {isLocked && (
          <p className="text-sm text-red-600 mb-2">
            The deadline for the upcoming gameweek has passed, no transfers or captain selections can be made until the gameweek is calculated, stay tuned
          </p>
        )}
        <Pitch
          onSlotClick={(i) => setSelectedSlotIndex(i)}
          slotPlayers={slotPlayers.map((p) => p?.name ?? null)}
          slotCaptains={slotPlayers.map((_, i) => i === captainSlotIndex)}
          slotTripleCaptains={slotPlayers.map((_, i) => i === captainSlotIndex && tripleCaptainActive)}
          slotBoosts={slotPlayers.map((_, i) => !!activeBoostChip && SLOTS[i]?.label === activeBoostChip.replace("_BOOST", ""))}
        />
        <p className="mt-3 text-sm text-gray-600">
          Captain:{" "}
          <span className="font-semibold text-gray-900">
            {captainName ?? "Not selected"}
          </span>
        </p>
        {savingCaptain && (
          <p className="text-xs text-gray-400 mt-1">Saving captain…</p>
        )}
      </div>

      {/* Chips */}
      <div className="w-full md:w-96 mt-4">
        <div className="flex items-center justify-between mb-2">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider">Chips</p>
          <button
            onClick={() => setChipInfoModal(true)}
            className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0"
            aria-label="Chip rules"
          >
            <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="12" y1="16" x2="12" y2="12" />
              <line x1="12" y1="8" x2="12.01" y2="8" strokeWidth="2.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <button
          onClick={toggleTripleCaptain}
          disabled={isLocked || tripleCaptainGw !== null || captainSlotIndex === null}
          className={`w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-colors disabled:cursor-not-allowed
            ${tripleCaptainGw !== null
              ? "border-gray-200 bg-gray-50 text-gray-400"
              : tripleCaptainActive
              ? "border-yellow-400 bg-yellow-50 text-yellow-800"
              : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-base font-bold text-yellow-900 bg-yellow-300 rounded-full px-1.5 py-0.5 leading-none text-[11px]">TC</span>
            <span>Triple Captain</span>
          </div>
          <span className="text-xs">
            {tripleCaptainGw !== null ? `Used in GW ${tripleCaptainGw}` : tripleCaptainActive ? "Active" : "Play chip"}
          </span>
        </button>
        <button
          onClick={() => toggleBoostChip("DEF_BOOST")}
          disabled={isLocked || defBoostGw !== null}
          className={`mt-2 w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-colors disabled:cursor-not-allowed
            ${defBoostGw !== null
              ? "border-gray-200 bg-gray-50 text-gray-400"
              : activeBoostChip === "DEF_BOOST"
              ? "border-blue-400 bg-blue-50 text-blue-800"
              : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-white bg-blue-500 rounded-full px-1.5 py-0.5 leading-none">2X</span>
            <span>Defensive Boost</span>
          </div>
          <span className="text-xs">
            {defBoostGw !== null ? `Used in GW ${defBoostGw}` : activeBoostChip === "DEF_BOOST" ? "Active" : "Play chip"}
          </span>
        </button>
        <button
          onClick={() => toggleBoostChip("MID_BOOST")}
          disabled={isLocked || midBoostGw !== null}
          className={`mt-2 w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-colors disabled:cursor-not-allowed
            ${midBoostGw !== null
              ? "border-gray-200 bg-gray-50 text-gray-400"
              : activeBoostChip === "MID_BOOST"
              ? "border-blue-400 bg-blue-50 text-blue-800"
              : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-white bg-blue-500 rounded-full px-1.5 py-0.5 leading-none">2X</span>
            <span>Midfield Boost</span>
          </div>
          <span className="text-xs">
            {midBoostGw !== null ? `Used in GW ${midBoostGw}` : activeBoostChip === "MID_BOOST" ? "Active" : "Play chip"}
          </span>
        </button>
        <button
          onClick={() => toggleBoostChip("FWD_BOOST")}
          disabled={isLocked || fwdBoostGw !== null}
          className={`mt-2 w-full flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-colors disabled:cursor-not-allowed
            ${fwdBoostGw !== null
              ? "border-gray-200 bg-gray-50 text-gray-400"
              : activeBoostChip === "FWD_BOOST"
              ? "border-blue-400 bg-blue-50 text-blue-800"
              : "border-gray-300 bg-white text-gray-700 hover:bg-gray-50"
            }`}
        >
          <div className="flex items-center gap-2">
            <span className="text-[11px] font-bold text-white bg-blue-500 rounded-full px-1.5 py-0.5 leading-none">2X</span>
            <span>Attack Boost</span>
          </div>
          <span className="text-xs">
            {fwdBoostGw !== null ? `Used in GW ${fwdBoostGw}` : activeBoostChip === "FWD_BOOST" ? "Active" : "Play chip"}
          </span>
        </button>
      </div>

      {chipInfoModal && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setChipInfoModal(false)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between">
              <h3 className="text-base font-semibold text-gray-900">Chips</h3>
              <button
                onClick={() => setChipInfoModal(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            <div className="px-5 py-4 space-y-4 text-sm text-gray-600">
              <p>Chips can be played once a season, you can only play one chip in a gameweek.</p>
              <div>
                <p className="font-semibold text-gray-800 mb-1">Triple Captain</p>
                <p>Your captain earns <strong>3× points</strong> instead of the usual 2× for one gameweek.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-1">Defensive Boost</p>
                <p>Your two <strong>defenders</strong> each earn <strong>2× points</strong> for one gameweek.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-1">Midfield Boost</p>
                <p>Your two <strong>midfielders</strong> each earn <strong>2× points</strong> for one gameweek.</p>
              </div>
              <div>
                <p className="font-semibold text-gray-800 mb-1">Attack Boost</p>
                <p>Your <strong>forward</strong> earns <strong>2× points</strong> for one gameweek.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {selectedSlotIndex !== null && slotPlayers[selectedSlotIndex] && (
        <div
          className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
          onClick={() => setSelectedSlotIndex(null)}
        >
          <div
            className="bg-white rounded-2xl shadow-xl w-full max-w-sm flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
              <h3 className="text-base font-semibold text-gray-900">
                {slotPlayers[selectedSlotIndex]!.name}{upcomingGwNumber !== null ? " — History" : ""}
              </h3>
              <button
                onClick={() => setSelectedSlotIndex(null)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none"
              >
                ×
              </button>
            </div>
            {upcomingGwNumber !== null && (
              <div className="px-5 py-4">
                <PlayerHistory
                  playerName={slotPlayers[selectedSlotIndex]!.name}
                  gameweeks={gameweeks}
                />
              </div>
            )}
            {!isLocked && (
              <div className="px-5 pb-4 pt-4 flex-shrink-0">
                <button
                  onClick={async () => {
                    await selectCaptain(selectedSlotIndex);
                    setSelectedSlotIndex(null);
                  }}
                  disabled={savingCaptain}
                  className="w-full py-2 rounded-full text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40 transition-colors"
                >
                  {savingCaptain ? "Saving…" : "Select as captain"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
