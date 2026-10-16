# 本地运行

正式开发根：`/Users/syk/Desktop/MuJian/`。Python 3.11、uv、Node.js 20、npm、ffmpeg。原私有 `backend/config.yaml` 与 `backend/code/` 保留，密钥与媒体不上传 GitHub。

## 当前可用：原有历史与素材

- 新光影前端：<http://127.0.0.1:3110/>
- 真正旧版前端：<http://127.0.0.1:3112/>
- 正式后端：<http://127.0.0.1:8000/api/health>

3110 与 3112 都连接正式 `backend/code/data/` 和 `backend/code/result/`，不再连接合成测试数据。首页下方的历史记录和左侧任务可打开原项目；各流水线页面保留原任务历史。本机原配置为本地模式，无需邀请码。仅监听 127.0.0.1，不改变公网权限配置。

后端（终端一）：

```bash
cd /Users/syk/Desktop/MuJian/backend
.venv/bin/python -m uvicorn api.app:app --host 127.0.0.1 --port 8000
```

新前端（终端二）：

```bash
cd /Users/syk/Desktop/MuJian/frontend
MUJIAN_DIST_DIR=.next-preview NEXT_PUBLIC_MUJIAN_LEGACY=0 BACKEND_API_URL=http://127.0.0.1:8000 npm run dev -- --hostname 127.0.0.1 --port 3110
```

真正旧版（终端三）：

```bash
cd /Users/syk/Desktop/MuJian
BACKEND_API_URL=http://127.0.0.1:8000 MUJIAN_FROZEN_PORT=3112 python3 scripts/run-frozen-frontend.py
```

旧版启动器将固定提交 `2ab1fe77cf835d58fd13d799308cb49c3a2b6ffd` 的前端导出至 `.local-artifacts/frozen-reference/`，安装依赖后运行副本。这 63 个已跟踪前端文件已与 `旧版完整备份/frontend/` 逐文件核验一致；不在旧备份中安装、构建或写入文件。首次准备需要网络安装 npm 依赖。端口已经运行时无需重复启动。

## 隔离自动测试

`./scripts/check.sh` 运行后端、静态检查、构建、生产依赖检查、浏览器回归及真实 HTTP 联调。18765/18766、18775/18776/18777 使用合成数据副本，密钥清空，保存和错误回归不写正式记录，不调用付费模型。

`live-tests/layout-parity.spec.ts` 是同源组件的主题回归，不能替代冻结旧版验收。真正旧版和原数据验收：

```bash
# 先启动上述 8000、3110、3112 三个服务
cd /Users/syk/Desktop/MuJian/frontend
npx playwright test --config=playwright.frozen.config.ts
```

冻结验收覆盖全局侧栏、首页、六阶段、五种沙盒工具、三流水线、设置、登录/访客布局、移动端与实际历史视频播放。测试拦截对原 API 的非只读请求；登录/访客的布局检查固定身份，真实登录与权限由隔离 HTTP 回归验证。截图、控件几何记录和 trace 只存 `.local-artifacts/`，不提交。

旧隔离预览后端18785保留供测试使用，已经不是3110/3112的数据源。独立设计3111/3101仍仅用于设计资料，不代表真实业务接入。

## 保留版本

- `旧版完整备份/`：冻结全量旧版，不修改。
- `新前端设计版/`：独立光影设计存档，不覆盖。
- 根 `frontend/`、`backend/`：当前前后端正式代码。

用户明确验收前保留新旧入口，不自动记录 accepted 标签。数据与备份的 SHA-256 核验及本轮差异见 `docs/original-data-acceptance.md`。
