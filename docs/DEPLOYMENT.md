# 部署、开发、备份与安全边界

## A. 本地体验与正式部署是两条不同入口

`npm run demo` 不需 npm 依赖安装，读取 `preview/`，数据在 `.data/demo`，只绑定 `127.0.0.1`，无正式认证、媒体和 AI 能力。它用于虚构数据交互体验，不对外部署。

`npm start` 只使用 PostgreSQL，必须配置认证和存储，不会自动降级。CloudBase 与自托管共用服务端源码、PostgreSQL DAL、SQL 和 Dockerfile。

认证、附件存储、数据库位置分别配置：`AUTH_MODE=password|cloudbase`、`STORAGE_DRIVER=s3|cloudbase`、`DATABASE_URL`。计算服务运行在哪里不决定另外三项。S3 驱动覆盖 MinIO 和兼容 S3 的云存储，COS 不需要单独的业务代码。

旧 `BACKEND` 仅作兼容默认值：当某个独立选项缺失或为空时，`BACKEND=cloudbase` 将该选项默认到 CloudBase；否则认证默认 password、存储默认 s3。显式选项逐项优先。旧环境可保留 `BACKEND`；新安装设置两个独立选项即可。无效选项及选中适配器缺失的必填字段会在连接数据库前报错。

## B. 自托管 Compose

有两个互斥的启动入口；选择其中一个，不要叠加两个文件：

| 入口 | 创建的服务 | 用途 |
|---|---|---|
| `infra/compose/compose.yml` | PostgreSQL、应用、MinIO、桶初始化 | 原有本机 MinIO 部署；命令和数据卷名保持兼容 |
| `infra/compose/compose.external.yml` | PostgreSQL、应用 | COS / S3 / R2 / 已有 MinIO / CloudBase 存储；不创建也不等待本机 MinIO |

两个入口都可选 `--profile semantic`；数据库仅在容器网络内，应用只绑定宿主 `127.0.0.1:8787`。

前提：兼容 Node、Docker Engine / Docker Desktop 与 Compose、能够访问 npm 和镜像仓库。

```bash
node scripts/init-env.mjs
docker compose --env-file .env -f infra/compose/compose.yml up --build -d
docker compose --env-file .env -f infra/compose/compose.yml logs -f server
```

`init-env` 随机生成独立的数据库、JWT、S3 和登录秘密，写入 0600 的 `.env`；已有文件时拒绝覆盖。不要把实际 `.env` 放进 ZIP、资料库或 Git。

初次数据库启动执行 `init-db.sh`，以管理账号安装扩展／表，再建立 **NOSUPERUSER / NOBYPASSRLS** 的 `drill_app` 运行角色。服务端使用该角色，而不是拿超级用户规避 RLS。修改 SQL 后，已有数据卷不会自动重新运行初始化脚本：先备份，再用管理连接执行迁移，检查新表权限。当前迁移尚未形成成熟的版本升级系统。

Compose 不向宿主暴露 PostgreSQL；HTTP 与 MinIO 端口仅绑定本机。使用 `http://localhost:8787` 与 `.env` 的 `APP_ORIGIN` 保持一致。访问 `127.0.0.1` 而配置成 `localhost` 时，浏览器 Origin 可能被拒绝，不能通过关闭来源校验解决。

`S3_ENDPOINT=http://minio:9000` 是服务端 HEAD 的内部地址；`S3_PUBLIC_ENDPOINT=http://localhost:9000` 是客户端真正访问的签名地址。正式跨设备部署必须把后者改成客户端可访问的 HTTPS 存储域名，并配置精确的 CORS Origin。不要给签名 URL 做改变 Host 的普通重写。

以上内部地址是 `compose.yml` 的兼容默认值，可用 `S3_INTERNAL_ENDPOINT` 覆盖。宿主直接运行及 `compose.external.yml` 使用 `S3_ENDPOINT`；`S3_PUBLIC_ENDPOINT` 留空时使用相同端点。`S3_REGION`、`S3_BUCKET`、`S3_PATH_STYLE`、`S3_ACCESS_KEY` / `S3_SECRET_KEY` 均可配置；两项密钥必须同时提供，均不提供时使用 AWS SDK 默认凭证链。可选 `S3_SESSION_TOKEN` 支持临时凭证，但部署者需要负责更新过期凭证。服务启动时固定本次配置，更换配置后须重启应用。

