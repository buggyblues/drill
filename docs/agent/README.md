# Drill Agent · 集成与部署

交付日期：2026-10-14。基线：`Drill-AI-交接包-2026-10-14.zip`。
这是原项目的增量实现，不是独立聊天演示，也不是把 REST 请求改名为 Harness。

## 先确认两个运行路径

| 路径 | 实际执行方式 | 安装 |
| --- | --- | --- |
| `harness`（本交付推荐） | 官方 `DeepSeekHarness` SDK 驱动独立子进程；Drill Cordis 工具插件通过鉴权回环桥访问资料 | `npm run agent:install-harness` |
| `deepseek`（显式轻量选项） | Drill 自己的有界工具循环，调用 DeepSeek 原生流式接口 | 随原项目，无新增主依赖 |

`.env.example` 推荐 Harness。已有安装如果没有设置 `DRILL_AGENT_ENGINE`，为兼容保留轻量默认。
安装失败、缺少 SDK 或模型不通时不会静默改用另一条链路。
上游锁定：`0.2.1-alpha.2`，研究提交 `d743267388641bc76f17c45ce8b4c231aed1d32c`。
这不是把官方仓库全部插件复制进来；完整边界见 `HARNESS_CAPABILITY_MAP.md`。

## 本机安装

先按照补丁包根目录 `AI_PATCH_INSTRUCTIONS.md` 比对、应用。不要用 after/ 覆盖整个本地仓库。

```bash
# 项目根目录；Node 至少满足原项目 >=22.16.0 要求
npm ci
npm run agent:install-harness

# 已有 .env 只手工合并新增变量，绝不覆盖现有数据库/存储凭证。
# 新安装才使用 cp .env.example .env

# 使用原项目已配置的数据库连接；先备份数据库。
npm run migrate
npm run check
npm run build
npm run test:agent
npm start
```

服务端 `.env` 的关键项：

```dotenv
DEEPSEEK_API_KEY=填入你自己的服务端密钥
DRILL_AGENT_ENGINE=harness
DRILL_HARNESS_MODEL=deepseek-v4-flash
DEEPSEEK_BASE_URL=https://api.deepseek.com
DEEPSEEK_MODEL=deepseek-flash
DEEPSEEK_REASONING_EFFORT=high
```

两种模型名称来自不同的官方接口示例，**不是本补丁保证永久有效的别名**。Harness 使用 provider/model 路由；REST 和只读子分析使用 `DEEPSEEK_MODEL`。按自己账号当前可用模型显式设置，绝不偷偷替换。Harness 的官方 API 适配器使用自己的官方端点；`DEEPSEEK_BASE_URL` 只控制轻量引擎和宿主只读子分析。

首次打开「偏好与连接 → Agent 服务」，确认资料发送授权，再按「测试连接（不读笔记）」。测试建立空资料范围的独立会话、实际调用提供商并消耗一次运行额度。看到“已配置”只说明存在环境变量，不等于在线测试成功。

不安装官方运行时时，显式设置：

```dotenv
DRILL_AGENT_ENGINE=deepseek
DEEPSEEK_MODEL=deepseek-flash
DEEPSEEK_THINKING=enabled
```

Harness 模式的子分析仍通过宿主 REST 请求执行；这是有独立作用域和预算的 Drill 子分析，不冒充 Harness 原生多智能体编排。其 REST 模型单独配置。

## Docker / Compose

已补齐 `infra/docker/Dockerfile` 的 Recap workspace manifest、可选 SDK 构建与运行目录复制。
已有 `compose.yml` 继承 `compose.external.yml`，两种部署都会得到新的服务端环境变量。

```dotenv
DRILL_WITH_HARNESS=true
DRILL_AGENT_ENGINE=harness
```

```bash
docker compose --env-file .env -f infra/compose/compose.external.yml build server
# 已存在的数据卷不会重跑初始化脚本；用 PostgreSQL 管理角色执行新增 SQL。
# server 使用受限的 drill_app，不能修改 RLS 策略；不要用 server 容器运行 migrate.ts。
docker compose --env-file .env -f infra/compose/compose.external.yml exec -T postgres \
  psql -v ON_ERROR_STOP=1 --username postgres --dbname drill --file /drill-sql/006_agent.sql
docker compose --env-file .env -f infra/compose/compose.external.yml up -d
```

本地 MinIO 部署把文件名换为 `infra/compose/compose.yml`。CloudBase Cloud Run 使用同一镜像时，构建参数和服务端变量也必须设置。构建 Harness 会安装上游依赖；本环境没有完成该镜像构建，不应直接跳过本地验收。

官方顶层包精确固定，安装将产生独立 `integrations/deepseek-harness/package-lock.json`；首次成功安装后请审阅并提交这份真实生成的锁文件。交付没有编造未安装过的依赖锁或完整性值。

## 已接入页面与使用方式

侧栏新增 **Agent**，原 **洞察** 页面换成完整范围/视角/结果流程。对象详情有“与 Agent 聊聊”和“从这条记录洞察”入口。新页面直接用现有 `@recap/ui` 的按钮、表面、分段控件、对话框及设置行；17 个样式令牌均来自现有规范，没有第二套主题或字体。

