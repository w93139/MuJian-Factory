# 幕间三版前端：设计、运行与对接说明

> 已选定 A「光影叙事」，运行入口见根 README。本文保留设计探索记录；comparison.html、research/、screenshots/、verification/ 为本地历史证据，不随 Git 源码提交。
三套覆盖同一业务范围，使用同一演示数据和状态逻辑。它们在首页、导航、工作流布局、素材呈现和视觉体系上不同，便于选择后继续开发。

## 运行

在 `frontend/` 执行 `npm ci`。三个终端分别执行：

```bash
npm run dev:director
npm run dev:guided
npm run dev:gallery
```

对应 http://127.0.0.1:3101、http://127.0.0.1:3102、http://127.0.0.1:3103。三个入口在 `apps/`，有独立 Next.js 构建目录、类型文件、端口和浏览器存储键。通过相对符号链接复用源码与依赖，不需安装三份依赖。启动器固定选择对应版本。

生产构建与本地启动分别为 `npm run build:director` / `npm run start:director`，另外两版替换后缀即可。开发与生产服务使用同一端口，启动生产服务前停止该版开发服务。未设置版本变量时，`npm run dev` 仍进入原始前端，需要原后端。

演示默认使用管理员视角。右上角可切换只读视角；登录页管理员演示密码是 `MUJIAN`，示例邀请码是 `MUJIANDEMO`，均不是真实凭据。演示场景菜单可加载完整作品、运行中、待确认、失败、停止、空内容；切换场景会替换当前版本的演示项目与任务，设置和邀请码保留。

## 第三轮完整视觉重设计

沿用第二轮实测竞品的业务结构，将三版的视觉语言与主视觉动效重新设计。详细来源、源码与限制见 [reference-map-v3.md](reference-map-v3.md)。

| 方向 | 构图、字体与动效 | 工作区延续 |
| --- | --- | --- |
| A 光影叙事 | Threads 全幅光影波浪；整屏三列页头、居中巨型细字、玻璃创作控制台和金属按钮；首页取消常驻侧栏 | 暗色阶段产物审阅流、右侧制作计划；模型参数浮层 |
| B 几何创作台 | 白/黑高对比、锐利大字、半屏6×6 Cubes、荧光贴纸和紫色操作；平铺工具入口与Masonry素材库 | 白底监视器、镜头条、输入/结果分区、清晰黑线表单 |
| C 电影编辑部 | 橙色刊头、宋体大标题、切换真实项目海报、ScrollVelocity阶段字幕、亚麻底编辑区 | 暖纸节点画布与三列故事板、版本/片段关联、黑墨分栏表单 |

三版共享业务命令，首页、导航、制作过程和工具页面采用不同DOM组合。所有既有功能保留；没有把自动测试当成美观的证明。主视觉可暂停，尊重系统减少动态偏好。A WebGL不可用时有静态线场；动画只影响主视觉，不妨碍业务输入。

对比页默认三个真实运行的iframe，可切换静态截图与三个尺寸；离线打开默认静态。每版“打开前端”提供完整宽度，避免缩略预览让细节过小。

## 参考与证据

- 对标实测证据保留于 `research/v2/`；第三轮选用的设计预览、规范及研究在 `research/v3/`。
- 六项实际React Bits源码在 `frontend/concepts/reference/`；Threads固定d86fccbd477786f94ca7eb891fbe0ec039d3cd3b，其余固定63a008de65732d73010bd219d25d15c47739bb31。完整许可为MIT + Commons Clause。
- MotionSites AgentWave提供整屏构图；Refero Figma、StudioThomas、Switch-Lit提供完整规则。本应用不复制品牌、商业字体或未核实第三方视频。
- StudioThomas当前源站已重定向，橙/亚麻只归于Refero保存的预览。Unicorn未使用；SaaSPO/登录限制详见映射。

## 业务范围与演示边界

全部既有路由覆盖：首页/项目、沙盒、三流水线、设置、登录。项目支持六阶段切换、故事方向选择、剧本编辑、续写草稿确认/舍弃、角色与场景、分镜编辑与添加、参考图与片段版本选择、素材上传、局部重生成、停止、重试、继续、按集成片与下载。支持新建多集，续写后派生对应分镜与素材。

各流水线保留不同必填输入：文艺为文案/灵感与输出/配音/字幕配置，动作迁移为图片＋动作视频＋提示词，数字人为人物图＋口播文案及可选商品信息。沙盒包含文字、视觉理解、文生图、图生图和视频。

所有模拟生成使用预置结果，并在界面标识；文字编辑不会改变预置视频内容。`public/demo/` 的视频是使用既有插画在本地合成的 30 秒、1280×720、无声示例，未调用任何付费模型。配音、字幕和生成参数作为任务输入保存，示例媒体不会随参数重新渲染。生成源码在 `scripts/generate-demo-media.py`，可通过 `uv run --with imageio-ffmpeg python scripts/generate-demo-media.py` 重建。

上传在演示中限制为 8MB，并存为本地 Data URL。若浏览器存储超限，会提示当前内容只在本页暂存，刷新可能丢失；生产上传应改用后端返回的稳定媒体路径。文本导入目前支持 TXT、Markdown、JSON，二进制文档解析留待原后端对接，不假装支持。

