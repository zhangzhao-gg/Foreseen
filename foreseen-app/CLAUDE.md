# 先见 Foreseen - 汤姆日记本心理体验
Vite + React + TypeScript + GSAP + MiniMax API

<directory>
src/components/ - UI组件层 (3组件: BookPage, InputBox, SystemResponse)
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
- **幽灵打字**: AI 可选预言用户下一句话，逐字渗入输入框，用户打字即夺回控制权
- **降级策略**: 无 API Key 时回退预设文案，体验完整性不依赖外部服务
- **撕裂纸边**: SVG feTurbulence + feDisplacementMap + drop-shadow 跟随轮廓

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