对话支持历史查找、改名、归档恢复、在回答处分支、导出与清除；对话/深入研究/只读规划三种模式；流式内容、真实工具进度、计划、取消与失败重试；引用回原对象；明确点击后才保存 AI 旁注或采纳属性调整。网页和 Electron 共用 React 页面；Electron 通过已有 JSON IPC 与同一服务端通信，不是本机离线模型。

洞察支持单条、多条、最近 7/30 天、日期、标签、领域/项目递归、画布范围，以及选择一条后扩展直接关系；七个视角（含自定义），证据不足不凑结论，观察与解释分开，结果含引用、追问、小实验、反馈、继续对话及独立保存。没有把洞察自动变成待办。

服务器从 DeepSeek 接收 SSE；网页/桌面以 650ms JSON 快照轮询兼容现有 IPC。原生引擎逐步显示文本；Harness 当前显示工具进度并在最终回答提交后显示文本，**不声称已接入官方通知级逐 token UI**。连接断开后 3s 重试轮询，不重新付费执行模型。

## 资料、安全与可控写入

资料作用域由服务端验证。筛选条件求交；错误字段和格式报错，不退回“全部”；隐藏、删除、临时、AI 生成对象与其他用户的数据不进入新检索。检索采用已有词面/关系能力，提供分页，**不是新建的向量 RAG**。单次读取正文最多 6000 字；返回截断标志。长篇、全库研究不能声称已逐字读完全部原文。

对话范围建立后不可更改；更换范围请开新对话。以前已经进入对话的内容仍属于保存的历史，隐藏原对象或关闭记忆不会自动改写旧消息。涉及撤回历史数据时，清除相关会话；已发送到提供商的数据不能由此远程撤回。

所有自动操作均不覆盖标题、正文、块。`propose_metadata` 仅提出 kind/tags/status/belongs 候选；卡片显示对象、旧值、新值与版本，tags 为追加。用户按“确认采纳”后再次验证作用域、权限和版本，版本过期标为 stale，绝不覆盖新版本。AI 不能把原文标成用户沉淀、自我判断或外部产出。保存生成结果只新建 `ai_output`，保留证据快照和 cite 关系，重复点击幂等。

个人记忆默认关闭，单独启用；模型只能提出待确认记忆，或用户手工保存。可禁用和删除；这与知识库原本的“个人记忆”对象不是同一个表。洞察不读取这些 Agent 记忆，也不联网。

可选 `TAVILY_API_KEY` 仅服务端存储。每段对话另外勾选联网；Tavily 会收到模型生成的查询，提示词禁止携带私密原文，但**这不是经过验证的自动脱敏系统**。敏感问题请关闭联网。只调用固定搜索服务，不访问模型任意给出的 URL。

私有协议历史（包括 DeepSeek 工具链要求回传的 `reasoning_content`）只存服务端 agent_records，不包含在对象 bootstrap / 同步 / 会话导出里。它不是加密数据库或端到端加密；管理员、数据库和备份仍是信任边界。原始思考链不展示在前端。

## 运行预算与恢复

默认每用户滚动 24h 30 次、同时 2 次、同一会话 1 次，服务器进程最多 32 个已启动运行。每次 180s 超时、每模型请求 4096 输出 token。轻量引擎最多 10 模型步骤；Harness 桥最多 40 工具调用，**不等价于官方 runtime 的模型轮数硬上限**。只读子分析最多 2 次、联网最多 3 次。预算是成本保护，不是精确账单。

原生用量显示提供商返回的输入、输出、缓存 token，并累计宿主子分析；Harness 当前不聚合官方模型 token，只显示账单提示。界面不估算金额。

运行状态在 agent_records 持久化，心跳续租；进程退出或故障后过期租约标记 interrupted，不自动重放付费运行。可由用户显式重试。SIGTERM/SIGINT 先终止模型工作并记录状态，再关闭数据库。服务端挂起的内存队列不是分布式可靠任务队列；高并发或大型知识库需要把 Agent DAL 改为分页查询/独立工作队列。

数据库迁移 `006_agent.sql` 增加独立表与 RLS，不修改现有对象字段。代码回滚不 DROP 表、不删除 Agent 数据。需要永久删除数据时应另外制定备份与审计方案。

## 验收与排错

运行 `npm run test:agent`、`npm run check:agent-source`、`npm test`、`npm run check`、`npm run build`。本次实际结果与未执行项见 `TEST_REPORT.md`，不要把 source-only 检查当成完整 TypeScript 或浏览器验收。

故障处理：503 未配置/SDK 缺失 → 检查服务端变量与可选安装；403 → 检查登录、Origin、资料授权；409 → 当前运行未结束或原记录已变化；429 → 等待额度/并发释放；模型错误 → 核对本账号模型名、余额、端点与上游版本。密钥或提供商原始错误不进入用户错误文本。

升级 Harness 先改版本、复核官方 SDK 和 Cordis 合约、执行真实连接/取消/工具白名单 smoke，再更新能力矩阵。不要仅改为 `latest`。
