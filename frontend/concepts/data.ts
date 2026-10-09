export type Variant = "director" | "guided" | "gallery";
export type StageId =
  | "script_generation"
  | "character_design"
  | "storyboard"
  | "reference_generation"
  | "video_generation"
  | "post_production";
export type Status =
  | "pending"
  | "running"
  | "waiting"
  | "completed"
  | "error"
  | "stopped";
export type Tool = "llm" | "vlm" | "t2i" | "i2i" | "video";
export type Pipeline = "standard" | "action_transfer" | "digital_human";
export const STAGES: {
  id: StageId;
  name: string;
  short: string;
  hint: string;
}[] = [
  {
    id: "script_generation",
    name: "剧本生成",
    short: "剧本",
    hint: "把灵感写成故事",
  },
  {
    id: "character_design",
    name: "角色与场景",
    short: "角色",
    hint: "让故事有自己的面孔",
  },
  { id: "storyboard", name: "分镜设计", short: "分镜", hint: "安排每一个镜头" },
  {
    id: "reference_generation",
    name: "参考图",
    short: "参考图",
    hint: "确定画面与构图",
  },
  {
    id: "video_generation",
    name: "视频片段",
    short: "视频",
    hint: "让镜头动起来",
  },
  {
    id: "post_production",
    name: "后期成片",
    short: "成片",
    hint: "把故事连成一部短片",
  },
];
export const TOOLS: { id: Tool; name: string; hint: string }[] = [
  { id: "llm", name: "文字生成", hint: "剧本、文案与灵感" },
  { id: "vlm", name: "图片理解", hint: "读懂画面里的故事" },
  { id: "t2i", name: "文生图", hint: "把描述变成画面" },
  { id: "i2i", name: "图生图", hint: "延续参考图的风格" },
  { id: "video", name: "视频生成", hint: "生成独立视频片段" },
];
export const PIPELINES: {
  id: Pipeline;
  route: string;
  name: string;
  hint: string;
  image: string;
}[] = [
  {
    id: "standard",
    route: "/pipelines/standard",
    name: "文艺短视频",
    hint: "文案、画面与声音，一次串联",
    image: "/ui/inspiration-ink.png",
  },
  {
    id: "action_transfer",
    route: "/pipelines/action-transfer",
    name: "动作迁移",
    hint: "一张角色图，复现参考动作",
    image: "/ui/inspiration-wuxia.png",
  },
  {
    id: "digital_human",
    route: "/pipelines/digital-human",
    name: "数字人口播",
    hint: "让人物讲述你的品牌与故事",
    image: "/ui/inspiration-cat.png",
  },
];
export interface Model {
  id: string;
  label: string;
  model_type: Tool;
  ability_types?: string[];
  provider: string;
}
export const MODELS: Model[] = [
  {
    id: "demo-text",
    label: "幕间文本 · 演示",
    model_type: "llm",
    provider: "demo",
  },
  {
    id: "demo-vision",
    label: "幕间视觉理解 · 演示",
    model_type: "vlm",
    provider: "demo",
  },
  {
    id: "demo-image",
    label: "幕间文生图 · 演示",
    model_type: "t2i",
    provider: "demo",
  },
  {
    id: "demo-image-edit",
    label: "幕间图像编辑 · 演示",
    model_type: "i2i",
    provider: "demo",
  },
  {
    id: "demo-video",
    label: "幕间视频 · 演示",
    model_type: "video",
    ability_types: ["first_frame", "start_end", "reference"],
    provider: "demo",
  },
];
export interface Asset {
  id: string;
  name: string;
  description: string;
  selected: string;
  versions: string[];
  status: "done" | "running" | "failed" | "pending";
  kind: "character" | "setting" | "reference" | "clip";
  episode: number;
  error?: string;
  progress?: number;
}
export interface Shot {
  id: string;
  segment_id: string;
  episode_number: number;
  shot_number: number;
  shot_type: string;
  duration: number;
  content: string;
  image: string;
  location: string;
  characters: string[];
}
export interface Episode {
  episode_number: number;
  title: string;
  content: string;
}
export interface Project {
  session_id: string;
  title: string;
  idea: string;
  style: string;
  cover: string;
  video_ratio: string;
  video_resolution: string;
  episodes: Episode[];
  logline: string;
  current_stage: StageId;
  status: Record<StageId, Status>;
  progress: number;
  auto_mode: boolean;
  showcase: boolean;
  created_at: string;
  updated_at: string;
  assets: Asset[];
  shots: Shot[];
  final_videos: { name: string; path: string; episode: number }[];
  error: string | null;
  input: Record<string, unknown>;
  logline_confirmed: boolean;
}
export interface Task {
  task_id: string;
  pipeline?: Pipeline;
  tool?: Tool;
  title: string;
  status: Status;
  progress: number;
  input: Record<string, unknown>;
  output: { text?: string; image?: string; video?: string };
  showcase: boolean;
  created_at: string;
  error?: string;
}
export interface Invite {
  code: string;
  note: string;
  expires_at: number;
  revoked: boolean;
}
export interface DemoState {
  role: "admin" | "guest" | "anonymous";
  public_mode: boolean;
  projects: Project[];
  tasks: Task[];
  settings: {
    style: string;
    ratio: string;
    resolution: string;
    models: Record<Tool, string>;
    video_mode: string;
    concurrency: boolean;
    web_search: boolean;
    provider_url: string;
    budget: number;
  };
  invites: Invite[];
  guest_code?: string;
  scenario: string;
}
export const VIDEO = "/demo/mujian-film.mp4";
export const ALT_VIDEO = "/demo/mujian-alternate.mp4";
export const SPACE = "/ui/inspiration-space.png";
export const styleLabels: Record<string, string> = {
  cinematic: "电影写实",
  ink: "东方水墨",
  anime: "温暖动画",
  oil: "印象油画",
};
export const statusLabel: Record<Status, string> = {
  pending: "等待中",
  running: "生成中",
  waiting: "待确认",
  completed: "已完成",
  error: "失败",
  stopped: "已停止",
};
export const variants: Record<
  Variant,
  { name: string; eyebrow: string; tagline: string; letter: string }
