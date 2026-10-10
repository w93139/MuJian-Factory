# 工具与后端契约核查

核查日期：2026-10-10。正式源码位于根 frontend/backend；新前端设计保留目录中的 Tools 是演示版本，不代表后端联调结果。此次正式页面复用成熟 Sandbox/PipelinePage，与统一 frontend/lib/workflowApi 请求、useAuth 权限共用。

## 分类

- A：后端已支持，新设计尚未接入。
- B：原前端控件存在，后端未消费。
- C：新设计自行增加的演示交互。
- D：证据不足或不能证明运行效果。

## 控件 → 字段 → 接口 → 消费链

| 控件/能力 | 分类 | 证据与当前处理 |
| --- | --- | --- |
| 梗概选择/确认 | B；新设计硬编码第二候选为 C | 原 `components/stages/ScriptStage.tsx` 提交 selected_logline，经 `workflowApi.intervene` → InterventionRequest.modifications；ScriptWriter 原来没有 selected_logline 消费/阶段生成。不能只接请求就宣称有效。新正式工作流具体处理见集成报告。 |
| movie/micro 创作模式 | B | 原 selected_mode 只有前端按钮与本地状态，没有 ScriptWriter 分支；不能等同于集数或短片目标秒数。不为本次工具契约扩展新生成模式。 |
| 智能续写 | A | ScriptStage action=smart_continue、episodes_to_add、sequel_idea → intervene → `core/agents/script_agent.py` run_smart_continue。结果持久化 new_episodes/new_characters/new_settings，付费生成此次未实测。 |
| 确认/舍弃续写 | A | confirm_continue/delete_continue → ScriptWriter → Orchestrator 跨阶段同步与临时字段清理。新设计 append/setDraft(null) 不等价于此行为；由正式工作流适配接入。 |
| 沙盒图像画幅 | A | Sandbox ratio → SandboxT2IRequest/I2IRequest → sandbox route → ImageClient.generate_image(video_ratio)。原真实路由已有消费，本次恢复控件并验证请求。 |
| 沙盒图像分辨率 | C→补齐 | 新设计 resolution 原被 schema 忽略；现在 schema 接收，路由校验模型适配集合，传 resolution 到 ImageClient，并在响应及历史记录 parameters。 |
| 沙盒视频画幅/分辨率/时长 | C→补齐 | SandboxVideoRequest 新增 ratio/resolution/duration → normalize_video_params → VideoClient；显式不支持值在调用前 HTTP 422，省略值按原默认行为选择支持值。响应/历史保存实际规范拼写，前端展示实际参数。 |
| 沙盒独立 style | C；原 schema 空转 | 原字段仅存历史，未传图像调用。当前显式非空 style 返回 422；UI 明示独立风格暂不可用，风格可写提示词。未删原真实生成能力。 |
| 沙盒 temperature | C；原 schema 空转 | 原 schema 接收，LLM.query 没对应参数。当前显式 temperature 返回 422，UI 标明不可配置，不扩展供应商参数。 |
| 沙盒 web_search | A | SandboxLLMRequest → sandbox_llm → LLM.query → ChatClient。具体模型联网结果不在此次无付费验证范围。 |
| 文艺完整文案/灵感 | A | PipelinePage → text/mode/segment_count → StandardPipelineRequest → standard.run。copy 使用 split_by_periods，inspiration 才使用 segment_count。完整文案不提供画面数量承诺。 |
| 新设计画面数量 n_scenes | C；schema 空转 | schema 存在但 standard.run 不读取。正式控件不发送此字段，不将其保留为可调整假选项。 |
| 字幕/模板 | A；新设计 minimal/paper 为 C | fetchStandardTemplates → GET /api/pipelines/standard/templates → 实际 size/filename.html 模板与 fields/supports_video；PipelinePage 保留真实模板选择、字段、图片/视频模板及字幕渲染模式。仅当前画幅模板且视频模板支持视频时可提交。 |
| 字幕渲染模式 | A | enable_subtitles/subtitle_render_mode/subtitle_template/subtitle_template_fields → StandardPipelineRequest → standard.run 的后期叠字/图像模型字/模板分支，非本地模拟成功。 |
| 配音音色/语速 | A | tts_voice/tts_speed → StandardPipelineRequest → standard.run → generate_edge_tts(voice,speed)。成熟界面保留这两个控件。 |
| generate_audio 开关 | D（schema 有，但无已知原控件） | standard.run 始终执行 TTS，未消费 generate_audio。正式页面明确配音始终开启，不新增关闭配音选项。 |
| 动态视频模式和参数 | A | video_mode/video_model/video_duration/video_ratio/video_resolution → StandardPipelineRequest → standard.run → generate_video_api。控件读取模型支持分辨率/时长并约束提交。图片拼接时隐藏无效视频参数。 |
| 动态片段时长语义 | A | standard.run 使用 max(video_duration, ceil(配音长度))，再由模型能力限制，最终片段与配音对齐；界面明确最低时长与对齐规则，不承诺成片恰等于输入。 |
| 数字人固定时长 | C（新演示独立时长） | digital_human.run 根据配音与模型上限自动分段，未消费 duration。成熟界面不新增固定时长控件，明确自动分段。 |
| 模型目录与能力 | A；demo-* 为 C | fetchApiModels → /api/models → config_model 注册表。正式工具不使用 demo ID；流水线按适配能力筛选，沙盒按模型类型。无可用模型/参数不符则不能启动。 |
| 图片注册档位与适配档位 | D→明确限制 | 保留 capabilities.resolutions 注册信息，新增 adapter_resolutions。已有映射只支持对应 2K/4K；新 Seedream 像素档支持 1K/1.5K/2K。未实装的 1K/3K 不猜尺寸、不回退 1920×1080；按工具 resolution_constraints 排除如 i2i 的 4K。UI 提示注册但未适配档位暂不可选。 |
| 真实错误与权限 | A | 所有请求走 frontend/lib；Sandbox/PipelinePage 检查 canEdit；上传和生成不可由只读用户触发；后端保留原认证、权限与预算校验。422/供应商错误展示真实错误，不创建成功历史。 |

