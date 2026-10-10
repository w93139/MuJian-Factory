# 故事与分镜契约核查

核查日期：2026-10-10。A=后端已支持但设计未接入；B=原控件存在而后端未消费；C=设计新增演示行为；D=证据不足。工具细表见 contracts-tools.md。

| 页面控件 | 分类 | 字段 → 接口 → 后端消费与效果 |
| --- | --- | --- |
| 项目创建与实际参数 | A | Composer → frontend/lib/workflowApi.startProject → 原创建接口与项目 meta；模型来自 /api/models，过滤实际视频能力。新页先创建项目，再由阶段按钮生成，不展示模拟生成成功 |
| 剧本梗概/剧集正文编辑 | A | LiveScript → liveApi.saveStage → PATCH /api/project/{id}/artifact/script_generation → 原 Orchestrator 保存；保留完整 artifact |
| 多候选梗概选择/确认 | B/C | 原 selected_logline 没有 ScriptWriter 消费；设计候选为本地硬编码。正式界面明确不可用，不伪造选择成功；当前可编辑实际生成梗概 |
| movie/micro 创作模式 | B | 原 selected_mode 没有后端分支；正式界面明确尚未实现，不以 episode_count 冒充模式 |
| 智能续写 | A | action=smart_continue、episodes_to_add、sequel_idea → intervene 流 → ScriptWriter.run_smart_continue → 服务端草稿。接入真实请求，实际付费生成未执行 |
| 确认续写/舍弃续写 | A | action=confirm_continue/delete_continue → ScriptWriter 与 Orchestrator → 合并剧集或清除临时草稿及跨阶段同步。使用预置服务端草稿做真实 HTTP 与持久化验证 |
| 分镜读取 | A；设计扁平化结构需修复 | GET status/artifact/storyboard → normalize_storyboard → episodes[].segments[].shots[]；只读规范化不改写磁盘。兼容旧 segments/shots/payload 别名 |
| 分镜增删改与保存 | A | LiveStoryboard → lib/liveApi → 原 PATCH artifact/storyboard；发送完整 episodes 与 expected_storyboard。稳定 episode_id/segment_id/shot_id，不用数组序号作为身份；保留扩展字段与别名独有字段 |
| 景别/时长/描述 | A | shot_type/duration/content，并按旧字段存在情况同步 plot/description；后端重算 total_duration，视频提示包含所有镜头景别、时长、描述，保持片段级生成 |
| 素材与版本 | A | 参考 scenes/视频 clips 仍按 segment_id；选版 PATCH 保存 selected_version 与 URL。局部补丁保持原顺序、其他素材和版本；没有逐镜头新生成单元 |
| 参考图描述 | A | description 在统一适配处映射 visual_prompt，并提交 segment_id 提示同步；保存后参考产物与分镜提示一致 |
| 片段增删/跨集移动 | A，兼容补强 | 新片段建立 pending 引用，删除素材保存在 orphaned_scenes/orphaned_clips；父剧集决定归属，跨集移动同步媒体 episode；已有版本保留 |
| 保存冲突/错误 | A，防丢补强 | 修改基线不符或运行中 HTTP409，非法分镜400；保存失败恢复内存与状态，草稿留在前端。原请求失败抛真实错误，stream error 不展示成功 |
| 只读权限 | A | 沿用 AuthProvider/useAuth/canEdit。访客无编辑生成按钮，选版禁用，原后端写入403、私有项目404；媒体按原权限提供 |

## 兼容与限制

旧项目没有稳定标识时，读取建立确定性标识，首次保存写回；不以重排后的数组下标改号。canonical 与别名并存时，按 ID 深合并未知字段，编辑值优先。完整 episodes 代表当前层级，可表达删除；媒体保留删除历史。单片段至少留一个镜头，删除最后一镜需删除片段，避免零时长生成结构。

分镜变更不会自动花费预算重新生成素材。已生成图像/视频保留可选，需要用户显式重新生成以反映文本变化；未改镜头时保留人工视频提示。已有视觉提示保持，仍可单独编辑。

真实 HTTP 测试覆盖多集、多镜头编辑和增删、保存刷新、其他字段不丢、参考选版/提示同步、服务端续写确认/舍弃、409草稿保留、403只读及真实生成错误。后端专项补充旧格式、别名扩展字段、跨集移动、保存回滚、片段视频提示。实际供应商续写、图像/视频效果未作付费验证。
