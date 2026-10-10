# 本地运行

正式开发根：`/Users/syk/Desktop/MuJian/`。需要 Python 3.11、uv、Node.js 20、npm、ffmpeg。安装依赖可使用 `scripts/install.sh`；原私有 `backend/config.yaml` 已保留，不覆盖。新克隆首次运行才从 config.yaml.example 创建自己的配置。

## 正式数据入口

在根 `backend/` 执行 `uv sync --python 3.11`、`uv run python api_server.py`；在根 `frontend/` 执行 `npm ci`、`npm run dev`。

前端 `http://127.0.0.1:3000`，后端健康检查 `http://127.0.0.1:8000/api/health`。默认本地模式无需登录，公开模式遵循原管理员/体验码权限。`BACKEND_API_URL` 可指定后端地址，在启动/构建 Next.js 时传入。API 与 `/code/` 媒体均经原代理和权限体系。

本次验收未启动原数据的生成或修改任务。正式入口会使用原 `backend/code/` 数据，操作前请注意当前项目。

## 无付费隔离验收入口

在根目录启动独立 FastAPI 副本：

```bash
MUJIAN_LIVE_TEST=1 MUJIAN_TEST_API_PORT=18785 python3 frontend/e2e/fixture_backend.py
```

另开终端：

```bash
cd /Users/syk/Desktop/MuJian/frontend
MUJIAN_DIST_DIR=.next-preview BACKEND_API_URL=http://127.0.0.1:18785 npm run dev -- --hostname 127.0.0.1 --port 3110
```

打开 `http://127.0.0.1:3110`。这是实际 FastAPI、实际文件保存的隔离测试环境，项目与素材为合成测试数据，API 密钥清空。管理员测试密码 `e2e-admin-password`；只读测试入口 `/login?code=E2EDEMO2`。这些凭据仅用于测试实例，与原项目凭据无关。关闭 fixture 后临时目录自动清理；不要将此测试环境公开部署。

直接分镜入口：`http://127.0.0.1:3110/?session=live-edit&stage=storyboard`。已备好多剧集、多镜头、多素材版本及服务端续写草稿，可保存、刷新、确认与舍弃；生成由于没有模型配置会显示真实失败。

## 保留版本

- 旧版：`旧版完整备份/`。恢复应先复制备份到隔离位置，再运行其中原 README 的命令，不在备份上继续开发。
- 独立光影设计：`新前端设计版/frontend` 执行 `npm run dev:director`（3101）；构建 `npm run build:director`，生产启动 `npm run start:director`。若默认端口已被原设计实例占用，先自行辨明实例，不终止用户其他进程。
- 设计版自定义端口：完成 build:director 后，在 `新前端设计版/apps/director` 执行 `NEXT_PUBLIC_MUJIAN_CONCEPT=director ../../frontend/node_modules/.bin/next start --hostname 127.0.0.1 --port 3111`。该界面为模拟数据，不能用于真实接口验证。
- 正式根保留原界面回归入口：`NEXT_PUBLIC_MUJIAN_LEGACY=1 npm run dev`。正式根不再提供 CONCEPT 模拟分支。

## 检查

`./scripts/check.sh` 覆盖后端、静态检查、构建、演示依赖隔离检查、原界面/工具浏览器回归及正式光影真实接口联调。`cd frontend && npx playwright test --config=playwright.live.config.ts` 使用独立 18775/18776 端口，覆盖光影正式界面的真实 HTTP 闭环。默认回归使用 18765/18766，请避免同组并行占用。

测试副本、日志、截图、trace 放在 `.local-artifacts/`，不提交。`MUJIAN_DIST_DIR` 用于预览构建目录隔离，避免开发服务与生产构建相互覆盖。

## 新旧界面对比（保留到用户验收通过）

沿用上面的隔离FastAPI（18785）。新界面3110命令不变；另开终端运行旧版操作界面：

```bash
cd /Users/syk/Desktop/MuJian/frontend
NEXT_PUBLIC_MUJIAN_LEGACY=1 MUJIAN_DIST_DIR=.next-legacy-preview BACKEND_API_URL=http://127.0.0.1:18785 npm run dev -- --hostname 127.0.0.1 --port 3112
```

新界面 `http://127.0.0.1:3110`；旧界面 `http://127.0.0.1:3112`。共用合成测试数据，编辑后另一侧刷新可查看结果，不写原项目数据。独立设计3111只用于设计资料查看，不代表后端接入。

用户明确验收前保留旧入口；自动检查通过不会自动停止旧服务。原始旧代码与修改前代码的恢复标签见 version-recovery.md。
