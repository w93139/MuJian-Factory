# 第二轮设计证据与实现映射

> 已选定 A「光影叙事」，运行入口见根 README。本文保留设计探索记录；comparison.html、research/、screenshots/、verification/ 为本地历史证据，不随 Git 源码提交。
先完成对标 UI 阅读，再选择设计资源并实施。此次三版分别重排首页、工作流和工具页面；只有业务命令、权限与数据共享。

| 版本 | 对标页面实际观察 | 选用设计资源 | 落地结构与代码 |
| --- | --- | --- | --- |
| A 创作入口 | 即梦生成首页集中输入；模型、参考方式、画幅在底部用小型控制与浮层；Pippit 大输入+素材/模型菜单 | React Bits SpotlightCard；Refero Krea 的中性层级和字号/间距规范 | AgentHome：集中 composer/参数浮层/灵感入口；Workflow：审阅流+右侧制作计划；Tools：结果在上、输入在下 |
| B 素材工作区 | RunningHub 快捷创作：工具轨、模式上传位、汇总参数 popover、竖版内容库；Kling 公共主页媒体分组（正式编辑器受登录阻塞） | React Bits Masonry 原 TSX/CSS | ProductionHome：窄工具轨+左输入停靠+不等高素材墙；Workflow：项目档案/镜头监视器/filmstrip；Tools：左输入、右结果工作区 |
| C 分镜画布 | LibTV 公开作品→查看制作过程：实际节点连线、工作流/故事板切换、文本/图片/视频三列、版本横条与独立滚动 | React Bits Dock 原 TSX/CSS | CanvasHome：新建画布+节点缩略预览；CanvasWorkspace：缩放/适应/平移/选节点；故事板关联同 segment_id 的文本、已选参考图、实际视频和版本；深链接定位镜头/素材 |

## 对标证据

- 即梦：`research/v2/jimeng-video.png`、`jimeng-parameters.png`。只导出主内容裁切，没有复制个人历史或账户资料。
- Pippit、Kling、RunningHub：`research/v2/tools/benchmark-report.md` 和实际公开交互截图、测量 JSON。
- Liblib/LibTV、OiiOii、小云雀：`research/v2/story/research.md` 与 workflow/storyboard 截图。
- LibTV 公开作品：[极简纯净风产品展示](https://www.liblib.tv/detail/d3f34a5ebd584bbcb79b1e1ab146b28a)，可实际进入只读制作过程。
- Refero：[Krea DESIGN.md](https://styles.refero.design/style/50833119-cb36-4b75-b0cc-be48afea050a)。页面注明 HTML 是 reconstruction，不将它描述为 Krea 商业源码。使用中性表面、文字节奏和按钮层级，中文采用系统字体。

## 设计资源的取舍

- [React Bits](https://reactbits.dev/)：实际移植三个组件，文件/源 commit/修改/许可在 `frontend/concepts/reference/README.md`。
- [Cubes](https://reactbits.dev/animations/cubes)：读过预览与代码入口；三维网格不对应输入、镜头审阅或素材关系，未强加到生产区。
- [MotionSites Agent Wave](https://motionsites.ai/?prompt=agent-wave)：实际查看动态预览并复制免费完整 prompt。大型波形占据首屏，不适合幕间常驻生产区，未套用其页面或远程媒体。
- [Unicorn Studio](https://www.unicorn.studio/)：阅读站点和官方文档；视觉画布/shader适合营销效果，此次主创作区不用大动画，也未创建付费项目。
- [SaaSPO](https://saaspo.com/page-types/saas-product-page-examples)：实际访问停在挑战页，记录为不可读，不伪称从中选到了代码。
- Pippit 的登录 iframe、Kling 正式创作编辑器、OiiOii 与小云雀深层创作被登录挡住；只引用实际可见入口/菜单，未推断内部编辑器。

## 独立审查与修正

两名只读审查者指出：Masonry 截图中间态、素材入口映射、原生上传排版、固定 fit、镜头时长硬编码以及故事板缺少视频/逐镜头关联。本轮修正这些问题并补充实际操作验证。完整复核及测试证据见 `verification/v2/`。

业务仍为本地演示：未调用付费模型；媒体来自原仓库插画和本地合成示例，计划镜头时长与约30秒示例媒体分别标明。正式 API、认证与计费留待选定一版后接入。
