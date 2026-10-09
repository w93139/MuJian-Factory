# 第三轮参考 → 设计 → 实际代码

> 已选定 A「光影叙事」，运行入口见根 README。本文保留设计探索记录；comparison.html、research/、screenshots/、verification/ 为本地历史证据，不随 Git 源码提交。
本轮回应“三版很像”的反馈：保留第二轮先实测竞品、再选择设计资源的顺序，把视觉差异扩大到首屏、导航、字体、表面、工作区和工具页。第二轮真实界面证据见 [reference-map-v2.md](reference-map-v2.md)，第三轮不是重新给同一套 DOM 换色。

## 三种组合

| 版本 | 业务结构来自 | 视觉设计来自 | 真实源码与实际落点 |
| --- | --- | --- | --- |
| A 光影叙事 | 即梦/Pippit 集中创作输入、参数浮层；分阶段审阅 | [MotionSites Agent Wave](https://motionsites.ai/?prompt=agent-wave) 整屏构图、玻璃控制台和金属按钮；中文大字重新排版 | [Threads](https://reactbits.dev/backgrounds/threads) 全幅 WebGL 波浪幕布，覆盖首屏；SpotlightCard 保留在输入与灵感，制作页为暗色审阅流 |
| B 几何创作台 | RunningHub 工具轨、模式与媒体库；监视器和镜头条 | [Refero Figma](https://styles.refero.design/style/60793669-28e2-41bd-bf9d-972151630f7c) 白/黑高对比、锐利内容框、大字负字距与紫色操作；荧光贴纸为本产品适配 | [Cubes](https://reactbits.dev/animations/cubes) 6×6 立方体占据半屏，可自动倾斜、指针与点击涟漪；Masonry 进入素材库；内页白底制作区 |
| C 电影编辑部 | LibTV 实际公开只读项目中的节点与文本/图像/视频故事板 | [Refero Studio Thomas](https://styles.refero.design/style/f2b24dce-5b1f-47c2-8ef6-bbbd08b68826) 保存的橙色/亚麻预览；[Switch-Lit](https://styles.refero.design/style/97f7787e-bba0-4d37-8b74-4b0cb8d5a57c) 编辑字体分工与细线网格 | [ScrollVelocity](https://reactbits.dev/text-animations/scroll-velocity) 大幅横向阶段字幕；可切换的真实项目海报；Dock 保留在画布，内页暖纸编辑区 |

三版首页分别使用 WaveScene、CubeScene、FilmRibbon，代码位于 `frontend/concepts/MotionScenes.tsx`，布局位于 Home.tsx。完整主题规则在 visual-v3.css，覆盖登录、设置、任务抽屉、编辑表单、预览弹层及工具结果。参数和业务命令通过共同的数据层保存；三版浏览器存储隔离。

## 真实源码与固定版本

`frontend/concepts/reference/` 包含六项实际 React Bits 源码适配，不只模仿截图。Threads 固定为 `d86fccbd477786f94ca7eb891fbe0ec039d3cd3b`；Cubes、ScrollVelocity、SpotlightCard、Masonry、Dock 固定为 `63a008de65732d73010bd219d25d15c47739bb31`。具体原始目录、改动与许可证见该目录 README.md。新增依赖仍为现有 motion 和 gsap，无需 Three/OGL。

暂停与减少动态偏好直接控制动画计算；Threads 清理 WebGL 资源并提供不可用时的静态线场；ScrollVelocity 取消 RAF 而非只把速度改为零；Cubes 清理 GSAP tween 和 RAF。复制字幕隐藏于辅助技术，暂停按钮有可访问名称。低性能或减少动态场景仍可输入、选参数和创建项目。

## 实际证据与限制

- `research/v3/threads-preview.png`、`cubes-preview.png`、`reactbits-scrollvelocity-preview.png` 是实际设计资源预览截图，非生成的参考图。
- `research/v3/refero-figma.md`、`refero-studio-thomas.png`、`refero-switchlit.png` 与 research-a.md/research-c.md 记录实际规则和选择理由。
- MotionSites 免费 Agent Wave prompt 已完整阅读。它含视频/WebGL描述的内部冲突，本产品采用其构图与按钮语言，动态波浪由 Threads 提供。没有下载未核实许可的视频或复制模板品牌和虚构统计。
- Studio Thomas 源站当前重定向 Guest Studio，其当前首屏并非橙色；本版本橙/亚麻来源准确归于 Refero 保存的预览，不能归于当前 Guest Studio。
- Switch-Lit 商业 ABC 字体未下载；中文大标题适配系统 Songti SC/STSong，参数采用系统 sans，跨系统字形会有差别。
- SaaSPO 挑战页、部分竞品需登录编辑器与 Unicorn 编辑资源限制按第二轮记录保留。Unicorn 未使用，也未声称所有给定网站都被直接复用。
- 参考产品品牌、商业字体与第三方视频未作为产品素材打包；展示图与30秒示例来自原仓库本地资源。

## 查看

[comparison.html](../comparison.html) 默认显示三个真实前端 iframe，可以直接观察动效；每版“打开前端”可进入全屏操作。切换静态截图可比较1440×1000、1024×768、390×844与任务状态。离线打开默认静态；动态查看需三个本地服务运行。

验证与独立审查归档在 `verification/v3/`。截图证明布局状态，前台连续像素采样证明真实动画/暂停；自动测试不代替用户的审美判断。
