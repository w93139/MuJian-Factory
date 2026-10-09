"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { ArrowRight, Film, Play, Sparkles, Star, Trash2 } from "lucide-react";
import { Popover } from "./design";
import { useDemo } from "./context";
import {
  PIPELINES,
  SPACE,
  TOOLS,
  VIDEO,
  type Pipeline,
  type Task,
  type Tool,
} from "./data";
import {
  Badge,
  Button,
  Disclosure,
  DownloadLink,
  Empty,
  Field,
  Media,
  ModelSelect,
  SectionHead,
  Upload,
} from "./ui";
function TaskResult({ task }: { task?: Task }) {
  return (
    <div className="result-panel">
      <div className="result-header">
        <span>
          <Film size={16} />
          结果预览
        </span>
        {task && <Badge status={task.status} />}
      </div>
      {!task ? (
        <div className="result-placeholder">
          <div className="preview-still">
            <Media src={SPACE} alt="示例画面" />
            <span>
              <Play size={28} />
            </span>
          </div>
          <h3>你的下一次创作，正在这里等你。</h3>
          <p>填写参数后开始演示，或从历史中选择已有结果。</p>
        </div>
      ) : (
        <>
          <div className="result-title">
            <h3>{task.title}</h3>
            <small>演示任务 · 预置结果</small>
          </div>
          {task.status === "running" || task.status === "pending" ? (
            <div className="task-progress">
              <Sparkles size={30} />
              <h3>正在演示生成</h3>
              <p>进度完成后呈现预置结果，不调用真实模型。</p>
              <div className="progress-track">
                <i style={{ width: task.progress + "%" }} />
              </div>
              <strong>{task.progress}%</strong>
            </div>
          ) : task.status === "error" ? (
            <Empty title="任务失败" hint={task.error || "稍后可以重新提交。"} />
          ) : (
            <div className="result-output">
              {task.output.video ? (
                <>
                  <Media
                    video
                    src={task.output.video}
                    alt={task.title + "视频"}
                  />
                  <DownloadLink src={task.output.video} />
                </>
              ) : task.output.image ? (
                <>
                  <Media src={task.output.image} alt={task.title + "图片"} />
                  <a
                    className="button secondary"
                    download="幕间-示例图片.png"
                    href={task.output.image}
                  >
                    下载示例图片
                  </a>
                </>
              ) : (
                <div className="text-result">
                  <p>{task.output.text}</p>
                </div>
              )}
              <p className="media-disclaimer">
                结果采用预置文本或媒体；参数修改会保存为任务输入，正式生成将在后续对接。
              </p>
            </div>
          )}
          <Disclosure title="查看任务输入">
            <pre className="json-detail">
              {JSON.stringify(task.input, null, 2)}
            </pre>
          </Disclosure>
        </>
      )}
    </div>
  );
}
export function ToolPage({ pipeline }: { pipeline?: Pipeline }) {
  const { state, variant, tasks, canEdit, act, notify } = useDemo(),
    router = useRouter(),
    q = useSearchParams();
  const [tool, setTool] = useState<Tool>("llm"),
    [text, setText] = useState(""),
    [mode, setMode] = useState("copy"),
    [videoMode, setVideoMode] = useState("image_concat"),
    [ratio, setRatio] = useState(state.settings.ratio),
    [resolution, setResolution] = useState(state.settings.resolution),
    [style, setStyle] = useState("中国水墨"),
    [voice, setVoice] = useState("zh-CN-YunjianNeural"),
    [speed, setSpeed] = useState("1"),
    [segments, setSegments] = useState("4"),
    [duration, setDuration] = useState("5"),
    [subtitles, setSubtitles] = useState(false),
    [template, setTemplate] = useState("minimal"),
    [negative, setNegative] = useState(""),
    [image, setImage] = useState(""),
    [motion, setMotion] = useState(""),
    [goodsImage, setGoodsImage] = useState(""),
    [goodsTitle, setGoodsTitle] = useState(""),
    [models, setModels] = useState({ ...state.settings.models }),
    [temperature, setTemperature] = useState("0.7"),
    [web, setWeb] = useState(state.settings.web_search);
  const definition = PIPELINES.find((p) => p.id === pipeline);
  const title = definition?.name || "临时工作台";
  const history = tasks.filter((t) =>
    pipeline ? t.pipeline === pipeline : !!t.tool,
  );
  const selected = history.find((t) => t.task_id === q.get("task"));
  const route = definition?.route || "/sandbox";
  const sample = () => {
    setImage(SPACE);
    setMotion(VIDEO);
    setGoodsImage("/ui/inspiration-ink.png");
    setGoodsTitle("山间茶");
    setText(
      pipeline === "action_transfer"
        ? "角色复现参考视频中的动作，保持人物外观一致。"
        : pipeline === "digital_human"
          ? "一杯茶，让日常慢下来。来自山间的清香，陪伴每一个平凡的早晨。"
          : "听山间的风，慢下来。让一封信带我们重新发现故乡。",
    );
    notify("已填入示例素材与文案，可开始演示。");
  };
  const submit = () => {
    if (!text.trim()) {
      notify(
        "请先填写" +
          (pipeline === "digital_human" ? "口播文案" : "文字内容或提示词") +
          "。",
      );
      return;
    }
    if (
      (pipeline === "action_transfer" ||
        pipeline === "digital_human" ||
        (!pipeline && ["vlm", "i2i"].includes(tool))) &&
      !image
    ) {
      notify("请先上传所需图片，或使用示例素材。");
      return;
    }
    if (pipeline === "action_transfer" && !motion) {
      notify("请上传动作参考视频，或使用示例素材。");
      return;
    }
    if (
      pipeline === "standard" &&
      (!Number.isFinite(Number(segments)) ||
        Number(segments) < 1 ||
        Number(segments) > 20)
    ) {
      notify("画面或段落数量请输入 1–20。");
      return;
    }
    if (
      !pipeline &&
      tool === "llm" &&
      (!Number.isFinite(Number(temperature)) ||
        Number(temperature) < 0 ||
        Number(temperature) > 2)
    ) {
      notify("创意强度请输入 0–2。");
      return;
    }
    if (
      !Number.isFinite(Number(duration)) ||
      Number(duration) < 1 ||
      Number(duration) > 15
    ) {
      notify("片段时长请输入 1–15 秒。");
      return;
    }
    let input: Record<string, unknown> = {};
    if (pipeline === "standard")
      input = {
        text,
        mode,
        title: text.slice(0, 20),
        n_scenes: Number(segments),
        ...(mode === "inspiration" ? { segment_count: Number(segments) } : {}),
        llm_model: models.llm,
        image_model: models.t2i,
        ...(videoMode === "dynamic_video"
          ? { video_model: models.video, video_duration: Number(duration) }
          : {}),
        video_mode: videoMode,
        generate_videos: videoMode === "dynamic_video",
        generate_audio: true,
        video_ratio: ratio,
        image_resolution: "1080P",
        video_resolution: resolution,
        style_control: style,
        tts_voice: voice,
        tts_speed: Number(speed),
        enable_subtitles: subtitles,
        subtitle_render_mode: "postprocess",
        subtitle_template: subtitles ? template : undefined,
        template_media_kind: "image",
      };
    else if (pipeline === "action_transfer")
      input = {
        prompt_text: text,
        image_path: image,
        video_path: motion,
        video_model: models.video,
        duration: Number(duration),
        video_ratio: ratio,
        video_resolution: resolution,
        negative_prompt: negative,
      };
    else if (pipeline === "digital_human")
      input = {
        mode: "customize",
        character_image_path: image,
        goods_image_path: goodsImage || undefined,
        goods_title: goodsTitle,
        goods_text: text,
        llm_model: models.llm,
        image_model: models.t2i,
        video_model: models.video,
        duration: Number(duration),
        video_ratio: ratio,
        video_resolution: resolution,
        tts_voice: voice,
        tts_speed: Number(speed),
      };
    else
      input = {
        model: models[tool],
        prompt: text,
        ...(tool === "vlm"
          ? { images: [image] }
          : tool === "i2i"
            ? { image, ratio, resolution }
            : tool === "video"
              ? { image: image || undefined, ratio, resolution }
              : tool === "llm"
                ? { temperature: Number(temperature), web_search: web }
                : { ratio, style, resolution }),
      };
    const id = act({
      type: "task",
      pipeline,
      tool: pipeline ? undefined : tool,
      title: pipeline
        ? title + " · " + text.slice(0, 16)
        : TOOLS.find((t) => t.id === tool)?.name + " · " + text.slice(0, 16),
      input,
    });
    if (id) router.push(route + "?task=" + id);
  };
  const uploadRequired =
    pipeline === "action_transfer" ||
    pipeline === "digital_human" ||
    (!pipeline && ["vlm", "i2i"].includes(tool));
  const inputPanel = canEdit && (
    <form
      className="tool-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      <div className="form-intro">
        <span className="step-label">01 / 输入与配置</span>
        <h2>
          {pipeline ? "准备好你的素材" : TOOLS.find((t) => t.id === tool)?.name}
        </h2>
      </div>
      {pipeline === "standard" && (
        <div className="segmented">
          <button
            type="button"
            className={mode === "copy" ? "active" : ""}
            onClick={() => setMode("copy")}
          >
            完整文案
          </button>
          <button
            type="button"
            className={mode === "inspiration" ? "active" : ""}
            onClick={() => setMode("inspiration")}
          >
            灵感主题
          </button>
        </div>
      )}
      {(uploadRequired || (!pipeline && tool === "video")) && (
        <div className="upload-grid">
          <Upload
            required={uploadRequired}
            label={
              pipeline === "digital_human"
                ? "人物图片"
                : pipeline === "action_transfer"
                  ? "角色图片"
                  : tool === "vlm"
                    ? "待分析图片"
                    : "参考图片"
            }
            value={image}
            onUpload={(url) => setImage(url)}
          />
          {pipeline === "action_transfer" && (
            <Upload
              required
              kind="video"
              label="动作参考视频"
              value={motion}
              onUpload={(url) => setMotion(url)}
            />
          )}
        </div>
      )}
      {pipeline === "digital_human" && (
        <Disclosure title="商品信息（可选）">
          <Field label="商品标题">
            <input
              value={goodsTitle}
              onChange={(e) => setGoodsTitle(e.target.value)}
              placeholder="例如：山间茶"
            />
          </Field>
          <Upload
            label="商品图片"
            value={goodsImage}
            onUpload={(url) => setGoodsImage(url)}
          />
        </Disclosure>
      )}
      <Field
        label={
          pipeline === "digital_human"
            ? "口播文案"
            : pipeline === "action_transfer"
              ? "动作提示词"
              : pipeline === "standard"
                ? mode === "copy"
                  ? "视频文案"
                  : "灵感主题"
                : "提示词"
        }
      >
        <textarea
          rows={5}
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={
            pipeline === "digital_human"
              ? "人物将讲述的内容…"
              : pipeline === "action_transfer"
                ? "描述动作迁移的要求…"
                : tool === "vlm" && !pipeline
                  ? "你希望了解这张图片的什么？"
                  : "描述你想表达的内容…"
          }
        />
      </Field>
      <Popover label="生成参数">
        {" "}
        <div className="form-grid">
          {pipeline === "standard" ? (
            <>
              <Field label="视觉风格">
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                >
                  {["中国水墨", "印象油画", "电影写实", "极简线条"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="输出方式">
                <select
                  value={videoMode}
                  onChange={(e) => setVideoMode(e.target.value)}
                >
                  <option value="image_concat">图片拼接成片</option>
                  <option value="dynamic_video">动态视频片段</option>
                </select>
              </Field>
              <Field
                label={mode === "inspiration" ? "目标文案段数" : "画面数量"}
              >
                <input
                  type="number"
                  min={1}
                  max={20}
                  value={segments}
                  onChange={(e) => setSegments(e.target.value)}
                />
              </Field>
            </>
          ) : null}
          {(pipeline || ["t2i", "i2i", "video"].includes(tool)) && (
            <>
              <Field label="画幅">
                <select
                  value={ratio}
                  onChange={(e) => setRatio(e.target.value)}
                >
                  {["16:9", "9:16", "1:1"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
              <Field label="分辨率">
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                >
                  {["720P", "1080P"].map((v) => (
                    <option key={v}>{v}</option>
                  ))}
                </select>
              </Field>
            </>
          )}
          {pipeline && (
            <Field label="片段时长（秒）">
              <input
                type="number"
                value={duration}
                min={1}
                max={15}
                onChange={(e) => setDuration(e.target.value)}
              />
            </Field>
          )}
          {pipeline ? (
            <>
              {pipeline !== "action_transfer" && (
                <>
                  <ModelSelect
                    type="llm"
                    value={models.llm}
                    label="文本模型"
                    onChange={(v) => setModels({ ...models, llm: v })}
                  />
                  <ModelSelect
                    type="t2i"
                    value={models.t2i}
                    label="图片模型"
                    onChange={(v) => setModels({ ...models, t2i: v })}
                  />
                </>
              )}
              {(pipeline !== "standard" || videoMode === "dynamic_video") && (
                <ModelSelect
                  type="video"
                  value={models.video}
                  label="视频模型"
                  onChange={(v) => setModels({ ...models, video: v })}
                />
              )}
            </>
          ) : (
            <ModelSelect
              type={tool}
              value={models[tool]}
              onChange={(v) => setModels({ ...models, [tool]: v })}
            />
          )}
        </div>
      </Popover>
      {(pipeline === "standard" || pipeline === "digital_human") && (
        <Disclosure title="配音与字幕设置">
          <div className="form-grid">
            <Field label="配音音色">
              <select value={voice} onChange={(e) => setVoice(e.target.value)}>
                <option value="zh-CN-YunjianNeural">云健 · 男声</option>
                <option value="zh-CN-XiaoxiaoNeural">晓晓 · 女声</option>
              </select>
            </Field>
            <Field label="语速">
              <select value={speed} onChange={(e) => setSpeed(e.target.value)}>
                {["0.8", "1", "1.2"].map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </Field>
          </div>
          {pipeline === "standard" && (
            <>
              <label className="check-row">
                <input
                  type="checkbox"
                  checked={subtitles}
                  onChange={(e) => setSubtitles(e.target.checked)}
                />
                启用字幕模板
              </label>
              {subtitles && (
                <Field
                  label="字幕模板"
                  hint="模板参数会保存；示例视频不重新渲染字幕。"
                >
                  <select
                    value={template}
                    onChange={(e) => setTemplate(e.target.value)}
                  >
                    <option value="minimal">极简字幕</option>
                    <option value="paper">纸感引文</option>
                  </select>
                </Field>
              )}
            </>
          )}
        </Disclosure>
      )}
      {pipeline === "action_transfer" && (
        <Disclosure title="高级生成选项">
          <Field label="负面提示词">
            <input
              value={negative}
              onChange={(e) => setNegative(e.target.value)}
              placeholder="不希望出现的内容"
            />
          </Field>
        </Disclosure>
      )}
      {!pipeline && tool === "llm" && (
        <Disclosure title="文字生成选项">
          <Field label="创意强度">
            <input
              type="number"
              min={0}
              max={2}
              step={0.1}
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
            />
          </Field>
          <label className="check-row">
            <input
              type="checkbox"
              checked={web}
              onChange={(e) => setWeb(e.target.checked)}
            />
            联网参考（模拟）
          </label>
        </Disclosure>
      )}
      <div className="tool-submit">
        <span>本地演示 · 不产生费用</span>
        <Button type="submit">
          <Sparkles size={16} />
          开始演示
          <ArrowRight size={16} />
        </Button>
      </div>
    </form>
  );
  return (
    <div className="tools-page">
      <div className="tool-page-heading">
        <div>
          {variant !== "director" && (
            <p className="eyebrow">
              {pipeline
                ? "A SHORTER PATH TO YOUR STORY"
                : "ROOM FOR EXPERIMENTS"}
            </p>
          )}
          <h1>{title}</h1>
          {(definition?.hint || variant !== "director") && (
            <p>
              {definition?.hint ||
                "自由试验文字、图像与视频。每次探索，都有迹可循。"}
            </p>
          )}
        </div>
        {canEdit && (
          <Button secondary onClick={sample}>
            <Sparkles size={15} />
            使用示例素材
          </Button>
        )}
      </div>
      {!pipeline && canEdit && (
        <div className="tool-tabs" role="tablist" aria-label="沙盒工具">
          {TOOLS.map((t) => (
            <button
              role="tab"
              aria-selected={tool === t.id}
              className={tool === t.id ? "active" : ""}
              key={t.id}
              onClick={() => setTool(t.id)}
            >
              <span>{t.name}</span>
              <small>{t.hint}</small>
            </button>
          ))}
        </div>
      )}
      <div className="tool-layout">
        {variant === "director" ? (
          <div className="tool-conversation">
            <div className="tool-chat-result">
              <TaskResult task={selected} />
            </div>
            <div className="tool-chat-input">{inputPanel}</div>
          </div>
        ) : variant === "guided" ? (
          <div className="tool-production">
            <aside className="tool-input-dock">{inputPanel}</aside>
            <section className="tool-output-workspace">
              <div className="output-workspace-bar">
                <span>OUTPUT / 生成结果</span>
                <small>{history.length} 次探索</small>
              </div>
              <TaskResult task={selected} />
            </section>
          </div>
        ) : (
          <div className="tool-node-flow">
            <section className="tool-input-node">
              <div className="node-section-title">输入节点</div>
              {inputPanel}
            </section>
            <div className="flow-connector" aria-hidden="true">
              <ArrowRight size={22} />
            </div>
            <section className="tool-output-node">
              <div className="node-section-title">输出节点</div>
              <TaskResult task={selected} />
            </section>
          </div>
        )}
      </div>
      <section className="history-section">
        <SectionHead title={pipeline ? title + "历史" : "临时工作台历史"}>
          <span className="muted">{history.length} 条记录</span>
        </SectionHead>
        {history.length ? (
          <div className="task-history">
            {history.map((t) => (
              <article
                key={t.task_id}
                className={
                  "history-card " +
                  (selected?.task_id === t.task_id ? "active" : "")
                }
              >
                <button
                  className="history-open"
                  onClick={() => router.push(route + "?task=" + t.task_id)}
                >
                  <span className="history-thumb">
                    {t.output.image ? (
                      <Media src={t.output.image} alt="结果缩略图" />
                    ) : (
                      <Film size={23} />
                    )}
                  </span>
                  <span>
                    <strong>{t.title}</strong>
                    <small>
                      {t.pipeline
                        ? "快捷流水线"
                        : TOOLS.find((tool) => tool.id === t.tool)?.name}{" "}
                      · {new Date(t.created_at).toLocaleDateString("zh-CN")}
                    </small>
                  </span>
                  <Badge status={t.status} />
                </button>
                {canEdit && (
                  <div className="history-actions">
                    <button
                      aria-label={
                        (t.showcase ? "取消示例 " : "设为示例 ") + t.title
                      }
                      className="icon-button"
                      onClick={() =>
                        act({ type: "showcase-task", id: t.task_id })
                      }
                    >
                      <Star
                        size={14}
                        fill={t.showcase ? "currentColor" : "none"}
                      />
                    </button>
                    <button
                      className="icon-button"
                      aria-label={"删除任务 " + t.title}
                      onClick={() => {
                        if (window.confirm("删除这条演示任务记录？")) {
                          act({ type: "delete-task", id: t.task_id });
                          if (selected?.task_id === t.task_id)
                            router.push(route);
                        }
                      }}
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                )}
              </article>
            ))}
          </div>
        ) : (
          <Empty
            title="还没有创作记录"
            hint={
              canEdit
                ? "完成一次探索，结果会保留在这里。"
                : "当前没有开放的历史记录。"
            }
          />
        )}
      </section>
    </div>
  );
}
