# 竞品调研：个人知识管理 / 笔记类产品中的「AI 洞察」功能

> 调研对象：drill · 深一层（自托管个人知识系统；洞察纯 pull、允许沉默、AI 产出不覆盖原文、洞察不落库）
> 调研方式：公开资料联网检索，优先官方帮助中心 / 官方博客 / 官方文档 / 工程博客 / 定价页 / 官方 changelog。
> 检索时间：2026 年 10 月。
> **可信度约定**：官方来源标注为「一手」；媒体 / 第三方评测标注为「二手」；Reddit/HN/小红书/知乎等标注为「用户口碑」。
> **重要声明**：任何标为「未找到一手来源」「未证实」的内容均为检索不到可靠公开信息，不是推测结论。文中未出现的功能名，不代表该产品没有。

---

## 目录

- [0. 速查表](#0-速查表)
- [1. flomo](#1-flomo)
- [2. Heptabase](#2-heptabase)
- [3. Tana](#3-tana)
- [4. Mem](#4-mem)
- [5. Reflect](#5-reflect)
- [6. Capacities](#6-capacities)
- [7. Notion AI](#7-notion-ai)
- [8. Obsidian 生态](#8-obsidian-生态)
- [9. Rewind → Limitless](#9-rewind--limitless)
- [10. Granola](#10-granola)
- [11. Saner.ai](#11-sanerai)
- [12. Recall](#12-recall)
- [13. Fabric](#13-fabric)
- [14. MyMind](#14-mymind)
- [15. Google NotebookLM](#15-google-notebooklm)
- [16. Dayflow](#16-dayflow)
- [17. Supermemory](#17-supermemory)
- [18. Khoj](#18-khoj)
- [19. Readwise Reader / Ghostreader](#19-readwise-reader--ghostreader)
- [a. 洞察类型分类学](#a-洞察类型分类学)
- [b. 反模式清单](#b-反模式清单)
- [c. 触发模型对比](#c-触发模型对比)
- [附录：未找到一手来源的产品清单](#附录未找到一手来源的产品清单)

---

## 0. 速查表

| 产品 | 洞察类功能 | 触发 | 是否持久化 | LLM 调用 vs agent 循环 | AI 额度模型 |
|---|---|---|---|---|---|
| flomo | AI 洞察（多视角/自定义视角/引用源笔记）、相关笔记、Agent 技能、AI 记忆档案 | 纯手动 pull；Agent 技能可设定时 | 洞察不落库；Agent 讨论可经用户确认写回 | Agent 多步 + 独立记忆系统 + 定时任务 | PRO 2 次/天；MAX 50 次/天 + 1000 点/天 |
| Heptabase | Insight Generator、AI Chat（全库检索可见检索轨迹）、AI Agent（可编辑卡片）、AI Tutor | 手动点按 + 把消息拖上白板 | AI 回复可存为 card / 拖到白板 → 持久化 | Agent Mode（读图、读 mention、跨子白板） | Pro 100 / Premium 1800 / Premium+ 8100 credits 每月，不结转 |
| Tana | AI command nodes（可提取 action items / insights）、AI chat agents、Related content、meeting post-processing | 手动触发为主；command nodes 可绑定事件 | 输出写回节点/字段 → 持久化 | agent 概念强，工程细节未公开 | 免费 50 queries；Pro $20/mo「20× 免费额度」+ top-up |
| Mem | Mem Agent（主动 follow-up）、Heads Up 上下文面板、Briefings、Heads Up Live | **后台自动 + 主动推送** | 是，写回可编辑的笔记 | 明确是持续后台 agent | Pro $29/mo（100 messages、100 notes、1 routine、1 connection） |
| Reflect | AI assistant（带笔记链接的问答、摘要、改写）、link AI 摘要 | 手动 | 对话链接可留在笔记 | 未公开 | BYOK，费用由用户自己的 provider 结算 |
| Capacities | AI Assistant | 未证实 | 未证实 | 未证实 | 未找到一手来源 |
| Notion AI | Q&A、AI connectors、enterprise search、Database AI autofill、Agent、Custom Agents | 手动 + **定时/触发器自动后台** | 是，产出直接落在 workspace | 明确是 agent（20 分钟自主工作、多步、跨数百页） | Business/Enterprise 需买 credits，按用量扣 |
| Obsidian / Smart Connections | 相关笔记/段落、Smart Graph 语义聚类 | **自动**（打开笔记即显示） | 只读建议，不改笔记；Chat 链接留在笔记 | 无 agent 循环（纯 embedding 检索） | Core 免费；Pro 订阅 |
| Obsidian / Copilot | Quick Chat、Agent Chat（多 agent、tools、skills）、Relevant Notes | 手动 + 自动相关笔记侧栏 | 是，默认自动存为 Markdown 笔记 | 有 agent（Agent Chat + skills） | BYOK 或 Copilot Plus license；可自托管 Miyo |
| Limitless | 录音/屏幕记录 + 问答回顾 | 一直后台录制 | 未证实 | 未证实 | 未找到当前一手定价页 |
| Granola | AI 会议笔记增强、Pre-meeting briefs、Follow-up emails、Chat、Recipes | 会议结束/手动；briefs 由日历触发 | 是，笔记是可编辑实体 | 无公开 agent 循环说明 | Basic $0（30 天历史）；Business $14/用户/月 |
| Saner.ai | 主动每日规划、brain dump → tasks、跨 Gmail/Calendar/Slack 检索 | **主动推送** | 是 | 未找到架构一手说明 | 免费；Starter $8/mo 年付；Standard $16/mo 年付（二手博客） |
| Recall | 摘要 / 知识库 | 未证实 | 未证实 | 未证实 | 未找到一手来源 |
| Fabric | 「self-organizing workspace」、Ask Fabric | 未证实 | 未证实 | 未证实 | 未找到一手来源 |
| MyMind | AI 摘要与自动丰富、Smart Spaces 自动归类、Serendipity 重现 | 自动打标 + 主动重现 | 是 | 无 agent 循环 | 未找到一手定价页 |
| NotebookLM | Briefing doc / Study guide / FAQ / Timeline / Mind map / Audio & Video Overview、Interactive mode、Discover sources | 用户点生成；Interactive mode 是对话式 | 是，生成为 notebook 内 artifact | 未找到架构一手说明 | 免费额度 + Plus / AI Pro 升级（官方页正文未能抓取） |
| Dayflow | 自动时间线、Daily Standup、Weekly Review、Chat with journal、分心追踪、导出 Markdown | **全后台自动** | 是（本地 DB，可导出） | 非 agent 循环，单次分析 | 未找到一手定价页 |
| Supermemory | 推断记忆（isInference）、记忆审阅队列（approve/decline/undo）、图记忆、用户画像 | 后台自动推断 + **人工审批收件箱** | 是，且审批改变检索排序 | 面向 agent 的记忆层 | 免费 $5 credits/月；Pro $19；Max $100；Scale $399 |
| Khoj | 语义搜索、Chat、Agents、Automations（定时邮件）、Research mode、code execution | 手动 + 定时邮件 | 是 | **有 agent 循环**，且公开了三种模式的量化评测 | 开源自托管免费；云版额度未找到一手页 |
| Readwise / Reader | Daily Review（间隔重复重现）、Ghostreader、MCP server | **定时 + 推送**（邮件/App/小组件） | 是（highlight/note） | 非 agent 循环 | $9.99/mo 年付、$12.99/mo 月付，30 天试用 |

---

## 1. flomo

flomo 是与 drill 哲学最接近、也是**最重要的参照对象**（drill 的「洞察不落库」直接参考它）。

### 1.1 洞察类功能

**（1）AI 洞察（PRO）** — 一手：[👁 AI 洞察](https://help.flomoapp.com/ai/insight.html)

官方描述「从多个视角选择一个进行分析：**识别核心主题、揭示思维盲点、提出深刻问题**」。

- 入口：单条笔记左滑 →「AI 洞察」；或在一组「相关笔记」列表底部对**一组笔记**做洞察。
- 内置视角：默认洞察，另有「每日肯定」「行动指南」「意义雷达」「心底之问」「亚里士多德」「塞涅卡」「价值澄清」「逆向思考」，并支持**自定义洞察视角**（用户自己写提示词）。
- **每条洞察都标注来源笔记**，可点击溯源；可用时间与标签筛选洞察的原料范围。
- 官方明确定位：「**AI 不应该替你思考，而应该激发你更深入地思考——不是给你答案，而是帮你发现更好的问题。**」

**（2）相关笔记（PRO）** — 一手：[🪄 相关笔记](https://help.flomoapp.com/ai/xgbj.html)

浏览/搜索/回顾时按语义推荐最相关的历史 MEMO；可隐藏同标签推荐以扩大探索范围；可反复点开「下一轮推荐」。

**（3）flomo Agent（MAX）** — 一手：[🤖 flomo Agent](https://help.flomoapp.com/ai/agent.html)

住在微信里的对话伙伴，读你全部笔记。内置可召唤技能（把技能名发给它即触发）：

- **昨日回声** ——「翻一条过去的笔记，找出它和另一处记录**对不上的地方**，留给你一个真问题」
- **每日新知** —— 从你写过的某个点延伸出一条你没记过的新知识
- **行为洞察** —— 照出你反复出现却没察觉的默认动作
- **幸福灵药** —— 重新框定
- **聊完存进 flomo** —— 先问「要不要存进 flomo」，用户点头才按习惯的标签和语气写回

Agent 有独立的记忆系统，分四步沉淀：**先存底**（对话原样存）→ **再挑拣**（挑值得长期记住的偏好/在意的人/在忙的事）→ **然后归拢**（归成主题）→ **最后成像**（拼成对你的整体认识）。这些记忆可导出为 `user.md` / `memory.md`（一手：[头脑内的那些声音](https://help.flomoapp.com/ai/memory-roles.html)）。

**（4）AI 记忆档案（MAX）** —— 把笔记变成 AI 能读懂的记忆。

**（5）非 AI 的回顾功能**（对 drill「回看」有直接参考价值）：

- 每日回顾（PRO）：内容/时间/数量可配置，支持桌面小组件、锁屏小组件、App 推送 —— 一手：[📆 每日回顾](https://help.flomoapp.com/advance/lucky.html)
- **随机漫步（PRO）**：从一条笔记沿语义关联游走到下一条，结束给一张「明信片」（跨越多少时间、几条笔记、第几条发生弱相关大跨越）。官方 FAQ 明确：搜索和标签是「有目的地找」，随机漫步是「**无目的地遇见**」——一手：[🚶 随机漫步](https://help.flomoapp.com/advance/random-walk.html)
- 认知地图：笔记自动涌现出你反复思考的「山峰」，不打标签也能看到主题全貌

### 1.2 触发方式

**混合，但以 pull 为主，且 push 只用于「回顾」不用于「洞察」**：

- AI 洞察、相关笔记：**纯手动**（左滑/点击）。
- Agent 对话：用户发起。
- Agent 技能：「这些技能**大多也能设成定时自动发给你**」，且「**定时任务的运行时间可以在创建时直接指定**」——一手：[Agent 点数与扩展包](https://help.flomoapp.com/ai/agent-points.html)
- 每日回顾：用户自己开启的**定时推送**（App 推送/小组件）。官方对推送的辩护：「如今通知中心充斥着各类营销信息，但 flomo 的推送不一样——在 flomo 里记下的一切都是你自己的想法，这些推送更像是你写给自己的一封封信。」

### 1.3 输出形态与持久化

- **AI 洞察不落库**：官方页面描述的是「左滑即得回应」，没有提供把洞察保存为对象的入口。配合「PRO 每天 2 次」的额度限制，官方理由是「**真正有价值的思考需要时间消化，而非快餐式消费**」——一手：[AI 洞察](https://help.flomoapp.com/ai/insight.html)
- 相关笔记：只读推荐列表；但官方教程教用户**手动**把推荐笔记的链接粘回笔记里做「索引卡片」——即持久化由用户手动完成，AI 不写。
- Agent 产出：**唯一有写回能力的地方，且必须用户确认**（「它会先问你一句『要不要存进 flomo』，你点头它就……写回」）。
- 洞察强制带**引用标记**（来源笔记）。

### 1.4 LLM 调用 vs agent 循环

flomo Agent 明显**不是单次 LLM 调用**：

- 有独立记忆系统（存底 → 挑拣 → 归拢 → 成像四步）
- 有技能系统（可召唤、可定时）
- 能读全部笔记、能联网找补充知识、能按用户标签体系写回
- 按上游模型实际用量折算点数，说明是**多轮、可变成本**的调用

但**未找到公开的工程博客说明其架构**（没有官方技术文档描述检索/工具/计划的具体实现）。AI 洞察是单次调用还是多步，**未证实**。

### 1.5 定价与 AI 额度

一手：[🎟 会员介绍](https://help.flomoapp.com/membership/pro.html)、[Agent 点数与扩展包](https://help.flomoapp.com/ai/agent-points.html)

| 权益 | PRO | MAX |
|---|---|---|
| AI 洞察笔记 | 2 次/天 | 50 次/天 |
| 语音记录 | 10 分/条 · 500 分/月 | 30 分/条 · 1500 分/月 |
| 存储空间 | 20 G | 500 G |
| flomo Agent | — | ✓ |
| Agent 点数额度 | — | 1000 点/天 |
| AI 记忆档案 | — | ✓ |
| MCP 连接 | — | ✓ |
| 每日回顾 / 相关笔记 / 认知地图 | ✓ | ✓ |

- 价格：PRO 99 元/年、MAX 299 元/年（用户口碑，来自第三方整理，见下节来源）。
- **点数模型细节值得 drill 借鉴**：
  - 点数按上游模型实际用量折算；「一次普通对话通常消耗几点到几十点；翻笔记多、回答长、带图片的对话消耗更多」。
  - **每日 0 点刷新，当天用不完不累计**。
  - **高峰时段（9:00–12:00、14:00–18:00）点数消耗更快**，原因是上游模型自 2026-08-17 起按时段计价、高峰倍数更高；官方建议「深度对话、定时任务，安排在非高峰时段更划算」。
  - MAX 可买**扩展点数包**：先用每日权益额度，再用扩展额度；扩展额度可累加不每日刷新；有效期跟随 MAX 会员，到期清零；到账后不支持无理由退款。

### 1.6 已知负面反馈 / 局限

**用户口碑**（小红书/知乎/微博汇编，二手整理：[一半人吹爆，一半人退订](https://post.smzdm.com/p/a70d6qx9/)，该文标注「内容由AI生成」，需谨慎对待）：

- **捆绑销售最招怨**：一位 2023 年即付费的老用户退订，核心理由是「它不是不愿意开放接口，而是要加钱，而且**必须绑定 AI 功能的加钱**」；PRO 用户觉得「充了钱的，用不到新功能感觉有点背刺」，社区呼吁 AI 功能单独付费。
- **AI 洞察「有点忽悠」**：用了三年、900+ 条笔记的用户实测后评价「感觉分析有点忽悠我」——AI 所谓的「意外发现」，其实是他从小读到大的书。原帖：[我的笔记被 Flomo AI 分析了](https://zhuanlan.zhihu.com/p/2216027744859314)（知乎，用户口碑；注意原文 403，仅能从第三方整理中看到引述）。
- **使用门槛**：有 4000 条笔记的 PRO 用户在评论区求助「我不会用 agent，能不能出个教程」。
- **护城河疑虑**：「UI 啥的太容易被模仿了，设计构不成护城河」。
- **延伸出本条调研最有价值的一条用户洞察**（第三方整理作者的观点，非官方）：

> **flomo 的 AI 是放大器，不是发生器。它放大的是你已有的记录习惯，而不是凭空给你开窍。**
> 吹爆与失望几乎完美对应「你记了多少、记了什么」：天天写感受和上下文的人觉得「知己」；只收藏不回顾、笔记全是没头没尾碎片的人，觉得「忽悠我」。

这与 drill「**允许沉默**」的设计前提高度一致——**证据不足时输出，等于把产品缺陷暴露给用户**。

- 迁移压力：出现了 flomo2md、NotesToNotion、Obsidian 免费插件 Knomo 等迁移工具与路径。

---

## 2. Heptabase

Heptabase 是「洞察 → 白板 → 可组织」这条链路上做得最完整的参照对象。

### 2.1 洞察类功能

**（1）Insight Generator** — 一手：[Heptabase Updates 2024-09-04 / 2024-09-27](https://wiki.heptabase.com/newsletters/2024-09-27)

- 定位：**「从长文章生成 atomic insights」**，「帮你以 10 倍速度掌握长文章的知识结构，快速跳转到有用/有趣的部分，不必从头读到尾」。
- 发布时间：2024-09-04 上线，2024-09-27 升级质量。
- **可拖拽到白板**上建立连接、并排阅读 —— 即洞察可以变成白板对象。
- 上线时为 **early alpha 且有意设月度用量上限**，理由是「AI 模型成本高」，达到上限会弹出反馈表+等候名单。

**（2）AI Chat（带上下文的对话式洞察）** — 一手：[Work with AI](https://wiki.heptabase.com/work-with-ai)

- 每块白板有一个 Chat，可把卡片、section、子白板、PDF、视频、journal 加进上下文。
- **「Chat with your entire Space」默认开启**：提问时 AI 自动全库检索相关内容，**并显示它的思考过程——在搜什么、在读什么**。想精确控制可临时关掉 Space 手动指定。这是「可审计的检索」的优秀范例。
- AI 回答**带引用链接**，指向具体段落块或时间戳，点击可跳转。
- **满意的回答点「New card」即可存为卡片**，或直接把消息拖到白板上 → **洞察持久化为一等公民对象**。
- Journal 场景：右键空白处 → Calendar → 把某日期区间全部 journal 加到白板 → 让 AI 读并回答「我不知道的关于我自己的事」、**识别反复出现的主题**。这正是 drill 想要的「时间线回顾 + 主题聚类」。

**（3）AI Agent / Agent Mode** — 一手：[2026-05-29 newsletter](https://wiki.heptabase.com/newsletters/2026-05-29)、[Roadmap](https://wiki.heptabase.com/roadmap)

- Agent Mode 能：编辑已有卡片、新建卡片、**读卡片里的图片和 mention 链接**、**读父白板下的子白板**以更深地探索知识库。
- 后续路线（已公布）：编辑白板布局、画连接和 section、加标签、管理属性。
- 另有 **AI Tutor**（2026-03-31）与「AI suggested questions for newly created chats」（2026-01-22）——**主动生成提问**。

**（4）Right Sidebar: AI suggestions for related cards**（2025-10-29 上线）——关联发现。

**（5）Whiteboard: AI action for cards**（2025-12-26）——对单卡片执行默认或自定义 AI 动作。

### 2.2 触发方式

**以手动为主**：用户点 Insight Generator、开 Chat 提问、hover 卡片点 AI action。**未找到任何「后台自动生成洞察」或「推送洞察」的功能**。唯一的自动化倾向是「Chat with your entire Space」在提问时自动做全库检索（但检索仍由提问触发）。

### 2.3 输出形态与持久化

**半持久化、用户主导**：

- AI 回复本身存在于 Chat 记录里（每个白板一个 Chat = 按主题归档的对话）。
- 用户可以**编辑 AI 的回复**（右键 Edit），高亮段落、加自己的批注、删掉没用的部分——**AI 产出是草稿，人是编辑**。
- 然后**拖到白板**或点 **New card** 变成卡片，进入长期知识结构。
- 官方对这一流程的表述很值得抄：「**把线性的聊天记录转成更完整的知识结构**」。

注意：这里**不是「AI 产出永不覆盖原文」的严格模式**，而是「AI 产出必须经人手转正为卡片」。原文（card）与 AI 产出（chat message）是不同对象，只有当用户主动转正时才合并到知识结构。

### 2.4 LLM 调用 vs agent 循环

**明确的 agent 路线，且「agent 化」是它们公开宣称的北极星**：

> 「The new Agent Mode and our ongoing improvements to the AI Tutor all point toward one goal: **a Heptabase agent that understands what you're learning, what you might want to learn next, and where you're getting stuck.**」

可考的能力集合（读图、读 mention、读子白板、编辑卡片、编辑白板布局、加标签、管属性）明显是**多步 + 工具调用**，而非单次 LLM 调用。

**工程博客/文档方面的一手证据**：

- 官方发布 **Heptabase CLI**（2026-04-22），让 Claude Code / Codex / Cursor 从命令行直接读写知识库（白板、标签、卡片属性、PDF/图片/音视频转录的解析内容）。
- 官方发布 **Heptabase CLI Skills**（2026-04-29）——「**To help agents use these commands well… agents can run the right commands and avoid common hallucinations and mistakes.**」

> **这是本次调研里含金量最高的工程信号之一**：Heptabase 公开承认 **agent 会幻觉出错误的工具调用**，以至于需要专门发布一层「Skills」来约束 agent 行为。任何做「多步 agent + 工具调用」的产品都会遇到这个问题，drill 在做洞察 agent 时应当预期并提前设计约束层。
- MCP 支持（2025-12-11 起）：读搜卡片、journal、图片、PDF 页、白板、思维导图、tag database；创建编辑笔记与 journal、编辑卡片属性、把已有对象放到白板上。
- 官方插件：ChatGPT Plugin v0.1.0（2026-09-23）、Claude Plugin v0.1.1（2026-10-09）。

### 2.5 定价与 AI 额度

一手：[Plans and pricing](https://support.heptabase.com/en/articles/12990121-pro-premium-and-premium-plans-pricing-faq)

| Plan | 月付 | 年付 | 月度 AI credits | Heptabase 提供的 Agent 模型 |
|---|---|---|---|---|
| Pro (early bird) | $9.99 | $83.88 | 100 | Gemini 系列 |
| Pro | $11.99 | $107.88 | 100 | Gemini 系列 |
| Premium | $23.99 | $215.88 | 1,800 | Gemini / OpenAI / Anthropic |
| Premium+ | $71.99 | $647.88 | 8,100 | Gemini / OpenAI / Anthropic |

- **AI credits 覆盖**：AI Agent、AI Tutor、视频转录、**Insight Generator**、语音笔记。**PDF 解析不消耗 credits**（且不设累计文件/页数上限，单文件 ≤350MB、≤3000 页）。
- **未用完的 credits 不结转**（No carryover）。
- credits 用尽后的三条出路：升级 / 开启 **on-demand usage**（可设月度消费上限）/ **用自己的 API key**（仅 AI Agent，不适用 AI Tutor）/ **Sign in with Codex**。
- **Premium 及以上在 credits 用尽后，Basic 模型仍可免费读、搜、答**；要创建或修改内容才需要 on-demand。**对 Basic 模型，只有 AI Agent 成功修改了内容才计费，只读对话免费**——这是一个很聪明的「读免费、写计费」梯度。
- 免费试用 7 天，试用期含 Premium 同等 credits 与无限 PDF 解析。
- 历史节点：2025-12-05「**Free AI usage for all users**」（官方 changelog 条目）→ 2025-12-05 引入 Premium plan。

### 2.6 已知负面反馈 / 局限

- **未找到针对 Heptabase AI 的成规模负面口碑**。检索未发现 Reddit/HN 对 Heptabase AI 洞察质量的集中吐槽。
- 官方自陈的局限：Insight Generator 上线时自称 **early alpha、「has a lot of room for improvement」**；「New provider models are not automatically available in Heptabase」；credits 不结转。
- 成本控制痕迹明显：早期 Insight Generator 就直接设用量上限 + 等候名单（因模型成本高）。

---

## 3. Tana

### 3.1 洞察类功能

一手：[AI command nodes](https://outliner.tana.inc/learn/features/ai-command-nodes)、[AI Agents](https://outliner.tana.inc/learn/features/ai-agents)、[Custom AI processing for meetings](https://outliner.tana.inc/learn/guides/custom-ai-processing-meetings)、[Related content](https://outliner.tana.inc/learn/features/related-content)

**（1）AI command nodes（核心原语）**

> 「reusable actions that send your notes to an AI model with a prompt you define, **then write the result back into Tana Outliner**. You configure what data gets sent, which model to use, and where the output goes.」

内置命令含：Ask AI、Ask AI (non-streaming)、Make API request、Generate image(s) with AI、Transcribe audio、**Text processing agent**。

**（2）Prompt Workbench**（工程上很值得借鉴）

- 可**预览实际发给 AI 的完整 prompt**（把表达式替换成真实内容）、估算 token 成本、调整模型创造力（temperature）、用真实节点测试后再跑批。
- 官方对动机的表述很坦率：「**写 prompt 的困难在于很难第一次就写对**……需要快速迭代、对比结果，并且必须确切理解运行时到底发了什么给 AI。」

**（3）Meeting 后处理：可配置的「洞察提取」**

这是最直接回答「多种洞察」的产品实现——在 audio-enabled supertag 上配置 post-processing command（默认是 Text processing agent），通过参数化控制提取什么：

- **Extract action items**：配置 `Action items target`（写到哪个字段）、`Tag to use for action items`（用什么 supertag）、可选 `Action items prompt`。提取出的 action items 会成为独立节点并**带 tag 建议**；若配 `Add tags directly` 则直接打标而非建议。
- **Other item extraction**：`Extracted items target` + `Tags to use for item extraction` + `Extracted items user prompt`。官方明确它适合提取「不是直接可执行的东西」，例如「**user observations, learnings, insights**」，且「**There are no restrictions to what you can extract**」。
- **实体抽取**：`New entities target` / `Tags to use for entities` / `Entities prompt`（公司、人、城市、国家等）。
- **Custom summary notes**：把用户会议中自己写的 Notes 字段作为上下文喂给摘要（`Meeting notes field`）。

**（4）AI chat agents**：自定义 system prompt + greeting + 一组可在 chat 中用的命令；agent 以**按钮形式出现在被 tag 的节点上**或出现在 Cmd+K 命令菜单。官方示例：「User research interview agent」——分析访谈转录并**为产品团队提取建议的 action items**。

**（5）Related content**：节点旁/下方的浮动面板，内容可以是**动态查询的 search nodes** 或引用。官方示例：「在 day tag 上做一个 related content 区，显示当天新提的所有 #bugs」——相当于**用户可编程的关联发现**，纯规则/查询而非 AI。

**（6）AI voice chat on mobile 可搜 Tana 与全网** — 一手：[blog](https://outliner.tana.inc/blog/ai-voice-chat-on-android-and-ios-can-now-search-tana-and-the-web)

### 3.2 触发方式

- **手动为主**：command nodes 由用户/命令菜单/节点按钮触发。
- **可自动化**：作为 event-driven command，可绑定在 supertag 配置上（如会议停止转录时自动跑 post-processing）。
- 官方产品页现在主打「**Agentic meetings**」，Pro 版含「**Botless meeting agent** for Zoom, Teams, Google Meet」——会议场景是自动的。
- **未找到 Tana 有「定时生成个人洞察」或「推送洞察」的功能**。

### 3.3 输出形态与持久化

**强持久化，是本次调研里最彻底的**：AI command nodes 的设计目的就是「**write the result back into Tana Outliner**」，输出落到用户指定的字段/节点上，成为知识图谱的一部分（可被 search nodes 查询、被 related content 呈现、被 supertag 管理）。提取出的 action items / insights / entities 都是**独立节点**。

### 3.4 LLM 调用 vs agent 循环

- AI command nodes 单看是**「一次调用 + 写回」**的可组合原语。
- 但 Tana 的产品叙事已经是 agent：官方页面有 **AI Agents**、**Meeting agent**、「**Agentic meetings**」、「Skills」、「Outcomes」等导航项。
- AI chat agents 文档结尾写：「*A lot of work is going on to take AI agents in Tana Outliner to the next step - stay tuned!*」
- **未找到公开的工程博客说明其 agent 架构**（没有检索到描述多步检索/工具调用/规划的官方技术文章）。

**产品形态的重大信号**：Tana 的 Learn 文档体系现在明显围绕 **meeting** 组织（AI meeting notetaker、Meeting agent、Live voice transcription、Mobile Voice Memos），定价页 main headline 是「**You'll spend 30,000 hours in meetings. Make them count.**」，free plan 的描述是「Perfect meeting memory without taking notes」。同时 `/learn/features/*` 的路径已从 `tana.inc` 迁移到 `outliner.tana.inc`，产品名出现 **「Tana Outliner」** 这一称谓。**Tana 是否已从通用 PKM 收缩/转向会议场景，未找到明确的官方公告**，但从官方导航、定价页与文档结构看，**会议是当前的重心**。

### 3.5 定价与 AI 额度

一手：[Tana Pricing](https://tana.inc/pricing)、[Payment, billing and AI credits](https://outliner.tana.inc/learn/features/payment-billing-and-ai-credits)

- **Free $0**：托管的 AI 转录+摘要会议 5 场/月、连接 1 个日历、可查看编辑全部内容、**50 AI queries**。
- **Pro**：early bird **$20**（原价 $30）/ 用户/月，「everything in free, plus: **20× more AI than the free plan**、无限托管会议、botless meeting agent for Zoom/Teams/Google Meet、集成与完整 MCP」。
- **Business**：custom，年付；SAML SSO、高级安全、审计日志、自定义 DPA 与数据驻留/保留策略。
- **AI credits 模型**：每个计划含**月度 AI credits 配额**，用 AI 功能时消耗；**可单独 top-up 任意金额**；账户页可查看已用额度与配额刷新时间。
- 14 天免费试用（需信用卡，试用结束前 7 天提醒）。**⚠️ 注意一个坑**：通过 Apple 订阅时**不支持购买 top-up credits**，必须到 web/desktop 购买。
- 官方 FAQ：「**What happens if I run out of AI credits? You can top up AI credits with custom amounts whenever needed.**」——即无硬性闸门，用钱解决。
- 合规：GDPR、SOC 2®、HIPAA\*；LLM agnostic；可用最新 Claude / Gemini / OpenAI 模型。

### 3.6 已知负面反馈 / 局限

- **未找到成规模的 Tana AI 负面口碑**（检索未命中 Reddit/HN 针对性吐槽）。
- 官方自陈的局限就在文档里：「A lot of work is going on to take AI agents in Tana Outliner to the next step」= 仍在早期。
- 可观察的产品风险：**叙事从「通用 PKM / Supertags / nodes」明显转向会议**，老用户可能面临方向漂移（这是推断，非官方声明，**未证实**）。

---

## 4. Mem

Mem 是本次调研中**与 drill 的 pull 哲学最相冲突**、但工程上最值得参考的对照组——它把「主动」做成了核心卖点。

### 4.1 洞察类功能

一手：[Mem 官网](https://get.mem.ai/)、[Mem Agent](https://get.mem.ai/product/agent)、[Heads Up](https://get.mem.ai/features/heads-up)

**（1）Mem Agent —— 主动 follow-up（核心卖点）**

> 「Mem Agent builds a living picture of your tasks, projects, and goals—then **steps in at the right moments** to keep you moving.」
> 「**Proactive without the noise.** Mem Agent decides when a nudge will actually help—then reaches out with the relevant context and a clear next step. **No schedules or prompt-tuning required.**」

能力：
- **持续在后台 review 新上下文**，连接到已知信息，维护对任务/项目/目标的**结构化理解**。
- **承诺追踪**：从笔记和消息里注意到你许下的承诺，记住哪些还没处理。
- **挑时机**：检查日历，确保提醒在你**还来得及行动**的时候到达；你忙的时候「held back」而不是叠加提醒；换个角度再试；一旦处理完就**停止 nudge**。
- **把笔记一起带来**：提醒时相关笔记一并出现。
- 官方时间线示例（周一 2:30 无回复 → 周一 6:05 你在忙，它等 → 周二 9:15 换角度、带草稿 → 周二 9:16 完成，停止 nudge）。

**（2）Heads Up — 实时上下文面板**

> 「The moment you open or create a note, Mem looks at who you're meeting with, what's being discussed, and what you're working on—then **surfaces relevant notes before you think to look for them**.」

- **Timeline**：把跟某人/团队/系列会议的完整历史串起来。
- **Related Topic bundle**：把过去相关的剪藏、大纲、草稿、语音笔记打包呈现。
- **Find More**：放宽结果、露出更松散相关的笔记。
- **Meeting Briefings（Pro, beta）**：日历集成，**会前自动**生成相关上下文摘要（上次谈了什么、什么还没结）。**可对每份 briefing 点赞/点踩来改进质量**。
- **Heads Up Live（Pro, beta）**：Voice Mode 录音**进行中**实时分析转写、识别正在提到的话题并实时浮现相关笔记。
- 官方对 Heads Up 与 Chat 的区分：「**Heads Up is the tap on the shoulder; chat is the deep dive.**」「**Heads Up is passive and automatic**… Mem Chat is active and conversational」

**（3）其他**：Push-to-Remember（按住快捷键口述，Agent 判断这属于哪里、改变了什么、什么时候该带回来）；Voice Mode；Calendar；Meeting 笔记（**无会议 bot**）；Web Clipper；Chat。

### 4.2 触发方式

**后台自动 + 主动推送，明确拒绝「你自己设时间」。** 官方原话是「**No schedules or prompt-tuning required**」——与 pull 模式完全相反。用户可在 setup 时选择 Mem Agent 在**哪里**找到自己（递送渠道），但**不是选择什么时候跑**。

### 4.3 输出形态与持久化

- **Agent 的对话能改笔记**：「It added that to your Acme renewal note so it stays with the rest of the account context.」「I found 3 to-dos on the whiteboard and **added them to Q3 planning** and flagged the one due Thursday.」
- **持久化且可见可编辑**：官方反复强调「**Memory you can see and shape** — Important context lives in familiar notes—**not a hidden file or opaque chat history**.」「Write and organize in Mem. Your Agent can use those notes and **save useful details from your conversations**. Everything stays visible and editable.」
- 即：**AI 产出落进用户的笔记体系，而不是独立黑洞**。这与 drill 的「AI 产出只能新建 `ai_output` 对象」是两种不同取舍。

### 4.4 LLM 调用 vs agent 循环

**明确是持续运行的 agent，不是单次调用**：

> 「It keeps that understanding current **in the background**.」
> 「Mem Agent **continuously reviews your context, updates its understanding**, and helps keep you on track.」

有记忆维护循环、日历查询、时机决策、多轮重试（held back → new angle → 带草稿）。

**但未找到公开的工程博客/架构文档**说明其检索、工具、计划的具体实现。

### 4.5 定价与 AI 额度

一手：[Mem Agent 页](https://get.mem.ai/product/agent)（注明「compare every plan and limit →」）

**Mem Pro $29 / month**：
- 100 Messages to Mem
- 100 New Notes per month
- Task and Project Tracking for up to 100 notes
- 50 Open Tasks and Projects
- **One Custom Routine**
- **One Connection**
- 25 hours of Voice Mode

即**按消息数、笔记数、routine 数、连接数多维限额**，Pro 版只有一个自定义 routine 和一个连接。「Start free, then move to Pro when you want custom routines, connected sources, and more working memory.」

### 4.6 已知负面反馈 / 局限

- **未找到成规模的官方可引用的负面评测**。App Store 评论区存在（检索命中 [App Store 评分页](https://apps.apple.com/gb/app/mem-your-personal-ai-agent/id1578757028?see-all=reviews)，未逐条打开），**用户口碑内容未采信**。
- 可识别的结构性风险（分析，非引述）：
  - **通知疲劳的产品化风险**：主动 follow-up 是核心卖点，nudge 多了就变成噪音；官方自己也用「Proactive **without the noise**」作为主打语，说明这是它最担心的攻击面。
  - **限额模型复杂**：消息数/笔记数/routine 数/连接数四个维度，用户难以预估成本。
  - **Pro 只给 1 个 Custom Routine + 1 个 Connection**，是相当紧的限制。

---

## 5. Reflect

### 5.1 洞察类功能 & 5.2 触发方式

一手：[Reflect 官网](https://reflect.app/)、[Reflect Blog](https://reflect.app/blog)

> 「**Optional AI** — Notes with an AI assistant. Find answers with links to your notes, summarize text, and improve your writing. Connect your own API key to get started. Requests go directly to your provider. AI usage is billed separately by your provider.」

- 功能：带**笔记链接的问答**（引用式回答）、摘要、改写。
- 触发：**手动**。未发现后台自动洞察或推送。
- Blog 记录的相关更新：
  - 2025-07-08 [Custom prompt editor](https://reflect.app/blog/reflect-update-custom-prompt-editor)：Preferences 里新增 Prompt Templates 标签页，可创建/复制/编辑/删除自定义 AI prompt 模板。
  - 2025-09-23 [AI summaries for saved links](https://reflect.app/blog/ai-summaries-for-links)
  - 2026-03-10 [MCP support for coding agents](https://reflect.app/blog/mcp-support-for-coding-agents)：notes 有 MCP server，可在 Claude 和 Codex 内直接访问和搜索笔记。
  - 2026-04-28 [Edit your notes with coding agents](https://reflect.app/blog/edit-notes-with-coding-agents)：扩展 MCP 让 coding agent **可以编辑笔记**。

### 5.3 输出形态与持久化

- **未找到明确说明 AI 产出是否持久化的官方文档**。
- 已知：MCP 可被外部 agent 编辑笔记 → 产出会落进本地 Markdown 文件（vault 是本地文件夹）。

### 5.4 LLM 调用 vs agent 循环

使用自有 API key、请求直达 provider —— 是**单次/多轮 LLM 调用**形态，**未找到 agent 循环的一手证据**。

### 5.5 定价与 AI 额度

- 官网：「Free on Mac. Paid subscription on iPhone and iPad.」「**AI usage is billed separately by your provider.**」→ **BYOK，不设自己的额度闸门**。这是本次调研中**成本模型最独特的一家**：AI 成本完全外置。
- 具体订阅价格未从官网正文抓取到，**未证实**。

### 5.6 已知负面反馈 / 局限 & 重大产品变动

**重大变动（一手）**：[Reflect Open - a new chapter for Reflect](https://reflect.app/blog/reflect-open)，2026-07-14

> 「Reflect is now **open-source, markdown first, and AI native**.」

站点现状：产品名变为 **Reflect Open**，在 [GitHub: team-reflect/reflect-open](https://github.com/team-reflect/reflect-open) 开源；changelog 迁移到 GitHub Releases；同步方式可选 **iCloud Drive 或 Git**；笔记存在用户自选文件夹里的本地 Markdown。

即：**Reflect 从商业 SaaS 转向开源 + 本地优先 + BYOK 的形态**。这对 drill（自托管）是一个直接可参考的同类，值得后续单独深挖其 MCP/agent 集成细节。

- 负面反馈：**未找到成规模口碑**。

---

## 6. Capacities

- 一手来源仅有官方文档中的一页：[AI Assistant](https://docs.capacities.io/reference/ai-assistant)（该页正文在抓取时被截断，只确认存在此功能条目）。
- **洞察类功能具体清单：未找到一手来源。**
- **触发方式、输出形态与持久化、LLM 调用 vs agent 循环、负面反馈：均未找到一手来源。**
- **定价与 AI 额度：未找到一手来源。** 检索命中的官网定价/App Store 页面未能取回正文。

> **结论：Capacities 的 AI 能力本次未能证实。** 检索可见其 AI Assistant 文档存在，但拿不到内容细节，不做任何推测。

---

## 7. Notion AI

Notion 的体量决定了它的做法会成为「企业级答案」，但它的取舍与 drill 几乎处处相反。

### 7.1 洞察类功能

一手：[Notion 3.0 发布博客](https://www.notion.com/blog/introducing-notion-3-0)、[What are Custom Agents?](https://www.notion.com/help/custom-agents)、[Enterprise Search](https://www.notion.com/product/enterprise-search)、[What are Notion credits?](https://www.notion.com/help/what-are-notion-credits)

- **Q&A / Enterprise Search**：跨 Notion 与已连接工具（Slack、Google Drive、GitHub、Jira 等 AI connectors）的统一检索问答。
- **Database AI autofill**：数据库 AI 属性自动填充。
- **Notion Agent（个人 agent）**：官方定位「**Anything you can do in Notion, your Agent can do too**」。
- **Custom Agents（团队）**：官方原文列出的能力——
  - Read from Notion pages and databases and certain connected apps.
  - **Run on recurring triggers and workspace events.**
  - Take actions such as **posting reports, filing bugs, updating records, or sending messages**.
  - **Hand off part of a job to other Custom Agents** you give them access to.
  - 「Unlike Notion Agent, Custom Agents are designed to **run automatically in the background based on triggers and schedules**.」
  - 官方用例：「一个 Agent 每天汇总用户反馈，另一个每周发项目更新，还有一个自动分流 IT 请求」「**even while you're asleep**」。
- 官方还直接承认了一类**洞察型**用例：「Keep your knowledge base up-to-date—**when important details change, ask your Agent to spot gaps and update everything for you**」（即**发现知识库缺口**）。

### 7.2 触发方式

**三种都有，且以「自动」为产品方向**：
- 手动：Ask AI / 派活给 Agent。
- **定时/触发器自动后台**：Custom Agents。
- 官方原文：「running on **schedules or triggers you set** so work keeps moving forward」。
- 未找到 Notion 做「个人洞察主动推送通知」的功能（更多是产出物落在 workspace 里 + 完成时通知）。

### 7.3 输出形态与持久化

**深度持久化，且直接修改用户的一等公民对象**：创建完成的页面/数据库/报告（「creating finished pages, databases, and reports directly in your workspace」，可「across hundreds of pages at once」）。同时也有**对话 + memory bank 页**作为个性化载体：把你给 Agent 的指令写在一个普通 Notion page 里当记忆库，可随时编辑下载模板。

### 7.4 LLM 调用 vs agent 循环

**明确的 agent，且有具体的时长/规模指标**：

> 「Now, your Agent can do **up to 20 minutes of autonomous work at a time across hundreds of pages** at once.」
> 「It can complete **multiple actions at a time**…」

以及多 agent 协作：「Hand off part of a job to other Custom Agents」。

**但未找到描述其 agent 架构（规划、工具、记忆实现）的官方工程博客**——Notion 发布了产品博客，未见系统性工程博客。

**一个重要的第三方工程观察**（值得一提但也需谨慎）：一位技术用户的实测对比称，同样任务下「**用 Notion MCP server + Claude Code / OpenAI Codex 反而比 Notion 自带的 Agent 更成功**」，尽管 Notion 用的也是这两家的模型。这说明**「自有 agent 编排」未必优于「开放 MCP 让用户自己的 agent 来做」**。

### 7.5 定价与 AI 额度

一手：[What are Notion credits?](https://www.notion.com/help/what-are-notion-credits)、[Notion credits 分类页](https://www.notion.com/help/category/notion-credits)

- Notion credits 是 **Business 和 Enterprise 计划的加购项**，**workspace 内共享**。
- 用于运行 **Custom Agents、Workers（beta）、premium AI models，以及超出 usage allowance 的额外 Notion AI 用量**。
- credits 分 **monthly** 与 **annual** 两类，类型与核心订阅绑定（月付计划只能买月 credits，年付只能买年 credits）。若通过销售团队购买，还可买 on-demand credits，**消耗顺序为 monthly → annual → on-demand**。
- 有独立的 credits dashboard 追踪用量，支持 Auto Adjust。
- **未找到具体的 per-credit 单价与各计划 allowance 数值**（相关帮助页正文未能完整取回），**未证实**。
- Notion credits 相关帮助页出现「introducing Notion credits (**starting May 4, 2026**)」字样，说明 credits 机制在 2026 年 5 月才正式引入——**AI 计费模型是晚期才收紧的**。

### 7.6 已知负面反馈 / 局限

**用户口碑 + 二手评测**（[Notion 3.0 / Notion AI Follow Up](https://barnes.tech/blog/notion-30-notion-ai-follow-up)，作者 Robby Barnes，2025-10-14，技术博客）：

> 「Since then I've been using it a fair amount more, and it has been a **pretty mixed bag**… Sometimes it seems to do exactly what they demoed… It has legitimately **saved me several hours of busy work already.**
> **But sometimes it completely shits the bed.** It's very weird. I know AI hallucination pretty well, but as long as you know how to craft prompts, give examples, and are really explicit with what you're looking for, Claude and OpenAI are pretty good at sticking to the parameters you give it. **Notion seems to occasionally just completely lose it's mind.** I've now twice had it **completely ignore instructions** I've given it, specifically about content on a page I want left as-is, or formatting I want to remain the same, and **completely messes up a page. I've now twice had it delete embedded files that I specifically told it in the prompt to leave exactly as-is.**
> …using a **Notion MCP server and just having Claude Code or OpenAI Codex interact with Notion has been much more successful** so far, which is strange to me since Notion is using both models under 'Notion AI'.
> **It feels like this needs to bake in the oven for a while longer** before they push it too far.」

**这是「AI 产出直接改写用户一等公民对象」的最严重失败模式实录**：AI 删除了用户明确要求保留的嵌入文件。对 drill「**AI 产出永不覆盖原文**」这条铁律，这是一个强力的反面实证。

其他二手批评：检索命中 [Notion AI is a Feature, Not a Product – And That's Its Fatal Flaw](https://dev.to/ii-x/notion-ai-is-a-feature-not-a-product-and-thats-its-fatal-flaw-4g6i)（dev.to 评论文章，**未逐条采信**）。

---

## 8. Obsidian 生态

**重要前置事实**：Obsidian **官方本体没有内置 AI 功能**；以下能力全部来自第三方社区插件。**未找到 Obsidian 官方推出任何 AI 功能的一手来源**（也就是说：Obsidian 至今的官方立场是「不做 AI」，AI 由插件生态承担）。

### 8.1 Smart Connections（Brian Petro）

一手：[Smart Plugins 官网](https://smartconnections.app/)、[Guiding Principles](https://smartconnections.app/smart-principles/)

**洞察类功能**：
- **相关笔记/相关段落**：在你正在写的笔记旁边显示相关笔记和段落，**无需搜索、无需已有链接**。「Research, decisions, and AI drafts accumulate. Useful background can get left out of the next task.」
- **Smart Lookup**：从「一个问题」出发做检索（vs Smart Connections 从「当前笔记」出发）。
- **Smart Context**：让你**选择和审阅**要喂给 AI 的源材料。
- **Smart Chat Core**：把 AI 对话**链接**保存进你的笔记，以便工作继续时回到那次对话。官方特别强调：「**Your note keeps the link, not a copy of the conversation.**」
- **Smart Graph（Pro）**：把索引笔记**按语义相似度分组**，「whether or not you've linked them」——**语义主题聚类**，与手动链接无关。官方演示：1,050 个源文件的 whole-vault semantic cascade。
- **Inline connections（Pro）**：段落级别的建议。
- **高级排序控制（Pro）**：调整结果排序方式。
- 官方列举它要解决的问题：想回头看的想法被漏掉、决策没有背景、**AI 草稿没有上下文**。

**触发方式**：**自动**。打开笔记就在侧栏显示相关笔记/段落（无查询、无需链接）。这是与 drill「纯 pull」最不同的一种：它把关联发现变成了**零操作的环境信息**。

**输出形态与持久化**：**默认不改你的笔记**（「Smart Connections Core matches notes locally by default. **Suggestions do not edit your notes.**」）。唯一的「持久化」是 Smart Chat 把**对话链接**存进笔记。**AI 对话本体不落进 vault**——这与 drill 的「洞察不落库」在效果上一致，但实现动机不同（它是「链接而非副本」）。

**LLM 调用 vs agent 循环**：**不是 agent 循环**。核心是本地 embedding 检索（`transformers.js` via HuggingFace 适配器），Chat 是单轮/多轮对话。**未找到 agent 循环的一手证据**。

**隐私与本地优先（工程细节丰富，对 drill 很有参考价值）**：
- **所有数据以简单 JSON 存在你 vault 的 `.smart-env` 文件夹**；`.ajson` 文件含元数据与 embeddings。
- **默认使用本地 embedding 模型**。官方对原因的表述值得直接引用：
  > 「**Building an "index" means processing _all_ your data with an embedding model. If the model is not local, then every byte flows to the cloud.**」
- **本地 chat 模型**：检测到 Ollama / LM Studio 会自动出现在下拉里。官方同时给了诚实的权衡：「chat models benefit more from **quality of context** than raw volume… 本地模型 setup 成本高，且即便硬件好，可能只能跑比云端前沿模型更弱的模型」。
- 开源、source-available、**零依赖（dependency-free）**设计。官方对依赖的态度：「Pre-AI, libraries were a godsend. Post-AI, libraries can be **a liability**. … Every dependency drags in more dependencies… **Vibes are not a strategy.**」
- 可扩展：`obsidian-smart-env` 让你用几行代码接入同一套 AI runtime 自建插件。

**定价**：Core 免费；**Pro 订阅**（Smart Graph、Inline connections、高级排序）。**具体价格未从官网取回，未证实。**

**已知负面反馈/局限（GitHub Issues，一手）**：
- [Issue #927: No embeddings/links created for new notes](https://github.com/brianpetro/obsidian-smart-connections/issues/927) —— 新笔记不生成 embedding/链接（索引失效类问题）。
- [Issue #913: Inconsistent behavior when changing models](https://github.com/brianpetro/obsidian-smart-connections/issues/913) —— 切换模型时行为不一致。
- 官方自陈的局限：本地 chat 模型「setup 成本高」、效果弱于前沿模型。
- **量级提示**：这些 issue 编号已到 900+，说明**embedding 索引的稳定性是这类功能长期的真实痛点**。

### 8.2 Copilot for Obsidian（logancyang）

一手：[docs.obsidiancopilot.com](https://docs.obsidiancopilot.com/chat-interface/)、[Agent Chat](https://docs.obsidiancopilot.com/agent-mode-and-tools/)、[Copilot paid plans](https://docs.obsidiancopilot.com/copilot-plus-and-self-host/)

**洞察类功能 / 两个聊天模式**：
- **Quick Chat**：轻量对话视图，用于短问题、改写、讨论。两种模式：
  - **Chat (free)**：「answers from the context you attach. **It does not search your vault automatically.**」
  - **Copilot Plus**：**can use tools, including local search**；Miyo 启用时是**语义搜索**，否则关键词搜索。需要有效 license。
- **Agent Chat（桌面端）**：用于「multi-step work, reusable Skills, **permissioned file changes**, or project context」——明确的 agent，且**文件修改是需要权限的**。
- **Multi-agent answers**、**Skills across agents**、**Projects**、**AGENTS.md**（Agent Chat 读 `AGENTS.md` 而不是 System Prompt）。
- **Relevant Notes（Live Relevant Notes）**：自动相关笔记侧栏。
- **Vault QA 已不再是独立模式**（V4 起合并进 Quick Chat 的 Copilot Plus）。官方给升级用户的话：「If it was your saved mode before upgrading, Quick Chat starts in **Chat (free)**.」——**注意这是对老用户行为的一次静默降级**。

**触发方式**：手动为主（命令面板/ribbon）；Relevant Notes 是自动侧栏。

**输出形态与持久化（对 drill 很重要）**：
- **Autosave Chat as Markdown 默认开启**：每条用户消息和回复后保存到 `<Copilot folder>/copilot-conversations/`。
- 可用 Chat History 搜索已保存对话、重命名、打开 Markdown 源文件、删除。
- **Copy Chat Link** 生成 `obsidian://` 链接，粘到别的笔记里可重开该对话——**AI 对话成为 vault 内一等公民、可检索、可被引用**。
- 上传的图片存在 `copilot-conversations/attachments/`，不污染 vault 的附件文件夹；同一对话内相同图片复用同一附件。
- AI 回复的 action 含 **Insert / Replace at cursor**（可写入正文）、Copy、Regenerate、Delete。

**LLM 调用 vs agent 循环**：**有 agent**（Agent Chat + Skills + tools + permissioned file changes）。**未找到公开的工程博客**说明其规划/检索实现。

**定价与额度**：
- **BYOK**（Providers and BYOK 文档章节）+ **Copilot Plus license**（"Copilot paid plans"）。
- **可自托管 Miyo**（本地语义搜索服务），且支持**一台 Miyo server 多设备共用**（"Use one Miyo server from several devices"）。
- **具体价格未取回，未证实。**

**已知负面反馈/局限**：
- Vault QA 模式被移除（老用户行为变化）。
- 检索命中 [RAG in a chat question · Discussion #2009](https://github.com/logancyang/obsidian-copilot/discussions/2009)（内容未取回，**不采信**）。
- 官方文档明确提示 Agent Chat **需要桌面端**，移动端不可用（"On mobile, where Agent Chat is unavailable, Quick Chat is the main conversation view"）。

### 8.3 其他 / 官方立场

- 检索命中 Text Generator 等，但**本次未取回一手来源，不展开**。
- **Obsidian 官方立场：未找到任何官方 AI 功能公告。** 结论：Obsidian 走的是「内核极简 + 社区插件承担 AI」的路线。

---

## 9. Rewind → Limitless

### 9.1 洞察类功能

- **未找到可引用的当前官方功能页**（Limitless 官网正文与帮助中心文章在当前时点未能取回完整内容，见下）。
- 已确认的一手材料是帮助中心关于**wearable pendant 与隐私**的两篇文章：
  - [Talking to Someone Wearing the Pendant: What to Expect and How we Handle Your Information](https://help.limitless.ai/en/articles/13004190-talking-to-someone-wearing-the-pendant-what-to-expect-and-how-we-handle-your-information)
  - [How to Ask for Consent and Let Others Know You Are Recording](https://help.limitless.ai/en/articles/10540861-how-to-ask-for-consent-and-let-others-know-you-are-recording)
  
  这两篇的存在本身就是产品事实的一个强证据：**因为设备是持续在身的录音设备，「如何向周围人取得同意/告知」必须写进官方帮助中心的正式流程**。
- Rewind 时期的核心能力（屏幕/音频录制 + Ask Rewind 检索问答）在检索中可见，但**当前时点未取回一手页面，不做细节展开**。

### 9.2 触发方式

**始终后台录制（always-on）**。这可以从「Talking to Someone Wearing the Pendant」这类帮助文档的存在推出。**具体触发粒度（是否持续、是否有开关）未取回一手说明。**

### 9.3–9.5 输出形态、agent、定价

**均未找到当前有效的一手来源。** 尤其定价：**未取回当前定价页，未证实。**

### 9.6 重大变动与负面反馈（关键）

**重大变动（一手媒体）**：TechCrunch，2025-12-05 —— [Meta acquires AI device startup Limitless](https://techcrunch.com/2025/12/05/meta-acquires-ai-device-startup-limitless/)

检索摘要明确指出：Limitless（前身 Rewind）被 Meta 收购，公司在其网站宣布；另有日文报道称 [「Meta 收购 Limitless，AI 录音 pendent 的新规销售将终止」](https://www.moguravr.com/meta-acquires-limitless-ai-wearable-strategy/)。

> **对 drill 的启示**：一个把「持续捕获」做到极致的产品，最终因为**捕获的社交与法律成本**以及**商业模式**被大厂吸收、产品线收缩。**持续录制型产品的终局风险极高。**

**负面反馈 / 隐私争议**：
- 官方帮助中心本身就在处理「如何向他人告知/取得同意」——说明隐私与同意是这类产品的**一等公民问题**，而非边缘问题。
- 未取回成规模的用户口碑原文，**不做量化断言**。

---

## 10. Granola

### 10.1 洞察类功能

一手：[Granola Pricing](https://www.granola.ai/pricing)、Granola Docs & Help Center（[docs.granola.ai](https://docs.granola.ai/)）

从定价页对比表与文档目录可确认的功能：
- **AI meeting notes**（notepad 形态，用户在会中自己打字，AI 用转录补全——「AI-enhanced notes」）。
- **Pre-meeting briefs**（Business 起）——**会前自动简报**。
- **Follow-up emails**（Business 起）——行动提取的变体。
- **Granola Chat**：文档有「Chatting with your meetings」「Workflows in Granola Chat」「Understanding model selection」「**Recipes**」「Writing effective recipes」——即**可复用的自定义 AI 工作流**。
- **Recipes**：自定义 prompt/工作流模板（对 Basic 也开放，见定价表）。
- **Bot-free, device-audio capture**：不使用会议 bot，从设备音频捕获。
- **Speaker tagging**、**Multi-language**、**Customized note templates**、**Workspace-wide dictionary**（Business）、**People and Companies**（把人与公司作为一等实体）。
- **Granola for Apple Watch**、移动端。

### 10.2 触发方式

- 会议场景下由**会议进行/结束**驱动（AI-enhanced notes 依赖转录；post-meeting 摘要自动生成）。
- **Pre-meeting briefs 由日历触发**（会前自动）。
- Chat / Recipes 手动。
- **未找到 Granola 有「个人知识洞察的定时推送」**。

### 10.3 输出形态与持久化

- **是**。会议笔记是可编辑的长久实体（Basic 存全部但只可见 30 天，见下）；文档有 Workspaces / Spaces & Folders / Sharing / User Groups / 导出（CSV 含标题、摘要、转录）。
- **官方自陈：不保留音频**（转写后删除），**不支持导入录音**（一手：[How transcription works](https://docs.granola.ai/help-center/taking-notes/transcription)）。

### 10.4 LLM 调用 vs agent 循环

**未找到公开的 agent 循环说明**；官方材料更强调「转录 → 摘要/增强」的管道。**未证实有 agent 循环。**

### 10.5 定价与 AI 额度

一手：[Granola Pricing](https://www.granola.ai/pricing)

| | Basic (Free) | Business $14 / 用户/月 | Enterprise $35 / 用户/月 |
|---|---|---|---|
| AI meeting notes | ✓ | ✓ | ✓ |
| Bot-free, device-audio capture | ✓ | ✓ | ✓ |
| Recipes | ✓ | ✓ | ✓ |
| **Meeting history** | **30 days** | **Unlimited** | Unlimited |
| AI chat across meetings | Auto only | **Auto + model selection** | Auto + model selection |
| Pre-meeting briefs | ✗ | ✓ | ✓ |
| Follow-up emails | ✗ | ✓ | ✓ |
| Workspace-wide dictionary | ✗ | ✓ | ✓ |
| 集成 | Slack only | + Notion/HubSpot/Attio/Affinity/Zapier/**MCP**/**API** | + Salesforce 等 |
| 模型训练 opt-out | 用户级 | 用户级 | **全组织级** |
| 安全 | — | — | SSO、org-wide auto-deletion、管理控制 |

- **AI 额度模型：不按次计费**，而是用「功能 + 历史窗口 + 模型选择」分层。Basic 不限制会议数量，**限制的是可查看的历史时长**。
- 官方 FAQ 式确认：**未用完的历史不会被删除**，付费后重新可见，且可导出。

### 10.6 已知负面反馈 / 局限

**注意来源性质**：以下主要来自 [What People Get Frustrated About With Granola](https://anarlog.so/blog/granola-ai-complaints/)（2026-10-11，作者 **John Jeong**）。**该文作者自陈「I co-founded Anarlog, an open-source Granola alternative」——存在直接竞品利益冲突，属敌对来源**。但该文的可采信之处在于：**它的每一条产品限制都链接到 Granola 自己的官方文档**，产品事实部分可用官方文档交叉验证。以下标注哪些是官方事实、哪些是用户口碑。

**（1）静默录制失败（最尖锐的一类，用户口碑）**
- 有用户「started a note, watched the window sit there, and found out after the call that nothing had been captured」；一位 founder 说「app was open all day and produced notes for about **60% of calls**」；另一位描述「two important conversations that appeared to be recording and were not, **with no error and no alert**」。
- **架构放大了这个故障的代价**（此部分经官方文档验证）：Granola **不以参与者身份入会**，所以**别人看不到捕获已经死了**；**不保留音频**，所以**没有东西可以重放或重新转写**；**不支持导入录音**。→ 会话没启动，这场会就永远没了。
- 原文的概括很到位：「**That is the tradeoff people accepted for a bot-free notepad. It's also why "it just sat there" shows up more often than "the summary was generic." A generic summary can be edited. A blank session cannot.**」

**（2）免费版 30 天历史墙（官方事实）**
- Basic 只能看最近 30 天的笔记；**笔记不会被删除**，付费 $14 后重新可见；可导出（Settings → Profile → Generate CSV，含标题/摘要/转录，但**不含已删除或无摘要的笔记**；邮件下载链接 24 小时过期）。

**（3）说话人归因（用户口碑 + 架构）**
- 桌面端可用「麦克风 vs 系统音频」区分 Me/Them，但**具名说话人未解决**：三人会议中两人会塌成 Them，**action item 丢失责任人**。

**（4）无录音 → 无法核验（官方设计 × 用户口碑）**
- 「Users report names getting mangled and notes that are risky to send as-is. That happens in every transcription product. **The difference here is that you cannot settle the argument by listening.**」
- 原文结论：若需要法律审查、coaching 或有争议的引语记录，这是 disqualifier。

**（5）法律与同意风险（有公开司法材料）**
- 原文引用 **[Chamberlain v. Granola](https://storage.courtlistener.com/recap/gov.uscourts.cand.475308/gov.uscourts.cand.475308.1.0.pdf)**（加州北区法院），指控该产品**在未告知其他参会者的情况下拦截会议通信**。
- Granola 提供聊天通知与视频水印，但**默认关闭**；Enterprise 在试点 org-wide「Heads Up」通知。原文引 Barnes & Thornburg 的警报摘要指出：**法律风险落在部署该工具的公司身上，而「可选的透明功能」本身不构成同意**。
- 用户口碑：欧洲用户认为隐藏转写是 GDPR 问题；其他人只是觉得「会议里没别人知道这件事」很怪。
- 模型训练：Free 与 Business 上，**匿名化数据可能被用于改进 Granola 的模型，除非用户主动关掉**；第三方 provider 有企业协议禁止训练；**组织级 opt-out 是 Enterprise 专属控制**。
- 官方明确：**不是 HIPAA compliant，不能签 BAA，不应处理 PHI**；数据驻留为 US AWS。

**（6）多语言限制（官方文档事实）**
- 桌面 31 种、移动 17 种语言；**App 界面仅英文**；混合语言桌面通话可支持，**移动端一场会只能选一种语言**；**已有会议无法事后更改转写语言**。

**一条超出产品本身的经验**：Granola 主打「**无 bot**」，但「无 bot」≠「无云」≠「无训练」≠「无需处理同意」。**隐私叙事不能替代架构承诺。**

---

## 11. Saner.ai

### 11.1 洞察类功能

一手（但为**厂商自营内容营销博客**，需降权看待）：[The Best AI Life Assistant](https://blog.saner.ai/best-ai-life-assistant/)，2026-09-10

官方博客自述的能力（作者为 Saner.AI 团队成员，文中自陈「I work on the team that builds Saner.AI」）：
- **Proactive planning**：不打开就问「今天什么样」——「**it already knows, because it's been reading my calendar and inbox in the background instead of waiting for me to ask**」。具体表现：主动flagged 一封上周四发出未获回复的客户邮件；把相关会议笔记拉进当天 10 点的通话；顶部给出今天真正需要你的短清单。
- **Brain dump → tasks**：对 AI「Skai」口述一堆未整理想法，它自动拆成条目、标记时间敏感的、归档到会在接近日期时再次看到的位置。
- **AI Calendar**：对话式重排日程（「reschedules, reprioritizes, and remakes your whole day in 30s」）。
- **Emails to tasks**：连接 Gmail，从邮件里提取**两个** action item 而非用户自己会注意到的一个。
- **自动组织笔记与任务** + 语义检索（「that call where we talked about pricing changes」）。
- 连接器：Gmail、Outlook、Google Calendar、Slack、Google Drive。
- **ADHD 友好定位**。

### 11.2 触发方式

**主动推送（proactive）是核心卖点**：「it had already flagged…」「it's been reading my calendar and inbox **in the background**」。「Tell you what needs attention today **on its own**.」

### 11.3 输出形态与持久化

- 任务、清单、笔记都是持久实体（「kept the note somewhere I'd actually see it again closer to the date」）。
- **具体的数据模型未找到一手技术文档，未证实。**

### 11.4 LLM 调用 vs agent 循环

**未找到官方的架构说明。** 从描述看是多源读取 + 后台判断（email/calendar/slack/drive + 主动行动），**行为上像 agent，但没有公开的工程文档可引**。

### 11.5 定价与 AI 额度

（来源为上述厂商博客，**二手/自述**）
- 免费计划；
- **Starter $8/月（年付），月付 $12**；
- **Standard $16/月（年付），月付 $20**。
- **AI 额度/次数模型未找到一手来源**。

### 11.6 已知负面反馈 / 局限

- **未找到独立的负面反馈。** 该博客自称「It's free to start」，并提供了用户 testimonial（Jerry / Duy Trieu / Maria 及一条 Product Hunt 评论引用），**均属厂商选用素材，不采信为客观口碑**。
- 隐私声明（自述，需官方隐私政策验证）：「does not train on, sell, or share user data，stores information encrypted in transit and at rest，提供 full data export」。**未独立验证。**

---

## 12. Recall

**（getrecall.ai / recall.it）**

- **洞察类功能：未找到一手来源。**
- **触发方式：未找到一手来源。**
- **输出形态与持久化：未找到一手来源。**
- **LLM 调用 vs agent 循环：未找到一手来源。**
- **定价与 AI 额度：未找到一手来源。**
- 检索命中的全部是第三方目录站/插件商店页面（[Mozilla 插件评价页](https://addons.mozilla.org/en-CA/firefox/addon/getrecall/reviews/)、[mavtools](https://mavtools.com/tools/getrecall-ai/)、[thedailyworkflow](https://thedailyworkflow.com/service/Recall)、[rankmyai](https://www.rankmyai.com/tools/db93f4d4-98e4-441f-94c8-7bad0bb19bf9/recall-wiki)），**均非一手来源**。官网 [getrecall.ai](https://getrecall.ai/) 与 [recall.it](https://www.recall.it/) 抓取后仅返回标题，无正文。
- **负面反馈**：Mozilla 插件商店评分页存在（评论可见），但**未逐条取回，不采信**。

> **结论：Recall 本次调研未能证实。** 另有同名产品（如 macOS 的 Recall、Discord 的 Recall 等）易混淆，检索结果可靠性进一步下降。**本次不给出任何关于 Recall 的功能性结论。**

---

## 13. Fabric

**（fabric.so）**

- 官网标语于不同时间出现两种定位：「The multiplayer workspace for human-agent collaboration」与「**the AI workspace that thinks with you**」；另有 [「A second brain with a body」](https://fabric.so/blog/a-second-brain-with-a-body) 与 [Fabric | your self-organizing workspace and file explorer](https://fabric.so/) 的表述。
- 有独立的 [Fabric Tag](https://fabric.so/features/fabric-tag) 功能页（把 workspace 带进 Slack 和 Discord）。
- 有对比页：[Fabric vs. Notion](https://fabric.so/comparison/fabric-vs-notion)、[Fabric vs. Claude](https://fabric.so/comparison/fabric-vs-claude)。
- **洞察类功能具体清单：未找到一手来源。**
- **触发方式、输出形态与持久化、LLM 调用 vs agent 循环、定价与 AI 额度：均未找到一手来源。** 官网与博客页抓取后正文被截断，未能取得有效内容。
- **负面反馈：未找到。**

> **结论：Fabric 本次调研未能证实。** 仅能确认其自我定位含「self-organizing」「AI workspace」「human-agent collaboration」等词，但**无法确认具体功能、触发方式或定价**。

---

## 14. MyMind

### 14.1 洞察类功能

一手：[mymind.com](https://mymind.com/)

- **AI summaries**：「Your new mind **summarizes and enriches** content you save with more context, making it easier to find later.」
- **Smart bookmarking**：「No URL is treated the same way. Your new mind **knows if an item is an article, a product, a book or even a recipe.**」——自动分类型。
- **Instant collections / Smart Spaces**：「Create Smart Spaces that **auto-sort what you save, on your terms**. Your mind automatically knows where it goes.」
- **Serendipity（Rediscover with Serendipity）**：「A purposefully slow and peaceful experience, **Serendipity resurfaces forgotten things** in your mind so you can keep or forget them.」——**主动重现**，与 flomo 的每日回顾同属「回顾」类，但语气刻意做慢。
- **Top of Mind**：置顶当前优先级，每次打开都看到。
- **Bidirectional linking**：手动加笔记间链接。
- 官方 manifesto 明确承诺**不做**：social features、vanity metrics、invasive tracking、social pressure、collaboration、ads。

**注意**：**未找到「AI 每日回顾/邮件推送」的一手证据**。检索中常见关于 mymind 有 daily review 的说法，**本次未能从官方来源证实**，标注为**未证实**。已证实的重现机制是 **Serendipity**。

### 14.2 触发方式

- **自动**（保存即自动打标、归类、摘要）。
- **主动重现**（Serendipity / Top of Mind），但是**应用内体验**，非推送。
- **未找到推送通知的证据。**

### 14.3 输出形态与持久化

- 是：保存的对象本身就是持久实体，AI 摘要/标签/分类附着其上，可搜索（「Search by color, keyword, brand, date – whatever you think of first. Associative search & visual cues」）。

### 14.4 LLM 调用 vs agent 循环

**无 agent 循环的迹象**：保存时做一次分类/摘要/丰富。**官方未公开架构。**

### 14.5 定价与 AI 额度

**未找到一手定价页内容**，**未证实**。（检索命中的均为第三方评测。）

### 14.6 已知负面反馈 / 局限

- **未找到一手来源的负面反馈。** 检索命中的多为第三方评测（如 [marqly 日文评测](https://www.marqly.com/ja/blog/mymind-review-2026)，评分 3.8/5）、以及 [MakeUseOf 的体验文](https://www.makeuseof.com/replaced-google-keep-with-mymind-organizing-is-effortless/)。**均为二手，未采信。**
- 官方自陈的取舍：「Organize nothing」、无协作、无社交——对某些用户是局限。

---

## 15. Google NotebookLM

**抓取限制说明**：`notebooklm.google` 与 `support.google.com/notebooklm/*` 均返回 JS 渲染页面，正文未能取回；`support.google.com/notebooklm/answer/16213268` 现在重定向到 **「Gemini Notebook Help」**（产品已更名/并入 Gemini 品牌，**此为一个值得注意的产品变动信号，但具体范围未证实**）。因此以下部分内容依赖官方 Google 博客（Workspace Updates）与主流媒体报道，并明确标注。

### 15.1 洞察类功能

- **来源限定（source-grounded）**：只基于用户上传/指定的 sources 回答。
- **Studio 生成的 artifact**（一手报道：[9to5Google, 2025-08-06, NotebookLM rolls out Video Overviews, Studio redesign](https://9to5google.com/2025/08/06/notebooklm-studio-redesign/)）：**Briefing doc、Study guide、FAQ、Timeline、Mind map、Audio Overview、Video Overview**。这一组是「**一份材料 → 多种结构化洞察产物**」的最完整产品化实现，值得 drill 直接对照。
- **Interactive mode**：对话式交互（一手来源未取回，**依据媒体报道与检索摘要，标为部分证实**）。
- **Discover sources**：主动发现并推荐可加入 notebook 的来源（一手报道：[fonearena](https://www.fonearena.com/blog/450250/google-notebooklm-discover-sources-multimodal-pdf-support.html)）。
- 官方更新节点（一手）：[Google Workspace Updates, 2025-03: New features available in NotebookLM and NotebookLM Plus](https://workspaceupdates.googleblog.com/2025/03/new-features-available-in-notebooklm.html)（正文未能取回，仅确认存在该官方公告）。

### 15.2 触发方式

**手动为主**：用户点生成某个 artifact、提出问题、开启 Interactive mode。**未找到 NotebookLM 有后台自动生成洞察或推送洞察的证据。**

### 15.3 输出形态与持久化

- **是，生成为 notebook 内的 artifact**（可回到 notebook 查看、可分享）。**此点依据广泛报道与产品常识，但本次未取回官方 support 页原文，标为部分证实。**

### 15.4 LLM 调用 vs agent 循环

**未找到官方的架构说明。** NotebookLM 的公开叙事是 RAG + source grounding，**未找到「多步 agent 循环」的一手说明**。

### 15.5 定价与 AI 额度

- 存在免费额度与 **NotebookLM Plus / Google AI Pro** 升级路径（[support.google.com 升级页](https://support.google.com/notebooklm/answer/16213268)，**正文未能取回**）。
- **具体额度数值与价格：未证实。**

### 15.6 已知负面反馈 / 局限（**本次调研最硬的一手材料之一**）

**学术复现研究（一手 preprint）**：[Source-Grounding Does Not Prevent Hallucinations: A Controlled Replication Study of Google NotebookLM](https://zenodo.org/records/18039274)，作者 Jennifer Evans (PatternPulseAI)，Zenodo，2025-12-24。

核心结论（直接引用其摘要）：

> 「We posit that **hallucinations are not failures of knowledge access but failures of semantic authority**; retrieval systems constrain information sources but **do not arbitrate meaning**, and therefore cannot prevent hallucinations arising from unresolved semantic competition.」
> 「Google markets NotebookLM as reducing hallucinations through source-grounding… **We tested this claim**… NotebookLM exhibited **identical hallucination patterns under strict dominance (inventing muddy financial institutions, canoe docking facilities, and vegetation growth on bank buildings)** and identical recovery under revocable dominance. Additionally, **NotebookLM explicitly acknowledged using "general knowledge" rather than source-constrained definitions** during disambiguation tasks, **demonstrating it is not a closed corpus system.**」
> 「**Source-grounding constrains retrieval but does not introduce semantic governance primitives.** Hallucinations caused by inability to prioritize and revoke competing interpretations **persist regardless of source quality.**」

> **对 drill 的直接后果**：**「限定来源」不是幻觉的解决方案。** 如果 drill 的洞察能力依赖「只读用户自己的笔记」，那只解决了检索范围问题，**没有解决语义裁决问题**——当用户笔记里存在互相矛盾或歧义的内容时，模型仍会编造。
> **这反过来正面支持 drill 的「允许沉默」**：与其在语义冲突时硬给一个解释，不如不出声。
> 另外该研究的观察（模型在需要消歧时**承认自己用了 general knowledge 而非来源限定定义**）说明：**模型不会主动告诉你它越界了**，需要外部机制发现。

**其他负面/局限**：
- 官方开发者论坛存在严重回归报告：[Critical Regression: Gemini 3.1 Pro Update (Feb 19) Completely Broke NotebookLM's RAG & Grounding](https://discuss.ai.google.dev/t/critical-regression-gemini-3-1-pro-update-feb-19-completely-broke-notebooklm-s-rag-grounding/126857/5)（Google AI Developers Forum，**用户报告**）。说明：**底层模型升级可能一次性摧毁 grounding 质量**——依赖单一模型 provider 的洞察能力，其质量不由你的代码控制。
- 二手评论：[NotebookLM: When AI Becomes a Self-Assured Liar](https://www.goyou.it/en/tecnologia/2026/06/15/notebooklm-when-ai-becomes-a-self-assured-liar.html)（媒体评论，**未逐条采信**）。

---

## 16. Dayflow

本次调研中**与「后台自动」最彻底、也最工程透明**的一个（开源 + README 即一手文档）。

### 16.1 洞察类功能

一手：[GitHub README](https://github.com/JerryZLiu/Dayflow)

- **Automatic timeline**：「captures lightweight screen chunks, analyzes them with your chosen AI provider, and turns the day into **activity cards**」。
- **Context-aware summaries**：「It looks at **what you were actually doing on screen, not just which app was active**. Cursor, Chrome, YouTube, or Slack become meaningful work context instead of vague app usage.」
- **Daily Standup**：「pulls **yesterday's highlights, today's tasks, and blockers** from your timeline」+ GitHub-style activity grid。
- **Weekly Review**：「aggregates your timeline into **focus patterns, categories, app usage, and interaction graphs**… see where the week actually went and **spot the habits that helped or hurt**」。
- **Chat With Your Work Journal**：「Ask questions about your day/week/year and get answers **grounded in your timeline**」。
- **Distraction tracking**：「identifies distracting sessions and shows them alongside focused work」——**这是一类很有特色的洞察：负面行为模式**。
- **Timeline export**：导出 Markdown（任意日期区间）。

### 16.2 触发方式

**全后台自动**：常驻 Mac、按屏幕活动生成时间线；Daily Standup 和 Weekly Review 是**按日/周的时间聚合**。「runs quietly on your Mac」。

### 16.3 输出形态与持久化

- **是**：activity cards、timeline、database 都持久保存在本地 `~/Library/Application Support/Dayflow/`。
- 可导出 Markdown（用于 status update、客户笔记、个人回顾、或**保存为可搜索的记录**）。
- **Automatic cleanup**：可配置存储上限，自动清除旧录像。

### 16.4 LLM 调用 vs agent 循环

**不是 agent 循环**：是「截屏 → 用你选的 AI provider 分析 → 生成 activity cards」的单次分析管道 + 时间聚合。**README 未提及工具调用或多步规划。**

**工程上值得注意的取舍**：**AI provider 可选**——本地模型（Ollama / LM Studio）、Gemini（自己的 API key）、ChatGPT 或 Claude（通过它们的**本地 CLI 工具**）。这是本次调研中「模型可替换性」做得最彻底的产品之一。

### 16.5 定价与 AI 额度

- 开源（**MIT License**），**本地优先**。
- 官网有 [dayflow.so/pricing](https://www.dayflow.so/pricing/)，但本次**未取回内容，未证实**。
- 架构上成本由用户自己的 provider 承担（自备 API key 或本地模型）。

### 16.6 已知负面反馈 / 局限

- **未找到成规模的用户吐槽。**
- 官方自陈的限制（README）：
  - 需要 macOS 14+ 与**屏幕与系统音频录制权限**。
  - 若选云端 provider，「activity data needed for analysis is sent to that provider」——**本地优先不等于永不出端**。
  - 只能记录 Mac 上的活动。
- 分析层面的局限：**屏幕活动 ≠ 实际产出**；README 自己也承认它是在「理解你在做什么」，这是推断而非事实。

---

## 17. Supermemory

Supermemory 是本次调研中**在「AI 推断如何不污染语料」这个问题上给出了最完整工程答案**的产品。它直接回应 drill 关心的核心矛盾。

### 17.1 洞察类功能

一手：[Review inferred memories](https://supermemory.ai/docs/recall/memory-review)、[Graph memory](https://supermemory.ai/docs/concepts/graph-memory)、[Memory Operations](https://supermemory.ai/docs/recall/memory-operations)

**（1）推断记忆（inferred memories）与「记忆审阅队列」——本次调研最重要的单点发现**

官方原文：

> 「Supermemory's graph **derives new facts from patterns across your existing memories**… Because **nobody stated these facts directly**, they are flagged as inferred (`isInference: true`) and **down-weighted in search until someone confirms them**.」

**审阅动作对检索排序的实际影响（官方表格）：**

| Action | Result | Effect on search |
|---|---|---|
| **Approve** | `isInference` cleared | Ranks like a stated fact — no longer down-weighted |
| **Decline** | `isForgotten` set | **Removed from search entirely — a rejected guess is forgotten** |
| **Undo** | back to unreviewed | Returns to the queue; inferred and down-weighted again |

其他官方细节：
- `GET /v3/container-tags/{containerTag}/inferred` 返回待审阅队列，**最多 50 条，按 `parentCount`（由多少条源记忆推导而来）降序**，再按创建时间降序 → **信号越强的推断越先出现**。
- 队列**排除**已遗忘、已过期、已审阅的记忆。
- 引擎设计的交互模式：「**an optimistic, one-at-a-time review UI (swipe to keep / decline, with undo)**」+ React Query hooks 示例。
- 一个诚实的细节：**「There is no separate 'skip' action. A swipe-to-skip is purely client-side — don't send a request and the memory simply stays in the queue for a later session.」**
- 拒绝动作的枚举值叫 **`decline` 而不是 `reject`**（文档专门警告）。
- 响应里带 `metadata.reviewStatus`（`approved` / `declined` / `null`）。

**（2）其他**：Graph memory（每个用户的记忆图）、User profiles（从记忆推导的用户画像）、Search API（语义搜索 + 图遍历，**187ms 中位服务时间，「built for agent loops」**）、多模态摄取（文本/图片/PDF/音频/视频）、SMFS（记忆可作为文件系统使用）、MCP 与插件。

### 17.2 触发方式

**后台自动推断 + 人工审批收件箱**。推断是自动产生的（`source: "derive"`），但**未经审批的推断一律降权**。这是一个**「自动产生、默认沉默、人工放行」**的模型——与 drill 的「允许沉默」异曲同工。

### 17.3 输出形态与持久化

- **是，而且是把「AI 产出」升格为可检索一等公民的最精细设计**：推断记忆是独立对象，带 `isInference`、`isForgotten`、`reviewStatus`、`parentCount` 等状态字段。
- **审批状态直接改变检索排序**——即「人的判断」被编码进了系统的检索层，而不只是 UI 标记。

### 17.4 LLM 调用 vs agent 循环

- 定位就是**给 agent 用的记忆层**（「The default engine for memory and continual learning for agents」「Memory and continual learning for any model, any harness」）。
- 提供 **Agents, skills and MCP** 章节。
- 检索 API 明确为 agent loop 优化。
- **未找到描述其内部推理/规划实现的一手工程博客。**

### 17.5 定价与 AI 额度（**按量计费模型的完整样本**）

一手：[supermemory Pricing](https://supermemory.ai/pricing/)

| Plan | 价格 | 含 credits |
|---|---|---|
| Free | $0 | **$5 credits/月**，每月刷新 |
| Pro | $19/月 | $20/月 |
| Max | $100/月 | $130/月（6.5× Pro），含 Gmail connector |
| Scale | $399/月 | $600/月，含高级 PDF 提取、S3 与 web crawler connector、无限席位、**SOC 2 · HIPAA BAA · 自托管选项** |
| Enterprise | 定制 | 无限用量，**air-gapped 自托管** |

**Rate card（关键：按「真正新摄取的内容」计费）**：

| 类别 | 价格 |
|---|---|
| Memory — Plain text | $5 / 1M SM tokens |
| Memory — Rich content | $10 / 1M SM tokens |
| SuperRAG — Text | $1 / 1M SM tokens |
| SuperRAG — Rich (images, PDFs, audio, video) | $2 / 1M SM tokens |
| Search and traversal | $5 / 1M queries |
| Operations（re-ranking、aggregation、query rewriting 等） | $100 / 1M operations |

**计费哲学（官方原文）**：
- 「**只对唯一内容计费**」（only unique content is ever billed）。
- 「**SM tokens measure billable content processed during ingestion.** Supported updates to the same document **bill the net-new token delta**；search and other operations are metered separately.」
- **重复内容不计费**：同一 org 内同一 `customId` 的支持更新，未变内容不再计费。
- **订阅 credits 每月重置**；**top-up 购买的 credits 永不过期**。
- 「Usage requires an available credit balance」——即**必须先有余额才能用**，不是先跑后付。
- 初创/学术可免费用 Scale 三个月。

**「自托管」的边界很值得学**：自托管在 **Scale 和 Enterprise** 才有；Enterprise 还支持**完全 air-gapped 部署**，此时「LLM inference may be the only outbound call, **or none at all**」。

### 17.6 已知负面反馈 / 局限

- **未找到成规模的负面口碑。**
- 官方自陈的重要局限：
  - **v3 与 v4 API 已废弃，将于 2026-12-31 关闭**，需迁移到 v5。→ **API 演进激进，集成方需要持续跟进**。
  - 审阅队列**一次最多返回 50 条**。
  - Scale 以下计划只有标准 PDF 提取（Free/Pro/Max 支持标准 PDF 提取含扫描件 OCR，但**高级逐页 OCR + 图表描述仅 Scale 与 Enterprise 有**）。
  - 高级能力（自托管、air-gapped）**门槛在 $399/月的 Scale 起**。

---

## 18. Khoj

**开源 + 可自托管**，是本次调研中与 drill 在形态上最接近的产品之一，而且**公开了量化评测**。

### 18.1 洞察类功能

一手：[docs.khoj.dev](https://docs.khoj.dev/)、[GitHub README](https://github.com/khoj-ai/khoj)、[Automations](https://docs.khoj.dev/features/automations/)、[Agents](https://docs.khoj.dev/features/agents/)

- **Search**：语义检索；**本地自托管时「Your personal data stays local. All search and indexing is done on your machine」**；增量索引（search-as-you-type）。
- **Chat**：基于你的文件与网络回答；官方列出的价值表述里有两条很贴 drill：「**Iterative discovery**：Iteratively explore and (re-)discover your notes」、「**Assisted creativity**」。
- **Agents**：自定义 system prompt；自托管可在 `server/admin/database/agent` 创建，设 `public` 则全服务器用户可见，否则限定 Creator 用户。
- **Automations（定时推送的官方实现）**：「schedule repeated jobs for Khoj to do on your behalf… **run your query automatically at a scheduled time and frequency**. Khoj will **send its research to you as an email**.」用例：自定义 newsletter、摘要新闻、通知世界事件。**按本地时区调度**；自托管需要配置 Resend 与 Authentication 才能发邮件。
- **Research mode**：多步迭代检索（见 18.4）。
- **Code Execution**、**Image Generation**、**Online Search**、**Shareable Chat**、**Voice**、**Desktop Quick Chat (Khoj Mini)**。
- 数据源：PDF、纯文本、Markdown、org-mode、Word、Notion pages、GitHub repos。
- 客户端：Browser、**Obsidian**、**Emacs**、Desktop、Phone、**WhatsApp**。

### 18.2 触发方式

**三种都有**：
- 手动（Chat / Search）
- **定时（Automations，cron 式，结果邮件推送）**
- 官方表述里还有「**smart notifications delivered to your inbox**」（README）

这是本次调研中**把「定时研究任务」做成明确产品功能的最干净样本**。

### 18.3 输出形态与持久化

- Chat 可分享（Shareable Chat）；文档/索引持久化。
- Automations 的产出是**邮件**（不落库进知识库）——**这算是一种「洞察不落库」的变体：产出走外发通道，不污染语料**。

### 18.4 LLM 调用 vs agent 循环（**有公开的量化评测，本次调研唯一**）

一手工程博客：[Evaluating Khoj for Helpfulness](https://blog.khoj.dev/posts/evaluate-khoj-quality/)，2024-11-22，作者 Debanjum Singh Solanky

**三种交互模式的定义（官方原文）**：

> - **General**: This is like a **closed book exam**. **No retrieval is allowed.** The agent can't access external information, only the LLMs existing _general_ knowledge.
> - **Default**: This is like an **open book exam**. **Single shot retrieval** is allowed. The agent can search for information online, run calculations in a code sandbox.
> - **Research**: This is like a **take home exam**. **Iterative retrieval** is permitted. The agent can do deeper research for a bit longer with the same web search and code tools.

**评测基础设施**：公开的 eval harness + GitHub Actions workflow，**每次 release 自动跑**：启动本地 Khoj → 让它能搜网和跑代码 → 从 FRAMES 抽 200 题 → 用 gemini-1.5-pro-002 做 LLM judge → **发布分数与可下载报告供第三方核验**。

**结果（gemini-1.5-flash-002，200 题随机子集，误差约 ±6%）**：

| Benchmark | General | Default | Research | Baseline |
|---|---|---|---|---|
| FRAMES | 27.1 | 42.0 | **63.5** | 26.3 (flash-1.5-001) |
| SimpleQA | 10.0 | 84.0 | **86.0** | 43.5 (o1-preview) |

**关键结论（官方自陈）**：
- General → Default：FRAMES **+54.8%**；Default → Research：**再 +51.2%**。
- 「Khoj research mode upgrades gemini-1.5-flash (63.5%) to achieve **gemini-1.5-pro performance (66%)** with the multi-step retrieval」；而「shown all relevant documents gemini-1.5-flash achieves a **66.5%** score」——**即 agent 的多步检索几乎把弱模型的推理上限打满了**。
- **Code Interpreter 的影响被单独量化**：FRAMES Default 模式无代码工具 35.68% → 有代码工具 42.00%，**相对提升约 18%**。

> **对 drill 最重要的一条**：「多步检索 vs 单次检索」的差距是**可测量的、幅度很大的**（Default 42.0 → Research 63.5，约 +51% 相对提升）。**把「一次 LLM 调用」升级为「多步 agent」，在能力上是实打实的，不是营销。** 但同一份数据也显示：**General（无检索）到 Default（单次检索）的跃升更大（+54.8%）**——即投入产出比最高的是「先接上检索」，其次才是「把检索做成多步」。

**官方自陈的评测局限（很诚实）**：
- 「Our current eval only measures retrieval from **the internet, not from your documents**.」
- 只测单轮、只测文本、**未测 confidence calibration**。

### 18.5 定价与 AI 额度

- **开源、可自托管、「Get started - free」**（README）。
- 有 Khoj Cloud（app.khoj.dev）与 Khoj Enterprise（on-prem / hybrid）。
- **云版具体免费额度与价格：未找到一手定价页**（`khoj.dev/pricing` 返回 404），**未证实**。
- **自托管成本 = 你自己的模型成本**（本地模型免费，或用任何在线 LLM）。

### 18.6 已知负面反馈 / 局限

- **未找到成规模负面口碑。**
- 官方自陈局限（见 18.4 的评测限制）。
- 检索命中 [Khoj 评测: AI第二大脑, 仅支持自托管](https://www.promptquorum.com/zh/power-local-llm/khoj-ai-second-brain-review)（第三方评测，**未采信**）。
- 值得注意的产品风险：README 的「New」区块现在主推 **Pipali**（「our open-source AI coworker that runs on your computer」）——**主线产品之外的新项目**，可能分散投入（此为观察，非官方声明）。

---

## 19. Readwise Reader / Ghostreader

**Daily Review 是「定时 + 推送」模式的行业标杆案例**，也是本次调研中 push 模式做得最久、最成熟、争议最小的一家。

### 19.1 洞察类功能

一手：[Readwise Reader 官网](https://readwise.io/read)、[Readwise Docs](https://docs.readwise.io/)

- **Daily Review（间隔重复重现）**：
  > 「Readwise helps you remember more of what you read using the scientific principle of **spaced repetition**. The Daily Review **resurfaces the right highlight at the right time** via **email or app**.」
  > 「How often do you finish a book, only to forget the key ideas a few weeks later? Readwise **resurfaces the right highlight at the right time** through the Daily Review.」
- **Ghostreader**：「Ghostreader is your **GPT copilot of reading**. Ask questions. Define terms. Simplify complex language. And so much more.」——**阅读场景内的洞察**。
- **Reader 内的 AI 集成**：Reader **自动同步到 Readwise**，而 Readwise 是 Daily Review 的来源。
- **MCP server**（官方 FAQ 自陈「becoming one of Reader's most powerful features」）：「The **Readwise MCP server** connects Claude, ChatGPT, Cursor, or any MCP-compatible assistant directly to your library. Your AI can easily utilize the full content of your documents to answer questions **grounded in your own reading**, and **the MCP can even organize your documents for you**.」+ 完整 CLI（readwise.io/cli）。
- 其他：web highlighting、RSS、PDF、YouTube 转录高亮、Twitter threads、read-it-later、EPUB、newsletters、full text search（可离线）、text-to-speech。

### 19.2 触发方式

**定时 + 推送，且有细粒度控制**（一手：[Mobile Apps 文档](https://docs.readwise.io/readwise/docs/faqs/mobile-apps)）：

> 「**Can I turn off Daily Review emails and still get iOS notifications?** Yes! You can set your **Email Frequency to "Never"**… and you'll still get your Daily Reviews in the app. You'll also continue to receive notifications… **The notification should arrive within an hour after the "email send time" set in your email preferences.**」
> 桌面小组件行为：「If you've already completed your Daily Review, the widget displays a **random highlight that rotates every 5 minutes** throughout the day. If you haven't yet finished your Daily Review, it shows the first review highlight alongside a helpful prompt.」

关键设计点：**推送时间是用户设定的**，且**推送渠道可分离**（关掉邮件仍可保留 App 通知），并有**桌面小组件**作为非打扰式入口。这比「系统决定什么时候提醒你」（Mem）对用户更友好。

### 19.3 输出形态与持久化

- **是**：highlight 与 note 是一等公民，可搜索、可导出（「You can download every document as a CSV… every highlight and annotation as **Markdown**」）、可同步到 Obsidian / Notion / Roam / Logseq / Evernote。
- **但 Daily Review 的「重现」本身不产生新对象**——它只是把已有 highlight 重新呈现。**这才是它不招致「AI 味」批评的根本原因：它重现的是用户自己写的东西，不是 AI 生成的判断。**

### 19.4 LLM 调用 vs agent 循环

- **Daily Review 完全是算法调度（间隔重复），不是 LLM。**
- Ghostreader 是单次/多轮 LLM 调用。
- MCP server 让**外部 agent**接入（Readwise 自己不做 agent 编排）——与 Notion 的思路相反，与 Heptabase 后期的思路一致。
- **未找到 Readwise 自建 agent 循环的一手证据。**

### 19.5 定价与 AI 额度

一手：[Reader 官网 FAQ](https://readwise.io/read)

> 「You can try Reader and Readwise with a **free 30-day trial, no credit card required**. After your trial expires, you can continue using Reader as part of a full Readwise subscription: **$9.99/month billed annually, or $12.99/month billed monthly**. We also offer a **50% discount** for students, educators, non-profits, military, first responders, and anyone living in a country where US pricing doesn't translate fairly.」

- **没有按次计费的 AI 额度**（Ghostreader 包含在订阅内）。这是本次调研中**唯一一家把 AI 功能不加价打包、也不设次数闸门**的成熟产品。
- 商业模式声明：「**Readwise has been bootstrapped and profitable since 2017, funded by subscribers rather than venture capital.** This means we survive by making software readers love, not by pleasing investors.」（附 [Why We're Bootstrapping Readwise](https://blog.readwise.io/why-were-bootstrapping-readwise/)）
- **数据可携带性承诺**：「Anytime, in full. You can download every document as a CSV, your feeds as an OPML, your uploaded files as a zip, and every highlight and annotation as Markdown.」+ 直接回应竞品关停（Pocket 关停）：「**your reading always remains yours to take with you if anything does happen.**」

### 19.6 已知负面反馈 / 局限

- **未找到针对 Daily Review 或 Ghostreader 的成规模负面口碑。**
- 检索命中的多为官方 WiseUp 通讯（如 [WiseUp! Vol. 81](https://wiseup.readwise.io/wiseup-vol-81-how-to-read-hard-books-bring-in-your-twitter-x-bookmarks-and-check-your-daily-review-on-your-phone/)，**官方来源**）。
- 可识别的局限：
  - 核心价值仍依赖「**你在读的东西值得被回顾**」；对只收藏不读的用户同样无效（与 flomo 的「放大器」问题同源）。
  - Ghostreader 与 MCP 的具体效果**未找到独立评测**。

---

# a. 洞察类型分类学

按「用户在公开反馈中表现出的真实价值感」排序。排序依据是本次调研中可观察到的公开证据强弱（官方把它做成核心卖点 / 用户明确表示有价值 / 有量化证据），**不是主观偏好**。

### 第 1 档：可验证的关联发现（相关笔记 / 关联段落）

**为什么价值最高：**

1. **可被用户瞬间验证。** flomo 相关笔记、Heptabase AI suggestions for related cards、Smart Connections 的相关笔记、Khoj 的 iterative discovery——用户看到推荐，**三秒内就能判断「对」还是「不对」**。不需要信任 AI 的判断。
2. **不需要 AI 做价值判断。** 它只做检索排序，不做「这意味着什么」的解释。**这类洞察最不容易产生「AI 味」**。
3. **有用户自发的、非官方组织的使用方式。** flomo 官方教程页里，用户写出了「相关笔记索引卡」「用相关笔记做模糊搜索/问答」等官方没想到的用法（一手：[相关笔记](https://help.flomoapp.com/ai/xgbj.html)）。**产品被用户用在设计者没预期的地方，是这类功能有效的强信号。**
4. **有量化证据支持「先接检索」的回报。** Khoj 的评测显示：General（无检索）→ Default（单次检索）在 SimpleQA 上是 **10.0 → 84.0**，FRAMES 上 **27.1 → 42.0**。**单次检索是整个链条里投入产出比最高的一步。**

**结论**：如果 drill 的洞察 agent 只能做一件事，做这个。

### 第 2 档：能提问 / 能暴露盲点（而不是给答案）

**为什么排在第二：**

1. **这是被多个产品独立收敛到的设计。** flomo「揭示思维盲点、提出深刻问题」「心底之问」「帮你发现更好的问题」；Heptabase「AI suggested questions for newly created chats」；flomo Agent 技能「昨日回声」（找出笔记间**对不上**的地方，留给你一个真问题）。
2. **用户的正面反馈集中在「问题」而非「答案」上。** flomo 官方页面引用的用户原话：「**AI 洞察给出的问题总是让我有意想不到的惊喜，让我可以站在第三方的视角去审视我以前不曾想到的问题**」；「我以为我写的是日常琐事，没想到 AI 洞察出了我对被需要感的执念」。
3. **它与「允许沉默」天然兼容。** 「提出一个好问题」的门槛低于「给出一个正确结论」；证据不足时可以说「暂时没什么可说的」，也可以说「这里有个对不上的地方，你怎么看」。
4. **风险点**：C 端用户经常无法立刻验证提问的价值。flomo 的 2 次/天限制实际上是一种保护——**逼用户慢下来，也让每次输出的价值密度更高**（官方理由：「真正有价值的思考需要时间消化，而非快餐式消费」）。

### 第 3 档：矛盾 / 不一致发现

**为什么有价值但排在第三：**

- **产品上被明确证实存在**：flomo Agent 的「昨日回声」技能就是「找出它和另一处记录对不上的地方」；Notion 官方用例「当重要细节变化时，让 Agent **spot gaps**」。
- **风险最高**：它极易变成幻觉。用户在笔记里写下的两句话，可能只是不同时期的正常观点演化，而不是矛盾。**误报的代价高于漏报**（而关联发现的误报代价低，因为用户能一眼排除）。
- **技术上有正面参照**：Supermemory 的做法——**推断记忆默认降权 + 人工 approve 才生效 + decline 即遗忘**——是这条产品线上的正确姿势。
- **学术上有强警告**：NotebookLM 的复现研究表明「source-grounding 不阻止幻觉，因为检索系统约束信息源但**不裁决语义**」。矛盾发现恰好是「语义裁决」问题，所以**这是最难做好的一类**。

### 第 4 档：总结 / 提炼（长材料 → 结构化产物）

**为什么是中档：**

- **成熟且稳定**：NotebookLM 的 Briefing doc / Study guide / FAQ / Timeline / Mind map 是把「一份材料 → 多种产物」做得最完整的；Heptabase 的 Insight Generator 也是「从长文章生成 atomic insights」。
- **但它服务的是「理解输入」，不是「发现自己」。** 对 drill 而言，它的价值在于**给「再提炼」提供多种产物形态**，而不是替代洞察。
- **它最容易产生「AI 味」**：一份通用摘要对谁都能写，用户不会觉得「这是给我写的」。**只有当总结带有用户自己过去的上下文时才跨入第 2 档**（Heptabase 的 Journal 场景：把某日期区间的 journal 全加到白板，让 AI 找「我不知道的关于我自己的事」和「反复出现的主题」）。
- **时间线回顾（Timeline / Weekly Review / Dayflow 的 Daily Standup）属于这一档**，但它是「事实聚合」而非「判断」，因此误报代价低、可信度高，实际体感更好。

### 第 5 档：行动提取

**为什么排在后面：**

- **产品实现最广泛**：Tana 的 action items 提取（可参数化 target field / supertag / prompt）、Granola 的 Follow-up emails、Saner.ai 的 email → tasks、Saner.ai 的 brain dump → tasks。
- **但它服务的是「任务管理」而非「洞察」。** 对 drill（自托管个人知识系统，不主打 GTD）而言，优先级应更低。
- **它的价值依赖下游闭环**：提取出的 action item 如果没人执行就是噪音。Tana 的做法值得学（提取成**独立节点 + tag 建议**，进入可被 search nodes 查询的结构），而 Granola 的说话人归因失败会直接**丢失 action item 的责任人**（用户口碑抱怨点）。

### 第 6 档：行为模式 / 自我认知（人格化洞察）

**为什么排最后但值得留意：**

- **有真实的情感冲击力**：flomo 的「行为洞察」（照出反复出现却没察觉的默认动作）、「AI 记忆档案」、以及社区自发的「头脑内的那些声音」（把 `user.md` + `memory.md` 丢给 AI 找出「住在你脑子里的角色」）。用户的表述常是「被它感动哭」。
- **但它对语料量的要求最高**。flomo 官方明说：「**笔记越多，角色越立体。几十条笔记只能看个轮廓，几百上千条才能画出完整的你**」（一手：[头脑内的那些声音](https://help.flomoapp.com/ai/memory-roles.html)）。
- **这与 drill 的「允许沉默」完全同构**：语料不足时，正确的行为就是不说。
- **风险**：这类输出最容易被批评为「AI 味 / 巴纳姆效应」——flomo 用户那句「感觉分析有点忽悠我」正是这个风险的具体表现（900+ 条笔记仍发生了）。

### 一个横切的排序原则

从本次调研可以提炼出一条**跨所有类型的价值判据**：

> **洞察的可信度 ∝ 用户能在 3 秒内独立验证它。**

- 相关笔记：3 秒可验证 ✅ → 价值最高
- 引用来源笔记的洞察：3 秒可验证（点引用就跳过去）✅ → flomo 把「标注来源笔记」做成了硬性设计，正是为此
- 好的提问：不能立刻验证，但也不声称事实 ❌→🟡 → 中等
- 矛盾发现、行为模式、总结判断：用户需要自己回想才能验证 ❌ → 低，且幻觉代价最高

Heptabase 的一个设计是这条原则的最佳实现：**「Chat with your entire Space」会显示 AI 的思考过程——它在搜什么、在读什么**（一手：[Work with AI](https://wiki.heptabase.com/work-with-ai)）。把检索过程暴露出来，用户就能判断这次输出是否值得信。

---

# b. 反模式清单

按「对 drill 的威胁程度」排序。每条尽量给出实证来源。

### 反模式 1：让 AI 产出直接改写用户的一等公民对象

**实证（最严重的一例）**：Notion 3.0 实测（[barnes.tech](https://barnes.tech/blog/notion-30-notion-ai-follow-up)，技术博客）：

> 「I've now twice had it **completely ignore instructions**… **I've now twice had it delete embedded files that I specifically told it in the prompt to leave exactly as-is.**」

**结论**：drill 的「**AI 产出永不覆盖原文，只能新建 `ai_output` + 引用源对象**」不是洁癖，是必要的架构约束。**prompt 层面的「请不要修改」是不可靠的**——同一篇实测里用户明确说了要保留，AI 依然删了。

**延伸**：Notion 的替代方案也在这篇实测里给出了——「用 Notion MCP server + Claude Code / Codex 反而更成功」，**因为 MCP 的写操作是有 API 边界的**。

### 反模式 2：把 AI 推断混入检索语料而不加标记

**反面参照（正面案例）**：Supermemory 明确把推断标记出来并降权。

> 「Because nobody stated these facts directly, they are flagged as inferred (`isInference: true`) and **down-weighted in search until someone confirms them**.」
> Decline → `isForgotten: true` → 「**Removed from search entirely — a rejected guess is forgotten.**」

**drill 的对应风险**：如果 drill 的洞察产出落库，下一轮洞察就会把自己的旧判断当作「用户的原始记录」来读——**污染会自我放大**。这正是 flomo「洞察不落库」要防的事。

**如果 drill 未来必须落库**，Supermemory 的状态机就是最小可行设计：**独立对象 + 明确的「推断」标记 + 默认降权 + 人工放行后才升格 + 拒绝即遗忘**。

### 反模式 3：把「限定来源」当作幻觉的解药

**实证**：[Zenodo 复现研究（2025-12-24）](https://zenodo.org/records/18039274) 直接测试并反驳了 NotebookLM 的核心营销主张：

> 「Source-grounding **constrains retrieval but does not introduce semantic governance primitives**. Hallucinations caused by inability to prioritize and revoke competing interpretations **persist regardless of source quality**.」
> 「NotebookLM explicitly **acknowledged using 'general knowledge' rather than source-constrained definitions**… demonstrating it is **not a closed corpus system**.」

**对 drill 的要求**：
- 「只读用户自己的笔记」≠「不会编」。
- 用户笔记里存在歧义/冲突时，**模型会挑一个解释并当作事实说出来，且不告知你它越界了**。
- → 必须有**外部机制**发现越界（例如要求每个断言都能回指到具体源对象的引用），**不能依赖模型的自我报告**。

### 反模式 4：Agent 会幻觉出错误的工具调用

**实证（官方承认）**：Heptabase 发布 CLI Skills 时明说（[2026-05-29 newsletter](https://wiki.heptabase.com/newsletters/2026-05-29)）：

> 「To help agents use these commands well, we've also released the official **Heptabase CLI Skills**. With the skills installed, agents can **run the right commands and avoid common hallucinations and mistakes**.」

**含义**：当 drill 的洞察 agent 从「一次 LLM 调用」升级为「多步检索 + 工具调用」时，**「agent 幻觉出不存在的工具/参数」会成为一个必须专门治理的问题**。Heptabase 的解法是把工具用法固化成一等公民的 Skills 层，而不是指望模型每次都读对文档。

**另一个直接风险**：Heptabase 在 Dashboard 上给用户的是「使用自己的 API key / 用 Codex 登录 / on-demand 计费」多条路——**多工具、多 provider 的 agent 会带来凭证与计费边界的复杂度**。

### 反模式 5：主动推送 → 通知疲劳 → 产品被静音

**实证（反面教材与正面教材并存）**：

- Mem 把主动做成了核心卖点：「**Proactive without the noise.** Mem Agent decides **when a nudge will actually help**… **No schedules or prompt-tuning required.**」并给出了精细的「held back / new angle / stops when handled」行为设计（[Mem Agent](https://get.mem.ai/product/agent)）。**但它必须把「without the noise」放在标题位置，本身就说明这是这类产品的最大攻击面。**
- Granola 的官方帮助中心里有一整个 **Notifications** 章节（[docs.granola.ai](https://docs.granola.ai/help-center/taking-notes/notifications)），说明通知管理是必须专门处理的运维问题。
- Readwise 的做法（更值得学）是**把控制权交给用户**：邮件频率可设为 "Never" 而仍保留 App 通知、发送时间由用户设定、桌面小组件作为非打扰入口（[Mobile Apps 文档](https://docs.readwise.io/readwise/docs/faqs/mobile-apps)）。
- flomo 的 push 只用于「你自己写的东西」而不用于「AI 的判断」，官方对此的辩护是很强的产品逻辑：

> 「如今通知中心充斥着各类营销信息，但 flomo 的推送不一样——在 flomo 里记下的一切都是你自己的想法，这些推送更像是你写给自己的一封封信。」

**结论**：**如果 drill 一定要有 push，推送「用户自己的旧内容」比推送「AI 的新判断」安全一个数量级。**

### 反模式 6：付费墙与捆绑销售摧毁老用户信任

**实证（用户口碑）**：flomo 退订潮的核心理由不是功能差，而是**打包方式**（[smzdm 汇编](https://post.smzdm.com/p/a70d6qx9/)，内容由 AI 生成，需谨慎）：

> 「它不是不愿意开放接口，而是要加钱，而且**必须绑定 AI 功能的加钱**」
> PRO 用户：「pro 用户也是充了钱的，用不到新功能感觉有点**背刺**了」
> 社区呼声：「一人血书**单独付费**这个功能」

**含义**：当 AI 被塞进更高的订阅档、而老用户已有的档位被排除在外时，**伤害的是最忠诚的那批人**（原文：「退订的人里，很多恰恰是最忠诚的老用户。越爱『克制』，就越难接受『卖 AI』」）。对 drill 这类自托管产品，这条尤其要注意——用户对「AI 加价」的容忍度可能更低。

### 反模式 7：把 agent 输出堆在聊天记录里，逼用户手动整理

**实证（正面与反面都有）**：

- **反面**：Heptabase 官方在描述自家设计动机时就点出了问题（[Work with AI](https://wiki.heptabase.com/work-with-ai)）：
  > 「you may wish to **extract key knowledge points provided by AI from linear conversation threads** and place them on a large whiteboard for easier research and review」
  > 官方对自家 AI 工作流的总结：「**transform linear chat records into a more complete knowledge structure**」
- 也正是因此，Heptabase 做了「点 New card 存为卡片」「把消息拖上白板」。
- Smart Connections 的做法不同但同样避免了这个问题：「**Your note keeps the link, not a copy of the conversation.**」——**不把对话内容倒进 vault，只在笔记里留一个回链。**

**结论**：如果 drill 的洞察不落库，**必须解决「洞察用完就消失、用户想留存怎么办」**。两个已被验证的答案：
1. **一键转正**（Heptabase：点一下就变成正式对象）；
2. **只留回链，不留副本**（Smart Connections）。

相对地，最差的方案是让洞察躺在一次性的对话流里，用户想留只能手动复制。

### 反模式 8：静默失败 —— 捕获没发生，而且没人知道

**实证（用户口碑，且架构经官方文档验证）**：Granola（[anarlog.so 汇编](https://anarlog.so/blog/granola-ai-complaints/)，作者为竞品创始人，但其引用的产品限制均指向 Granola 官方文档）：

> 用户报告「started a note, watched the window sit there, and found out after the call that nothing had been captured」；「app was open all day and produced notes for about 60% of calls」；「two important conversations that appeared to be recording and were not, **with no error and no alert**」。
> 架构放大代价：不以参与者身份入会（**别人看不到捕获已死**）+ 不保留音频（**没有东西可以重放**）+ 不支持导入录音（**没启动就永远没了**）。
> 原文概括：「**A generic summary can be edited. A blank session cannot.**」

**对 drill 的含义**：**「允许沉默」不等于「允许静默失败」。** 用户必须能区分：
- 「我看了，没什么可说的」（正确的沉默）
- 「我根本没跑 / 跑失败了」（必须报错）

flomo 的额度 UI（Agent 设置页的用量卡片显示当日权益额度和剩余点数）是一个正面参考——**用户随时知道 AI 还能不能跑、跑了多少**。

### 反模式 9：把「无 bot / 本地 / 隐私」当营销词，而不是架构承诺

**实证**：Granola（同上来源）：

> 「『no bot』 is **not the same as** 『no cloud,』『no training,』 or 『no consent work』。」
> Free 与 Business 上 anonymized data **可能被用于改进模型，除非用户主动关掉**；**组织级 opt-out 是 Enterprise 专属**；官方明确**不是 HIPAA compliant、不能签 BAA**；数据驻留 US AWS；**透明功能默认关闭**。

**并且已经进入司法程序**：**Chamberlain v. Granola**（加州北区法院，[起诉书 PDF](https://storage.courtlistener.com/recap/gov.uscourts.cand.475308/gov.uscourts.cand.475308.1.0.pdf)）指控其在未告知其他参会者的情况下拦截会议通信。第三方律所分析指出：**法律风险落在部署该工具的公司身上，而「可选的透明功能」本身不构成同意。**

**对 drill（自托管）的含义**：自托管在隐私上有天然优势，但**必须保证架构与叙事一致**——尤其是当洞察 agent 需要把用户笔记片段发给云端 LLM 时。Supermemory 的表述值得借鉴：Enterprise air-gapped 部署下「**LLM inference may be the only outbound call, or none at all**」——**明确列出「唯一可能的出网调用」是什么。**

### 反模式 10：单点模型依赖 —— 上游一次升级就能摧毁洞察质量

**实证**：Google AI Developers Forum 的严重回归报告（用户报告）：[Critical Regression: Gemini 3.1 Pro Update (Feb 19) Completely Broke NotebookLM's RAG & Grounding](https://discuss.ai.google.dev/t/critical-regression-gemini-3-1-pro-update-feb-19-completely-broke-notebooklm-s-rag-grounding/126857/5)

**含义**：依赖单一 provider 的洞察能力，其质量**不由你的代码控制**。Dayflow 的「**AI provider choice**」（本地模型 / Gemini / ChatGPT / Claude via 本地 CLI）和 Heptabase 的「**Support OpenRouter and open source models**」（2026-07-24）+「Support custom base URL endpoint」（2026-08-27）都是同一个防御动作。

### 反模式 11：AI 是放大器，不是发生器

**实证（用户洞察，二手汇编）**：

> 「flomo 的 AI 是**放大器**，不是**发生器**。它放大的是你已有的记录习惯，而不是凭空给你开窍。」

短笔记、碎片化的用户觉得 AI「忽悠我」；笔记量大、写感受和上下文的用户觉得它「知己」。

**对 drill 的直接含义**：
- **用户会把自己的使用失败归因于产品**（「AI 洞察在忽悠我」），而实际原因是语料不足。
- 这正是 drill「**允许沉默**」要解决的问题——**但必须在 UI 上把「为什么沉默」说清楚**，否则用户仍会认为产品坏了。flomo 的做法是**给洞察加引用标记**（每条洞察标注来源笔记），让用户自己看到「它是从哪几条笔记里看出来的」——**这既建立了信任，也在证据不足时自然解释了沉默的原因。**

### 一条总结性的反模式

本次调研中最一致的一条模式是：

> **产品越是想「替用户思考」，用户越觉得它「AI 味重」；产品越是「帮用户看到自己已经有的东西」，用户越觉得它「懂我」。**

flomo 的官方表述实际上就是这个结论：「**AI 不应该替你思考，而应该激发你更深入地思考——不是给你答案，而是帮你发现更好的问题。**」而 Notion 的「Anything you can do, your Agent can do too」走到了另一个极端，代价是实测里「completely shits the bed」和删掉用户的文件。

---

# c. 触发模型对比

## c.1 三种模式的真实采用情况

### 模式一：纯手动 pull

**采用者**：Heptabase（Insight Generator、AI Chat、AI Agent 全部手动触发）、Smart Connections 的 Chat、Tana 的 AI command nodes（用户/命令触发）、Copilot for Obsidian（命令面板触发）、Reflect（AI assistant）、MyMind 的 Top of Mind。

**共同特征**：
- **这些产品几乎都没有关于「AI 洞察骚扰我」的负面反馈**。本次调研检索未发现针对 Heptabase AI 洞察、Smart Connections、Tana AI 的成规模不满。
- 官方更倾向于把「手动」当作**特性**而非妥协：Heptabase 的产品叙事是「把 AI 变成白板上的对象」，Tana 的产品叙事是「把 AI 变成你可配置的命令」。

**但纯 pull 有一个已知的天花板**：**用户不知道自己该问什么**。flomo 的实际反馈印证了这点——有 4000 条笔记的 PRO 用户求助「我不会用 agent，能不能出个教程」。这也是为什么各产品都在 pull 之上加了辅助：

- **给出预置问题**：Heptabase「AI suggested questions for newly created chats」（2026-01-22）
- **给出预置视角**：flomo 的「每日肯定 / 行动指南 / 意义雷达 / 心底之问 / 亚里士多德 / 塞涅卡 / 价值澄清 / 逆向思考」+ 自定义视角
- **给出预置技能**：flomo Agent 的「昨日回声 / 每日新知 / 行为洞察 / 幸福灵药」
- **给出预置工作流**：Granola 的 Recipes、Tana 的 command node 模板库、Copilot 的 saved commands

**→ 关键结论：pull 模式的可用性取决于「选项的可发现性」。** flomo 用 8 个命名的视角把「你该问什么」变成了菜单选择，这比让用户面对空白输入框有效得多。

### 模式二：定时 scheduled

**采用者（按成熟度排序）**：

1. **Readwise Daily Review（最成熟、争议最小）**：间隔重复算法驱动，邮件 + App 推送 + 桌面小组件三通道，**时间由用户设定、渠道可分离**。它的关键是**重现的是用户自己的 highlight，不是 AI 的判断**——因此没有「AI 味」问题，也没有准确性问题。
2. **flomo 每日回顾（同样只推用户自己的笔记）**：内容范围（全部/含标签/排除标签/无标签）、时间范围（全部/1年/6月/3月/1月）、数量（4/8/12/16/20/24 条每天）全部可配置，支持桌面与锁屏小组件 + App 推送。官方对 push 的辩护见反模式 5。
3. **Khoj Automations（把「定时研究」做成了产品功能）**：用户设 cron 式调度（按本地时区），Khoj 到点跑查询并**把研究结果邮件发给你**——用例是自定义 newsletter、新闻摘要、事件通知。**产出走邮件，不落进知识库**。
4. **Notion Custom Agents（企业向）**：「run automatically in the background based on **triggers and schedules**」；官方用例「一个 Agent 每天汇总用户反馈，另一个每周发项目更新，另一个自动分流 IT 请求」——「**even while you're asleep**」。
5. **Tana 的 meeting post-processing**（事件驱动而非时间驱动）：停止转录时自动跑处理命令。
6. **Granola Pre-meeting briefs**（事件驱动）：日历触发，会前自动生成简报。
7. **Mem Meeting Briefings**（事件驱动，Pro beta）：会前自动生成，且**用户可点赞/点踩来改进**。

**共同特征与后果**：
- **定时任务在两种场景下没问题**：① 推的是用户自己的旧内容（Readwise、flomo 每日回顾）；② 推的是用户自己定义的查询结果（Khoj Automations、Notion Custom Agents、Granola/Tana 的会议后处理）。
- **定时任务在一种场景下有风险**：系统自行决定「给你生成一条新判断」（这正是 Mem 的路线，而 Mem 必须用「without the noise」当主打语）。
- **可配置性是关键差异**：Readwise 和 flomo 把时间、频率、范围、渠道全部交给用户；Mem 明确反其道而行（「No schedules or prompt-tuning required」）。
- **成本模型在定时的场景下会失控**：flomo 官方明确提醒「定时任务也消耗点数吗？**消耗。**建议把定时任务的运行时间设在非高峰时段，同样的任务更省点数」；Khoj 自托管需要自己配 Resend 才能发邮件。

### 模式三：主动推送 push

**采用者**：
- **Mem（最激进）**：Mem Agent 后台持续 review 上下文，在它判断合适的时机主动 follow-up；「No schedules or prompt-tuning required」。
- **Saner.ai**：「it's been reading my calendar and inbox **in the background** instead of waiting for me to ask」；主动 flagged 未回复的邮件、把相关笔记拉进即将开始的会议。
- **Supermemory（特殊的 push）**：推断记忆后台自动产生，进入**人工审批队列**——这是「push 到收件箱，但默认不生效」。
- **MyMind Serendipity**：主动重现遗忘内容（但语气刻意做慢、做成应用内体验）。

**共同特征与后果**：
- **这一类产品都必须处理同一个问题**：怎么让「主动」不变成「噪音」。Mem 的解法是**时机决策**（检查日历、你在忙就 held back、换个角度再试、处理完就停）；Saner.ai 的解法是**把主动绑在已有的事件流上**（日历会议、未回复邮件）。
- **没有一家把「主动推送 AI 的新判断」做成了无争议的体验。** Mem 的最高优先级宣传语是「Proactive without the noise」；Granola 有专门的 Notifications 帮助文档；Readwise 把控制权完全交给用户。
- **通知疲劳是可观测的成本**：Granola 官方文档单设 Notifications 一节；Mem 用整个产品页的一半篇幅解释它会在什么时候**不**打扰你。
- **push 模式的隐性代价是信任**：flomo 官方之所以能为 push 辩护，唯一的理由是「推送的是你自己写的东西」。这个论证**无法移植到 AI 生成的判断上**。

## c.2 三种模式的对照表

| 维度 | pull | scheduled | push |
|---|---|---|---|
| 代表产品 | Heptabase、Tana、Smart Connections、Reflect | Readwise、flomo 每日回顾、Khoj Automations、Notion Custom Agents | Mem、Saner.ai、Supermemory（审批队列） |
| 用户感知 | 我决定 | 我知道它会来 | 它决定什么时候找我 |
| 「AI 味」风险 | 低（用户主动索取） | 低（若推的是用户自己的内容）/ 中（若推的是 AI 判断） | **高** |
| 幻觉代价 | 中（用户会当场核验） | 低（同上） | **高**（用户被动接收，先信后验） |
| 通知疲劳 | 无 | 中（取决于可配置性） | **高** |
| 成本控制 | 可预测（用户点一次算一次） | **需专门设计**（flomo 要提醒错峰、定时任务消耗点数） | 需后台预算（Mem 用多维限额） |
| 发现性（用户不知道问什么） | **弱** → 需预置视角/问题/技能 | 强（到点就有） | 强 |
| 用户控制感 | 最高 | 中高（取决于能否配置） | **最低** |
| 失败模式 | 用户不用它 → 功能死掉 | 推的东西没用 → 用户关掉通知 | 推错了 → 用户卸载 |
| 适合的洞察类型 | 关联发现、提问、矛盾发现、总结 | 回顾/重现、用户定义的查询、事件触发的处理 | 有时限的行动提醒 |

## c.3 给 drill 的建议

### 建议 1：保持 pull 作为唯一默认，但要解决 pull 的「发现性」缺陷

**理由**：本次调研中，**pull 模式的负面反馈最少**（Heptabase、Tana、Smart Connections 均未发现成规模不满），而 **push 模式的每一家都在为「不打扰」做额外工程**（Mem 的时机决策、Granola 的 Notifications 文档、Readwise 的通道分离）。

但 pull 有一个被实证的缺陷：**用户不知道该问什么**。flomo 出现了「我有 4000 条笔记，可是我不会用 agent」这样的求助。

**具体建议**：
- 保留「用户点了才跑」，但**不要把空白输入框丢给用户**。
- 提供**命名的洞察视角/技能清单**（flomo 有 8 个内置视角 + 自定义；flomo Agent 有 4 个命名技能）。
- 提供**预置问题建议**（Heptabase 在新建 chat 时给 AI suggested questions）。
- 提供**一键「再来一组」**（flomo 的相关笔记可「继续查看下一轮推荐」）。

### 建议 2：如果要做 scheduled，只做「重现用户自己的内容」，不做「定时生成新判断」

**理由**：定时模式在本次调研中有清晰的成败分界：

- **成功的一侧**（Readwise Daily Review、flomo 每日回顾）都在**重现用户自己的旧内容**，且时间/频率/范围/渠道全部可配置。它们**不产生新的 AI 判断**，因此没有准确性问题和「AI 味」问题。
- **有风险的一侧**是「系统定时给你一条新判断」。

**具体建议**（两个方向，可组合）：

- **方向 A（低风险，直接可用）**：做一个**定时「回顾」**，推用户自己的旧笔记/旧对象，可配置范围与频率，走桌面/应用内小组件而非强推送。这本质上是 flomo「每日回顾」+ MyMind「Serendipity」的形态，**与洞察功能解耦**。
- **方向 B（中风险，但可做，须满足条件）**：允许**用户自己定义**的定时洞察任务（而非系统替你决定）。参照 Khoj Automations 与 Notion Custom Agents：**用户设查询、用户设时间、产出走外发通道（邮件/文件）而不是落进语料**。这既满足了有需求的用户，又保持了「洞察不落库」的约束。

**必须遵守的成本护栏**（flomo 的血泪教训，一手）：
- 定时任务**必须计入额度**，且要在 UI 上明示。
- 官方原文：「定时任务也消耗点数吗？消耗。建议把定时任务的运行时间设在非高峰时段，同样的任务更省点数。」
- 建议 drill 也做**错峰/预算上限**，否则定时任务是最容易失控的成本项。

### 建议 3：不要做「主动推送 AI 的新判断」

**理由**：

1. **没有成功先例。** 本次调研中，没有任何一个产品把「主动推送 AI 生成的新判断」做成了无争议的体验。最激进的 Mem 必须用「**Proactive without the noise**」当主打语，并用整个产品页解释它什么时侯**不**打扰你。
2. **flomo 的 push 之所以成立，唯一理由是「推的是你自己写的东西」**——官方原话：「在 flomo 里记下的一切都是你自己的想法，这些推送更像是你写给自己的一封封信」。**这个论证无法移植到 AI 判断上。**
3. **push 与 drill 的「允许沉默」在体验上冲突。** 允许沉默要求「证据不足时不出声」；push 要求「到点了必须有东西给你」。两者同时成立的前提是系统能判断「这次证据足不足」——而根据 NotebookLM 的复现研究，**模型无法可靠地自我报告它是否越界**。一个「每天必须推一条洞察」的 push 机制，在语料不足的日子里**必然要么沉默（用户忘记了这个功能），要么硬凑（AI 味）**。

**如果确实需要触达用户**：建议走**应用内「洞察收件箱」**，而不是系统通知。用户可以自己来看（保留 pull 的自主性），但不必主动推送。Supermemory 的**审阅队列**是这个思路的极佳范本——推断在后台产生、默认降权，用户主动来审阅时才生效。

### 建议 4：把「允许沉默」做成可见的产品状态，而不是默默什么都不做

**理由**：flomo 的用户反馈揭示了一个风险——**用户会把「AI 说了一些没用的话」和「AI 什么都不说」都归因为产品有问题**。第三方整理的原话：

> 「flomo 的 AI 是放大器，不是发生器。」

用户不会区分「我的笔记不够」和「这产品不行」。

**具体建议**（flomo 已有可抄的三个动作）：
1. **每条洞察标注来源对象**（flomo：每条洞察都标注它的来源笔记，点击引用标记可跳回）。这既建立信任，也在证据不足时**自然解释了沉默的原因**（用户看得到它只找到了 2 条）。
2. **允许用户调整原料范围**（flomo：用时间和标签筛选来聚焦洞察的原料；内容范围可选全部/含标签/排除标签/无标签）。
3. **让「沉默」是一个明确的、有措辞的状态**，而不是空白或加载失败。可与反模式 8 对照：用户必须能区分「我看了，没什么可说的」和「我根本没跑 / 跑失败了」。

### 建议 5：升级为 agent 是正确的，但投资顺序应该反过来

**理由**：Khoj 的公开量化评测给出了明确的投资顺序（一手，[blog.khoj.dev](https://blog.khoj.dev/posts/evaluate-khoj-quality/)）：

| Benchmark | General（无检索） | Default（**单次检索**） | Research（**多步迭代检索**） |
|---|---|---|---|
| FRAMES | 27.1 | 42.0 | 63.5 |
| SimpleQA | 10.0 | 84.0 | 86.0 |

- 「无检索 → 单次检索」的跃升最大（SimpleQA **+740% 相对**，FRAMES **+54.8% 相对**）。
- 「单次检索 → 多步」在 FRAMES 上仍有 **+51.2% 相对**提升（这个 benchmark 测的正是 multi-hop / temporal / tabular reasoning），但在 SimpleQA 上已经饱和（84.0 → 86.0）。

**具体建议**：
1. **先把检索做对**（这是收益最大的一步）。
2. **再上多步 agent**——它的收益在多跳/时序/表格类问题上显著，在单跳事实上有限。
3. **同时预先设计「工具调用约束层」**——Heptabase 的经验是 agent 会幻觉出错误的命令，所以它专门发布了 Skills 来约束。参见反模式 4。
4. **考虑暴露检索过程**——Heptabase 的「Chat with your entire Space」会显示 AI 正在搜什么、读什么。这直接服务于「用户能在 3 秒内验证」这条价值判据（见第 a 节）。
5. **建立可复现的评测**——Khoj 把 eval harness 开源、每次 release 自动跑、发布分数与可下载报告。对 drill 这样的小团队，**至少要把「洞察质量」变成可以跑回归测试的东西**，否则每次换模型/改 prompt 都是盲改。Khoj 的评测还诚实地列出了局限（只测网络检索不测个人文档、只测单轮、未测 confidence calibration）——drill 的评测应该直接测**自己的笔记语料**。

### 建议 6：把「AI 产出如何不污染语料」做成显式状态机

**理由**：Supermemory 在这一点上给出了本次调研中最完整的工程答案，且其状态机恰好与 drill 的哲学同构：

| 阶段 | Supermemory 的实现 | drill 的对应设计 |
|---|---|---|
| 产生 | 后台从模式中推导新事实，标 `isInference: true` | 新建 `ai_output` 对象 + 引用源对象 |
| 默认状态 | **down-weighted in search until someone confirms** | 洞察不落库（默认完全不进入检索） |
| 用户放行 | `approve` → 清除 `isInference`，与「用户陈述的事实」同等排序 | （drill 可考虑：用户主动「采纳」后是否允许落库） |
| 用户否决 | `decline` → `isForgotten: true`，**彻底移出检索** | （同上，需要「遗忘」而非「隐藏」） |
| 撤销 | `undo` → 回到未审阅、重新降权 | 需要可回退 |
| 信号强度 | `parentCount`（由多少条源记忆推导）**降序排列**，越强越先审阅 | 可作为「证据充分度」的量化指标 |

**特别值得抄的两个细节**：
1. **`parentCount` 作为「证据充分度」指标**：drill 可以用「这条洞察引用了几个源对象」来量化「证据够不够」——**这是「允许沉默」的可实现判据**，而不是靠模型自我评估。
2. **「拒绝即遗忘，而不是隐藏」**：`decline` 会把记忆彻底移出检索。对 drill，「用户否决过的洞察方向不要再提」需要在数据层实现，而不只是 UI 层。

---

# 附录：未找到一手来源的产品清单

按调研要求，以下内容**未找到可靠公开信息**，**不做任何推测**。

| 产品 | 未证实的内容 |
|---|---|
| **Capacities** | 仅确认官方文档存在 [AI Assistant](https://docs.capacities.io/reference/ai-assistant) 条目，但页面正文未能取回。**功能清单、触发方式、输出持久化、agent 架构、定价与额度、负面反馈全部未证实。** |
| **Recall**（getrecall.ai / recall.it） | 官网正文未能取回（返回空正文）。**全部 6 项未证实。** 检索命中的均为第三方目录站/插件商店页面，非一手来源。另有多个同名产品，检索可靠性低。 |
| **Fabric**（fabric.so） | 官网与博客正文被截断。仅能确认自我定位含「self-organizing workspace」「AI workspace that thinks with you」「human-agent collaboration」等表述，以及存在 [Fabric Tag](https://fabric.so/features/fabric-tag) 与两个对比页。**洞察功能清单、触发方式、输出持久化、agent 架构、定价与额度、负面反馈全部未证实。** |
| **MyMind** | 功能（AI summaries / Smart Spaces / Serendipity / Top of Mind / bidirectional linking）为**官方一手**。**定价页正文未取回，未证实。** 另：检索中常见的「MyMind 有 AI 每日回顾/邮件推送」说法，**本次未能从官方来源证实，标注为未证实**；已证实的重现机制仅为 **Serendipity**（应用内）。负面反馈未找到。 |
| **Limitless**（前 Rewind） | **当前功能清单、触发粒度、输出持久化、agent 架构、定价均未找到一手来源。** 已证实：存在针对佩戴 pendent 的隐私/同意流程的官方帮助文档（[1](https://help.limitless.ai/en/articles/13004190-talking-to-someone-wearing-the-pendant-what-to-expect-and-how-we-handle-your-information)、[2](https://help.limitless.ai/en/articles/10540861-how-to-ask-for-consent-and-let-others-know-you-are-recording)）；已被 Meta 收购（[TechCrunch 2025-12-05](https://techcrunch.com/2025/12/05/meta-acquires-ai-device-startup-limitless/)），且有报道称 pendent 新规销售将终止。 |
| **Notion AI** | **credits 的具体单价、各计划的 usage allowance 数值未证实**。另有 [Custom Agent pricing 帮助页](https://www.notion.com/zh-tw/help/custom-agent-pricing) 出现「introducing Notion credits (starting May 4, 2026)」字样，说明 credits 机制引入时间较晚，但**具体规则未完整取回**。 |
| **Google NotebookLM** | **官方 support 页与 notebooklm.google 正文未能取回**（JS 渲染）。**具体功能清单（Interactive mode、Discover sources 等的确切行为）、输出是否持久化为 notebook artifact、免费额度与 Plus 价格数值未证实**（部分依据 Google 官方 Workspace Updates 博客与 9to5Google 报道，已标注）。注意到 support 页面标题现为 **「Gemini Notebook Help」**，产品命名有变化，**范围未证实**。 |
| **Khoj** | **云版（app.khoj.dev）的免费额度与具体价格未找到一手定价页**（`khoj.dev/pricing` 返回 404），未证实。自托管免费已确认。 |
| **Obsidian / Smart Connections** | **Pro 订阅的具体价格未从官网取回**，未证实。 |
| **Obsidian / Copilot** | **Copilot Plus license 与 Miyo 自托管的具体价格未取回**，未证实。另：[Discussion #2009](https://github.com/logancyang/obsidian-copilot/discussions/2009) 内容未取回，**未采信**。 |
| **Obsidian 官方** | **未找到 Obsidian 官方推出任何 AI 功能的一手来源。** 结论：Obsidian 内核不含 AI，AI 全部由社区插件承担。 |
| **flomo** | AI 洞察是**单次 LLM 调用还是多步**，未证实。flomo Agent 的**技术架构**（检索/工具/计划的具体实现）**无公开工程博客**，未证实。PRO/MAX 的**官方页面未列出具体价格数值**（99 元/299 元来自第三方整理），**价格数值以第三方来源为准，标注为二手**。 |
| **Mem** | **技术架构**（检索/工具/计划的实现）无公开工程文档，未证实。App Store 评论存在但**未逐条取回，不采信**。 |
| **Reflect** | **订阅具体价格未从官网正文取回**，未证实。AI 产出是否持久化，**未找到官方明确说明**。 |
| **Tana** | **agent 架构**（多步检索/工具/规划的实现）无公开工程文档，未证实。**Tana 是否已从通用 PKM 正式转向会议场景，未找到官方公告**（仅从官方导航、定价页、文档路径 `outliner.tana.inc` 和产品名「Tana Outliner」观察，属推断）。 |
| **Saner.ai** | **AI 额度/次数模型未找到一手来源。** 定价信息来自**厂商自营内容营销博客**（作者为团队成员），标为二手/自述。**架构无公开文档**，未证实。隐私承诺未独立验证。 |
| **Dayflow** | **定价页内容未取回**，未证实。 |
| **Granola** | 部分负面反馈来自**直接竞品创始人**（Anarlog），**存在利益冲突**；其引用的产品限制已尽量回到 Granola 官方文档交叉验证，但**具体用户案例（60% 成功率等）无法独立验证**。Granola 是否有 agent 循环，**无公开说明，未证实**。 |
| **Notion / Tana / Mem / Heptabase 的通用缺口** | 这几家都**没有公开描述 agent 内部架构（规划、工具调用、记忆实现）的工程博客**。唯一接近工程博客的是 **Khoj 的评测文章**和 **Heptabase 关于 CLI Skills 的说明**。 |

## 方法论备注

- 本报告的所有官方来源均为本次调研中实际抓取到的页面。**PDF、视频链接、Twitter/X 帖子未作为结论依据。**
- 标注为「二手」或「用户口碑」的内容**未与官方来源交叉验证的部分已在正文中逐一指出**。
- 有两处来源需要特别降权处理，已在正文标注：
  1. [anarlog.so 关于 Granola 的抱怨汇编](https://anarlog.so/blog/granola-ai-complaints/)：作者自陈是竞品创始人。
  2. [smzdm 关于 flomo 的反馈汇编](https://post.smzdm.com/p/a70d6qx9/)：文末标注「内容由 AI 生成」，且素材来自小红书/知乎/微博的间接引述。
- **凡本次检索未取得可靠公开信息的，正文与附录均明确标注「未找到一手来源」或「未证实」，未做任何补全式推测。**
