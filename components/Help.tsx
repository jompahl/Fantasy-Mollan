"use client";

const RULES = [
  "For playing up to 45 minutes = 1 point",
  "For playing 45 minutes or more = 1 point",
  "For each goal scored by a defender = 6 points",
  "For each goal scored by a midfielder = 5 points",
  "For each goal scored by a forward = 4 points",
  "For each assist = 3 points",
  "For 0 goals conceded by a defender = 4 points",
  "For 0 goals conceded by a midfielder = 1 point",
  "For each penalty miss = -2 points",
  "Man of the match = 3 points",
  "For every 2 goals conceded by a defender = -1 point",
  "For each yellow card = -1 point",
  "For each red card = -3 points",
  "For each own goal = -2 points",
];

export default function Help() {
  return (
    <div className="w-full max-w-2xl">
      <h2 className="text-xl font-semibold text-gray-900 mb-3">Points Rules</h2>
      <ul className="space-y-2">
        {RULES.map((rule) => (
          <li key={rule} className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            {rule}
          </li>
        ))}
      </ul>
    </div>
  );
}
