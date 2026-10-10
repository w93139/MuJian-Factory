"use client";
import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Pause, Play } from "lucide-react";
import Threads from "./reference/Threads";
const reducedQuery = "(prefers-reduced-motion: reduce)";
function subscribe(callback: () => void) {
  const m = window.matchMedia(reducedQuery);
  m.addEventListener("change", callback);
  return () => m.removeEventListener("change", callback);
}
function useReduced() {
  return useSyncExternalStore(
    subscribe,
    () => window.matchMedia(reducedQuery).matches,
    () => true,
  );
}
function useMotionState() {
  const reduced = useReduced(),
    [paused, setPaused] = useState(false),
    [visible, setVisible] = useState(true),
    ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver((e) =>
      setVisible(e.some((v) => v.isIntersecting)),
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  return { ref, reduced, paused, visible, setPaused };
}
function MotionToggle({
  paused,
  onChange,
  reduced,
}: {
  paused: boolean;
  onChange: () => void;
  reduced: boolean;
}) {
  return (
    <button
      type="button"
      className="motion-toggle"
      aria-label={paused ? "播放主视觉动效" : "暂停主视觉动效"}
      aria-pressed={paused}
      disabled={reduced}
      onClick={onChange}
    >
      {paused || reduced ? <Play size={12} /> : <Pause size={12} />}
      <span>{reduced ? "静态模式" : paused ? "播放动效" : "暂停动效"}</span>
    </button>
  );
}
export function WaveScene() {
  const { ref, reduced, paused, visible, setPaused } = useMotionState();
  return (
    <div
      className="wave-scene"
      ref={ref}
      data-motion={reduced || paused ? "paused" : "active"}
    >
      <Threads
        color="#ffffff"
        amplitude={2.2}
        distance={0.35}
        angle={-12}
        brightness={1.7}
        lineCount={80}
        softness={1.6}
        fray={0.55}
        parting={0.45}
        speed={0.4}
        enableMouseInteraction={!reduced && !paused}
        paused={reduced || paused || !visible}
      />
      <svg
        className="wave-fallback"
        viewBox="0 0 1100 520"
        preserveAspectRatio="none"
        aria-hidden="true"
      >
        {Array.from({ length: 38 }, (_, i) => (
          <path
            key={i}
            d={`M -70 ${130 + i * 5} C 180 ${330 + i * 2} 230 ${-120 + i * 9} 580 ${130 + i * 8} S 1050 ${600 - i * 5} 1220 ${190 + i * 4}`}
          />
        ))}
      </svg>
      <MotionToggle
        paused={paused}
        reduced={reduced}
        onChange={() => setPaused(!paused)}
      />
    </div>
  );
}
