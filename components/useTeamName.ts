"use client";
import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

export function useTeamName(userId: string | null | undefined) {
  const [teamName, setTeamNameState] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    (async () => {
      const { data } = await supabase
        .from("user_teams")
        .select("team_name")
        .eq("user_email", userId)
        .single();
      setTeamNameState(data?.team_name ?? "");
    })();
  }, [userId]);

  async function saveTeamName(name: string) {
    if (!userId) return;
    await supabase
      .from("user_teams")
      .upsert({ user_email: userId, team_name: name });
    setTeamNameState(name);
  }

  return { teamName, saveTeamName };
}
