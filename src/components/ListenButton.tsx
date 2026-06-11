"use client";

import { motion, AnimatePresence } from "framer-motion";

interface ListenButtonProps {
  isListening: boolean;
  isProcessing: boolean;
  onToggle: () => void;
  error: string | null;
}

export default function ListenButton({
  isListening,
  isProcessing,
  onToggle,
  error,
}: ListenButtonProps) {
  return (
    <div className="flex flex-col items-center gap-4 py-6">
      {/* Button with pulse rings */}
      <div className="relative flex items-center justify-center">
        {/* Pulse rings when listening */}
        <AnimatePresence>
          {isListening && (
            <>
              <motion.div
                key="ring1"
                className="absolute w-[120px] h-[120px] rounded-full border-2 border-primary-container/40"
                initial={{ scale: 1, opacity: 0.6 }}
                animate={{ scale: 1.8, opacity: 0 }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeOut",
                }}
              />
              <motion.div
                key="ring2"
                className="absolute w-[120px] h-[120px] rounded-full border-2 border-primary-container/30"
                initial={{ scale: 1, opacity: 0.4 }}
                animate={{ scale: 2.2, opacity: 0 }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeOut",
                  delay: 0.5,
                }}
              />
              <motion.div
                key="ring3"
                className="absolute w-[120px] h-[120px] rounded-full border border-primary/20"
                initial={{ scale: 1, opacity: 0.3 }}
                animate={{ scale: 2.6, opacity: 0 }}
                transition={{
                  duration: 1.5,
                  repeat: Infinity,
                  ease: "easeOut",
                  delay: 1.0,
                }}
              />
            </>
          )}
        </AnimatePresence>

        {/* Main button */}
        <motion.button
          id="listen-button"
          onClick={onToggle}
          disabled={isProcessing}
          whileTap={{ scale: 0.92 }}
          whileHover={{ scale: 1.04 }}
          className={`relative z-10 w-[120px] h-[120px] rounded-full flex items-center justify-center transition-all duration-300 cursor-pointer ${
            isListening
              ? "bg-primary shadow-[0_0_30px_rgba(244,187,146,0.4),0_0_60px_rgba(139,94,60,0.2)]"
              : "bg-primary-container shadow-[0_0_20px_rgba(139,94,60,0.3),0_0_40px_rgba(139,94,60,0.1)]"
          } ${isProcessing ? "opacity-60 cursor-not-allowed" : ""}`}
          style={{
            animation: isListening ? "glow-breathe 2s ease-in-out infinite" : undefined,
          }}
          aria-label={isListening ? "Stop listening" : "Start listening"}
        >
          {isProcessing ? (
            /* Processing spinner */
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            >
              <svg
                width="40"
                height="40"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-on-primary"
              >
                <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
              </svg>
            </motion.div>
          ) : isListening ? (
            /* Stop icon */
            <svg
              width="36"
              height="36"
              viewBox="0 0 24 24"
              fill="currentColor"
              className="text-on-primary"
            >
              <rect x="6" y="6" width="12" height="12" rx="2" />
            </svg>
          ) : (
            /* Microphone icon */
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-on-primary-container"
            >
              <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
              <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
              <line x1="12" y1="19" x2="12" y2="22" />
            </svg>
          )}
        </motion.button>
      </div>

      {/* Label */}
      <motion.p
        className="text-sm text-on-surface-variant font-medium font-[family-name:var(--font-inter)]"
        animate={{ opacity: isProcessing ? 0.5 : 1 }}
      >
        {isProcessing
          ? "Translating..."
          : isListening
          ? "Tap to stop"
          : "Tap to Listen"}
      </motion.p>

      {/* Error message */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="bg-error/10 text-error text-xs px-4 py-2 rounded-full border border-error/20"
          >
            {error}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
