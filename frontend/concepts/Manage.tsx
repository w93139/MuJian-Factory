"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import {
  ArrowRight,
  Copy,
  Film,
  KeyRound,
  LockKeyhole,
  Plus,
  Save,
  ShieldCheck,
  UserRound,
} from "lucide-react";
import { useDemo } from "./context";
import { SPACE, styleLabels, type Tool } from "./data";
import {
  Button,
  Disclosure,
  Field,
  Media,
  ModelSelect,
  SectionHead,
} from "./ui";
export function LoginPage() {
  const { act, notify, variant } = useDemo(),
    router = useRouter(),
    q = useSearchParams();
  const [mode, setMode] = useState<"guest" | "admin">("guest"),
    [value, setValue] = useState(q.get("code") || "");
  const enter = () => {
    if (mode === "admin" && value !== "MUJIAN") {
      notify("演示密码为 MUJIAN，请重新输入。");
      return;
    }
    const result = act({
      type: "login",
      role: mode,
      code: mode === "guest" ? value : undefined,
    });
    if (result) router.push("/");
  };
  return (
    <section className="login-page">
      <div className="login-art">
        <Media src={SPACE} alt="宇航员与蓝色地球" />
        <div>
          {variant !== "director" && (
            <p className="eyebrow">MUJIAN / EVERY STORY MATTERS</p>
          )}
          <h1>
            {variant === "director" ? "故事之间" : "故事之间，"}
            <br />
            {variant === "director" ? "总有新的可能" : "总有新的可能。"}
          </h1>
          {variant !== "director" && <p>看见作品，也看见作品背后的每一步。</p>}
        </div>
      </div>
      <div className="login-form-wrap">
        <Link className="brand" href="/">
          <span className="brand-symbol">
            <Film size={24} />
          </span>
          <strong>
            幕间<span>Mujian</span>
          </strong>
        </Link>
        {variant !== "director" && (
          <p className="eyebrow">欢迎来到你的创作空间</p>
        )}
        <h2>
          {variant === "director"
            ? "登录幕间"
            : mode === "guest"
              ? "以作品，开始一场对话。"
              : "准备好讲述你的故事。"}
        </h2>
        <p>当前为本地演示，身份与认证均为模拟。</p>
        {q.get("expired") === "1" && (
          <p role="alert" className="inline-error">
            邀请码已失效或已过期，请重新登录。
          </p>
        )}
        <div className="segmented">
          <button
            className={mode === "guest" ? "active" : ""}
            onClick={() => {
              setMode("guest");
              setValue("");
            }}
          >
            <UserRound size={16} />
            邀请码访问
          </button>
          <button
            className={mode === "admin" ? "active" : ""}
            onClick={() => {
              setMode("admin");
              setValue("");
            }}
          >
            <ShieldCheck size={16} />
            管理员演示
          </button>
        </div>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            enter();
          }}
        >
          <Field
            label={mode === "guest" ? "邀请码" : "演示密码"}
            hint={
              mode === "guest"
                ? "示例邀请码：MUJIANDEMO"
                : "演示密码：MUJIAN（不是正式账号凭据）"
            }
          >
            <input
              type={mode === "guest" ? "text" : "password"}
              value={value}
              onChange={(e) => setValue(e.target.value)}
              placeholder={mode === "guest" ? "输入邀请码" : "输入演示密码"}
              autoComplete="off"
            />
          </Field>
          <Button type="submit">
            进入幕间
            <ArrowRight size={17} />
          </Button>
        </form>
        <div className="login-promise">
          <LockKeyhole size={17} />
          <span>
            {mode === "guest"
              ? "只读访问开放的作品与创作过程。"
              : "可编辑演示内容，无真实生成费用。"}
          </span>
        </div>
        {variant !== "director" && (
          <small className="login-footer">
            幕间 ·{" "}
            {variant === "guided" ? "轻量创作台" : "作品与创作空间"}
          </small>
        )}
      </div>
    </section>
  );
}
export function SettingsPage() {
  const { variant, state, act, notify } = useDemo();
  const [tab, setTab] = useState("creation"),
    [values, setValues] = useState({
      ...state.settings,
      models: { ...state.settings.models },
    }),
    [note, setNote] = useState(""),
    [hours, setHours] = useState(24),
    [now] = useState(() => Date.now());
  const copy = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      notify("邀请码已复制。");
    } catch {
      notify("请选中邀请码手动复制。");
    }
  };
  return (
    <div className="settings-page">
      <div className="tool-page-heading">
        <div>
          {variant !== "director" && (
            <p className="eyebrow">MAKE THIS SPACE YOURS</p>
          )}
          <h1>设置与管理</h1>
          {variant !== "director" && (
            <p>调整创作偏好，管理作品展示与演示访问。</p>
          )}
        </div>
        <span className="admin-pill">
          <ShieldCheck size={15} />
          管理员演示
        </span>
      </div>
      <div className="settings-layout">
        <nav className="settings-nav" aria-label="设置分类">
          {[
            ["creation", "创作偏好"],
            ["models", "模型与接入"],
            ["invites", "邀请码与用量"],
          ].map(([v, l]) => (
            <button
              className={tab === v ? "active" : ""}
              onClick={() => setTab(v)}
              key={v}
            >
              {l}
              <ArrowRight size={15} />
            </button>
          ))}
        </nav>
        <section className="settings-card">
          {tab === "creation" && (
            <>
              <SectionHead title="创作偏好" />
              <p className="muted">
                作为新项目和工具页面的默认值，不会覆盖已有项目。
              </p>
              <div className="form-grid">
                <Field label="默认视觉风格">
                  <select
                    value={values.style}
                    onChange={(e) =>
                      setValues({ ...values, style: e.target.value })
                    }
                  >
                    {Object.entries(styleLabels).map(([v, l]) => (
                      <option key={v} value={v}>
                        {l}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label="默认画幅">
                  <select
                    value={values.ratio}
                    onChange={(e) =>
                      setValues({ ...values, ratio: e.target.value })
                    }
                  >
                    {["16:9", "9:16", "1:1"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field label="默认分辨率">
                  <select
                    value={values.resolution}
                    onChange={(e) =>
                      setValues({ ...values, resolution: e.target.value })
                    }
                  >
                    {["720P", "1080P"].map((v) => (
                      <option key={v}>{v}</option>
                    ))}
                  </select>
                </Field>
                <Field label="默认视频生成方式">
                  <select
                    value={values.video_mode}
                    onChange={(e) =>
                      setValues({ ...values, video_mode: e.target.value })
                    }
                  >
                    <option value="first_frame">首帧生成</option>
                    <option value="start_end">首尾帧生成</option>
                    <option value="reference">参考图生成</option>
                  </select>
                </Field>
              </div>
              <div className="preference-row">
                <div>
                  <h3>素材并行</h3>
                  <p>在能力允许时，同时处理多个素材。</p>
                </div>
                <input
                  aria-label="允许素材并行"
                  type="checkbox"
                  checked={values.concurrency}
                  onChange={(e) =>
                    setValues({ ...values, concurrency: e.target.checked })
                  }
                />
              </div>
              <div className="preference-row">
                <div>
                  <h3>联网参考</h3>
                  <p>演示模式只保存偏好，不访问外部搜索。</p>
                </div>
                <input
                  aria-label="默认联网参考"
                  type="checkbox"
                  checked={values.web_search}
                  onChange={(e) =>
                    setValues({ ...values, web_search: e.target.checked })
                  }
                />
              </div>
            </>
          )}
          {tab === "models" && (
            <>
              <SectionHead title="模型与接入" />
              <p className="muted">
                以下模型是集中维护的演示选项，正式能力以服务端注册表为准。
              </p>
              <div className="form-grid">
                {(["llm", "vlm", "t2i", "i2i", "video"] as Tool[]).map((t) => (
                  <ModelSelect
                    key={t}
                    type={t}
                    value={values.models[t]}
                    label={
                      {
                        llm: "文本模型",
                        vlm: "图片理解",
                        t2i: "文生图",
                        i2i: "图生图",
                        video: "视频生成",
                      }[t]
                    }
                    onChange={(v) =>
                      setValues({
                        ...values,
                        models: { ...values.models, [t]: v },
                      })
                    }
                  />
                ))}
              </div>
              <Disclosure title="高级接入配置">
                <Field
                  label="兼容接口地址"
                  hint="只保存在本地演示，不会发送请求或写入生产配置。"
                >
                  <input
                    type="url"
                    value={values.provider_url}
                    onChange={(e) =>
                      setValues({ ...values, provider_url: e.target.value })
                    }
                    placeholder="https://example.com/v1"
                  />
                </Field>
                <div className="info-panel">
                  <KeyRound size={19} />
                  <p>
                    真实 API Key 应由后端保管。前端演示不收集或显示真实密钥。
                  </p>
                </div>
              </Disclosure>
            </>
          )}
          {tab === "invites" && (
            <>
              <SectionHead title="今日演示用量" />
              <div className="usage-stats">
                <div>
                  <span>估算金额</span>
                  <strong>¥ 3.60</strong>
                  <small>预置示例，无实际费用</small>
                </div>
                <div>
                  <span>每日额度</span>
                  <strong>¥ {state.settings.budget.toFixed(2)}</strong>
                  <small>正式账单以模型平台为准</small>
                </div>
                <div>
                  <span>演示任务</span>
                  <strong>{state.tasks.length}</strong>
                  <small>包含流水线与沙盒</small>
                </div>
              </div>
              <Field label="每日估算额度（元）">
                <input
                  type="number"
                  min={0}
                  value={values.budget}
                  onChange={(e) =>
                    setValues({ ...values, budget: Number(e.target.value) })
                  }
                />
              </Field>
              <SectionHead title="作品展示邀请码" />
              <p className="muted">
                邀请码账户只能查看开放的示例，不能创作或修改。
              </p>
              <form
                className="invite-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  act({ type: "invite", note, hours });
                  setNote("");
                }}
              >
                <Field label="备注">
                  <input
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="例如：作品展示访问"
                  />
                </Field>
                <Field label="有效时长（小时）">
                  <input
                    type="number"
                    min={1}
                    max={720}
                    value={hours}
                    onChange={(e) => setHours(Number(e.target.value))}
                  />
                </Field>
                <Button type="submit">
                  <Plus size={16} />
                  生成邀请码
                </Button>
              </form>
              <div className="invite-list">
                {state.invites.map((i) => (
                  <div className="invite-row" key={i.code}>
                    <div>
                      <code>{i.code}</code>
                      <p>
                        {i.note} ·{" "}
                        {i.revoked
                          ? "已作废"
                          : i.expires_at < now
                            ? "已过期"
                            : "有效至 " +
                              new Date(i.expires_at).toLocaleString("zh-CN", {
                                timeZone: "Asia/Shanghai",
                              })}
                      </p>
                    </div>
                    <div className="actions">
                      <button
                        className="icon-button"
                        aria-label={"复制邀请码 " + i.code}
                        onClick={() => void copy(i.code)}
                      >
                        <Copy size={15} />
                      </button>
                      <Button
                        secondary
                        disabled={i.revoked}
                        onClick={() => act({ type: "revoke", code: i.code })}
                      >
                        作废
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
          <div className="settings-save">
            <span>保存仅影响当前版本的本地演示。</span>
            <Button onClick={() => act({ type: "settings", values })}>
              <Save size={16} />
              保存设置
            </Button>
          </div>
        </section>
      </div>
    </div>
  );
}
