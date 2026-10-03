# 幕间部署手册

这份手册面向一台火山引擎 ECS。部署后只通过 Nginx 的 80/443 端口对外提供服务；后端 8000 和前端 3000 只在 Docker 网络内使用。

## 1. 准备服务器与访问方式

- 建议从 **2 核 4 GB 内存、40 GB 以上系统盘** 起步，Ubuntu 22.04/24.04。生成的图片、视频会持续占用 `backend/code/`，按实际作品数量扩容磁盘。
- 给 ECS 配置公网 IP。安全组允许 TCP 80；启用 HTTPS 后允许 443；SSH 22 尽量只允许自己的 IP。火山引擎的[安全组文档](https://www.volcengine.com/docs/6396/68802?lang=zh)说明了入站放通和最小范围原则。
- **中国内地地域的公网网站/应用服务需要先完成备案，不能把未备案的公网 IP 访问当作正式绕过方式。**火山引擎的[备案资源说明](https://docs.volcengine.com/docs/Record/Preparingtofilecloudresources)明确要求内地云资源对外提供服务前完成备案。备案未就绪但需要先做公网演示，可评估[中国香港等非内地地域](https://www.volcengine.com/docs/6396/1581668?lang=zh)，并核对目标地区适用要求。

## 2. 安装并启动

在 Ubuntu 上按 [Docker 官方 Ubuntu 安装文档](https://docs.docker.com/engine/install/ubuntu/)安装 Docker Engine 与 Compose 插件，然后执行：

```bash
git clone https://github.com/w93139/MuJian-Factory.git
cd MuJian-Factory
cp .env.example .env
python3 -c 'import secrets; print(secrets.token_urlsafe(48))'
```

把最后一条命令生成的随机值填入 `.env` 的 `MUJIAN_SESSION_SECRET`，另设一个强管理员密码。当前默认主流程使用百炼，须填写 `DASHSCOPE_API_KEY`；如需使用方舟模型，先在方舟控制台开通相应模型，再填写 `ARK_API_KEY`。保留 `MUJIAN_PUBLIC_MODE=1`，先用 `MUJIAN_COOKIE_SECURE=0`。`.env` 只留在服务器上，不提交到 Git。

```bash
docker compose config --quiet
docker compose build
docker compose up -d
docker compose ps
curl -f http://127.0.0.1/api/health
```

健康检查成功后，用浏览器访问 `http://<公网IP>/login`。管理员登录，在设置页生成面试官邀请码，并将完成验收的会话标记为「示例」。面试官凭邀请码只能浏览，不能发起生成。

`MUJIAN_DAILY_BUDGET_CNY` 是按模型注册表价格计算的**每日估算上限**，默认模板为 ¥50；它不是平台实际账单。`MUJIAN_MAX_CONCURRENT_JOBS` 限制同时运行的阶段与快捷流水线任务。测试前可按预算调整这两个值。

## 3. 域名与 HTTPS

域名完成所需备案和解析后，把 DNS A 记录指向 ECS 公网 IP。将证书文件放在服务器的 `deploy/certs/fullchain.pem` 与 `deploy/certs/privkey.pem`；可以使用 Certbot 或火山引擎证书服务获取和续期。证书文件会被 Git 忽略。

复制 `deploy/nginx-https.conf.example` 为 `deploy/nginx.conf`，把其中的 `example.com` 换为实际域名；在 `docker-compose.yml` 的 `nginx.ports` 增加 `"443:443"`，并把 `.env` 中的 `MUJIAN_COOKIE_SECURE` 改为 `1`。随后执行：

```bash
docker compose up -d --force-recreate nginx backend
curl -f https://<域名>/api/health
```

证书续期后重新加载 Nginx：`docker compose exec nginx nginx -s reload`。

## 4. 更新、备份与排障

```bash
git pull --ff-only
docker compose build
docker compose up -d
docker compose ps
docker compose logs --tail=100 backend
docker compose logs --tail=100 frontend
docker compose logs --tail=100 nginx
```

所有会话、产物、邀请码和用量记录都在服务器的 `backend/code/`。更新前备份整个目录：

```bash
tar -czf "$HOME/mujian-code-$(date +%F).tar.gz" backend/code
```

恢复时先停止服务，再把备份中的 `backend/code/` 解压回仓库对应位置，然后重启。不要把这个目录推送到 GitHub。

公开模式下，邀请码访客可以查看**示例会话**，也可以查看沙盒和快捷流水线的已有历史。对外开放前请检查这些历史记录是否适合展示。管理员可在设置页创建、复制与作废邀请码；作废后对应登录立即失效。
