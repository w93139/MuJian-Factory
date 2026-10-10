"use client";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { STAGES, statusLabel, type Status } from "./stages";
import { Button, Field } from "@/ui/controls";
import {
  continueWorkflow,
  executeStage,
  parseStreamEvents,
  stopProject,
  uploadArtifactImage,
} from "@/lib/workflowApi";
import {
  readProject,
  saveStage,
  runIntervention,
  mediaUrl,
  type Snapshot,
  type Artifact,
} from "@/lib/liveApi";
import { assetVersionLabel } from "@/components/stages/utils";
import Storyboard from "./Storyboard";
import Script from "./Script";
import ReadOnlyArtifacts from "@/components/ReadOnlyArtifacts";

function Assets({
  snapshot,
  stage,
  busy,
  save,
  intervene,
  refresh,
}: {
  snapshot: Snapshot;
  stage: string;
  busy: boolean;
  save: (a: Artifact) => Promise<void>;
  intervene: (a: Artifact) => Promise<void>;
  refresh: () => Promise<void>;
}) {
  const { canEdit } = useAuth(),
    [error, setError] = useState(""),
    [uploading, setUploading] = useState(false);
  const groups =
    stage === "character_design"
      ? ["characters", "settings"]
      : stage === "reference_generation"
        ? ["scenes"]
        : ["clips"];
  const a = snapshot.artifacts[stage] || {};
  const all = (snapshot.artifacts.storyboard?.episodes || []).flatMap(
    (ep) => ep.segments || [],
  );
  return (
    <div className="live-assets">
      {error && (
        <p role="alert" className="live-error">
          {error}
        </p>
      )}
      {groups.map((group) => (
        <section key={group}>
          <h3>
            {
              (
                {
                  characters: "角色",
                  settings: "场景",
                  scenes: "片段参考图",
                  clips: "视频片段",
                } as Record<string, string>
              )[group]
            }
          </h3>
          <div className="live-asset-grid">
            {(a[group] || []).map((item: any) => {
              const seg = all.find((s) => s.segment_id === item.id);
              const description =
                group === "scenes"
                  ? item.visual_prompt || item.description || ""
                  : item.description || "";
              const patch = async (values: Record<string, unknown>) => {
                setError("");
                try {
                  await save({ [group]: [{ id: item.id, ...values }] });
                } catch (e) {
                  setError(e instanceof Error ? e.message : "保存失败");
                }
              };
              return (
                <article
                  className="live-asset-card"
                  key={item.id}
                  data-asset-id={item.id}
                >
                  <h4>{item.name || item.id}</h4>
                  {seg && (
                    <p>
                      第{" "}
                      {seg.episode_number ||
                        snapshot.artifacts.storyboard?.episodes?.find((ep) =>
                          ep.segments?.some((s) => s.segment_id === item.id),
                        )?.episode_number}{" "}
                      集 · 片段 {seg.segment_number} · {seg.shots.length} 个镜头
                    </p>
                  )}
                  {item.selected ? (
                    group === "clips" ? (
                      <video controls src={mediaUrl(item.selected)} />
                    ) : (
                      <img
                        src={mediaUrl(item.selected)}
                        alt={item.name || "参考素材"}
                      />
                    )
                  ) : (
                    <div className="live-media-placeholder">暂无选中素材</div>
                  )}
                  {canEdit ? (
                    <Field label={`${item.name || item.id} 描述`}>
                      <textarea
                        key={description}
                        defaultValue={description}
                        disabled={busy || uploading}
                        onBlur={(e) => {
                          if (e.target.value !== description)
                            void patch({ description: e.target.value });
                        }}
                      />
                    </Field>
                  ) : (
                    <p>{description}</p>
                  )}
                  <Field label={`${item.name || item.id} 素材版本`}>
                    <select
                      value={item.selected || ""}
                      disabled={!canEdit || busy || uploading}
                      onChange={(e) => void patch({ selected: e.target.value })}
                    >
                      <option value="" disabled>
                        请选择版本
                      </option>
                      {Array.from(
                        new Set<string>([
                          ...(item.versions || []),
                          ...(item.selected ? [item.selected] : []),
                        ]),
                      ).map((v: string, i: number) => (
                        <option key={v} value={v}>
                          {assetVersionLabel(v, i)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  {item.error && (
                    <p role="alert" className="live-error">
                      {item.error}
                    </p>
                  )}
                  {canEdit && (
                    <div className="actions">
                      <Button
                        secondary
                        disabled={busy || uploading}
                        onClick={() =>
                          void intervene({
                            ["regenerate_" + group]: [item.id],
                          }).catch((e) => setError(e.message))
                        }
                      >
                        重新生成
                      </Button>
                      {group !== "clips" && (
                        <label className="button secondary">
                          上传替换
                          <input
                            aria-label={`上传 ${item.name || item.id}`}
                            type="file"
                            accept="image/*"
                            disabled={busy || uploading}
                            onChange={async (e) => {
                              const f = e.target.files?.[0];
                              if (!f) return;
                              setUploading(true);
                              setError("");
                              try {
                                await uploadArtifactImage(
                                  snapshot.session_id,
                                  stage,
                                  group,
                                  item.id,
                                  f,
                                );
                                await refresh();
                              } catch (e) {
                                setError(
                                  e instanceof Error ? e.message : "上传失败",
                                );
                              } finally {
                                setUploading(false);
                              }
                            }}
                          />
                        </label>
                      )}
                    </div>
                  )}
                </article>
              );
            })}
          </div>
          {!(a[group] || []).length && <p>暂无素材</p>}
        </section>
      ))}
    </div>
  );
}
export default function LiveWorkflow({ id }: { id: string }) {
  const { canEdit } = useAuth(),
    q = useSearchParams(),
    router = useRouter();
  const [snapshot, setSnapshot] = useState<Snapshot | null>(null),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState("");
  const mounted = useRef(true);
  const refresh = useCallback(async () => {
    const result = await readProject(id);
    if (mounted.current) setSnapshot(result);
  }, [id]);
  useEffect(() => {
    mounted.current = true;
    void refresh().catch((e) => setError(e.message));
    return () => {
      mounted.current = false;
    };
  }, [refresh]);
  const running = Object.values(snapshot?.status || {}).includes("running");
  useEffect(() => {
    if (!running || busy) return;
    const timer = setInterval(() => {
      void refresh().catch((e) => setError(e.message));
    }, 1500);
    return () => clearInterval(timer);
  }, [running, busy, refresh]);
  const stateLabel = (value: string) =>
    value === "failed" ? "执行失败" : statusLabel[value as Status] || "待开始";
  const selected = q.get("stage") || snapshot?.current_stage;
  const stage = STAGES.some((s) => s.id === selected)
    ? selected!
    : "script_generation";
  const action = async (fn: () => Promise<void>) => {
    if (!canEdit) throw new Error("当前为只读权限");
    if (busy) throw new Error("请等待当前操作完成");
    setBusy(true);
    setError("");
    setMessage("正在处理");
    try {
      await fn();
      setMessage("操作已完成");
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
      setMessage("");
      throw e;
    } finally {
      setBusy(false);
    }
  };
  const save = async (patch: Artifact) =>
    action(async () => {
      setSnapshot(await saveStage(id, stage, patch));
    });
  const intervention = async (mods: Artifact) =>
    action(async () => {
      setSnapshot(await runIntervention(id, stage, mods, setMessage));
    });
  const execute = async (target: string) => {
    const response = await executeStage(id, target);
    for await (const ev of parseStreamEvents(response)) {
      if (ev.type === "error")
        throw new Error(ev.content || ev.message || "生成失败");
      if (ev.type === "progress")
        setMessage(ev.message || ev.step_desc || "正在生成");
    }
    await refresh();
  };
  if (!snapshot)
    return (
      <section className="live-workflow">
        {error ? (
          <p role="alert" className="live-error">
            {error}
          </p>
        ) : (
          <p>正在读取项目</p>
        )}
        <Link href="/?view=projects">返回项目</Link>
      </section>
    );
  const art = snapshot.artifacts[stage] || {},
    current = STAGES.find((s) => s.id === stage)!;
  return (
    <section className="live-workflow">
      <div className="live-workflow-heading">
        <Link href="/?view=projects">返回项目</Link>
        <h1>
          {snapshot.artifacts.script_generation?.title ||
            snapshot.meta?.idea?.slice(0, 35) ||
            "创作项目"}
        </h1>
        <span>{canEdit ? "" : "只读展示"}</span>
      </div>
      <nav aria-label="创作阶段" className="live-stage-tabs">
        {STAGES.map((s, i) => (
          <Link
            aria-current={stage === s.id ? "step" : undefined}
            key={s.id}
            href={`/?session=${encodeURIComponent(id)}&stage=${s.id}`}
          >
            <b>{String(i + 1).padStart(2, "0")}</b>
            {s.short}
            <small>{stateLabel(snapshot.status[s.id])}</small>
          </Link>
        ))}
      </nav>
      <div className="live-status" aria-live="polite">
        {busy ? message : message || stateLabel(snapshot.status[stage])}
      </div>
      {(error || snapshot.error) && (
        <p role="alert" className="live-error">
          {error || snapshot.error}
        </p>
      )}
      {stage === "storyboard" ? (
        <Storyboard artifact={art} busy={busy || running} save={save} />
      ) : stage === "script_generation" ? (
        <Script
          artifact={art}
          busy={busy || running}
          save={save}
          intervene={intervention}
        />
      ) : [
          "character_design",
          "reference_generation",
          "video_generation",
        ].includes(stage) ? (
        <Assets
          snapshot={snapshot}
          stage={stage}
          busy={busy || running}
          save={save}
          intervene={intervention}
          refresh={refresh}
        />
      ) : (
        <ReadOnlyArtifacts value={art} />
      )}
      {canEdit && (
        <div className="live-stage-actions">
          <Button
            secondary
            disabled={busy || running}
            onClick={() => void action(() => execute(stage)).catch(() => {})}
          >
            {art && Object.keys(art).length
              ? "继续生成" + current.short
              : "生成" + current.short}
          </Button>
          {stage === snapshot.current_stage &&
            ["waiting", "completed"].includes(snapshot.status[stage]) &&
            stage !== "post_production" && (
              <Button
                disabled={busy || running}
                onClick={() =>
                  void action(async () => {
                    const next = await continueWorkflow(id);
                    if (next.status !== "ready" || !next.next_stage)
                      throw new Error("阶段尚未就绪，请先完成当前阶段");
                    router.push(
                      `/?session=${encodeURIComponent(id)}&stage=${next.next_stage}`,
                    );
                    await execute(next.next_stage);
                  }).catch(() => {})
                }
              >
                确认并继续
              </Button>
            )}
          {(busy || running) && (
            <Button
              secondary
              onClick={() =>
                void stopProject(id)
                  .then(refresh)
                  .catch((e) => setError(e.message))
              }
            >
              停止生成
            </Button>
          )}
          <Button
            secondary
            disabled={busy}
            onClick={() => void refresh().catch((e) => setError(e.message))}
          >
            刷新状态
          </Button>
        </div>
      )}
    </section>
  );
}
