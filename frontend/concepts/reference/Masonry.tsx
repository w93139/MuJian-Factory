"use client";

// Adapted from DavidHDev/react-bits, commit 63a008de65732d73010bd219d25d15c47739bb31.
// Copyright (c) 2026 David Haz; MIT + Commons Clause. See LICENSE.md and README.md.

import React, {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { gsap } from "gsap";

import "./Masonry.css";

const useMedia = (
  queries: string[],
  values: number[],
  defaultValue: number,
): number => {
  const get = useCallback(() => {
    if (typeof window === "undefined") return defaultValue;
    return (
      values[queries.findIndex((q) => matchMedia(q).matches)] ?? defaultValue
    );
  }, [queries, values, defaultValue]);

  const [value, setValue] = useState<number>(get);

  useEffect(() => {
    const mediaQueries = queries.map((q) => matchMedia(q));
    const handler = () => setValue(get);
    mediaQueries.forEach((query) => query.addEventListener("change", handler));
    return () =>
      mediaQueries.forEach((query) =>
        query.removeEventListener("change", handler),
      );
  }, [queries, get]);

  return value;
};

const useMeasure = <T extends HTMLElement>() => {
  const ref = useRef<T | null>(null);
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(([entry]) => {
      const { width, height } = entry.contentRect;
      setSize({ width, height });
    });
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);

  return [ref, size] as const;
};

const preloadImages = async (urls: string[]): Promise<void> => {
  await Promise.all(
    urls.map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image();
          img.src = src;
          img.onload = img.onerror = () => resolve();
        }),
    ),
  );
};

interface Item {
  id: string;
  img: string;
  url: string;
  height: number;
  label?: string;
  caption?: string;
}

