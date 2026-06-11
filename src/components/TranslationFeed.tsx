"use client";

import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { BarkMetrics } from "@/hooks/useAudioAnalyzer";

export interface Translation {
  id: string;
  text: string;
  metrics: BarkMetrics;
  timestamp: Date;
  mood: string;
}

interface TranslationFeedProps {
  translations: Translation[];
  isProcessing: boolean;
}

function getMoodEmoji(mood: string): string {
  const moodMap: Record<string, string> = {
    alert: "🚨",
    excited: "🐾",
    startled: "😮",
    warning: "😤",
    lonely: "😢",
    happy: "🥰",
    curious: "🐕",
    tracking: "🦴",
  };
  return moodMap[mood.toLowerCase()] || "🐾";
}

function formatTime(date: Date): string {
  return date.toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}

export default function TranslationFeed({
  translations,
  isProcessing,
}: TranslationFeedProps) {
  const feedRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to latest
  useEffect(() => {
    if (feedRef.current) {
      feedRef.current.scrollTo({
        top: feedRef.current.scrollHeight,
        behavior: "smooth",
      });
    }
  }, [translations]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {/* Section label */}
      <div className="px-5 py-2 flex items-center gap-2">
        <div className="w-4 h-0.5 bg-outline-variant/40 rounded-full" />
        <span className="text-xs text-on-surface-variant/60 font-medium uppercase tracking-wider font-[family-name:var(--font-inter)]">
          Translation Feed
        </span>
        <div className="flex-1 h-0.5 bg-outline-variant/20 rounded-full" />
      </div>

      {/* Feed container */}
      <div
        ref={feedRef}
        className="flex-1 overflow-y-auto px-5 pb-6 space-y-4"
      >
        {translations.length === 0 && !isProcessing && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-12 text-center"
          >
            <div className="text-4xl mb-3" style={{ animation: "float 3s ease-in-out infinite" }}>
              🐕
            </div>
            <p className="text-on-surface-variant/60 text-sm font-[family-name:var(--font-inter)]">
              Tap the microphone to start
            </p>
            <p className="text-on-surface-variant/40 text-xs mt-1 font-[family-name:var(--font-inter)]">
              Scooby&apos;s translations will appear here
            </p>
          </motion.div>
        )}

        <AnimatePresence initial={false}>
          {translations.map((t) => (
            <motion.div
              key={t.id}
              initial={{ opacity: 0, y: 20, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ type: "spring", stiffness: 300, damping: 25 }}
              className="flex gap-3"
            >
              {/* Paw icon */}
              <div className="flex-shrink-0 mt-1">
                <div className="w-8 h-8 rounded-full bg-primary-container/30 flex items-center justify-center text-sm">
                  🐾
                </div>
              </div>

              {/* Bubble */}
              <div className="flex-1 space-y-2">
                <div className="bg-surface-container-high rounded-3xl rounded-tl-lg p-4 shadow-[0_2px_20px_rgba(0,0,0,0.3)]">
                  <p className="text-foreground text-sm leading-relaxed font-[family-name:var(--font-outfit)]">
                    {t.text} {getMoodEmoji(t.mood)}
                  </p>
                </div>

                {/* Metrics pills */}
                <div className="flex flex-wrap gap-1.5 px-1">
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-secondary-container/30 text-secondary">
                    Pitch: {t.metrics.pitchLabel}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-secondary-container/30 text-secondary">
                    Volume: {t.metrics.volumeLabel}
                  </span>
                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-secondary-container/30 text-secondary">
                    {t.metrics.cadence}
                  </span>
                </div>

                {/* Timestamp */}
                <p className="text-[10px] text-on-surface-variant/40 px-1 font-[family-name:var(--font-inter)]">
                  {formatTime(t.timestamp)}
                </p>
              </div>
            </motion.div>
          ))}
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
                <div className="w-8 h-8 rounded-full bg-primary-container/30 flex items-center justify-center text-sm">
                  🐾
                </div>
              </div>
              <div className="bg-surface-container-high rounded-3xl rounded-tl-lg p-4 shadow-[0_2px_20px_rgba(0,0,0,0.3)]">
                <div className="flex items-center gap-2">
                  <div className="flex gap-1">
                    <motion.div
                      className="w-2 h-2 rounded-full bg-primary"
                      animate={{ y: [0, -6, 0] }}
                      transition={{
                        duration: 0.6,
                        repeat: Infinity,
                        delay: 0,
                      }}
                    />
                    <motion.div
                      className="w-2 h-2 rounded-full bg-primary/70"
                      animate={{ y: [0, -6, 0] }}
                      transition={{
                        duration: 0.6,
                        repeat: Infinity,
                        delay: 0.15,
                      }}
                    />
                    <motion.div
                      className="w-2 h-2 rounded-full bg-primary/40"
                      animate={{ y: [0, -6, 0] }}
                      transition={{
                        duration: 0.6,
                        repeat: Infinity,
                        delay: 0.3,
                      }}
                    />
                  </div>
                  <span className="text-xs text-on-surface-variant/60 font-[family-name:var(--font-inter)]">
                    Scooby is thinking...
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
