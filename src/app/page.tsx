"use client";

import { useState, useCallback } from "react";
import Header from "@/components/Header";
import ListenButton from "@/components/ListenButton";
import AudioVisualizer from "@/components/AudioVisualizer";
import TranslationFeed, { Translation } from "@/components/TranslationFeed";
import { useAudioAnalyzer } from "@/hooks/useAudioAnalyzer";

export default function Home() {
  const [translations, setTranslations] = useState<Translation[]>([]);
  const [isTranslating, setIsTranslating] = useState(false);

  const {
    isListening,
    isProcessing,
    startListening,
    stopListening,
    frequencyData,
    error,
  } = useAudioAnalyzer();

  const handleToggle = useCallback(async () => {
    if (isListening) {
      // Stop listening and translate
      const metrics = stopListening();
      if (!metrics) return;

      setIsTranslating(true);

      try {
        const response = await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(metrics),
        });

        // The API always returns valid JSON with a translation, even on errors
        const data = await response.json();

        const newTranslation: Translation = {
          id: crypto.randomUUID(),
          text: data.translation || data.error || "Woof!",
          metrics,
          timestamp: new Date(),
          mood: data.mood || "curious",
        };

        setTranslations((prev) => [...prev, newTranslation]);
      } catch (err) {
        // Network error — complete failure to reach the API
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
        };
        setTranslations((prev) => [...prev, newTranslation]);
      } finally {
        setIsTranslating(false);
      }
    } else {
      // Start listening
      await startListening();
    }
  }, [isListening, startListening, stopListening]);

  return (
    <main className="flex flex-col h-dvh max-w-lg mx-auto w-full">
      <Header isListening={isListening} />

      {/* Audio Visualizer */}
      <div className="py-3">
        <AudioVisualizer
          frequencyData={frequencyData}
          isListening={isListening}
        />
      </div>

      {/* Listen Button */}
      <ListenButton
        isListening={isListening}
        isProcessing={isProcessing || isTranslating}
        onToggle={handleToggle}
        error={error}
      />

      {/* Translation Feed */}
      <TranslationFeed
        translations={translations}
        isProcessing={isTranslating}
      />

      {/* Footer */}
      <footer className="px-5 py-3 text-center border-t border-outline-variant/10">
        <p className="text-[10px] text-on-surface-variant/30 font-[family-name:var(--font-inter)]">
          Built with 🐾 for Scooby • Powered by AI
        </p>
      </footer>
    </main>
  );
}
