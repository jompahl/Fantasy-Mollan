"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface VotePollState {
  pollOpen: boolean;
  gwNumber: number | null;
  hasVoted: boolean;
  voteDeadlineAt: string | null;
  loaded: boolean;
  refresh: () => Promise<void>;
}

export function useVotePoll(userEmail: string | null): VotePollState {
  const [loaded, setLoaded] = useState(false);
  const [voteDeadlineAt, setVoteDeadlineAt] = useState<string | null>(null);
  const [gwNumber, setGwNumber] = useState<number | null>(null);
  const [hasVoted, setHasVoted] = useState(false);

  const refresh = useCallback(async () => {
    if (!userEmail) {
      setLoaded(true);
      return;
    }

    // Get vote deadline and global latest GW in parallel
    const [{ data: deadlineRow }, { data: snapshotRow }] = await Promise.all([
      supabase
        .from("gameweek_deadline")
        .select("vote_deadline_at")
        .eq("id", 1)
        .maybeSingle<{ vote_deadline_at: string | null }>(),
      // Global latest GW — no user_email filter so new users can still vote
      supabase
        .from("gameweek_snapshots")
        .select("gameweek_number")
        .order("gameweek_number", { ascending: false })
        .limit(1)
        .maybeSingle<{ gameweek_number: number }>(),
    ]);

    const deadline = deadlineRow?.vote_deadline_at ?? null;
    const latestGw = snapshotRow?.gameweek_number ?? null;

    setVoteDeadlineAt(deadline);
    setGwNumber(latestGw);

    if (latestGw !== null) {
      const { data: vote } = await supabase
        .from("gw_votes")
        .select("id")
        .eq("user_email", userEmail)
        .eq("gameweek_number", latestGw)
        .maybeSingle<{ id: string }>();
      setHasVoted(vote !== null);
    } else {
      setHasVoted(false);
    }

    setLoaded(true);
  }, [userEmail]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const deadlinePassed = voteDeadlineAt
    ? new Date(voteDeadlineAt).getTime() <= Date.now()
    : true;

  const pollOpen =
    voteDeadlineAt !== null &&
    !deadlinePassed &&
    !hasVoted &&
    gwNumber !== null;

  return { pollOpen, gwNumber, hasVoted, voteDeadlineAt, loaded, refresh };
}
