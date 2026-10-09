"use client";
import {
  cloneElement,
  isValidElement,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { Check, ChevronDown, Download, ImagePlus, Play, X } from "lucide-react";
import { statusLabel, type Status, type Tool } from "./data";
import { useDemo } from "./context";
export function Badge({ status }: { status: Status }) {
  return (
    <span className={"status status-" + status}>
      <i />
      {statusLabel[status]}
    </span>
  );
}
export function Button({
  children,
  onClick,
  secondary = false,
  disabled = false,
  type = "button",
  className = "",
  label,
}: {
  children: ReactNode;
  onClick?: () => void;
  secondary?: boolean;
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
  label?: string;
}) {
  return (
    <button
      type={type}
      aria-label={label}
      disabled={disabled}
      onClick={onClick}
      className={
        (secondary ? "button secondary" : "button primary") + " " + className
      }
    >
      {children}
    </button>
  );
}
export function Field({
  label,
  children,
  hint,
}: {
  label: string;
  children: ReactNode;
  hint?: string;
}) {
  const id = useId();
  const control = isValidElement<{
    id?: string;
    "aria-labelledby"?: string;
    "aria-describedby"?: string;
  }>(children)
    ? cloneElement(children, {
        id,
        "aria-labelledby": id + "-label",
        "aria-describedby": hint ? id + "-hint" : undefined,
      })
    : children;
  return (
    <div className="field">
      <label id={id + "-label"} htmlFor={id}>
        {label}
      </label>
      {control}
      {hint && <small id={id + "-hint"}>{hint}</small>}
    </div>
  );
}
export function ModelSelect({
  type,
  value,
  onChange,
  label = "模型",
}: {
  type: Tool;
  value: string;
  onChange: (v: string) => void;
  label?: string;
}) {
  const { models } = useDemo();
  return (
    <Field label={label}>
      <select value={value} onChange={(e) => onChange(e.target.value)}>
        {models
          .filter((m) => m.model_type === type)
          .map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
      </select>
    </Field>
  );
}
export function SectionHead({
  eyebrow,
  title,
  children,
}: {
  eyebrow?: string;
  title: string;
  children?: ReactNode;
}) {
  return (
    <div className="section-head">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {children}
    </div>
  );
}
export function Empty({
  title = "这里还没有内容",
  hint = "从一个想法开始，第一部作品就在下一步。",
  children,
}: {
  title?: string;
  hint?: string;
  children?: ReactNode;
}) {
  return (
    <div className="empty">
      <span className="empty-orbit">
        <Play size={25} />
      </span>
      <h3>{title}</h3>
      <p>{hint}</p>
      {children}
    </div>
  );
}
export function Media({
  src,
  alt,
  video = false,
  className = "",
}: {
  src: string;
  alt: string;
  video?: boolean;
  className?: string;
}) {
  return video ? (
    <video
      key={src}
      src={src}
      poster={
        src.startsWith("/demo/")
          ? src.includes("alternate")
            ? "/ui/inspiration-mars.png"
            : "/ui/inspiration-space.png"
          : undefined
      }
      controls
      playsInline
      preload="metadata"
      aria-label={alt}
      className={"media " + className}
    />
  ) : (
    <img src={src} alt={alt} className={"media " + className} />
  );
}
export function Upload({
  label,
  onUpload,
  kind = "image",
  value,
  required = false,
}: {
  label: string;
  onUpload: (url: string, name: string) => void;
  kind?: "image" | "video" | "text";
  value?: string;
  required?: boolean;
}) {
  const { notify } = useDemo();
  const inputId = useId();
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const upload = async (file: File) => {
    const formats =
      kind === "image"
        ? /\.(png|jpe?g|webp|bmp)$/i
        : kind === "video"
          ? /\.(mp4|webm|mov)$/i
          : /\.(txt|md|json)$/i;
    if (!formats.test(file.name)) {
      notify(
        "文件格式不支持，请选择" +
          (kind === "image"
            ? "PNG、JPG、WebP 或 BMP 图片"
            : kind === "video"
              ? "MP4、WebM 或 MOV 视频"
              : "TXT、Markdown 或 JSON 文本"),
      );
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      notify("演示上传限制为 8MB，请选择较小文件。");
      return;
    }
    setBusy(true);
    try {
      const reader = new FileReader();
      reader.onload = () => {
        onUpload(String(reader.result), file.name);
        setName(file.name);
        setBusy(false);
      };
      reader.onerror = () => {
        notify("文件读取失败，请重试");
        setBusy(false);
      };
      if (kind === "text") reader.readAsText(file);
      else reader.readAsDataURL(file);
    } catch {
      setBusy(false);
      notify("无法读取文件。");
    }
  };
  return (
    <div className="upload-wrap">
      <label
        htmlFor={inputId}
        className={"upload-zone " + (value ? "has-file" : "")}
      >
        <input
          id={inputId}
          aria-label={label}
          type="file"
          accept={
            kind === "image"
              ? ".png,.jpg,.jpeg,.webp,.bmp"
              : kind === "video"
                ? ".mp4,.webm,.mov"
                : ".txt,.md,.json"
          }
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void upload(f);
          }}
        />
        {value && kind !== "text" ? (
          <Media src={value} alt={label} video={kind === "video"} />
        ) : (
          <ImagePlus size={22} />
        )}
        <strong>
          {busy ? "正在读取…" : name || label}
          {required && !value ? " *" : ""}
        </strong>
        <small>
          {value ? "重新选择文件" : "点击上传 · 本地演示 · 最大 8MB"}
        </small>
      </label>
    </div>
  );
}
export function Disclosure({
  title,
  children,
  open = false,
}: {
  title: string;
  children: ReactNode;
  open?: boolean;
}) {
  return (
    <details className="disclosure" open={open || undefined}>
      <summary>
        {title}
        <ChevronDown size={15} />
      </summary>
      <div className="disclosure-body">{children}</div>
    </details>
  );
}
export function Modal({
  title,
  children,
  onClose,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLElement>(null);
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLElement>("button")?.focus();
    const handler = (event: KeyboardEvent) => {
      if (event.key !== "Tab") return;
      const nodes = dialog.current?.querySelectorAll<HTMLElement>(
        'button,a[href],input,select,textarea,[tabindex="0"]',
      );
      if (!nodes?.length) return;
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", handler);
    return () => {
      document.removeEventListener("keydown", handler);
      previous?.focus();
    };
  }, []);
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="modal"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        <div className="section-head">
          <h2>{title}</h2>
          <button
            className="icon-button"
            aria-label="关闭预览"
            onClick={onClose}
          >
            <X size={22} />
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
export function DownloadLink({
  src,
  label = "下载示例视频",
}: {
  src: string;
  label?: string;
}) {
  return (
    <a className="button secondary" href={src} download="幕间-演示成片.mp4">
      <Download size={16} />
      {label}
    </a>
  );
}
export function SaveMark() {
  const { persisted } = useDemo();
  return (
    <span className="save-mark">
      <Check size={13} />
      {persisted ? "本地演示已保存" : "仅本页暂存 · 刷新可能丢失"}
    </span>
  );
}
