# 幕间三版前端：基线业务契约与验收矩阵

范围：只读核查 `work/MuJian-Factory-reference`。以下路径均相对此基线；没有运行模型、改动原仓库或访问真实数据。本文供共用 mock adapter 与后续联调使用，前端遗留实现不等同于后端已支持。

## 1. 六阶段数据契约

所有阶段共用状态 `pending | running | waiting | completed | error | stopped`，视图状态还有 `progress, progressMessage, artifact, error`（`frontend/components/stages/types.ts:1–9`）。六阶段顺序以 `frontend/components/TopBar.tsx:17–24` 为准；不要使用 AppShell 中历史遗留的 7 阶段进度分母。

| 阶段 ID | 主要 artifact 字段 | 关键展示/编辑语义 | 证据 |
|---|---|---|---|
| `script_generation` | `title, logline, genre[], overall_style, mood, characters[], settings[], scenes[], episodes[]`；角色含 name/character_id/description/personality/role；剧集前端类型有 act_number/act_title/content，兼容消费也有 episode_number | 结构化剧本、角色/场景、分集内容；修改剧本；续写生成 new_episodes 后确认或舍弃 | `frontend/components/stages/ScriptStage.tsx:11–72,129–165,597–622` |
| `character_design` | `characters[], settings[]`；素材项 `id, name, description, selected, versions[], status, error` | 角色四视图、场景全景；提示词编辑、上传、逐项重生成、版本选择 | `frontend/components/stages/CharacterStage.tsx:14–21,395–443,482` |
| `storyboard` | `episodes[]` → `episode_number, episode_title, segments[]` → `segment_id, segment_number, episode_number, location, characters[], total_duration, shots[]` → `shot_number, shot_type, duration, content` | 剧集/片段/镜头三级结构；编辑景别、时长、描述，增删镜头；保留稳定 ID | `frontend/components/stages/StoryboardStage.tsx:15–37,63–98` |
| `reference_generation` | `scenes[]`；`id` 对应 segment_id，`name, episode, index, description, selected, versions[], status, error?` | 每片段参考图；版本选择、提示词保存、上传、自定义局部重生成 | `backend/core/agents/reference_agent.py:208–230`；`frontend/components/stages/ReferenceStage.tsx:14–23,502–540` |
| `video_generation` | `clips[]`；`id` 对应 segment_id，`name, episode, index, description, duration, selected, versions[], status, error` | 每片段视频预览和版本选择；依赖对应参考图；逐项重生成 | `backend/core/agents/video_agent.py:352–378`；`frontend/components/stages/VideoStage.tsx:353–359,488–504` |
| `post_production` | `final_videos[]` 的 `name,path,episode`；兼容旧 `final_video` | 按剧集拼接、播放、下载；基线不是多轨时间线剪辑器 | `frontend/components/stages/PostProductionStage.tsx:11–35,41–42,55–86` |

建议：UI 可使用规范化 camelCase view model，但 adapter 保留以上 snake_case 字段和 stage ID；剧集字段兼容、artifact/payload 外壳兼容在 adapter 一处处理。三版共用同一固定数据集与状态转换，不能各自造一套业务。

## 2. 操作与接口语义

| 操作 | 原接口/载荷 | mock 应保留的语义 |
|---|---|---|
| 创建项目 | `POST /api/project/start`；idea/file_path/style/video_ratio/video_resolution/models/video_generation_mode/enable_concurrency/web_search/expand_idea/episodes/target_duration_seconds | 创建稳定 session_id；目标时长原 schema 范围 10–45 秒；模型为 adapter 数据，不写死组件 |
| 读取 | `GET /api/project/{id}/status`；`GET /api/project/{id}/artifact/{stage}` 返回 `{stage, artifact}` | 恢复选中版本、文本、阶段和任务状态；不在刷新时重置 |
| 执行阶段 | `POST /api/project/{id}/execute/{stage}`，输入参数，返回 SSE | 明确模拟 progress/content/stage_complete/error；演示生成不声称真实模型生成 |
| 人工介入 | `POST /api/project/{id}/intervene`，`{stage, modifications}`，返回 SSE | 剧本 `modified_script`；分镜 `modified_storyboard: Episode[]`；重生成 `regenerate_characters/settings/scenes/clips: [id]` |
| 保存版本/提示词 | `PATCH /api/project/{id}/artifact/{stage}` | 按素材 id 更新 `selected/description`，保留旧 versions，返回 artifact/status_map；保存不必然等于整阶段完成 |
| 上传角色/场景/参考图 | `POST /api/project/{id}/artifact/{stage}/upload_image`，multipart `item_type,item_id,file` | 新版本 append，选中刚上传版本，项状态 done；返回 path/artifact/status_map；仅角色 characters/settings、参考图 scenes 支持 |
| 确认并继续 | `POST /api/project/{id}/continue` | 后端先重算状态；running 时等待；waiting/completed 可返回 next_stage，随后前端另行 execute 下一阶段；不能把 continue 当成直接生成完全部阶段 |
| 停止 | `POST /api/project/{id}/stop` | 保留已有数据；停止后继续/重试需要显式动作，不清空项目 |
| 上传普通媒体/文本 | `POST /api/upload_media` / `POST /api/upload_file` | 与阶段素材上传分开；用于流水线/沙盒/新建输入 |

