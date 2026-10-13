# drill · 深一层 —— 洞察类型分类学与可确定性算法

> 调研目标：给出"哪些洞察可以不用 LLM 算出来、怎么算"的工程答案。
> 约束：自托管 / PostgreSQL + pgvector / Node.js；LLM 通道昂贵，尽量少用。
> 调研日期：2026-10-13。所有结论均附一手来源 URL（论文 / 官方文档 / GitHub 仓库）。

---

## 0. 先对齐真实数据模型（读代码后的事实修正）

任务描述里的数据模型与仓库实际 schema 有出入。以下以 `infra/sql/001_schema.sql` 为准，因为**这直接决定哪些洞察"现在就能算"**：

来源：[infra/sql/001_schema.sql](infra/sql/001_schema.sql)、[infra/sql/000_extensions.sql](infra/sql/000_extensions.sql)、[infra/sql/003_kinds.sql](infra/sql/003_kinds.sql)

### 0.1 已经存在、但任务描述没提到的关键字段

| 字段 | 位置 | 对洞察的意义 |
|---|---|---|
| `objects.supersedes_id` | `objects`，自引用外键 | **信念漂移的显式声明**。有它就不需要 NLI 去猜"这条推翻了哪条" |
| `objects.valid_until` | `objects` | 判断失效时间。`valid_until < now()` 就是"已过期但仍被引用"的确定性信号 |
| `objects.applies_to text[]` | `objects` | `self` 类对象的**适用范围**（工具选择/学习方式/…）。这是"两条自我判断是否可比"的天然分块键 |
| `objects.status` / `due_at` | `objects` | `action` 类的 todo/doing/blocked/done 与截止时间 → **行动闭环率纯 SQL 可得** |
| `objects.series` | `objects` | 序列/连载关系，时间模式的天然分组 |
| `objects.confirmed_at` | `objects` | 用户确认时刻，与 `captured_at` 的差 = 消化延迟 |
| `objects.search_vector tsvector` | `objects` | 全文检索列，`002_migrate` 里已经准备好了 |
| `objects.ephemeral` | `objects` | 临时对象，所有洞察都应排除 |
| `embeddings.content_hash` | `embeddings` | 内容哈希，**增量重算的判定依据**（hash 没变就不用重嵌入、不用重算该对象的本地洞察） |
| `embeddings.chunk_id` | `embeddings` | 已支持分块。当前 `related()` 只用整篇向量，chunk 级能力被闲置 |
| `relations.source_block_id` | `relations` | 关系可追溯到原段落 → 可以做**段落级**的图分析，不必停在文档级 |
| `versions` | 表 | 每条对象的 `rev` 快照。这是**免费的历史语料**，可算"这句话被改过几次/怎么改的" |
| `conflicts` | 表 | 同步冲突记录（非语义矛盾），别和"语义矛盾"混淆 |

### 0.2 索引现状（决定能不能不下沉到全表扫描）

- `objects_trgm`：`GIN ((title||' '||body) gin_trgm_ops)` —— **近重复的初筛已经可以走索引**，这是当前实现完全没用上的一张好牌。
- `objects_captured(user_id, captured_at DESC) WHERE deleted_at IS NULL AND NOT ephemeral` —— 时间窗口查询天然走索引。
- `relations_from` / `relations_to`：有向邻接索引，图遍历（度数、二跳）走索引。
- `embeddings`：**主键 `(user_id, object_id, chunk_id, model)`，没有任何向量索引**。这是最大的性能缺口。

### 0.3 当前实现的三个已知瓶颈（代码事实）

