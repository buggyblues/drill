# 未发布 · 2026-10-13

认证和附件存储独立配置：新增 `STORAGE_DRIVER=s3|cloudbase`，`AUTH_MODE` 不再绑定存储；旧 `BACKEND` 保留逐项默认值兼容。S3 适配器支持独立配置实例和可选临时凭证；配置错误在连接数据库前报告。

新增不含 MinIO 的 `compose.external.yml`，原 MinIO 启动入口和数据卷名称保持兼容，桶名/区域/寻址方式可配置。补充 COS 环境变量模板、权限/CORS/迁移说明以及组合配置、签名、内部校验和 Compose 回归测试。真实 COS 直传与读取仍需凭证联调。

# 0.1.0 · 2026-10-12

依据用户提供的四份规格和设计参考建立 drill monorepo。实现共享三栏 UI、画布、服务端唯一合并、SQLite outbox、连接器、SwiftUI 捕获端、PostgreSQL 迁移和双部署适配。

新增本机可运行体验资源；保留真实服务响应，不在 AI 或向量未配置时伪造功能。附上 47 项 Node 测试、23 项隔离浏览器检查、语法解析结果和界面截图。

修复并发修改不同字段时的虚假冲突、已观察段落修改被慢设备时钟压回旧值、iOS 最近列表协议字段名、桌面桥调用名、跨用户重连覆盖旧凭证、iOS 损坏缓存被覆盖风险、重复 AI 引用计数、CloudBase client ID 与环境 ID 混用风险。

正式依赖安装／类型检查、Vite／Electron 构建、数据库／CloudBase 集成与 iOS 真机验收尚未完成。发布边界见 README 和 TEST_REPORT。
