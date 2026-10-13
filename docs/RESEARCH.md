# 技术调研与实现依据

核查日期：2026-10-12。以下为官方文档、官方源码／发布页和模型发布者资料；没有把第三方教程或仅搜索到的产品介绍当作 API 契约。这里记录“为何这样实现”，不等于真实部署已验证。

## 来源与对工程的影响

| 编号 | 一手来源 | 采用的结论／限制 |
|---|---|---|
| R01 | Electron Security: https://www.electronjs.org/docs/latest/tutorial/security | renderer 不开放 Node；隔离 preload、约束 IPC 来源、限制导航；目标版本仍需完整检查 |
| R02 | Electron Context Isolation: https://www.electronjs.org/docs/latest/tutorial/context-isolation | 使用 contextBridge 暴露有限功能，而不是完整 ipcRenderer 或任意文件访问 |
| R03 | PostgreSQL pg_trgm: https://www.postgresql.org/docs/current/pgtrgm.html | 正式搜索使用三元组相似度／文字查询；不会把 DemoRepository 的简单字面匹配宣称为真 pg_trgm 执行 |
| R04 | pgvector 官方仓库: https://github.com/pgvector/pgvector | PostgreSQL 支持向量与精确近邻；本版建 vector 字段，但尚未对数据库 ANN 性能作承诺 |
| R05 | BAAI bge-m3 模型卡: https://huggingface.co/BAAI/bge-m3 | 向量采用 1024 维契约；只在真实服务返回正确维度后使用，不以 hash／随机数伪造语义向量 |
| R06 | CloudBase 存储总览及 PG API: https://docs.cloudbase.net/http-api/storage-overview ; https://docs.cloudbase.net/http-api/storage-pg/pg-storage-api | PG 存储与传统接口分开。代码采用签名上传／下载适配；实际响应、方法、权限、CORS 未联调 |
| R07 | CloudBase token introspection: https://docs.cloudbase.net/http-api/auth/auth-token-introspect | 认证放在服务端；显式配置 introspection URL 和 client_id。该页面部分读取超时，完整实际契约仍应由真实环境响应验证 |
| R08 | Node.js SQLite 文档: https://nodejs.org/api/sqlite.html | 采用运行环境 Node 22.16 的 DatabaseSync；不把新版本 Node 文档的所有 API 名称直接套到旧版运行时 |
| R09 | MinIO 历史发布页: https://github.com/minio/minio/releases/tag/RELEASE.2025-09-07T16-13-09Z | 标签存在；核查页面同时显示仓库已于 2026-04-25 归档。不能据此声称历史镜像是当前安全生产推荐 |
| R10 | mc 历史发布页: https://github.com/minio/mc/releases/tag/RELEASE.2025-08-13T08-35-41Z | 标签存在；页面显示仓库已于 2026-07-14 归档。未验证镜像仓库拉取和镜像 digest |
| R11 | Vite 官方指南: https://vite.dev/guide/ | 正式前端提供 Vite 入口；当前环境 npm 安装受阻，所以没有产出可证明成功的正式构建日志 |
| R12 | Apple Keychain Services: https://developer.apple.com/documentation/security/keychain-services | 原生令牌放 Keychain，不写到普通 JSON 缓存；官方页面部分需要 JavaScript 展示，代码仍须 Apple SDK 验证 |
| R13 | Apple PhotosPicker: https://developer.apple.com/documentation/photosui/photospicker ; URLSession: https://developer.apple.com/documentation/foundation/urlsession | SwiftUI 相册与 URLSession 直传路径；未用浏览器上传测试冒充原生权限／媒体测试 |
| R14 | React 16.0.0 MIT 许可: https://raw.githubusercontent.com/facebook/react/v16.0.0/LICENSE | 只为本机体验运行时保留许可；正式版本仍是包声明的 React 19 工程，二者不得混淆 |

## 研究中发现的重要部署变化

规格中的“自托管用 MinIO”在本次仍保留为隔离开发路径，但官方仓库已归档这一状态必须进入部署风险说明。没有擅自换掉用户指定的存储技术，也没有称历史 tag 为最新稳定安全版本。正式上线前需要确定可维护的存储服务、补丁和镜像策略。

CloudBase 文档不能只按“看过签名接口名称”就视为契约验证。本包将认证与签名封装为适配器，并把真实 bucket／令牌联调列为发布门槛；尤其是 iOS PUT 与服务端可能返回 POST 签名的方法兼容，需要用实际返回验证。

## 没有可靠答案的部分

不能由文档直接推出特定知识库的最佳相关阈值、随机漫步概率、聚类方式、冷启动耗时或记忆效果。当前数值都是显式工程默认值，见 `DECISIONS.md`，没有用伪引文证明它们“最优”。

没有获得真实 CloudBase 环境、模型凭证、目标 Apple SDK 和生产数据库实例；调研来源解释设计，但不能补足真实集成测试。
