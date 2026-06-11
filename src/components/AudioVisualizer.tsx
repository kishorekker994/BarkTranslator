"use client";

import { useRef, useEffect, useCallback } from "react";

interface AudioVisualizerProps {
  frequencyData: Uint8Array;
  isListening: boolean;
}

const BAR_COUNT = 48;
const BAR_GAP = 3;
const MIN_BAR_HEIGHT = 3;
const MAX_BAR_HEIGHT = 70;

export default function AudioVisualizer({
  frequencyData,
  isListening,
}: AudioVisualizerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animFrameRef = useRef<number>(0);
  const idleBarsRef = useRef<number[]>(
    Array.from({ length: BAR_COUNT }, () => Math.random() * 8 + 3)
  );
  const idlePhaseRef = useRef(0);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    ctx.scale(dpr, dpr);

    const width = rect.width;
    const height = rect.height;

    ctx.clearRect(0, 0, width, height);

    const barWidth = (width - BAR_GAP * (BAR_COUNT - 1)) / BAR_COUNT;
    const centerY = height / 2;

    for (let i = 0; i < BAR_COUNT; i++) {
      let barHeight: number;

      if (isListening && frequencyData.length > 0) {
        // Map bar index to frequency data
        const dataIndex = Math.floor(
          (i / BAR_COUNT) * Math.min(frequencyData.length, 256)
        );
        const value = frequencyData[dataIndex] || 0;
        barHeight = Math.max(
          MIN_BAR_HEIGHT,
          (value / 255) * MAX_BAR_HEIGHT
        );
      } else {
        // Idle animation with gentle wave
        idlePhaseRef.current += 0.0001;
        const phase = idlePhaseRef.current;
        const wave =
          Math.sin(phase + i * 0.3) * 4 +
          Math.sin(phase * 1.5 + i * 0.15) * 2;
        barHeight = Math.max(MIN_BAR_HEIGHT, idleBarsRef.current[i] + wave);
      }

      const x = i * (barWidth + BAR_GAP);
      const halfHeight = barHeight / 2;

      // Gradient from primary-container to primary
      const intensity = barHeight / MAX_BAR_HEIGHT;
      const r = Math.round(139 + (244 - 139) * intensity); // #8B5E3C → #F4BB92
      const g = Math.round(94 + (187 - 94) * intensity);
      const b = Math.round(60 + (146 - 60) * intensity);

      // Create gradient per bar
      const gradient = ctx.createLinearGradient(x, centerY - halfHeight, x, centerY + halfHeight);
      gradient.addColorStop(0, `rgba(${r}, ${g}, ${b}, 0.9)`);
      gradient.addColorStop(0.5, `rgba(${r}, ${g}, ${b}, 1)`);
      gradient.addColorStop(1, `rgba(${r}, ${g}, ${b}, 0.9)`);

      ctx.fillStyle = gradient;

      // Draw rounded bar (mirrored from center)
      const radius = Math.min(barWidth / 2, 3);
      drawRoundedRect(ctx, x, centerY - halfHeight, barWidth, barHeight, radius);
    }

    animFrameRef.current = requestAnimationFrame(draw);
  }, [frequencyData, isListening]);

  useEffect(() => {
    animFrameRef.current = requestAnimationFrame(draw);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, [draw]);

  return (
    <div className="w-full px-5">
      <div className="relative w-full h-[80px] rounded-3xl bg-surface-container/50 overflow-hidden border border-outline-variant/10">
        <canvas
          ref={canvasRef}
          className="w-full h-full"
          aria-label="Audio frequency visualizer"
        />
        {/* Subtle glow overlay when listening */}
        {isListening && (
          <div className="absolute inset-0 bg-gradient-to-t from-primary-container/5 to-transparent pointer-events-none" />
        )}
      </div>
    </div>
  );
}

function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
  ctx.fill();
}
