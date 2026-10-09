"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronRight,
  Clock3,
  Edit3,
  Film,
  Maximize2,
  Pause,
  Plus,
  RefreshCw,
  Save,
  Sparkles,
} from "lucide-react";
import { CanvasWorkspace, ProductionViewer } from "./design";
import { useDemo } from "./context";
import {
  STAGES,
  statusLabel,
  toWorkflowSnapshot,
  type Asset,
  type Episode,
  type Project,
  type Shot,
  type StageId,
} from "./data";
import {
  Badge,
  Button,
  Disclosure,
  DownloadLink,
  Empty,
  Field,
  Media,
  Modal,
  SaveMark,
  Upload,
} from "./ui";
function ScriptView({ project: p }: { project: Project }) {
  const { variant, canEdit, act, notify } = useDemo();
  const [editing, setEditing] = useState(false),
    [logline, setLogline] = useState(p.logline),
    [episodes, setEpisodes] = useState(p.episodes.map((e) => ({ ...e }))),
    [sequel, setSequel] = useState(""),
    [draft, setDraft] = useState<Episode | null>(null);
  const save = () => {
    if (
      !logline.trim() ||
      episodes.some((e) => !e.title.trim() || !e.content.trim())
    ) {
      notify("请填写故事梗概、剧集标题和内容。");
      return;
    }
    act({
      type: "patch-project",
      id: p.session_id,
      patch: { logline, episodes },
    });
    setEditing(false);
  };
  return (
    <div className="script-view">
      <div className="stage-title">
        <div>
          {variant !== "director" && (
            <p className="eyebrow">01 / STORY FOUNDATION</p>
          )}
          <h2>{variant === "director" ? "剧本" : "先让故事，站得住。"}</h2>
          {variant !== "director" && (
            <p>故事梗概与分集内容，是后续画面的共同起点。</p>
          )}
        </div>
        {canEdit && (
          <Button
            secondary
            onClick={() => {
              setEditing(!editing);
              setLogline(p.logline);
              setEpisodes(p.episodes.map((e) => ({ ...e })));
            }}
          >
            <Edit3 size={15} />
            {editing ? "取消编辑" : "编辑剧本"}
          </Button>
        )}
      </div>
      {!p.logline_confirmed && canEdit && (
        <div className="logline-choice">
          <h3>选择你的故事方向</h3>
          <p>先确定叙事重点，再进入角色与场景。</p>
          {[p.logline, "从人物的选择出发，让一个微小发现改变整个旅程。"].map(
            (line, i) => (
              <label key={i}>
                <input
                  type="radio"
                  name="logline"
                  checked={logline === line}
                  onChange={() => setLogline(line)}
                />
                {line}
              </label>
            ),
          )}
          <Button
            onClick={() =>
              act({
                type: "patch-project",
                id: p.session_id,
                patch: { logline, logline_confirmed: true },
              })
            }
          >
            <Check size={16} />
            确认故事方向
          </Button>
        </div>
      )}
      <div className="logline-card">
        <span className="eyebrow">
          {variant === "director" ? "故事梗概" : "故事梗概 / LOGLINE"}
        </span>
        {editing ? (
          <Field label="故事梗概">
            <textarea
              value={logline}
              onChange={(e) => setLogline(e.target.value)}
              rows={3}
            />
          </Field>
        ) : (
          <p>{p.logline}</p>
        )}
        <div className="tag-row">
          {variant !== "director" && <span>科幻 / 情感</span>}
          <span>{p.episodes.length} 集</span>
          <span>{p.video_ratio}</span>
        </div>
      </div>
      {(editing ? episodes : p.episodes).map((ep, i) => (
        <article className="episode-script" key={ep.episode_number}>
          <div className="episode-heading">
            <span>EP {String(ep.episode_number).padStart(2, "0")}</span>
            {editing ? (
              <Field label={"第 " + ep.episode_number + " 集标题"}>
                <input
                  value={ep.title}
                  onChange={(e) =>
                    setEpisodes(
                      episodes.map((v, j) =>
                        j === i ? { ...v, title: e.target.value } : v,
                      ),
                    )
                  }
                />
              </Field>
            ) : (
              <h3>{ep.title}</h3>
            )}
          </div>
          {editing ? (
            <Field label={"第 " + ep.episode_number + " 集剧本"}>
              <textarea
                rows={9}
                value={ep.content}
                onChange={(e) =>
                  setEpisodes(
                    episodes.map((v, j) =>
                      j === i ? { ...v, content: e.target.value } : v,
                    ),
                  )
                }
              />
            </Field>
          ) : (
            <div className="script-text">
              {ep.content
                .split("\n")
                .filter(Boolean)
                .map((line, j) => (
                  <p key={j}>{line}</p>
                ))}
            </div>
          )}
        </article>
      ))}
      {editing && (
        <div className="actions">
          <Button onClick={save}>
            <Save size={15} />
            保存剧本
          </Button>
          <Button secondary onClick={() => setEditing(false)}>
            取消
          </Button>
        </div>
      )}
      {canEdit && (
        <Disclosure title="续写下一集">
          <Field label="续写想法">
            <textarea
              value={sequel}
              onChange={(e) => setSequel(e.target.value)}
              placeholder="接下来，人物会遇到什么？"
              rows={2}
            />
          </Field>
          {draft ? (
            <div className="continuation">
              <h3>{draft.title}</h3>
              <p>{draft.content}</p>
              <div className="actions">
                <Button
                  onClick={() => {
                    act({
                      type: "patch-project",
                      id: p.session_id,
                      patch: { episodes: [...p.episodes, draft] },
                    });
                    setDraft(null);
                  }}
                >
                  确认续写
                </Button>
                <Button secondary onClick={() => setDraft(null)}>
                  舍弃草稿
                </Button>
              </div>
            </div>
          ) : (
            <Button
              secondary
              onClick={() => {
                if (!sequel.trim()) {
                  notify("请先填写续写想法。");
                  return;
                }
                setDraft({
                  episode_number: p.episodes.length + 1,
                  title: "新的旅程",
                  content:
                    sequel +
                    "\n\n这是根据输入整理的演示续写草稿。正式内容将在后续接入模型。",
                });
              }}
            >
              生成续写草稿（模拟）
            </Button>
          )}
        </Disclosure>
      )}
    </div>
  );
}
function Storyboard({
  project: p,
  focusSegment,
}: {
  project: Project;
  focusSegment?: string;
}) {
  const { variant, canEdit, act, notify } = useDemo();
  const [editing, setEditing] = useState<Shot | null>(null),
    [episode, setEpisode] = useState(
      p.shots.find((s) => s.segment_id === focusSegment)?.episode_number || 1,
    );
  useEffect(() => {
    if (!focusSegment) return;
    document.getElementById("shot-" + focusSegment)?.scrollIntoView({
      behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
        ? "auto"
        : "smooth",
      block: "center",
    });
  }, [focusSegment, episode]);
  const save = () => {
    if (!editing) return;
    if (
      !editing.content.trim() ||
      !Number.isFinite(editing.duration) ||
      editing.duration <= 0
    ) {
      notify("请填写镜头描述，时长必须大于零。");
      return;
    }
    act({
      type: "patch-project",
      id: p.session_id,
      patch: { shots: p.shots.map((s) => (s.id === editing.id ? editing : s)) },
    });
    setEditing(null);
  };
  return (
    <div>
      <div className="stage-title">
        <div>
          {variant !== "director" && <p className="eyebrow">03 / STORYBOARD</p>}
          <h2>
            {variant === "director" ? "分镜" : "每个镜头，都有它的位置。"}
          </h2>
          <p>按剧集组织分镜，参考图与视频通过片段关联。</p>
        </div>
      </div>
      <div className="episode-tabs">
        {p.episodes.map((e) => (
          <button
            key={e.episode_number}
            className={episode === e.episode_number ? "active" : ""}
            onClick={() => setEpisode(e.episode_number)}
          >
            第 {e.episode_number} 集 · {e.title}
          </button>
        ))}
      </div>
      <div className="storyboard-table">
        <div className="shot-table-header">
          <span>镜头</span>
          <span>景别 / 时长</span>
          <span>画面与叙事</span>
          <span />
        </div>
        {p.shots
          .filter((s) => s.episode_number === episode)
          .map((s) => (
            <article
              className={
                "shot-row " +
                (s.segment_id === focusSegment ? "linked-focus" : "")
              }
              id={"shot-" + s.segment_id}
              key={s.id}
            >
              <div className="shot-thumb">
                <Media
                  src={s.image}
                  alt={"分镜 " + s.shot_number + " 示意图"}
                />
                <b>{String(s.shot_number).padStart(2, "0")}</b>
              </div>
              <div>
                <strong>{s.shot_type}</strong>
                <span className="shot-duration">
                  <Clock3 size={12} />
                  {s.duration} 秒
                </span>
              </div>
              <div>
                <p>{s.content}</p>
                <small>
                  {s.location} · {s.characters.join("、")}
                </small>
              </div>
              {canEdit && (
                <button
                  className="icon-button"
                  aria-label={"编辑镜头 " + s.shot_number}
                  onClick={() => setEditing({ ...s })}
                >
                  <Edit3 size={15} />
                </button>
              )}
            </article>
          ))}
      </div>
      {!p.shots.some((s) => s.episode_number === episode) && (
        <Empty title="这一集还没有分镜" hint="添加镜头，为新的剧集组织画面。" />
      )}
      {canEdit && (
        <Button
          secondary
          className="add-shot"
          onClick={() => {
            const id = "segment-" + Date.now();
            const n =
              p.shots.filter((s) => s.episode_number === episode).length + 1;
            const shot: Shot = {
              id: "shot-" + id,
              segment_id: id,
              episode_number: episode,
              shot_number: n,
              shot_type: "中景",
              duration: 5,
              content: "一个新的故事画面，等待你补充细节。",
              image: p.cover,
              location: "待补充场景",
              characters: ["主角"],
            };
            const refs: Asset[] = (["reference", "clip"] as const).map(
              (kind) => ({
                id,
                name: "片段 " + n,
                description: shot.content,
                selected: "",
                versions: [],
                kind,
                status: "pending",
                episode,
              }),
            );
            act({
              type: "patch-project",
              id: p.session_id,
              patch: {
                shots: [...p.shots, shot],
                assets: [...p.assets, ...refs],
              },
            });
          }}
        >
          <Plus size={16} />
          添加镜头
        </Button>
      )}
      {editing && (
        <Modal title="编辑分镜" onClose={() => setEditing(null)}>
          <div className="form-grid">
            <Field label="景别">
              <select
                value={editing.shot_type}
                onChange={(e) =>
                  setEditing({ ...editing, shot_type: e.target.value })
                }
              >
                {["远景", "全景", "中景", "近景", "特写"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
            <Field label="时长（秒）">
              <input
                type="number"
                min={1}
                max={30}
                value={editing.duration}
                onChange={(e) =>
                  setEditing({ ...editing, duration: Number(e.target.value) })
                }
              />
            </Field>
          </div>
          <Field label="镜头描述">
            <textarea
              rows={5}
              value={editing.content}
              onChange={(e) =>
                setEditing({ ...editing, content: e.target.value })
              }
            />
          </Field>
          <div className="actions">
            <Button onClick={save}>保存分镜</Button>
            <Button secondary onClick={() => setEditing(null)}>
              取消
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
function AssetCard({
  project: p,
  asset: a,
  onPreview,
  focused = false,
}: {
  project: Project;
  asset: Asset;
  onPreview: (asset: Asset) => void;
  focused?: boolean;
}) {
  const { canEdit, act } = useDemo();
  const [editing, setEditing] = useState(false),
    [description, setDescription] = useState(a.description);
  const image = a.selected || a.versions[0];
  return (
    <article
      id={"asset-" + a.kind + "-" + a.id}
      className={
        "asset-card " +
        (focused ? "linked-focus " : "") +
        (a.status === "running" ? "is-running" : "")
      }
    >
      <div className="asset-media">
        {image ? (
          <Media src={image} alt={a.name + "预览"} video={a.kind === "clip"} />
        ) : (
          <div className="asset-placeholder">
            <Film size={30} />
            <span>等待生成</span>
          </div>
        )}
        {image && a.kind !== "clip" && (
          <button
            className="icon-button"
            aria-label={"放大 " + a.name}
            onClick={() => onPreview(a)}
          >
            <Maximize2 size={17} />
          </button>
        )}
        {a.status === "running" && (
          <div className="asset-progress">
            正在演示生成 · {Math.min(a.progress || 0, 100)}%
          </div>
        )}
      </div>
      <div className="asset-detail">
        <div className="asset-heading">
          <h3>{a.name}</h3>
          <span>
            {a.kind === "character"
              ? "角色"
              : a.kind === "setting"
                ? "场景"
                : "第 " + a.episode + " 集"}
          </span>
        </div>
        {editing ? (
          <Field label={a.name + "描述"}>
            <textarea
              rows={3}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
        ) : (
          <p>{a.description}</p>
        )}
        {a.error && <p className="inline-error">{a.error}</p>}
        <div className="asset-versions" aria-label={a.name + "版本列表"}>
          {a.versions.map((v, i) =>
            canEdit ? (
              <button
                aria-label={"选择 " + a.name + " 版本 " + (i + 1)}
                aria-pressed={a.selected === v}
                className={a.selected === v ? "selected" : ""}
                key={v + i}
                onClick={() =>
                  act({
                    type: "asset",
                    id: p.session_id,
                    kind: a.kind,
                    assetId: a.id,
                    patch: { selected: v },
                  })
                }
              >
                <span>V{String(i + 1).padStart(2, "0")}</span>
                {a.selected === v && <Check size={11} />}
              </button>
            ) : (
              <span className={a.selected === v ? "selected" : ""} key={v + i}>
                版本 {i + 1}
                {a.selected === v ? " · 已选" : ""}
              </span>
            ),
          )}
        </div>
        {canEdit && (
          <>
            <div className="asset-actions">
              {editing ? (
                <>
                  <button
                    onClick={() => {
                      act({
                        type: "asset",
                        id: p.session_id,
                        kind: a.kind,
                        assetId: a.id,
                        patch: { description },
                      });
                      setEditing(false);
                    }}
                  >
                    <Save size={13} />
                    保存描述
                  </button>
                  <button onClick={() => setEditing(false)}>取消</button>
                </>
              ) : (
                <button
                  onClick={() => {
                    setDescription(a.description);
                    setEditing(true);
                  }}
                >
                  <Edit3 size={13} />
                  编辑描述
                </button>
              )}
              <button
                disabled={a.status === "running"}
                onClick={() =>
                  act({
                    type: "regenerate",
                    id: p.session_id,
                    kind: a.kind,
                    assetId: a.id,
                  })
                }
              >
                <RefreshCw size={13} />
                {a.status === "failed" ? "重试素材" : "局部重生成"}
              </button>
            </div>
            {a.kind !== "clip" && (
              <details className="small-upload">
                <summary>上传替换素材</summary>
                <Upload
                  label={"上传 " + a.name}
                  onUpload={(url) =>
                    act({
                      type: "asset",
                      id: p.session_id,
                      kind: a.kind,
                      assetId: a.id,
                      patch: {},
                      upload: url,
                    })
                  }
                />
              </details>
            )}
          </>
        )}
      </div>
    </article>
  );
}
function AssetView({
  project: p,
  stage,
  focusSegment,
}: {
  project: Project;
  stage: StageId;
  focusSegment?: string;
}) {
  const { variant } = useDemo();
  const [preview, setPreview] = useState<Asset | null>(null),
    [episode, setEpisode] = useState(
      p.assets.find((a) => a.id === focusSegment)?.episode || 1,
    );
  const isChar = stage === "character_design",
    video = stage === "video_generation";
  useEffect(() => {
    if (!focusSegment) return;
    document
      .getElementById(
        "asset-" + (video ? "clip" : "reference") + "-" + focusSegment,
      )
      ?.scrollIntoView({
        behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches
          ? "auto"
          : "smooth",
        block: "center",
      });
  }, [focusSegment, video, episode]);
  const items = p.assets.filter((a) =>
    isChar
      ? ["character", "setting"].includes(a.kind)
      : a.kind === (video ? "clip" : "reference") && a.episode === episode,
  );
  return (
    <div>
      <div className="stage-title">
        <div>
          {variant !== "director" && (
            <p className="eyebrow">
              {isChar
                ? "02 / CAST & WORLD"
                : video
                  ? "05 / MOTION"
                  : "04 / FRAME REFERENCES"}
            </p>
          )}
          <h2>
            {variant === "director"
              ? isChar
                ? "角色与场景"
                : video
                  ? "视频片段"
                  : "参考图"
              : isChar
                ? "让故事，有自己的面孔。"
                : video
                  ? "让每个画面，开始呼吸。"
                  : "先找到，画面的感觉。"}
          </h2>
          {variant === "director" ? (
            !isChar && (
              <p>
                {video
                  ? "根据选中的参考图生成片段，已有版本会保留。"
                  : "选中的参考图版本将用于后续视频。"}
              </p>
            )
          ) : (
            <p>
              {isChar
                ? "角色与场景保持稳定，后续镜头才有一致的世界。"
                : video
                  ? "对应参考图生成片段，保留已有版本再尝试新表达。"
                  : "参考图按片段组织，每个选中版本会用于后续视频。"}
            </p>
          )}
        </div>
      </div>
      {!isChar && (
        <div className="episode-tabs">
          {p.episodes.map((e) => (
            <button
              key={e.episode_number}
              onClick={() => setEpisode(e.episode_number)}
              className={episode === e.episode_number ? "active" : ""}
            >
              第 {e.episode_number} 集 · {e.title}
            </button>
          ))}
        </div>
      )}
      {isChar && (
        <div className="asset-group-label">
          <span>角色与场景</span>
          <span>{items.length} 个素材</span>
        </div>
      )}
      <div className="asset-grid">
        {items.map((a) => (
          <AssetCard
            key={a.kind + a.id}
            project={p}
            asset={a}
            focused={a.id === focusSegment}
            onPreview={setPreview}
          />
        ))}
      </div>
      {!items.length && (
        <Empty title="本集暂无素材" hint="先完成分镜，再生成对应片段的素材。" />
      )}
      {preview && (
        <Modal
          title={preview.name + " · 素材预览"}
          onClose={() => setPreview(null)}
        >
          <Media
            src={preview.selected}
            alt={preview.name}
            video={preview.kind === "clip"}
          />
          <p>{preview.description}</p>
        </Modal>
      )}
    </div>
  );
}
function FinalView({ project: p }: { project: Project }) {
  const { variant } = useDemo();
  return (
    <div className="final-view">
      <div className="stage-title">
        <div>
          {variant !== "director" && (
            <p className="eyebrow">06 / THE FINAL CUT</p>
          )}
          <h2>{variant === "director" ? "成片" : "这一幕，终于成为故事。"}</h2>
          <p>按剧集查看成片。当前播放的是本地合成示例视频。</p>
        </div>
      </div>
      {p.final_videos.length ? (
        p.final_videos.map((v) => (
          <article className="final-film" key={v.episode}>
            <div className="film-heading">
              <h3>
                第 {v.episode} 集 · {v.name}
              </h3>
              <span>720P · 约 30 秒 · 预置媒体</span>
            </div>
            <Media video src={v.path} alt={"第 " + v.episode + " 集成片"} />
            <div className="film-bottom">
              <span>根据已有插画本地合成，不是本次 AI 生成结果</span>
              <DownloadLink src={v.path} label="下载本集示例" />
            </div>
          </article>
        ))
      ) : (
        <Empty
          title="成片正在等待上一阶段"
          hint="选好视频片段并确认后，即可演示成片。"
        />
      )}
    </div>
  );
}
export function Workflow({ project: p }: { project: Project }) {
  const { variant, canEdit, act } = useDemo(),
    router = useRouter(),
    q = useSearchParams();
  const requested = q.get("stage") as StageId;
  const stage = STAGES.some((s) => s.id === requested)
    ? requested
    : p.current_stage;
  const index = STAGES.findIndex((s) => s.id === stage),
    current = STAGES[index],
    status = p.status[stage];
  const following = useRef(true);
  const select = (id: StageId, segment?: string) => {
    following.current = false;
    router.push(
      "/?session=" +
        p.session_id +
        "&stage=" +
        id +
        (segment ? "&segment=" + segment : ""),
    );
  };
  const running = Object.values(p.status).includes("running");
  useEffect(() => {
    if (p.auto_mode && following.current && requested !== p.current_stage)
      router.replace("/?session=" + p.session_id + "&stage=" + p.current_stage);
  }, [p.auto_mode, p.current_stage, p.session_id, requested, router]);
  const stageNav = (
    <nav className="stage-navigation" aria-label="六阶段流程">
      {STAGES.map((s, i) => (
        <button
          key={s.id}
          aria-current={stage === s.id ? "step" : undefined}
          className={stage === s.id ? "active" : ""}
          onClick={() => select(s.id)}
        >
          <span className="stage-number">
            {p.status[s.id] === "completed" ? (
              <Check size={15} />
            ) : (
              String(i + 1).padStart(2, "0")
            )}
          </span>
          <span>
            <strong>{s.name}</strong>
            <small>
              {variant === "guided" ? s.hint : statusLabel[p.status[s.id]]}
            </small>
          </span>
          {stage === s.id && <ChevronRight size={14} />}
        </button>
      ))}
    </nav>
  );
  const stageContent = (
    <section className="stage-content">
      <div className="stage-status-row">
        <span>第 {index + 1} / 6 阶段</span>
        <Badge status={status} />
      </div>
      {status === "running" && (
        <div className="progress-panel" role="status">
          <Sparkles size={17} />
          <span>正在演示{current.name}，预置结果将在进度完成后呈现。</span>
          <b>{p.progress}%</b>
          <div className="progress-track">
            <i style={{ width: p.progress + "%" }} />
          </div>
        </div>
      )}
      {(status === "error" || status === "stopped") && (
        <div className="error-panel" role="alert">
          <h3>{status === "error" ? "生成遇到了一点问题" : "创作已暂停"}</h3>
          <p>{p.error || "已有文本与素材版本已保留，准备好后可以继续。"}</p>
        </div>
      )}
      {status === "pending" ? (
        <Empty
          title={current.name + "，等待开始"}
          hint={
            index === 0
              ? "从故事创意开始，先生成剧本。"
              : "请完成并确认上一阶段，再开始这一阶段。"
          }
        />
      ) : (
        <div key={p.session_id + stage + (q.get("segment") || "")}>
          {stage === "script_generation" ? (
            <ScriptView project={p} />
          ) : stage === "storyboard" ? (
            <Storyboard
              project={p}
              focusSegment={q.get("segment") || undefined}
            />
          ) : stage === "post_production" ? (
            <FinalView project={p} />
          ) : (
            <AssetView
              project={p}
              stage={stage}
              focusSegment={q.get("segment") || undefined}
            />
          )}
        </div>
      )}
      {canEdit && (
        <div className="stage-action-bar">
          <div>
            <small>
              {status === "waiting"
                ? "检查内容与选中版本，确认后进入下一阶段。"
                : status === "completed"
                  ? "已有结果已保存，可查看其他阶段或重新尝试。"
                  : status === "pending"
                    ? "前一阶段确认后即可开始。"
                    : "演示媒体为预置内容，不会产生模型费用。"}
            </small>
          </div>
          <div className="actions">
            {running ? (
              <Button
                secondary
                onClick={() => act({ type: "stop", id: p.session_id })}
              >
                <Pause size={15} />
                停止执行
              </Button>
            ) : (
              <>
                {status !== "pending" && (
                  <Button
                    secondary
                    onClick={() =>
                      act({
                        type: "run",
                        id: p.session_id,
                        stage,
                        auto: false,
                      })
                    }
                  >
                    <RefreshCw size={15} />
                    {status === "error"
                      ? "重试阶段"
                      : status === "stopped"
                        ? "继续执行"
                        : "重新执行阶段"}
                  </Button>
                )}
                {status === "pending" && (
                  <Button
                    disabled={
                      index > 0 &&
                      p.status[STAGES[index - 1].id] !== "completed"
                    }
                    onClick={() =>
                      act({
                        type: "run",
                        id: p.session_id,
                        stage,
                        auto: p.auto_mode,
                      })
                    }
                  >
                    开始这一阶段
                    <ArrowRight size={16} />
                  </Button>
                )}
                {["waiting", "completed"].includes(status) && index < 5 && (
                  <Button
                    onClick={() => {
                      if (act({ type: "confirm", id: p.session_id, stage }))
                        select(STAGES[index + 1].id);
                    }}
                  >
                    确认并继续
                    <ArrowRight size={16} />
                  </Button>
                )}
              </>
            )}
          </div>
        </div>
      )}
      <Disclosure title="查看结构化产物详情">
        <pre className="json-detail">
          {JSON.stringify(toWorkflowSnapshot(p).artifacts[stage], null, 2)}
        </pre>
      </Disclosure>
    </section>
  );
  return (
    <div className="workflow-page">
      <div className="project-page-head">
        <div>
          <Link href="/?view=projects" className="back-link">
            <ArrowLeft size={15} />
            返回项目
          </Link>
          <h1>{p.title}</h1>
          <p>
            {p.video_ratio} <i>·</i> {p.video_resolution} <i>·</i>{" "}
            {p.episodes.length} 集 <i>·</i> 演示创作
          </p>
        </div>
        <div className="actions">
          <SaveMark />
          {canEdit && (
            <label className="auto-toggle">
              <input
                type="checkbox"
                checked={p.auto_mode}
                onChange={(e) =>
                  act({
                    type: "patch-project",
                    id: p.session_id,
                    patch: { auto_mode: e.target.checked },
                  })
                }
              />
              自动执行
            </label>
          )}
          <Badge status={p.status[p.current_stage]} />
        </div>
      </div>
      {variant === "director" ? (
        <div className="agent-workflow-layout">
          <div className="agent-review-stream">{stageContent}</div>
          <aside className="agent-plan">
            <div className="plan-title">
              <Sparkles size={16} />
              制作流程
            </div>
            {stageNav}
            <div className="plan-summary">
              <span>
                {p.episodes.length} 集 / {p.shots.length} 镜
              </span>
            </div>
          </aside>
        </div>
      ) : variant === "guided" ? (
        <div className="production-workflow">
          <div className="production-stage-tabs">{stageNav}</div>
          <div className="production-editing">
            <aside className="production-context">
              <p className="eyebrow">PROJECT LIBRARY</p>
              <h3>制作档案</h3>
              <Media src={p.cover} alt={p.title + "封面"} />
              <p>{p.logline}</p>
              <div className="production-stage-list">
                {STAGES.map((s, i) => (
                  <button
                    key={s.id}
                    className={stage === s.id ? "active" : ""}
                    onClick={() => select(s.id)}
                  >
                    <span>{String(i + 1).padStart(2, "0")}</span>
                    {s.short}
                    <Badge status={p.status[s.id]} />
                  </button>
                ))}
              </div>
            </aside>
            <div className="production-editor">
              <ProductionViewer project={p} stage={stage} onSelect={select} />
              {stageContent}
            </div>
          </div>
        </div>
      ) : (
        <>
          <div className="canvas-stage-tabs">{stageNav}</div>
          <CanvasWorkspace project={p} stage={stage} onSelect={select}>
            {stageContent}
          </CanvasWorkspace>
        </>
      )}
    </div>
  );
}
