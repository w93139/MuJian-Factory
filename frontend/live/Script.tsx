"use client";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { Button, Field } from "@/concepts/ui";
import type { Artifact } from "@/lib/liveApi";
export default function Script({
  artifact: a,
  busy,
  save,
  intervene,
}: {
  artifact: Artifact;
  busy: boolean;
  save: (patch: Artifact) => Promise<void>;
  intervene: (mods: Artifact) => Promise<void>;
}) {
  const { canEdit } = useAuth();
  const [draft, setDraft] = useState<Artifact | null>(null),
    [idea, setIdea] = useState(""),
    [count, setCount] = useState(1),
    [error, setError] = useState("");
  const run = async (fn: () => Promise<void>) => {
    setError("");
    try {
      await fn();
    } catch (e) {
      setError(e instanceof Error ? e.message : "操作失败");
    }
  };
  const source = draft || a;
  return (
    <section className="script-view">
      <div className="stage-title">
        <h2>剧本</h2>
        {canEdit && !draft && (
          <Button
            secondary
            disabled={busy}
            onClick={() => setDraft(structuredClone(a))}
          >
            编辑剧本
          </Button>
        )}
      </div>
      {error && (
        <p role="alert" className="live-error">
          {error}
        </p>
      )}
      <div className="logline-card">
        <h3>故事梗概</h3>
        {draft ? (
          <Field label="故事梗概">
            <textarea
              value={source.logline || ""}
              onChange={(e) => setDraft({ ...source, logline: e.target.value })}
            />
          </Field>
        ) : (
          <p>{source.logline || "暂无梗概"}</p>
        )}
      </div>
      <details className="live-contract-note">
        <summary>故事方向与创作模式</summary>
        <p>
          梗概可编辑并保存。当前后端直接生成剧本；候选梗概选择确认、电影 movie
          与微剧 micro
          模式尚未实现，暂不可用。集数与快速短片时长仍按项目参数生效。
        </p>
        <button disabled>选择梗概并确认</button>
        <button disabled>电影 movie</button>
        <button disabled>微剧 micro</button>
      </details>
      {(source.episodes || []).map((ep: any, i: number) => (
        <article
          className="episode-script"
          key={ep.episode_id || ep.episode_number || i}
        >
          <h3>第 {ep.episode_number || i + 1} 集</h3>
          {draft ? (
            <>
              <Field label={`第 ${i + 1} 集标题`}>
                <input
                  value={ep.act_title || ep.title || ""}
                  onChange={(e) =>
                    setDraft({
                      ...source,
                      episodes: source.episodes?.map((v: any, j: number) =>
                        j === i ? { ...v, act_title: e.target.value } : v,
                      ),
                    })
                  }
                />
              </Field>
              <Field label={`第 ${i + 1} 集剧本`}>
                <textarea
                  rows={8}
                  value={ep.content || ""}
                  onChange={(e) =>
                    setDraft({
                      ...source,
                      episodes: source.episodes?.map((v: any, j: number) =>
                        j === i ? { ...v, content: e.target.value } : v,
                      ),
                    })
                  }
                />
              </Field>
            </>
          ) : (
            <>
              <h4>{ep.act_title || ep.title}</h4>
              <div className="script-text">{ep.content}</div>
            </>
          )}
        </article>
      ))}
      {draft && (
        <div className="actions">
          <Button
            disabled={busy}
            onClick={() =>
              void run(async () => {
                await save(draft);
                setDraft(null);
              })
            }
          >
            保存剧本
          </Button>
          <Button secondary disabled={busy} onClick={() => setDraft(null)}>
            取消
          </Button>
        </div>
      )}
      {a.new_episodes?.length > 0 && (
        <section className="continuation">
          <h3>续写草稿</h3>
          {a.new_episodes.map((ep: any, i: number) => (
            <article key={ep.episode_number || i}>
              <h4>{ep.act_title || ep.title}</h4>
              <p className="script-text">{ep.content}</p>
            </article>
          ))}
          {canEdit && (
            <div className="actions">
              <Button
                disabled={busy || !!draft}
                onClick={() =>
                  void run(() => intervene({ action: "confirm_continue" }))
                }
              >
                确认续写
              </Button>
              <Button
                secondary
                disabled={busy || !!draft}
                onClick={() =>
                  void run(() => intervene({ action: "delete_continue" }))
                }
              >
                舍弃续写
              </Button>
            </div>
          )}
        </section>
      )}
      {canEdit && !a.new_episodes?.length && (
        <details className="live-contract-note">
          <summary>智能续写</summary>
          <Field label="续写想法" hint="留空由模型构思">
            <textarea value={idea} onChange={(e) => setIdea(e.target.value)} />
          </Field>
          <Field label="续写集数">
            <input
              type="number"
              min={1}
              max={10}
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            />
          </Field>
          <Button
            disabled={
              busy ||
              !!draft ||
              !a.episodes?.length ||
              !Number.isInteger(count) ||
              count < 1 ||
              count > 10
            }
            onClick={() =>
              void run(() =>
                intervene({
                  action: "smart_continue",
                  episodes_to_add: count,
                  sequel_idea: idea,
                }),
              )
            }
          >
            生成续写草稿
          </Button>
        </details>
      )}
    </section>
  );
}
