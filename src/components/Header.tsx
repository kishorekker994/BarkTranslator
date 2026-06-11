"use client";

import Image from "next/image";

interface HeaderProps {
  isListening: boolean;
}

export default function Header({ isListening }: HeaderProps) {
  return (
    <header className="sticky top-0 z-50 glass bg-background/80 border-b border-outline-variant/20">
      <div className="max-w-lg mx-auto px-5 py-3 flex items-center justify-between">
        {/* Left: Avatar + Title */}
        <div className="flex items-center gap-3">
          <div className="relative w-10 h-10 rounded-full overflow-hidden ring-2 ring-primary-container shadow-lg">
            <Image
              src="/scooby-avatar.png"
              alt="Scooby the Beagle"
              fill
              className="object-cover"
              priority
            />
          </div>
          <div>
            <h1 className="text-lg font-bold text-foreground tracking-tight font-[family-name:var(--font-outfit)]">
              Scooby Says...
            </h1>
            <p className="text-xs text-on-surface-variant font-[family-name:var(--font-inter)]">
              Bark Translator
            </p>
          </div>
        </div>

        {/* Right: Status */}
        <div className="flex items-center gap-2">
          <div
            className={`w-2.5 h-2.5 rounded-full ${
              isListening
                ? "bg-primary status-dot"
                : "bg-[#6fcf97] status-dot"
            }`}
          />
          <span className="text-xs text-on-surface-variant font-medium font-[family-name:var(--font-inter)]">
            {isListening ? "Listening..." : "Ready"}
          </span>
        </div>
      </div>
    </header>
  );
}
