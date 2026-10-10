// Presentation labels for the six existing backend workflow stages.
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
export const statusLabel: Record<Status, string> = {
  pending: "等待中",
  running: "生成中",
  waiting: "待确认",
  completed: "已完成",
  error: "失败",
  stopped: "已停止",
};
