# 本次实际验证记录

日期：2026-10-14。Node v22.16.0。所有“通过”仅限下表范围，不推定真实提供商、数据库或 UI 已验收。

| 检查 | 实际结果 |
| --- | --- |
| 新增 Agent 单元/合约测试 | **43 / 43 通过**，0 跳过、0 失败 |
| 合并原项目 Node 测试 | **109 项：104 通过、2 失败、3 跳过** |
| 两项失败 | 原有 S3 provider 测试导入 `@aws-sdk/client-s3` 失败；环境未能安装依赖。未删除测试，也未标为通过 |
| 三项跳过 | 原有 **Docker Compose** 配置测试；环境没有 Docker。不是“数据库测试已通过” |
| Agent 源码检查 | 14 个 TS/TSX 语法转换、Recap IconButton API、17 个语义 token 校验通过 |
| 补丁安全自测 | **9 / 9 通过**：检查不写入、幂等、冲突阻止、异常恢复、符号链接、路径保护、Git diff 正反向 |
| 原交接包完整副本演练 | 应用补丁后再次 **43 / 43 通过**，回滚后全部原始文件字节一致 |
| 官方桥插件语法 | `node --check integrations/deepseek-harness/drill-tools.mjs` 通过 |
| Agent 服务端限定范围 tsc | 被原 DAL 的 `pg` 模块/类型未安装阻塞；唯一报告为 TS2307，**不宣称完整 typecheck 通过** |
| 根项目完整 tsc / Web、Electron build | 未完成，项目依赖无法下载 |
| npm 安装 | `npm ci --offline --ignore-scripts` 缺缓存；联网下载环境 DNS 不可用 |
| 浏览器视觉/端到端 | 未执行；没有伪造页面运行截图或浏览器通过记录 |
| 实际 PostgreSQL/RLS/迁移 | 未执行；已有 DAL 测试使用模拟 pool，不等同真实数据库 |
| Docker 镜像与官方 SDK 安装 | 未完成；部署文件做了静态断言，不等同镜像成功构建 |
| 真实 DeepSeek / Harness 模型联调 | **未执行**：无真实 API key，官方 SDK 未安装。SDK 测试为注入替身，不是官方运行时验证 |

## 43 项新增测试覆盖

配置与引擎路由、URL 协议校验；范围格式、交集、隐藏/删除/AI/跨用户排除、递归环；真实已读取来源的引用校验；单条洞察、silent、无效 JSON 和虚假引用；历史完整工具链裁剪；分片 UTF-8 SSE、reasoning、tool_calls、usage、重试和中断；host 工具参数及权限；只读模式；记忆显式启用/确认；联网固定服务与不安全来源过滤。

还覆盖：资料同意、无配置、持久会话重载、私有 wire 不进入公开响应、跨用户拒绝、取消和撤回授权、并发/配额、过期租约、属性确认幂等与 stale、AI 输出独立保存、作用域不可变、分支/导出/归档/清除、重试不重复最后 user message、HTTP auth/Origin/公开 bootstrap、模拟 PG DAL 分层、模拟 Harness 生命周期/桥鉴权/禁止 Shell、插件最终 guard、分页与模型别名分离、部署静态接缝。

涉及模型响应、Tavily、PG pool、Harness factory 或 Cordis context 的测试均使用明确的受控替身。其价值是验证本补丁的逻辑和边界，不能证明外部服务兼容性或模型实际洞察质量。

## 复现命令

```bash
node --experimental-strip-types --test tests/agent.test.ts
node --experimental-strip-types --test tests/*.test.ts
npm run check:agent-source
node --check integrations/deepseek-harness/drill-tools.mjs
```

完整原始日志在交付补丁根目录 `validation/`。补丁应用/回滚/冲突演练日志也放在那里；这些日志与模型测试分别记录。

## 发布前必须补做

安装真实依赖并通过 `npm run check` / `npm run build`，启动真实数据库执行迁移；验证 Web / Electron 的实际渲染和交互；以非敏感数据、用户授权的真实账号完成两种引擎的连接/读取/引用/取消/审批 smoke。检查 Docker 构建中的官方 SDK 安装及生成的独立锁文件。

补丁是已编写并经过上述自动化逻辑验证的集成源码；**不是已通过所有发布门禁的生产认证包**。具体能力边界见 `HARNESS_CAPABILITY_MAP.md`。
