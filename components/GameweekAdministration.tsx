"use client";

import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useGameweekDeadlineLock } from "@/components/useGameweekDeadlineLock";

export default function GameweekAdministration() {
  const {
    loaded,
    isLocked,
    deadlineAt,
    refresh,
  } = useGameweekDeadlineLock();
  const [dateValue, setDateValue] = useState("");
  const [timeValue, setTimeValue] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [calculateGwNumber, setCalculateGwNumber] = useState("");
  const [calculating, setCalculating] = useState(false);
  const [calculateMessage, setCalculateMessage] = useState<string | null>(null);
  const [calculatedGwCount, setCalculatedGwCount] = useState<number | null>(null);

  useEffect(() => {
    fetch("/api/gameweek")
      .then((r) => r.json())
      .then((data) => setCalculatedGwCount((data.gameweeks ?? []).length))
      .catch(() => setCalculatedGwCount(null));
  }, []);

  const currentDeadlineLocal = useMemo(() => {
    if (!deadlineAt) return null;
    return new Date(deadlineAt);
  }, [deadlineAt]);

  async function saveDeadline() {
    if (!dateValue || !timeValue) {
      setMessage("Please select both date and time.");
      return;
    }

    const selectedLocal = new Date(`${dateValue}T${timeValue}`);
    if (Number.isNaN(selectedLocal.getTime())) {
      setMessage("Invalid date or time.");
      return;
    }
    if (selectedLocal.getTime() <= Date.now()) {
      setMessage("Deadline must be in the future.");
      return;
    }

    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from("gameweek_deadline")
      .upsert(
        {
          id: 1,
          deadline_at: selectedLocal.toISOString(),
        },
        { onConflict: "id" }
      );

    if (error) {
      setMessage(`Could not save deadline: ${error.message}`);
      setSaving(false);
      return;
    }

    await refresh();
    setSaving(false);
    setMessage("Deadline saved.");
  }

  async function calculateGameweek() {
    const gwNum = parseInt(calculateGwNumber, 10);
    if (!gwNum || gwNum < 1) {
      setCalculateMessage("Please enter a valid GW number.");
      return;
    }
    setCalculating(true);
    setCalculateMessage(null);
    const res = await fetch("/api/admin/calculate-gameweek", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gwNumber: gwNum }),
    });
    const data = await res.json();
    if (!res.ok) {
      setCalculateMessage(`Error: ${data.error}`);
    } else {
      setCalculateMessage(
        `GW ${data.gwNumber} calculated. ${data.usersSnapshotted} user${data.usersSnapshotted !== 1 ? "s" : ""} snapshotted, ${data.chipsReset} chip${data.chipsReset !== 1 ? "s" : ""} reset.`
      );
    }
    setCalculating(false);
  }

  async function unlockGameweek() {
    setSaving(true);
    setMessage(null);
    const { error } = await supabase
      .from("gameweek_deadline")
      .upsert(
        {
          id: 1,
          deadline_at: null,
        },
        { onConflict: "id" }
      );

    if (error) {
      setMessage(`Could not unlock gameweek: ${error.message}`);
      setSaving(false);
      return;
    }

    await refresh();
    setSaving(false);
    setMessage("Gameweek unlocked.");
  }

  if (!loaded) {
    return <p className="text-gray-400 text-sm">Loading…</p>;
  }

  return (
    <div className="w-full max-w-2xl">
      <h2 className="text-2xl font-semibold text-gray-900 mb-2">Gameweek Administration</h2>
      <p className="text-sm text-gray-600 mb-4">
        Schedule deadline for the upcoming gameweek.
      </p>

      <div className="rounded-xl border border-gray-200 p-4 bg-white">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Date
            </label>
            <input
              type="date"
              value={dateValue}
              onChange={(e) => setDateValue(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Time
            </label>
            <input
              type="time"
              value={timeValue}
              onChange={(e) => setTimeValue(e.target.value)}
              className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
            />
          </div>
        </div>

        <button
          onClick={saveDeadline}
          disabled={saving}
          className="mt-3 px-4 py-2 rounded-full text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40"
        >
          {saving ? "Saving…" : "Save deadline"}
        </button>
        <button
          onClick={unlockGameweek}
          disabled={saving}
          className="mt-3 ml-2 px-4 py-2 rounded-full text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40"
        >
          Unlock GW
        </button>
      </div>

      <div className="mt-6 rounded-xl border border-gray-200 p-4 bg-white">
        <h3 className="text-sm font-semibold text-gray-700 mb-1">Calculate Gameweek</h3>
        <p className="text-xs text-gray-500 mb-3">
          Snapshots all users&apos; teams for the given GW and resets any active chips. Run this once per GW after the match is played.
        </p>
        <p className="text-xs text-gray-500 mb-3">
          Gameweeks calculated:{" "}
          <span className="font-semibold text-gray-700">
            {calculatedGwCount !== null ? calculatedGwCount : "…"}
          </span>
        </p>
        <div className="flex items-center gap-3">
          <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
            <button
              type="button"
              onClick={() => setCalculateGwNumber((v) => String(Math.max(1, (parseInt(v, 10) || 1) - 1)))}
              className="px-3 py-2 text-gray-600 hover:bg-gray-100 text-sm font-medium"
            >
              −
            </button>
            <span className="w-10 text-center text-sm font-semibold text-gray-900">
              {calculateGwNumber || "—"}
            </span>
            <button
              type="button"
              onClick={() => setCalculateGwNumber((v) => String(Math.min(30, (parseInt(v, 10) || 0) + 1)))}
              className="px-3 py-2 text-gray-600 hover:bg-gray-100 text-sm font-medium"
            >
              +
            </button>
          </div>
          <button
            onClick={calculateGameweek}
            disabled={calculating || !calculateGwNumber}
            className="px-4 py-2 rounded-full text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40"
          >
            {calculating ? "Calculating…" : "Calculate"}
          </button>
        </div>
        {calculateMessage && (
          <p className="mt-2 text-sm text-gray-600">{calculateMessage}</p>
        )}
      </div>

      <div className="mt-4 rounded-xl border border-gray-200 p-4 bg-gray-50 text-sm text-gray-700 space-y-1">
        <p>
          Current deadline:{" "}
          <span className="font-semibold">
            {currentDeadlineLocal ? currentDeadlineLocal.toLocaleString() : "Not set"}
          </span>
        </p>
        <p>
          Transfer/Captain lock:{" "}
          <span className={`font-semibold ${isLocked ? "text-red-600" : "text-green-600"}`}>
            {isLocked ? "Locked" : "Open"}
          </span>
        </p>
        {message && <p className="text-gray-600">{message}</p>}
      </div>
    </div>
  );
}
