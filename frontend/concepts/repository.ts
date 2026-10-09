import {
  STAGES,
  VIDEO,
  expandEpisodes,
  canEdit,
  initialState,
  makeProject,
  requireEditable,
  stageMap,
  toWorkflowSnapshot,
  type Asset,
  type DemoState,
  type Pipeline,
  type Project,
  type StageId,
  type Task,
  type Tool,
} from "./data";
export type Command =
  | { type: "login"; role: "admin" | "guest"; code?: string }
  | { type: "logout" }
  | { type: "scenario"; scenario: string }
  | {
      type: "create";
      idea: string;
      input: Record<string, unknown>;
      auto: boolean;
    }
  | { type: "patch-project"; id: string; patch: Partial<Project> }
  | { type: "run"; id: string; stage: StageId; auto?: boolean }
  | { type: "confirm"; id: string; stage: StageId }
  | { type: "stop"; id: string }
  | {
      type: "asset";
      id: string;
      kind: Asset["kind"];
      assetId: string;
      patch: Partial<Asset>;
      upload?: string;
    }
  | { type: "regenerate"; id: string; kind: Asset["kind"]; assetId: string }
  | { type: "delete-project"; id: string }
  | {
      type: "task";
      pipeline?: Pipeline;
      tool?: Tool;
      title: string;
      input: Record<string, unknown>;
    }
  | { type: "delete-task"; id: string }
  | { type: "showcase-task"; id: string }
  | { type: "settings"; values: Partial<DemoState["settings"]> }
  | { type: "invite"; note: string; hours: number }
  | { type: "revoke"; code: string };
