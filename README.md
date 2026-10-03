# 幕间 Mujian

幕间是从创意到成片的 AI 视频创作工作台。主流程依次完成剧本、角色与场景、分镜、参考图、视频片段和后期剪辑；另有沙盒和三条快捷流水线。

## 本地运行

需要 Python 3.11、Node.js 20、npm、uv 和 ffmpeg。也可以运行 `scripts/install.sh` 安装依赖。

```bash
cd backend
uv sync --python 3.11
cp config.yaml.example config.yaml
# 在本地 config.yaml 中填写所需 API Key
uv run python api_server.py
```

在另一个终端启动前端：

```bash
cd frontend
npm ci
npm run dev
```

前端默认访问 `http://127.0.0.1:3000`，后端健康检查为 `http://127.0.0.1:8000/api/health`。模型和生成参数通过 `backend/config.yaml` 配置；该文件不会提交到 Git。

## 项目结构

- `backend/`：FastAPI、工作流引擎、六阶段 Agent、模型适配器及 JSON 持久化。
- `frontend/`：Next.js 工作台、沙盒、快捷流水线和设置页。
- `scripts/`：本地安装与检查脚本。

会话与生成产物保存在 `backend/code/`，不进入 Git。部署方式与展示模式将在项目完成时补充。

## 许可证

本项目使用 [MIT 许可证](LICENSE)。所用第三方代码的必要声明见 [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md)。
