"use client";

import { useEffect, useState } from "react";
import Pitch, { SLOTS } from "@/components/Pitch";
import { supabase } from "@/lib/supabase";
import { useGameweekDeadlineLock } from "@/components/useGameweekDeadlineLock";
import { ensureSnapshots } from "@/lib/ensureSnapshots";

type CaptainRole = "CAPTAIN" | "TRIPLE_CAPTAIN" | "NOT_CAPTAIN";

interface SlotPlayer {
  name: string;
}

interface Props {
  userEmail: string;
  onTotalPointsChange?: (points: number) => void;
}

export default function MyTeam({ userEmail, onTotalPointsChange }: Props) {
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
    ensureSnapshots(userEmail).then(() => Promise.all([
      supabase
        .from("team_slots")
        .select("slot_index, player_name, is_captain")
        .eq("user_email", userEmail),
      supabase
        .from("user_teams")
        .select("points_deducted, joined_gameweek, boost_chip")
        .eq("user_email", userEmail)
        .single(),
      supabase
        .from("gameweek_snapshots")
        .select("gameweek_number, slot_index, player_name, is_captain, boost_chip")
        .eq("user_email", userEmail),
      fetch("/api/gameweek").then((r) => r.json()),
    ]).then(
      ([{ data: slotData }, { data: teamData }, { data: snapshotData }, gwData]) => {
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

        if (!gwData.error && gwData.gameweeks?.length) {
          const joinedGameweek: number | null = teamData?.joined_gameweek ?? null;
          const currentBoostChip = (teamData as { boost_chip?: string | null } | null)?.boost_chip ?? null;
          let total = 0;
          for (const gw of gwData.gameweeks as Array<{ number: number; players: Array<{ name: string; points: number }> }>) {
            if (joinedGameweek !== null && gw.number < joinedGameweek) continue;
            const gwSnapshots = snapshots.filter((s) => s.gameweek_number === gw.number);
            const teamSlots =
              gwSnapshots.length > 0
                ? gwSnapshots
                : (slotData ?? []).map((s) => ({ slot_index: s.slot_index, player_name: s.player_name, is_captain: s.is_captain ?? "NOT_CAPTAIN", boost_chip: null as string | null }));

            const captainForGw = gwSnapshots.length > 0
              ? (gwSnapshots.find((s) => s.is_captain === "CAPTAIN" || s.is_captain === "TRIPLE_CAPTAIN")?.player_name ?? null)
              : (captainIdx !== null ? current[captainIdx]?.name ?? null : null);
            const tcActiveForGw = gwSnapshots.length > 0
              ? gwSnapshots.some((s) => s.is_captain === "TRIPLE_CAPTAIN")
              : tcActive;
            const boostChipForGw = gwSnapshots.length > 0
              ? (gwSnapshots[0]?.boost_chip ?? null)
              : currentBoostChip;
            for (const slot of teamSlots) {
              const stat = gw.players.find((p) => p.name === slot.player_name);
              const base = stat?.points ?? 0;
              let multiplier = slot.player_name === captainForGw ? (tcActiveForGw ? 3 : 2) : 1;
              if (boostChipForGw && SLOTS[slot.slot_index]?.label === boostChipForGw.replace("_BOOST", "")) multiplier *= 2;
              total += base * multiplier;
            }
          }
          total -= teamData?.points_deducted ?? 0;
          onTotalPointsChange?.(total);
        } else {
          onTotalPointsChange?.(0);
        }

        setLoaded(true);
      }
    ));
  }, [userEmail, onTotalPointsChange]);

  async function toggleBoostChip(chip: "DEF_BOOST" | "MID_BOOST" | "FWD_BOOST") {
    if (isLocked) return;
    const chipGw = chip === "DEF_BOOST" ? defBoostGw : chip === "MID_BOOST" ? midBoostGw : fwdBoostGw;
    if (chipGw !== null) return;
    const next = activeBoostChip === chip ? null : chip;
    setActiveBoostChip(next);
    await supabase
      .from("user_teams")
      .update({ boost_chip: next })
      .eq("user_email", userEmail);
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
  }

  async function selectCaptain(slotIndex: number) {
    if (isLocked) return;
    const slot = slotPlayers[slotIndex];
    if (!slot) return;

    const previousCaptainName = captainSlotIndex !== null ? slotPlayers[captainSlotIndex]?.name ?? null : null;
    const previousRole: CaptainRole = tripleCaptainActive ? "TRIPLE_CAPTAIN" : "CAPTAIN";
    setCaptainSlotIndex(slotIndex);
    setSavingCaptain(true);

    // Freeze captain history for all calculated gameweeks before changing captain.
    const gwData = await fetch("/api/gameweek").then((r) => r.json());
    const calculatedGameweeks: { number: number }[] = gwData.gameweeks ?? [];
    if (calculatedGameweeks.length > 0) {
      const [{ data: existingSnapshots }, { data: teamSlots }] = await Promise.all([
        supabase
          .from("gameweek_snapshots")
          .select("gameweek_number, slot_index, player_name, player_position, player_price, is_captain")
          .eq("user_email", userEmail),
        supabase
          .from("team_slots")
          .select("slot_index, player_name, player_position, player_price")
          .eq("user_email", userEmail),
      ]);

      const snapshotByGw = new Map<number, {
        gameweek_number: number;
        slot_index: number;
        player_name: string;
        player_position: string;
        player_price: number;
        is_captain?: string | null;
      }[]>();
      for (const row of existingSnapshots ?? []) {
        if (!snapshotByGw.has(row.gameweek_number)) snapshotByGw.set(row.gameweek_number, []);
        snapshotByGw.get(row.gameweek_number)!.push(row);
      }

      const insertRows = [];
      for (const gw of calculatedGameweeks) {
        if (!snapshotByGw.has(gw.number)) {
          for (const row of teamSlots ?? []) {
            const isCap = previousCaptainName !== null && row.player_name === previousCaptainName;
            insertRows.push({
              user_email: userEmail,
              gameweek_number: gw.number,
              slot_index: row.slot_index,
              player_name: row.player_name,
              player_position: row.player_position,
              player_price: row.player_price,
              is_captain: isCap ? previousRole : "NOT_CAPTAIN",
            });
          }
        }
      }

      if (insertRows.length > 0) {
        await supabase.from("gameweek_snapshots").insert(insertRows);
      }

      const existingGwNumbers = calculatedGameweeks
        .map((g) => g.number)
        .filter((gwNumber) => snapshotByGw.has(gwNumber));

      for (const gwNumber of existingGwNumbers) {
        const gwRows = snapshotByGw.get(gwNumber) ?? [];
        const isFrozen = gwRows.some((r) => r.is_captain !== null && r.is_captain !== undefined);
        if (isFrozen) continue;

        await supabase
          .from("gameweek_snapshots")
          .update({ is_captain: "NOT_CAPTAIN" })
          .eq("user_email", userEmail)
          .eq("gameweek_number", gwNumber);

        if (previousCaptainName) {
          await supabase
            .from("gameweek_snapshots")
            .update({ is_captain: previousRole })
            .eq("user_email", userEmail)
            .eq("gameweek_number", gwNumber)
            .eq("player_name", previousCaptainName);
        }
      }
    }

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
    <div className="w-full md:w-60">
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
      <div className="mt-4">
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