export interface DataAdapter {
  read(): DemoState;
  command(command: Command): { state: DemoState; id?: string };
  models: typeof import("./data").MODELS;
  snapshot(id: string): ReturnType<typeof toWorkflowSnapshot> | undefined;
}
export function reduceCommand(
  current: DemoState,
  c: Command,
): { state: DemoState; id?: string; message: string } {
  const s = structuredClone(current);
  let id: string | undefined;
  if (c.type === "login") {
    if (c.role === "guest") {
      const invite = s.invites.find((i) => i.code === c.code);
      if (!invite || invite.revoked || invite.expires_at < Date.now())
        throw new Error("邀请码无效或已过期，请重新输入。");
      s.guest_code = c.code;
    }
    s.role = c.role;
    return {
      state: s,
      message: c.role === "guest" ? "已进入只读展示" : "已进入管理员演示",
    };
  }
  if (c.type === "logout") {
    s.role = "anonymous";
    delete s.guest_code;
    return { state: s, message: "已退出演示账户" };
  }
  requireEditable(s);
  const project =
    "id" in c ? s.projects.find((p) => p.session_id === c.id) : undefined;
  if (
    ["patch-project", "run", "confirm", "stop", "asset", "regenerate"].includes(
      c.type,
    ) &&
    !project
  )
    throw new Error("项目不存在或已删除。");
  switch (c.type) {
    case "scenario": {
      const seed = initialState();
      s.projects = seed.projects;
      s.tasks = seed.tasks;
      s.scenario = c.scenario;
      if (c.scenario === "empty") {
        s.projects = [];
        s.tasks = [];
      }
      if (["running", "waiting", "error", "stopped"].includes(c.scenario)) {
        const p = s.projects[0];
        p.current_stage = "reference_generation";
        p.status = stageMap("pending");
        STAGES.slice(0, 3).forEach((st) => (p.status[st.id] = "completed"));
        p.status.reference_generation =
          c.scenario as Project["status"][StageId];
        p.progress = c.scenario === "running" ? 20 : 100;
        p.error =
          c.scenario === "error"
            ? "演示场景：素材生成中断。已有文本与版本已保留，可以重试。"
            : null;
      }
      break;
    }
    case "create": {
      if (!c.idea.trim() && !c.input.file_path)
        throw new Error("请写下故事创意或导入文本。");
      id = "project-" + Date.now();
      const p = makeProject(
        id,
        c.idea.trim().slice(0, 20) || "导入的故事",
        c.idea || "从导入文本开始的故事",
      );
      p.logline = c.idea || "使用导入文本生成一个短片故事。";
      p.episodes[0].content =
        (c.idea || "导入的故事") +
        "\n\n故事从一个意外的发现开始。人物在新的旅程中理解自己，最终作出选择。";
      p.episodes[0].title = p.title;
      expandEpisodes(
        p,
        Math.max(1, Math.min(3, Number(c.input.episodes) || 1)),
      );
      p.status = stageMap("pending");
      p.status.script_generation = "running";
      p.current_stage = "script_generation";
      p.progress = 0;
      p.auto_mode = c.auto;
      p.showcase = false;
      p.input = c.input;
      p.style = String(c.input.style || s.settings.style);
      p.video_ratio = String(c.input.video_ratio || s.settings.ratio);
      p.video_resolution = String(
        c.input.video_resolution || s.settings.resolution,
      );
      p.logline_confirmed = false;
      p.created_at = new Date().toISOString();
      p.updated_at = p.created_at;
      p.assets.forEach((a) => {
        a.status = "pending";
        a.selected = "";
        a.versions = [];
      });
      p.final_videos = [];
      s.projects.unshift(p);
      break;
    }
    case "patch-project":
      Object.assign(project!, c.patch, {
        updated_at: new Date().toISOString(),
      });
      if (c.patch.episodes) expandEpisodes(project!, c.patch.episodes.length);
      break;
    case "run": {
      const p = project!;
      if (Object.values(p.status).includes("running"))
        throw new Error("当前阶段正在执行，请等待或先停止。");
      const index = STAGES.findIndex((st) => st.id === c.stage);
      if (index > 0 && p.status[STAGES[index - 1].id] !== "completed")
        throw new Error("请先完成并确认上一阶段。");
      p.current_stage = c.stage;
      p.status[c.stage] = "running";
      p.progress = 0;
      p.error = null;
      if (c.auto !== undefined) p.auto_mode = c.auto;
      break;
    }
    case "confirm": {
      const p = project!;
      if (c.stage === "script_generation" && !p.logline_confirmed)
        throw new Error("请先确认故事方向，再进入角色与场景。");
      if (!["waiting", "completed"].includes(p.status[c.stage]))
        throw new Error("请等待该阶段完成后再确认。");
      const kind =
        c.stage === "character_design"
          ? ["character", "setting"]
          : c.stage === "reference_generation"
            ? ["reference"]
            : c.stage === "video_generation"
              ? ["clip"]
              : [];
      if (
        p.assets.some(
          (a) =>
            kind.includes(a.kind) && (!a.selected || a.status === "running"),
        )
      )
        throw new Error("请先为全部素材选好版本，并等待生成完成。");
      p.status[c.stage] = "completed";
      const next = STAGES[STAGES.findIndex((st) => st.id === c.stage) + 1];
      if (next) {
        p.current_stage = next.id;
        if (p.status[next.id] !== "completed") {
          p.status[next.id] = "running";
          p.progress = 0;
        }
      }
      break;
    }
    case "stop": {
      const p = project!;
      p.status[p.current_stage] = "stopped";
      p.auto_mode = false;
      p.assets
        .filter((a) => a.status === "running")
        .forEach((a) => {
          a.status = a.selected ? "done" : "pending";
        });
      break;
    }
    case "asset": {
      const a = project!.assets.find(
        (a) => a.id === c.assetId && a.kind === c.kind,
      );
      if (!a) throw new Error("素材不存在。");
      Object.assign(a, c.patch);
      if (c.upload) {
        if (c.kind === "clip")
          throw new Error("当前版本不支持上传替换视频片段。");
        a.versions.push(c.upload);
        a.selected = c.upload;
        a.status = "done";
      }
      break;
    }
    case "regenerate": {
      const p = project!,
        a = p.assets.find((a) => a.id === c.assetId && a.kind === c.kind);
      if (!a) throw new Error("素材不存在。");
      if (
        a.kind === "clip" &&
        !p.assets.find((r) => r.kind === "reference" && r.id === a.id)?.selected
      )
        throw new Error("请先为这个片段选好参考图。");
      if (a.status === "running") throw new Error("该素材正在生成。");
      a.status = "running";
      a.progress = 0;
      a.error = undefined;
      break;
    }
    case "delete-project":
      s.projects = s.projects.filter((p) => p.session_id !== c.id);
      break;
    case "task": {
      id = "task-" + Date.now();
      const t: Task = {
        task_id: id,
        pipeline: c.pipeline,
        tool: c.tool,
        title: c.title,
        status: "running",
        progress: 0,
        input: c.input,
        output: {},
        showcase: false,
        created_at: new Date().toISOString(),
      };
      if (c.pipeline || c.tool === "video") t.output.video = VIDEO;
      else if (c.tool === "t2i" || c.tool === "i2i")
        t.output.image = "/ui/inspiration-space.png";
      else
        t.output.text =
          c.tool === "vlm"
            ? "画面呈现了一个宁静的远行时刻：蓝色星球、弧形舷窗与人物形成视觉层次。建议使用远景建立环境，再切近景表达人物情绪。"
            : "故事可以从一封意外收到的信开始。用四个镜头依次展示环境、发现、回忆与选择，让结尾回应开头的意象。";
      s.tasks.unshift(t);
      break;
    }
    case "delete-task":
      s.tasks = s.tasks.filter((t) => t.task_id !== c.id);
      break;
    case "showcase-task": {
      const t = s.tasks.find((t) => t.task_id === c.id);
      if (t) t.showcase = !t.showcase;
      break;
    }
    case "settings":
      if (
        c.values.budget !== undefined &&
        (!Number.isFinite(c.values.budget) || c.values.budget < 0)
      )
        throw new Error("预算请输入不小于零的金额。");
      Object.assign(s.settings, c.values);
      break;
    case "invite": {
      if (c.hours <= 0 || !Number.isFinite(c.hours))
        throw new Error("有效时长必须大于零。");
      s.invites.unshift({
        code: "MJ" + Math.random().toString(36).slice(2, 8).toUpperCase(),
        note: c.note || "作品展示",
        expires_at: Date.now() + c.hours * 3600000,
        revoked: false,
      });
      break;
    }
    case "revoke": {
      const i = s.invites.find((i) => i.code === c.code);
      if (i) i.revoked = true;
      break;
    }
  }
  return {
    state: s,
    id,
    message:
      c.type === "create"
        ? "项目已创建，正在演示剧本生成"
        : c.type === "task"
          ? "演示任务已开始，使用预置结果"
          : c.type === "regenerate"
            ? "正在演示局部重生成，保留已有选中版本"
            : c.type === "stop"
              ? "已停止，已有内容已保留"
              : c.type === "run"
                ? "演示阶段已开始"
                : c.type === "confirm"
                  ? "已确认，继续下一阶段"
                  : c.type === "scenario"
                    ? "已切换演示场景"
                    : "已保存",
  };
}
export function guestSessionValid(state: DemoState) {
  return (
    canEdit(state) ||
    state.role !== "guest" ||
    state.invites.some(
      (i) =>
        i.code === state.guest_code && !i.revoked && i.expires_at > Date.now(),
    )
  );
}
