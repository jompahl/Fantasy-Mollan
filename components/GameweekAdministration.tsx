"use client";

import { useMemo, useState } from "react";
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