接口依据：`frontend/lib/workflowApi.ts:279–309,347–367,389–529`；`backend/api/routers/workflow.py:159–175,203–234,241–288`；`backend/api/schemas/project.py:6–29`。

重要后端细节：`backend/core/orchestrator.py:993–1046` 定义 continue；`:1051–1065` PATCH 返回重算后的 status_map/artifact；`:1069–1104` 按 ID 合并素材版本并保护已有 selected；`:1250–1268` 图片后缀 jpg/jpeg/png/webp/bmp，最大 25 MB；`:1290–1307` 上传新版本与默认选中；`:1314–1322` 限定上传目标。mock 中不支持视频上传替换片段，除非标记为后续新增能力。

版本应稳定关联：参考图确认后把 `{itemId:path}` 作为 `selected_images` 给视频；视频确认后把同样映射作为 `selected_clips` 给后期（`frontend/components/WorkflowPanel.tsx:674–699`）。局部重生成只更新目标项的版本/状态，不清除其他项或用户已选旧版本。

### 剧本选择的已知前后端差异

原前端保留 `phase=logline_selection/logline_confirm/mode_selection`，`selected_logline` 和 `selected_mode=movie|micro` 的介入按钮（`ScriptStage.tsx:118,288–369`）。但是本次查阅 `backend/core/agents/script_agent.py:170–178,181–208,349–352,547`，显式处理的是修改剧本、续写及续写确认/删除；没有发现 selected_logline/selected_mode 的消费分支。

因此，若三版按附件要求包含 Logline 选择，可以作为有明确演示标识的 mock 交互实现，必须在对接清单记录其后端契约待确认，不声称原后端现已完整支持。续写原始介入为 `{action:'smart_continue',episodes_to_add,sequel_idea}`；确认/舍弃为 `{action:'confirm_continue'|'delete_continue'}`（`ScriptStage.tsx:129–134,612–618`）。

## 3. 三流水线条件

共同任务结构：`task_id,pipeline,status,progress,message,input,output,artifacts[],error,created_at,updated_at,showcase`；artifact 项有 `kind,name,path,exists,created_at`（`frontend/lib/workflowApi.ts:42–56`）。状态 pending/running/completed/failed；事件 snapshot/progress/artifact/completed/failed（同文件 :76–82）。

| 流水线 | 必填与条件 | 其他主要参数 | 接口 |
|---|---|---|---|
| 文艺短视频 standard | 前端要求 text 非空；模板模式必须选模板；视频模板必须 supports_video | mode=inspiration/copy；video_mode=image_concat/dynamic_video；title、llm_model、image_model、比例/分辨率、TTS 音色/速度、enable_subtitles；字幕后期/模型叠字、模板字段；灵感模式 segment_count；动态视频才传 video_model/video_duration | `/api/pipelines/standard/tasks` |
| 动作迁移 action_transfer | prompt_text + image_path + video_path 均非空 | video_model、duration、比例/分辨率、negative_prompt | `/api/pipelines/action_transfer/tasks` |
| 数字人口播 digital_human | 前端要求 character_image + goodsText；商品图片和标题可选 | mode=customize；character_image_path、goods_image_path、goods_title、goods_text、llm/image/video_model、比例/分辨率、TTS 音色/速度 | `/api/pipelines/digital_human/tasks` |

证据：`frontend/components/pipelines/PipelinePage.tsx:849–858,921–976`；`backend/api/schemas/pipelines.py:6–68`。注意数字人口播 goods_text 在后端 schema 可选而原 UI 必填，本次演示沿用原 UI 条件并记录这一差异；文艺 segment_count 后端范围 1–20。模板开关不能只是装饰，切换后显式更新相关选项/提交载荷。

## 4. 共用验收矩阵（建议）

| 场景 | 可观察结果 |
|---|---|
| 三版打开同一项目 | 剧集、片段 ID、素材版本、初始状态一致；仅布局/视觉不同 |
| 创建与恢复 | 输入校验有反馈；创建产生演示记录；刷新/历史打开可恢复 |
| 六阶段切换 | 正确数据结构与阶段状态；不会因查看阶段触发生成 |
| 剧本/分镜编辑 | 保存与取消不同；分镜长度/描述变更可见且持久化；不删除其他剧集 |
| Logline/续写演示 | 选择/确认/舍弃可操作；遗留 Logline 契约列入对接清单 |
| 版本与上传 | 上传后增加版本并选中；旧版本仍可选；刷新保留；非法格式/过大文件提示明确 |
| 局部重生成/失败重试 | 只改变目标素材；能演示 running、失败原因、retry 和完成；其他版本保留 |
| 等待确认/停止/继续 | running 不重复启动；waiting 有明确动作；停止不抹除产物；继续指向正确阶段 |
| 素材依赖 | 无参考图的视频项有说明；选中参考图/视频版本传入下游 |
| 三流水线 | 必填分别校验；开关改变正确参数；任务有状态/中间产物/最终视频与历史 |
| 只读访问 | 只显示示例；没有上传、修改、生成、删除、设置等入口；不能仅用隐藏按钮冒充真实鉴权 |
| 演示隔离 | 界面明确演示数据；不调用真实模型、不写生产 API/密钥；mock adapter 可替换 |

现有 Playwright 使用 fixture 后端，见 `frontend/playwright.config.ts:19–30`；`frontend/e2e/showcase.spec.ts` 的既有覆盖偏展示/认证，不能当成完整创作链路已通过。三版新增演示验证应以上表为准。