## 代码与兼容边界

- `backend/api/schemas/sandbox.py`：新增参数，拒绝未知字段及不支持的 style/temperature，防止 Pydantic 静默丢弃输入。
- `backend/api/routers/sandbox.py`：先校验模型类型/可用性及显式参数；历史仍是原 JSON 存储格式，新增字段向后兼容。
- `backend/models/config_model.py`：新增适配分辨率元数据，原注册声明保留。
- `backend/models/image_client.py`：未映射画幅/分辨率组合返回明确错误；有效旧映射与精确模板尺寸保持原行为。
- `frontend/components/Sandbox/Sandbox.tsx`：真实模型目录、受限参数控件、参数提交、实际参数反馈、错误及权限。
- `frontend/components/pipelines/PipelinePage.tsx`：沿用真实模板/字幕/配音/三种流水线业务；增加模型参数约束和空模型阻断，显式解释未支持或不同语义参数。

未实现档位是**当前适配层限制**，并非声称供应商模型不支持。所有供应商能力仍需遵循未来真实付费验证；本次不发起此类请求。

## 验证

- `uv run pytest -q tests/test_sandbox_contract.py tests/test_standard_contract.py tests/test_video_params.py tests/test_model_client_fixes.py tests/test_model_upgrades.py`：63 项通过。
- `uv run pytest -q`：196 项通过（此时正式工作流相关测试也已包含在仓库内）。
- `uv run ruff check api/schemas/sandbox.py api/routers/sandbox.py models/config_model.py models/image_client.py tests/test_sandbox_contract.py tests/test_model_client_fixes.py`：通过。
- 新增 `test_sandbox_contract.py` 使用 FastAPI TestClient 的真实 HTTP 校验与临时目录持久化，ImageClient/VideoClient 为替身；验证传参、历史、错误、未适配档位拒绝，未调用供应商。
- 图像尺寸测试运行真实 ImageClient，仅替换下层 provider client，断言传给供应商适配器的宽高字符串和比例；不是付费图像生成效果验证。
- `frontend/e2e/tools-contract.spec.ts`：登录、模型、模板来自隔离 FastAPI；生成 POST 拦截，核对界面提交及错误反馈。最新整组 4 项通过（审查补强后重跑）；包含真实模型能力菜单、视频参数提交、未适配图片档位不可选、422 错误展示、真实模板 ID 与字幕配音字段。
- 根完整检查与正式光影页面的实际 FastAPI联调由主集成验证统一记录。本文件不将工具局部接通表述为全量前端替换完成。

- `test_standard_contract.py` 新增 3 项通过：真实 StandardPipelineRequest → standard.run，替换所有生成、TTS及媒体渲染，验证字幕模板字段、媒体位画幅、音色语速、视频分辨率和配音决定的最小时长。

- `frontend/node_modules/.bin/tsc --noEmit`：通过。两个改动组件 ESLint：0 errors，23 warnings（含既有 any、img 与 effect 模式提示，未将警告称为零）。

## 独立审查后补强

- 沙盒视频菜单仅展示 `api_contract_verified` 且具有 `first_frame_i2v` / `text_to_video` 能力的模型。提交时按有图/无图校验对应能力；后端同样在启动活动任务前检查。视频编辑、动作迁移、参考视频模型不能用沙盒缺少必要输入的请求启动。
- 文艺短视频非模板画幅来自真实图片模型 `capabilities.ratios`，例如未支持的 21:9 不再可选。统一 `_start_task` 在任何任务、LLM、TTS或图像生成排队前复核画幅，覆盖 `POST /api/pipelines/standard/tasks` 与兼容入口 `POST /api/pipelines/quick_create/tasks`（保留旧 `image_workflow` 字段）；模板仍沿用独立媒体位精确尺寸处理。
- 新增反例测试覆盖有图但模型仅支持视频编辑/参考视频、图生视频缺首帧、未验证适配器；覆盖非模板21:9拒绝且不排队，以及合法画幅和模板路径保留。

审查补强后的新鲜验证：`uv run pytest -q` 全后端 **214 项通过**；`tsc --noEmit` 通过；相关文件 Ruff 和 `git diff --check` 通过；`playwright test e2e/tools-contract.spec.ts` **4 项通过**。后端HTTP测试验证不支持画幅在任务排队前拒绝，浏览器测试验证视频编辑/参考视频模型从沙盒选项排除和非模板21:9不在画幅选项中。供应商生成仍全部替身或拦截。

兼容入口补强：HTTP 反例测试对 standard 和 quick_create 两条入口验证非法 21:9 在并发额度预留、任务落盘、后台执行之前返回 422；合法画幅和模板专用尺寸路径均继续可入队。测试仅替换任务存储、调度和执行，不使用真实项目或供应商。

兼容入口补强后的验证：`uv run pytest -q tests/test_standard_contract.py tests/test_guardrails.py` **32 项通过**；全后端 `uv run pytest -q` **218 项通过**；相关文件 Ruff 与 `git diff --check` 通过。
