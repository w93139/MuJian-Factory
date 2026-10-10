"use client";
import { useState } from "react";
import { Plus, Save, Trash2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { Button, Field } from "@/ui/controls";
import { shotDescription, withShotDescription } from "@/lib/liveApi";
import type { Artifact, Episode, Segment, Shot } from "@/lib/liveApi";

export default function Storyboard({
  artifact,
  busy,
  save,
}: {
  artifact: Artifact;
  busy: boolean;
  save: (patch: Artifact) => Promise<void>;
}) {
  const { canEdit } = useAuth();
  const [draft, setDraft] = useState<Episode[] | null>(null);
  const [base, setBase] = useState<Artifact | null>(null);
  const [error, setError] = useState("");
  const episodes = draft || artifact.episodes || [];
  const edit = (change: (value: Episode[]) => void) =>
    setDraft((current) => {
      const next = structuredClone(current || episodes);
      change(next);
      return next;
    });
  const segmentEdit = (ei: number, si: number, change: (s: Segment) => void) =>
    edit((e) => change(e[ei].segments[si]));
  const shotEdit = (ei: number, si: number, hi: number, patch: Partial<Shot>) =>
    segmentEdit(ei, si, (s) => {
      Object.assign(s.shots[hi], patch);
      s.total_duration = s.shots.reduce(
        (sum, h) => sum + Number(h.duration || 0),
        0,
      );
    });
  const newShot = (s: Segment) => {
    s.shots.push({
      shot_id: crypto.randomUUID(),
      shot_number: Math.max(0, ...s.shots.map((h) => h.shot_number)) + 1,
      shot_type: "中景",
      duration: 3,
      content: "",
    });
    s.total_duration = s.shots.reduce(
      (sum, h) => sum + Number(h.duration || 0),
      0,
    );
  };
  const addSegment = (ei: number) =>
    edit((e) => {
      const ep = e[ei];
      const s: Segment = {
        segment_id: crypto.randomUUID(),
        segment_number:
          Math.max(0, ...ep.segments.map((s) => s.segment_number)) + 1,
        episode_number: ep.episode_number,
        location: "",
        characters: [],
        shots: [],
      };
      newShot(s);
      ep.segments.push(s);
    });
  const submit = async () => {
    if (!draft || !base) return;
    if (
      draft.some((ep) =>
        ep.segments.some((s) =>
          s.shots.some(
            (h) =>
              !shotDescription(h).trim() ||
              !Number.isFinite(Number(h.duration)) ||
              Number(h.duration) <= 0,
          ),
        ),
      )
    ) {
      setError("请填写全部镜头描述，并设置大于零的时长");
      return;
    }
    setError("");
    try {
      await save({
        episodes: draft,
        expected_storyboard: base,
        user_modified: true,
      });
      setDraft(null);
      setBase(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "保存失败");
    }
  };
  return (
    <section className="live-storyboard">
      <div className="stage-title">
        <div>
          <h2>分镜</h2>
          <p>剧集 · 片段 · 镜头　参考图与视频按片段关联</p>
        </div>
        {canEdit && !draft && (
          <Button
            secondary
            disabled={busy}
            onClick={() => {
              setBase(structuredClone(artifact));
              setDraft(structuredClone(artifact.episodes || []));
              setError("");
            }}
          >
            编辑分镜
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="live-error">
          {error}
        </p>
      )}
      <fieldset disabled={busy} className="live-fields">
        {episodes.map((ep, ei) => (
          <article
            className="episode-script"
            key={ep.episode_id || ep.episode_number}
            data-testid="storyboard-episode"
          >
            <div className="episode-heading">
              <h3>第 {ep.episode_number} 集</h3>
              {draft ? (
                <Field label={`第 ${ep.episode_number} 集标题`}>
                  <input
                    value={ep.episode_title || ""}
                    onChange={(e) =>
                      edit((v) => {
                        v[ei].episode_title = e.target.value;
                      })
                    }
                  />
                </Field>
              ) : (
                <span>{ep.episode_title}</span>
              )}
              {draft && (
                <Button
                  secondary
                  label={`删除第 ${ep.episode_number} 集`}
                  onClick={() =>
                    edit((v) => {
                      v.splice(ei, 1);
                    })
                  }
                >
                  <Trash2 size={16} />
                </Button>
              )}
            </div>
            {ep.segments.map((seg, si) => (
              <section
                key={seg.segment_id}
                className="live-segment"
                data-segment-id={seg.segment_id}
              >
                <div className="live-segment-head">
                  <h4>片段 {seg.segment_number}</h4>
                  <span>
                    {seg.shots.reduce(
                      (sum, h) => sum + Number(h.duration || 0),
                      0,
                    )}{" "}
                    秒 · {seg.shots.length} 个镜头
                  </span>
                  {draft && (
                    <Button
                      secondary
                      label={`删除片段 ${seg.segment_number}`}
                      onClick={() =>
                        edit((v) => {
                          v[ei].segments.splice(si, 1);
                        })
                      }
                    >
                      <Trash2 size={15} />
                    </Button>
                  )}
                </div>
                {draft ? (
                  <div className="form-grid">
                    <Field label={`片段 ${seg.segment_number} 地点`}>
                      <input
                        value={seg.location || ""}
                        onChange={(e) =>
                          segmentEdit(ei, si, (s) => {
                            s.location = e.target.value;
                          })
                        }
                      />
                    </Field>
                    <Field
                      label={`片段 ${seg.segment_number} 人物`}
                      hint="用顿号分隔"
                    >
                      <input
                        value={(seg.characters || []).join("、")}
                        onChange={(e) =>
                          segmentEdit(ei, si, (s) => {
                            s.characters = e.target.value
                              .split("、")
                              .filter(Boolean);
                          })
                        }
                      />
                    </Field>
                  </div>
                ) : (
                  <p>
                    {seg.location} {(seg.characters || []).join("、")}
                  </p>
                )}
                <div className="live-shot-table">
                  {seg.shots.map((shot, hi) => (
                    <div
                      className="live-shot"
                      key={shot.shot_id || shot.shot_number}
                      data-testid="storyboard-shot"
                    >
                      <strong>镜头 {shot.shot_number}</strong>
                      {draft ? (
                        <>
                          <Field label={`镜头 ${shot.shot_number} 景别`}>
                            <input
                              list="shot-types"
                              value={shot.shot_type || ""}
                              onChange={(e) =>
                                shotEdit(ei, si, hi, {
                                  shot_type: e.target.value,
                                })
                              }
                            />
                          </Field>
                          <Field label={`镜头 ${shot.shot_number} 时长`}>
                            <input
                              type="number"
                              min="0.1"
                              step="0.1"
                              value={shot.duration}
                              onChange={(e) =>
                                shotEdit(ei, si, hi, {
                                  duration: Number(e.target.value),
                                })
                              }
                            />
                          </Field>
                          <Field label={`镜头 ${shot.shot_number} 描述`}>
                            <textarea
                              rows={2}
                              value={shotDescription(shot)}
                              onChange={(e) =>
                                shotEdit(
                                  ei,
                                  si,
                                  hi,
                                  withShotDescription(shot, e.target.value),
                                )
                              }
                            />
                          </Field>
                          <Button
                            secondary
                            disabled={seg.shots.length <= 1}
                            label={
                              seg.shots.length <= 1
                                ? "最后一个镜头请删除整个片段"
                                : `删除镜头 ${shot.shot_number}`
                            }
                            onClick={() =>
                              segmentEdit(ei, si, (s) => {
                                s.shots.splice(hi, 1);
                                s.total_duration = s.shots.reduce(
                                  (sum, h) => sum + Number(h.duration || 0),
                                  0,
                                );
                              })
                            }
                          >
                            <Trash2 size={15} />
                          </Button>
                        </>
                      ) : (
                        <>
                          <span>{shot.shot_type}</span>
                          <span>{shot.duration} 秒</span>
                          <p>{shotDescription(shot)}</p>
                        </>
                      )}
                    </div>
                  ))}
                </div>
                {draft && (
                  <Button
                    secondary
                    onClick={() => segmentEdit(ei, si, newShot)}
                  >
                    <Plus size={15} />
                    添加镜头到片段 {seg.segment_number}
                  </Button>
                )}
              </section>
            ))}
            {draft && (
              <Button secondary onClick={() => addSegment(ei)}>
                <Plus size={15} />
                添加片段到第 {ep.episode_number} 集
              </Button>
            )}
          </article>
        ))}
        {!episodes.length && <p className="empty-state">暂无分镜</p>}
        {draft && (
          <div className="actions">
            <Button
              secondary
              onClick={() =>
                edit((e) =>
                  e.push({
                    episode_id: crypto.randomUUID(),
                    episode_number:
                      Math.max(0, ...e.map((v) => v.episode_number)) + 1,
                    episode_title: "新剧集",
                    segments: [],
                  }),
                )
              }
            >
              <Plus size={16} />
              添加剧集
            </Button>
            <Button disabled={busy} onClick={() => void submit()}>
              <Save size={16} />
              保存分镜
            </Button>
            <Button
              secondary
              onClick={() => {
                setDraft(null);
                setError("");
              }}
            >
              取消编辑
            </Button>
          </div>
        )}
      </fieldset>
      <datalist id="shot-types">
        {["远景", "全景", "中景", "近景", "过肩近景", "特写"].map((t) => (
          <option key={t}>{t}</option>
        ))}
      </datalist>
    </section>
  );
}
