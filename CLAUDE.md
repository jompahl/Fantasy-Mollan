# Fantasy Möllan

A Fantasy Premier League-style app for FC Möllan, built with Next.js, Supabase, and Tailwind CSS.

## Tech Stack

- **Framework**: Next.js 16 (App Router)
- **Auth**: NextAuth v4 (Google OAuth)
- **Database**: Supabase (PostgreSQL)
- **Styling**: Tailwind CSS
- **Language**: TypeScript

## Dev Commands

```bash
npm run dev    # start dev server
npm run build  # production build
npm run lint   # lint
```

## Project Structure

```
app/
  page.tsx                        # Main app shell, tab navigation, auth gate
  api/
    gameweek/route.ts             # Parses Google Sheet CSV → gameweek data + point calculations
    players/route.ts              # Returns players from Supabase (name, position, current_price)
    teams/route.ts                # Returns team badge images
    admin/
      calculate-gameweek/route.ts # Snapshots teams, resets chips, updates player prices
      seed-players/route.ts       # One-time import of players from sheet into DB
components/
  Pitch.tsx                       # 5-a-side pitch UI (slots: 1 FWD, 2 MID, 2 DEF)
  Transfers.tsx                   # Team selection + transfers page
  Points.tsx                      # Gameweek points breakdown per user
  League.tsx                      # League standings + best GW table
  Stats.tsx                       # Dream team + detailed player stats
  MyTeam.tsx                      # View team, set captain, play chips
  GameweekAdministration.tsx      # Admin: set deadline, save snapshots, seed players
  Games.tsx                       # Match schedule
  Help.tsx                        # Rules / help text
  PlayerHistory.tsx               # Per-player points history across GWs
  EmblemPicker.tsx                # Team badge picker
  SignInForm.tsx                  # Google sign-in screen
  TeamNameSetup.tsx               # First-time team name setup
  useTeamName.ts                  # Hook: team name stored in Supabase user_teams
  useGameweekDeadlineLock.ts      # Hook: checks if transfers are locked
lib/
  supabase.ts                     # Supabase client
```

## Supabase Tables

| Table | Key columns |
|---|---|
| `user_teams` | `user_email`, `team_name`, `transfers`, `points_deducted`, `joined_gameweek`, `emblem` |
| `team_slots` | `user_email`, `slot_index`, `player_name`, `player_position`, `player_price`, `is_captain` |
| `gameweek_snapshots` | `user_email`, `gameweek_number`, `slot_index`, `player_name`, `is_captain`, `boost_chip` |
| `gameweek_deadline` | `id=1`, `deadline_at` |
| `players` | `name` (PK), `position`, `start_price`, `current_price`, `image`, `image_rotation` |

## Key Concepts

- **Budget**: starts at £50m, tracked via `team_slots.player_price` (purchase price). Budget = 50 - sum of purchase prices.
- **Pitch slots**: index 0 = FWD, 1–2 = MID, 3–4 = DEF. GKs are treated as DEF in fantasy rules.
- **Points**: calculated in `app/api/gameweek/route.ts` from Google Sheet CSV data.
- **Gameweek flow**: Admin sets deadline → transfers lock → match played → admin runs "Save snapshots" → points calculated, player prices updated (±0.1 based on net transfers).
- **Player prices**: stored in `players.current_price`, updated each GW in `calculate-gameweek`. Safe to re-seed (only adds new players, never overwrites prices).
- **Chips**: Triple Captain (3×), DEF Boost, MID Boost, FWD Boost — one per season, one per GW.
- **Admin email**: `johndahlberg14@gmail.com` — only this user sees the "GW admin" tab.

## Data Source

Gameweek stats are pulled from a Google Sheet (ID: `1Yn8-DvcCCHG0dkb588tGdjruPXE8h7SDi2DM-yV_ZXg`) via CSV export. Three sheets: gameweek data, players (positions), teams (badge images).
