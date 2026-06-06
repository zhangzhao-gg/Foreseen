# 先见 Foreseen - 汤姆日记本心理体验
Vite + React + TypeScript + GSAP + MiniMax API

<directory>
src/components/ - UI组件层 (5组件: BookPage, InputBox, SystemResponse, SummaryModal, HistoryDrawer)
src/systems/ - AI对话引擎 + 持久化 (2文件: minimax.ts, storage.ts)
src/styles/ - 设计令牌 (1文件: tokens.css)
</directory>

<config>
index.html - 入口，加载 Cormorant Garamond + Courier Prime 字体
.env.example - MiniMax API Key 配置模板
vite.config.ts - Vite 构建配置
</config>

## 核心设计决策

- **同一纸面交互**: 所有内容在单一书写区出现又消失，模拟汤姆日记本的墨水吸收与涌现
- **状态机驱动**: Phase = input | ink-fading | responding | showing | summarizing
- **结束洞察模态**: 对话结束时二次 API 调用生成角色深度洞察，弹出全屏模态框展示
- **左侧历史抽屉**: 固定定位抽屉面板，展示历史对话列表（总结+完整对话原文）
- **localStorage 持久化**: 每次对话结束存入 DiaryEntry（summary + messages + metadata）
- **幽灵打字**: AI 可选预言用户下一句话，逐字渗入输入框，用户打字即夺回控制权
- **降级策略**: 无 API Key 时回退预设文案，体验完整性不依赖外部服务
- **异步安全**: AbortController 管理，翻页/新提交时取消旧请求

## 部署

详见 `docs/deploy.md`（内部运维文档，不随代码开源）。

架构概要：前端静态文件由 Nginx 托管，`/api/*` 反代至 Node 代理层（隐藏 API Key），前端不接触密钥。

[PROTOCOL]: 变更时更新此头部，然后检查 CLAUDE.md
