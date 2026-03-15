"use client";

import { useMemo, useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useGameweekDeadlineLock } from "@/components/useGameweekDeadlineLock";

interface VoteResult {
  player: string;
  score: number;
  votes: number;
}

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
  const [seeding, setSeeding] = useState(false);
  const [seedMessage, setSeedMessage] = useState<string | null>(null);

  // Vote deadline state
  const [voteDateValue, setVoteDateValue] = useState("");
  const [voteTimeValue, setVoteTimeValue] = useState("");
  const [voteSaving, setVoteSaving] = useState(false);
  const [voteDeadlineAt, setVoteDeadlineAt] = useState<string | null>(null);
  const [voteMessage, setVoteMessage] = useState<string | null>(null);

  // Reset password state
  const [credUsers, setCredUsers] = useState<string[] | null>(null);
  const [resetUsername, setResetUsername] = useState("");
  const [resetPassword, setResetPassword] = useState("");
  const [resetting, setResetting] = useState(false);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  // Vote results state
  const [voteResultsGw, setVoteResultsGw] = useState("");
  const [voteResults, setVoteResults] = useState<VoteResult[] | null>(null);
  const [voteResultsLoading, setVoteResultsLoading] = useState(false);
  const [finalizing, setFinalizing] = useState(false);
  const [finalizeMessage, setFinalizeMessage] = useState<string | null>(null);

  // Accordion state
  const [openSection, setOpenSection] = useState<string | null>(null);
  function toggleSection(key: string) {
    setOpenSection((prev) => (prev === key ? null : key));
  }

  useEffect(() => {
    fetch("/api/gameweek")
      .then((r) => r.json())
      .then((data) => setCalculatedGwCount((data.gameweeks ?? []).length))
      .catch(() => setCalculatedGwCount(null));
  }, []);

  useEffect(() => {
    supabase
      .from("gameweek_deadline")
      .select("vote_deadline_at")
      .eq("id", 1)
      .maybeSingle<{ vote_deadline_at: string | null }>()
      .then(({ data }) => setVoteDeadlineAt(data?.vote_deadline_at ?? null));
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

  async function seedPlayers() {
    setSeeding(true);
    setSeedMessage(null);
    const res = await fetch("/api/admin/seed-players", { method: "POST" });
    const data = await res.json();
    if (!res.ok) {
      setSeedMessage(`Error: ${data.error}`);
    } else {
      setSeedMessage(`Done. ${data.seeded} player${data.seeded !== 1 ? "s" : ""} seeded from sheet.`);
    }
    setSeeding(false);
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
        `GW ${data.gwNumber} calculated. ${data.usersSnapshotted} user${data.usersSnapshotted !== 1 ? "s" : ""} snapshotted, ${data.chipsReset} chip${data.chipsReset !== 1 ? "s" : ""} reset, ${data.pricesUpdated ?? 0} player price${(data.pricesUpdated ?? 0) !== 1 ? "s" : ""} updated.`
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

  async function saveVoteDeadline() {
    if (!voteDateValue || !voteTimeValue) {
      setVoteMessage("Please select both date and time.");
      return;
    }
    const selectedLocal = new Date(`${voteDateValue}T${voteTimeValue}`);
    if (Number.isNaN(selectedLocal.getTime())) {
      setVoteMessage("Invalid date or time.");
      return;
    }
    if (selectedLocal.getTime() <= Date.now()) {
      setVoteMessage("Vote deadline must be in the future.");
      return;
    }
    setVoteSaving(true);
    setVoteMessage(null);
    const { error } = await supabase
      .from("gameweek_deadline")
      .upsert({ id: 1, vote_deadline_at: selectedLocal.toISOString() }, { onConflict: "id" });
    if (error) {
      setVoteMessage(`Could not save vote deadline: ${error.message}`);
    } else {
      setVoteDeadlineAt(selectedLocal.toISOString());
      setVoteMessage("Vote deadline saved.");
    }
    setVoteSaving(false);
  }

  async function clearVoteDeadline() {
    setVoteSaving(true);
    setVoteMessage(null);
    const { error } = await supabase
      .from("gameweek_deadline")
      .upsert({ id: 1, vote_deadline_at: null }, { onConflict: "id" });
    if (error) {
      setVoteMessage(`Could not clear vote deadline: ${error.message}`);
    } else {
      setVoteDeadlineAt(null);
      setVoteMessage("Vote deadline cleared.");
    }
    setVoteSaving(false);
  }

  async function finalizeVotes() {
    const gwNum = parseInt(voteResultsGw, 10);
    if (!gwNum || gwNum < 1) return;
    setFinalizing(true);
    setFinalizeMessage(null);
    const res = await fetch("/api/admin/finalize-votes", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ gwNumber: gwNum }),
    });
    const data = await res.json();
    if (!res.ok) {
      setFinalizeMessage(`Error: ${data.error}`);
    } else if (data.bonuses?.length === 0) {
      setFinalizeMessage("No votes found — nothing to finalize.");
    } else {
      setFinalizeMessage(`Done. Vote bonuses saved for ${data.bonuses.length} player${data.bonuses.length !== 1 ? "s" : ""}.`);
    }
    setFinalizing(false);
  }

  async function loadVoteResults() {
    const gwNum = parseInt(voteResultsGw, 10);
    if (!gwNum || gwNum < 1) {
      return;
    }
    setVoteResultsLoading(true);
    setVoteResults(null);
    const { data: rows } = await supabase
      .from("gw_votes")
      .select("player_1, player_2, player_3")
      .eq("gameweek_number", gwNum);

    if (!rows || rows.length === 0) {
      setVoteResults([]);
      setVoteResultsLoading(false);
      return;
    }

    const scores: Record<string, { score: number; votes: number }> = {};
    const weights = [3, 2, 1] as const;
    for (const row of rows) {
      const picks = [row.player_1, row.player_2, row.player_3];
      picks.forEach((player, i) => {
        if (!player) return;
        if (!scores[player]) scores[player] = { score: 0, votes: 0 };
        scores[player].score += weights[i];
        scores[player].votes += 1;
      });
    }

    const results: VoteResult[] = Object.entries(scores)
      .map(([player, { score, votes }]) => ({ player, score, votes }))
      .sort((a, b) => b.score - a.score || b.votes - a.votes);

    setVoteResults(results);
    setVoteResultsLoading(false);
  }

  async function loadCredUsers() {
    if (credUsers !== null) return;
    const { data } = await supabase.from("credentials_users").select("username").order("username");
    setCredUsers((data ?? []).map((r: { username: string }) => r.username));
  }

  async function submitResetPassword() {
    if (!resetUsername || !resetPassword) return;
    setResetting(true);
    setResetMessage(null);
    const res = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ username: resetUsername, newPassword: resetPassword }),
    });
    const data = await res.json();
    if (!res.ok) {
      setResetMessage(`Error: ${data.error}`);
    } else {
      setResetMessage(`Password updated for ${resetUsername}.`);
      setResetPassword("");
    }
    setResetting(false);
  }

  if (!loaded) {
    return <p className="text-gray-400 text-sm">Loading…</p>;
  }

  return (
    <div className="w-full max-w-2xl">
      <h2 className="text-2xl font-semibold text-gray-900 mb-4">Gameweek Administration</h2>

      <div className="rounded-xl border border-gray-200 overflow-hidden divide-y divide-gray-200">

        {/* Gameweek deadline */}
        <div>
          <button
            onClick={() => toggleSection("deadline")}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Gameweek deadline
            <span className="text-gray-400 text-xs">{openSection === "deadline" ? "▲" : "▼"}</span>
          </button>
          {openSection === "deadline" && (
            <div className="px-4 pb-4 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Date</label>
                  <input type="date" value={dateValue} onChange={(e) => setDateValue(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Time</label>
                  <input type="time" value={timeValue} onChange={(e) => setTimeValue(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900" />
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={saveDeadline} disabled={saving} className="px-4 py-2 rounded-full text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40">
                  {saving ? "Saving…" : "Save deadline"}
                </button>
                <button onClick={unlockGameweek} disabled={saving} className="px-4 py-2 rounded-full text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                  Unlock GW
                </button>
              </div>
              <div className="rounded-lg border border-gray-200 p-3 bg-gray-50 text-sm text-gray-700 space-y-1">
                <p>Current deadline: <span className="font-semibold">{currentDeadlineLocal ? currentDeadlineLocal.toLocaleString() : "Not set"}</span></p>
                <p>Transfer/Captain lock: <span className={`font-semibold ${isLocked ? "text-red-600" : "text-green-600"}`}>{isLocked ? "Locked" : "Open"}</span></p>
                {message && <p className="text-gray-600">{message}</p>}
              </div>
            </div>
          )}
        </div>

        {/* Save snapshots */}
        <div>
          <button
            onClick={() => toggleSection("snapshots")}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Save snapshots
            <span className="text-gray-400 text-xs">{openSection === "snapshots" ? "▲" : "▼"}</span>
          </button>
          {openSection === "snapshots" && (
            <div className="px-4 pb-4 pt-1 space-y-3">
              <p className="text-xs text-gray-500">Snapshots all users&apos; teams for the given GW and resets any active chips. Run this once per GW after the match is played.</p>
              <p className="text-xs text-gray-500">Gameweeks calculated: <span className="font-semibold text-gray-700">{calculatedGwCount !== null ? calculatedGwCount : "…"}</span></p>
              <div className="flex items-center gap-3">
                <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
                  <button type="button" onClick={() => setCalculateGwNumber((v) => String(Math.max(1, (parseInt(v, 10) || 1) - 1)))} className="px-3 py-2 text-gray-600 hover:bg-gray-100 text-sm font-medium">−</button>
                  <span className="w-10 text-center text-sm font-semibold text-gray-900">{calculateGwNumber || "—"}</span>
                  <button type="button" onClick={() => setCalculateGwNumber((v) => String(Math.min(30, (parseInt(v, 10) || 0) + 1)))} className="px-3 py-2 text-gray-600 hover:bg-gray-100 text-sm font-medium">+</button>
                </div>
                <button onClick={calculateGameweek} disabled={calculating || !calculateGwNumber} className="px-4 py-2 rounded-full text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40">
                  {calculating ? "Saving…" : "Save snapshots"}
                </button>
              </div>
              {calculateMessage && <p className="text-sm text-gray-600">{calculateMessage}</p>}
            </div>
          )}
        </div>

        {/* Seed players */}
        <div>
          <button
            onClick={() => toggleSection("seed")}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Seed players
            <span className="text-gray-400 text-xs">{openSection === "seed" ? "▲" : "▼"}</span>
          </button>
          {openSection === "seed" && (
            <div className="px-4 pb-4 pt-1 space-y-3">
              <p className="text-xs text-gray-500">One-time import of all players from the sheet into the database. Safe to re-run — existing players and their prices are never overwritten, only new players are added.</p>
              <button onClick={seedPlayers} disabled={seeding} className="px-4 py-2 rounded-full text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40">
                {seeding ? "Seeding…" : "Seed players from sheet"}
              </button>
              {seedMessage && <p className="text-sm text-gray-600">{seedMessage}</p>}
            </div>
          )}
        </div>

        {/* Vote poll */}
        <div>
          <button
            onClick={() => toggleSection("vote")}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Vote poll
            <span className="text-gray-400 text-xs">{openSection === "vote" ? "▲" : "▼"}</span>
          </button>
          {openSection === "vote" && (
            <div className="px-4 pb-4 pt-1 space-y-4">
              <p className="text-xs text-gray-500">Set when the player vote poll closes. A banner appears for all users until the deadline passes or they vote.</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Date</label>
                  <input type="date" value={voteDateValue} onChange={(e) => setVoteDateValue(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Time</label>
                  <input type="time" value={voteTimeValue} onChange={(e) => setVoteTimeValue(e.target.value)} className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900" />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                <button onClick={saveVoteDeadline} disabled={voteSaving} className="px-4 py-2 rounded-full text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40">
                  {voteSaving ? "Saving…" : "Save vote deadline"}
                </button>
                <button onClick={clearVoteDeadline} disabled={voteSaving} className="px-4 py-2 rounded-full text-sm font-medium border border-gray-300 text-gray-700 hover:bg-gray-50 disabled:opacity-40">
                  Clear deadline
                </button>
              </div>
              <div className="rounded-lg border border-amber-100 p-3 bg-amber-50 text-sm text-gray-700 space-y-1">
                <p>Current vote deadline: <span className="font-semibold">{voteDeadlineAt ? new Date(voteDeadlineAt).toLocaleString() : "Not set"}</span></p>
                <p>Poll status: <span className={`font-semibold ${voteDeadlineAt && new Date(voteDeadlineAt).getTime() > Date.now() ? "text-green-600" : "text-gray-500"}`}>{voteDeadlineAt && new Date(voteDeadlineAt).getTime() > Date.now() ? "Open" : "Closed"}</span></p>
                {voteMessage && <p className="text-gray-600">{voteMessage}</p>}
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Vote results</p>
                <p className="text-xs text-gray-500">Weighted score: 3 pts for 1st pick, 2 pts for 2nd, 1 pt for 3rd.</p>
                <div className="flex flex-wrap items-center gap-3">
                  <div className="flex items-center border border-gray-300 rounded-md overflow-hidden">
                    <button type="button" onClick={() => setVoteResultsGw((v) => String(Math.max(1, (parseInt(v, 10) || 1) - 1)))} className="px-3 py-2 text-gray-600 hover:bg-gray-100 text-sm font-medium">−</button>
                    <span className="w-10 text-center text-sm font-semibold text-gray-900">{voteResultsGw || "—"}</span>
                    <button type="button" onClick={() => setVoteResultsGw((v) => String(Math.min(30, (parseInt(v, 10) || 0) + 1)))} className="px-3 py-2 text-gray-600 hover:bg-gray-100 text-sm font-medium">+</button>
                  </div>
                  <button onClick={loadVoteResults} disabled={voteResultsLoading || !voteResultsGw} className="px-4 py-2 rounded-full text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40">
                    {voteResultsLoading ? "Loading…" : "Load results"}
                  </button>
                  <button onClick={finalizeVotes} disabled={finalizing || !voteResultsGw} className="px-4 py-2 rounded-full text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-40">
                    {finalizing ? "Saving…" : "Save votes"}
                  </button>
                </div>
                {finalizeMessage && <p className="text-sm text-gray-600">{finalizeMessage}</p>}
                {voteResults !== null && (
                  voteResults.length === 0 ? (
                    <p className="text-sm text-gray-400">No votes for GW {voteResultsGw}.</p>
                  ) : (
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                          <th className="pb-1 font-semibold">#</th>
                          <th className="pb-1 font-semibold">Player</th>
                          <th className="pb-1 font-semibold text-right">Score</th>
                          <th className="pb-1 font-semibold text-right">Votes</th>
                        </tr>
                      </thead>
                      <tbody>
                        {voteResults.map((r, i) => (
                          <tr key={r.player} className="border-b border-gray-50">
                            <td className="py-1.5 text-gray-400 w-6">{i + 1}</td>
                            <td className="py-1.5 font-medium text-gray-900">{r.player}</td>
                            <td className="py-1.5 text-right font-semibold text-gray-800">{r.score}</td>
                            <td className="py-1.5 text-right text-gray-500">{r.votes}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )
                )}
              </div>
            </div>
          )}
        </div>

        {/* Reset password */}
        <div>
          <button
            onClick={() => { toggleSection("resetpw"); loadCredUsers(); }}
            className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Reset user password
            <span className="text-gray-400 text-xs">{openSection === "resetpw" ? "▲" : "▼"}</span>
          </button>
          {openSection === "resetpw" && (
            <div className="px-4 pb-4 pt-1 space-y-3">
              <p className="text-xs text-gray-500">Reset the password for a credentials-based user (non-Google login).</p>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">User</label>
                <select
                  value={resetUsername}
                  onChange={(e) => { setResetUsername(e.target.value); setResetMessage(null); }}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                >
                  <option value="">— Select user —</option>
                  {(credUsers ?? []).map((u) => (
                    <option key={u} value={u}>{u}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">New password</label>
                <input
                  type="text"
                  value={resetPassword}
                  onChange={(e) => setResetPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm text-gray-900"
                />
              </div>
              <button
                onClick={submitResetPassword}
                disabled={resetting || !resetUsername || resetPassword.length < 6}
                className="px-4 py-2 rounded-full text-sm font-medium bg-gray-900 text-white hover:bg-gray-700 disabled:opacity-40"
              >
                {resetting ? "Saving…" : "Reset password"}
              </button>
              {resetMessage && <p className="text-sm text-gray-600">{resetMessage}</p>}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