interface GridItem extends Item {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface MasonryProps {
  items: Item[];
  ease?: string;
  duration?: number;
  stagger?: number;
  animateFrom?: "bottom" | "top" | "left" | "right" | "center" | "random";
  scaleOnHover?: boolean;
  hoverScale?: number;
  blurToFocus?: boolean;
  colorShiftOnHover?: boolean;
}

const mediaQueries = [
  "(min-width:1500px)",
  "(min-width:1000px)",
  "(min-width:600px)",
  "(min-width:400px)",
];
const columnCounts = [4, 3, 2, 2];

const Masonry: React.FC<MasonryProps> = ({
  items,
  ease = "power3.out",
  duration = 0.6,
  stagger = 0.05,
  animateFrom = "bottom",
  scaleOnHover = true,
  hoverScale = 0.95,
  blurToFocus = true,
  colorShiftOnHover = false,
}) => {
  const columns = useMedia(mediaQueries, columnCounts, 1);

  const [containerRef, { width }] = useMeasure<HTMLDivElement>();
  const [imagesReady, setImagesReady] = useState(false);

  const getInitialPosition = useCallback(
    (item: GridItem) => {
      const containerRect = containerRef.current?.getBoundingClientRect();
      if (!containerRect) return { x: item.x, y: item.y };

      let direction = animateFrom;

      if (animateFrom === "random") {
        const directions = ["top", "bottom", "left", "right"];
        direction = directions[
          Math.floor(Math.random() * directions.length)
        ] as typeof animateFrom;
      }

      switch (direction) {
        case "top":
          return { x: item.x, y: -200 };
        case "bottom":
          return { x: item.x, y: window.innerHeight + 200 };
        case "left":
          return { x: -200, y: item.y };
        case "right":
          return { x: window.innerWidth + 200, y: item.y };
        case "center":
          return {
            x: containerRect.width / 2 - item.w / 2,
            y: containerRect.height / 2 - item.h / 2,
          };
        default:
          return { x: item.x, y: item.y + 100 };
      }
    },
    [animateFrom, containerRef],
  );

  useEffect(() => {
    preloadImages(items.map((i) => i.img)).then(() => setImagesReady(true));
  }, [items]);

  const grid = useMemo<GridItem[]>(() => {
    if (!width) return [];

    const colHeights = new Array(columns).fill(0);
    const columnWidth = width / columns;

    return items.map((child) => {
      const col = colHeights.indexOf(Math.min(...colHeights));
      const x = columnWidth * col;
      const height = child.height / 2;
      const y = colHeights[col];

      colHeights[col] += height;

      return { ...child, x, y, w: columnWidth, h: height };
    });
  }, [columns, items, width]);

  const hasMounted = useRef(false);

  useLayoutEffect(() => {
    if (!imagesReady) return;

    grid.forEach((item, index) => {
      const selector = containerRef.current?.querySelector(
        `[data-key="${item.id}"]`,
      );
      if (!selector) return;
      const animationProps = {
        x: item.x,
        y: item.y,
        width: item.w,
        height: item.h,
      };

      if (!hasMounted.current) {
        const initialPos = getInitialPosition(item);
        const initialState = {
          opacity: 0,
          x: initialPos.x,
          y: initialPos.y,
          width: item.w,
          height: item.h,
          ...(blurToFocus && { filter: "blur(10px)" }),
        };

        gsap.fromTo(selector, initialState, {
          opacity: 1,
          ...animationProps,
          ...(blurToFocus && { filter: "blur(0px)" }),
          duration: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? 0
            : 0.35,
          ease: "power3.out",
          delay: index * stagger,
        });
      } else {
        gsap.to(selector, {
          ...animationProps,
          duration: window.matchMedia("(prefers-reduced-motion: reduce)")
            .matches
            ? 0
            : duration,
          ease: ease,
          overwrite: "auto",
        });
      }
    });

    hasMounted.current = true;
    const elements = containerRef.current?.querySelectorAll(".item-wrapper");
    return () => {
      if (elements) gsap.killTweensOf(elements);
    };
  }, [
    grid,
    imagesReady,
    stagger,
    animateFrom,
    blurToFocus,
    duration,
    ease,
    containerRef,
    getInitialPosition,
  ]);

  const handleMouseEnter = (e: React.MouseEvent, item: GridItem) => {
    const element = e.currentTarget as HTMLElement;
    const selector = containerRef.current?.querySelector(
      `[data-key="${item.id}"]`,
    );
    if (!selector) return;

    if (scaleOnHover) {
      gsap.to(selector, {
        scale: hoverScale,
        duration: 0.3,
        ease: "power2.out",
      });
    }

    if (colorShiftOnHover) {
      const overlay = element.querySelector(".color-overlay") as HTMLElement;
      if (overlay) {
        gsap.to(overlay, {
          opacity: 0.3,
          duration: 0.3,
        });
      }
    }
  };

  const handleMouseLeave = (e: React.MouseEvent, item: GridItem) => {
    const element = e.currentTarget as HTMLElement;
    const selector = containerRef.current?.querySelector(
      `[data-key="${item.id}"]`,
    );
    if (!selector) return;

    if (scaleOnHover) {
      gsap.to(selector, {
        scale: 1,
        duration: 0.3,
        ease: "power2.out",
      });
    }

    if (colorShiftOnHover) {
      const overlay = element.querySelector(".color-overlay") as HTMLElement;
      if (overlay) {
        gsap.to(overlay, {
          opacity: 0,
          duration: 0.3,
        });
      }
    }
  };

  return (
    <div
      ref={containerRef}
      className="rb-masonry"
      style={{ height: Math.max(0, ...grid.map((i) => i.y + i.h)) }}
    >
      {grid.map((item) => {
        return (
          <a
            key={item.id}
            data-key={item.id}
            className="item-wrapper"
            href={item.url}
            aria-label={item.label || "查看素材"}
            onMouseEnter={(e) => handleMouseEnter(e, item)}
            onMouseLeave={(e) => handleMouseLeave(e, item)}
          >
            <div
              className="item-img"
              style={{ backgroundImage: `url(${item.img})` }}
            >
              {colorShiftOnHover && (
                <div
                  className="color-overlay"
                  style={{
                    position: "absolute",
                    top: 0,
                    left: 0,
                    width: "100%",
                    height: "100%",
                    background:
                      "linear-gradient(45deg, rgba(255,0,150,0.5), rgba(0,150,255,0.5))",
                    opacity: 0,
                    pointerEvents: "none",
                    borderRadius: "8px",
                  }}
                />
              )}
              <div className="masonry-caption">
                <strong>{item.label}</strong>
                <small>{item.caption}</small>
              </div>
            </div>
          </a>
        );
      })}
    </div>
  );
};

export default Masonry;
