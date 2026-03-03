"use client";

import { useId } from "react";
import type { ReactNode } from "react";

const SHIELD_PATH = "M10 5 L90 5 L90 62 C90 88 62 106 50 112 C38 106 10 88 10 62 Z";

export const PRESET_EMBLEM_IDS = [
  "plain",
  "per-fess",
  "per-pale",
  "quarters",
  "chevron",
  "fess",
  "pale",
  "cross",
  "star",
  "saltire",
  "per-bend",
  "roundel",
] as const;

export type PresetEmblemId = (typeof PRESET_EMBLEM_IDS)[number];

function renderFill(id: PresetEmblemId): ReactNode {
  switch (id) {
    case "plain":
      return null;
    case "per-fess":
      return <rect x="0" y="0" width="100" height="58" fill="#111827" />;
    case "per-pale":
      return <rect x="0" y="0" width="50" height="116" fill="#111827" />;
    case "quarters":
      return (
        <>
          <rect x="0" y="0" width="50" height="58" fill="#111827" />
          <rect x="50" y="58" width="50" height="58" fill="#111827" />
        </>
      );
    case "chevron":
      return <path d="M18 80 L50 36 L82 80 L72 80 L50 50 L28 80 Z" fill="#111827" />;
    case "fess":
      return <rect x="0" y="46" width="100" height="22" fill="#111827" />;
    case "pale":
      return <rect x="43" y="0" width="14" height="116" fill="#111827" />;
    case "cross":
      return (
        <>
          <rect x="43" y="0" width="14" height="116" fill="#111827" />
          <rect x="0" y="46" width="100" height="22" fill="#111827" />
        </>
      );
    case "star":
      return (
        <polygon
          points="50,33 55.3,47.7 70.9,48.2 58.6,57.8 62.9,72.8 50,64 37.1,72.8 41.4,57.8 29.1,48.2 44.7,47.7"
          fill="#111827"
        />
      );
    case "saltire":
      return (
        <>
          <line x1="10" y1="5" x2="90" y2="112" stroke="#111827" strokeWidth="14" />
          <line x1="90" y1="5" x2="10" y2="112" stroke="#111827" strokeWidth="14" />
        </>
      );
    case "per-bend":
      return <polygon points="0,0 100,0 100,200" fill="#111827" />;
    case "roundel":
      return <circle cx="50" cy="55" r="22" fill="#111827" />;
  }
}

export function PresetEmblemSvg({ id, className = "w-full h-auto" }: { id: PresetEmblemId; className?: string }) {
  const uid = useId();
  const cid = `sc${uid.replace(/[^a-z0-9]/gi, "")}`;
  return (
    <svg viewBox="0 0 100 116" fill="none" className={className}>
      <defs>
        <clipPath id={cid}>
          <path d={SHIELD_PATH} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${cid})`}>
        {renderFill(id)}
      </g>
      <path d={SHIELD_PATH} stroke="#111827" strokeWidth="4" strokeLinejoin="round" />
    </svg>
  );
}

export function EmblemDisplay({ emblem, className = "w-6 h-auto" }: { emblem: string | null | undefined; className?: string }) {
  if (emblem?.startsWith("preset:")) {
    return <PresetEmblemSvg id={emblem.slice(7) as PresetEmblemId} className={className} />;
  }
  if (emblem) {
    return <img src={emblem} alt="" className={`${className} object-contain`} />;
  }
  return null;
}

export interface TeamImage {
  name: string;
  imageUrl: string;
}

interface EmblemPickerProps {
  current: string | null;
  teamImages: TeamImage[];
  onSelect: (value: string) => void;
  onClose: () => void;
}

export default function EmblemPicker({ current, teamImages, onSelect, onClose }: EmblemPickerProps) {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl w-full max-w-sm max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-gray-200 flex items-center justify-between flex-shrink-0">
          <h3 className="text-base font-semibold text-gray-900">Choose emblem</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-xl leading-none"
          >
            ×
          </button>
        </div>

        <div className="overflow-y-auto p-4 space-y-5">
          {/* Preset shields */}
          <div>
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Shields</p>
            <div className="grid grid-cols-4 gap-3">
              {PRESET_EMBLEM_IDS.map((id) => (
                <button
                  key={id}
                  onClick={() => { onSelect(`preset:${id}`); onClose(); }}
                  className={`p-2 rounded-lg transition-colors ${
                    current === `preset:${id}` ? "ring-2 ring-gray-900 bg-gray-100" : "hover:bg-gray-100"
                  }`}
                >
                  <PresetEmblemSvg id={id} />
                </button>
              ))}
            </div>
          </div>

          {/* Team logos from sheet */}
          {teamImages.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Team logos</p>
              <div className="grid grid-cols-4 gap-3">
                {teamImages.map((team) => (
                  <button
                    key={team.imageUrl}
                    onClick={() => { onSelect(team.imageUrl); onClose(); }}
                    className={`p-2 rounded-lg transition-colors flex flex-col items-center gap-1 ${
                      current === team.imageUrl ? "ring-2 ring-gray-900 bg-gray-100" : "hover:bg-gray-100"
                    }`}
                  >
                    <img src={team.imageUrl} alt={team.name} className="w-10 h-10 object-contain" />
                    <span className="text-xs text-gray-500 leading-tight text-center line-clamp-1">{team.name}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
