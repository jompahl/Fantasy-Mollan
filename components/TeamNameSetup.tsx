"use client";
import { useState } from "react";
import Image from "next/image";

interface Props {
  onSubmit: (name: string) => void;
}

export default function TeamNameSetup({ onSubmit }: Props) {
  const [name, setName] = useState("");
  const [error, setError] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) {
      setError("Please enter a team name.");
      return;
    }
    if (trimmed.length > 30) {
      setError("Team name must be 30 characters or fewer.");
      return;
    }
    onSubmit(trimmed);
  }

  return (
    <main className="min-h-screen bg-white flex flex-col items-center justify-center px-6">
      <div className="w-16 h-16 relative mb-8">
        <Image
          src="/fc-mollan-logo.svg"
          alt="FC Möllan"
          fill
          className="object-contain"
          priority
        />
      </div>

      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        Welcome to Fantasy Möllan
      </h1>
      <p className="text-gray-500 mb-8">Choose a name for your team to get started.</p>

      <form onSubmit={handleSubmit} className="w-full max-w-sm flex flex-col gap-4">
        <input
          autoFocus
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            setError("");
          }}
          placeholder="Team name"
          maxLength={30}
          className="w-full px-5 py-3 border border-gray-300 rounded-full text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent"
        />
        {error && <p className="text-sm text-red-500 px-1">{error}</p>}
        <button
          type="submit"
          className="w-full px-6 py-3 bg-gray-900 text-white font-medium rounded-full hover:bg-gray-700 transition-colors"
        >
          Start playing
        </button>
      </form>
    </main>
  );
}
