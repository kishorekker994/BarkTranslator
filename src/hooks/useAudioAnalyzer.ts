"use client";

import { useCallback, useRef, useState } from "react";

export interface BarkMetrics {
  pitch: number;         // Hz - average frequency
  pitchLabel: string;    // "Low" | "Mid" | "High"
  volume: number;        // dB level
  volumeLabel: string;   // "Quiet" | "Moderate" | "Loud"
  cadence: string;       // descriptive cadence
  barkCount: number;     // number of detected barks
  avgDuration: number;   // average bark duration in ms
  avgPause: number;      // average pause between barks in ms
}

interface UseAudioAnalyzerReturn {
  isListening: boolean;
  isProcessing: boolean;
  startListening: () => Promise<void>;
  stopListening: () => BarkMetrics | null;
  frequencyData: Uint8Array;
  currentVolume: number;
  error: string | null;
}

const BARK_THRESHOLD_DB = -35;  // dB threshold for bark detection
const BARK_END_SILENCE_MS = 200; // ms of silence to end a bark
const SAMPLE_RATE = 44100;
const FFT_SIZE = 2048;

function classifyPitch(hz: number): string {
  if (hz < 300) return "Low";
  if (hz < 800) return "Mid";
  return "High";
}

function classifyVolume(db: number): string {
  if (db < -30) return "Quiet";
  if (db < -15) return "Moderate";
  return "Loud";
}

function classifyCadence(
  barkCount: number,
  avgDuration: number,
  avgPause: number,
  totalDuration: number
): string {
  const barksPerSecond = barkCount / (totalDuration / 1000);

  // Single bark
  if (barkCount === 1) {
    if (avgDuration > 1500) return "Drawn-out howl/baying";
    return "Single, sharp bark";
  }

  // Drawn-out sustained sound
  if (avgDuration > 1500) return "Drawn-out howl/baying";

  // Rapid cadence
  if (barksPerSecond > 3 || avgPause < 200) return "Rapid cadence";

  // Slow cadence
  if (barksPerSecond < 1 || avgPause > 2000) return "Slow cadence";

  // Monotonous with long pauses
  if (avgPause > 1000 && barksPerSecond < 2)
    return "Monotonous with long pauses";

  return "Moderate cadence";
}

