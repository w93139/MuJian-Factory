# 项目目录与迁移记录

核查日期：2026-10-10。统一根目录 `/Users/syk/Desktop/MuJian/`。

| 位置 | 内容 | Git/用途 |
| --- | --- | --- |
| frontend、backend、deploy、scripts 等 | 最新正式前后端集成源码 | 根 main；保留原 Git 历史与 origin |
| 旧版完整备份 | 整理前整个桌面项目，包括 .git、隐藏配置、backend/code 本地数据及媒体、必要运行依赖 | 0ab8dff 完整可恢复副本；不随正式提交 |
| 新前端设计版 | 独立设计仓库；frontend/concepts 和 apps/director | 58b4a03；模拟业务，保留独立运行能力 |
| docs | 本次最新计划、契约核查、运行和交付记录 | 正式跟踪 |
| .local-artifacts/migration | 文件清单、SHA256 校验、迁移摘要、原 Git bundle、运行路径修复记录 | 私有本地材料 |
| .local-artifacts/history/research-work | 原 Codex 研究与验证材料 | 历史资料 |
| .local-artifacts/history/plans | mujian-codex-archive 历史计划 | 历史资料，授权不继承 |
| .local-artifacts/history/deliveries | 旧 ZIP 与交付清单 | 历史交付包，不能替代最新源码 |
| .local-artifacts/history/design-docs | 已归档的前端方案、引用表、旧 TASK | 历史资料 |
| .local-artifacts | 构建/测试日志、隔离测试数据、浏览器截图 | 忽略，不提交 |

## 来源与保全

原根仓库与设计源在整理前均无未提交修改。先完整复制原根到旧版目录，复制排除目标自身及本次新建归档目录，避免递归；再从 origin/main 正常快进 0ab8dff → 58b4a03。未强推，未重写历史。

设计来源：`/Users/syk/Documents/Codex/2026-10-08/https-github-com-w93139-mujian-factory-2/outputs/mujian-frontends`。研究来源为其所属任务目录，历史计划来源为 `/Users/syk/Desktop/mujian-codex-archive/`。来源均未删除。本次后续交付只保存在桌面根目录。

完整迁移清单对普通文件记录 SHA256，对符号链接记录链接目标；原版 35596 项、设计版 38433 项、计划 2 项、研究工作材料 1065 项，复制后业务文件差异为 0。Finder 持续更新的 `.DS_Store` 已复制保留，但不作为业务内容一致性依据。逐项清单及结果见本地 `migration/*-manifest.json` 与 `summary.json`。

检查未发现失效符号链接；内部相对链接在新位置有效。Python 虚拟环境仍依赖系统 uv 的 Python 安装，这是本机运行依赖。设计版迁移后将 23 个虚拟环境启动文本中的原目录改为新目录，记录于 `runtime-relocations.json`，避免依赖原 Codex 路径。设计版在新目录执行 `npm run build:director` 成功。

恢复 Git 历史可使用旧版 `.git`，另有 `migration/original-history.bundle`。该 bundle 仅涵盖 Git 对象，不能替代包含私有配置和运行数据的旧版完整目录。

原运行数据最终复核：backend/code 共81个文件、backend/config.yaml 与旧版备份SHA256一致。两个现有分镜产物只读规范化成功（2剧集、6片段、21镜头），没有写回。检查记录见 migration/runtime-preservation.json 和 existing-storyboard-compatibility.json。
