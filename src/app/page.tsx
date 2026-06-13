"use client";

import { useState, useCallback, useEffect } from "react";
import Header from "@/components/Header";
import ListenButton from "@/components/ListenButton";
import AudioVisualizer from "@/components/AudioVisualizer";
import TranslationFeed, { Translation } from "@/components/TranslationFeed";
import { useAudioAnalyzer } from "@/hooks/useAudioAnalyzer";

const STORAGE_KEY_TRANSLATIONS = "bark-translations-v2";
const STORAGE_KEY_DOG_NAME = "bark-dog-name";
const MAX_STORED = 30;

export default function Home() {
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);
  const [dogName, setDogName] = useState("Scooby");

  const {
    isListening,
    isProcessing,
    startListening,
    stopListening,
    frequencyData,
    elapsedSeconds,
    error,
  } = useAudioAnalyzer();

  // ─── Hydrate from localStorage ───────────────────────────────────────────
  useEffect(() => {
    try {
      const savedName = localStorage.getItem(STORAGE_KEY_DOG_NAME);
      if (savedName) setDogName(savedName);

      const savedRaw = localStorage.getItem(STORAGE_KEY_TRANSLATIONS);
      if (savedRaw) {
        const parsed = JSON.parse(savedRaw) as Translation[];
        // Revive Date objects
        setTranslations(
          parsed.map((t) => ({ ...t, timestamp: new Date(t.timestamp) }))
        );
      }
    } catch {
      // corrupted storage — ignore
    }
  }, []);

  // ─── Persist translations ────────────────────────────────────────────────
  useEffect(() => {
    if (translations.length === 0) return;
    try {
      // Keep only last MAX_STORED entries
      const toSave = translations.slice(-MAX_STORED);
      localStorage.setItem(STORAGE_KEY_TRANSLATIONS, JSON.stringify(toSave));
    } catch {
      // storage quota — ignore
    }
  }, [translations]);

  // ─── Persist dog name ────────────────────────────────────────────────────
  const handleDogNameChange = useCallback((name: string) => {
    setDogName(name);
    localStorage.setItem(STORAGE_KEY_DOG_NAME, name);
  }, []);

  // ─── Clear history ───────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    setTranslations([]);
    localStorage.removeItem(STORAGE_KEY_TRANSLATIONS);
  }, []);

  // ─── Main toggle ─────────────────────────────────────────────────────────
  const handleToggle = useCallback(async () => {
    if (isListening) {
      const metrics = stopListening();
      if (!metrics) return;

      setIsTranslating(true);

      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...metrics, dogName }),
          cache: "no-store",
        });

        const data = await response.json();

        const newTranslation: Translation = {
          id: crypto.randomUUID(),
          text: data.translation || data.error || "Woof!",
          metrics,
          timestamp: new Date(),
          mood: data.vocalType || data.mood || "curious",
          vocalType: data.vocalType || data.mood || "curious",
          trainerTip: data.trainerTip,
          confidence: data.confidence,
        };

        setTranslations((prev) => [...prev, newTranslation]);
      } catch (err) {
        console.error("Network error:", err);

        const fallbacks = [
          "WOOF! My translator is napping but I have LOTS to say! Try again!",
          "Bark bark! (Network hiccup — but my enthusiasm is uninterrupted!)",
          "Aroooo! The internet gremlins ate my translation. One more try?",
        ];
        const newTranslation: Translation = {
          id: crypto.randomUUID(),
          text: fallbacks[Math.floor(Math.random() * fallbacks.length)],
          metrics,
          timestamp: new Date(),
          mood: "curious",
          vocalType: "curious",
          trainerTip:
            "Check your internet connection and try again — the AI translator works best online.",
          confidence: 50,
        };
        setTranslations((prev) => [...prev, newTranslation]);
      } finally {
        setIsTranslating(false);
      }
    } else {
      await startListening();
    }
  }, [isListening, startListening, stopListening, dogName]);

  return (
    <main className="flex flex-col h-dvh max-w-lg mx-auto w-full">
      <Header
        isListening={isListening}
        dogName={dogName}
        onDogNameChange={handleDogNameChange}
      />

      {/* Audio Visualizer */}
      <div className="py-3">
        <AudioVisualizer frequencyData={frequencyData} isListening={isListening} />
      </div>

      {/* Listen Button */}
      <ListenButton
        isListening={isListening}
        isProcessing={isProcessing || isTranslating}
        elapsedSeconds={elapsedSeconds}
        onToggle={handleToggle}
        error={error}
      />

      {/* Translation Feed */}
      <TranslationFeed
        translations={translations}
        isProcessing={isTranslating}
        dogName={dogName}
        onClear={handleClear}
      />

      {/* Footer */}
      <footer className="px-5 py-3 text-center border-t border-outline-variant/10">
        <p className="text-[10px] text-on-surface-variant/30 font-[family-name:var(--font-inter)]">
          Built with 🐾 for {dogName} · Powered by Gemini AI
        </p>
      </footer>
    </main>
  );
}
