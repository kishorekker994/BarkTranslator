"use client";

import { useRef, useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { BarkMetrics } from "@/hooks/useAudioAnalyzer";

export interface Translation {
  id: string;
  text: string;
  metrics: BarkMetrics;
  timestamp: Date;
  mood: string;        // backward-compat (same as vocalType)
  vocalType: string;
  trainerTip?: string;
  confidence?: number;
}

interface TranslationFeedProps {
  translations: Translation[];
  isProcessing: boolean;
  dogName: string;
  onClear: () => void;
}

// ─── Vocal-type metadata ──────────────────────────────────────────────────────
const VOCAL_META: Record<
  string,
  { emoji: string; label: string; color: string; bg: string }
> = {
  bay:      { emoji: "🔭", label: "Baying",   color: "#f4a261", bg: "rgba(244,162,97,0.12)" },
  alert:    { emoji: "🚨", label: "Alert",    color: "#ef4444", bg: "rgba(239,68,68,0.10)" },
  startled: { emoji: "😮", label: "Startled", color: "#fbbf24", bg: "rgba(251,191,36,0.10)" },
  warning:  { emoji: "😤", label: "Warning",  color: "#f97316", bg: "rgba(249,115,22,0.10)" },
  lonely:   { emoji: "🥺", label: "Lonely",   color: "#818cf8", bg: "rgba(129,140,248,0.10)" },
  happy:    { emoji: "🥰", label: "Happy",    color: "#34d399", bg: "rgba(52,211,153,0.10)" },
  excited:  { emoji: "🐾", label: "Excited",  color: "#f472b6", bg: "rgba(244,114,182,0.10)" },
  curious:  { emoji: "🐕", label: "Curious",  color: "#9ecedd", bg: "rgba(158,206,221,0.10)" },
};

function getVocalMeta(type: string) {
  return VOCAL_META[type?.toLowerCase()] ?? VOCAL_META.curious;
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

function ConfidenceBar({ value }: { value: number }) {
  const pct = Math.min(100, Math.max(0, value));
  const color =
    pct >= 80 ? "#34d399" : pct >= 65 ? "#fbbf24" : "#f97316";
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-1 bg-surface-highest rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        />
      </div>
      <span className="text-[9px] font-medium" style={{ color }}>
        {pct}%
      </span>
    </div>
  );
}

export default function TranslationFeed({
  translations,
  isProcessing,
  dogName,
  onClear,
}: TranslationFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);
  const [expandedTip, setExpandedTip] = useState<string | null>(null);

  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTo({
        top: feedRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [translations, isProcessing]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Section label + clear */}
      <div className="px-5 py-2 flex items-center gap-2">
        <div className="w-4 h-0.5 bg-outline-variant/40 rounded-full" />
        <span className="text-xs text-on-surface-variant/60 font-medium uppercase tracking-wider font-[family-name:var(--font-inter)]">
          Translation Feed
        </span>
        <div className="flex-1 h-0.5 bg-outline-variant/20 rounded-full" />
        {translations.length > 0 && (
          <button
            onClick={onClear}
            className="text-[10px] text-on-surface-variant/40 hover:text-error/70 transition-colors font-[family-name:var(--font-inter)] cursor-pointer"
          >
            Clear
          </button>
        )}
      </div>

      {/* Feed container */}
      <div ref={feedRef} className="flex-1 overflow-y-auto px-5 pb-6 space-y-5">
        {translations.length === 0 && !isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-12 text-center gap-3"
          >
            <div
              className="text-5xl"
              style={{ animation: "float 3s ease-in-out infinite" }}
            >
              🐕
            </div>
            <p className="text-on-surface-variant/60 text-sm font-[family-name:var(--font-inter)]">
              Tap the microphone to start
            </p>
            <p className="text-on-surface-variant/40 text-xs font-[family-name:var(--font-inter)]">
              {dogName}&apos;s translations will appear here
            </p>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {translations.map((t) => {
            const meta = getVocalMeta(t.vocalType);
            const isExpanded = expandedTip === t.id;
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, y: 24, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 280, damping: 24 }}
                className="flex gap-3"
              >
                {/* Avatar */}
                <div className="flex-shrink-0 mt-1">
                  <div
                    className="w-9 h-9 rounded-full flex items-center justify-center text-base shadow-md"
                    style={{ background: meta.bg, border: `1.5px solid ${meta.color}30` }}
                  >
                    {meta.emoji}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 space-y-2 min-w-0">
                  {/* Vocal type badge */}
                  <div className="flex items-center gap-2">
                    <span
                      className="text-[10px] font-semibold uppercase tracking-widest px-2 py-0.5 rounded-full font-[family-name:var(--font-inter)]"
                      style={{
                        color: meta.color,
                        background: meta.bg,
                        border: `1px solid ${meta.color}30`,
                      }}
                    >
                      {meta.label}
                    </span>
                    <span className="text-[10px] text-on-surface-variant/40 font-[family-name:var(--font-inter)]">
                      {formatTime(t.timestamp)}
                    </span>
                  </div>

                  {/* Translation bubble */}
                  <div
                    className="rounded-3xl rounded-tl-lg p-4 shadow-[0_2px_20px_rgba(0,0,0,0.3)] border border-outline-variant/10"
                    style={{ background: `rgba(46,41,38,0.9)` }}
                  >
                    <p className="text-foreground text-sm leading-relaxed font-[family-name:var(--font-outfit)]">
                      {t.text}
                    </p>
                  </div>

                  {/* Confidence */}
                  {t.confidence !== undefined && (
                    <div className="px-1">
                      <div className="flex items-center gap-1.5 mb-1">
                        <span className="text-[9px] text-on-surface-variant/40 font-[family-name:var(--font-inter)] uppercase tracking-wider">
                          Confidence
                        </span>
                      </div>
                      <ConfidenceBar value={t.confidence} />
                    </div>
                  )}

                  {/* Metrics pills */}
                  <div className="flex flex-wrap gap-1.5 px-1">
                    <span className="metric-pill">🎵 {t.metrics.pitchLabel} pitch · {t.metrics.pitch}Hz</span>
                    <span className="metric-pill">🔊 {t.metrics.volumeLabel} · {t.metrics.volume}dB</span>
                    <span className="metric-pill">🐾 {t.metrics.barkCount} bark{t.metrics.barkCount !== 1 ? "s" : ""}</span>
                    <span className="metric-pill">⏱ {formatDuration(t.metrics.recordingDuration)}</span>
                    <span className="metric-pill">{t.metrics.cadence}</span>
                  </div>

                  {/* Trainer Tip */}
                  {t.trainerTip && (
                    <motion.div
                      layout
                      className="rounded-2xl border border-outline-variant/20 overflow-hidden"
                      style={{ background: "rgba(30,27,24,0.8)" }}
                    >
                      <button
                        onClick={() => setExpandedTip(isExpanded ? null : t.id)}
                        className="w-full px-3 py-2 flex items-center gap-2 text-left cursor-pointer"
                      >
                        <span className="text-sm">🎓</span>
                        <span className="text-[11px] font-semibold text-on-surface-variant/70 font-[family-name:var(--font-inter)] flex-1">
                          Trainer Tip
                        </span>
                        <motion.span
                          animate={{ rotate: isExpanded ? 180 : 0 }}
                          className="text-on-surface-variant/40 text-xs"
                        >
                          ▾
                        </motion.span>
                      </button>
                      <AnimatePresence>
                        {isExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.25 }}
                            className="overflow-hidden"
                          >
                            <p className="px-3 pb-3 text-xs text-on-surface-variant/80 leading-relaxed font-[family-name:var(--font-inter)]">
                              {t.trainerTip}
                            </p>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </motion.div>
                  )}
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {/* Processing indicator */}
        <AnimatePresence>
          {isProcessing && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="flex gap-3"
            >
              <div className="flex-shrink-0 mt-1">
                <div className="w-9 h-9 rounded-full bg-primary-container/30 flex items-center justify-center text-base">
                  🐾
                </div>
              </div>
              <div className="bg-surface-container-high rounded-3xl rounded-tl-lg p-4 shadow-[0_2px_20px_rgba(0,0,0,0.3)]">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    {[0, 0.15, 0.3].map((delay, i) => (
                      <motion.div
                        key={i}
                        className="w-2 h-2 rounded-full bg-primary"
                        style={{ opacity: 1 - i * 0.3 }}
                        animate={{ y: [0, -6, 0] }}
                        transition={{ duration: 0.6, repeat: Infinity, delay }}
                      />
                    ))}
                  </div>
                  <span className="text-xs text-on-surface-variant/60 font-[family-name:var(--font-inter)]">
                    {dogName} is thinking...
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
