"use client";

import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";

interface HeaderProps {
  isListening: boolean;
  dogName: string;
  onDogNameChange: (name: string) => void;
}

export default function Header({ isListening, dogName, onDogNameChange }: HeaderProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(dogName);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  const commit = () => {
    const trimmed = draft.trim();
    if (trimmed) onDogNameChange(trimmed);
    setEditing(false);
  };

  return (
    <header className="sticky top-0 z-50 glass bg-background/80 border-b border-outline-variant/20">
      <div className="max-w-lg mx-auto px-5 py-3 flex items-center justify-between">
        {/* Left: Avatar + Title */}
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-primary-container shadow-lg flex-shrink-0">
            <Image
              src="/scooby-avatar.png"
              alt={`${dogName} the Beagle`}
              fill
              className="object-cover"
              priority
            />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight font-[family-name:var(--font-outfit)] flex items-center gap-1.5">
              <AnimatePresence mode="wait">
                {editing ? (
                  <motion.input
                    key="input"
                    ref={inputRef}
                    initial={{ opacity: 0, width: 80 }}
                    animate={{ opacity: 1, width: "auto" }}
                    exit={{ opacity: 0 }}
                    className="bg-surface-container-high rounded-lg px-2 py-0.5 text-base font-bold text-foreground outline-none border border-primary/40 w-32"
                    value={draft}
                    maxLength={20}
                    onChange={(e) => setDraft(e.target.value)}
                    onBlur={commit}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") commit();
                      if (e.key === "Escape") { setDraft(dogName); setEditing(false); }
                    }}
                  />
                ) : (
                  <motion.button
                    key="label"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    onClick={() => { setDraft(dogName); setEditing(true); }}
                    className="hover:text-primary transition-colors cursor-pointer group flex items-center gap-1"
                    title="Click to rename your dog"
                  >
                    {dogName} Says…
                    <span className="text-xs text-on-surface-variant/30 group-hover:text-primary/50 transition-colors">✏️</span>
                  </motion.button>
                )}
              </AnimatePresence>
            </h1>
            <p className="text-xs text-on-surface-variant font-[family-name:var(--font-inter)]">
              Beagle · 1 yr · Bark Translator
            </p>
          </div>
        </div>

        {/* Right: Status */}
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full transition-colors duration-500 ${
              isListening ? "bg-primary status-dot" : "bg-[#6fcf97] status-dot"
            }`}
          />
          <span className="text-xs text-on-surface-variant font-medium font-[family-name:var(--font-inter)]">
            {isListening ? "Listening…" : "Ready"}
          </span>
        </div>
      </div>
    </header>
  );
}
