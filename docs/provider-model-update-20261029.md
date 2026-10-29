# 两家官方模型接口更新（2026-10-29）

## 任务约定

目标：在幕间已有流程和选择器中接入阿里云百炼、火山方舟当前与短片创作相关的模型，保留成本优先的 Seedance 2.0 系列。

范围：模型注册与能力过滤、对应文本/图片/视频适配、可选正式配音接口及必要测试。默认模型、页面布局、业务步骤、历史文件和旧版备份保持原状；不扩展世界模型、3D、实时语音产品。

完成条件：新增选项可以从现有页面选择；请求按官方模型契约构造；不支持的输入在收费提交前拒绝；配音兼容原有 Edge TTS；预算估算不能漏计；已有任务继续读取。

验证：使用离线替身验证提交、异步查询、媒体落盘、菜单及权限，运行 `./scripts/check.sh`，由独立只读审核检查最终差异。未授权本次收费生成，因此技术接入不表述为账户开通或生成效果验收。

保护：源码更新前标签 `checkpoint/2026-10-29-before-provider-model-update`。测试开始时对正式数据、旧版和设计版建立排除依赖及构建目录的本地哈希清单，结束后对照；配置、密钥、测试记录不进入 Git。

## 官方来源

- https://help.aliyun.com/zh/model-studio/models
- https://docs.volcengine.com/docs/ark/model-list?lang=zh
- https://docs.volcengine.com/docs/ark/model-pricing?lang=zh

## 已接入的新增模型

| 渠道 | 模型 | 本次开放能力 |
| --- | --- | --- |
| 百炼 | `deepseek-v4-pro-0813`、`kimi-k3`、`glm-5.3` | 文本；Kimi K3 同时支持图片理解 |
| 方舟 | `doubao-seed-2-1-pro-260915`、`doubao-seed-2-1-lite-260915`、`doubao-seed-2-1-turbo-260628` | 文本及图片理解，Chat API 按方舟参数关闭默认思考；联网搜索暂不开放 |
| 百炼 | `qwen-image-3.0`、`qwen-image-3.0-pro` | 文生图、最多 3 张参考图的编辑；1K/2K；总像素受模型上限约束 |
| 方舟 | `doubao-seedance-2-0-mini-260615`、`doubao-seedance-2-5-260628` | 首帧生成；2.5 为 4～30 秒、480p/720p/1080p，首帧比例按官方契约使用 adaptive |
| 百炼 | `wan3.0-video-prime` | 沿用现有 Wan 3.0 首帧适配子集 |
| 百炼 | `happyhorse-1.1-r2v` | 1～9 张图片参考生成，3～15 秒；不接受参考视频、音色参考或驱动音频 |
| 百炼 | `qwen-audio-3.1-tts-plus` | 在文艺短视频、数字人的生成配置内选择正式配音和系统音色；旧请求继续使用 Edge TTS |

共 13 个新增云模型。Edge TTS 同时进入配音目录作为兼容默认选项，不算新增云模型。现有模型、当前配置默认值和两个 Seedance 2.0 未开通标记均保留。

模型选择来自现有 `/api/models`，没有新增独立产品流程或修改侧栏。Qwen 图片走 `MultiModalConversation`，旧 Wan 图片继续走 `ImageGeneration`。正式 TTS 使用 `/services/audio/tts/SpeechSynthesizer`，下载官方 HTTP/HTTPS 音频链接并原子保存。

## 接入与账户可用性的区别

使用既有凭证执行两家官方的只读模型目录 GET 请求，均返回 HTTP 200；方舟目录包含本次 Seed 2.1、Seedance Mini/2.5。目录可见不等于已开通生成权限、余额足够或生成效果合格。本次没有提交收费生成，不能将离线测试表述为全部新模型真实生成通过。

本轮未接世界模型、3D、实时语音产品、CosyVoice 音色复刻/设计或新的第三方中转。Seedance 2.5 的多图/视频/音频参考、编辑、延长尚未开放，菜单只声明首帧适配。此前数字人口型同步问题仍是独立待办；新增配音没有改变原 R2V 与后期合成逻辑。

## 费用与兼容

- 预算在网络请求前预留，失败不自动收费重试。Qwen 图片从第一张输入图开始计费，Pro 输出按较高档预留；正式 TTS 按每个字符两倍的数量保守覆盖中文字符计费。
- 新文本模型按北京/方舟常规价的保守 Token 数预留，使用忙时费率；不是供应商账单。新 Seedance 和 Wan Prime 暂按更高的每秒上界预留，正式大规模使用前应与账户实际报价校准。
- 只有明确选择 Qwen 配音才走付费 TTS；历史任务未包含 `tts_model` 时保持 Edge。模型、音色或语速不匹配会在创建新任务前返回错误。
- 配置文件、原有历史/素材、旧版与设计版不作为本次 Git 提交内容。

## 验证记录

- `./scripts/check.sh` 退出码 0：232 项后端、16 项旧主题浏览器、37 项新版及接口浏览器测试通过；包含类型检查、构建、前端边界检查。原有 lint 警告保留，没有新增错误。
- 费用费率最终校准后再次运行 `./backend/check.sh`：232 项通过、Ruff 通过。
- 新增 9 项后端契约测试覆盖：模型筛选、错误媒体拒绝、Qwen SDK 分流/图片限制/首张参考计费、Seedance 2.5 adaptive 比例、TTS HTTP/HTTPS 落盘与预算拦截、方舟思考参数。
- 新增浏览器测试验证：目录可读、配音模型与系统音色切换、所选字段实际提交；提交请求被测试拦截，没有调用供应商。
- 独立只读审查未发现遗留 blocker/important；发现的官方 HTTP 音频链接兼容问题已修复并补测试。
- 原有数据 81 个文件、旧版清单 400 个文件、设计版清单 803 个文件，测试前后哈希一致。清单排除依赖、Git、构建目录与符号链接；不把这些数量当作完整目录全部文件数。
- 原始日志和哈希清单只保存在 MuJian 的 `.local-artifacts/provider-model-update-20261029/`。

## 具体接口依据

- Qwen 图片：https://help.aliyun.com/zh/model-studio/qwen-image-generation-and-editing-api-reference
- HappyHorse R2V：https://help.aliyun.com/zh/model-studio/happyhorse-reference-to-video-api-reference
- Qwen 配音：https://help.aliyun.com/zh/model-studio/qwen-audio-tts-http-api
- 配音音色：https://help.aliyun.com/zh/model-studio/qwen-audio-tts-voice-list
- Wan 3.0：https://help.aliyun.com/en/model-studio/wan3-video-generation-api-reference
- Seedance：https://docs.volcengine.com/docs/ark/create-video-generation-task-api?lang=zh
- 百炼价格：https://help.aliyun.com/zh/model-studio/model-pricing