### COS 示例

先运行 `node scripts/init-env.mjs`，再把 `examples/storage/cos.env.example` 的配置合并到 `.env`，替换地域、完整桶名和限定到该桶的密钥。不要将示例占位符当作可用凭证。保留生成的数据库/JWT/登录秘密。

```bash
docker compose --env-file .env -f infra/compose/compose.external.yml up --build -d
```

使用 `STORAGE_DRIVER=s3`。区域端点如 `https://cos.ap-beijing.myqcloud.com`，桶名含 APPID，`S3_PATH_STYLE=false` 生成 virtual-hosted-style 地址。区域端点中不重复加入桶名。配置依据：[腾讯云 S3 兼容配置](https://cloud.tencent.com/document/product/436/41284)。当前未使用真实 COS 凭证验收，不能把本地签名测试当作云端兼容性验证。

桶保持私有；CORS 精确允许应用 Origin、PUT/GET/HEAD，以及实际签名所需的 Content-Type / x-amz-* 请求头。只给应用所需的对象读写权限，不授予账户级管理权限。上线前实际验证：申请签名、浏览器直传、提交、读取图片/音视频、跨用户拒绝、签名过期。COS 对新桶默认域名的浏览器预览有限制，必要时配置存储自定义域名并单独验证签名地址，不能在签名后替换 Host。参见[腾讯云对象访问 URL 说明](https://cloud.tencent.com/document/product/436/57316)。

### 已有附件切换存储

修改配置不会搬运原文件。先备份并暂停写入，通过对象存储 API 复制所有对象，保留 `{user_id}/{asset_id}` 键和元数据，校验文件数量、大小与内容哈希，再切换配置并验证上传/读取，最后恢复写入。不能把 MinIO 的底层数据目录直接当成普通文件上传。保留旧桶供回退，不删除数据卷，不使用 `down -v`。数据库仍引用同一个 `storage_key`，客户端协议不变。

两个 Compose 入口默认使用相同项目名 `drill` 及 `drill_pg-data` 数据卷；已有部署切换时保持相同项目名（包括原来的 `-p` 参数）。迁移完成前不要删除旧 MinIO 容器或 `drill_media` 卷。

**镜像维护状态提醒：** 本次核查的 MinIO 与 mc 官方仓库页面已显示归档。Compose 保留原规格的 MinIO 技术路径及可查到的历史发布标签，适用于隔离开发；并不保证这些历史镜像当前安全、持续维护或 registry 可拉取。公网部署前必须审计并确认维护／替代计划，不应未经核验直接公开此配置。来源见 `RESEARCH.md` 的 R09/R10。

当前开发配置把 MinIO 管理凭证用于签名，仅为了减少本地初始化步骤。正式部署应改为限制在专用 bucket 的最小权限身份，并保护控制台，不开放匿名 bucket。还需 HTTPS 反代、持久化备份、日志脱敏、依赖审计、上传配额和滥用限制。

## C. 开发 React 界面与 Electron

联网安装 `npm install`。生产接口运行后，开发 Vite：

```bash
# 一个终端：向后端传入前端开发 Origin。数据库应可从宿主访问。
APP_ORIGIN=http://127.0.0.1:5173 npm run dev
# 另一个终端：
npm run dev:web
```

Vite 通过代理转发 API 到 `http://127.0.0.1:8787`。默认 Compose 的数据库没有宿主端口；宿主跑 server 时，需要自行通过仅回环地址的 PostgreSQL 端口映射或本机数据库提供连接。不要把数据库开放到公网。

桌面命令：

```bash
npm run desktop
npm run package:desktop
```

桌面本地数据库、媒体、凭证位于 Electron `app.getPath('userData')` 下。首次启动可以先离线捕获，再在「偏好与连接」填后端 HTTPS 地址及登录口令／令牌。绑定后不允许混用另一个用户／后端。

`contextIsolation=true`、sandbox、无 renderer Node 权限；preload 只暴露有限函数，IPC 验证主窗口主 frame。令牌通过 Electron safeStorage 保存，拒绝 `basic_text` 后端。这里仅说明实现，不代替目标 OS 的安全存储和打包测试。

全局 `CommandOrControl+Shift+Space` 打开捕获；快捷键冲突／注册失败仍需目标系统验证。连接器必须手动选择本机路径、点击拉取；应用不会自动扫描所有个人目录。

## D. CloudBase（待真实环境联调）

使用云托管容器，不用云函数。数据库必须是 PostgreSQL 并支持 pg_trgm / pgvector，执行同一套 SQL；管理迁移和运行角色分离。选择 CloudBase PG 存储接口，而不是混用传统 CloudBase 文档数据库存储凭证格式。

数据库使用 `DATABASE_URL`、`PGSSL=require`、`PGSSL_VERIFY=true`，来源校验使用 `APP_ORIGIN=https://你的应用域名`。选择 CloudBase 认证时设置 `AUTH_MODE=cloudbase`、`CLOUDBASE_AUTH_INTROSPECT_URL`、`CLOUDBASE_CLIENT_ID`；选择 CloudBase PG Storage 时设置 `STORAGE_DRIVER=cloudbase`、`CLOUDBASE_STORAGE_BASE`、`CLOUDBASE_SERVICE_KEY`、`CLOUDBASE_BUCKET`。可以只选择其中一项，例如 CloudBase 认证配 COS。上述 Compose 入口提供的是本机 PostgreSQL；托管 PostgreSQL 使用独立的应用容器和相应数据库环境变量。

认证适配显式读取 `CLOUDBASE_CLIENT_ID` 作为 introspect 的 `client_id`，与环境 ID 分开配置。必须核对实际租户身份服务，不能假设环境 ID 就是 OAuth client ID。适配器要求返回有效 `sub` 且不能为 inactive。Web 使用既有访问令牌交换 HttpOnly cookie，桌面／iOS 使用 bearer token；没有完整内置 CloudBase 登录／自动刷新 SDK 流程。

签名实现参考 PG storage 的 `/v1/storages/object/upload/sign/:bucketId/:objectName` 等路径，容忍若干响应层级。但本次不能验证真实返回契约、URL 拼接、签名方法、CORS 和 HEAD 权限；必须先用测试 bucket 做小文件直传／提交／读取／过期／跨用户验证，再启用真实数据。iOS 只处理 PUT，不支持 POST multipart 签名。

服务端不得转发文件内容，签名键由服务端生成，不接受客户端提交的任意 storage_key。当前 HEAD 检查还不是完整的可信内容哈希核验，上线前补充对象存储原生 checksum 能力。

## E. 模型与检索

AI 环境变量仅服务端读取：`AI_BASE_URL`（含版本路径，如 `/v1`）、`AI_MODEL`、`AI_API_KEY`。适配假设提供 `/chat/completions` 和 JSON object 返回能力。没有默认商业模型、没有内置 API key，没有隐式支付。

语义检索：配置 `EMBEDDING_URL` 指向 `POST /embeddings`；输入 `{"input":["text"],"model":"BAAI/bge-m3"}`，期望每条 1024 维有限数值向量。可选 sidecar：

```bash
# .env 中设置 EMBEDDING_URL=http://embedding:8080/embeddings
docker compose --env-file .env -f infra/compose/compose.yml --profile semantic up --build -d
```

首次下载模型需要网络与磁盘；该 Python 服务没有公开宿主端口。推理资源、内存、延迟、模型许可和生产可用性需要部署者评估，本包没有下载模型或验证推理。然后在偏好页手动重建向量索引。当前不是可靠的后台增量任务系统。

AI 请求会把选定范围的对象文本发送到你配置的模型提供方。将真实隐私笔记接入之前确认服务方的数据处理条款。未连接模型时，界面只显示不可用状态，不输出模拟洞察。

## F. 备份和恢复

正式库备份 PostgreSQL 的结构与数据，并独立备份对象存储原文件；同时安全保存服务器配置密钥。桌面关闭应用后备份整个 userData（包含 SQLite；活动状态下不能只拷贝主 db 忽略 WAL）。iOS 目前没有完整用户可见的恢复工具。

界面的 JSON 导出是对象／关系／版本／资产元数据交换格式，**不是含媒体二进制的完整备份，也没有一键导入恢复功能**。桌面导出还包括待上传变更与请求，用于故障诊断。重要资料必须有独立备份。

不要删除数据卷来“修复启动”；不要删除 outbox 来“恢复同步”；不要把 CloudBase service key、JWT secret、模型 key 或整个用户数据目录发到公开问题单。
