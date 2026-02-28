export const SLOTS = [
  { label: "FWD", x: "50%", y: "20%" },
  { label: "MID", x: "27%", y: "46%" },
  { label: "MID", x: "73%", y: "46%" },
  { label: "DEF", x: "27%", y: "72%" },
  { label: "DEF", x: "73%", y: "72%" },
];

function JerseyIcon({ filled }: { filled: boolean }) {
  return (
    <svg viewBox="0 0 50 54" fill="currentColor" className="w-9 h-9" style={{ color: filled ? "#dc2626" : "rgba(255,255,255,0.25)" }}>
      <path d="M17 3C15 1 9 0 7 3L0 11L6 17L12 12L12 52L38 52L38 12L44 17L50 11L43 3C41 0 35 1 33 3C31 7 27 9 25 9C23 9 19 7 17 3Z" />
    </svg>
  );
}

function BootIcon() {
  return (
    <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
      <path d="M2 15.5V18h20v-2.5c-4.6 0-7-1.4-8.8-3.2l-1.4-1.5-2 2.1C8.1 14.6 5.9 15.5 2 15.5Z" fill="#111827" />
      <rect x="4" y="18.5" width="2.1" height="1.6" rx="0.4" fill="#111827" />
      <rect x="8" y="18.5" width="2.1" height="1.6" rx="0.4" fill="#111827" />
      <rect x="12" y="18.5" width="2.1" height="1.6" rx="0.4" fill="#111827" />
      <path d="M14.2 8.8c.9 1.3 2.3 2.6 4.7 3.1" stroke="#374151" strokeWidth="1.2" strokeLinecap="round" />
    </svg>
  );
}

interface Props {
  onSlotClick?: (index: number) => void;
  slotPlayers?: (string | null)[];
  slotPoints?: (number | null)[];
  slotPrices?: (number | null)[];
  slotGoals?: (number | null)[];
  slotAssists?: (number | null)[];
  slotCaptains?: (boolean | null)[];
}

export default function Pitch({
  onSlotClick,
  slotPlayers = [],
  slotPoints = [],
  slotPrices = [],
  slotGoals = [],
  slotAssists = [],
  slotCaptains = [],
}: Props) {
  return (
    <div>
      <div
        className="relative w-full overflow-hidden rounded-2xl"
        style={{
          height: 420,
          background:
            "repeating-linear-gradient(180deg,#2b7a47 0px,#2b7a47 30px,#32904f 30px,#32904f 60px)",
        }}
      >
        {/* Field markings */}
        <svg
          className="absolute inset-0 w-full h-full"
          viewBox="0 0 400 460"
          preserveAspectRatio="none"
        >
          <rect x="16" y="10" width="368" height="440" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
          <line x1="16" y1="230" x2="384" y2="230" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
          <circle cx="200" cy="230" r="50" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
          <circle cx="200" cy="230" r="3" fill="white" fillOpacity="0.35" />
          <rect x="112" y="10" width="176" height="88" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
          <rect x="150" y="10" width="100" height="32" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
          <rect x="112" y="362" width="176" height="88" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
          <rect x="150" y="418" width="100" height="32" fill="none" stroke="white" strokeWidth="1.5" strokeOpacity="0.3" />
        </svg>

        {/* Position slots */}
        {SLOTS.map((slot, i) => {
          const playerName = slotPlayers[i] ?? null;
          const filled = playerName !== null;
          const points = slotPoints[i] ?? null;
          const price = slotPrices[i] ?? null;
          const goals = slotGoals[i] ?? 0;
          const assists = slotAssists[i] ?? 0;
          const isCaptain = slotCaptains[i] ?? false;
          return (
            <button
              key={i}
              onClick={() => onSlotClick?.(i)}
              disabled={!onSlotClick}
              className="absolute flex flex-col items-center gap-1 transition-opacity disabled:cursor-default enabled:hover:opacity-80"
              style={{ left: slot.x, top: slot.y, transform: "translate(-50%, -50%)" }}
            >
              <div className={`relative w-14 h-14 rounded-xl flex items-center justify-center ${filled ? "bg-white/20 border border-white/40" : "bg-white/10 border border-dashed border-white/30"}`}>
                <JerseyIcon filled={filled} />
                {filled && assists > 0 && (
                  <span className="absolute -top-1.5 -left-1.5 leading-none bg-white/90 rounded-full p-[1px] shadow-sm">
                    <BootIcon />
                  </span>
                )}
                {filled && isCaptain && (
                  <span className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 text-[10px] font-bold text-yellow-900 bg-yellow-300 rounded-full px-1 py-0.5 leading-none shadow-sm">
                    C
                  </span>
                )}
                {filled && goals > 0 && (
                  <span className="absolute -top-1.5 -right-1.5 text-sm leading-none">⚽</span>
                )}
              </div>
              <div className="bg-black/30 rounded px-2 py-0.5 max-w-[72px]">
                <span className="text-white text-xs font-semibold tracking-wide truncate block text-center" style={{ opacity: filled ? 1 : 0.5 }}>
                  {filled ? playerName : slot.label}
                </span>
                {filled && points !== null && (
                  <span className="text-yellow-300 text-xs font-bold block text-center">{points} pts</span>
                )}
                {filled && price !== null && (
                  <span className="text-white/70 text-xs block text-center">£{price.toFixed(1)}m</span>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
