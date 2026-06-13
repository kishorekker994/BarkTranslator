"use client";

import { useCallback, useRef, useState } from "react";

export interface BarkMetrics {
  pitch: number;         // Hz - weighted average frequency
  pitchLabel: string;    // "Low" | "Mid" | "High"
  volume: number;        // dB level
  volumeLabel: string;   // "Quiet" | "Moderate" | "Loud"
  cadence: string;       // descriptive cadence
  barkCount: number;     // number of detected vocalizations
  avgDuration: number;   // average vocalization duration in ms
  avgPause: number;      // average pause between vocalizations in ms
  recordingDuration: number; // total recording length in ms
}

interface UseAudioAnalyzerReturn {
  isListening: boolean;
  isProcessing: boolean;
  startListening: () => Promise<void>;
  stopListening: () => BarkMetrics | null;
  frequencyData: Uint8Array;
  currentVolume: number;
  elapsedSeconds: number;
  error: string | null;
}

// ─── Beagle-tuned constants ───────────────────────────────────────────────────
// Beagles typically vocalize at -28 to -20 dB in a living room setting.
// Slightly lower threshold than generic so we catch soft whines too.
const BARK_THRESHOLD_DB = -38;
const BARK_END_SILENCE_MS = 180; // ms of silence before a bark is "closed"
const SAMPLE_RATE = 44100;
const FFT_SIZE = 2048;

// Beagles: bark range 200–2800 Hz; bay/howl 150–900 Hz
const MIN_FREQ_HZ = 150;
const MAX_FREQ_HZ = 2800;

// ─── Pitch classifier — beagle-specific ranges ────────────────────────────────
function classifyPitch(hz: number): string {
  if (hz < 350) return "Low";   // bay / howl / growl
  if (hz < 900) return "Mid";   // typical bark
  return "High";                // yelp / whine / alert
}

function classifyVolume(db: number): string {
  if (db < -32) return "Quiet";
  if (db < -18) return "Moderate";
  return "Loud";
}

// ─── Cadence classifier ───────────────────────────────────────────────────────
function classifyCadence(
  barkCount: number,
  avgDuration: number,
  avgPause: number,
  totalDuration: number
): string {
  const barksPerSecond = barkCount / Math.max(totalDuration / 1000, 0.5);

  if (barkCount === 0) return "Whine/sustained sound";
  if (barkCount === 1) {
    if (avgDuration > 1200) return "Drawn-out howl/baying";
    return "Single, sharp bark";
  }
  if (avgDuration > 1200) return "Drawn-out howl/baying";
  if (barksPerSecond > 3.5 || avgPause < 180) return "Rapid cadence";
  if (barksPerSecond < 0.8 || avgPause > 2200) return "Slow cadence";
  if (avgPause > 1200 && barksPerSecond < 1.8) return "Monotonous with long pauses";
  return "Moderate cadence";
}