> = {
  director: {
    name: "光影叙事",
    eyebrow: "DIRECTOR’S DESK",
    tagline: "你的下一幕，从这里开始。",
    letter: "A",
  },
  guided: {
    name: "几何创作台",
    eyebrow: "MAKE SOMETHING MEANINGFUL",
    tagline: "一个想法，一部好故事。",
    letter: "B",
  },
  gallery: {
    name: "电影编辑部",
    eyebrow: "A SPACE FOR YOUR STORIES",
    tagline: "让想象，有迹可循。",
    letter: "C",
  },
};
export function stageMap(
  status: Status = "completed",
): Record<StageId, Status> {
  return Object.fromEntries(STAGES.map((s) => [s.id, status])) as Record<
    StageId,
    Status
  >;
}
export function makeProject(
  id: string,
  title: string,
  idea: string,
  cover = SPACE,
  showcase = true,
): Project {
  const created = "2026-10-08T08:30:00+08:00";
  const shots: Shot[] = [
    {
      id: "shot-1",
      segment_id: "segment-1",
      episode_number: 1,
      shot_number: 1,
      shot_type: "远景",
      duration: 8,
      content: "空间站缓缓驶入地球的晨昏线。舷窗里的蓝色星球，占据整个画面。",
      image: cover,
      location: "空间站观景舱",
      characters: ["林遥"],
    },
    {
      id: "shot-2",
      segment_id: "segment-2",
      episode_number: 1,
      shot_number: 2,
      shot_type: "近景",
      duration: 7,
      content: "林遥展开一封泛黄的信。纸页上的手写文字，映着舷窗外的微光。",
      image: "/ui/inspiration-detective.png",
      location: "空间站观景舱",
      characters: ["林遥"],
    },
    {
      id: "shot-3",
      segment_id: "segment-3",
      episode_number: 1,
      shot_number: 3,
      shot_type: "全景",
      duration: 8,
      content: "记忆中的江南山水渐渐浮现，墨色与星空交融，故乡似乎从未远去。",
      image: "/ui/inspiration-ink.png",
      location: "记忆中的故乡",
      characters: ["林遥"],
    },
    {
      id: "shot-4",
      segment_id: "segment-4",
      episode_number: 1,
      shot_number: 4,
      shot_type: "中景",
      duration: 7,
      content: "林遥靠近舷窗，将信轻轻贴在胸口。地球的日出照亮了她的脸。",
      image: cover,
      location: "空间站观景舱",
      characters: ["林遥"],
    },
  ];
  const assets: Asset[] = [
    {
      id: "character-1",
      name: "林遥",
      description: "年轻的宇航员，沉静、敏锐，穿着银灰色舱内宇航服。",
      selected: cover,
      versions: [cover, "/ui/inspiration-mars.png"],
      status: "done",
      kind: "character",
      episode: 1,
    },
    {
      id: "setting-1",
      name: "空间站观景舱",
      description: "宽大的弧形舷窗，蓝色地球光映在金属地板上。",
      selected: cover,
      versions: [cover, "/ui/inspiration-mars.png"],
      status: "done",
      kind: "setting",
      episode: 1,
    },
  ];
  for (const shot of shots) {
    assets.push({
      id: shot.segment_id,
      name: "片段 " + shot.shot_number,
      description: shot.content,
      selected: shot.image,
      versions: [shot.image, "/ui/inspiration-mars.png"],
      status: "done",
      kind: "reference",
      episode: 1,
    });
    assets.push({
      id: shot.segment_id,
      name: "片段 " + shot.shot_number,
      description: shot.content,
      selected: VIDEO,
      versions: [VIDEO, ALT_VIDEO],
      status: "done",
      kind: "clip",
      episode: 1,
    });
  }
  return {
    session_id: id,
    title,
    idea,
    cover,
    style: "cinematic",
    video_ratio: "16:9",
    video_resolution: "720P",
    episodes: [
      {
        episode_number: 1,
        title: "给地球的一封信",
        content:
          "林遥在空间站收到一封来自故乡的旧信。隔着遥远的星河，她重新看见那些熟悉的山水，也重新理解了归途的意义。\n\n林遥：原来，离家越远，越能看见家的模样。\n\n日出缓缓铺开。她将信贴在胸口，向着地球微笑。",
      },
    ],
    logline: "一位宇航员在远离地球的空间站，通过一封旧信找回了与故乡的联系。",
    current_stage: "post_production",
    status: stageMap(),
    progress: 100,
    auto_mode: false,
    showcase,
    created_at: created,
    updated_at: created,
    assets,
    shots,
    final_videos: [{ name: title, path: VIDEO, episode: 1 }],
    error: null,
    input: {},
    logline_confirmed: true,
  };
}
export function initialState(): DemoState {
  const moon = makeProject(
    "demo-orbit",
    "给地球的一封信",
    "一位宇航员在空间站收到一封来自故乡的旧信。",
  );
  const ink = makeProject(
    "demo-ink",
    "山水之间",
    "一名旅人在山水间寻找童年的声音。",
    "/ui/inspiration-ink.png",
  );
  ink.style = "ink";
  const cat = makeProject(
    "demo-cat",
    "猫的第七次远行",
    "一只猫决定搭上开往春天的列车。",
    "/ui/inspiration-cat.png",
  );
  cat.style = "anime";
  ink.logline = "一位旅人回到江南，在山水与旧桥之间，重新听见童年的声音。";
  ink.episodes[0] = {
    episode_number: 1,
    title: "山水之间",
    content:
      "青禾沿着旧桥走向故乡。雨后的山色映在水面上，风里传来熟悉的歌声。\n\n青禾：原来记忆里的地方，一直在等我。",
  };
  ink.assets
    .filter((a) => a.kind === "character")
    .forEach((a) => {
      a.name = "青禾";
      a.description = "身穿素色衣衫的旅人，安静而坚定。";
    });
  ink.shots.forEach((shot, i) => {
    shot.location = "江南旧桥";
    shot.characters = ["青禾"];
    shot.image = "/ui/inspiration-ink.png";
    shot.content = [
      "远山与江水缓缓展开，旅人从旧桥的一端走来。",
      "青禾停下脚步，听见水边熟悉的歌声。",
      "风掠过树梢，童年的画面与眼前山水重叠。",
      "旅人露出微笑，继续走向记忆中的家。",
    ][i];
  });
  cat.logline = "一只好奇的猫搭上开往春天的列车，在陌生的城市里找到新的朋友。";
  cat.episodes[0] = {
    episode_number: 1,
    title: "猫的第七次远行",
    content:
      "小七在清晨的车站醒来。它带着一只旧箱子，跳上开往春天的列车。\n\n旅程的终点，是一间温暖的小店和一个愿意分享早餐的新朋友。",
  };
  cat.assets
    .filter((a) => a.kind === "character")
    .forEach((a) => {
      a.name = "小七";
      a.description = "一只好奇的橘猫，带着旧箱子和探索世界的勇气。";
    });
  cat.shots.forEach((shot, i) => {
    shot.location = "春天的车站";
    shot.characters = ["小七"];
    shot.image = "/ui/inspiration-cat.png";
    shot.content = [
      "清晨的车站里，小七在旧箱子旁醒来。",
      "列车缓缓进站，小七追着阳光跃上车厢。",
      "窗外春天的花与城市流过，猫静静望着远方。",
      "列车到站，一位新朋友为小七留下了热乎的早餐。",
    ][i];
  });
  for (const story of [ink, cat]) {
    story.assets
      .filter((a) => a.kind === "reference")
      .forEach((a) => {
        const shot = story.shots.find((shot) => shot.segment_id === a.id);
        if (shot) {
          a.description = shot.content;
          a.selected = shot.image;
          a.versions = [shot.image, "/ui/inspiration-mars.png"];
        }
      });
    story.assets
      .filter((a) => a.kind === "setting")
      .forEach((a) => {
        a.name = story.shots[0].location;
        a.description = "这个故事的主要场景，以示意画面表达气氛。";
      });
  }
  const draft = makeProject(
    "demo-private",
    "未公开的火星草稿",
    "在火星基地寻找第一朵花。",
    "/ui/inspiration-mars.png",
    false,
  );
  draft.status = stageMap("pending");
  draft.status.script_generation = "waiting";
  draft.current_stage = "script_generation";
  draft.progress = 100;
  return {
    role: "admin",
    public_mode: true,
    projects: [moon, ink, cat, draft],
    tasks: [
      {
        task_id: "demo-standard",
        pipeline: "standard",
        title: "山水之间 · 文艺短视频",
        status: "completed",
        progress: 100,
        input: { text: "听山间的风，慢下来。" },
        output: { video: VIDEO },
        showcase: true,
        created_at: moon.created_at,
      },
      {
        task_id: "demo-action",
        pipeline: "action_transfer",
        title: "剑客起势 · 动作迁移",
        status: "completed",
        progress: 100,
        input: { prompt_text: "角色复现参考视频中的动作" },
        output: { video: ALT_VIDEO },
        showcase: true,
        created_at: moon.created_at,
      },
      {
        task_id: "demo-human",
        pipeline: "digital_human",
        title: "茶的日常 · 数字人口播",
        status: "completed",
        progress: 100,
        input: { goods_text: "一杯茶，让日常慢下来。" },
        output: { video: VIDEO },
        showcase: true,
        created_at: moon.created_at,
      },
      {
        task_id: "demo-sandbox",
        tool: "t2i",
        title: "舷窗外的蓝色星球",
        status: "completed",
        progress: 100,
        input: { prompt: "舷窗外的蓝色星球" },
        output: { image: SPACE },
        showcase: true,
        created_at: moon.created_at,
      },
      {
        task_id: "demo-private-task",
        tool: "llm",
        title: "私有文案草稿",
        status: "completed",
        progress: 100,
        input: { prompt: "私有草稿" },
        output: { text: "尚未公开的文案" },
        showcase: false,
        created_at: moon.created_at,
      },
    ],
    settings: {
      style: "cinematic",
      ratio: "16:9",
      resolution: "720P",
      models: Object.fromEntries(
        MODELS.map((m) => [m.model_type, m.id]),
      ) as Record<Tool, string>,
      video_mode: "first_frame",
      concurrency: true,
      web_search: false,
      provider_url: "",
      budget: 20,
    },
    invites: [
      {
        code: "MUJIANDEMO",
        note: "作品展示",
        expires_at: Date.now() + 7 * 86400000,
        revoked: false,
      },
    ],
    scenario: "success",
  };
}
export function requireEditable(state: DemoState) {
  if (state.public_mode && state.role !== "admin")
    throw new Error("当前为只读展示，无法修改内容。");
}
export function canEdit(state: DemoState) {
  return !state.public_mode || state.role === "admin";
}
export function visibleProjects(state: DemoState) {
  return canEdit(state)
    ? state.projects
    : state.projects.filter((p) => p.showcase);
}
export function visibleTasks(state: DemoState) {
  return canEdit(state) ? state.tasks : state.tasks.filter((t) => t.showcase);
}
export function advance(state: DemoState): DemoState {
  let changed = false;
  const next = structuredClone(state);
  for (const p of next.projects) {
    const s = p.current_stage;
    if (p.status[s] === "running") {
      changed = true;
      p.progress = Math.min(100, p.progress + 22);
      if (p.progress === 100) {
        finishStage(p, s);
        if (s === "script_generation" && p.auto_mode)
          p.logline_confirmed = true;
        p.status[s] = s === "post_production" ? "completed" : "waiting";
        p.error = null;
        if (p.auto_mode && s !== "post_production") {
          p.status[s] = "completed";
          p.current_stage =
            STAGES[STAGES.findIndex((st) => st.id === s) + 1].id;
          p.status[p.current_stage] = "running";
          p.progress = 0;
        }
      }
    }
    for (const a of p.assets.filter((a) => a.status === "running")) {
      changed = true;
      a.progress = (a.progress || 0) + 35;
      if (a.progress >= 100) {
        a.status = "done";
        const alternate =
          a.kind === "clip" ? ALT_VIDEO : "/ui/inspiration-mars.png";
        if (!a.versions.includes(alternate)) a.versions.push(alternate);
        a.versions.push(alternate + "?v=" + Date.now());
        a.error = undefined;
      }
    }
  }
  for (const t of next.tasks) {
    if (t.status === "running" || t.status === "pending") {
      changed = true;
      t.status = "running";
      t.progress = Math.min(100, t.progress + 25);
      if (t.progress === 100) t.status = "completed";
    }
  }
  return changed ? next : state;
}
export const operationMap = {
  createProject: "/api/project/start",
  getProject: "/api/project/{session_id}/status",
  getArtifact: "/api/project/{session_id}/artifact/{stage}",
  executeStage: "/api/project/{session_id}/execute/{stage}",
  intervene: "/api/project/{session_id}/intervene",
  patchArtifact: "/api/project/{session_id}/artifact/{stage}",
  uploadAsset: "/api/project/{session_id}/artifact/{stage}/upload_image",
  continueProject: "/api/project/{session_id}/continue",
  stopProject: "/api/project/{session_id}/stop",
  models: "/api/models",
  tasks: "/api/tasks",
  sandbox: "/api/sandbox/{tool}",
  settings: "/api/config",
};
export function toWorkflowSnapshot(p: Project) {
  return {
    session_id: p.session_id,
    current_stage: p.current_stage,
    status: p.status,
    error: p.error,
    artifacts: {
      script_generation: {
        title: p.title,
        logline: p.logline,
        episodes: p.episodes.map((e) => ({
          act_number: e.episode_number,
          act_title: e.title,
          content: e.content,
        })),
      },
      character_design: {
        characters: p.assets.filter((a) => a.kind === "character"),
        settings: p.assets.filter((a) => a.kind === "setting"),
      },
      storyboard: {
        episodes: p.episodes.map((e) => ({
          episode_number: e.episode_number,
          episode_title: e.title,
          segments: p.shots
            .filter((s) => s.episode_number === e.episode_number)
            .map((s) => ({
              segment_id: s.segment_id,
              segment_number: s.shot_number,
              episode_number: s.episode_number,
              location: s.location,
              characters: s.characters,
              total_duration: s.duration,
              shots: [
                {
                  shot_number: s.shot_number,
                  shot_type: s.shot_type,
                  duration: s.duration,
                  content: s.content,
                },
              ],
            })),
        })),
      },
      reference_generation: {
        scenes: p.assets.filter((a) => a.kind === "reference"),
      },
      video_generation: { clips: p.assets.filter((a) => a.kind === "clip") },
      post_production: { final_videos: p.final_videos },
    },
  };
}

