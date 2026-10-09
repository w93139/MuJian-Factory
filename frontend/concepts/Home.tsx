"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowUpRight,
  Clapperboard,
  FlaskConical,
  Grid2X2,
  List,
  Repeat2,
  Search,
  Sparkles,
  Star,
  Settings2,
  Image as ImageIcon,
  Trash2,
  UserRound,
  WandSparkles,
} from "lucide-react";
import { useDemo } from "./context";
import { PIPELINES, styleLabels, type Tool } from "./data";
import {
  Badge,
  Button,
  Empty,
  Field,
  Media,
  ModelSelect,
  SectionHead,
  Upload,
} from "./ui";
import SpotlightCard from "./reference/SpotlightCard";
import Masonry from "./reference/Masonry";
import { Popover } from "./design";
import { WaveScene, CubeScene, FilmRibbon } from "./MotionScenes";
export function Composer() {
  const { variant, state, act, notify } = useDemo(),
    router = useRouter(),
    params = useSearchParams();
  const [idea, setIdea] = useState(
      inspiration.find((a) => a.id === params.get("inspiration"))?.idea || "",
    ),
    [file, setFile] = useState(""),
    [style, setStyle] = useState(state.settings.style),
    [ratio, setRatio] = useState(state.settings.ratio),
    [resolution, setResolution] = useState(state.settings.resolution),
    [models, setModels] = useState({ ...state.settings.models }),
    [auto, setAuto] = useState(true),
    [videoMode, setVideoMode] = useState(state.settings.video_mode),
    [episodes, setEpisodes] = useState(1),
    [web, setWeb] = useState(state.settings.web_search),
    [concurrent, setConcurrent] = useState(state.settings.concurrency);
  const start = (quick = false) => {
    if (!idea.trim() && !file) {
      notify("请先写下故事创意，或导入一份文本。");
      return;
    }
    const id = act({
      type: "create",
      idea,
      input: {
        idea,
        file_path: file || undefined,
        style,
        video_ratio: ratio,
        video_resolution: quick ? "720P" : resolution,
        llm_model: models.llm,
        vlm_model: models.vlm,
        image_t2i_model: models.t2i,
        image_it2i_model: models.i2i,
        video_first_frame_model: models.video,
        video_start_end_model: models.video,
        video_reference_model: models.video,
        video_generation_mode: quick ? "first_frame" : videoMode,
        enable_concurrency: concurrent,
        web_search: web,
        episodes: quick ? 1 : episodes,
        ...(quick ? { target_duration_seconds: 30 } : {}),
      },
      auto: quick || auto,
    });
    if (id) router.push("/?session=" + id + "&stage=script_generation");
  };
  return (
    <SpotlightCard
      className="composer-light"
      spotlightColor="rgba(255, 255, 255, 0.09)"
    >
      <form
        className="composer"
        id="new-project"
        onSubmit={(e) => {
          e.preventDefault();
          start();
        }}
      >
        {variant !== "director" && (
          <div className="composer-caption">
            <Sparkles size={15} />
            <span>故事创作 Agent</span>
            <span className="muted">六阶段自动协作</span>
          </div>
        )}
        <textarea
          aria-label="故事创意"
          rows={3}
          value={idea}
          onChange={(e) => setIdea(e.target.value)}
          placeholder="写下一段故事，剩下的交给幕间。比如：一位宇航员收到一封来自故乡的旧信…"
        />
        <div className="composer-toolbar">
          <Popover
            label={styleLabels[style] + " · " + ratio + " · " + resolution}
            icon={<Grid2X2 size={14} />}
          >
            <div className="form-grid">
              <Field label="风格">
                <select
                  value={style}
                  onChange={(e) => setStyle(e.target.value)}
                >
                  {Object.entries(styleLabels).map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
              </Field>
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
            </div>
          </Popover>
          <Popover label="模型与高级选项" icon={<Settings2 size={14} />}>
            <div className="form-grid">
              {(["llm", "vlm", "t2i", "i2i", "video"] as Tool[]).map((t) => (
                <ModelSelect
                  key={t}
                  type={t}
                  value={models[t]}
                  label={
                    {
                      llm: "文本模型",
                      vlm: "图片理解模型",
                      t2i: "文生图模型",
                      i2i: "图生图模型",
                      video: "视频模型",
                    }[t]
                  }
                  onChange={(v) => setModels({ ...models, [t]: v })}
                />
              ))}
              <Field label="视频生成方式">
                <select
                  value={videoMode}
                  onChange={(e) => setVideoMode(e.target.value)}
                >
                  <option value="first_frame">首帧生成</option>
                  <option value="start_end">首尾帧生成</option>
                  <option value="reference">参考图生成</option>
                </select>
              </Field>
              <Field label="剧集数量">
                <input
                  type="number"
                  min={1}
                  max={3}
                  value={episodes}
                  onChange={(e) =>
                    setEpisodes(
                      Math.max(1, Math.min(3, Number(e.target.value))),
                    )
                  }
                />
              </Field>
              <Upload
                kind="text"
                label="导入故事文本"
                value={file}
                onUpload={(text, name) => {
                  setFile(name);
                  setIdea(text);
                }}
              />
            </div>
            <div className="check-row">
              <label>
                <input
                  type="checkbox"
                  checked={auto}
                  onChange={(e) => setAuto(e.target.checked)}
                />
                自动推进六阶段
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={concurrent}
                  onChange={(e) => setConcurrent(e.target.checked)}
                />
                允许素材并行
              </label>
              <label>
                <input
                  type="checkbox"
                  checked={web}
                  onChange={(e) => setWeb(e.target.checked)}
                />
                联网参考（模拟）
              </label>
            </div>
          </Popover>
          <Button type="submit">
            <span>创建项目</span>
            <ArrowUpRight size={16} />
          </Button>
        </div>
        <div className="quick-demo">
          <span>1 集 · 约 30 秒成片 · 720P</span>
          <button type="button" onClick={() => start(true)}>
            <WandSparkles size={13} />
            快速演示
          </button>
        </div>
      </form>
    </SpotlightCard>
  );
}
function ProjectCollection({
  onlyProjects = false,
}: {
  onlyProjects?: boolean;
}) {
  const { variant, projects, canEdit, act } = useDemo();
  const [search, setSearch] = useState(""),
    [filter, setFilter] = useState("all"),
    [list, setList] = useState(false);
  const filtered = projects.filter(
    (p) =>
      (filter === "all" ||
        (filter === "showcase" && p.showcase) ||
        (filter === "draft" && !p.showcase)) &&
      (!search || [p.title, p.idea].some((t) => t.includes(search))),
  );
  return (
    <section className="projects-section">
      <SectionHead
        eyebrow={variant === "gallery" ? "YOUR STORY COLLECTION" : undefined}
        title={
          canEdit ? (onlyProjects ? "我的项目" : "继续你的故事") : "示例作品"
        }
      >
        <div className="view-toggle">
          <button
            className={!list ? "active" : ""}
            aria-label="网格视图"
            onClick={() => setList(false)}
          >
            <Grid2X2 size={17} />
          </button>
          <button
            className={list ? "active" : ""}
            aria-label="列表视图"
            onClick={() => setList(true)}
          >
            <List size={17} />
          </button>
        </div>
      </SectionHead>
      <div className="project-toolbar">
        <div className="filter-tabs">
          {[
            ["all", "全部作品"],
            ...(canEdit
              ? [
                  ["showcase", "已开放示例"],
                  ["draft", "私有草稿"],
                ]
              : []),
          ].map(([v, l]) => (
            <button
              aria-pressed={filter === v}
              key={v}
              className={filter === v ? "active" : ""}
              onClick={() => setFilter(v)}
            >
              {l}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={16} />
          <input
            aria-label="搜索项目"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="搜索你的故事"
          />
        </label>
      </div>
      {filtered.length ? (
        <div className={"project-grid " + (list ? "list-view" : "")}>
          {filtered.map((p, index) => (
            <article className="project-card" key={p.session_id}>
              <Link
                className="project-cover"
                href={"/?session=" + p.session_id + "&stage=" + p.current_stage}
              >
                <Media src={p.cover} alt={p.title + "封面"} />
                {variant !== "director" && (
                  <>
                    <span className="cover-number">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                    <span className="cover-time">00:30</span>
                  </>
                )}
                <div className="cover-hover">
                  <span>
                    查看创作过程 <ArrowUpRight size={18} />
                  </span>
                </div>
              </Link>
              <div className="project-info">
                <div className="project-title">
                  <Link
                    href={
                      "/?session=" + p.session_id + "&stage=" + p.current_stage
                    }
                  >
                    <h3>{p.title}</h3>
                  </Link>
                  <Badge status={p.status[p.current_stage]} />
                </div>
                <p>
                  {styleLabels[p.style]} <i>·</i> {p.video_ratio} <i>·</i>{" "}
                  {p.episodes.length} 集
                </p>
                <div className="project-meta">
                  <span>
                    {new Date(p.updated_at).toLocaleDateString("zh-CN", {
                      month: "numeric",
                      day: "numeric",
                      timeZone: "Asia/Shanghai",
                    })}{" "}
                    <i>·</i> {p.showcase ? "公开示例" : "私有草稿"}
                  </span>
                  {canEdit && (
                    <div>
                      <button
                        className="icon-button"
                        aria-label={
                          (p.showcase ? "取消示例 " : "设为示例 ") + p.title
                        }
                        onClick={() =>
                          act({
                            type: "patch-project",
                            id: p.session_id,
                            patch: { showcase: !p.showcase },
                          })
                        }
                      >
                        <Star
                          size={15}
                          fill={p.showcase ? "currentColor" : "none"}
                        />
                      </button>
                      <button
                        className="icon-button"
                        aria-label={"删除项目 " + p.title}
                        onClick={() => {
                          if (
                            window.confirm(
                              "删除这份演示项目？其他作品不会受到影响。",
                            )
                          )
                            act({ type: "delete-project", id: p.session_id });
                        }}
                      >
                        <Trash2 size={15} />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <Empty
          title={search ? "没有找到这个故事" : "你的第一部作品，从这里开始"}
          hint={
            search
              ? "试试其他关键词，或切换筛选条件。"
              : "写下一句灵感，即可开始六阶段创作。"
          }
        />
      )}
    </section>
  );
}
const inspiration = [
  {
    id: "space",
    title: "星际来信",
    tag: "科幻 · 太空叙事",
    image: "/ui/inspiration-space.png",
    idea: "一位宇航员在空间站收到一封来自故乡的旧信。",
  },
  {
    id: "ink",
    title: "山水之间",
    tag: "水墨 · 国风诗意",
    image: "/ui/inspiration-ink.png",
    idea: "一名旅人在山水间寻找童年的声音。",
  },
  {
    id: "cat",
    title: "猫的远行",
    tag: "动画 · 温暖日常",
    image: "/ui/inspiration-cat.png",
    idea: "一只猫决定搭上开往春天的列车。",
  },
  {
    id: "detective",
    title: "午夜档案",
    tag: "悬疑 · 城市探索",
    image: "/ui/inspiration-detective.png",
    idea: "午夜的侦探收到一个没有寄件人的包裹。",
  },
  {
    id: "mars",
    title: "火星漫游",
    tag: "冒险 · 异星旅途",
    image: "/ui/inspiration-mars.png",
    idea: "一位探险家在火星上寻找第一朵花。",
  },
  {
    id: "wuxia",
    title: "江湖一瞬",
    tag: "武侠 · 东方故事",
    image: "/ui/inspiration-wuxia.png",
    idea: "一位剑客走进山间茶馆寻找故人。",
  },
];
function StarterLinks() {
  return (
    <div className="starter-links">
      {PIPELINES.map((p, i) => (
        <Link key={p.id} href={p.route}>
          {i === 0 ? (
            <Clapperboard size={16} />
          ) : i === 1 ? (
            <Repeat2 size={16} />
          ) : (
            <UserRound size={16} />
          )}
          <span>{p.name}</span>
          <ArrowUpRight size={13} />
        </Link>
      ))}
      <Link href="/sandbox">
        <FlaskConical size={16} />
        临时工作台
        <ArrowUpRight size={13} />
      </Link>
    </div>
  );
}
function AgentHome() {
  const router = useRouter(),
    q = useSearchParams();
  return (
    <>
      <section className="wave-stage">
        <WaveScene />

        <div className="wave-hero-copy">
          <h1>
            故事的下一幕
            <br />
            由你想象
          </h1>

          <div className="wave-input">
            <Composer key={q.get("inspiration")} />
          </div>
          <StarterLinks />
        </div>
      </section>
      <section className="inspiration-section">
        <div className="section-head">
          <h2>灵感</h2>
        </div>
        <div className="inspiration-strip">
          {inspiration.slice(0, 4).map((a) => (
            <SpotlightCard key={a.id} className="inspiration-tile">
              <button onClick={() => router.push("/?inspiration=" + a.id)}>
                <Media src={a.image} alt={a.title} />
                <span>
                  <strong>{a.title}</strong>
                  <small>{a.tag}</small>
                </span>
                <ArrowUpRight size={17} />
              </button>
            </SpotlightCard>
          ))}
        </div>
      </section>
      <ProjectCollection />
    </>
  );
}
function ProductionHome() {
  const [category, setCategory] = useState("全部素材");
  const items = inspiration
    .filter(
      (a) =>
        category === "全部素材" ||
        (category === "图像" && !["space", "mars"].includes(a.id)) ||
        (category === "视频" && ["space", "mars"].includes(a.id)),
    )
    .map((a, i) => ({
      id: a.id,
      img: a.image,
      url:
        a.id === "space"
          ? "/?session=demo-orbit&stage=reference_generation"
          : a.id === "ink"
            ? "/?session=demo-ink&stage=reference_generation"
            : a.id === "cat"
              ? "/?session=demo-cat&stage=character_design"
              : "/?inspiration=" + a.id,
      height: [540, 370, 640, 460, 540, 370][i],
      label: a.title,
      caption: a.tag,
    }));
  return (
    <>
      <section className="module-hero">
        <div className="module-copy">
          <p className="module-edition">MUJIAN / CREATIVE TOOLKIT 01</p>
          <h1>
            几个字。
            <br />
            <span>一个新世界。</span>
          </h1>
          <p className="module-lede">
            为想象搭好积木。
            <br />
            从剧本、素材到镜头，一起构建你的下一部短片。
          </p>
          <div className="module-prompt">
            <Composer />
          </div>
        </div>
        <CubeScene />
        <div className="module-bottom">
          <span>灵感是起点，创作可以很简单。</span>
          <Link href="/?session=demo-orbit&stage=video_generation">
            探索制作工具 <ArrowUpRight size={16} />
          </Link>
        </div>
      </section>
      <div className="module-tool-row">
        {PIPELINES.map((p, i) => (
          <Link href={p.route} key={p.id}>
            <span className="module-index">0{i + 1}</span>
            <strong>{p.name}</strong>
            <small>{p.hint}</small>
            <ArrowUpRight size={20} />
          </Link>
        ))}
        <Link href="/sandbox">
          <span className="module-index">04</span>
          <strong>临时工作台</strong>
          <small>文字、图像与视频，自由试验</small>
          <ArrowUpRight size={20} />
        </Link>
      </div>
      <section className="module-library">
        <div className="section-head">
          <div>
            <p className="module-edition">CREATIVE POSSIBILITIES</p>
            <h2>下一帧，试一点不一样。</h2>
          </div>
          <span className="muted">素材与示例故事</span>
        </div>{" "}
        <section className="production-discovery">
          <div className="discovery-toolbar">
            <div className="filter-tabs">
              {["全部素材", "图像", "视频"].map((c) => (
                <button
                  key={c}
                  className={category === c ? "active" : ""}
                  onClick={() => setCategory(c)}
                >
                  {c}
                </button>
              ))}
            </div>
            <span className="muted">
              <ImageIcon size={14} />
              预置素材
            </span>
          </div>
          <div className="masonry-wall">
            <Masonry
              items={items}
              animateFrom="center"
              duration={0.3}
              stagger={0.025}
              blurToFocus={false}
              hoverScale={0.99}
            />
          </div>
          <div className="media-library-caption">
            <span>为故事寻找下一个画面</span>
            <small>已有故事打开制作过程；新灵感带入创作输入</small>
          </div>
        </section>
      </section>
      <ProjectCollection />
    </>
  );
}

function CanvasHome() {
  const { projects } = useDemo();
  const [active, setActive] = useState(0);
  const featured = projects.filter((p) => p.showcase).slice(0, 3),
    selected = featured[active] || featured[0];
  return (
    <>
      <section className="editorial-hero">
        <div className="editorial-issue">
          <span>幕间 / 创作刊物</span>
          <span>VOL. 03 — THE IMAGINATION ISSUE</span>
          <span>从故事开始。</span>
        </div>
        <div className="editorial-spread">
          <div className="editorial-copy">
            <p>每个故事，都有属于它的银幕。</p>
            <h1>
              让想象，
              <br />
              <em>开幕。</em>
            </h1>
            <div className="editorial-description">
              <span>001 — 创作宣言</span>
              <p>
                把灵感写成故事。
                <br />
                把故事铺成镜头。
                <br />
                认真对待每一次想象。
              </p>
            </div>
            <a href="#editorial-create" className="editorial-create-link">
              开启你的下一幕 <ArrowUpRight size={27} />
            </a>
          </div>
          <div className="editorial-poster">
            {selected ? (
              <>
                <Link
                  href={
                    "/?session=" +
                    selected.session_id +
                    "&stage=post_production"
                  }
                >
                  <Media
                    src={selected.cover}
                    alt={selected.title + "电影海报"}
                  />
                  <span className="poster-corner">
                    MUJIAN
                    <br />
                    ORIGINAL
                  </span>
                  <div className="poster-title">
                    <span>STORY NO. {String(active + 1).padStart(2, "0")}</span>
                    <h2>{selected.title}</h2>
                    <span>
                      观看作品与创作过程 <ArrowUpRight size={17} />
                    </span>
                  </div>
                </Link>
                <div className="poster-pagination">
                  {featured.map((p, i) => (
                    <button
                      key={p.session_id}
                      className={active === i ? "active" : ""}
                      aria-label={"展示海报 " + p.title}
                      aria-pressed={active === i}
                      onClick={() => setActive(i)}
                    >
                      <span>{String(i + 1).padStart(2, "0")}</span>
                      {p.title}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <div className="editorial-empty-poster">
                <Media src="/ui/inspiration-mars.png" alt="新的故事示意画面" />
                <span>下一张海报，留给你的故事。</span>
              </div>
            )}
          </div>
        </div>
        <FilmRibbon />
      </section>
      <section id="editorial-create" className="editorial-create">
        <div>
          <span className="editorial-section-no">002 / 下一部作品</span>
          <h2>
            一个开场，
            <br />
            无限可能。
          </h2>
          <p>
            写下一段故事。六个创作阶段，
            <br />
            让你的想象慢慢成为作品。
          </p>
        </div>
        <Composer />
      </section>
      <StarterLinks />
      <ProjectCollection />
    </>
  );
}
export function ConceptHome() {
  const { variant, canEdit } = useDemo(),
    q = useSearchParams();
  const onlyProjects = q.get("view") === "projects";
  return (
    <div className={"home-page home-" + variant}>
      {onlyProjects ? (
        <>
          <div className="collection-heading">
            <h1>我的项目</h1>
            <p>你的故事与每一次创作过程。</p>
          </div>
          <ProjectCollection onlyProjects />
          {canEdit && (
            <div className="new-project-inline">
              <Composer />
            </div>
          )}
        </>
      ) : !canEdit ? (
        <>
          <div className="showcase-intro">
            <h1>看见作品，也看见创作过程。</h1>
            <p>浏览开放的故事、分镜和示例成片。</p>
          </div>
          <ProjectCollection />
        </>
      ) : variant === "director" ? (
        <AgentHome />
      ) : variant === "guided" ? (
        <ProductionHome />
      ) : (
        <CanvasHome />
      )}
    </div>
  );
}
