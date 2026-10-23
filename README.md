# 幕间 MuJian

AI 视频创作工作台，包含六阶段创作流程、沙盒工具和快捷流水线。Next.js 前端连接 FastAPI 后端，使用统一认证权限、模型目录和 JSON／媒体文件存储。

## 本地运行

当前未提供公共在线体验入口。使用前需在本机启动前端和后端；已下载的项目无需每次重新拉取代码，获取更新时再拉取即可。

准备 Python 3.11、uv、Node.js 20+、npm 和 ffmpeg。从仓库根目录操作；首次运行前按 [配置示例](backend/config.yaml.example) 准备私有配置，已有配置不要覆盖。

终端一：

```sh
cd backend
uv sync --python 3.11
uv run python -m uvicorn api.app:app --host 127.0.0.1 --port 8000
```

终端二，从仓库根目录开始：

```sh
cd frontend
npm ci
BACKEND_API_URL=http://127.0.0.1:8000 npm run dev -- --hostname 127.0.0.1 --port 3000
```

上述两个服务保持运行后，在浏览器地址栏输入 `http://127.0.0.1:3000/`；后端健康检查地址为 `http://127.0.0.1:8000/api/health`。这些地址仅指向访问者自己的电脑，服务停止后无法打开。`BACKEND_API_URL` 在前端启动或构建时生效。服务配置、登录模式及隔离预览见 [运行说明](docs/local-run.md)。

## 范围与数据

- 正式界面采用「光影叙事」。`NEXT_PUBLIC_MUJIAN_LEGACY=1` 可启用仓库内保留的原业务界面，供回归比较。
- 付费生成效果与全部旧界面交互迁移仍需验收；存在代码不代表所有真实供应商流程已经验证。
- 模型生成可能产生费用。不要提交 `backend/config.yaml`、`.env`、密钥、用户会话或生成媒体。
- 用户数据与媒体分别保存在 `backend/code/data/`、`backend/code/result/`，不随源码分发。

## 开发与维护

```sh
./scripts/check.sh
```

检查脚本覆盖后端、前端构建与浏览器回归；需要相应开发依赖和浏览器环境。

- [工作流契约](docs/contracts-workflow.md) · [工具契约](docs/contracts-tools.md)
- [集成验证与限制](docs/integration-report.md) · [前端迁移说明](docs/frontend-cleanup.md)
- [版本保存与恢复](docs/version-recovery.md)

## 许可

见 [LICENSE](LICENSE) 与 [第三方声明](THIRD_PARTY_NOTICES.md)。