export function finishStage(p: Project, stage: StageId) {
  const kinds =
    stage === "character_design"
      ? ["character", "setting"]
      : stage === "reference_generation"
        ? ["reference"]
        : stage === "video_generation"
          ? ["clip"]
          : [];
  p.assets
    .filter((a) => kinds.includes(a.kind))
    .forEach((a) => {
      a.status = "done";
      if (!a.versions.length) {
        const source =
          a.kind === "clip"
            ? VIDEO
            : a.kind === "reference"
              ? p.shots.find((s) => s.segment_id === a.id)?.image || p.cover
              : p.cover;
        a.versions = [
          source,
          a.kind === "clip" ? ALT_VIDEO : "/ui/inspiration-mars.png",
        ];
        a.selected = source;
      }
    });
  if (stage === "post_production")
    p.final_videos = p.episodes.map((e) => ({
      name: e.title,
      path: e.episode_number % 2 ? VIDEO : ALT_VIDEO,
      episode: e.episode_number,
    }));
}

export function expandEpisodes(p: Project, count: number) {
  const first = p.episodes[0],
    baseShots = p.shots.filter((s) => s.episode_number === 1),
    baseAssets = p.assets.filter(
      (a) => ["reference", "clip"].includes(a.kind) && a.episode === 1,
    );
  for (let number = 2; number <= count; number++) {
    if (!p.episodes.some((e) => e.episode_number === number))
      p.episodes.push({
        episode_number: number,
        title: p.title + " · 第 " + number + " 幕",
        content: first.content,
      });
    if (!p.shots.some((s) => s.episode_number === number)) {
      p.shots.push(
        ...baseShots.map((shot) => ({
          ...shot,
          id: shot.id + "-ep" + number,
          segment_id: shot.segment_id + "-ep" + number,
          episode_number: number,
        })),
      );
      p.assets.push(
        ...baseAssets.map((asset) => ({
          ...asset,
          id: asset.id + "-ep" + number,
          episode: number,
          versions: [...asset.versions],
        })),
      );
    }
  }
}
