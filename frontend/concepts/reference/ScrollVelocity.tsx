"use client";
// Adapted from DavidHDev/react-bits, commit 63a008de65732d73010bd219d25d15c47739bb31.
// Copyright (c) 2026 David Haz. MIT + Commons Clause: LICENSE.md.

import React, { useRef, useLayoutEffect, useState, useEffect } from "react";
import {
  motion,
  useScroll,
  useSpring,
  useTransform,
  useMotionValue,
  useVelocity,
  useReducedMotion,
} from "motion/react";
import "./ScrollVelocity.css";

interface VelocityMapping {
  input: [number, number];
  output: [number, number];
}

interface VelocityTextProps {
  paused?: boolean;
  children: React.ReactNode;
  baseVelocity: number;
  scrollContainerRef?: React.RefObject<HTMLElement>;
  className?: string;
  damping?: number;
  stiffness?: number;
  numCopies?: number;
  velocityMapping?: VelocityMapping;
  parallaxClassName?: string;
  scrollerClassName?: string;
  parallaxStyle?: React.CSSProperties;
  scrollerStyle?: React.CSSProperties;
}

interface ScrollVelocityProps {
  paused?: boolean;
  scrollContainerRef?: React.RefObject<HTMLElement>;
  texts: React.ReactNode[];
  velocity?: number;
  className?: string;
  damping?: number;
  stiffness?: number;
  numCopies?: number;
  velocityMapping?: VelocityMapping;
  parallaxClassName?: string;
  scrollerClassName?: string;
  parallaxStyle?: React.CSSProperties;
  scrollerStyle?: React.CSSProperties;
}

function useElementWidth<T extends HTMLElement>(
  ref: React.RefObject<T | null>,
): number {
  const [width, setWidth] = useState(0);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new ResizeObserver(() => setWidth(el.offsetWidth));
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  return width;
}

function VelocityText({
  children,
  paused = false,
  baseVelocity = 0,
  scrollContainerRef,
  className = "",
  damping,
  stiffness,
  numCopies,
  velocityMapping,
  parallaxClassName,
  scrollerClassName,
  parallaxStyle,
  scrollerStyle,
}: VelocityTextProps) {
  const reduced = useReducedMotion();
  const viewRef = useRef<HTMLDivElement>(null),
    visible = useRef(true);
  const baseX = useMotionValue(0);
  const scrollOptions = scrollContainerRef
    ? { container: scrollContainerRef }
    : {};
  const { scrollY } = useScroll(scrollOptions);
  const scrollVelocity = useVelocity(scrollY);
  const smoothVelocity = useSpring(scrollVelocity, {
    damping: damping ?? 50,
    stiffness: stiffness ?? 400,
  });
  const velocityFactor = useTransform(
    smoothVelocity,
    velocityMapping?.input || [0, 1000],
    velocityMapping?.output || [0, 5],
    { clamp: false },
  );

  const copyRef = useRef<HTMLSpanElement>(null);
  const copyWidth = useElementWidth(copyRef);

  function wrap(min: number, max: number, v: number): number {
    const range = max - min;
    const mod = (((v - min) % range) + range) % range;
    return mod + min;
  }

  const x = useTransform(baseX, (v) => {
    if (copyWidth === 0) return "0px";
    return `${wrap(-copyWidth, 0, v)}px`;
  });

  const directionFactor = useRef<number>(1);
  useEffect(() => {
    const el = viewRef.current;
    if (!el || paused || reduced) return;
    let raf = 0,
      last = 0,
      alive = true;
    const tick = (now: number) => {
      raf = 0;
      if (!alive || document.hidden || !visible.current) return;
      const delta = last ? Math.min(now - last, 80) : 0;
      last = now;
      let moveBy = directionFactor.current * baseVelocity * (delta / 1000);
      const factor = velocityFactor.get();
      if (factor < 0) directionFactor.current = -1;
      else if (factor > 0) directionFactor.current = 1;
      moveBy += directionFactor.current * moveBy * factor;
      baseX.set(baseX.get() + moveBy);
      raf = requestAnimationFrame(tick);
    };
    const wake = () => {
      if (!raf && alive && !document.hidden && visible.current) {
        last = 0;
        raf = requestAnimationFrame(tick);
      }
    };
    const observer = new IntersectionObserver((entries) => {
      visible.current = entries.some((e) => e.isIntersecting);
      if (visible.current) wake();
      else {
        cancelAnimationFrame(raf);
        raf = 0;
        last = 0;
      }
    });
    observer.observe(el);
    document.addEventListener("visibilitychange", wake);
    wake();
    return () => {
      alive = false;
      cancelAnimationFrame(raf);
      observer.disconnect();
      document.removeEventListener("visibilitychange", wake);
    };
  }, [paused, reduced, baseVelocity, baseX, velocityFactor]);

  const spans = [];
  for (let i = 0; i < (numCopies ?? 6); i++) {
    spans.push(
      <span
        aria-hidden={i > 0 ? true : undefined}
        className={className}
        key={i}
        ref={i === 0 ? copyRef : null}
      >
        {children}&nbsp;
      </span>,
    );
  }

  return (
    <div ref={viewRef} className={parallaxClassName} style={parallaxStyle}>
      <motion.div className={scrollerClassName} style={{ x, ...scrollerStyle }}>
        {spans}
      </motion.div>
    </div>
  );
}

export const ScrollVelocity: React.FC<ScrollVelocityProps> = ({
  scrollContainerRef,
  texts = [],
  paused = false,
  velocity = 100,
  className = "",
  damping = 50,
  stiffness = 400,
  numCopies = 6,
  velocityMapping = { input: [0, 1000], output: [0, 5] },
  parallaxClassName = "parallax",
  scrollerClassName = "scroller",
  parallaxStyle,
  scrollerStyle,
}) => {
  return (
    <section>
      {texts.map((text, index) => (
        <VelocityText
          key={index}
          paused={paused}
          className={className}
          baseVelocity={index % 2 !== 0 ? -velocity : velocity}
          scrollContainerRef={scrollContainerRef}
          damping={damping}
          stiffness={stiffness}
          numCopies={numCopies}
          velocityMapping={velocityMapping}
          parallaxClassName={parallaxClassName}
          scrollerClassName={scrollerClassName}
          parallaxStyle={parallaxStyle}
          scrollerStyle={scrollerStyle}
        >
          {text}
        </VelocityText>
      ))}
    </section>
  );
};

export default ScrollVelocity;
