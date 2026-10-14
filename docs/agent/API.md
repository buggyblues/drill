# Agent HTTP API

沿用 Drill 原认证与 Origin 检查。服务端识别用户，正文不接受 user_id 切换租户。桌面走同一 JSON IPC 请求白名单。所有正文是 JSON object。以下路径的 GET 不需要正文。

| 方法 / 路径 | 用途 / 关键正文 |
| --- | --- |
| GET /agent/capabilities | 非密钥配置、引擎、模型、同意状态、预算 |
| POST /agent/settings | `{consent:boolean,use_memory:boolean}`，字段可选；撤回 consent 会取消活动运行 |
| POST /agent/scope | `{scope}` → 数量与最多100条标题；不发送模型请求 |
| GET /agent/sessions?archived=true | 默认活动会话；显式 archived=true 获取归档 |
| POST /agent/sessions | `{title?,mode?,scope?,allow_web?}` |
| GET /agent/sessions/:id | 公开消息和运行；不含私有 wire |
| PATCH /agent/sessions/:id | `{title?,archived?,mode?,scope?,allow_web?}`；运行期间拒绝，已有消息不能换 scope |
| POST /agent/sessions/:id/fork | `{message_id}`，分支保留起点及之前的公开消息 |
| GET /agent/sessions/:id/export | JSON 导出公开会话，无 private reasoning |
| POST /agent/sessions/:id/purge | 清空私有/公开会话与运行内容并归档；保留独立 AI 旁注及额度元数据 |
| POST /agent/runs | `{session_id,input}` → queued run；不能通过正文换租户/引擎 |
| GET /agent/runs/:id?after=0 | 快照、状态与事件；after 返回较新事件，events_reset 提示游标过旧 |
| POST /agent/runs/:id/cancel | 幂等取消 |
| POST /agent/runs/:id/retry | 仅 failed/cancelled/interrupted；重新计次，最后失败 user message 去重 |
| POST /agent/runs/:id/save | 新建 AI 旁注，幂等返回 `{object_id}` |
| POST /agent/runs/:id/approve | `{action_id,decision:"accepted"|"rejected"}`；明确版本校验 |
| POST /agent/runs/:id/feedback | `{value:"helpful"|"not_helpful"}` |
| POST /agent/runs/:id/follow-up | 洞察完成后返回 `{session_id}`，继续在 Agent 中对话 |
| GET /agent/insights | 最近最多100个洞察运行 |
| POST /agent/insights | `{scope,perspective,custom?}`，单条也可，空范围拒绝 |
| GET /agent/memories | 当前用户记忆 |
| POST /agent/memories | `{text}` 用户手工确认新增，最多1200字 |
| PATCH /agent/memories/:id | `{disabled?,text?,remove?}`；remove 清空文本并停用 |

作用域示例（条件求交）：

```json
{"object_ids":["note-id"],"tags":["学习"],"since":1790000000000,"until":1791000000000}
```

其他字段：`belongs` 为领域/项目根节点（沿 belongs 边递归）；`canvas_id` 限定画布放置对象。`object_ids:[]` 是空范围，不是全库。`include_hidden` 即使传 true 也不放开隐藏资料。未知字段拒绝。

错误遵循现有 `{error}` 结构。控制请求不触发模型重试；poll 只读状态。API 处理不自动把 `pending` 变成 `accepted`，用户自然语言“好的”也不构成写入授权。
