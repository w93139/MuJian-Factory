"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, type ReactNode } from "react";
import { Film } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";
import { redirectForAnonymous } from "@/lib/authApi";
const links = [
  ["/", "创作首页"],
  ["/?view=projects", "我的项目"],
  ["/sandbox", "临时工作台"],
  ["/pipelines/standard", "文艺短视频"],
  ["/pipelines/action-transfer", "动作迁移"],
  ["/pipelines/digital-human", "数字人口播"],
];
export default function LiveShell({ children }: { children: ReactNode }) {
  const auth = useAuth(),
    path = usePathname(),
    q = useSearchParams();
  const landing = path === "/" && !q.get("session") && !q.get("view");
  useEffect(() => {
    if (
      !auth.loading &&
      !auth.error &&
      auth.role === "anonymous" &&
      auth.public_mode
    )
      redirectForAnonymous();
  }, [auth.loading, auth.error, auth.role, auth.public_mode]);
  return (
    <div className={"concept v3 director live " + (landing ? "landing" : "")}>
      <a href="#main-content" className="skip-link">
        跳到主要内容
      </a>
      <header className="live-header">
        <Link className="brand" href="/">
          <span className="brand-symbol">
            <Film size={22} />
          </span>
          <strong>
            幕间<span>Mujian</span>
          </strong>
        </Link>
        <nav aria-label="主导航">
          {links.map(([href, label]) => (
            <Link key={href} href={href}>
              {label}
            </Link>
          ))}
          {auth.canEdit && <Link href="/settings">设置</Link>}
        </nav>
        <div className="live-account">
          {auth.public_mode && auth.role !== "anonymous" && (
            <button
              onClick={() => void auth.logout().catch(() => auth.refresh())}
            >
              退出登录
            </button>
          )}
          {!auth.canEdit && auth.role === "guest" && <span>只读展示</span>}
        </div>
      </header>
      <main id="main-content" className="live-main">
        {auth.error ? (
          <div className="live-error" role="alert">
            {auth.error}
            <button onClick={() => void auth.refresh()}>重试</button>
          </div>
        ) : auth.loading ? (
          <p>正在读取身份</p>
        ) : path === "/login" ||
          !auth.public_mode ||
          auth.role !== "anonymous" ? (
          children
        ) : (
          <p>正在打开登录页</p>
        )}
      </main>
    </div>
  );
}