角色、邀请码、用量、保存全部为本地模拟，不具备生产安全含义。只读视角通过统一 `canEdit`、可见项目/任务过滤和数据层写入检查控制正常 UI 行为；浏览器持有完整 fixture，不能用于存放真实私有数据。后端仍需独立验证认证、可见性、预算和并发。

## 数据层与正式对接

`concepts/data.ts`：统一类型、阶段、模型 fixture、初始项目、状态推进及原始产物转换。

`concepts/repository.ts`：集中命令及修改权限检查，保留启动、读取、介入、确认、停止、版本、上传和设置等语义。

`concepts/context.tsx`：版本独立持久化、订阅状态、演示计时、通知和统一 `useAuth / canEdit` 表达。

页面组件只通过该提供层读写，不直接请求模型或生产后端。`DataAdapter` 定义是后续接口替换边界，当前运行的是本地 reducer 与 fixture，尚未实现正式 HTTP adapter。

| 前端对象/操作 | 原始数据或接口 | 对接要点 |
|---|---|---|
| 项目 | session_id / current_stage / status | 保留稳定会话 ID 和六阶段 ID；项目→剧集→片段→版本 |
| 创建 | POST /api/project/start | idea、file_path、style、ratio/resolution、模型、自动配置；真实文件先上传，不能把本地文件名当服务端路径 |
| 剧本 | artifact.script_generation | UI 的 episode_number/title 映射 act_number/act_title；确认后端实际兼容格式 |
| 分镜 | storyboard.episodes[].segments[].shots[] | 演示每片段一个镜头；真实后端允许片段多个镜头，适配时不能丢失该层级 |
| 角色/场景 | characters[] / settings[] | 保留 id、description、versions、selected、status |
| 参考图/视频 | scenes[] / clips[] | 素材 id 对应 segment_id；确认选中图片/片段传给下游；PATCH 按 ID 合并，不覆盖旧版本 |
| 成片 | final_videos[] | 按 episode 展示；兼容旧 final_video 在正式 adapter 处理 |
| 执行与介入 | execute/{stage} / intervene | 主流程原为 SSE，需将 progress/content/stage_complete/error 驱动提供层；局部更新不能清除其他项 |
| 确认与停止 | continue / stop | continue 返回 next_stage 后再执行；停止保留已有产物 |
| 上传 | upload_file / upload_media / upload_image | 将 Data URL 替换为上传路径；按原后端校验大小、格式、目标类型 |
| 三流水线 | pipelines/{standard,action_transfer,digital_human}/tasks | 参数按各 schema，不共用一个通用表单；任务事件原为 EventSource |
| 沙盒 | sandbox/{tool} | 本轮保留 UI 的 ratio/resolution；原 SandboxVideoRequest 仅有 model/prompt/image，额外字段属于后续契约待确认 |
| 模型 | GET /api/models | 集中按类型与能力获取，正式选择不要硬编码 demo 模型或依赖商标名称 |
| 认证 | authApi / AuthProvider | 替换模拟身份为实际会话；保留统一 canEdit 和后端独立权限验证 |
| 设置/邀请码/用量 | /api/config、/api/admin/invites、/api/admin/usage | 演示 settings 为规范化 UI 对象，需映射原配置嵌套路径；预算与用量字符串精度以原后端为准 |

已知待确认项：原 ScriptStage 有 Logline/模式选择 UI，但查阅原后端未确认 selected_logline/selected_mode 的消费分支；本轮故事方向确认是演示交互。续写原有 smart_continue / confirm_continue / delete_continue 操作应在正式 adapter 映射。文艺字幕模板 ID、模型能力范围、沙盒额外参数与分镜多镜头结构需要联调。不能承诺后续零改动接通。

## 验证

实际执行日志与独立只读审查复核在 `verification/v3/`，汇总对应本轮源文件 hash。前两轮资料保留为历史，不能用旧结果替代第三轮验证。

```bash
./scripts/check.sh
cd frontend
npm run test:concepts
npm run build:director
npm run build:guided
npm run build:gallery
```

全仓检查需要 FFmpeg 与 ffprobe。本机使用任务目录工具和 MUJIAN_FFMPEG / MUJIAN_FFPROBE 环境变量，不改断言或跳过检查；新机器需准备媒体工具。截图覆盖 1440×1000、1024×768、390×844，使用减少动态效果设置稳定捕获动画组件。

检查覆盖入口/媒体/响应式、手动与自动六阶段、编辑/上传/版本、恢复、三流水线/五沙盒、角色、设置、多集/续写、参数保存、存储失败、文本导入，以及新浮层、稳定素材入口、画布缩放/平移/适应、故事板视频版本与镜头定位。

未进行真实用户研究、正式后端联调或完整辅助技术审计。原代码 lint 警告保留，判断通过以实际退出码为准。依赖增加 motion/gsap，未顺带升级原有间接依赖；旧依赖审计不是新依赖状态的证明。

第三轮最终结果见 verification/v3/README.md 与 summary.json；记录源文件hash、完整流程、真实动效/暂停、生产构建及原仓库检查。
