"use client";
import { useEffect, useId, useRef, useState, type ReactNode } from "react";
import {
  Check,
  ChevronDown,
  Film,
  Image as ImageIcon,
  LayoutGrid,
  Maximize2,
  Minus,
  MousePointer2,
  Plus,
  RefreshCw,
  Workflow as WorkflowIcon,
} from "lucide-react";
import { useDemo } from "./context";
import { STAGES, type Asset, type Project, type StageId } from "./data";
import { Media } from "./ui";
import Dock from "./reference/Dock";
export function Popover({
  label,
  icon,
  children,
}: {
  label: string;
  icon?: ReactNode;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false),
    ref = useRef<HTMLDivElement>(null),
    id = useId();
  useEffect(() => {
    if (!open) return;
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        ref.current?.querySelector("button")?.focus();
      }
    };
    document.addEventListener("pointerdown", close);
    document.addEventListener("keydown", key);
    return () => {
      document.removeEventListener("pointerdown", close);
      document.removeEventListener("keydown", key);
    };
  }, [open]);
  return (
    <div className="parameter-popover" ref={ref}>
      <button
        type="button"
        className={open ? "parameter-trigger active" : "parameter-trigger"}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
      >
        {icon}
        <span>{label}</span>
        <ChevronDown size={12} />
      </button>
      {open && (
        <div id={id} className="parameter-panel">
          <div className="parameter-heading">{label}</div>
          {children}
          <button
            type="button"
            className="parameter-done"
            onClick={() => {
              setOpen(false);
              ref.current?.querySelector("button")?.focus();
            }}
          >
            <Check size={13} />
            完成设置
          </button>
        </div>
      )}
    </div>
  );
}
export function MiniBoard() {
  return (
    <div className="mini-board">
      <svg viewBox="0 0 620 220" aria-hidden="true">
        <path d="M155 105 C235 105 230 60 285 60 M155 105 C235 105 235 175 285 175 M405 60 C455 60 430 110 500 110 M405 175 C455 175 430 110 500 110" />
      </svg>
      <div className="mini-note">
        <span>01 / 剧本</span>
        <strong>一封来自故乡的信</strong>
        <p>在无声的太空里，他终于听见了熟悉的风。</p>
        <i>已确认</i>
      </div>
      <div className="mini-frame frame-one">
        <Media src="/ui/inspiration-space.png" alt="空间站分镜示例" />
        <small>02 / 参考画面</small>
      </div>
      <div className="mini-frame frame-two">
        <Media src="/ui/inspiration-mars.png" alt="火星分镜示例" />
        <small>03 / 另一幕</small>
      </div>
      <div className="mini-video">
        <Media src="/ui/inspiration-space.png" alt="视频节点示例" />
        <span>
          <Film size={12} />
          00:30
        </span>
      </div>
    </div>
  );
}
export function ProductionViewer({
  project: p,
  stage,
  onSelect,
}: {
  project: Project;
  stage: StageId;
  onSelect: (s: StageId) => void;
}) {
  const [shot, setShot] = useState(0);
  return (
    <div className="production-viewer">
      <div className="viewer-top">
        <span>
          <Film size={15} />
          镜头预览
        </span>
        <span>
          {p.video_ratio} · {p.video_resolution}
        </span>
      </div>
      <div className="viewer-image">
        <Media src={p.shots[shot]?.image || p.cover} alt="选中镜头预览" />
        <div className="viewer-caption">
          <b>{String(shot + 1).padStart(2, "0")}</b>
          <span>{p.shots[shot]?.content || p.logline}</span>
        </div>
      </div>
      <div className="filmstrip">
        {p.shots.map((s, i) => (
          <button
            key={s.id}
            aria-label={"预览镜头 " + s.shot_number}
            className={i === shot ? "active" : ""}
            onClick={() => setShot(i)}
          >
            <Media src={s.image} alt={"镜头 " + s.shot_number} />
            <span>
              {String(s.shot_number).padStart(2, "0")} · {s.duration}s
            </span>
          </button>
        ))}
        <button
          className="filmstrip-detail"
          onClick={() => onSelect("storyboard")}
        >
          <LayoutGrid size={20} />
          编辑分镜
        </button>
      </div>
      <div className="viewer-bottom">
        <span>{STAGES.find((s) => s.id === stage)?.name}</span>
        <small>选中画面与阶段产物关联</small>
      </div>
    </div>
  );
}
export function CanvasWorkspace({
  project: p,
  stage,
  onSelect,
  children,
}: {
  project: Project;
  stage: StageId;
  onSelect: (s: StageId, segment?: string) => void;
  children: ReactNode;
}) {
  const { canEdit, act } = useDemo();
  const [mode, setMode] = useState<"workflow" | "board">("workflow"),
    [zoom, setZoom] = useState(0.85),
    [episode, setEpisode] = useState(1);
  const fit = useRef(0.85);
  const viewport = useRef<HTMLDivElement>(null),
    drag = useRef<{ x: number; y: number; left: number; top: number } | null>(
      null,
    );
  useEffect(() => {
    const el = viewport.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      const next = Math.min(
        1,
        (el.clientWidth - 24) / 1430,
        (el.clientHeight - 24) / 540,
      );
      fit.current = next;
      setZoom(next);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, [mode]);
  const filtered = p.shots.filter((s) => s.episode_number === episode);
  const focusStage = (s: StageId, segment?: string) => {
    onSelect(s, segment);
    if (segment) return;
    requestAnimationFrame(() =>
      document.getElementById("canvas-detail")?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "start",
      }),
    );
  };
  return (
    <div className="canvas-workspace">
      <div className="canvas-toolbar">
        <div className="segmented">
          <button
            className={mode === "workflow" ? "active" : ""}
            onClick={() => setMode("workflow")}
          >
            <WorkflowIcon size={15} />
            工作流画布
          </button>
          <button
            className={mode === "board" ? "active" : ""}
            onClick={() => setMode("board")}
          >
            <LayoutGrid size={15} />
            故事板
          </button>
        </div>
        <div className="canvas-episodes">
          {p.episodes.map((e) => (
            <button
              key={e.episode_number}
              className={episode === e.episode_number ? "active" : ""}
              onClick={() => setEpisode(e.episode_number)}
            >
              第 {e.episode_number} 集
            </button>
          ))}
        </div>
        <span className="muted">
          {mode === "workflow"
            ? "拖动空白处平移 · 点击节点审阅"
            : "文本、参考图与视频对应审阅"}
        </span>
      </div>
      {mode === "workflow" ? (
        <div
          className="canvas-viewport"
          ref={viewport}
          onPointerDown={(e) => {
            if ((e.target as HTMLElement).closest("button")) return;
            drag.current = {
              x: e.clientX,
              y: e.clientY,
              left: e.currentTarget.scrollLeft,
              top: e.currentTarget.scrollTop,
            };
            e.currentTarget.setPointerCapture(e.pointerId);
          }}
          onPointerMove={(e) => {
            if (!drag.current) return;
            e.currentTarget.scrollLeft =
              drag.current.left - (e.clientX - drag.current.x);
            e.currentTarget.scrollTop =
              drag.current.top - (e.clientY - drag.current.y);
          }}
          onPointerUp={() => {
            drag.current = null;
          }}
          onPointerCancel={() => {
            drag.current = null;
          }}
        >
          <div
            className="node-space"
            style={{ width: 1430 * zoom, height: 540 * zoom }}
          >
            <div className="node-world" style={{ transform: `scale(${zoom})` }}>
              <svg
                className="node-connections"
                width="1430"
                height="540"
                aria-hidden="true"
              >
                <path d="M235 242 C310 242 280 165 350 165 M585 165 C655 165 640 285 700 285 M235 242 C320 242 595 445 700 445 M935 285 C1015 285 995 165 1070 165 M935 445 C1015 445 995 310 1070 310" />
              </svg>
              <button
                className={
                  "canvas-node note-node " +
                  (stage === "script_generation" ? "selected" : "")
                }
                style={{ left: 30, top: 155 }}
                onClick={() => focusStage("script_generation")}
              >
                <div className="node-label">
                  <span>01 / 剧本</span>
                  <i />
                </div>
                <h3>{p.title}</h3>
                <p>{p.logline}</p>
                <small>{p.episodes.length} 集 · 故事基础</small>
                <span className="node-port" />
              </button>
              <button
                className={
                  "canvas-node image-node " +
                  (stage === "character_design" ? "selected" : "")
                }
                style={{ left: 350, top: 55 }}
                onClick={() => focusStage("character_design")}
              >
                <div className="node-label">
                  <span>02 / 角色与场景</span>
                  <ImageIcon size={13} />
                </div>
                <Media
                  src={
                    p.assets.find((a) => a.kind === "character")?.selected ||
                    p.cover
                  }
                  alt="角色节点"
                />
                <small>
                  {p.assets.find((a) => a.kind === "character")?.name ||
                    "主角设计"}{" "}
                  · 素材版本
                </small>
                <span className="node-port" />
              </button>
              <button
                className={
                  "canvas-node image-node " +
                  (["storyboard", "reference_generation"].includes(stage)
                    ? "selected"
                    : "")
                }
                style={{ left: 700, top: 175 }}
                onClick={() =>
                  focusStage(
                    stage === "reference_generation"
                      ? "reference_generation"
                      : "storyboard",
                  )
                }
              >
                <div className="node-label">
                  <span>03 / 分镜与参考图</span>
                  <LayoutGrid size={13} />
                </div>
                <Media src={filtered[0]?.image || p.cover} alt="分镜节点" />
                <small>{filtered.length} 个镜头 · 点击编辑</small>
                <span className="node-port" />
              </button>
              <button
                className="canvas-node compact-node"
                style={{ left: 700, top: 390 }}
                onClick={() => focusStage("reference_generation")}
              >
                <ImageIcon size={17} />
                <div>
                  <strong>参考图版本</strong>
                  <small>保留每一次尝试</small>
                </div>
                <span className="node-port" />
              </button>
              <button
                className={
                  "canvas-node image-node " +
                  (stage === "video_generation" ? "selected" : "")
                }
                style={{ left: 1070, top: 55 }}
                onClick={() => focusStage("video_generation")}
              >
                <div className="node-label">
                  <span>05 / 视频片段</span>
                  <Film size={13} />
                </div>
                <Media src={filtered[0]?.image || p.cover} alt="视频片段节点" />
                <small>
                  片段 {String(filtered[0]?.shot_number || 1).padStart(2, "0")}{" "}
                  · {filtered[0]?.duration || 0}s
                </small>
                <span className="node-port" />
              </button>
              <button
                className={
                  "canvas-node compact-node " +
                  (stage === "post_production" ? "selected" : "")
                }
                style={{ left: 1070, top: 255 }}
                onClick={() => focusStage("post_production")}
              >
                <Film size={18} />
                <div>
                  <strong>06 / 后期成片</strong>
                  <small>
                    {p.final_videos.length} 集 · {p.video_resolution}
                  </small>
                </div>
                <Check size={14} />
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="linked-storyboard">
          <div className="board-column">
            <h3>
              片段文本 <b>{filtered.length}</b>
            </h3>
            {filtered.map((s) => (
              <article className="board-text" key={s.id}>
                <span>
                  镜头 {String(s.shot_number).padStart(2, "0")} · {s.duration}s
                </span>
                <h4>
                  {s.shot_type} / {s.location}
                </h4>
                <p>{s.content}</p>
                <button onClick={() => focusStage("storyboard", s.segment_id)}>
                  {canEdit ? "编辑分镜" : "查看分镜"} <ChevronDown size={12} />
                </button>
              </article>
            ))}
          </div>
          <div className="board-column">
            <h3>
              参考图 <ImageIcon size={15} />
            </h3>
            {filtered.map((s) => (
              <article className="board-image" key={s.id}>
                <span>镜头 {String(s.shot_number).padStart(2, "0")}</span>
                <Media
                  src={
                    p.assets.find(
                      (a) => a.id === s.segment_id && a.kind === "reference",
                    )?.selected || s.image
                  }
                  alt={"镜头 " + s.shot_number + "参考图"}
                />
                <small>
                  {p.video_ratio} · {p.video_resolution}
                </small>
                <BoardVersions
                  asset={p.assets.find(
                    (a) => a.id === s.segment_id && a.kind === "reference",
                  )}
                  canEdit={canEdit}
                  onSelect={(path) =>
                    act({
                      type: "asset",
                      id: p.session_id,
                      assetId: s.segment_id,
                      kind: "reference",
                      patch: { selected: path },
                    })
                  }
                />
                <button
                  onClick={() =>
                    focusStage("reference_generation", s.segment_id)
                  }
                >
                  查看版本
                </button>
              </article>
            ))}
          </div>
          <div className="board-column">
            <h3>
              视频片段 <Film size={15} />
            </h3>
            {filtered.map((s) => (
              <article className="board-image" key={s.id}>
                <span>片段 {String(s.shot_number).padStart(2, "0")}</span>
                <Media
                  src={
                    p.assets.find(
                      (a) => a.id === s.segment_id && a.kind === "clip",
                    )?.selected || s.image
                  }
                  video={
                    !!p.assets.find(
                      (a) => a.id === s.segment_id && a.kind === "clip",
                    )?.selected
                  }
                  alt={"镜头 " + s.shot_number + "视频"}
                />
                <small>计划 {s.duration}s · 示例媒体约 30s</small>
                <BoardVersions
                  asset={p.assets.find(
                    (a) => a.id === s.segment_id && a.kind === "clip",
                  )}
                  canEdit={canEdit}
                  onSelect={(path) =>
                    act({
                      type: "asset",
                      id: p.session_id,
                      assetId: s.segment_id,
                      kind: "clip",
                      patch: { selected: path },
                    })
                  }
                />
                <button
                  onClick={() => focusStage("video_generation", s.segment_id)}
                >
                  {canEdit ? "选择视频版本" : "查看视频版本"}
                </button>
              </article>
            ))}
          </div>
        </div>
      )}
      <div className="canvas-dock">
        <Dock
          baseItemSize={34}
          magnification={40}
          panelHeight={48}
          dockHeight={60}
          distance={100}
          items={[
            {
              icon: <MousePointer2 size={16} />,
              label: "适应画布",
              onClick: () => {
                setZoom(fit.current);
                if (viewport.current) {
                  viewport.current.scrollLeft = 0;
                  viewport.current.scrollTop = 0;
                }
              },
            },
            {
              icon: <Minus size={16} />,
              label: "缩小画布",
              onClick: () => setZoom((v) => Math.max(0.15, v - 0.1)),
            },
            {
              icon: <Plus size={16} />,
              label: "放大画布",
              onClick: () => setZoom((v) => Math.min(1.4, v + 0.1)),
            },
            {
              icon: <LayoutGrid size={16} />,
              label: "切换故事板",
              onClick: () =>
                setMode((v) => (v === "workflow" ? "board" : "workflow")),
            },
            {
              icon: <Maximize2 size={16} />,
              label: "查看阶段详情",
              onClick: () =>
                document.getElementById("canvas-detail")?.scrollIntoView({
                  behavior: window.matchMedia(
                    "(prefers-reduced-motion: reduce)",
                  ).matches
                    ? "auto"
                    : "smooth",
                }),
            },
          ]}
        />
        <span className="zoom-readout">{Math.round(zoom * 100)}%</span>
      </div>
      <section id="canvas-detail" className="canvas-detail">
        <div className="detail-label">
          <span>
            <RefreshCw size={13} />
            选中节点
          </span>
          <strong>{STAGES.find((s) => s.id === stage)?.name}</strong>
          <small>编辑、版本与执行</small>
        </div>
        {children}
      </section>
    </div>
  );
}

function BoardVersions({
  asset,
  canEdit,
  onSelect,
}: {
  asset?: Asset;
  canEdit: boolean;
  onSelect: (path: string) => void;
}) {
  return asset?.versions.length ? (
    <div className="board-versions" aria-label={asset.name + "版本"}>
      {asset.versions.map((v, i) => (
        <button
          key={v}
          aria-label={
            "故事板选择 " +
            asset.name +
            " " +
            (asset.kind === "clip" ? "视频" : "参考图") +
            " 版本 " +
            (i + 1)
          }
          aria-pressed={asset.selected === v}
          disabled={!canEdit}
          onClick={() => onSelect(v)}
        >
          {asset.kind === "clip" ? (
            <Film size={13} />
          ) : (
            <Media src={v} alt={"版本 " + (i + 1)} />
          )}
          <span>V{i + 1}</span>
        </button>
      ))}
    </div>
  ) : null;
}