export function useAudioAnalyzer(): UseAudioAnalyzerReturn {
  const [isListening, setIsListening] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [frequencyData, setFrequencyData] = useState<Uint8Array>(
    new Uint8Array(FFT_SIZE / 2)
  );
  const [currentVolume, setCurrentVolume] = useState(-60);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const animFrameRef = useRef<number>(0);
  const timerIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Bark detection state
  const barkDurationsRef = useRef<number[]>([]);
  const pauseDurationsRef = useRef<number[]>([]);
  const isInBarkRef = useRef(false);
  const barkStartRef = useRef(0);
  const lastBarkEndRef = useRef(0);
  const silenceStartRef = useRef(0);
  const recordingStartRef = useRef(0);

  // Pitch sampling
  const pitchSamplesRef = useRef<number[]>([]);
  // Volume tracking (peak dB during recording)
  const peakVolumeRef = useRef(-60);

  const computeRmsDb = useCallback((timeDomainData: Uint8Array): number => {
    let sumSquares = 0;
    for (let i = 0; i < timeDomainData.length; i++) {
      const normalized = (timeDomainData[i] - 128) / 128;
      sumSquares += normalized * normalized;
    }
    const rms = Math.sqrt(sumSquares / timeDomainData.length);
    return 20 * Math.log10(Math.max(rms, 1e-10));
  }, []);

  // Weighted centroid limited to beagle vocalization range
  const computeWeightedFrequency = useCallback(
    (freqData: Uint8Array, sampleRate: number, fftSize: number): number => {
      let weightedSum = 0;
      let totalMagnitude = 0;
      const binStep = sampleRate / fftSize;

      for (let i = 1; i < freqData.length; i++) {
        const freq = i * binStep;
        if (freq >= MIN_FREQ_HZ && freq <= MAX_FREQ_HZ) {
          const mag = freqData[i];
          weightedSum += freq * mag;
          totalMagnitude += mag;
        }
      }

      return totalMagnitude > 0 ? weightedSum / totalMagnitude : 0;
    },
    []
  );

  const startListening = useCallback(async () => {
    setError(null);
    setElapsedSeconds(0);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: false, // keep raw for beagle analysis
          autoGainControl: false,  // don't compress — we need real volume data
        },
      });

      const audioContext = new AudioContext({ sampleRate: SAMPLE_RATE });
      const source = audioContext.createMediaStreamSource(stream);
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = FFT_SIZE;
      analyser.smoothingTimeConstant = 0.75;
      source.connect(analyser);

      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      streamRef.current = stream;

      // Reset all tracking
      barkDurationsRef.current = [];
      pauseDurationsRef.current = [];
      isInBarkRef.current = false;
      pitchSamplesRef.current = [];
      peakVolumeRef.current = -60;
      lastBarkEndRef.current = 0;
      silenceStartRef.current = 0;
      recordingStartRef.current = Date.now();

      setIsListening(true);

      // Elapsed-seconds timer
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds(Math.floor((Date.now() - recordingStartRef.current) / 1000));
      }, 1000);

      const freqDataArray = new Uint8Array(analyser.frequencyBinCount);
      const timeDomainArray = new Uint8Array(analyser.fftSize);

      const analyze = () => {
        if (!analyserRef.current) return;

        analyserRef.current.getByteFrequencyData(freqDataArray);
        analyserRef.current.getByteTimeDomainData(timeDomainArray);

        setFrequencyData(new Uint8Array(freqDataArray));

        const db = computeRmsDb(timeDomainArray);
        setCurrentVolume(db);
        if (db > peakVolumeRef.current) peakVolumeRef.current = db;

        const pitch = computeWeightedFrequency(
          freqDataArray,
          audioContext.sampleRate,
          analyser.fftSize
        );
        if (pitch > 0) pitchSamplesRef.current.push(pitch);

        // Bark / vocalization detection
        const now = Date.now();
        if (db > BARK_THRESHOLD_DB) {
          if (!isInBarkRef.current) {
            isInBarkRef.current = true;
            barkStartRef.current = now;
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
              isInBarkRef.current = false;
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

    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (audioContextRef.current) {
      audioContextRef.current.close();
      audioContextRef.current = null;
    }

    analyserRef.current = null;
    setIsListening(false);
    setIsProcessing(true);

    const totalDuration = Date.now() - recordingStartRef.current;

    // Close any in-progress bark
    if (isInBarkRef.current) {
      barkDurationsRef.current.push(Date.now() - barkStartRef.current);
      isInBarkRef.current = false;
    }

    const barkCount = barkDurationsRef.current.length;

    const avgDuration =
      barkCount > 0
        ? barkDurationsRef.current.reduce((a, b) => a + b, 0) / barkCount
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

    const finalBarkCount = barkCount > 0 ? barkCount : 1;
    const finalAvgDuration = avgDuration > 0 ? avgDuration : totalDuration;

    const pitch = Math.round(avgPitch);
    const metrics: BarkMetrics = {
      pitch,
      pitchLabel: classifyPitch(pitch),
      volume: Math.round(peakVolumeRef.current), // use peak, not last sample
      volumeLabel: classifyVolume(peakVolumeRef.current),
      cadence: classifyCadence(finalBarkCount, finalAvgDuration, avgPause, totalDuration),
      barkCount: finalBarkCount,
      avgDuration: Math.round(finalAvgDuration),
      avgPause: Math.round(avgPause),
      recordingDuration: totalDuration,
    };

    setIsProcessing(false);
    return metrics;
  }, []);

  return {
    isListening,
    isProcessing,
    startListening,
    stopListening,
    frequencyData,
    currentVolume,
    elapsedSeconds,
    error,
  };
}
