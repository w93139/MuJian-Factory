# 当前实施记录

本轮前端整理见 [docs/frontend-cleanup.md](docs/frontend-cleanup.md)；上一轮集成计划见 [docs/integration-plan.md](docs/integration-plan.md)，接口范围见 [docs/integration-report.md](docs/integration-report.md)。历史设计计划保存在 `.local-artifacts/history/design-docs/`，不构成本次授权。

## 当前任务：前端瘦身与版本回溯（2026-10-10）

- 目标：正式前端仅保留光影视觉和真实业务；移除未选演示及闲置前端代码；新旧入口继续可用。
- 范围：frontend、正式演示入口 apps/scripts、检查与打包配置、运行及版本说明。
- 不做：后端核心或数据修改、付费生成、公开部署；不覆盖两个保留版本；不在用户验收前停用旧版。
- 验收：无正式 demo 依赖/打包标记；光影视觉与分镜闭环不回退；原业务回归、保存真实错误、完整 check 通过；可恢复 Git 标签及双入口。
- 已保存：archive/original-2026-10-10（0ab8dff），checkpoint/pre-frontend-cleanup-2026-10-10（8729f8b）。本次完成只标记待用户验收，不自动宣称稳定验收通过。

- 完成：正式演示隔离、光影组件提取、前端闲置依赖删除、保存错误与选版并发修复；backend 未修改。完整 check 通过（218 后端 + 16 原界面/工具 + 8 光影测试），双入口运行中，等待用户验收。
