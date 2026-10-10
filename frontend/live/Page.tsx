"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowUpRight, Settings2 } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { WaveScene } from "@/concepts/MotionScenes";
import SpotlightCard from "@/concepts/reference/SpotlightCard";
import { Button, Field } from "@/concepts/ui";
import {
  STYLES,
  VIDEO_GENERATION_MODES,
  videoModeAbility,
  videoModeModelKey,
} from "@/config/models";
import {
  fetchApiModels,
  fetchAppConfig,
  fetchSessions,
  startProject,
  uploadProjectFile,
  deleteSession,
  type ApiModelOption,
} from "@/lib/workflowApi";
import { setSessionShowcase } from "@/lib/authApi";
import LiveWorkflow from "./Workflow";
const fields = [
  ["llm_model", "llm", "文本模型"],
  ["vlm_model", "vlm", "图片理解模型"],
  ["image_t2i_model", "t2i", "文生图模型"],
  ["image_it2i_model", "i2i", "图生图模型"],
] as const;
function Composer() {
  const router = useRouter();
  const [models, setModels] = useState<Record<string, ApiModelOption[]>>({}),
    [values, setValues] = useState<Record<string, string>>({}),
    [idea, setIdea] = useState(""),
    [file, setFile] = useState(""),
    [style, setStyle] = useState("realistic"),
    [ratio, setRatio] = useState("16:9"),
    [resolution, setResolution] = useState("720P"),
    [mode, setMode] = useState("first_frame"),
    [episodes, setEpisodes] = useState(1),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [expand, setExpand] = useState(true),
    [web, setWeb] = useState(false),
    [concurrent, setConcurrent] = useState(true);
  useEffect(() => {
    let active = true;
    void Promise.all([
      Promise.all(
        ["llm", "vlm", "t2i", "i2i", "video"].map(
          async (type) =>
            [type, await fetchApiModels({ modelType: type as "llm" })] as const,
        ),
      ),
      fetchAppConfig(),
    ])
      .then(([entries, config]) => {
        if (!active) return;
        const catalog = Object.fromEntries(entries);
        setModels(catalog);
        const defaults = config.config.models || {};
        const next: Record<string, string> = {};
        fields.forEach(([key, type]) => {
          const d =
            defaults[
              (
                {
                  llm_model: "llm",
                  vlm_model: "vlm",
                  image_t2i_model: "image_t2i",
                  image_it2i_model: "image_it2i",
                } as Record<string, string>
              )[key]
            ];
          next[key] = catalog[type]?.some((m) => m.id === d)
            ? d
            : catalog[type]?.[0]?.id || "";
        });
        VIDEO_GENERATION_MODES.forEach((m) => {
          const options = catalog.video.filter(
            (v) =>
              v.api_contract_verified &&
              v.adapter_ability_types?.includes(m.ability),
          );
          const d = defaults[m.modelKey.replace("_model", "")];
          next[m.modelKey] = options.some((v) => v.id === d)
            ? d
            : options[0]?.id || "";
        });
        setValues(next);
      })
      .catch((e) => setError(e.message));
    return () => {
      active = false;
    };
  }, []);
  const videoOptions = (models.video || []).filter(
    (m) =>
      m.api_contract_verified &&
      m.adapter_ability_types?.includes(videoModeAbility(mode)),
  );
  const video = videoOptions.find(
      (m) => m.id === values[videoModeModelKey(mode)],
    ),
    caps = video?.capabilities || {};
  const ratios: string[] = caps.ratios || ["16:9", "9:16", "1:1"],
    resolutions: string[] = caps.resolutions || ["720P", "1080P"];
  const allowed =
    fields.every(([key, type]) =>
      models[type]?.some((m) => m.id === values[key]),
    ) &&
    !!video &&
    ratios.includes(ratio) &&
    resolutions.includes(resolution);
  const start = async () => {
    if (busy) return;
    setError("");
    setBusy(true);
    try {
      const result = await startProject({
        idea,
        file_path: file || undefined,
        style,
        video_ratio: ratio,
        video_resolution: resolution,
        ...values,
        video_generation_mode: mode,
        episodes,
        expand_idea: expand,
        web_search: web,
        enable_concurrency: concurrent,
      });
      router.push(`/?session=${result.session_id}&stage=script_generation`);
    } catch (e) {
      setError(e instanceof Error ? e.message : "创建失败");
    } finally {
      setBusy(false);
    }
  };
  return (
    <SpotlightCard
      className="composer-light"
      spotlightColor="rgba(255, 255, 255, 0.09)"
    >
      <form
        className="composer"
        onSubmit={(e) => {
          e.preventDefault();
          void start();
        }}
      >
        <textarea
          aria-label="故事创意"
          rows={3}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="写下一段故事 让下一幕发生"
        />
        <div className="composer-toolbar">
          <details className="live-composer-options">
            <summary>
              <Settings2 size={16} /> 创作参数
            </summary>
            <div className="form-grid">
              <Field label="风格">
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                >
                  {STYLES.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="集数">
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={episodes}
                  onChange={(e) => setEpisodes(Number(e.target.value))}
                />
              </Field>
              <Field label="视频生成方式">
                <select value={mode} onChange={(e) => setMode(e.target.value)}>
                  {VIDEO_GENERATION_MODES.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="视频模型">
                <select
                  value={values[videoModeModelKey(mode)] || ""}
                  onChange={(e) =>
                    setValues({
                      ...values,
                      [videoModeModelKey(mode)]: e.target.value,
                    })
                  }
                >
                  <option value="" disabled>
                    选择模型
                  </option>
                  {videoOptions.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="画幅">
                <select
                  value={ratio}
                  onChange={(e) => setRatio(e.target.value)}
                >
                  {Array.from(new Set([ratio, ...ratios])).map((v) => (
                    <option key={v} disabled={!ratios.includes(v)}>
                      {v}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="分辨率">
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                >
                  {Array.from(new Set([resolution, ...resolutions])).map(
                    (v) => (
                      <option key={v} disabled={!resolutions.includes(v)}>
                        {v}
                      </option>
                    ),
                  )}
                </select>
              </Field>
              {fields.map(([key, type, label]) => (
                <Field key={key} label={label}>
                  <select
                    value={values[key] || ""}
                    onChange={(e) =>
                      setValues({ ...values, [key]: e.target.value })
                    }
                  >
                    <option value="" disabled>
                      选择模型
                    </option>
                    {(models[type] || []).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.label}
                      </option>
                    ))}
                  </select>
                </Field>
              ))}
            </div>
            <label>
              <input
                type="checkbox"
                checked={expand}
                onChange={(e) => setExpand(e.target.checked)}
              />
              扩展故事创意
            </label>
            <label>
              <input
                type="checkbox"
                checked={web}
                onChange={(e) => setWeb(e.target.checked)}
              />
              联网搜索（以文本模型能力为准）
            </label>
            <label>
              <input
                type="checkbox"
                checked={concurrent}
                onChange={(e) => setConcurrent(e.target.checked)}
              />
              并发生成
            </label>
            <Field label="导入文本">
              <input
                type="file"
                accept=".txt,.md,.pdf,.doc,.docx"
                disabled={busy}
                onChange={async (e) => {
                  const f = e.target.files?.[0];
                  if (!f) return;
                  setBusy(true);
                  try {
                    const result = await uploadProjectFile(f);
                    setFile(result.file_path || "");
                  } catch (e) {
                    setError(e instanceof Error ? e.message : "上传失败");
                  } finally {
                    setBusy(false);
                  }
                }}
              />
            </Field>
            {file && <p>文本已上传</p>}
          </details>
          <Button
            type="submit"
            disabled={
              busy ||
              (!idea.trim() && !file) ||
              !allowed ||
              !Number.isInteger(episodes) ||
              episodes < 1 ||
              episodes > 20
            }
          >
            {busy ? "正在创建" : "创建项目"}
            <ArrowUpRight size={16} />
          </Button>
        </div>
        {error && (
          <p role="alert" className="live-error">
            {error}
          </p>
        )}
        {!allowed && Object.keys(models).length > 0 && (
          <p>请选择模型支持的画幅与分辨率</p>
        )}
      </form>
    </SpotlightCard>
  );
}
export default function LivePage() {
  const q = useSearchParams(),
    { canEdit } = useAuth();
  const id = q.get("session");
  const [projects, setProjects] = useState<any[]>([]),
    [error, setError] = useState(""),
    [loading, setLoading] = useState(true);
  useEffect(() => {
    if (id) return;
    let active = true;
    setLoading(true);
    void fetchSessions()
      .then((p) => {
        if (active) setProjects(p);
      })
      .catch((e) => setError(e.message))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [id]);
  if (id) return <LiveWorkflow key={id} id={id} />;
  const projectsOnly = q.get("view") === "projects";
  return (
    <>
      {!projectsOnly && (
        <section className="wave-stage">
          <WaveScene />
          <div className="wave-hero-copy">
            <h1>
              故事的下一幕
              <br />
              由你想象
            </h1>
            {canEdit && (
              <div className="wave-input">
                <Composer />
              </div>
            )}
            <div className="starter-links">
              <Link href="/pipelines/standard">
                文艺短视频 <ArrowUpRight size={14} />
              </Link>
              <Link href="/sandbox">
                临时工作台 <ArrowUpRight size={14} />
              </Link>
            </div>
          </div>
        </section>
      )}
      <section className="live-projects">
        <div className="section-head">
          <h2>{canEdit ? "我的项目" : "示例作品"}</h2>
        </div>
        {error && (
          <p role="alert" className="live-error">
            {error}
          </p>
        )}
        {loading ? (
          <p>正在读取项目</p>
        ) : projects.length ? (
          <div className="live-project-grid">
            {projects.map((p) => (
              <article key={p.id}>
                <Link href={`/?session=${encodeURIComponent(p.id)}`}>
                  <h3>{p.title || p.idea?.slice(0, 60) || p.id}</h3>
                  <span>
                    {p.updated_at
                      ? new Date(Number(p.updated_at) * 1000).toLocaleString(
                          "zh-CN",
                        )
                      : p.date || ""}
                  </span>
                  <ArrowUpRight size={20} />
                </Link>
                {canEdit && (
                  <div className="actions">
                    <Button
                      secondary
                      onClick={() =>
                        void setSessionShowcase(p.id, !p.showcase)
                          .then(() =>
                            setProjects((v) =>
                              v.map((x) =>
                                x.id === p.id
                                  ? { ...x, showcase: !p.showcase }
                                  : x,
                              ),
                            ),
                          )
                          .catch((e) => setError(e.message))
                      }
                    >
                      {p.showcase ? "取消示例" : "设为示例"}
                    </Button>
                    <Button
                      secondary
                      onClick={() => {
                        if (window.confirm("删除这个项目及其生成文件？"))
                          void deleteSession(p.id)
                            .then(() =>
                              setProjects((v) =>
                                v.filter((x) => x.id !== p.id),
                              ),
                            )
                            .catch((e) => setError(e.message));
                      }}
                    >
                      删除项目
                    </Button>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p>暂无项目</p>
        )}
      </section>
    </>
  );
}
