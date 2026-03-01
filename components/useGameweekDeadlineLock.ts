"use client";

import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

interface DeadlineRow {
  id: number;
  deadline_at: string | null;
}

export function useGameweekDeadlineLock() {
  const [loaded, setLoaded] = useState(false);
  const [deadlineAt, setDeadlineAt] = useState<string | null>(null);
  const [isLocked, setIsLocked] = useState(false);

  const refresh = useCallback(async () => {
    const { data: deadlineRow } = await supabase
      .from("gameweek_deadline")
      .select("id, deadline_at")
      .eq("id", 1)
      .maybeSingle<DeadlineRow>();

    const deadline = deadlineRow?.deadline_at ?? null;

    const deadlinePassed = deadline ? new Date(deadline).getTime() <= Date.now() : false;
    const locked = Boolean(deadlinePassed);

    setDeadlineAt(deadline);
    setIsLocked(locked);
    setLoaded(true);
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return {
    loaded,
    isLocked,
    deadlineAt,
    refresh,
  };
}
