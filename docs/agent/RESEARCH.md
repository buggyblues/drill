# 研究与产品映射

核对日期：2026-10-14。仅使用官方帮助、官方 API 文档和指定开源仓库；没有把第三方宣传当作性能证明。

## flomo 的 AI 洞察

官方帮助描述的核心交互是：由用户挑选笔记；一条也能开始，相关笔记也能成组分析；可以选或自定义视角；按时间与标签筛选；引用标记能返回原笔记。目标是发现主题、盲点与更好的问题，而不只是把笔记缩写一遍。[1]

Drill 的映射是 `对象入口 → 范围 → 视角 → 异步运行 → 有证据的解释 → 追问/保存`。七个中文视角和文案为本补丁原创，并非逐字复制 flomo 的全部角色、界面或提示词。范围增加 Drill 自身的领域、项目和画布。观察/解释分栏、证据不足时保持无结论、版本确认写入是结合 Drill 约束的设计，不声称它们是 flomo 的内部算法。

没有公开证据能确认 flomo 的私有 prompt、检索排序、聚类、向量数据库或后端模型配置。本实现没有宣称复制这些内部机制，也没有臆造质量对照或“超过 flomo”的结论。

## DeepSeek Harness 与原生 API

研究版本为官方仓库提交 `d743267388641bc76f17c45ce8b4c231aed1d32c`，版本 `0.2.1-alpha.2`，提交时间 2026-10-09 UTC。[2]

官方 TypeScript SDK 的 `DeepSeekHarness` 拥有子进程生命周期，通过 stdio JSON-RPC 运行会话；可选显式启动配置、事件通知、最终回答及关闭回收。当前 SDK 不提供单轮中断，放弃运行需要关闭 runtime。[3] 因此本实现每轮独占 runtime，取消不会去杀其他用户进程。对话由 Drill 自己持久化，不冒充跨轮保留的官方 SDK session。

`SDK minimal` 配置默认包括持续 Shell 和 `danger-full-access` 策略。[4] 对个人知识应用原样开放这些能力并不合适。补丁加载原创工具插件，使用官方注册表、最终 guard 与 restrict API，默认禁止所有非 Drill 工具。[5] 这是工具层权限边界，不是宣称完成了操作系统级沙箱认证。

DeepSeek 的思考工具调用需要正确保留工具链中的 reasoning_content；原生适配器按官方协议保留，但不将其当作用户可见思考过程。[6] 这一点与“把原始思考链放进前端”的做法不同。

“某个框架能把某个模型能力发挥最好”是用户的选型方向，不是本交付经过跑分证明的事实。这里采用指定官方 runtime，并写明预算与权限裁剪，没有编造基准测试。

## 来源

[1] flomo 官方《AI 洞察》：https://help.flomoapp.com/ai/insight.html

[2] 官方仓库及固定版本：
https://github.com/deepseek-ai/deepseek-harness/tree/d743267388641bc76f17c45ce8b4c231aed1d32c

[3] SDK 合约与限制：
https://github.com/deepseek-ai/deepseek-harness/blob/d743267388641bc76f17c45ce8b4c231aed1d32c/packages/sdk/client/README.md

[4] 最小 profile 配置：
https://github.com/deepseek-ai/deepseek-harness/blob/d743267388641bc76f17c45ce8b4c231aed1d32c/packages/bundle/sdk-minimal/cordis.patch.yml

[5] 工具注册与权限合约：
https://github.com/deepseek-ai/deepseek-harness/blob/d743267388641bc76f17c45ce8b4c231aed1d32c/packages/core/tools/src/index.ts
https://deepseek-harness.github.io/deepseek-harness/en/reference/subsystems/tools

[6] DeepSeek 官方思考模式与工具调用文档：
https://api-docs.deepseek.com/guides/thinking_mode/

[7] 可选 Tavily 官方搜索 API：
https://docs.tavily.com/documentation/api-reference/endpoint/search
