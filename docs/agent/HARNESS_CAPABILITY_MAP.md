# Harness 能力映射与明确边界

官方包精确固定 `0.2.1-alpha.2`；不是 vendored 全仓库。以下分类是交付事实，不能全部写成“原生 Harness 已移植”。

| 能力 | 本补丁状态 | 具体实现 / 边界 |
| --- | --- | --- |
| 官方模型/运行循环 | 官方 SDK 真实接入代码 | `harness.ts` 动态加载 DeepSeekHarness；当前环境未安装并执行真实 SDK |
| SDK 启动、JSON-RPC、profile | 官方 SDK 委托 | `sdk-minimal` + Drill 插件；固定 env/cwd/home |
| Cordis 工具注册/并发声明/权限 | 官方 API 接入代码 | `drill-tools.mjs` 的 register/guard/restrict；本地桥再次校验 |
| DeepSeek 思考与工具调用 | 两条链路实现 | Harness 由官方 adapter 管；原生流解析与 reasoning replay 已用模拟流测试 |
| 流式界面 | Drill 适配 | 原生 token 文本；Harness 工具事件 + 最终文本；UI 650ms JSON 轮询 |
| 历史、分支、归档、导出 | Drill 适配 | 数据库持久化，独立于对象同步；不是跨轮复用官方 runtime |
| 上下文压缩 | Drill 有界裁剪 | 老对话转截断摘录，完整保留被保留轮次的 tool/reasoning 对；非上游语义摘要算法 |
| 多智能体/任务委派 | Drill 只读子分析 | 最多 2 次独立 REST 请求，同作用域，无写权限；不是官方任意 subagent 树 |
| 研究计划/进度 | Drill 工具 + UI | update_plan 写运行记录，不写待办 |
| Skills | Drill 内置技能 | 四项结构化指导，按需 load_skill；不是文件系统插件市场 |
| 长期记忆 | Drill 显式确认记忆 | 新增/关闭/删除、默认关闭；不自动推断敏感属性 |
| 重试/取消/恢复 | 官方关闭 + Drill 状态机 | 原生连接前有界重试，输出后不盲重试；Harness 关闭所属 runtime；过期租约 interrupted |
| 工具审批 | Drill 候选/确认合约 | 原文禁止修改；属性提议完成后 UI 确认；不是尚未实现的 SDK server→client 审批 RPC |
| 联网 | 可选固定搜索服务 | Tavily 手动开启；不自动浏览任意 URL；洞察禁用 |
| 笔记/关联检索 | Drill 原有知识模型适配 | 范围交集、词面/关系、分页；并非完整向量 RAG |
| 可观测性 | Drill 运行事件 | 状态、工具、计划、子分析、确认、缓存 token；不转发原始思考或本机路径 |
| 用量与预算 | 部分实现 | 原生实际 usage 累计；Harness 官方模型 token 未聚合，账单为准 |
| 任意 Shell / 文件写入 | 默认禁止 | 最终工具 guard 阻止；不能通过 UI 解除；没有声称 OS 沙箱安全认证 |
| PTC / 任意 run_code | 禁止 | 为知识应用避免任意代码执行，不把它伪装成已支持 |
| 任意 MCP/远程插件 | 未实现 | 需要独立安装信任、数据外发、凭证管理与权限模型；不开放粘贴地址即接入 |
| 上游 TUI/ACP/编程 IDE | 不移植 | 不适合 Drill 笔记产品，改用其现有设计规范 |
| 原生后台队列/多进程可靠调度 | 未实现 | 持久状态 + 租约检测，运行工作仍在进程内；重启需用户显式重试 |
| 定时/主动推送洞察 | 未实现 | 本补丁是用户触发；没有承诺无需部署调度器便每天生成 |
| 图片理解/附件全量分析 | 未实现 | Agent 读取对象文本，不把带附件对象当作图片已被分析 |
| iOS 原生 Swift 界面 | 未新增 | 共用 Web / Electron 页面已接入；iOS 可后续复用 HTTP API |

## 扩展时保持的约束

新能力先定义共享契约、作用域规则、readonly/写候选、参数校验、预算与测试，再加入工具表。
不能仅靠模型提示词保证授权。所有跨工具/外部资料都是不可信内容；新的网络服务必须有独立确认。
如需接入上游完整 skills/subagent/MCP/PTC，请先单独复核其权限和生命周期，不得移除当前 guard 后宣称仍然安全。
