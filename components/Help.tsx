"use client";

const RULES = [
  "For playing up to 45 minutes = 1 point",
  "For playing 45 minutes or more = 2 points",
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

      <h2 className="text-xl font-semibold text-gray-900 mt-8 mb-3">Chips</h2>
      <ul className="space-y-2 mb-8">
        {[
          "Triple Captain can be played once a season. If played, the captain's multiplier will be 3× instead of the usual 2×.",
          "Defensive Boost chip will give you 2× points for your defensive line.",
          "Midfield Boost chip will give you 2× points for your midfield line.",
          "Forward Boost chip will give you 2× points for your forward line.",
        ].map((rule) => (
          <li key={rule} className="text-sm text-gray-700 bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
            {rule}
          </li>
        ))}
      </ul>

      <h2 className="text-xl font-semibold text-gray-900 mb-3">Transfer Rules</h2>
      <div className="space-y-3 text-sm text-gray-700">
        <p className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          After selecting your squad you can buy and sell players in the transfer market. Unlimited transfers can be made at no cost until your first deadline.
        </p>
        <p className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          After your first deadline you will receive 1 free transfer each Gameweek. Each additional transfer you make in the same Gameweek will deduct 4 points from your total score.
        </p>
        <p className="bg-gray-50 border border-gray-200 rounded-lg px-3 py-2">
          If you do not use your free transfer, you are able to make an additional free transfer the following Gameweek. If you do not use this saved free transfer in the following Gameweek, it will be carried over until you do. The maximum number of free transfers you can store in any gameweek is 5.
        </p>
      </div>
    </div>
  );
}