来源：[packages/server/src/repository.ts:169-180](packages/server/src/repository.ts#L169-L180)、[packages/server/src/intelligence.ts](packages/server/src/intelligence.ts)

1. **向量被全量拉到 Node 内存**：
   ```ts
   const rows = (await c.query('SELECT object_id,vec::text FROM embeddings WHERE user_id=$1 AND model=$2', ...)).rows;
   return rows.map((r: any) => ({ object_id: r.object_id, vec: JSON.parse(r.vec) }));
   ```
   `vec::text` + `JSON.parse` 是双重开销（文本序列化 + 解析）。10 万条 × 1024 维 = 4 亿个 float，文本形式约 **2–3 GB**，解析后 float64 约 **800 MB**。这是所有向量类洞察的公共瓶颈。

2. **`related()` 是 O(n) 全量对比**（[intelligence.ts:28-41](packages/server/src/intelligence.ts#L28-L41)）：对单个对象要遍历全部向量算余弦，10 万条时单次调用 10 万次余弦（1024 维 → 约 1 亿次乘加）。**白名单注释里写的正是"没有 ANN 索引"**。

3. **`clusterVectors()` 的种子选择是 O(n·k)**（[intelligence.ts:51-73](packages/server/src/intelligence.ts#L51-L73)）：k≤6 尚可，但分配阶段又是 O(n·k)。k 被硬编码成 `min(6, max(2, round(sqrt(n/2))))`，10 万条时 k 恒等于 6 —— 这是**对个人知识库过粗的粒度**（6 个簇无法表达个人领域结构）。

---

## A. 洞察类型分类学

判定口径：
- **【纯确定性】** = SQL / 统计 / 向量 / 图算法可完整检出，不需要任何语义模型。
- **【确定性初筛 + LLM 终审】** = 算法负责把 O(n²) 压到 O(n·k) 的候选集，LLM 只看候选。
- **【必须 LLM】** = 需要世界知识或开放式综合，算法只能排序不能判定。
- **【小模型】** = 可用本地 ONNX / 本地推理（非云端 LLM），算 L2 层。

---

### A1. 重复 / 冗余

**判定：【纯确定性】**

分三层，每层的成本差一个数量级：

| 层 | 算法 | 现状 |
|---|---|---|
| L1 完全相同 | `sha256(title\|\|body)` 分组，`GROUP BY hash HAVING count(*)>1` | 已有 `contentHash()`（[intelligence.ts:74](packages/server/src/intelligence.ts#L74)），但**只用于判断向量是否过期，没用于查重** |
| L2 近似文本 | `pg_trgm`：`WHERE a.title\|\|a.body % b.title\|\|b.body` 走 GIN 索引 | 索引已建，未使用 |
| L3 语义 | pgvector `<=>` + HNSW，取 top-k 邻居，`cosine > τ` 判重 | 索引缺失 |

**⚠️ 一个必须纠正的认知**：`pg_trgm` 的 `similarity()` **不是 Dice 系数**。官方文档定义的是 `共享 trigram 数 / (两串 trigram 总数 - 共享数)`——即 **trigram 版 Jaccard**，且**忽略所有非字母数字字符**，并对每个词做 `"  "` 前缀 + `" "` 后缀填充（`cat` → `" c"`, `" ca"`, `"cat"`, `"at "`）。
来源：[PostgreSQL 18 文档 F.35 pg_trgm](https://www.postgresql.org/docs/current/pgtrgm.html)

所以 `lexicalScore()`（bigram Dice）与 `pg_trgm`（trigram Jaccard）**不是同一个量，阈值不可互换**。`lexicalScore` 的可取之处是去掉所有空白符后切 bigram，对中文更友好（中文没有词间空格，trigram 会跨词边界）；`pg_trgm` 的可取之处是**有 GIN 索引**。正确做法不是二选一，而是：**pg_trgm 做索引初筛 → lexicalScore/cosine 做精排**。

**数据依赖**：现有字段全部够用（`title`/`body`/`body_blocks`/`embeddings.vec`/`content_hash`）。**无需补数据。**

**成本**：L1 一条 SQL，O(n)；L2 走 GIN，O(n log n) 量级；L3 需要先补 HNSW 索引。

---

### A2. 矛盾与张力

**判定：【确定性初筛 + LLM 终审】（小模型 NLI 可作为终审的廉价替代）**

这是整个报告里最容易做错的一类，必须先把三件事分清：

| 概念 | 定义 | 可判定性 |
|---|---|---|
| **重复** | 同一断言说了两遍 | 高相似 + 高蕴含 → 算法可判（NLI: entailment） |
| **矛盾** | 两条断言不能同时为真（A ∧ B ⊨ ⊥） | **NLI 的 contradiction 标签就是要抓这个**，但中文准确率有上限 |
| **张力** | 两条断言都站得住，但指向不同结论，需要综合 | **没有现成的判定器**。NLI 会稳定报 `neutral`，而 `neutral` 恰恰是张力与"无关"的混合体 |
| **补充** | 后者是前者的细化/延伸 | NLI 报 entailment 或 neutral + 高相似 |

**关键结论：矛盾可以系统化检测，"张力"不能。** 张力是 `neutral ∧ high_similarity ∧ different_stance` 的**残余类**，只能靠启发式（见下）+ LLM 终审。把张力伪装成可确定性检出，是这类系统最常见的过度承诺。

**候选对生成（决定可行性）**：
- 全配对在 10 万条时是 5×10⁹ 对（含句级会到 10¹¹），绝对不可行。
- 工程标准做法是 **top-k 近邻阻塞**：先用 pgvector 取每个对象的 k=10~20 近邻，得到约 `n·k = 10⁶` 对（10 万条），再按 `applies_to` / `tags_cached` / `domain`（parent_id 链）+ 时间邻近做二次过滤，实际进 NLI 的量可压到 **10³~10⁴ 量级**。
- 这是检索增强式事实核查（retrieval-augmented fact-checking）的标准结构，见 §B.3。

**NLI 模型选型（中文可用）**：

| 模型 | 大小 | 中文 | 说明 |
|---|---|---|---|
| `MoritzLaurer/mDeBERTa-v3-base-mnli-xnli` | ~280M | ✅ XNLI **zh = 0.8116** | 100 语言，中文是官方评测语言之一。**注意：该模型不支持 FP16** |
| `MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli` | ~110M | ✅ | 作者自述"更小更快但性能更低"的替代品，**性价比首选** |
| `MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli` | ~180M | ❌ 仅英文 | 英文场景准确率最高 |
| `IDEA-CCNL/Erlangshen-Roberta-330M-NLI` | ~330M | ✅ 原生中文 | 中文 NLI 专用 |

来源：[MoritzLaurer/mDeBERTa-v3-base-mnli-xnli (HF)](https://huggingface.co/MoritzLaurer/mDeBERTa-v3-base-mnli-xnli)、[MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli (HF)](https://huggingface.co/MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli)、[Erlangshen-Roberta-330M-NLI (HF)](https://huggingface.co/IDEA-CCNL/Erlangshen-Roberta-330M-NLI)

**⚠️ 中文准确率警告**：mDeBERTa 作者在模型卡里明确写了——"如果其他多语言模型声称在非英语上达到 90%，作者多半是测试出错了；最新论文的多语言平均表现不会超过 80% 几分"。XNLI 中文 0.8116 是 **句子对** 指标，落到长笔记、个人化表述、反讽上会明显更低。**上线前必须用你自己的数据抽样 200 对人工标一遍**，不要信论文数字。

**句级 vs 文档级**：长笔记必须切句后逐对判 NLI，再把句级结果聚合到文档级。标准聚合是 max（任一强矛盾即文档矛盾）或 noisy-OR；mean 会稀释掉孤立的强矛盾。**这一层的成本是 O(sentences²)**，必须靠 A2 的 top-k 阻塞压住。

**数据依赖**：现有字段够用，但缺 ★ 补齐：
- ★ `objects.captured_at` 已有 → 可做时间邻近过滤。
- ★ 缺：**论断的原子化存储**。当前 `body_blocks jsonb` 是段落，不是"一条断言"。要在 `relations` 上加一张 `claims(object_id, block_id, claim_text, claim_embedding)` 之类的派生表（可由确定性规则 + 一次 LLM 抽取生成，之后长期复用），才能避免每轮都从长文重新切句。
- ★ 缺：**NLI 结果缓存表** `(from_obj, from_block, to_obj, to_block, label, score, model, created_at)`。NLI 是 O(对) 的重活，必须落库复用——这是"少用 LLM/少重算"的核心。

---

### A3. 信念漂移（旧判断被新证据推翻）

**判定：【纯确定性】（显式路径）+【确定性初筛 + LLM 终审】（隐式路径）**

这里最重要的是承认一件事：**显式路径应当优先于任何自动化，且成本几乎为零。**

| 信号 | 算法 | 层次 |
|---|---|---|
| 显式取代 | `objects.supersedes_id` 非空 | 纯 SQL，O(n) |
| 判断过期 | `valid_until IS NOT NULL AND valid_until < now()`，且该对象仍被 `relations` 引用 | 纯 SQL |
| 修订频次 | `versions` 表按 `object_id` 分组计 `count(*)`，找"被反复改写"的对象 | 纯 SQL，窗口函数 |
| 语义位移 | 同一主题（同一 `parent_id` / 同一 `applies_to`）的 `self` 对象，不同时间段的质心向量余弦距离 | pgvector `AVG(vec)` 聚合 + `<=>` |
| 速度/变点 | 月度质心序列的位移范数 `‖c_{t+1} − c_t‖`，再跑变点检测 | 见 §B.4 |

**pgvector 的原生能力在这里很关键**：官方 README 明确支持向量聚合：
```sql
SELECT category_id, AVG(embedding) FROM items GROUP BY category_id;
```
来源：[pgvector README § Aggregates](https://github.com/pgvector/pgvector#aggregates)

于是"某个领域在某个月的语义质心"可以**完全在数据库里算**：
```sql
SELECT o.parent_id,
       date_trunc('month', to_timestamp(o.captured_at/1000)) AS m,
       AVG(e.vec) AS centroid, count(*) AS n
FROM objects o JOIN embeddings e ON e.object_id=o.id AND e.user_id=o.user_id
WHERE o.user_id=$1 AND o.deleted_at IS NULL AND NOT o.ephemeral
  AND o.kind IN ('self','distill')
GROUP BY 1,2 HAVING count(*) >= 3;
```
再对这个序列算相邻质心距离，就得到一条**漂移曲线**。这是零 LLM、零 Node 内存的路径。

**数据依赖**：`supersedes_id` / `valid_until` / `versions` / `embeddings` 全都有。**唯一缺的是时间分桶的质心物化表**（因 `AVG(vector)` 每次重算不便宜），建议加 `topic_centroids(user_id, topic_key, period, centroid vector(1024), n)`。

**成本**：纯 SQL，10 万条下秒级。

---

### A4. 悬置的想法（有提问无回答）

**判定：【纯确定性】**

判定规则需要两类信号：
1. **文本规则**：`body ~ '[?？]'` 且缺少"回答标记"。中文疑问词的确定性正则：`(怎么|如何|为什么|是否|能不能|要不要|该不该|什么时候|哪一?个|…吗|…呢)`。PostgreSQL 用 `pg_trgm` GIN 无法直接做正则，但 `~` 配合 `gin_trgm_ops` **是支持的**——官方文档明确："Beginning in PostgreSQL 9.3, these index types also support index searches for regular-expression matches (`~` and `~*`)"。所以疑问句扫描**可以走索引**。来源：[pg_trgm 文档 F.35.4](https://www.postgresql.org/docs/current/pgtrgm.html)
2. **图结构规则**：该对象出度为 0（没有任何 `relations` 指向它或由它指向别处），且 `captured_at` 超过 N 天。纯 SQL：
   ```sql
   SELECT o.id FROM objects o
   WHERE o.user_id=$1 AND o.deleted_at IS NULL AND NOT o.ephemeral
     AND o.body ~ '[?？]'
     AND NOT EXISTS (SELECT 1 FROM relations r
                     WHERE r.user_id=o.user_id AND r.deleted_at IS NULL
                       AND (r.from_id=o.id OR r.to_id=o.id))
     AND o.captured_at < $2;
   ```

**数据依赖**：完全够用。**无需补数据。**

**成本**：单条 SQL，走 `objects_trgm` + `relations_from/to` 索引，10 万条下 < 100 ms。

**唯一的假阳性来源**：自问自答写在同一条笔记里。可用 `body_blocks` 的块数 > 1 且后半段不含疑问词做二次过滤。

---

### A5. 孤立对象（有想法无连接）

**判定：【纯确定性】**

标准图算法：度数 = 0 的节点、只有 1 个成员的连通分量、k-core = 0 的节点。

在 Postgres 里**不需要图库**，两种写法：

```sql
-- 写法一：度数（走 relations_from/to 索引）
SELECT o.id,
       (SELECT count(*) FROM relations r WHERE r.user_id=o.user_id AND r.deleted_at IS NULL AND r.from_id=o.id) AS out_deg,
       (SELECT count(*) FROM relations r WHERE r.user_id=o.user_id AND r.deleted_at IS NULL AND r.to_id=o.id)   AS in_deg
FROM objects o
WHERE o.user_id=$1 AND o.deleted_at IS NULL AND NOT o.ephemeral
  AND o.kind NOT IN ('canvas','group');
```

```sql
-- 写法二：连通分量（把无向图当有向图的双向并，用递归 CTE）
WITH RECURSIVE edges AS (
  SELECT from_id AS a, to_id AS b FROM relations WHERE user_id=$1 AND deleted_at IS NULL
  UNION ALL
  SELECT to_id, from_id FROM relations WHERE user_id=$1 AND deleted_at IS NULL
), walk(root, node, depth) AS (
  SELECT id, id, 0 FROM objects WHERE user_id=$1 AND deleted_at IS NULL AND NOT ephemeral
  UNION ALL
  SELECT w.root, e.b, w.depth+1 FROM walk w JOIN edges e ON e.a = w.node
  WHERE w.depth < 6            -- 深度上限，防止大分量爆炸
)
SELECT root, count(DISTINCT node) AS component_size FROM walk GROUP BY root;
```

递归 CTE 的官方语义（含 `SEARCH BREADTH FIRST` / `CYCLE` 子句防环）见 [PostgreSQL 18 文档 7.8.2](https://www.postgresql.org/docs/current/queries-with.html)。**注意官方警告**：递归查询必须有终止条件，否则无限循环；图上要防止环，标准做法是用 `path` 数组 + `NOT is_cycle`，或直接用 `CYCLE id SET is_cycle USING path` 语法。

**⚠️ 性能现实**：递归 CTE 的最坏复杂度是 O(V·E)，在 **10 万节点 / 50 万边**下会非常慢。分级策略：
- 1 万条以内：递归 CTE 可以接受（秒级）。
- 10 万条：应把连通分量换成**物化的 `components(user_id, object_id, component_id, computed_at)` 表**，用 `igraph` 或 `graphology` 在 Node/Python 侧批量算完写回，只在增量时做局部更新（新增节点先自成一个分量，合并只发生在它引入新边时）。

**数据依赖**：够用。**建议补**：`objects.degree_cached` 或物化视图，避免每次都扫 `relations`。

**成本**：度数 O(E)，秒级；连通分量视实现，10 万条建议物化。

---

### A6. 跨领域连接

**判定：【确定性初筛 + LLM 终审】**

定义：两个对象分别挂在不同的 `domain` 子树下（沿 `parent_id` 递归找到根 domain），却高度相似。

算法（纯 SQL + 向量，零 LLM）：
1. 递归 CTE 给每个对象算 `root_domain_id`（沿 `parent_id` 上溯到 `kind='domain'`）。
2. pgvector 取每个对象的 top-k 近邻（k=10~20）。
3. 保留 `root_domain_id` 不同的对，且 `cosine >= τ`（τ 建议 0.7~0.78，比 `related()` 的 0.65 更严，因为跨域高分对更稀有也更可能是噪音）。
4. **排序信号（全部确定性）**：`cosine` × `1/log(1+两域的历史连接数)` —— 惩罚本来就联系紧密的领域对，突出"意外"连接。这个 IDF 式加权是零成本的"惊喜度"代理。
5. 只把 top-N（比如 20 条/周）交给 LLM 写一句话解释。

**数据依赖**：`parent_id`（有）+ `embeddings`（有）。**缺**：`root_domain_id` 的物化列 —— 建议直接加 `objects.root_domain_id text`，在写入时维护（父 chain 不变则 O(1)），比每次递归 CTE 便宜得多。

**成本**：初筛全在 SQL/向量层；LLM 只用 20 次/周。

---

### A7. 反复出现的主题

**判定：【纯确定性】（统计聚类 + c-TF-IDF 关键词），但"给主题起名"需要小模型或 LLM**

算法：聚类（HDBSCAN 或现有 k-means）→ 对每个簇算**簇级 TF-IDF（c-TF-IDF）**抽关键词。

这正是 BERTopic 的核心：`sentence-transformers → UMAP → HDBSCAN → c-TF-IDF`。且它在中文上可用（`BERTopic(language="multilingual")`），并原生支持 `topics_over_time()`（时间模式）和 `partial_fit()`（增量）。来源：[BERTopic GitHub](https://github.com/MaartenGr/BERTopic)、[BERTopic 论文 arXiv:2203.05794](https://arxiv.org/abs/2203.05794)

**但把 BERTopic 整个搬进 drill 是错的方向**（Python 依赖 + UMAP 的确定性差 + 全量重算）。drill 应该只取它的**两个可移植组件**：
- **HDBSCAN**（不用 UMAP 降维，直接在余弦距离矩阵上跑 `metric='precomputed'`；HDBSCAN 官方支持预计算距离矩阵输入）；
- **c-TF-IDF**（纯统计，20 行 SQL/TS 就能实现：`c-TF-IDF(t,c) = tf(t,c) × log(1 + A / f(t))`）。

**⚠️ 现有 `clusterVectors()` 的问题**：它是"最远种子 + 最近质心"，本质是 **k-means++ 式播种**（k-means++ 原始论文 [Arthur & Vassilvitskii, SODA 2007](https://dl.acm.org/doi/10.1145/1283383.1283494)），并且 **k 被硬编码为 ≤ 6**。对 10 万条笔记，6 个簇毫无解释力。且它强制所有点归属某簇，产生大量无意义的微小簇（`.filter(c => c.objects.length)` 把空簇丢掉，等于静默降低了 k）。

**改进路径（按投入排序）**：
1. **短期**：把 k 从 `min(6,...)` 放开到 `min(60, ...)`，并用 **cosine 距离 + 球形 k-means**（每轮对质心做 L2 归一化），避免高维下欧氏质心漂移到球心。
2. **中期**：换成 HDBSCAN 的 JS 移植，或物化成 Python 批处理（夜间跑一次，写回 `clusters` 表）。
3. **长期**：只给 LLM 簇的 c-TF-IDF top-10 词 + 3 条代表对象，让它起名 —— 每条主题名 1 次 LLM 调用，成本极低。

**数据依赖**：`embeddings` 够用。**建议补**：`clusters(user_id, cluster_id, label, centroid vector(1024), size, computed_at, params_hash)` 物化表 —— 否则每次请求都重聚类是灾难。

**成本**：10 万条 HDBSCAN 在 10 维数据上约在"喝杯咖啡"区间；1024 维需要先降维（见 §B.2）。**推荐降到 50 维再用余弦预计算矩阵**。

---

### A8. 知识缺口

**判定：【纯确定性】（图覆盖度 + 向量空间稀疏区）+ LLM 仅用于措辞**

三个确定性信号：

1. **二部图覆盖度**：tag × object 二分图里，某 tag 只有 1 个对象（"孤例 tag"）：
   ```sql
   SELECT tag, count(*) FROM object_tags
   WHERE user_id=$1 AND deleted_at IS NULL
   GROUP BY tag HAVING count(*) = 1;
   ```
2. **领域内部稀疏**：某 `domain` 下有 N 个对象，但其中 M 个是孤立的（A5 的度数 = 0）→ 覆盖率 `1 - M/N`。这是"我开了这个领域但没往里填东西"。
3. **向量空间空洞**：某领域质心与它的成员平均距离很大（内聚度低），或某两个高相关的领域（质心余弦 > 0.8）之间**没有任何 `relations` 边** —— 这是"应该连起来但没连"的缺口。
   ```sql
   SELECT a.id AS domain_a, b.id AS domain_b, 1 - (ca.centroid <=> cb.centroid) AS sim
   FROM topic_centroids ca JOIN topic_centroids cb ON ca.topic_key < cb.topic_key
   WHERE 1 - (ca.centroid <=> cb.centroid) > 0.8
     AND NOT EXISTS (SELECT 1 FROM relations r WHERE ...);  -- 两域间无边
   ```
4. **提问密度**：某领域内疑问句占比（A4）异常高 → 该领域是"想得多懂得少"。

**数据依赖**：`object_tags` / `relations` / `embeddings` 全都有。`topic_centroids` 需要新增（同 A3）。

**成本**：全部 SQL，秒级。

---

### A9. 行动未闭环

**判定：【纯确定性】**

这是整个清单里**最纯粹的 SQL 问题**（官方 kind 定义里 `action` 就带 `status` 枚举 `["todo","doing","blocked","done"]` 和 `due_at`，见 [003_kinds.sql](infra/sql/003_kinds.sql)）。

```sql
SELECT id, title, status, due_at, captured_at,
       (now_ms() - captured_at)/86400000.0 AS age_days
FROM objects
WHERE user_id=$1 AND kind='action' AND deleted_at IS NULL AND NOT ephemeral
  AND (status IS NULL OR status <> 'done')
  AND captured_at < $now - INTERVAL '30 days';
```

可以再算三个免费的比率（窗口函数）：
- **闭环率** = `done / total`，按月分组 → 趋势。
- **停滞率** = `doing` 状态停留超过 X 天（需 `versions` 表回溯状态变更历史，或用 `updated_at - captured_at` 近似）。
- **逾期率** = `due_at < now() AND status <> 'done'`。
- **僵尸行动**：`status='todo'` 但被 `relations` 引用了 ≥3 次（常被提及却从不推进）→ 这是个非常有意思的洞察，且纯图+SQL。

**数据依赖**：**完全够用，无需补任何数据。**

**成本**：单条 SQL + 索引（建议加 `objects(user_id, kind, status) WHERE deleted_at IS NULL` 部分索引）。

---

### A10. 时间模式（写作节律 / 情绪周期）

**判定：【纯确定性】（节律）；【小模型或词典】（情绪）**

**节律（零成本，纯 SQL）**：
```sql
SELECT date_trunc('day', to_timestamp(captured_at/1000)) AS d, count(*) AS n
FROM objects WHERE user_id=$1 AND deleted_at IS NULL AND NOT ephemeral
GROUP BY 1 ORDER BY 1;
```
由此可算：
- **间隔序列** `Δt_i`，然后算 **burstiness 参数 B**：
  `B = (σ_Δt − μ_Δt) / (σ_Δt + μ_Δt)`，取值 (−1, 1)。`B > 0` 是阵发式（bursty），`B ≈ 0` 是泊松随机，`B < 0` 是规整周期。原始的阵发性定义与"记忆系数" M 见 [Goh & Barabási, *Burstiness and memory in complex systems*, EPL 81:48002 (2008)](https://doi.org/10.1209/0295-5075/81/48002)。
- **间隔基尼系数**（写作投入的不均衡度）。
- **小时/星期直方图** → 找"黄金时段"。
- **沉默期检测**：连续 N 天无记录，且此前有高活跃度 → 这是"断更"信号，本身就是一个洞察。

**情绪（需小模型或词典）**：
- 词典法：中文情感词典（如 [大连理工情感词典](https://github.com/guotong1988/DUTIR_Sentiment_Lexicon) 系、NRC-VAD、SnowNLP）。**优点**：零推理成本、可解释。**缺点**：个人写作充满反讽与专业术语，词典法误判率很高，且**无法处理否定与程度副词**。
- 小模型：ONNX 化的中文情感分类器（如基于 RoBERTa/BERT 的 `uer/roberta-base-finetuned-jd-binary-chinese` 系列），CPU 单条几十毫秒，可批量。
- **强烈建议**：情绪周期是**最容易做出"看起来很酷但用户不信"的功能**。如果做，必须让用户能看到原文证据（点击某个"低谷日"能看到当天写了什么），并把情绪分数明确标为"词典/模型估计"而非事实。

**数据依赖**：时间段用 `captured_at`；情绪需要新增 `objects.sentiment_score real` + `sentiment_model text`（离线批量算好写回，不要在线算）。**注意 `captured_at` 是 bigint 毫秒**（schema 里是 `bigint`），SQL 里要 `to_timestamp(captured_at/1000)`。

**成本**：节律全 SQL；情绪一次性批处理。

---

### A11. 需要复习的遗忘点

**判定：【纯确定性】（若已有复习记录）；【启发式】（若没有）**

**如果有复习历史**：直接用 **FSRS**（Free Spaced Repetition Scheduler）。它基于 DSR 模型（Difficulty / Stability / Retrievability），三变量建模：
- Stability（存储强度）越高遗忘越慢；
- Retrievability（检索强度）越低越可能已遗忘；
- 三条记忆律：材料越复杂稳定性增幅越小；稳定性越高增幅越小（stabilization decay）；当前可检索性越低，复习带来的稳定性增幅越大（stabilization curve）。

来源：[open-spaced-repetition/free-spaced-repetition-scheduler](https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler)、[FSRS 算法 wiki](https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm)

**Node 侧直接用 `ts-fsrs`**（npm，最新 5.4.2，TypeScript 原生，支持 ESM/CJS/UMD）。来源：[npm: ts-fsrs](https://www.npmjs.com/package/ts-fsrs)

**⚠️ 关键前提**：FSRS 需要 `(card_id, rating, review_time)` 的复习日志。**drill 现在没有任何复习记录表**。所以：
- **补数据**：`reviews(user_id, object_id, rated_at, rating smallint, elapsed_days real, scheduled_days real, state text)`。没有它，FSRS 无从谈起。
- **无复习记录时的启发式替代（纯 SQL，零依赖）**：
  **"检索间隔 vs 主题活跃度"** —— 如果一条笔记所属主题最近很活跃（近 30 天有新笔记），但这条老笔记从没被再次触达（无新 `relations`、无编辑、无 placement 变化），它就是"被主题甩下的旧见解"。
  ```sql
  -- 主题活跃度
  WITH topic_activity AS (
    SELECT o.root_domain_id, max(o.captured_at) AS last_active, count(*) AS n
    FROM objects o WHERE o.user_id=$1 AND o.deleted_at IS NULL GROUP BY 1
  )
  SELECT o.id, o.title, o.captured_at,
         (ta.last_active - o.captured_at)/86400000.0 AS staleness_days
  FROM objects o JOIN topic_activity ta ON ta.root_domain_id = o.root_domain_id
  WHERE o.user_id=$1 AND o.kind IN ('distill','self')
    AND ta.n >= 5
    AND o.captured_at < ta.last_active - 90*86400000
    AND NOT EXISTS (SELECT 1 FROM relations r WHERE r.user_id=o.user_id
                    AND r.deleted_at IS NULL AND r.to_id = o.id AND r.created_at > o.captured_at);
  ```
  这个查询完全确定性，且对用户有直接价值。

**成本**：FSRS 计算是 O(1)/卡片；启发式是单条 SQL。

---

## 总表：洞察类型 × 检出方式 × 数据依赖 × 成本

| # | 洞察类型 | 检出方式 | 依赖的现有数据 | 需补的数据 | L0 纯 SQL | 10 万条可行性 |
|---|---|---|---|---|---|---|
| A1 | **重复/冗余** | 【纯确定性】hash → pg_trgm → 向量阈值 | `title`,`body`,`content_hash`,`embeddings`,`objects_trgm` 索引 | HNSW 索引 | ✅ | ✅ 索引后秒级 |
| A2 | **矛盾/张力** | 【确定初筛 + 小模型/LLM 终审】top-k 阻塞 → NLI 三分类 | `embeddings`,`applies_to`,`captured_at`,`body_blocks` | ★claims 原子断言表、★NLI 结果缓存表 | ⚠️ 仅候选 | ⚠️ 必须缓存 NLI 结果 |
| A3 | **信念漂移** | 【纯确定性】`supersedes_id`/`valid_until`/质心位移 | `supersedes_id`,`valid_until`,`versions`,`embeddings` | `topic_centroids` 物化表 | ✅ | ✅ 秒级 |
| A4 | **悬置想法** | 【纯确定性】疑问正则 + 出度=0 | `body`,`relations`,`captured_at`,`objects_trgm` | 无 | ✅ | ✅ <100ms |
| A5 | **孤立对象** | 【纯确定性】度数 / 连通分量 / k-core | `relations`,`parent_id` | 物化 `components` 表（大库） | ✅ 小库 | ⚠️ 递归 CTE 需物化 |
| A6 | **跨领域连接** | 【确定初筛 + LLM 措辞】root_domain 差异 + 向量高分 + IDF 加权 | `parent_id`,`embeddings`,`relations` | `root_domain_id` 列 | ✅ 初筛 | ✅ 需 HNSW |
| A7 | **反复出现的主题** | 【纯确定性聚类】+ c-TF-IDF；命名可 LLM | `embeddings`,`tags_cached` | `clusters` 物化表 | ⚠️ 聚类 | ⚠️ 需降维 + 物化 |
| A8 | **知识缺口** | 【纯确定性】tag 覆盖度 / 域内孤立率 / 质心空洞 + 无边 | `object_tags`,`relations`,`embeddings` | `topic_centroids`,`root_domain_id` | ✅ | ✅ 秒级 |
| A9 | **行动未闭环** | 【纯确定性】`status`/`due_at` + 图引用 | `kind`,`status`,`due_at`,`relations`,`versions` | 部分索引（可选） | ✅ | ✅ <50ms |
| A10 | **时间模式·节律** | 【纯确定性】间隔统计 + burstiness B + 直方图 | `captured_at` | 无 | ✅ | ✅ 秒级 |
| A10 | **时间模式·情绪** | 【小模型/词典】离线批量打分 | 无 | `sentiment_score` 列 | ❌ | ✅ 一次性批处理 |
| A11 | **遗忘点·有复习史** | 【纯确定性】FSRS | 无 | ★`reviews` 复习日志表 | ❌ | ✅ O(1)/卡片 |
| A11 | **遗忘点·无复习史** | 【纯确定性启发式】主题活跃度 vs 检索间隔 | `captured_at`,`relations` | `root_domain_id` | ✅ | ✅ 秒级 |

**统计**：12 类洞察中，**9 类可纯确定性完整检出**，2 类需"初筛+终审"，1 类（情绪周期）必须依赖模型。**"必须 LLM 才能发现"的洞察类型为 0** —— LLM 的角色应当只是**措辞与解释**，而不是发现。这个结论是整份报告最重要的一条。

---

## B. 具体算法、复杂度与库

### B.1 近重复检测

#### B.1.1 精确去重（O(n)，永远先做）
`sha256` 分组。drill 已有 `contentHash()`（`title + '\n' + body`），把它从"向量过期判定"扩展到"查重"是**零成本的收益**。注意它只覆盖 `title||body`，**不含 `body_blocks`**，结构化内容变化不会改 hash —— 这是个需要修的边界。

#### B.1.2 MinHash + LSH

**核心**：用 k 个独立哈希函数对集合做 `h_min(S) = min(h(perm(x)))`，则 `P(h_min(A) = h_min(B)) = J(A,B)`（Jaccard）。用 `y/k` 估计，期望误差 `O(1/√k)`；k=400 时误差 ≤ 0.05。

**LSH banding**：把 k 个签名分成 b 个 band、每 band r 行（`k = b·r`），任一 band 完全相同即成为候选。成为候选的概率是 S 曲线：
```
P(s) = 1 − (1 − s^r)^b
```
资料来源：[Wikipedia: MinHash](https://en.wikipedia.org/wiki/MinHash)（含 Broder 1997 原始引用与时间复杂度分析）

**复杂度**：签名计算 `O(n·k)`（many-hash 变体）或 `O(n)`（single-hash 变体，维护 k 个最小值的队列，实践中远快）。LSH 查询近似 `O(1)` 每 band。

**库**：[ekzhu/datasketch](https://github.com/ekzhu/datasketch)（Python）。含 `MinHash`、`Weighted MinHash`、`MinHashLSH`（Jaccard 阈值）、`LSHBloom`（内存更省的替代）、`MinHashLSHForest`（top-k）、`LSHEnsemble`（containment 阈值）。**⚠️ 2.0.0 起默认 permutation scheme 改成 `affine32`，哈希值与旧版不兼容，需要重建持久化的 sketch 与 LSH 索引**（或用 `scheme="legacy"`）。

**⚠️ 对 drill 的诚实结论：MinHash/LSH 在 10 万条规模下是过度工程。** 理由：
- 它的价值在于**十亿级**集合去重（web 规模、LAION 规模）。
- 10 万条笔记两两对比是 5×10⁹ 对，但 `pg_trgm` GIN 索引 + pgvector HNSW **已经把搜索复杂度从 O(n²) 降到近 O(n log n)**，而它们不需要引入 Python 或自己实现哈希族。
- MinHash 对**中文**还有一个额外问题：需要先分词才有"集合"，而 drill 没有中文分词（见 §B.6）。

**因此建议**：把 MinHash/LSH 记录为"10 万条以上再考虑"的备选，当前用 pg_trgm + pgvector 组合替代。

#### B.1.3 SimHash

**核心**（Charikar 2002）：对特征做随机超平面投影，取符号得到 f 位指纹，两指纹的 **Hamming 距离**近似夹角。来源：[Charikar, *Similarity estimation techniques from rounding algorithms*, STOC '02](https://dl.acm.org/doi/10.1145/509907.509965)

**已知弱点**：SimHash 对**短文本极其不稳定**（一条 30 字的笔记，任何一个词变化都会翻转大量 bit），且不像 MinHash 有清晰的"候选概率 = 相似度"的 S 曲线理论。对个人笔记这种**长短差异极大**的语料，MinHash 优于 SimHash，而**两者都不如直接上向量**。

**pgvector 里的等价物**：`binary_quantize(vec)` → `bit(1024)`，然后用 Hamming 距离 `<~>` 做速筛、再用原向量重排：
```sql
CREATE INDEX ON embeddings USING hnsw ((binary_quantize(vec)::bit(1024)) bit_hamming_ops);
SELECT * FROM (
  SELECT object_id FROM embeddings
  ORDER BY binary_quantize(vec)::bit(1024) <~> binary_quantize($1) LIMIT 50
) t JOIN embeddings e USING (object_id)
ORDER BY e.vec <=> $1 LIMIT 10;
```
来源：[pgvector README § Binary Quantization](https://github.com/pgvector/pgvector#binary-quantization)。**这是 SimHash 思路在 pgvector 里的原生、免维护版本** —— 而且它还兼作内存压缩（1024 维 float32 的 4 KB → 128 字节，**32 倍压缩**）。

#### B.1.4 Embedding 阈值 + 贪心去重 / SemDeDup

**SemDeDup 流程**（Abbas et al., arXiv:2303.09540）：
1. 用预训练模型算 embedding；
2. k-means 聚类；
3. 在每个簇内对每个点找 k 近邻；
4. **若与任一近邻的余弦相似度超过阈值，则判定为语义重复并删除**（保留先出现的/质量更高的一个）。

论文实证：在 LAION 子集上**删除 50% 数据而性能几乎不降**，训练时间减半，分布外性能反而上升；在 C4 上优于此前方法。来源：[SemDeDup, arXiv:2303.09540](https://arxiv.org/abs/2303.09540)

**复杂度**：k-means 为 `O(n·k·d·iter)`，簇内 k-NN 若暴力则 `O(Σ|C_i|²)`——这是该方法的隐藏成本。**在 pgvector 里可以完全规避**：直接用 HNSW 做 k-NN，复杂度降到近 `O(n log n)`。

**给 drill 的建议阈值**：
- 去重用 `cosine ≥ 0.90`（SemDeDup 的"语义重复"口径很严；0.90 保守但精准）；
- **聚类内聚度**用 `0.65~0.75`；
- **跨域连接**用 `0.70~0.78`；
- 现有 `related()` 的 `RELATED_THRESHOLD=0.65` 对"相关推荐"合理，**但不能直接复用到去重**——这是最容易犯的错误。

**⚠️ SemDeDup 的迁移陷阱**：论文的目标是**训练集去冗余**（删掉对梯度没有新贡献的样本）。个人知识库的目标是**帮用户发现自己重复劳动**——用户想要的不是"删掉"，而是"看，你第三次说同一件事了"。所以算法骨架可以借，**产品行为必须反过来**（去重结果应作为一条洞察展示，而不是静默删除）。

#### B.1.5 pg_trgm 的正确用法

| 函数/操作符 | 语义 | 用途 |
|---|---|---|
| `similarity(a,b)` | trigram Jaccard | 初筛打分 |
| `a % b` | `similarity > pg_trgm.similarity_threshold`（默认 0.3） | **走 GIN 索引的过滤条件** |
| `a <-> b` | `1 - similarity()` | 排序 |
| `word_similarity` / `<%` | 第一串 vs 第二串的**任一连续区间** | 找"笔记里的某段" |
| `strict_word_similarity` / `<<%` | 同上但按**词边界**切 | 更精确的子串匹配 |

来源：[pg_trgm 文档 F.35.2](https://www.postgresql.org/docs/current/pgtrgm.html)

**关键工程点**：`WHERE a % b` 能走 GIN，但 `ORDER BY a <-> b` 走 GiST 更优（官方原文："This can be implemented quite efficiently by GiST indexes, but not by GIN indexes"）。**所以如果要 top-k 近重复，应该建 GiST 索引**；如果要"找出所有相似度高过阈值的对"，用 GIN。drill 现在只有 GIN。

**⚠️ `pg_trgm` 与中文**：文档明说它"忽略非字母数字字符"。对纯中文串，trigram 是**字符级**的（`知识管理` → `" 知"`,`" 知识"`,`知识管`,`识管理`,`管理 "`），可用但是**语义噪声大**——它会把"知识管理"和"知识付费"判得很近。**建议中文场景只用它做粗筛，阈值调到 0.4+，精排一律用向量。**

---

### B.2 聚类

#### B.2.1 HDBSCAN

**核心**：对 DBSCAN 在**所有** epsilon 上求层次密度估计，再选"最稳定"的平坦切分（EOM, Excess of Mass）。因此**能处理密度差异极大的簇**（这正符合个人知识库：有几个超大领域 + 大量小而专的主题），且**主要参数只有 `min_cluster_size`**（直观）。它对噪声点显式标记为 `-1`——**对知识库这比 k-means 强得多**，因为孤立想法本来就该是"噪声"而不是被硬塞进某个簇。

来源：[hdbscan GitHub (scikit-learn-contrib)](https://github.com/scikit-learn-contrib/hdbscan)、[HDBSCAN* 论文 Campello, Moulavi & Sander, PAKDD 2013](https://link.springer.com/chapter/10.1007/978-3-642-37456-2_14)、[加速版 McInnes & Healy, ICDMW 2017](http://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=8215642)

**API 要点**：
- 支持 `metric='precomputed'` 传**距离矩阵**（`fit(X)` where X 是 `(n_samples, n_samples)`）—— 所以**可以直接喂余弦距离矩阵，不需要 UMAP 降维**。
- `min_cluster_size`（默认 5）、`min_samples`（默认等于 min_cluster_size）、`cluster_selection_method`（`'eom'` 或 `'leaf'`；`leaf` 给出更细更同质的簇）。
- `cluster_persistence_`：**每个簇的稳定性分数**——可以直接用来排序"哪些主题是真实的、哪些是巧合"。
- `outlier_scores_`（GLOSH 算法）：**免费得到异常点检测**。对知识库，"这条笔记和你所有其他笔记都不一样"本身就是一个洞察。
- `approximate_predict(new_points)`：**增量预测** —— 新笔记不重跑整个算法，而是按已拟合的簇结构分配（可在 `approximate_predict` 里得到 -1，即判为噪声）。需要 `prediction_data=True`。来源：[hdbscan API — prediction](https://hdbscan.readthedocs.io/en/latest/api.html)

**实测复杂度（作者官方 benchmark，10 维数据，8 GB RAM 笔记本）**：

| 数据量 | HDBSCAN | K-Means | DBSCAN | Fastcluster | Scipy Single Linkage |
|---|---|---|---|---|---|
| 32k | <30 s | <30 s | <30 s | <30 s | ~34 s |
| 100k | <30 s（"Interactive"列上限） | 秒级 | <30 s | <30 s | 内存墙 |
| 200k | 数秒~数十秒 | 秒级 | 数十秒 | 开始落后 | ❌ |

作者的结论原话：**"几乎不存在 HDBSCAN 处理不了的数据规模，除非真是天量；K-Means 效果明显更差，DBSCAN 更慢"**；并给出可直接跑的规模表（Interactive / Get Coffee / Over Lunch / Overnight）：HDBSCAN 在 **30 秒内可处理 10 万点**，**5 分钟内可处理 50 万点**。来源：[hdbscan 官方 Benchmarking Performance and Scaling](https://hdbscan.readthedocs.io/en/latest/performance_and_scalability.html)

**⚠️ 三个必须知道的限制**：
1. 上表是 **10 维**。1024 维下 KD-tree/Ball-tree 加速完全失效（维度灾难），会退化成接近 O(n²) 且内存爆炸。**必须降维或改用预计算的距离矩阵。**
2. 官方 benchmark 页明确警告：single-linkage 类实现用 `scipy.spatial.pdist` 生成 `n(n-1)/2` 的 double 距离数组，4.4 万点就要 **7.2 GB**。10 万点的完整距离矩阵是 **40 GB** —— **绝对不可行**。所以 precomputed 模式只适用于你不打算真的算完整矩阵的场景。
3. **正解**：不要用 HDBSCAN 消费全库。用 **pgvector HNSW 做 k-NN 图**，在稀疏 k-NN 图上跑社区发现（§B.2.4），或用 UMAP 降到 5~10 维后再跑 HDBSCAN（BERTopic 的路线）。

#### B.2.2 k-means / k-means++

**k-means++ 播种**（Arthur & Vassilvitskii, SODA 2007）：第一个中心均匀随机，之后每个中心以正比于 `D(x)²`（到最近已选中心的距离平方）的概率选取。给出 `O(log k)` 近似保证。来源：[Arthur & Vassilvitskii, *k-means++: The Advantages of Careful Seeding*, DOI 10.1145/1283383.1283494](https://dl.acm.org/doi/10.1145/1283383.1283494)

**这一步 drill 已经做对了**（贪心最远点播种是 k-means++ 的确定性近似，去掉了随机性，对"结果可复现"是加分项）。

**复杂度**：每轮 `O(n·k·d)`，通常 10~50 轮收敛 → `O(n·k·d·iter)`。10 万条 × k=60 × d=1024 × 20 轮 ≈ **1.2×10¹¹ 次运算** —— **在 Node 单线程里约 10 分钟**，不可交互。降维到 d=50 则约 30 秒，可接受。

**⚠️ k-means 在高维的三个致命问题**：
1. **欧氏距离在高维失效**：1024 维里所有点对的欧氏距离趋同（距离集中现象），质心失去区分度。
2. **质心漂移**：普通 k-means 的质心是算术平均，在 L2 归一化的向量上，平均会**移向球心**（范数变小），导致 `cosine(质心, 成员)` 系统性偏低。**必须用球形 k-means**：每轮更新后对质心做 L2 归一化。
3. **强制归属**：k-means 没有"噪声"概念，孤立点会被强行拉进最近的簇并把它拽偏。

**给 drill 的最小改动**：在 `clusterVectors()` 的分配循环后，把每个簇的质心算出来并 L2 归一化，再进入下一轮；同时把 k 从 6 放开。这是**10 行以内**的改动，能显著提升质量。

#### B.2.3 BERTopic（评估后建议不整体引入）

**流程**：`sentence-transformers` embedding → **UMAP** 降维 → **HDBSCAN** 聚类 → **c-TF-IDF** 抽关键词。模块化，任一步可换。中文可用（`language="multilingual"`）。

**有直接价值的能力**（对 A7/A10）：
- `.topics_over_time(docs, timestamps)` —— 主题随时间的演化，直接对应 A10 的"主题漂移"；
- `.partial_fit(doc)` —— **在线/增量**更新主题模型；
- `representation_model=OpenAI(...)` —— 只在这一步用 LLM 给主题命名；文档明确提示可以用 `KeyBERTInspired` 等**零 LLM** 的替代方案。

来源：[BERTopic GitHub](https://github.com/MaartenGr/BERTopic)、[BERTopic 论文 arXiv:2203.05794](https://arxiv.org/abs/2203.05794)、[BERTopic 算法说明](https://maartengr.github.io/BERTopic/algorithm/algorithm.html)

**为什么建议不整体引入**：
1. **Python 依赖**。drill 是 Node 单栈。为了主题建模引入一个 Python 服务 + sentence-transformers + UMAP + HDBSCAN，运维成本远超收益。
2. **UMAP 不确定且不可增量**。UMAP 是随机投影 + 优化，同一数据两次运行结果不同；且一旦加一条新笔记，整个嵌入空间会变 —— 已存的 umap 坐标全部作废。这对"用户的画布位置"是灾难（`placements` 会漂移）。
3. **它自己就用了 bge-m3 级别的 embedding**，而 drill **已经有** bge-m3 向量。

**应该移植的两个组件**：
- **c-TF-IDF**（纯统计，可 20 行实现）：
  `c-TF-IDF(t, c) = tf(t,c) × log(1 + A / f(t))`，其中 `tf(t,c)` 是词 t 在簇 c 内的频次，`f(t)` 是词 t 在所有簇中的频次，`A` 是每簇平均词数。**这个公式不需要任何模型**，且它是"反复出现的主题"这类洞察最核心的可解释性来源。
- **Dynamic Topic Modeling 的思路**（按时间窗分桶算主题词分布，比较相邻窗口）。

**中文的词怎么办？** c-TF-IDF 需要词。两条路（见 §B.6）：装 `zhparser`/`pg_jieba`，或用 bigram 作为伪词（drill 的 `lexicalScore` 已经隐含这个思路）。

#### B.2.4 社区发现：Louvain / Leiden（推荐路线）

对知识图谱这种**稀疏图**（10 万节点 / 50 万边），社区发现比在稠密向量空间里聚类**更快也更贴合"连接"的语义**。

**Louvain**（Blondel et al. 2008）：两阶段迭代 —— （1）每个节点贪心移动到使**模块度**增益最大的邻居社区；（2）把社区收缩成超级节点，重复。复杂度经验上是 **O(E)** 每轮（文档：graphology 实现 "run time is bounded by the number of edges"）。来源：[Blondel et al., *Fast unfolding of communities in large networks*, J. Stat. Mech. (2008) P10008, arXiv:0803.0476](https://arxiv.org/pdf/0803.0476.pdf)

**Louvain 的著名缺陷**：可能产生**内部不连通**的社区（节点被分到远处，只因为模块度略高），以及**分辨率极限**（小社区被大社区吞并）。

**Leiden**（Traag, Waltman & van Eck 2019）：三阶段，关键改进是**在收缩前先做 refinement**，保证所有社区**内部连通**；同时提供**分辨率参数 γ** 控制粒度，并有 CP（Constant Potts）目标函数避免分辨率极限。来源：[Traag et al., *From Louvain to Leiden: guaranteeing well-connected communities*, Sci. Rep. 9:5233 (2019), arXiv:1810.08473](https://arxiv.org/abs/1810.08473)

**Node.js 可选库（这是本节最实用的部分）**：

| 库 | 算法 | Node 可用性 |
|---|---|---|
| [`graphology`](https://www.npmjs.com/package/graphology) (0.26.0) + [`graphology-communities-louvain`](https://www.npmjs.com/package/graphology-communities-louvain) (2.0.2) | Louvain | ✅ **纯 JS，零编译** |
| `igraph` (C core + Python/R interfaces) | Louvain, Leiden, 中心性, 连通分量 | ❌ 无官方 Node 绑定 |
| `networkx` (`louvain_communities`) | Louvain | ❌ Python only |
| `graspologic` | Leiden | ❌ Python only |
| `leidenalg` + `igraph` | Leiden | ❌ Python only |

`graphology-communities-louvain` 的 API 与实测：
```js
import louvain from 'graphology-communities-louvain';
const communities = louvain(graph);              // 返回 node→community 映射
louvain.assign(graph);                           // 直接写 node attribute
const details = louvain.detailed(graph);         // {communities, count, modularity, dendrogram, ...}
louvain.assign(graph, { resolution: 0.8 });      // resolution 越大社区越多
```
官方 benchmark：**1000 节点 / 9724 边的图，52.7 ms，找到 8 个社区**。线性外推到 10 万节点 / 100 万边 ≈ **5 秒量级**。来源：[graphology-communities-louvain README](https://github.com/graphology/graphology/blob/master/src/communities-louvain/README.md)

**⚠️ 没有 Node 版 Leiden**。这是本报告里一个必须明确的缺口。三个应对：
1. **接受 Louvain + 后处理**：用 `graphology` 算 Louvain，然后对每个社区做一次**连通分量检查**（BFS，O(V+E)），把不连通的社区拆开。这以很小的成本补上了 Louvain 最大的缺陷。
2. **只在离线批处理里用 Leiden**（Python 脚本，夜间跑，结果写回 Postgres）。图上不需要 umap 那种"每次结果都变"的不确定性，Leiden 结果稳定，适合物化。
3. **不用图库，用 SQL 做连通分量**（§A5 的递归 CTE）—— 只解决"连通性"，不解决"社区划分"。

**推荐**：方案 1 用于在线/增量，方案 2 用于夜间全量重算。

---

### B.3 矛盾检测：把 O(n²) 压到可算

#### B.3.1 候选生成是全部的关键

| 策略 | 候选对数（n=10 万） | 说明 |
|---|---|---|
| 全配对 | 5×10⁹ | ❌ 不可行 |
| 同 tag/同 domain 内配对 | 取决于分布，通常 10⁶~10⁷ | ⚠️ 仍太多 |
| **pgvector top-k 近邻（k=10）** | **10⁶** | ✅ 标准做法 |
| top-k + 同 `applies_to` + 时间邻近（±180 天） | **10³~10⁴** | ✅ 实际进 NLI 的量 |
| 句级全对（每篇 20 句，句子对） | 4×10¹¹ | ❌ 必须靠上面的文档级先筛 |

**句级只在候选文档内部展开**：一旦确定 (docA, docB) 是候选，就只在这两篇之间做 `sentences(A) × sentences(B)` 的 NLI。每篇 20 句 → 400 对/文档对。1000 个候选文档对 → **4×10⁵ 次 NLI 调用**。CPU 上单次 base 模型推理约 **50~200 ms**（实际取决于句子长度与批大小）→ **5.5~22 小时**。

**这在 CPU 上是不可接受的。** 必须再压：
- 候选文档对只保留**矛盾先验最高**的（同一 `applies_to`、同一 topic、时间跨度大）；目标 **100~200 个文档对/周**；
- 或换 `multilingual-MiniLMv2-L6`（110M，约 base 的 1/3 计算量）；
- 或用 ONNX Runtime + 批处理 + 量化。
- **无论如何都必须缓存**：`nli_results(from, to, from_block, to_block, label, score, model, content_hash)`。`content_hash` 变了才重算——这与 drill 现有的 `contentHash()` 思路完全一致，直接复用。

#### B.3.2 矛盾 vs 张力 vs 补充的判别规则（可落地的三分类）

在 NLI 输出的三分类（entailment / neutral / contradiction）之上，用**相似度**做联合判别：

| 相似度 | NLI 标签 | 判定 |
|---|---|---|
| 高 | contradiction | **矛盾**（硬冲突，值得立即呈现） |
| 高 | entailment | **重复/补充**（A1 处理，或合并） |
| 高 | neutral | **张力候选** ← 这是"A2 张力"的唯一来源 |
| 低 | 任意 | 无关，丢弃 |

**"高相似 + neutral"为什么是张力**：两条陈述说的是同一件事（向量很近），但 NLI 无法判定谁蕴含谁、也不互相矛盾 —— 这正是"两种都成立但结论不同的视角"的形式化特征。

**进一步降噪（确定性）**：
- **否定词/反义标记**：中文否定词表（不、没、无、非、未、别、莫、勿）+ 反义对（增加/减少、开放/封闭、集中/分散）出现在一条而不在另一条时，提高矛盾先验。
- **数值/时间冲突**：两条陈述含不同的具体数字或日期，且指向同一实体 → 强矛盾信号。**这个可以用正则 + 数字抽取纯确定性实现**，且准确率远高于 NLI。**强烈建议先做这个**：数值矛盾是个人笔记里最常见的真实矛盾（"我每天写 500 字" vs "我每天写 2000 字"），而 NLI 对数字不敏感。
- **`applies_to` 不同则不判矛盾**：两条 `self` 判断如果适用范围不同（一个"学习方式"一个"工作节奏"），它们不构成矛盾，只构成"张力"。这是 drill **已经有**的字段，且是免费的高质量约束。

#### B.3.3 `supersedes_id` 与 `valid_until` 应优先于一切自动检测

这是本节最重要的工程原则：**显式声明永远优于模型推断。**

产品设计上应该：
1. 把"这条取代了那条"做成**低成本的一键操作**（比如从"矛盾"洞察卡片里一键 "标记为新判断"，自动写 `supersedes_id` + 给旧的写 `valid_until`）。
2. 一旦有了显式链，**自动 NLI 检测的优先级应当下调**（已经被显式取代的对象，不需要再报矛盾）。
3. `valid_until` 到期的对象应该主动浮出（"你说这个判断 3 个月前失效了，现在怎么看？"）—— **这完全是 SQL，零模型，且是产品上最有价值的一类洞察**。

---

### B.4 时间漂移与变点检测

#### B.4.1 Embedding 位移 / 速度（零 LLM）

**定义**（把 `topic_centroids` 按时间序列排好后）：

- **位移速度** `v_t = ‖c_{t+1} − c_t‖₂`（欧氏）或 `1 − cos(c_{t+1}, c_t)`（角度）；
- **累计漂移** `D_T = ‖c_T − c_0‖₂`；
- **漂移方向** 把 `c_{t+1} − c_t` 与某"目标向量"（比如该领域最新的 10 条笔记的质心）做余弦，判断漂移是"走向成熟"还是"走偏了"。

**复杂度**：算完质心后是 `O(T·d)`，T 是时间窗数（月 → 36 个），完全免费。**唯一成本是质心的物化**（`AVG(vector)` 在 pgvector 里有原生支持）。

#### B.4.2 变点检测

**PELT**（Pruned Exact Linear Time，Killick et al. 2012）：在惩罚项为线性时，剪枝后期望复杂度 **O(n)**（最坏 O(n²)），比最优分割法（Optimal Partitioning, O(n²)）快得多。核函数 `model="rbf"` 是常用的非参数选择。

**`ruptures` 库**（Python，BSD-2）：
```python
import ruptures as rpt
algo = rpt.Pelt(model="rbf").fit(signal)
result = algo.predict(pen=10)
```
来源：[deepcharles/ruptures GitHub](https://github.com/deepcharles/ruptures)、[ruptures 文档](https://centre-borelli.github.io/ruptures-docs/)、方法论综述 [Truong, Oudre & Vayatis, *Selective review of offline change point detection methods*, Signal Processing 167:107299 (2020)](https://doi.org/10.1016/j.sigpro.2019.107299)

**`pen` 怎么选**：官方示例用 `pen=10`。实践中的确定性做法是**用 BIC 或"肘部法"扫描 `pen`**，选变点数随 pen 变化曲线上的拐点。**不要拍脑袋定 pen** —— 这是变点检测最常见的错误来源。

**⚠️ 对 drill 的现实约束**：`ruptures` 是 Python。但漂移序列通常只有 **12~60 个点**（月度/周度质心），此时：
- **纯 SQL/JS 完全够用**：一个 60 点的序列，用 JS 写一个 O(n²) 的精确最优分割（动态规划）是**几毫秒**的事，不需要 Python。
- 也可以用极简的确定性替代：**滑动窗口均值比** —— `mean(c[t..t+w]) − mean(c[t-w..t])` 超过 k 倍标准差即为变点。这个方法零依赖、可解释、参数直观，对 60 点的序列效果与 PELT 差别不大。

**结论**：**不要为变点检测引入 Python。** 在 12~60 点的尺度上，手写 DP 或滑窗法足够，且避免了跨语言运维。

#### B.4.3 时间序列特征（全部纯 SQL）

来源（阵发性）：[Goh & Barabási, *Burstiness and memory in complex systems*, EPL 81:48002 (2008)](https://doi.org/10.1209/0295-5075/81/48002)

| 特征 | 公式 | SQL |
|---|---|---|
| 间隔序列 | `Δt_i = t_{i+1} − t_i` | `lag(captured_at) OVER (ORDER BY captured_at)` |
| burstiness B | `(σ − μ)/(σ + μ)` | `(stddev_samp - avg)/(stddev_samp + avg)` over `Δt` |
| 记忆系数 M | `Δt_{i+1}` 与 `Δt_i` 的 Pearson 相关 | `corr(lag(Δt), Δt) OVER (...)` |
| 基尼系数 | 间隔分布不均衡度 | 窗口函数排序后求和 |
| 小时/星期直方图 | — | `extract(hour from to_timestamp(captured_at/1000))` |
| 沉默期 | 连续 N 天无记录 | `lag` + 阈值 |

**Postgres 原生能力**：`lag()` / `lead()` / `stddev_samp` / `corr` / `date_trunc` / `generate_series`（补全没有记录的日期，避免"空日不出现"导致统计偏差——**这是最容易踩的坑**）。来源：[PostgreSQL 窗口函数](https://www.postgresql.org/docs/current/functions-window.html)

---

### B.5 主题与关键词

| 方法 | 复杂度 | 中文 | LLM | 评价 |
|---|---|---|---|---|
| **TF-IDF** | `O(n·d)` 词频 + `O(V log V)` 排序 | 需分词 | ❌ | 基线，快，可解释 |
| **c-TF-IDF**（簇级） | `O(n·d)` | 需分词 | ❌ | **BERTopic 的核心，推荐** |
| **TextRank** | `O(E·iter)`（图上 PageRank 变体） | 需分词 | ❌ | 关键词 + 摘要句抽取；对短文本不稳 |
| **pg_trgm + 正则** | 走 GIN | ✅ 免分词 | ❌ | 粗筛用 |
| **LLM 抽取** | 1 次调用/文档 | ✅ | ✅ | 质量最高，**但 10 万条按每条 1 次调用是灾难** |

**成本对比（关键决策依据）**：
- 单条笔记走 LLM 抽关键词：10 万条 × 1 次调用，即使每次只要 0.0002 美元也要 20 美元，且延迟以小时计。**要做就必须先聚类，只对簇的代表对象调用**（簇数 ~100 → 100 次调用）。
- c-TF-IDF：纯 CPU，10 万条 **1~3 秒**，零成本，可无限重算。
- **结论**：**关键词抽取一律走 c-TF-IDF，LLM 只用于给最终簇名润色。**

---

### B.6 中文分词（一个被忽略的前置依赖）

`objects.search_vector tsvector` 已存在，但**Postgres 内置的全文检索配置对中文无效**（`english`/`simple` 都不切中文词）。三个选项：

| 方案 | 说明 | 来源 |
|---|---|---|
| **`zhparser`** | 基于 SCWS 的 PG 扩展。`CREATE EXTENSION zhparser; CREATE TEXT SEARCH CONFIGURATION testzhcfg (PARSER = zhparser); ALTER TEXT SEARCH CONFIGURATION testzhcfg ADD MAPPING FOR n,v,a,i,e,l WITH simple;` | [amutu/zhparser](https://github.com/amutu/zhparser) |
| **`pg_jieba`** | 基于 cppjieba。需要 C++11 (gcc 4.8+) 编译 | [jaiminpan/pg_jieba](https://github.com/jaiminpan/pg_jieba) |
| **不装扩展** | 用 `lexicalScore` 的 bigram 思路（中文 bigram 是**出奇有效**的免分词方案），配合 `pg_trgm` GIN | — |

**给 drill 的建议**：**先不要装扩展。** 理由：
1. 自托管意味着用户要在自己的 Postgres 上装 C 扩展，`zhparser`/`pg_jieba` 都要编译，`pg_jieba` 还需要 C++11 工具链，与"开箱即用"冲突。
2. **中文 bigram 检索的效果相当好**（`知识管理` → `知识`/`识管`/`管理`），且在语料 < 10 万条时，用 `pg_trgm` 的 GIN 索引可以走通。
3. c-TF-IDF 需要"词"，但 **bigram 可以当伪词用**——主题关键词会变成"知识/识管/管理"这种碎片，可读性差但聚类效果不受影响。若在意可读性，可以在展示层做一次轻量切分，或**只对最终展示的 100 个簇的代表对象**调用一次 LLM 来生成规范关键词。

---

### B.7 pgvector 与 Postgres 原生能力的完整用法

#### B.7.1 距离操作符

| 操作符 | 含义 |
|---|---|
| `<->` | L2 距离 |
| `<#>` | **负**内积（Postgres 只支持 ASC 索引扫描，所以返回负值） |
| `<=>` | **余弦距离**（`1 - 余弦相似度`） |
| `<+>` | L1 距离 |
| `<~>` | Hamming（bit 向量） |
| `<%>` | Jaccard（bit 向量） |

**drill 的 `cosine()` 等价于 `1 - (a <=> b)`**。来源：[pgvector README § Querying](https://github.com/pgvector/pgvector#querying)

#### B.7.2 索引类型对比

| | HNSW | IVFFlat |
|---|---|---|
| 查询性能 | 更好（speed-recall 权衡更优） | 较差 |
| 构建时间 | 更慢 | 更快 |
| 内存 | 更多 | 更少 |
| 能否无数据建索引 | ✅ 无训练步骤 | ❌ 必须先有数据 |
| 关键参数 | `m`（默认 **16**）、`ef_construction`（默认 **64**） | `lists`：≤1M 行用 **rows/1000**，>1M 行用 **sqrt(rows)** |
| 查询参数 | `SET hnsw.ef_search = 100`（默认 **40**） | `SET ivfflat.probes = 10`（默认 **1**，建议 sqrt(lists)） |

来源：[pgvector README § HNSW](https://github.com/pgvector/pgvector#hnsw)、[§ IVFFlat](https://github.com/pgvector/pgvector#ivfflat)

**drill 的 1024 维 bge-m3 向量语法**：
```sql
CREATE INDEX CONCURRENTLY embeddings_hnsw_cos
  ON embeddings USING hnsw (vec vector_cosine_ops)
  WITH (m = 16, ef_construction = 64)
  WHERE model = 'BAAI/bge-m3';
```

**索引到底值不值得建？** 关键数字：pgvector 官方明确说明 **"By default, pgvector performs exact nearest neighbor search, which provides perfect recall"**，索引是用召回换速度。

粗算（1024 维，float32）：
- 精确扫描 10 万条一次 k-NN：读 400 MB 向量 + 1 亿次乘加 → Node/Postgres 单核约 **0.1~1 秒**。
- HNSW 扫描：约 **1~10 ms**（快 2 个数量级）。

**结论：10 万条这个规模，索引依然强烈值得建**，因为：
1. 洞察流水线需要**反复**做 k-NN（A2 候选生成、A6 跨域、A1 语义去重、A7 聚类），不是一次查询；
2. 每建一次 HNSW 索引的内存开销 = 向量本身 + 图边。1024 维 float32 的 10 万条 = 400 MB，HNSW 的 `m=16` 大约再加 **~50%**（每节点 16×2 层边），总 **~600 MB** —— 自托管机器完全承受得起；
3. 若内存紧张，用 `halfvec`（半精度，**内存减半**，支持到 4000 维）；若还要更省，用 `binary_quantize` 做 HNSW 索引 + 原向量重排（**32 倍压缩**）。

**官方原文建议**：`maintenance_work_mem` 要够大（graph 装不下会显示 NOTICE 并显著变慢），建索引时可以用 `SET max_parallel_maintenance_workers = 7` 加速；生产环境用 `CREATE INDEX CONCURRENTLY`；**先加载数据再建索引**。

#### B.7.3 带过滤的 k-NN（这是 drill 最需要的）

官方明确警告：**近似索引的过滤是"先扫索引后过滤"**。如果条件命中 10% 的行，HNSW 默认 `ef_search=40` 时平均只会有 **4 行**通过过滤 —— 严重不足。

**解法（pgvector 0.8.0+）**：**iterative index scans**
```sql
SET hnsw.iterative_scan = relaxed_order;   -- 或 strict_order
SET hnsw.max_scan_tuples = 20000;          -- HNSW 默认上限
-- 或 SET ivfflat.max_probes = ...
```
`relaxed_order` 召回更好，但结果不严格按距离排序；要严格排序就用物化 CTE：
```sql
WITH relaxed AS MATERIALIZED (
  SELECT id, vec <=> $1 AS distance FROM embeddings
  WHERE user_id = $2 AND model = 'BAAI/bge-m3'
  ORDER BY distance LIMIT 10
) SELECT * FROM relaxed ORDER BY distance + 0;   -- Postgres 17+ 需要 +0
```
来源：[pgvector README § Iterative Index Scans](https://github.com/pgvector/pgvector#iterative-index-scans)

**这对 drill 至关重要**：所有洞察查询都必须带 `WHERE user_id = $1 AND deleted_at IS NULL AND NOT ephemeral`，也就是**永远在过滤**。不开 `iterative_scan`，HNSW 索引会给出错误的结果数（返回不足 k 条），而**这个 bug 是静默的**。

#### B.7.4 该用哪些 Postgres 原生能力

| 需求 | Postgres 原生方案 | 复杂度 |
|---|---|---|
| 精确去重 | `GROUP BY content_hash HAVING count(*)>1` | O(n) |
| 近似文本相似 | `pg_trgm` `%`（GIN）或 `<->`（GiST） | O(n log n) |
| 全文检索 | `tsvector` + `ts_rank_cd`（中文需扩展，见 B.6） | O(log n) |
| 向量 k-NN | pgvector `<=>` + HNSW | ~O(log n) |
| 向量聚合（质心） | `AVG(embedding)` / `GROUP BY` | O(n·d) |
| 图度数 | 子查询 `count(*)` on `relations_from/to` | O(deg) |
| 连通分量 | **递归 CTE** + `CYCLE ... SET ... USING path` | 最坏 O(V·E)，大库需物化 |
| Tag 覆盖度 | `GROUP BY tag HAVING count(*)=1` | O(n) |
| 时间间隔 | `lag() OVER (ORDER BY captured_at)` | O(n log n) |
| 时间序列补全 | `generate_series` LEFT JOIN | O(T) |
| 行动闭环 | `WHERE status <> 'done' AND due_at < now()` | O(log n) |
| 窗口统计 | `stddev_samp`, `avg`, `corr`, `percentile_cont` | O(n) |

---

### B.8 冷启动与增量更新

**总原则**：**把每条新笔记的成本分成"本地洞察"（O(1) 或 O(log n)）和"全局洞察"（需要重算）两类。**

| 洞察 | 新增 1 条笔记后 | 增量可行性 |
|---|---|---|
| A1 重复（hash） | 只需查新笔记的 hash 是否已存在 | ✅ O(1) |
| A1 重复（文本/向量） | 用 HNSW 查新笔记的 k 近邻 | ✅ O(log n) |
| A2 矛盾候选 | 查新笔记 top-k 近邻 → 标记候选对 | ✅ 只新增候选对 |
| A2 NLI 判定 | 只对新候选对跑 NLI + 按 `content_hash` 缓存 | ✅ 只算新增对 |
| A3 漂移（显式） | `supersedes_id`/`valid_until` 是本地字段 | ✅ O(1) |
| A3 漂移（质心） | 只需更新新笔记所属 `(topic, period)` 的质心 | ✅ O(d) 增量更新 |
| A4 悬置想法 | 新笔记自身 + 它的边；**但一条新笔记可能"回答"了旧问题** → 需重扫"含疑问且出度 0"的集合 | ⚠️ 半增量 |
| A5 孤立对象 | 新笔记度数 = 0 则孤立；可能让别的对象不再孤立 | ✅ 只检查新笔记的邻居 |
| A5 连通分量 | **需要合并分量** → 并查集（Union-Find）天然增量，O(α(n)) | ✅ 用并查集 |
| A6 跨域连接 | 新笔记的 top-k 近邻里找不同 `root_domain` 的 | ✅ O(log n) |
| A7 聚类/主题 | **簇结构和质心会变**。HDBSCAN 可用 `approximate_predict`；k-means 可直接归到最近质心 | ⚠️ 分配可增量，质心需周期性重算 |
| A8 知识缺口 | tag 计数是增量的；质心空洞随质心更新 | ✅ O(1) + 周期性质心 |
| A9 行动闭环 | 本地状态字段 | ✅ O(1) |
| A10 时间模式 | 只需把新点追加到间隔序列，增量更新 μ/σ | ✅ O(1) |
| A11 遗忘点 | `reviews` 追加一条；FSRS 单卡 O(1) | ✅ O(1) |

**结论：14 个洞察中有 12 个可以做到严格增量。** 只有 A7（聚类）和 A4（新笔记回答旧问题）需要周期性全局重算。

**推荐的调度**：
- **每条写入时（同步，<100ms）**：A9 行动闭环、A1 hash 查重、A3 显式漂移、A10 时间统计、A11 FSRS。
- **每次写入后（异步，<2s）**：A1/A2/A6 的 k-NN 候选生成、A5 度数、A4 正则扫描、A8 tag 计数。
- **每小时/每日（批处理）**：质心更新、A2 的 NLI 判定（对累积的候选对）、A7 聚类与 c-TF-IDF、A8 质心空洞。
- **每周（批处理）**：全量社区发现（Louvain + 连通性修复）、变点检测、LLM 措辞（只对 top-N 洞察）。

**冷启动**（首次导入 N 条笔记）：
- L0 层（A1 hash、A4、A9、A10）是纯 SQL，10 万条 **数秒内**完成。
- 向量层需要先跑 `/search/reindex`（现有端点，[http.ts:253-266](packages/server/src/http.ts#L253-L266)），**batch=8/次** —— 10 万条要 **12500 次 HTTP 往返**。这是冷启动的主要瓶颈，**建议把 batch 提到 64~256**（embedding 服务通常支持批量），可把往返降到 400~1500 次。
- 聚类/社区发现：分钟级，一次性。

---

## C. 成本阶梯：推荐的分层流水线

```
┌─ L0 纯 SQL / 统计 ──────────────── 免费，1~100 ms ─────────────────┐
│  A1(hash) A3(显式) A4 A5(度数) A8(tag) A9 A10(节律) A11(启发式)   │
│  工具：Postgres 窗口函数 / 递归 CTE / pg_trgm GIN / 部分索引        │
│  → 12 类洞察中的 7 类可以【完全在这一层结案】                       │
└───────────────────────────────────────────────────────────────────┘
                              ↓ 只有需要语义的地方才下沉
┌─ L1 向量 / 图算法（本地 CPU）───── 免费，1~60 s ───────────────────┐
│  A1(语义) A3(质心漂移) A5(分量) A6(初筛) A7(聚类) A8(质心空洞)     │
│  工具：pgvector HNSW / binary_quantize / graphology-louvain        │
│        / 球形 k-means / c-TF-IDF / 并查集                          │
│  → 再加 3 类结案；剩下 2 类得到"候选集"                             │
│  ⚠️ 关键：全部在 Postgres 内完成，不要把向量拉到 Node               │
└───────────────────────────────────────────────────────────────────┘
                              ↓ 只有候选对才下沉
┌─ L2 小模型分类（本地 ONNX / CPU）── ~$0，100 ms ~ 分钟 ────────────┐
│  A2(NLI 三分类) A10(情绪打分)                                      │
│  工具：mDeBERTa-v3-base-mnli-xnli(zh 0.8116) / MiniLMv2-L6(更快)   │
│        / ONNX Runtime / 批处理 + 量化                              │
│  ⚠️ 必须按 content_hash 缓存结果；每对只算一次                      │
│  → 矛盾与张力在这一层结案                                           │
└───────────────────────────────────────────────────────────────────┘
                              ↓ 只有 top-N 才下沉
┌─ L3 强模型综合成文 ─────────────── 付费，2~45 s/次 ────────────────┐
│  只做三件事：① 给主题/簇起名 ② 把已确认的洞察写成一句话 ③ 用户主动  │
│  请求的综合。绝不用于"发现"。                                       │
│  工具：现有 modelJSON()（OpenAI 兼容，[intelligence.ts:20-27]）     │
│  预算：≤ 20 次/周 × 1 次 ≈ 每月个位数美元                           │
└───────────────────────────────────────────────────────────────────┘
```

### C.1 各层成本与延迟量级

| 层 | 单次成本 | 延迟 | 10 万条全量 | 依赖 |
|---|---|---|---|---|
| **L0** | **$0** | 1~100 ms | 数秒 | 只有 Postgres |
| **L1** | **$0**（本地 CPU） | 1 ms（HNSW k-NN）~ 60 s（全量聚类） | 分钟级 | pgvector 索引 + 一次性批处理 |
| **L2** | **~$0**（本地 CPU） | 50~200 ms/句对 | 数小时（**必须靠候选集压到 10³~10⁴ 对**） | ONNX 模型 + 结果缓存 |
| **L3** | 约 **$0.0002~0.02/次**（视模型与长度；现有实现上限 1800 输出 token） | 2~45 s（`AbortSignal.timeout(45000)`） | **不做全量** | 现有 `modelJSON()` |

### C.2 什么时候该停下来不用 LLM

**五条硬规则**（按重要性排序）：

1. **能用 SQL 表达的判断，绝不用 LLM。**
   判据：如果你能用一句话写出 WHERE 条件，就用 SQL。`status <> 'done'`、`valid_until < now()`、`count(*) = 1`、`out_degree = 0` —— 这些没有一处需要模型。

2. **LLM 的输出必须能被算法的输出验证或约束。**
   例：LLM 说"这构成矛盾"，那么先在 L1 检查这对话相似度是否 > 0.7 且 `applies_to` 是否相容；不满足就直接丢弃。**这能砍掉大部分幻觉。**

3. **只对已排序的 top-N 调用 LLM。**
   L1/L2 的职责是**排序**（谁最值得看），LLM 的职责是**措辞**（把它说清楚）。如果一个洞察在 L1 里排不进前 20，它就不该触发一次 LLM 调用。

4. **同一输入永远不调用两次。**
   用 `content_hash` 做 LLM 结果的缓存键。drill 已有 `contentHash()`（[intelligence.ts:74](packages/server/src/intelligence.ts#L74)），直接复用。**这是把 LLM 成本变成常数的唯一办法。**

5. **当洞察的"发现"不依赖世界知识时，不用 LLM。**
   孤立对象、悬置问题、未闭环行动、重复、时间节律 —— 这些完全是**关于用户自己数据的结构性质**，模型不提供任何额外信息。LLM 在这里唯一的作用是把结果写得好听一点，而那是**一次性的、可缓存的**。

**反过来说，什么时候必须用 LLM**：
- 判断两条陈述是否"逻辑冲突但都合理"（张力）—— 需要世界知识与语用推理；
- 把一堆关键词组织成一句人类可读的洞察；
- 用户主动发起的开放式综合（现有 `/insight` 端点，[http.ts:237-251](packages/server/src/http.ts#L237-L251)）。

**注意现有 `/insight` 的实现有一个设计问题**：它把最多 24 个对象的正文（每个截断到 3000 字）一次性塞给 LLM，即最大 **72,000 字**的上下文。这是**最贵且最慢**的调用方式，而且它让 LLM 承担了"发现"的职责——恰恰是本报告认为最不该交给 LLM 的部分。**建议改为**：L1 先算出候选洞察（带对象 ID 和结构证据），再把**已经确定的洞察**（而不是原始正文全集）交给 LLM 措辞。

---

## D. 对 drill 的落地建议

### D.1 先做什么（按 ROI 排序）

#### 第 0 优先：修掉"全量拉到内存"这个公共瓶颈

**这是所有其他优化生效的前提。** 现状（[repository.ts:169-180](packages/server/src/repository.ts#L169-L180)）用 `vec::text` + `JSON.parse` 把全部向量搬进 Node。

三处具体改动：
1. **建 HNSW 索引**（一条 DDL，成本最低、收益最大）：
   ```sql
   CREATE INDEX CONCURRENTLY embeddings_hnsw_cos
     ON embeddings USING hnsw (vec vector_cosine_ops)
     WITH (m = 16, ef_construction = 64);
   ```
2. **把 `related()` 改成 SQL**（[intelligence.ts:28-41](packages/server/src/intelligence.ts#L28-L41)）：
   ```sql
   SELECT e.object_id, 1 - (e.vec <=> $2) AS score
   FROM embeddings e
   WHERE e.user_id = $1 AND e.model = $3 AND e.object_id <> $4
   ORDER BY e.vec <=> $2
   LIMIT 5;
   ```
   配合 `SET LOCAL hnsw.iterative_scan = relaxed_order;`（因为带过滤）。**向量不出库，`cosine()` 不再被用于全量扫描。**
3. **保留 `cosine()` 用于小规模精确计算** —— 它没有错，只是不该被用来扫全表。

#### 第 1 优先：L0 纯 SQL 洞察包（一次投入，永久免费）

这 7 类洞察现在就能做，且**完全不需要 LLM、不需要向量**：

| 优先级 | 洞察 | 实现 | 预计工时 |
|---|---|---|---|
| ★★★ | **A9 行动未闭环** | 1 条 SQL + 1 个部分索引。**这是用户最容易理解、最有即时价值的一类** | 0.5 天 |
| ★★★ | **A4 悬置的想法** | 疑问正则 + `NOT EXISTS` 边。**建议直接给「提问」加一个 UI 上的显式标记，比正则更准** | 0.5 天 |
| ★★★ | **A3 判断过期** | `valid_until < now()` + 仍被引用。**这是 drill 已有字段却完全没用的最大浪费** | 0.5 天 |
| ★★ | **A1 精确重复** | `contentHash()` 复用为查重。修 `content_hash` 不含 `body_blocks` 的边界 | 0.5 天 |
| ★★ | **A5 孤立对象** | 度数 = 0。大库再上物化分量表 | 0.5 天 |
| ★★ | **A10 写作节律** | `lag()` + burstiness B + 直方图。**注意用 `generate_series` 补全空日** | 1 天 |
| ★ | **A8 tag 覆盖度** | `GROUP BY tag HAVING count(*) = 1` | 0.5 天 |

**这 4 天的工作量能覆盖 12 类洞察中的 7 类，成本为零，且全部走索引。**

#### 第 2 优先：向量层洞察（需要 HNSW 就位）

| 洞察 | 实现 |
|---|---|
| **A1 语义去重** | HNSW k-NN（k=20）→ `cosine ≥ 0.90`。**结果展示为洞察，不要静默删除** |
| **A6 跨域连接** | `root_domain_id` 列 + HNSW k-NN → 跨域对 + IDF 加权排序 |
| **A2 候选生成** | HNSW k-NN（k=10）→ 候选对写入 `nli_candidates` 表 |
| **A3 质心漂移** | `topic_centroids` 物化表 + `AVG(vec)` 聚合 |

#### 第 3 优先：聚类升级

`clusterVectors()`（[intelligence.ts:51-73](packages/server/src/intelligence.ts#L51-L73)）是当前唯一有算法实质的函数，但需要三处改造：

1. **放开 k**：`Math.min(6, ...)` → `Math.min(60, ...)`。硬编码 6 对 10 万条笔记是没有信息量的。更好的做法是用 HDBSCAN 的稳定性指标或轮廓系数自动定 k。
2. **球形化**：分配完成后，算每簇质心并 **L2 归一化**再进入下一轮。当前实现没有这一步，导致在 1024 维归一化向量上质心会向球心漂移。
3. **增加"噪声"出口**：把与所有质心相似度都 < τ 的对象标为未聚类（对应 HDBSCAN 的 `-1`），而不是强行塞进最近簇。这直接改善"孤立对象"（A5）的输出质量。

**然后**考虑在 Node 里实现简化的 HDBSCAN（或夜间 Python 批处理），配合 c-TF-IDF 生成主题词。

### D.2 用什么库 / 纯 SQL

| 需求 | **推荐** | 不推荐 / 备选 |
|---|---|---|
| 向量 k-NN | **pgvector HNSW**（`<=>`，`m=16`, `ef_construction=64`, `hnsw.ef_search=100`, `iterative_scan=relaxed_order`） | 无 |
| 内存紧张时 | **`halfvec`**（内存减半）或 **`binary_quantize` + 重排**（32 倍压缩） | 无 |
| 精确去重 | **SQL `GROUP BY content_hash`** | 无 |
| 近似文本去重 | **`pg_trgm`**：过滤用 GIN（`%`），top-k 排序用 **GiST**（`<->`） | MinHash/LSH（10 万条规模过度工程） |
| SimHash 思路 | **`binary_quantize(vec)::bit(1024)` + `<~>` Hamming** | 手写 SimHash |
| 社区发现 | **`graphology` + `graphology-communities-louvain`**（纯 JS，零编译）+ 自写连通性修复 | Leiden（**无 Node 版**，只能离线 Python） |
| 连通分量 | **并查集（Union-Find）**，物化到 `components` 表 —— 天然增量、O(α(n)) | 递归 CTE（>1 万条会慢） |
| 图分析 | **`graphology`**（中心性、k-core、BFS 都有） | igraph/networkx（无 Node 绑定） |
| 聚类 | **现有 k-means + 球形化 + 放开 k**；中期考虑 HDBSCAN | 现在就上 HDBSCAN（Node 无成熟实现） |
| 主题关键词 | **自写 c-TF-IDF**（20 行，纯统计） | BERTopic 整体引入（Python 依赖 + UMAP 不确定性） |
| 变点检测 | **自写 DP / 滑窗均值比**（序列只有 12~60 点） | `ruptures`（Python，为 60 个点引入跨语言栈不值得） |
| 矛盾检测 | **`mDeBERTa-v3-base-mnli-xnli`**（或更快的 MiniLMv2-L6），ONNX Runtime，结果落库缓存 | 云端 LLM pairwise（贵且慢） |
| 复习调度 | **`ts-fsrs`**（npm 5.4.2，TS 原生） | 自写 SM-2 |
| 中文分词 | **暂不装扩展**，用 bigram + `pg_trgm`；真要装选 **`zhparser`**（比 `pg_jieba` 少一个 C++ 工具链依赖） | 无 |

### D.3 怎么复用现有的 `lexicalScore` / `cosine` / `clusterVectors`

**`lexicalScore()`**（[intelligence.ts:9-12](packages/server/src/intelligence.ts#L9-L12)）

- **保留，并且它是 drill 最被低估的资产。** 中文 bigram Dice 是一个**免分词、免模型、免索引**的相似度，对普通话文本效果出奇地稳。
- **新定位**：从"向量不可用时的降级方案"升级为"**索引初筛后的精排器**"。流程：`pg_trgm GIN 取候选（快、可能有噪声）→ lexicalScore 精排（准、但只能在小集合上算）`。
- **必须修的边界**：`body` 只含纯文本，**不含 `body_blocks`**。结构化段落里的内容对 `lexicalScore` 和 `contentHash` 都是隐形的。建议统一成 `objectText(o) = title + body + blocksToText(body_blocks)`，并让所有调用点共用。
- **一个真实的坑**：`lexicalScore` 里 `if (!x.size || !y.size) return a.toLowerCase().includes(b.toLowerCase()) ? 1 : 0;` —— 当两边都只有 1 个字符时 `gram` 返回空 Set，会走 `includes` 分支返回 0/1 的硬判定。短标题（如"钱"）会得到**二值化**的相似度，在排序里会异常突出。建议改成基于字符集的 Jaccard 兜底。

**`cosine()`**（[intelligence.ts:13-17](packages/server/src/intelligence.ts#L13-L17)）

- **保留，但收缩职责**：只用于**小规模精确计算**（例如对 HNSW 返回的 50 个候选做重排、算质心与成员的相似度、算漂移序列）。
- **不要用它扫全库。** 用 pgvector 的 `1 - (vec <=> $1)` 替代。
- **加一个优化**：drill 的向量来自 bge-m3，通常已归一化。若确信归一化，可以用点积代替完整余弦（省一次开方，约 30% 提速）。但**要防御性地检查**（例如 `abs(norm - 1) < 1e-3`），因为混入未归一化的向量会静默给出错误排序。
- **阈值不能复用**：`RELATED_THRESHOLD=0.65` 只适合"相关推荐"。去重需要 0.90，跨域需要 0.70~0.78。**建议把这些阈值集中成一个 `THRESHOLDS` 常量对象并命名清楚**，避免将来有人把去重阈值调成 0.65 导致误报爆炸。

**`clusterVectors()`**（[intelligence.ts:51-73](packages/server/src/intelligence.ts#L51-L73)）

- **保留骨架**（最远种子播种 = 确定性的 k-means++，可复现，是好性质）。
- **三处改动**（见 D.1 第 3 优先）：放开 k、质心 L2 归一化、加噪声出口。
- **抽出可复用部分**：`clusterVectors` 里的 k-NN 计算（`cosine(item.vec, seeds[i].vec)` 的循环）与应用层其他地方重复。建议抽一个 `nearest(vec, candidates)`。
- **接入 c-TF-IDF**：现在簇的 label 是 `seed.object.tags_cached[0] ?? title.slice(0,14)`（[intelligence.ts:72](packages/server/src/intelligence.ts#L72)）—— **这是最弱的一环**，一个簇的名字取决于种子对象恰好有没有 tag。改成对簇内所有对象算 c-TF-IDF top-3 词，质量会立刻不同，且**零额外依赖**。
- **物化**：`/map` 端点每次请求都重聚类（[http.ts:288-291](packages/server/src/http.ts#L288-L291)）。应改为写入 `clusters` 表，加 `params_hash` 判脏，只在参数或数据变化时重算。

### D.4 建议新增的数据库对象（按优先级）

```sql
-- 1. 向量索引（最高优先级，一条 DDL）
CREATE INDEX CONCURRENTLY embeddings_hnsw_cos
  ON embeddings USING hnsw (vec vector_cosine_ops)
  WITH (m = 16, ef_construction = 64);

-- 2. 领域根（避免每次递归 CTE）
ALTER TABLE objects ADD COLUMN root_domain_id text;
CREATE INDEX ON objects(user_id, root_domain_id) WHERE deleted_at IS NULL;

-- 3. 主题质心物化（A3 漂移 / A8 空洞 / A7 主题）
CREATE TABLE topic_centroids(
  user_id varchar(64) NOT NULL, topic_key text NOT NULL, period text NOT NULL,
  centroid vector(1024), n integer, computed_at bigint,
  PRIMARY KEY(user_id, topic_key, period));

-- 4. 聚类结果物化（替代每次请求重算）
CREATE TABLE clusters(
  user_id varchar(64) NOT NULL, cluster_id text NOT NULL, label text,
  centroid vector(1024), size integer, params_hash text, computed_at bigint,
  PRIMARY KEY(user_id, cluster_id));
CREATE TABLE cluster_members(
  user_id varchar(64) NOT NULL, cluster_id text NOT NULL, object_id text NOT NULL,
  score real, PRIMARY KEY(user_id, cluster_id, object_id));

-- 5. NLI 结果缓存（A2 的成败关键：每对只算一次）
CREATE TABLE nli_results(
  user_id varchar(64) NOT NULL,
  from_id text NOT NULL, from_block text NOT NULL,
  to_id text NOT NULL,   to_block text NOT NULL,
  label text, score real, model text, content_hash text, computed_at bigint,
  PRIMARY KEY(user_id, from_id, from_block, to_id, to_block, model));

-- 6. 复习日志（A11 FSRS 的前提，没有它 FSRS 无法运行）
CREATE TABLE reviews(
  user_id varchar(64) NOT NULL, id text NOT NULL, object_id text NOT NULL,
  rated_at bigint NOT NULL, rating smallint NOT NULL,
  elapsed_days real, scheduled_days real, state text,
  PRIMARY KEY(user_id, id));

-- 7. 连通分量物化（大库必备）
CREATE TABLE components(
  user_id varchar(64) NOT NULL, object_id text NOT NULL, component_id text NOT NULL,
  size integer, computed_at bigint, PRIMARY KEY(user_id, object_id));

-- 8. 性能索引
CREATE INDEX ON objects(user_id, kind, status) WHERE deleted_at IS NULL AND NOT ephemeral;
CREATE INDEX ON objects(user_id, valid_until) WHERE valid_until IS NOT NULL AND deleted_at IS NULL;
```

### D.5 三个容易被忽略但会决定成败的点

1. **`iterative_scan` 不开，HNSW 的过滤查询会静默返回不足的结果。** drill 的每个查询都带 `user_id`/`deleted_at`/`ephemeral` 过滤，所以这个问题**一定会发生**。必须在连接建立时设 `SET hnsw.iterative_scan = relaxed_order`（或在每个向量查询的 transaction 里 `SET LOCAL`）。

2. **`content_hash` 的语义要统一并扩展。** 现在它只哈希 `title + body`，不含 `body_blocks`。而 `lexicalScore` 也一样。建议引入一个**唯一的**文本投影函数并在 `contentHash`、`lexicalScore`、embedding 输入三处共用——否则会出现"hash 没变但内容变了"导致的缓存失效 bug，而这种 bug 极难排查。

3. **把 LLM 从"发现者"降级为"措辞者"。** 现有 `/insight` 的 prompt 是 `找出证据支持的重复、张力或盲点`（[http.ts:239](packages/server/src/http.ts#L239)），即让 LLM 在一堆原文里**发现**洞察。这在成本和可靠性上都是最差的架构。正确形态是：**L0/L1 计算出结构化的洞察候选（带对象 ID 和算法证据）→ LLM 只负责把它写成一句人话 → 缓存**。这一步改造能把 LLM 成本降一到两个数量级，同时显著提高洞察的可验证性（因为每条洞察背后都有一个可复算的算法依据，而不是模型的黑箱判断）。

---

## 参考来源汇总

**论文**
- SemDeDup: Abbas et al., arXiv:2303.09540 — https://arxiv.org/abs/2303.09540
- HDBSCAN*: Campello, Moulavi & Sander, PAKDD 2013 — https://link.springer.com/chapter/10.1007/978-3-642-37456-2_14
- HDBSCAN 加速版: McInnes & Healy, ICDMW 2017 — http://ieeexplore.ieee.org/stamp/stamp.jsp?tp=&arnumber=8215642
- hdbscan JOSS: McInnes, Healy & Astels, JOSS 2(11):205 — http://joss.theoj.org/papers/10.21105/joss.00205
- HDBSCAN 分支检测: Bot et al., FLASC, PeerJ CS 11:e2792 (2025) — https://peerj.com/articles/cs-2792/
- Louvain: Blondel et al., J. Stat. Mech. (2008) P10008 — https://arxiv.org/pdf/0803.0476.pdf
- Leiden: Traag, Waltman & van Eck, Sci. Rep. 9:5233 (2019) — https://arxiv.org/abs/1810.08473
- BERTopic: Grootendorst, arXiv:2203.05794 — https://arxiv.org/abs/2203.05794
- k-means++: Arthur & Vassilvitskii, SODA 2007 — https://dl.acm.org/doi/10.1145/1283383.1283494
- SimHash: Charikar, STOC '02 — https://dl.acm.org/doi/10.1145/509907.509965
- 变点检测综述: Truong, Oudre & Vayatis, Signal Processing 167:107299 (2020) — https://doi.org/10.1016/j.sigpro.2019.107299
- 阵发性: Goh & Barabási, EPL 81:48002 (2008) — https://doi.org/10.1209/0295-5075/81/48002
- DeBERTa-v3: He et al., arXiv:2111.09543 — https://arxiv.org/pdf/2111.09543.pdf
- XNLI: Conneau et al., arXiv:1809.05053 — https://arxiv.org/pdf/1809.05053.pdf
- MinHash 原始工作: Broder 1997 — https://en.wikipedia.org/wiki/MinHash

**官方文档**
- pgvector README（HNSW/IVFFlat/量化/iterative scan/聚合）— https://github.com/pgvector/pgvector
- pgvector CHANGELOG（0.8.0 加入 iterative index scans）— https://github.com/pgvector/pgvector/blob/master/CHANGELOG.md
- PostgreSQL pg_trgm — https://www.postgresql.org/docs/current/pgtrgm.html
- PostgreSQL WITH 查询（递归 CTE / SEARCH / CYCLE）— https://www.postgresql.org/docs/current/queries-with.html
- PostgreSQL 窗口函数 — https://www.postgresql.org/docs/current/functions-window.html
- hdbscan API 参考 — https://hdbscan.readthedocs.io/en/latest/api.html
- hdbscan 性能与扩展 benchmark — https://hdbscan.readthedocs.io/en/latest/performance_and_scalability.html
- ruptures 文档 — https://centre-borelli.github.io/ruptures-docs/
- BERTopic 算法说明 — https://maartengr.github.io/BERTopic/algorithm/algorithm.html
- FSRS 算法 — https://github.com/open-spaced-repetition/awesome-fsrs/wiki/The-Algorithm

**代码仓库 / 包**
- scikit-learn-contrib/hdbscan — https://github.com/scikit-learn-contrib/hdbscan
- ekzhu/datasketch（MinHash/LSH）— https://github.com/ekzhu/datasketch
- MaartenGr/BERTopic — https://github.com/MaartenGr/BERTopic
- deepcharles/ruptures — https://github.com/deepcharles/ruptures
- graphology（npm 0.26.0）— https://www.npmjs.com/package/graphology
- graphology-communities-louvain（npm 2.0.2）— https://github.com/graphology/graphology/blob/master/src/communities-louvain/README.md
- open-spaced-repetition/fsrs — https://github.com/open-spaced-repetition/free-spaced-repetition-scheduler
- ts-fsrs（npm 5.4.2）— https://www.npmjs.com/package/ts-fsrs
- amutu/zhparser — https://github.com/amutu/zhparser
- jaiminpan/pg_jieba — https://github.com/jaiminpan/pg_jieba

**模型**
- MoritzLaurer/mDeBERTa-v3-base-mnli-xnli（zh 0.8116，不支持 FP16）— https://huggingface.co/MoritzLaurer/mDeBERTa-v3-base-mnli-xnli
- MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli（更小更快）— https://huggingface.co/MoritzLaurer/multilingual-MiniLMv2-L6-mnli-xnli
- MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli（英文）— https://huggingface.co/MoritzLaurer/DeBERTa-v3-base-mnli-fever-anli
- IDEA-CCNL/Erlangshen-Roberta-330M-NLI（原生中文）— https://huggingface.co/IDEA-CCNL/Erlangshen-Roberta-330M-NLI

**本项目内引用**
- [infra/sql/001_schema.sql](infra/sql/001_schema.sql) — 表结构
- [infra/sql/000_extensions.sql](infra/sql/000_extensions.sql) — pg_trgm + vector 扩展
- [infra/sql/003_kinds.sql](infra/sql/003_kinds.sql) — kind 定义（action 的 status/due_at、self 的 applies_to）
- [packages/server/src/intelligence.ts](packages/server/src/intelligence.ts) — lexicalScore / cosine / related / clusterVectors / contentHash / modelJSON
- [packages/server/src/repository.ts:169-180](packages/server/src/repository.ts#L169-L180) — 向量全量加载
- [packages/server/src/http.ts:237-266](packages/server/src/http.ts#L237-L266) — /insight、/search/reindex
- [packages/server/src/http.ts:278-291](packages/server/src/http.ts#L278-L291) — /map、/walk
- [packages/server/src/embedding.ts](packages/server/src/embedding.ts) — bge-m3 / 1024 维 / 供应商链
