/** All contents here are fictional demonstration notes, never the user's actual library. */
import { makeObject, keyBetween, uid } from '../packages/core/src/helpers.ts';
import { pushBatch } from '../packages/server/src/merge.ts';
import type { Workspace, KnowledgeObject, Change } from '../packages/core/src/types.ts';
export function seed(w: Workspace): Workspace {
    if (w.objects.length)
        return w;
    const user = w.user.id, now = Date.now();
    let counter = 0;
    w.sources = [{ id: 'src-obsidian', user_id: user, type: 'connector', connector: 'obsidian', name: 'Obsidian', properties: { file_path: { type: 'text', label: '原始文件' } }, config: {}, anchor: null, state: { unseen: 1, demo: true }, last_synced: now - 2 * 86400000, enabled: true }];
    const c = (id: string, field: string, value: any): Change => ({ mutation_id: 'seed-' + (++counter), object_id: id, field, value, base_rev: w.objects.find(o => o.id === id)?.rev ?? 0, client_ts: now + counter });
    // 归属不是对象上的字段，而是一条 belongs 边，所以这里单独推一次变更。
    const add = (id: string, title: string, kind: string | null, body: string, age = 0, extra: Partial<KnowledgeObject> & { belongs?: string } = {}) => { const { belongs, ...rest } = extra; let key: string | null = null; const blocks = body ? body.split('\n\n').map(text => ({ id: uid(), key: key = keyBetween(key, null), text })) : []; const o = makeObject(title, user, { id, kind, body, body_blocks: { blocks }, captured_at: now - age * 86400000, ...rest }); w = pushBatch(w, [c(id, 'create', o)], 'demo-seed').workspace; if (belongs)
        w = pushBatch(w, [c(id, 'relation', { to_id: belongs, type: 'belongs' })], 'demo-seed').workspace; return id; };
    add('domain-create', '自媒体', 'domain', '把体验转化成清晰、有用的表达。', 35);
    add('domain-english', '英语', 'domain', '在真实场景中理解和使用一门语言。', 35);
    add('domain-design', '设计', 'domain', '让内容和交互都更接近问题本身。', 35);
    add('project-film', '第一支口播视频', 'project', '从一个真实的问题开始。', 10, { belongs: 'domain-create' });
    add('canvas-cover', '封面这件事', 'canvas', '把观察、证据和判断放到一起。', 2, { form: 'canvas', belongs: 'domain-create' });
    add('note-clarity', '先讲清楚一个问题，再做一张好看的封面', 'distill', '封面的任务不是把内容讲完，而是让人知道：这条内容与我有什么关系。\n\n下一次设计时，先用一句话写下观众的问题。如果说不清，就先不打开设计软件。\n\n这来自 [[浅色封面为什么会消失在信息流里]] 的那次尝试。', 0, { belongs: 'domain-create' });
    add('note-light', '浅色封面为什么会消失在信息流里', null, '单独看很干净，放回信息流里却没有辨识度。\n\n试了三种方案：增加标题对比、缩小留白、加入深色边缘。最后起作用的是明确的视觉锚点，而不是更多装饰。', 0, { belongs: 'domain-design' });
    add('note-start', '口语练习一直没开始，是方法的问题吗？', 'thought', '我又找到一种新的练习方法，但今天还是没有开口。\n\n也许需要解决的不是资源不足，而是第一次练习的门槛。', 0, { belongs: 'domain-english' });
    add('note-quiet', '喜欢的工具应该安静一点', null, '每次打开都有红点和待处理数量，会让我把记录误当成新的负担。记录的价值不应该取决于有没有清空。', 0, { belongs: 'domain-design' });
    add('note-action', '录一段30秒的自我介绍，不重录', 'action', '只需要打开录音，完整说完一次。', 0, { status: 'todo', belongs: 'domain-english' });
    add('note-review', '对比三张封面在手机信息流里的效果', 'action', '把三张候选图缩小到同样尺寸再判断。', 1, { status: 'doing', belongs: 'project-film' });
    add('note-script', '写出视频开头的一个具体问题', 'action', '不要从概念定义开始。', 2, { status: 'done', belongs: 'project-film' });
    add('note-scope', '工具选择时，我容易用准备代替开始', 'self', '在需要暴露不熟练的时候，我更容易去研究工具。并不是所有准备都没有价值，关键是它有没有推进第一次尝试。', 4, { belongs: 'domain-english', applies_to: ['工具选择', '学习方式'] });
    add('note-old', '是不是应该先换一个更好的录音工具', 'thought', '好像只要设备选对，开口就会变容易。但上次换工具后，练习还是停在第一天。', 65, { belongs: 'domain-english' });
    add('note-evidence', '用户访谈：封面里的信息太多了', 'material', '“我不知道应该先看哪一行，也不知道视频到底讲什么。”\n\n——虚构访谈示例，用于展示外部证据。', 3, { belongs: 'domain-create', source_id: 'src-obsidian', source_ref: 'interview.md', source_version: 'demo-v1' });
    add('note-small', '一个判断要能改变下一次的决定', 'distill', '不是所有总结都是沉淀。\n\n如果下次遇到相同场景时，做法不会因此不同，那它可能还只是分析。', 2, { belongs: 'domain-create' });
    add('group-observe', '观察与证据', 'group', '', 2);
    add('note-temp', '还没想清楚：留白与识别度', 'thought', '', 0, { ephemeral: true });
    add('canvas-script', '开头怎么说', 'canvas', '一层只解决一个问题。', 4, { form: 'canvas', belongs: 'project-film' });
    for (const [id, tag] of [['note-clarity', '表达'], ['note-light', '视觉'], ['note-start', '学习'], ['note-quiet', '工具'], ['note-old', '学习'], ['note-small', '决策']])
        w = pushBatch(w, [c(id, 'tag', { tag })], 'demo-seed').workspace;
    // Re-save the unresolved link after its target exists, without creating placeholders.
    w = pushBatch(w, [c('note-clarity', 'body_blocks', { blocks: w.objects.find(o => o.id === 'note-clarity')!.body_blocks.blocks })], 'demo-seed').workspace;
    for (const [id, x, y, g, width, height] of [['group-observe', 36, 58, null, 640, 260], ['note-light', 60, 110, 'group-observe', 260, 170], ['note-evidence', 360, 110, 'group-observe', 270, 170], ['note-clarity', 390, 390, null, 290, 210], ['note-small', 60, 410, null, 260, 180], ['note-temp', 760, 98, null, 240, 110], ['canvas-script', 750, 330, null, 250, 150]] as any[])
        w = pushBatch(w, [c('canvas-cover', 'placement', { object_id: id, x, y, group_id: g, w: width, h: height })], 'demo-seed').workspace;
    w = pushBatch(w, [c('note-light', 'relation', { to_id: 'note-clarity', source_field: 'canvas' }), c('note-evidence', 'relation', { to_id: 'note-clarity', source_field: 'canvas' })], 'demo-seed').workspace;
    // The demonstration is not an actual merge-conflict or performance sample.
    w.conflicts = [];
    return w;
}
