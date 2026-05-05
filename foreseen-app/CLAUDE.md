# 先见 Foreseen - 汤姆日记本心理体验
Vite + React + TypeScript + GSAP + MiniMax API

<directory>
src/components/ - UI组件层 (4组件: BookPage, InputBox, SystemResponse, OptionBox)
src/systems/ - AI对话引擎 (1文件: minimax.ts)
src/styles/ - 设计令牌 (1文件: tokens.css)
</directory>

<config>
index.html - 入口，加载 Cormorant Garamond + Courier Prime 字体
.env.example - MiniMax API Key 配置模板
vite.config.ts - Vite 构建配置
</config>

## 核心设计决策

- **同一纸面交互**: 所有内容在单一书写区出现又消失，模拟汤姆日记本的墨水吸收与涌现
- **状态机驱动**: Phase = input | ink-fading | responding | showing，无分支判断
- **选项即文字**: OptionBox 渲染为纯文本行，点击后像用户手写一样被吸收
- **降级策略**: 无 API Key 时回退预设文案，体验完整性不依赖外部服务
- **撕裂纸边**: SVG feTurbulence + feDisplacementMap + drop-shadow 跟随轮廓

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
