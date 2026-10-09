# 实际复用的 React Bits 源码

上游 [DavidHDev/react-bits](https://github.com/DavidHDev/react-bits)。各文件头和下表固定来源版本，保留版权与完整 [LICENSE.md](LICENSE.md)。

| 本地文件 | 固定 commit / 原始目录（src/ts-default/） | 实际使用 | 本地适配 |
| --- | --- | --- | --- |
| Threads.tsx / .css | d86fccbd477786f94ca7eb891fbe0ec039d3cd3b / Backgrounds/Threads | A 全幅主视觉 | 低速波浪、暂停/动态偏好、指针停止、WebGL清理和静态fallback；保留原shader算法 |
| Cubes.tsx / .css | 63a008de65732d73010bd219d25d15c47739bb31 / Animations/Cubes | B 半屏几何主视觉 | 6×6、实例样式、交互与静态姿态props；自动RAF与GSAP停止清理；减少动态静态倾斜 |
| ScrollVelocity.tsx / .css | 63a008de65732d73010bd219d25d15c47739bb31 / TextAnimations/ScrollVelocity | C 横向阶段字幕 | 提升内部组件以保留位移；ResizeObserver、复制内容aria-hidden；暂停/减少动态取消RAF，离屏与后台停算；原scroll velocity/spring/wrap算法 |
| SpotlightCard.tsx / .css | 63a008de65732d73010bd219d25d15c47739bb31 / Components/SpotlightCard | 输入与 A 灵感 | 局部低亮跟随高光、样式限于.concept、去未使用类型 |
| Masonry.tsx / .css | 63a008de65732d73010bd219d25d15c47739bb31 / Components/Masonry | B 素材墙 | 真实链接与标题、稳定入口、容器宽度、真实内容高度；实例动画清理和reduced-motion |
| Dock.tsx / .css | 63a008de65732d73010bd219d25d15c47739bb31 / Components/Dock | C 工作区工具条 | 中文标签、键盘可用、小幅放大、减少动态、作用域；不错误声明菜单 |

六项使用真实 TSX/CSS 源码；依赖 motion 与 gsap。MotionScenes.tsx 为幕间动画生命周期/可访问性包装，Home.tsx 与 visual-v3.css 为产品页面适配。节点、故事板、参数浮层与业务数据不是竞品源码。

许可是 **MIT + Commons Clause**，不是普通MIT。保留版权和许可，作为本应用源码交付；不将这些组件打包为独立组件库售卖、转授权或再分发。根目录 THIRD_PARTY_NOTICES.md 同时保留原项目其他版权与这六项的适用声明。
