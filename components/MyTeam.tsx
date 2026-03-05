"use client";

import { useEffect, useState } from "react";
import Pitch, { SLOTS } from "@/components/Pitch";
import { supabase } from "@/lib/supabase";
import { useGameweekDeadlineLock } from "@/components/useGameweekDeadlineLock";

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
  const { isLocked } = useGameweekDeadlineLock();

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
    ]).then(
      ([{ data: slotData }, { data: teamData }, { data: snapshotData }]) => {
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

  return (
    <div className="flex flex-col items-center">
      <div className="w-full md:w-96">
        <p className="text-sm font-medium text-gray-600 mb-2">
          Select captain for the upcoming gameweek
        </p>
        {isLocked && (
          <p className="text-sm text-red-600 mb-2">
            The deadline for the upcoming gameweek has passed, no transfers or captain selections can be made until the gameweek is unlocked by admin
          </p>
        )}
        <Pitch
          onSlotClick={isLocked ? undefined : selectCaptain}
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
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Chips</p>
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
    </div>
  );
}
