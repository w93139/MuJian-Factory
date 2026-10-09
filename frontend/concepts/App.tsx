"use client";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import {
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  Clapperboard,
  FlaskConical,
  FolderOpen,
  Film,
  Home as HomeIcon,
  LogOut,
  Menu,
  Repeat2,
  Settings,
  Sparkles,
  UserRound,
  X,
  Clock3,
} from "lucide-react";
import { DemoProvider, useDemo } from "./context";
import { PIPELINES, STAGES, variants, type Variant } from "./data";
import { Badge, Empty } from "./ui";
import { ConceptHome } from "./Home";
import { Workflow } from "./Workflow";
import { ToolPage } from "./Tools";
import { LoginPage, SettingsPage } from "./Manage";
const mainNav = [
  { href: "/", name: "创作首页", icon: HomeIcon },
  { href: "/?view=projects", name: "我的项目", icon: FolderOpen },
  { href: "/sandbox", name: "临时工作台", icon: FlaskConical },
];
const icons = {
  standard: Clapperboard,
  action_transfer: Repeat2,
  digital_human: UserRound,
};
function Navigation({
  mobile = false,
  onSelect,
}: {
  mobile?: boolean;
  onSelect?: () => void;
}) {
  const { canEdit } = useDemo(),
    path = usePathname(),
    q = useSearchParams();
  return (
    <nav aria-label={mobile ? "移动导航" : "主导航"} className="navigation">
      <span className="nav-caption">创作空间</span>
      {mainNav.map((n) => {
        const Icon = n.icon;
        const active =
          n.href === "/"
            ? path === "/" && !q.get("view")
            : n.href.startsWith("/?")
              ? q.get("view") === "projects"
              : path === n.href;
        return (
          <Link
            onClick={onSelect}
            key={n.href}
            className={active ? "active" : ""}
            href={n.href}
          >
            <Icon size={18} />
            <span>{n.name}</span>
            {active && <i />}
          </Link>
        );
      })}
      <span className="nav-caption">快捷流水线</span>
      {PIPELINES.map((p) => {
        const Icon = icons[p.id];
        return (
          <Link
            onClick={onSelect}
            key={p.id}
            href={p.route}
            className={path === p.route ? "active" : ""}
          >
            <Icon size={18} />
            <span>{p.name}</span>
          </Link>
        );
      })}
      {canEdit && (
        <Link
          onClick={onSelect}
          href="/settings"
          className={path === "/settings" ? "active" : ""}
        >
          <Settings size={18} />
          <span>设置与管理</span>
        </Link>
      )}
    </nav>
  );
}
function Logo() {
  return (
    <Link className="brand" href="/">
      <span className="brand-symbol">
        <Film size={22} />
      </span>
      <strong>
        幕间<span>Mujian</span>
      </strong>
    </Link>
  );
}
function DemoBar() {
  const { variant, state, canEdit, act } = useDemo(),
    router = useRouter();
  return (
    <div className="demo-bar">
      <span>
        <i />
        演示模式 <em>预置媒体 · 不调用模型</em>
      </span>
      <div>
        {variant !== "director" && (
          <span className="concept-label">
            {variants[variant].letter} / {variants[variant].name}
          </span>
        )}
        {canEdit ? (
          <>
            <button
              onClick={() => {
                act({ type: "login", role: "guest", code: "MUJIANDEMO" });
                router.push("/");
              }}
            >
              只读视角
            </button>
            <details
              className="scenario-menu"
              onClickCapture={(e) => {
                if ((e.target as HTMLElement).closest("button"))
                  e.currentTarget.open = false;
              }}
            >
              <summary>演示场景</summary>
              <div>
                {[
                  ["success", "完整作品"],
                  ["running", "生成中"],
                  ["waiting", "待确认"],
                  ["error", "失败恢复"],
                  ["stopped", "已停止"],
                  ["empty", "空内容"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    onClick={() => {
                      act({ type: "scenario", scenario: value });
                      router.push(
                        ["running", "waiting", "error", "stopped"].includes(
                          value,
                        )
                          ? "/?session=demo-orbit&stage=reference_generation"
                          : "/",
                      );
                    }}
                  >
                    {state.scenario === value && <Check size={12} />} {label}
                  </button>
                ))}
              </div>
            </details>
          </>
        ) : (
          <Link href="/login">切换演示身份</Link>
        )}
      </div>
    </div>
  );
}
function Shell({ children }: { children: ReactNode }) {
  const { variant, state, ready, toast, tasks, projects, canEdit, act } =
      useDemo(),
    path = usePathname(),
    router = useRouter(),
    q = useSearchParams();
  const landing =
    path === "/" && !q.get("session") && q.get("view") !== "projects";
  const topNavigation =
    variant === "gallery" || (variant === "director" && landing);
  const [menu, setMenu] = useState(false),
    [taskPanel, setTaskPanel] = useState(false);
  const activeTasks = tasks.filter(
    (t) => t.status === "running" || t.status === "waiting",
  );
  useEffect(() => {
    if (ready && state.role === "anonymous" && path !== "/login")
      router.replace("/login" + (state.guest_code ? "?expired=1" : ""));
  }, [ready, state.role, state.guest_code, path, router]);
  if (!ready)
    return (
      <div className={"concept v3 " + variant + (landing ? " landing" : "")}>
        <div className="loading-state">
          <Film size={35} />
          <p>正在打开你的创作空间…</p>
        </div>
      </div>
    );
  return (
    <div
      className={"concept v3 " + variant + (landing ? " landing" : "")}
      data-variant={variant}
    >
      <a href="#main-content" className="skip-link">
        跳到主要内容
      </a>
      <DemoBar />
      {path === "/login" ? (
        <main id="main-content">{children}</main>
      ) : (
        <>
          <div className="app-frame">
            {variant !== "gallery" && !(variant === "director" && landing) && (
              <aside
                className={
                  "sidebar " +
                  (variant === "guided" ? "studio-rail" : "agent-sidebar")
                }
              >
                <Logo />
                {variant !== "director" && (
                  <div className="workspace-label">
                    <span>个人工作室</span>
                    <ChevronRight size={14} />
                  </div>
                )}
                <Navigation />
                <div className="sidebar-bottom">
                  {variant !== "director" && (
                    <div className="budget-mini">
                      <span>今日演示用量</span>
                      <strong>
                        ¥ 3.60 <small>/ ¥ {state.settings.budget}</small>
                      </strong>
                      <div className="mini-progress">
                        <i style={{ width: "18%" }} />
                      </div>
                    </div>
                  )}
                  <div className="account">
                    <span className="avatar">间</span>
                    <span>
                      {canEdit ? "幕间创作者" : "只读访客"}
                      {variant !== "director" && <small>本地演示空间</small>}
                    </span>
                  </div>
                </div>
              </aside>
            )}
            <div className="app-main">
              <header className="app-header">
                {topNavigation ? (
                  <Logo />
                ) : (
                  <div className="breadcrumbs">
                    {variant !== "director" && (
                      <>
                        个人工作室 <ChevronRight size={14} />
                      </>
                    )}
                    <strong>
                      {path === "/settings"
                        ? "设置与管理"
                        : path === "/sandbox"
                          ? "临时工作台"
                          : PIPELINES.find((p) => p.route === path)?.name ||
                            "创作空间"}
                    </strong>
                  </div>
                )}
                {topNavigation && (
                  <div className="header-nav">
                    <Navigation />
                  </div>
                )}
                <div className="header-actions">
                  <button
                    className="icon-button mobile-toggle"
                    aria-label="打开导航"
                    onClick={() => setMenu(!menu)}
                  >
                    <Menu size={21} />
                  </button>
                  <button
                    className="task-button"
                    onClick={() => setTaskPanel(!taskPanel)}
                  >
                    <Clock3 size={17} />
                    <span>任务</span>
                    <b>
                      {activeTasks.length +
                        projects.filter((p) =>
                          ["running", "waiting"].includes(
                            p.status[p.current_stage],
                          ),
                        ).length}
                    </b>
                  </button>
                  <button
                    className="icon-button"
                    aria-label="退出演示账户"
                    onClick={() => {
                      act({ type: "logout" });
                      router.push("/login");
                    }}
                  >
                    <LogOut size={17} />
                  </button>
                  <span className="avatar small">间</span>
                </div>
              </header>
              {menu && (
                <div className="mobile-nav">
                  <Navigation mobile onSelect={() => setMenu(false)} />
                </div>
              )}
              {!canEdit && (
                <div className="readonly-banner">
                  <BookOpen size={15} />
                  展示模式：仅可浏览示例作品
                  <span>创作过程与媒体均为预置演示内容</span>
                </div>
              )}
              <main id="main-content" className="page-content">
                {state.role !== "anonymous" ? children : <p>正在前往登录…</p>}
              </main>
              {variant !== "director" && (
                <footer className="app-footer">
                  <span>幕间 Mujian · 让每个故事走向银幕</span>
                  <span>{variants[variant].name} / 本地前端探索</span>
                </footer>
              )}
            </div>
          </div>
          {taskPanel && (
            <aside className="task-drawer" aria-label="任务中心">
              <div className="section-head">
                <h2>任务中心</h2>
                <button
                  className="icon-button"
                  aria-label="关闭任务中心"
                  onClick={() => setTaskPanel(false)}
                >
                  <X size={20} />
                </button>
              </div>
              <p className="muted">离开页面后，演示任务仍会继续。</p>
              {projects
                .filter((p) =>
                  Object.values(p.status).some((s) =>
                    ["running", "waiting", "stopped", "error"].includes(s),
                  ),
                )
                .map((p) => (
                  <Link
                    className="task-row"
                    key={p.session_id}
                    href={
                      "/?session=" + p.session_id + "&stage=" + p.current_stage
                    }
                    onClick={() => setTaskPanel(false)}
                  >
                    <Film size={19} />
                    <span>
                      <strong>{p.title}</strong>
                      <small>
                        {STAGES.find((s) => s.id === p.current_stage)?.name}
                      </small>
                    </span>
                    <Badge status={p.status[p.current_stage]} />
                  </Link>
                ))}
              {tasks.map((t) => (
                <Link
                  className="task-row"
                  key={t.task_id}
                  href={
                    (t.pipeline
                      ? PIPELINES.find((p) => p.id === t.pipeline)?.route
                      : "/sandbox") +
                    "?task=" +
                    t.task_id
                  }
                  onClick={() => setTaskPanel(false)}
                >
                  <Sparkles size={18} />
                  <span>
                    <strong>{t.title}</strong>
                    <small>{t.pipeline ? "快捷流水线" : "临时工作台"}</small>
                  </span>
                  <Badge status={t.status} />
                </Link>
              ))}
              {!tasks.length && !projects.length && (
                <Empty
                  title="暂无任务"
                  hint="完成一次创作后，进度会出现在这里。"
                />
              )}
            </aside>
          )}
        </>
      )}
      {toast && (
        <div role="status" className="toast">
          <Check size={16} />
          {toast}
        </div>
      )}
    </div>
  );
}
export function ConceptRoot({
  variant,
  children,
}: {
  variant: Variant;
  children: ReactNode;
}) {
  return (
    <Suspense
        fallback={
          <div className={`concept v3 ${variant}`} data-variant={variant}>
            <div className="loading-state">正在打开创作空间…</div>
          </div>
        }
      >
        <DemoProvider variant={variant}>
          <Shell>{children}</Shell>
        </DemoProvider>
      </Suspense>
  );
}
export function ConceptPage() {
  const path = usePathname(),
    params = useSearchParams();
  const { projects, canEdit } = useDemo();
  if (path === "/login") return <LoginPage />;
  if (path === "/settings")
    return canEdit ? (
      <SettingsPage />
    ) : (
      <Empty title="此页面仅管理员可用" hint="你可以从创作首页浏览公开示例。">
        <Link className="button primary" href="/">
          查看示例
        </Link>
      </Empty>
    );
  if (path === "/sandbox") return <ToolPage />;
  const pipeline = PIPELINES.find((p) => p.route === path);
  if (pipeline) return <ToolPage pipeline={pipeline.id} />;
  const id = params.get("session");
  if (id) {
    const project = projects.find((p) => p.session_id === id);
    return project ? (
      <Workflow project={project} />
    ) : (
      <Empty
        title="作品不存在或尚未开放"
        hint="只读视角仅能查看开放的示例作品。"
      >
        <Link href="/" className="button primary">
          返回创作空间
        </Link>
      </Empty>
    );
  }
  return <ConceptHome />;
}
export function QuickLinks() {
  return (
    <div className="quick-links">
      {PIPELINES.map((p, i) => (
        <Link href={p.route} key={p.id}>
          <span className="quick-icon">
            {i === 0 ? (
              <Clapperboard size={19} />
            ) : i === 1 ? (
              <Repeat2 size={19} />
            ) : (
              <UserRound size={19} />
            )}
          </span>
          <span>
            <strong>{p.name}</strong>
            <small>{p.hint}</small>
          </span>
          <ArrowUpRight size={18} />
        </Link>
      ))}
      <Link href="/sandbox">
        <span className="quick-icon">
          <FlaskConical size={19} />
        </span>
        <span>
          <strong>临时工作台</strong>
          <small>五种工具，独立试验你的想法</small>
        </span>
        <ArrowUpRight size={18} />
      </Link>
    </div>
  );
}
