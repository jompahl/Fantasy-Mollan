"use client";

import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useTeamName } from "@/components/useTeamName";
import TeamNameSetup from "@/components/TeamNameSetup";
import EmblemPicker, { EmblemDisplay, type TeamImage } from "@/components/EmblemPicker";
import { supabase } from "@/lib/supabase";
import Transfers from "@/components/Transfers";
import Points from "@/components/Points";
import League from "@/components/League";
import SignInForm from "@/components/SignInForm";
import Games from "@/components/Games";
import Help from "@/components/Help";
import MyTeam from "@/components/MyTeam";
import GameweekAdministration from "@/components/GameweekAdministration";
import Stats from "@/components/Stats";

const ADMIN_EMAIL = "johndahlberg14@gmail.com";
const ALL_TABS = ["My Team", "Points", "Transfers", "League", "Games", "Stats", "Help", "GW admin"] as const;
type Tab = (typeof ALL_TABS)[number];

export default function Home() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("My Team");
  const [menuOpen, setMenuOpen] = useState(false);
  const [pointsTotalPoints, setPointsTotalPoints] = useState<number>(0);
  const [emblemUrl, setEmblemUrl] = useState<string | null>(null);
  const [showEmblemPicker, setShowEmblemPicker] = useState(false);
  const [teamImages, setTeamImages] = useState<TeamImage[]>([]);
  const [premierLeagueImages, setPremierLeagueImages] = useState<TeamImage[]>([]);
  const { teamName, saveTeamName } = useTeamName(session?.user?.email);
  const userEmail = session?.user?.email ?? null;
  const isAdmin = userEmail === ADMIN_EMAIL;
  const visibleTabs: Tab[] = isAdmin
    ? [...ALL_TABS]
    : ALL_TABS.filter((tab) => tab !== "GW admin");

  useEffect(() => {
    if (!isAdmin && activeTab === "GW admin") {
      setActiveTab("My Team");
    }
  }, [isAdmin, activeTab]);

  useEffect(() => {
    if (!userEmail) return;
    supabase
      .from("user_teams")
      .select("emblem")
      .eq("user_email", userEmail)
      .single()
      .then(({ data }) => setEmblemUrl(data?.emblem ?? null));
  }, [userEmail]);

  useEffect(() => {
    fetch("/api/teams")
      .then((r) => r.json())
      .then((data: { teams?: TeamImage[]; premierLeague?: TeamImage[] }) => {
        setTeamImages(data.teams ?? []);
        setPremierLeagueImages(data.premierLeague ?? []);
      });
  }, []);

  if (status === "loading") {
    return <main className="min-h-screen bg-white" />;
  }

  if (session) {
    if (!userEmail) {
      return <main className="min-h-screen bg-white" />;
    }

    if (teamName === null) {
      return <main className="min-h-screen bg-white" />;
    }

    if (teamName === "") {
      return <TeamNameSetup onSubmit={(name) => { saveTeamName(name); setActiveTab("Transfers"); }} />;
    }

    return (
      <div className="min-h-screen bg-white flex flex-col">
        <nav className="border-b border-gray-200 px-6 flex items-center h-16 gap-4">
          {/* Logo */}
          <div className="w-10 h-10 relative flex-shrink-0">
            <Image
              src="/fc-mollan-logo.svg"
              alt="FC Möllan"
              fill
              className="object-contain"
              priority
            />
          </div>

          {/* Tabs — desktop */}
          <div className="hidden md:flex items-center gap-1">
            {visibleTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-2 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Sign out — desktop */}
          <button
            onClick={() => signOut()}
            className="hidden md:block ml-auto text-sm text-gray-400 hover:text-gray-600 transition-colors"
          >
            Sign out
          </button>

          {/* Hamburger — mobile */}
          <button
            onClick={() => setMenuOpen((o) => !o)}
            className="md:hidden ml-auto p-2 -mr-2 text-gray-500 hover:text-gray-700 transition-colors"
            aria-label="Menu"
          >
            {menuOpen ? (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            ) : (
              <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <line x1="3" y1="6" x2="21" y2="6" />
                <line x1="3" y1="12" x2="21" y2="12" />
                <line x1="3" y1="18" x2="21" y2="18" />
              </svg>
            )}
          </button>
        </nav>

        {/* Mobile dropdown menu */}
        {menuOpen && (
          <div className="md:hidden border-b border-gray-200 bg-white px-4 py-2">
            {visibleTabs.map((tab) => (
              <button
                key={tab}
                onClick={() => { setActiveTab(tab); setMenuOpen(false); }}
                className={`block w-full text-left px-4 py-3 text-sm font-medium rounded-md transition-colors ${
                  activeTab === tab
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-500 hover:text-gray-900 hover:bg-gray-50"
                }`}
              >
                {tab}
              </button>
            ))}
            <button
              onClick={() => signOut()}
              className="block w-full text-left px-4 py-3 text-sm text-gray-400 hover:text-gray-600 transition-colors"
            >
              Sign out
            </button>
          </div>
        )}

        <main className="flex-1 px-6 py-8">
          {activeTab === "My Team" && (
            <>
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-2xl font-semibold text-gray-900">{teamName}</h2>
                <button
                  onClick={() => setShowEmblemPicker(true)}
                  aria-label="Change team emblem"
                  className="flex-shrink-0 hover:opacity-75 transition-opacity"
                >
                  {emblemUrl ? (
                    <EmblemDisplay emblem={emblemUrl} className="w-10 h-auto" />
                  ) : (
                    <svg viewBox="0 0 100 116" className="w-10 h-auto" fill="none">
                      <path
                        d="M10 5 L90 5 L90 62 C90 88 62 106 50 112 C38 106 10 88 10 62 Z"
                        stroke="#d1d5db"
                        strokeWidth="5"
                        strokeLinejoin="round"
                      />
                      <line x1="50" y1="33" x2="50" y2="77" stroke="#d1d5db" strokeWidth="7" strokeLinecap="round" />
                      <line x1="28" y1="55" x2="72" y2="55" stroke="#d1d5db" strokeWidth="7" strokeLinecap="round" />
                    </svg>
                  )}
                </button>
              </div>
              <MyTeam userEmail={userEmail} />
            </>
          )}
          {activeTab === "Points" && (
            <>
              <div className="mb-4 flex items-center justify-between md:w-96 md:mx-auto">
                <h2 className="text-2xl font-semibold text-gray-900">{teamName}</h2>
                <span className="text-2xl font-semibold text-gray-900">{pointsTotalPoints} pts</span>
              </div>
              <Points userEmail={userEmail} onTotalPointsChange={setPointsTotalPoints} />
            </>
          )}
          {activeTab === "Transfers" && <Transfers userEmail={userEmail} onFirstSave={() => setActiveTab("My Team")} />}
          {activeTab === "League" && <League />}
          {activeTab === "Games" && <Games />}
          {activeTab === "Stats" && <Stats />}
          {activeTab === "Help" && <Help />}
          {activeTab === "GW admin" && isAdmin && <GameweekAdministration />}
        </main>

        {showEmblemPicker && (
          <EmblemPicker
            current={emblemUrl}
            teamImages={[{ name: "FC Möllan", imageUrl: "/fc-mollan-logo.svg" }, ...teamImages]}
            premierLeagueImages={premierLeagueImages}
            onSelect={(value) => {
              if (userEmail) {
                setEmblemUrl(value);
                supabase
                  .from("user_teams")
                  .update({ emblem: value })
                  .eq("user_email", userEmail)
                  .then(() => {});
              }
            }}
            onClose={() => setShowEmblemPicker(false)}
          />
        )}
      </div>
    );
  }

  return <SignInForm />;
}
