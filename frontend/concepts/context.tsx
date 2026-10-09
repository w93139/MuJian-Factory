"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  MODELS,
  advance,
  canEdit,
  initialState,
  visibleProjects,
  visibleTasks,
  type DemoState,
  type Variant,
} from "./data";
import { guestSessionValid, reduceCommand, type Command } from "./repository";
interface ContextValue {
  state: DemoState;
  variant: Variant;
  ready: boolean;
  persisted: boolean;
  canEdit: boolean;
  projects: ReturnType<typeof visibleProjects>;
  tasks: ReturnType<typeof visibleTasks>;
  models: typeof MODELS;
  act: (command: Command) => string | undefined;
  notify: (message: string) => void;
  toast: string;
}
const DemoContext = createContext<ContextValue | null>(null);
export function DemoProvider({
  variant,
  children,
}: {
  variant: Variant;
  children: ReactNode;
}) {
  const [state, setState] = useState<DemoState>(initialState);
  const [ready, setReady] = useState(false);
  const [persisted, setPersisted] = useState(true);
  const [toast, setToast] = useState("");
  const ref = useRef(state);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const notify = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4200);
  }, []);
  const commit = useCallback(
    (next: DemoState) => {
      ref.current = next;
      setState(next);
      try {
        localStorage.setItem(
          "mujian-concept-v1-" + variant,
          JSON.stringify(next),
        );
        setPersisted(true);
        return true;
      } catch {
        setPersisted(false);
        notify("本地存储不可用：内容仅在当前页面暂存，刷新可能丢失。");
        return false;
      }
    },
    [variant, notify],
  );
  useEffect(() => {
    let loaded = initialState();
    try {
      const raw = localStorage.getItem("mujian-concept-v1-" + variant);
      if (raw) {
        const parsed = JSON.parse(raw) as DemoState;
        if (
          Array.isArray(parsed.projects) &&
          Array.isArray(parsed.tasks) &&
          parsed.settings &&
          parsed.invites
        )
          loaded = parsed;
      }
    } catch {
      /* Corrupt demo storage falls back to an isolated fixture. */
    }
    if (!guestSessionValid(loaded)) {
      loaded.role = "anonymous";
    }
    ref.current = loaded;
    setState(loaded);
    setReady(true);
  }, [variant]);
  useEffect(() => {
    if (!ready) return;
    const timer = setInterval(() => {
      let next = advance(ref.current);
      if (!guestSessionValid(next)) {
        next = { ...next, role: "anonymous" };
      }
      if (next !== ref.current) commit(next);
    }, 850);
    return () => clearInterval(timer);
  }, [ready, commit]);
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    [],
  );
  const act = useCallback(
    (command: Command) => {
      try {
        const result = reduceCommand(ref.current, command);
        const saved = commit(result.state);
        if (saved) notify(result.message);
        return result.id || "ok";
      } catch (e) {
        notify(e instanceof Error ? e.message : "操作失败，请重试。");
        return undefined;
      }
    },
    [commit, notify],
  );
  return (
    <DemoContext.Provider
      value={{
        state,
        variant,
        ready,
        persisted,
        canEdit: canEdit(state),
        projects: visibleProjects(state),
        tasks: visibleTasks(state),
        models: MODELS,
        act,
        notify,
        toast,
      }}
    >
      {children}
    </DemoContext.Provider>
  );
}
export function useDemo() {
  const ctx = useContext(DemoContext);
  if (!ctx) throw new Error("演示数据提供层未加载");
  return ctx;
}
export function useAuth() {
  const { state, canEdit } = useDemo();
  return { role: state.role, public_mode: state.public_mode, canEdit };
}
