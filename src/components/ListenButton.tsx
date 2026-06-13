"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useState } from "react";

interface ListenButtonProps {
  isListening: boolean;
  isProcessing: boolean;
  elapsedSeconds: number;
  onToggle: () => void;
  error: string | null;
}

function formatElapsed(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m > 0) return `${m}:${String(sec).padStart(2, "0")}`;
  return `${sec}s`;
}

export default function ListenButton({
  isListening,
  isProcessing,
  elapsedSeconds,
  onToggle,
  error,
}: ListenButtonProps) {
  // Subtle label blink when listening
  const [labelVisible, setLabelVisible] = useState(true);
  useEffect(() => {
    if (!isListening) { setLabelVisible(true); return; }
    const id = setInterval(() => setLabelVisible((v) => !v), 900);
    return () => clearInterval(id);
  }, [isListening]);

  return (
    <div className="flex flex-col items-center gap-3 py-5">
      {/* Pulse rings + main button */}
      <div className="relative flex items-center justify-center">
        <AnimatePresence>
          {isListening && (
            <>
              {[
                { key: "r1", scale: 1.8, opacity: [0.55, 0], delay: 0 },
                { key: "r2", scale: 2.2, opacity: [0.35, 0], delay: 0.5 },
                { key: "r3", scale: 2.7, opacity: [0.2, 0], delay: 1.0 },
              ].map(({ key, scale, opacity, delay }) => (
                <motion.div
                  key={key}
                  className="absolute w-[120px] h-[120px] rounded-full border-2 border-primary-container/40"
                  initial={{ scale: 1, opacity: opacity[0] }}
                  animate={{ scale, opacity: opacity[1] }}
                  transition={{ duration: 1.6, repeat: Infinity, ease: "easeOut", delay }}
                />
              ))}
            </>
          )}
        </AnimatePresence>

        <motion.button
          id="listen-button"
          onClick={onToggle}
          disabled={isProcessing}
          whileTap={{ scale: 0.91 }}
          whileHover={{ scale: isProcessing ? 1 : 1.05 }}
          className={`relative z-10 w-[120px] h-[120px] rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${
            isListening
              ? "bg-primary shadow-[0_0_32px_rgba(244,187,146,0.45),0_0_64px_rgba(139,94,60,0.25)]"
              : "bg-primary-container shadow-[0_0_20px_rgba(139,94,60,0.3),0_0_40px_rgba(139,94,60,0.1)]"
          } ${isProcessing ? "opacity-55 cursor-not-allowed" : ""}`}
          style={{
            animation: isListening ? "glow-breathe 2s ease-in-out infinite" : undefined,
          }}
          aria-label={isListening ? "Stop listening" : "Start listening"}
        >
          {isProcessing ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>
              <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-on-primary">
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </motion.div>
          ) : isListening ? (
            <svg width="36" height="36" viewBox="0 0 24 24" fill="currentColor" className="text-on-primary">
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-on-primary-container">
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          )}
        </motion.button>
      </div>

      {/* Label row */}
      <div className="flex flex-col items-center gap-1 min-h-[40px]">
        <motion.p
          className="text-sm text-on-surface-variant font-medium font-[family-name:var(--font-inter)]"
          animate={{ opacity: isProcessing ? 0.5 : labelVisible ? 1 : 0.35 }}
          transition={{ duration: 0.3 }}
        >
          {isProcessing ? "Translating…" : isListening ? "Tap to stop" : "Tap to Listen"}
        </motion.p>

        {/* Recording timer */}
        <AnimatePresence>
          {isListening && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="flex items-center gap-1.5"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-error animate-pulse" />
              <span className="text-xs text-error/80 font-mono font-medium">
                {formatElapsed(elapsedSeconds)}
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-error/10 text-error text-xs px-4 py-2 rounded-full border border-error/20 font-[family-name:var(--font-inter)]"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
