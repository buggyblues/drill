# 实际验证报告

验证日期：2026-10-12。这里记录实际执行结果，而非把仓库中有测试脚本等同于已通过测试。

## 通过的检查

| 检查 | 结果 | 证据 |
|---|---:|---|
| Node 自动化测试 | **47 / 47 通过** | `validation/node-tests.tap` |
| 浏览器主要交互检查 | **23 / 23 通过** | `validation/browser-results.json`、`browser-console.txt` |
| TypeScript 语法解析 | **27 个源码文件，0 个语法错误** | `validation/typescript-syntax.json` |
| Swift 语法解析 | **退出码 0** | `validation/swift-parse.txt` |
| JSON / YAML / Python 语法解析 | **13 个文件，0 个语法错误** | `validation/config-syntax.json` |
| 界面截图 | **7 张实际运行截图** | `validation/screenshots/` |

Node 测试使用 Node 22.16.0，内置 SQLite 的 experimental 警告保留在日志中，没有将它隐藏为正式稳定性结论。

## 47 项测试覆盖什么

覆盖离线捕获时刻保持、mutation 幂等、字段冲突保留丢失值、段落并集、墓碑不可被旧端复活、分组不跨画布、嵌套防环、整个批次回滚、外部来源冻结、AI 不能覆盖正文、未知链接不自动建对象、动态属性基本约束、时区、非法对象结构、跨用户资产／来源引用、因果已观察修改不因本机时钟落后被错误丢弃。

桌面测试实际打开 SQLite 和临时文件目录，验证三条离线捕获、重启恢复、失败重试、推拉确认、用户绑定、防止串库，以及三个连接器的解析和来源快照。它们不经过 Electron 主进程或系统权限层。

HTTP 测试启动真实 Node HTTP server，但仓库使用隔离的 DemoRepository；存储提供者采用签名契约替身；AI 使用本地模拟的模型 HTTP 返回。测试证明路由、鉴权边界、对象／建议处理，不证明 PostgreSQL 查询、云存储或真实模型质量已经通过。

## 浏览器检查如何运行

当前浏览器环境不允许普通 URL 导航，因此没有改动浏览器策略。测试通过 Playwright `set_content` 注入本地静态资源，以受限 Python transport 转发相对 API 请求到真实 Node 服务；Cookie 会话由测试端 requests.Session 保存。

界面依然执行自己的捕获、提炼、搜索、拖拽和状态更新逻辑，后端记录由断言读取验证，不是仅断言页面按钮存在。采用包内隔离的 React 16 体验运行时，而不是未安装的 React 19。

因此该检查**不覆盖真实浏览器网络栈的 Cookie、CORS、CSP、跨域存储上传、Vite 产物、Electron、SwiftUI 或 iOS 真机**。23 项检查不能缩写成“所有端到端测试都通过”。

截图 `07-mobile-web.png` 是 390px 宽的 Web 视口，不是 iPhone SwiftUI 运行结果。

## 明确没有通过／没有执行的检查

完整 `tsc --noEmit` 已尝试，但缺少 React、Electron、Vite、pg、AWS SDK 等生产依赖／类型，产生缺失模块和连带类型诊断；**不是通过**。原始诊断保留在 `validation/typecheck-blocked.txt`。语法解析仅说明语法树可解析，不能替代类型检查，也不能排除联网安装真实类型后还有需要修正的问题。

npm registry 在构建环境不可达，未能完成正式依赖安装，因此没有有效 `package-lock.json`、React 19 / Vite 构建、esbuild Electron 构建结果或生产依赖漏洞审计。

环境没有 Docker/PostgreSQL/MinIO 实例、CloudBase 凭证、Electron 二进制和 Xcode/iOS SDK。没有对这些项目伪造测试日志：迁移执行、RLS 验证、双后端一致性、真实直传、Xcode 编译签名、iOS 启动 <1秒、原生权限、长期稳定性、几万对象性能。

## 如何复测

```bash
npm test
# 安装正式依赖后：
npm run check
npm run build
node scripts/check-syntax.mjs
node scripts/build-browser-test.mjs
python -m pip install playwright requests
python -m playwright install chromium
python tests/browser_smoke.py
```

浏览器脚本会启动临时演示服务，使用临时数据目录，结束后关闭并清理，不修改个人知识库。Windows 的 `npm test` 是否接受同样的通配符需在目标系统验证；当前执行系统为 Linux。

原生和生产服务的下一轮验收步骤见 `docs/ACCEPTANCE.md`。
