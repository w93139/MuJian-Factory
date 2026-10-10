/** Production adapter: retain backend artifacts verbatim; never serialize demo projections. */
import {
  getProjectStatus,
  saveSelections,
  intervene,
  parseStreamEvents,
  type ProjectStatus,
} from "./workflowApi";

export interface Shot extends Record<string, unknown> {
  shot_id?: string;
  shot_number: number;
  shot_type: string;
  duration: number;
  content: string;
}
export interface Segment extends Record<string, unknown> {
  segment_id: string;
  segment_number: number;
  episode_number?: number;
  location?: string;
  characters?: string[];
  total_duration?: number;
  shots: Shot[];
}
export interface Episode extends Record<string, unknown> {
  episode_id?: string;
  episode_number: number;
  episode_title?: string;
  segments: Segment[];
}
export interface Artifact extends Record<string, any> {
  episodes?: Episode[];
}
export interface Snapshot extends ProjectStatus {
  artifacts: Record<string, Artifact>;
  meta: Record<string, any>;
  stage_progress?: Record<string, { percent?: number; message?: string }>;
}
export async function readProject(id: string): Promise<Snapshot> {
  return (await getProjectStatus(id)) as Snapshot;
}
export async function saveStage(id: string, stage: string, patch: Artifact) {
  const values = structuredClone(patch);
  if (stage === "reference_generation" && Array.isArray(values.scenes)) {
    values.scenes = values.scenes.map((scene: Record<string, unknown>) =>
      typeof scene.description === "string"
        ? { ...scene, visual_prompt: scene.description }
        : scene,
    );
    values.segments = values.scenes
      .filter(
        (scene: Record<string, unknown>) =>
          typeof scene.visual_prompt === "string",
      )
      .map((scene: Record<string, unknown>) => ({
        segment_id: scene.id,
        visual_prompt: scene.visual_prompt,
      }));
  }
  await saveSelections(id, stage, values);
  return readProject(id);
}
export async function runIntervention(
  id: string,
  stage: string,
  modifications: Record<string, unknown>,
  progress: (message: string) => void,
) {
  const response = await intervene(id, stage, modifications);
  for await (const event of parseStreamEvents(response)) {
    if (event.type === "error")
      throw new Error(event.content || event.message || "阶段处理失败");
    if (event.type === "progress")
      progress(event.message || event.step_desc || "正在处理");
  }
  return readProject(id);
}

export function shotDescription(shot: Shot): string {
  return String(shot.plot || shot.content || shot.description || "");
}
export function withShotDescription(shot: Shot, text: string): Partial<Shot> {
  return {
    content: text,
    ...("plot" in shot ? { plot: text } : {}),
    ...("description" in shot ? { description: text } : {}),
  };
}
export function mediaUrl(path: string): string {
  if (/^(https?:|blob:|data:)/.test(path)) return path;
  const code = path.indexOf("/code/");
  if (code >= 0) return path.slice(code);
  if (path.startsWith("result/")) return "/code/" + path;
  if (path.startsWith("/result/")) return "/code" + path;
  return path.startsWith("/") ? path : "/" + path;
}
