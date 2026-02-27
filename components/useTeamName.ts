"use client";
import { useState, useEffect } from "react";

function storageKey(userId: string) {
  return `fantasy_team_name_${userId}`;
}

export function useTeamName(userId: string | null | undefined) {
  const [teamName, setTeamNameState] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const stored = localStorage.getItem(storageKey(userId));
    setTeamNameState(stored ?? "");
  }, [userId]);

  function saveTeamName(name: string) {
    if (!userId) return;
    localStorage.setItem(storageKey(userId), name);
    setTeamNameState(name);
  }

  return { teamName, saveTeamName };
}
