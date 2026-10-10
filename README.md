# 幕间 MuJian

AI 视频创作工作台。正式界面采用「光影叙事」，沿用原后端、认证权限、模型目录和媒体存储。当前已完成本次分镜与工具契约修复；付费生成效果与全部旧界面交互迁移尚未验收。

## 三个版本

统一项目位置：`/Users/syk/Desktop/MuJian/`。

| 版本 | 源码与用途 | 启动 |
| --- | --- | --- |
| 正式集成版 | 根 `frontend/`、`backend/`、`deploy/`、`scripts/`；唯一继续开发和提交的仓库 | 见下文，默认光影真实接口界面 |
| 旧版完整备份 | `旧版完整备份/`；改版前 0ab8dff，含 Git、隐藏配置、本地项目及媒体 | 在该目录按原 README 启动；恢复前先复制至另一个隔离位置，避免误写备份 |
| 新前端设计版 | `新前端设计版/`；58b4a03 的独立设计源码，入口 `apps/director` | `cd 新前端设计版/frontend && npm run dev:director`；默认 3101，业务使用模拟数据 |

两个保留版本不随正式代码同步覆盖，也不提交 GitHub。历史截图、日志、计划及 ZIP 位于 `.local-artifacts/`；历史 ZIP 不是当前交付版本。迁移来源未删除。

## 正式版本地运行

需要 Node.js/npm、Python/uv 以及原后端运行依赖。保留现有私有配置，不将密钥写入仓库。

```bash
cd /Users/syk/Desktop/MuJian/backend
uv sync --python 3.11
uv run python api_server.py
```

另开终端：

```bash
cd /Users/syk/Desktop/MuJian/frontend
npm ci
npm run dev
```

默认前端 `http://localhost:3000`，后端 `http://localhost:8000`。自定义后端时设置 `BACKEND_API_URL`；Next.js 代理配置需要在启动或构建时传入。公开模式沿用原管理员登录和体验码权限；具体环境配置与隔离预览见 [运行说明](docs/local-run.md)。

`NEXT_PUBLIC_MUJIAN_LEGACY=1 npm run dev` 可运行原业务界面以回归原有能力。`NEXT_PUBLIC_MUJIAN_CONCEPT=director` 是模拟设计模式，不用于真实业务验收。

## 验证与交付

```bash
./scripts/check.sh
cd frontend
npx playwright test --config=playwright.live.config.ts
```

- [目录清单和迁移校验](docs/directory-inventory.md)
- [实施计划与范围](docs/integration-plan.md)
- [分镜和故事工作流契约](docs/contracts-workflow.md)
- [工具与后端契约核查表](docs/contracts-tools.md)
- [验证结果、限制及接入进度](docs/integration-report.md)
- [本地运行和版本入口](docs/local-run.md)

原项目许可及第三方说明仍见 `LICENSE` 和 `THIRD_PARTY_NOTICES.md`。私有配置、数据、生成媒体、版本备份和本地归档均不随正式源码提交。
