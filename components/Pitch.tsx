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

interface Props {
  onSlotClick: (index: number) => void;
  slotPlayers?: (string | null)[];
}

export default function Pitch({ onSlotClick, slotPlayers = [] }: Props) {
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
          return (
            <button
              key={i}
              onClick={() => onSlotClick(i)}
              className="absolute flex flex-col items-center gap-1 hover:opacity-80 transition-opacity"
              style={{ left: slot.x, top: slot.y, transform: "translate(-50%, -50%)" }}
            >
              <div className={`w-14 h-14 rounded-xl flex items-center justify-center ${filled ? "bg-white/20 border border-white/40" : "bg-white/10 border border-dashed border-white/30"}`}>
                <JerseyIcon filled={filled} />
              </div>
              <div className="bg-black/30 rounded px-2 py-0.5 max-w-[72px]">
                <span className="text-white text-xs font-semibold tracking-wide truncate block text-center" style={{ opacity: filled ? 1 : 0.5 }}>
                  {filled ? playerName!.split(" ").pop() : slot.label}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
