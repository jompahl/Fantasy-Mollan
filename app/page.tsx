"use client";

import { useSession, signOut } from "next-auth/react";
import Image from "next/image";
import { useState } from "react";
import { useTeamName } from "@/components/useTeamName";
import TeamNameSetup from "@/components/TeamNameSetup";
import Transfers from "@/components/Transfers";
import Points from "@/components/Points";
import League from "@/components/League";
import SignInForm from "@/components/SignInForm";
import Games from "@/components/Games";
import Help from "@/components/Help";

const TABS = ["Points", "Transfers", "League", "Games", "Help"] as const;
type Tab = (typeof TABS)[number];

export default function Home() {
  const { data: session, status } = useSession();
  const [activeTab, setActiveTab] = useState<Tab>("Points");
  const [menuOpen, setMenuOpen] = useState(false);
  const { teamName, saveTeamName } = useTeamName(session?.user?.email);

  if (status === "loading") {
    return <main className="min-h-screen bg-white" />;
  }

  if (session) {
    const userEmail = session.user?.email;
    if (!userEmail) {
      return <main className="min-h-screen bg-white" />;
    }

    if (teamName === null) {
      return <main className="min-h-screen bg-white" />;
    }

    if (teamName === "") {
      return <TeamNameSetup onSubmit={saveTeamName} />;
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
            {TABS.map((tab) => (
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
            {TABS.map((tab) => (
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
          {activeTab === "Points" && (
            <>
              <h2 className="text-2xl font-semibold text-gray-900 mb-4">{teamName}</h2>
              <Points userEmail={userEmail} />
            </>
          )}
          {activeTab === "Transfers" && <Transfers userEmail={userEmail} />}
          {activeTab === "League" && <League />}
          {activeTab === "Games" && <Games />}
          {activeTab === "Help" && <Help />}
        </main>
      </div>
    );
  }

  return <SignInForm />;
}