export function useAudioAnalyzer(): UseAudioAnalyzerReturn {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [frequencyData, setFrequencyData] = useState<Uint8Array>(
    new Uint8Array(FFT_SIZE / 2)
  );
  const [currentVolume, setCurrentVolume] = useState(-60);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);

  // Bark detection state
  const barkStartTimesRef = useRef<number[]>([]);
  const barkDurationsRef = useRef<number[]>([]);
  const pauseDurationsRef = useRef<number[]>([]);
  const isInBarkRef = useRef(false);
  const barkStartRef = useRef(0);
  const barkEndRef = useRef(0);
  const lastBarkEndRef = useRef(0);
  const silenceStartRef = useRef(0);
  const recordingStartRef = useRef(0);

  // Accumulated frequency data for averaging
  const pitchSamplesRef = useRef<number[]>([]);

  const computeRmsDb = useCallback((timeDomainData: Uint8Array): number => {
    let sumSquares = 0;
    for (let i = 0; i < timeDomainData.length; i++) {
      const normalized = (timeDomainData[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / timeDomainData.length);
    const db = 20 * Math.log10(Math.max(rms, 1e-10));
    return db;
  }, []);

  const computeWeightedFrequency = useCallback(
    (freqData: Uint8Array, sampleRate: number, fftSize: number): number => {
      let weightedSum = 0;
      let totalMagnitude = 0;
      const binFrequencyStep = sampleRate / fftSize;

      for (let i = 1; i < freqData.length; i++) {
        const magnitude = freqData[i];
        const frequency = i * binFrequencyStep;
        // Focus on dog bark range (100Hz - 3000Hz)
        if (frequency >= 100 && frequency <= 3000) {
          weightedSum += frequency * magnitude;
          totalMagnitude += magnitude;
        }
      }

      return totalMagnitude > 0 ? weightedSum / totalMagnitude : 0;
    },
    []
  );

  const startListening = useCallback(async () => {
    setError(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.8;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      streamRef.current = stream;

      // Reset bark detection
      barkStartTimesRef.current = [];
      barkDurationsRef.current = [];
      pauseDurationsRef.current = [];
      isInBarkRef.current = false;
      pitchSamplesRef.current = [];
      recordingStartRef.current = Date.now();

      setIsListening(true);

      // Start the analysis loop
      const freqDataArray = new Uint8Array(analyser.frequencyBinCount);
      const timeDomainArray = new Uint8Array(analyser.fftSize);

      const analyze = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(freqDataArray);
        analyserRef.current.getByteTimeDomainData(timeDomainArray);

        // Update frequency data for visualizer
        const freqCopy = new Uint8Array(freqDataArray);
        setFrequencyData(freqCopy);

        // Compute volume
        const db = computeRmsDb(timeDomainArray);
        setCurrentVolume(db);

        // Compute pitch
        const pitch = computeWeightedFrequency(
          freqDataArray,
          audioContext.sampleRate,
          analyser.fftSize
        );
        if (pitch > 0) {
          pitchSamplesRef.current.push(pitch);
        }

        // Bark detection
        const now = Date.now();
        if (db > BARK_THRESHOLD_DB) {
          if (!isInBarkRef.current) {
            // Bark started
            isInBarkRef.current = true;
            barkStartRef.current = now;
            barkStartTimesRef.current.push(now);

            // Record pause if there was a previous bark
            if (lastBarkEndRef.current > 0) {
              pauseDurationsRef.current.push(now - lastBarkEndRef.current);
            }
          }
          silenceStartRef.current = 0;
        } else {
          if (isInBarkRef.current) {
            if (silenceStartRef.current === 0) {
              silenceStartRef.current = now;
            } else if (now - silenceStartRef.current > BARK_END_SILENCE_MS) {
              // Bark ended
              isInBarkRef.current = false;
              barkEndRef.current = now;
              lastBarkEndRef.current = now;
              barkDurationsRef.current.push(now - barkStartRef.current);
              silenceStartRef.current = 0;
            }
          }
        }

        animFrameRef.current = requestAnimationFrame(analyze);
      };

      analyze();
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "Failed to access microphone";
      setError(message);
      console.error("Microphone error:", err);
    }
  }, [computeRmsDb, computeWeightedFrequency]);

  const stopListening = useCallback((): BarkMetrics | null => {
    cancelAnimationFrame(animFrameRef.current);

    // Stop all tracks
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    // Close audio context
    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setIsListening(false);
    setIsProcessing(true);

    const totalDuration = Date.now() - recordingStartRef.current;
    const barkCount = barkDurationsRef.current.length;

    // If currently in a bark, close it
    if (isInBarkRef.current) {
      barkDurationsRef.current.push(Date.now() - barkStartRef.current);
      isInBarkRef.current = false;
    }

    // Calculate averages
    const avgDuration =
      barkDurationsRef.current.length > 0
        ? barkDurationsRef.current.reduce((a, b) => a + b, 0) /
          barkDurationsRef.current.length
        : 0;

    const avgPause =
      pauseDurationsRef.current.length > 0
        ? pauseDurationsRef.current.reduce((a, b) => a + b, 0) /
          pauseDurationsRef.current.length
        : 0;

    const avgPitch =
      pitchSamplesRef.current.length > 0
        ? pitchSamplesRef.current.reduce((a, b) => a + b, 0) /
          pitchSamplesRef.current.length
        : 0;

    // If no barks detected but there was audio, create a "whine" detection
    const finalBarkCount = barkCount > 0 ? barkCount : 1;
    const finalAvgDuration = avgDuration > 0 ? avgDuration : totalDuration;

    const pitch = Math.round(avgPitch);
    const pitchLabel = classifyPitch(pitch);
    const volumeLabel = classifyVolume(currentVolume);
    const cadence = classifyCadence(
      finalBarkCount,
      finalAvgDuration,
      avgPause,
      totalDuration
    );

    const metrics: BarkMetrics = {
      pitch,
      pitchLabel,
      volume: Math.round(currentVolume),
      volumeLabel,
      cadence,
      barkCount: finalBarkCount,
      avgDuration: Math.round(finalAvgDuration),
      avgPause: Math.round(avgPause),
    };

    setIsProcessing(false);
    return metrics;
  }, [currentVolume]);

  return {
    isListening,
    isProcessing,
    startListening,
    stopListening,
    frequencyData,
    currentVolume,
    error,
  };
}
