import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, readFile, stat } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { setTimeout as sleep } from 'node:timers/promises';
import { AgentService } from '../packages/server/src/agent/service.ts';
import { DemoRepository, PostgresRepository } from '../packages/server/src/repository.ts';
import { agentConfig, checkProviderURL } from '../packages/server/src/agent/config.ts';
import { createDrillServer } from '../packages/server/src/http.ts';
import { JWTAuth } from '../packages/server/src/auth.ts';
import { DisabledAssets } from '../packages/server/src/assets.ts';
import { makeObject, uid, emptyWorkspace } from '../packages/core/src/helpers.ts';
import { pushBatch } from '../packages/server/src/merge.ts';
import { record, put, recoverExpired, runs } from '../packages/server/src/agent/store.ts';
import { validateScope, scopedNotes, evidence, sanitizeCitations, citationsIn } from '../packages/server/src/agent/scope.ts';
import { parseInsight } from '../packages/server/src/agent/insights.ts';
import { prepareHistory } from '../packages/server/src/agent/engine.ts';
import { createTools, dispatchTool, type ToolContext } from '../packages/server/src/agent/tools.ts';
import { deepseekCompletion, sseData, type Completion } from '../packages/server/src/agent/provider.ts';
import { harnessRun } from '../packages/server/src/agent/harness.ts';
import type { AgentSession, AgentRun, AgentMemory, WireMessage } from '../packages/core/src/agent.ts';
const kinds=JSON.parse(readFileSync(new URL('../infra/sql/kinds.json',import.meta.url),'utf8'));
const unitUsage={prompt_tokens:10,completion_tokens:5,cached_tokens:3};
function mock(fn:(messages:WireMessage[],tools:any[],signal:AbortSignal)=>Promise<WireMessage>|WireMessage):Completion {
  return async(messages,tools,signal,onText)=>{signal.throwIfAborted();const message=await fn(messages,tools,signal);if(message.content)await onText(message.content);return {message,usage:unitUsage,finishReason:message.tool_calls?.length?'tool_calls':'stop'};};
}
const reply=(s:string):WireMessage=>({role:'assistant',content:s,reasoning_content:'private-test-reasoning'});
const tool=(name:string,args:unknown):WireMessage=>({role:'assistant',content:'',reasoning_content:'private-tool-reasoning',tool_calls:[{id:uid(),type:'function',function:{name,arguments:JSON.stringify(args)}}]});
async function fixture(t:TestContext,complete:Completion=mock(()=>reply('你好')),extra:any={}) {
  const dir=await mkdtemp(join(tmpdir(),'drill-agent-test-')),repo=new DemoRepository(dir,kinds);
  const service=new AgentService(repo,{config:agentConfig({DEEPSEEK_API_KEY:'unit-test-only',DRILL_AGENT_ENGINE:'deepseek',...extra.env}),completion:complete,...extra.options});
  const h=(path:string,method='GET',body:any={},user='alice')=>service.handle(user,path,method,new URLSearchParams(),body) as Promise<any>;
  t.after(async()=>{await service.close();await rm(dir,{recursive:true,force:true});});
  const add=async(title:string,patch:any={},user='alice')=>{
    const o=makeObject(title,user,{body:'一段原始记录。',...patch});await repo.transaction(user,w=>({workspace:pushBatch(w,[{mutation_id:uid(),object_id:o.id,field:'create',value:o,base_rev:0,client_ts:Date.now()}],'test').workspace,result:true}));return (await repo.read(user)).objects.find(v=>v.id===o.id)!;
  };
  const session=async(scope:any={},mode='chat')=>{await h('/agent/settings','POST',{consent:true});return h('/agent/sessions','POST',{scope,mode});};
  const finish=async(id:string)=>{await service.idle();return h('/agent/runs/'+id) as Promise<AgentRun>;};
  return {dir,repo,service,h,add,session,finish};
}
function streamResponse(chunks:any[],fragment=0) {
  const bytes=new TextEncoder().encode(chunks.map(c=>'data: '+(typeof c==='string'?c:JSON.stringify(c))+'\n\n').join(''));
  return new Response(new ReadableStream({start(c){if(fragment)for(let i=0;i<bytes.length;i+=fragment)c.enqueue(bytes.slice(i,i+fragment));else c.enqueue(bytes);c.close();}}),{headers:{'Content-Type':'text/event-stream'}});
}
function context(w=emptyWorkspace('alice',kinds),overrides:Partial<ToolContext>={}):ToolContext {
  return {read:async()=>w,scope:{},mode:'chat',allowWeb:false,webKey:'',useMemory:false,signal:new AbortController().signal,seen:new Map(),webSeen:new Map(),event:async()=>{},propose:async()=>{},addUsage:()=>{},completion:mock(()=>reply('分析')), ...overrides};
}

test('agent config: explicit engine, server secrets and separate model aliases',()=>{
  assert.equal(agentConfig({DEEPSEEK_API_KEY:'x'}).model,'deepseek-flash');
  assert.equal(agentConfig({DEEPSEEK_API_KEY:'x',DRILL_AGENT_ENGINE:'harness'}).model,'deepseek-v4-flash');
  assert.equal(agentConfig({DRILL_AGENT_MAX_STEPS:'999'}).maxSteps,30);
  assert.equal(agentConfig({VITE_DEEPSEEK_API_KEY:'secret'}).configured,false);
});
test('provider URL: reject embedded credentials, non-HTTPS remote endpoints and query secrets',()=>{
  for(const u of ['ftp://example.org','http://example.org','https://u:p@example.org','https://example.org?key=secret'])assert.throws(()=>checkProviderURL(u));
  checkProviderURL('https://api.deepseek.com');checkProviderURL('http://127.0.0.1:1234');
});
test('scope: malformed filters never silently broaden to the whole workspace',()=>{
  for(const v of ['oops',null,[],{object_id:'typo'},{object_ids:['ok',12]},{since:20,until:10}])assert.throws(()=>validateScope(v));
  assert.deepEqual(validateScope(undefined),{});assert.deepEqual(validateScope({object_ids:['a','a']}),{object_ids:['a']});
});
test('scope: excludes hidden/deleted/ephemeral/AI/canvas and other tenants',()=>{
  const w=emptyWorkspace('alice',kinds);w.objects=[makeObject('yes','alice',{id:'yes'}),makeObject('hidden','alice',{id:'hidden'}),makeObject('deleted','alice',{deleted_at:1}),makeObject('temp','alice',{ephemeral:true}),makeObject('ai','alice',{kind:'ai_output'}),makeObject('canvas','alice',{form:'canvas'}),makeObject('secret','bob')];w.user.settings.discovery_hidden=['hidden'];
  assert.deepEqual(scopedNotes(w,validateScope({include_hidden:true})).map(o=>o.id),['yes']);assert.equal(scopedNotes(w,{object_ids:[]}).length,0);assert.equal(scopedNotes(w,{tags:[]}).length,0);
});
test('scope: time/tag/selection constraints intersect; belongs traversal handles cycles',()=>{
  const w=emptyWorkspace('alice',kinds);w.objects=[makeObject('project','alice',{id:'p',kind:'project',captured_at:1}),makeObject('child','alice',{id:'a',captured_at:10,tags_cached:['x']}),makeObject('other','alice',{id:'b',captured_at:20,tags_cached:['x']})];
  w.relations=[{from_id:'a',to_id:'p',user_id:'alice',type:'belongs',source_field:'manual',source_block_id:'',created_at:1,deleted_at:null},{from_id:'p',to_id:'a',user_id:'alice',type:'belongs',source_field:'manual',source_block_id:'',created_at:1,deleted_at:null}];
  assert.deepEqual(scopedNotes(w,{belongs:'p',tags:['x'],since:5,until:15}).map(o=>o.id),['a']);
  assert.equal(scopedNotes(w,{object_ids:['a'],since:11}).length,0);
});
test('citations: only received evidence can be cited',()=>{
  const o=makeObject('original','alice',{id:'a'}),seen=new Map([['a',evidence(o)]]);
  assert.equal(sanitizeCitations('A [note:a] B [note:secret]',seen),'A [note:a] B [来源未验证]');assert.equal(citationsIn('[note:a] [note:a] [note:no]',seen).length,1);
});
test('insights: single-note findings accepted; unknown evidence rejected; silent results remain empty',()=>{
  const seen=new Map([['a',evidence(makeObject('note','alice',{id:'a'}))]]);
  const out={silent:false,title:'One note',summary:'摘要',findings:[{observation:'观察',interpretation:'解释',citations:['a']}],questions:['问题？'],next_step:'实验',citations:['a']};
  assert.equal(parseInsight(JSON.stringify(out),seen).findings.length,1);
  assert.throws(()=>parseInsight(JSON.stringify({...out,citations:['fake']}),seen));assert.throws(()=>parseInsight(JSON.stringify({...out,findings:[{...out.findings[0],citations:['fake']}]}),seen));
  assert.deepEqual(parseInsight('{"silent":true,"summary":"还不确定"}',seen).citations,[]);
});
test('history compaction: retain whole recent tool/reasoning turns without orphan tool messages',()=>{
  const wire:WireMessage[]=[{role:'user',content:'old '.repeat(3000)},reply('old answer'),{role:'user',content:'recent'},tool('read_notes',{ids:['a']}),{role:'tool',tool_call_id:'unused-for-unit',content:'receipt'},reply('recent answer')];
  const r=prepareHistory(wire,3000);assert.equal(r.compacted,true);assert.ok(r.history.some(m=>m.reasoning_content==='private-tool-reasoning'));assert.ok(r.history[0].content?.includes('历史摘录'));
});
test('SSE parser: fragmented UTF-8, CRLF, comments and multiline data',async()=>{
  const bytes=new TextEncoder().encode(': comment\r\ndata: 第一行\r\ndata: 第二行\r\n\r\ndata: [DONE]\r\n\r\n');
  const source=new ReadableStream<Uint8Array>({start(c){for(let i=0;i<bytes.length;i+=2)c.enqueue(bytes.slice(i,i+2));c.close();}});
  const out=[];for await(const v of sseData(source,new AbortController().signal))out.push(v);assert.deepEqual(out,['第一行\n第二行','[DONE]']);
});
test('SSE parser: abort cancels a pending reader instead of hanging',async()=>{
  const c=new AbortController();const it=sseData(new ReadableStream({start(){}}),c.signal);const p=it.next();c.abort();await assert.rejects(p);
});
test('DeepSeek transport: thinking fields, incremental tool assembly, usage and server-side reasoning',async()=>{
  let sent:any;const complete=deepseekCompletion(agentConfig({DEEPSEEK_API_KEY:'test'}),(async(_u,init)=>{sent=JSON.parse(String(init?.body));return streamResponse([
    {choices:[{delta:{reasoning_content:'reasoning'}}]},
    {choices:[{delta:{tool_calls:[{index:0,id:'c1',function:{name:'read_notes',arguments:'{"ids":'}}]}}]},
    {choices:[{delta:{tool_calls:[{index:0,function:{arguments:'["a"]}'}}]},finish_reason:'tool_calls'}]},
    {choices:[],usage:{prompt_tokens:80,completion_tokens:20,prompt_cache_hit_tokens:40}},'[DONE]'],3);}) as typeof fetch);
  const r=await complete([{role:'user',content:'Hi'}],[],new AbortController().signal,async()=>{});
  assert.equal(sent.thinking.type,'enabled');assert.equal(sent.reasoning_effort,'high');assert.equal(sent.temperature,undefined);assert.equal(sent.messages[0].content,'Hi');assert.equal(r.message.reasoning_content,'reasoning');assert.deepEqual(JSON.parse(r.message.tool_calls![0].function.arguments),{ids:['a']});assert.equal(r.usage.cached_tokens,40);
});
test('DeepSeek transport: bounded retry before output; no leaking provider body',async()=>{
  let n=0,retries=0;const complete=deepseekCompletion(agentConfig({DEEPSEEK_API_KEY:'secret'}),(async()=>++n===1?new Response('secret-provider-debug',{status:503}):streamResponse([{choices:[{delta:{content:'ok'},finish_reason:'stop'}]},'[DONE]'])) as typeof fetch);
  assert.equal((await complete([],[],new AbortController().signal,async()=>{},async()=>{retries++;})).message.content,'ok');assert.equal(n,2);assert.equal(retries,1);
  const denied=deepseekCompletion(agentConfig({DEEPSEEK_API_KEY:'secret'}),(async()=>new Response('secret-provider-debug',{status:401})) as typeof fetch);
  await assert.rejects(denied([],[],new AbortController().signal,async()=>{}),e=>e instanceof Error&&!e.message.includes('secret-provider-debug')&&e.message.includes('密钥'));
});
test('DeepSeek transport: partial stream without a terminal marker fails without transparent re-execution',async()=>{
  let n=0,partial='';const complete=deepseekCompletion(agentConfig({DEEPSEEK_API_KEY:'test'}),(async()=>{n++;return streamResponse([{choices:[{delta:{content:'partial'}}]}]);}) as typeof fetch);
  await assert.rejects(complete([],[],new AbortController().signal,async s=>{partial+=s;}));assert.equal(n,1);assert.equal(partial,'partial');
});
test('DeepSeek transport: malformed JSON and truncated outputs rejected',async()=>{
  for(const data of ['invalid-json',{choices:[{delta:{content:'unfinished'},finish_reason:'length'}]}]){
    const complete=deepseekCompletion(agentConfig({DEEPSEEK_API_KEY:'test'}),(async()=>streamResponse([data,'[DONE]'])) as typeof fetch);
    await assert.rejects(complete([],[],new AbortController().signal,async()=>{}));
  }
});
test('tools: plan mode excludes proposals; insight suppresses proposals even in research mode',()=>{
  const names=[...createTools(context(undefined,{mode:'plan',useMemory:true})).keys()];assert.ok(!names.includes('propose_metadata'));assert.ok(!names.includes('propose_memory'));assert.ok(names.includes('update_plan'));
  assert.ok(!createTools(context(undefined,{mode:'research',proposalsAllowed:false})).has('propose_metadata'));
});
test('tools: unknown tools and extra arguments fail closed',async()=>{
  const c=context(),tools=createTools(c);await assert.rejects(dispatchTool(tools,'bash',{command:'rm -rf /'},c));await assert.rejects(dispatchTool(tools,'search_notes',{query:'x',user_id:'bob'},c));
});
test('tools: read_notes cannot expand the authorized scope',async()=>{
  const w=emptyWorkspace('alice',kinds);w.objects=[makeObject('a','alice',{id:'a'}),makeObject('b','alice',{id:'b'})];const c=context(w,{scope:{object_ids:['a']}});
  await assert.rejects(dispatchTool(createTools(c),'read_notes',{ids:['b']},c));assert.equal(c.seen.size,0);
});
test('tools: approved memory opt-in and deletions honored at read time',async()=>{
  const w=emptyWorkspace('alice',kinds);w.user.settings.agent_use_memory=true;put(w,'memory',{id:'m',text:'prefer evidence',disabled:false,created_at:1} as AgentMemory);
  assert.ok(!createTools(context(w)).has('read_memory'));const c=context(w,{useMemory:true});assert.equal((await dispatchTool(createTools(c),'read_memory',{},c) as any).memories.length,1);
  w.user.settings.agent_use_memory=false;assert.equal((await dispatchTool(createTools(c),'read_memory',{},c) as any).memories.length,0);
});
test('tools: optional web search uses fixed host and filters unsafe source links',async()=>{
  assert.ok(!createTools(context()).has('web_search'));let requested='';
  const c=context(undefined,{allowWeb:true,webKey:'web-secret',fetcher:(async(url)=>{requested=String(url);return Response.json({results:[{url:'javascript:alert(1)',title:'bad',content:'bad'},{url:'https://example.org/report',title:'Report',content:'Source'}]});}) as typeof fetch});
  const r:any=await dispatchTool(createTools(c),'web_search',{query:'public topic'},c);assert.equal(requested,'https://api.tavily.com/search');assert.equal(r.sources.length,1);assert.equal(c.webSeen.size,1);assert.ok(!JSON.stringify(r).includes('web-secret'));
});
test('service: consent required before any model request',async t=>{
  let called=0;const f=await fixture(t,mock(()=>{called++;return reply('ok');}));const s=await f.h('/agent/sessions','POST',{});
  await assert.rejects(f.h('/agent/runs','POST',{session_id:s.id,input:'hi'}));assert.equal(called,0);
});
test('service: missing credentials never generate a mock answer',async t=>{
  const f=await fixture(t,undefined,{env:{DEEPSEEK_API_KEY:''}}),s=await f.session();await assert.rejects(f.h('/agent/runs','POST',{session_id:s.id,input:'hi'}));
});
test('service: agent execution, protocol replay and visible history survive repository reload',async t=>{
  let noteId='';const f=await fixture(t,mock(messages=>messages.at(-1)?.role==='tool'?reply('依据 [note:'+noteId+']'):tool('search_notes',{query:''})));noteId=(await f.add('练习记录')).id;
  const s=await f.session({object_ids:[noteId]});const first=await f.h('/agent/runs','POST',{session_id:s.id,input:'看到了什么？'});const r=await f.finish(first.id);assert.equal(r.status,'completed');assert.equal(r.citations[0].id,noteId);assert.equal(r.usage.prompt_tokens,20);
  const second=await f.h('/agent/runs','POST',{session_id:s.id,input:'继续'});await f.finish(second.id);
  const w=await f.repo.read('alice'),stored=record<AgentSession>(w,s.id,'session');assert.equal(stored.messages.length,4);assert.equal(stored.wire!.filter(m=>m.reasoning_content==='private-tool-reasoning').length,2);
  const visible=await f.h('/agent/sessions/'+s.id);assert.equal(visible.session.wire,undefined);assert.ok(!JSON.stringify(visible).includes('private-test-reasoning'));
  const other=new AgentService(new DemoRepository(f.dir,kinds),{config:agentConfig({})});assert.equal((await other.handle('alice','/agent/sessions/'+s.id,'GET',new URLSearchParams(),{}) as any).session.messages.length,4);await other.close();
});
test('service: forged tenant id cannot access another user session, run or memory',async t=>{
  const f=await fixture(t),s=await f.session();const r=await f.h('/agent/runs','POST',{session_id:s.id,input:'hi'});await f.finish(r.id);
  for(const path of ['/agent/sessions/'+s.id,'/agent/runs/'+r.id])await assert.rejects(f.h(path,'GET',{},'bob'));
});
test('service: cancellation aborts model work and prevents committed assistant output',async t=>{
  let aborted=false,markStarted!:()=>void;const started=new Promise<void>(resolve=>{markStarted=resolve;});
  const c:Completion=async(_m,_t,signal)=>{markStarted();return new Promise((_res,rej)=>{const onAbort=()=>{aborted=true;rej(signal.reason);};if(signal.aborted){onAbort();return;}signal.addEventListener('abort',onAbort,{once:true});});};
  const f=await fixture(t,c),s=await f.session(),r=await f.h('/agent/runs','POST',{session_id:s.id,input:'long'});await started;await f.h('/agent/runs/'+r.id+'/cancel','POST',{});const final=await f.finish(r.id);assert.equal(final.status,'cancelled');assert.equal(aborted,true);assert.equal((await f.h('/agent/sessions/'+s.id)).session.messages.length,1);
});
test('service: revoking consent cancels running work',async t=>{
  const c:Completion=async(_m,_t,signal)=>new Promise((_res,rej)=>signal.addEventListener('abort',()=>rej(signal.reason),{once:true}));
  const f=await fixture(t,c),s=await f.session(),r=await f.h('/agent/runs','POST',{session_id:s.id,input:'long'});await sleep(25);await f.h('/agent/settings','POST',{consent:false});assert.equal((await f.finish(r.id)).status,'cancelled');
});
test('service: duplicate active runs and rolling daily budget enforced in transaction',async t=>{
  const slow:Completion=async(_m,_t,signal)=>new Promise((_res,rej)=>signal.addEventListener('abort',()=>rej(signal.reason),{once:true}));
  const f=await fixture(t,slow,{env:{DRILL_AGENT_DAILY_RUNS:'1'}}),s=await f.session(),r=await f.h('/agent/runs','POST',{session_id:s.id,input:'one'});
  await assert.rejects(f.h('/agent/runs','POST',{session_id:s.id,input:'two'}));await f.h('/agent/runs/'+r.id+'/cancel','POST',{});await f.finish(r.id);await assert.rejects(f.h('/agent/runs','POST',{session_id:s.id,input:'three'}));
});
test('service: expired lease becomes interrupted, not silently re-run',async t=>{
  const f=await fixture(t),s=await f.session(),r=await f.h('/agent/runs','POST',{session_id:s.id,input:'hi'});await f.finish(r.id);
  await f.repo.transaction('alice',w=>{const saved=record<AgentRun>(w,r.id,'run');saved.status='running';saved.lease_until=1;put(w,'run',saved);return {workspace:w,result:true};});
  assert.equal((await f.h('/agent/runs/'+r.id)).status,'interrupted');
});
test('service: properties remain unchanged until explicit approval; approval is idempotent',async t=>{
  let noteId='';const f=await fixture(t,mock(m=>m.at(-1)?.role==='tool'?reply('提议等待确认'):tool('propose_metadata',{object_id:noteId,field:'kind',value:'thought'})));noteId=(await f.add('原始标题')).id;
  const s=await f.session({object_ids:[noteId]}),r=await f.h('/agent/runs','POST',{session_id:s.id,input:'整理一下'}),done=await f.finish(r.id);assert.equal(done.status,'completed');assert.equal(done.actions.length,1);assert.equal((await f.repo.read('alice')).objects[0].kind,null);
  const payload={action_id:done.actions[0].id,decision:'accepted'};await f.h('/agent/runs/'+r.id+'/approve','POST',payload);const before=(await f.repo.read('alice')).objects[0];assert.equal(before.kind,'thought');assert.equal(before.title,'原始标题');assert.equal(before.body,'一段原始记录。');
  await f.h('/agent/runs/'+r.id+'/approve','POST',payload);assert.equal((await f.repo.read('alice')).objects[0].rev,before.rev);
});
test('service: stale proposal never overwrites a newer user revision',async t=>{
  let noteId='';const f=await fixture(t,mock(m=>m.at(-1)?.role==='tool'?reply('等待确认'):tool('propose_metadata',{object_id:noteId,field:'kind',value:'thought'})));noteId=(await f.add('old')).id;
  const s=await f.session(),r=await f.h('/agent/runs','POST',{session_id:s.id,input:'整理'}),done=await f.finish(r.id);
  await f.repo.transaction('alice',w=>{const o=w.objects.find(o=>o.id===noteId)!;return {workspace:pushBatch(w,[{mutation_id:uid(),object_id:o.id,field:'title',value:'new',base_rev:o.rev,client_ts:Date.now()}],'user-edit').workspace,result:true};});
  assert.equal((await f.h('/agent/runs/'+r.id+'/approve','POST',{action_id:done.actions[0].id,decision:'accepted'})).status,'stale');assert.equal((await f.repo.read('alice')).objects[0].title,'new');assert.equal((await f.repo.read('alice')).objects[0].kind,null);
});
test('service: memory suggestion needs opt-in and explicit acceptance',async t=>{
  const f=await fixture(t,mock(m=>m.at(-1)?.role==='tool'?reply('等待确认'):tool('propose_memory',{text:'先给反例'})));await f.h('/agent/settings','POST',{use_memory:true});const s=await f.session(),r=await f.h('/agent/runs','POST',{session_id:s.id,input:'整理偏好'}),done=await f.finish(r.id);
  assert.equal((await f.h('/agent/memories')).memories.length,0);await f.h('/agent/runs/'+r.id+'/approve','POST',{action_id:done.actions[0].id,decision:'accepted'});const m=(await f.h('/agent/memories')).memories[0];assert.equal(m.text,'先给反例');await f.h('/agent/memories/'+m.id,'PATCH',{remove:true});assert.equal((await f.h('/agent/memories')).memories[0].text,'');
});
test('service: single-note insight is structured, traceable and saved as a separate ai_output',async t=>{
  let id='';const f=await fixture(t,mock(m=>m.at(-1)?.role==='tool'?reply(JSON.stringify({silent:false,title:'试着先开始',summary:'一个局部观察',findings:[{observation:'记录了准备',interpretation:'也许可以先试一次',citations:[id]}],questions:['可以小到哪一步？'],next_step:'试一次',citations:[id]})):tool('read_notes',{ids:[id]})));id=(await f.add('想开始练习')).id;await f.h('/agent/settings','POST',{consent:true});
  const r=await f.h('/agent/insights','POST',{scope:{object_ids:[id]},perspective:'action'}),done=await f.finish(r.id);assert.equal(done.status,'completed');assert.equal(done.insight?.findings.length,1);assert.equal((await f.repo.read('alice')).objects.length,1);
  const saved=await f.h('/agent/runs/'+r.id+'/save','POST',{}),twice=await f.h('/agent/runs/'+r.id+'/save','POST',{});assert.equal(saved.object_id,twice.object_id);const w=await f.repo.read('alice');assert.equal(w.objects.length,2);assert.equal(w.objects.find(o=>o.id===saved.object_id)?.kind,'ai_output');assert.equal(w.objects.find(o=>o.id===id)?.title,'想开始练习');assert.ok(w.relations.some(r=>r.from_id===saved.object_id&&r.to_id===id));
  assert.equal((await f.h('/agent/runs/'+r.id+'/follow-up','POST',{})).session_id,r.session_id);
});
test('service: malformed or unsupported insight never becomes a knowledge object',async t=>{
  const f=await fixture(t,mock(()=>reply('{"silent":false,"findings":[{"observation":"a","interpretation":"b","citations":["invented"]}],"citations":["invented"]}')));await f.add('note');await f.h('/agent/settings','POST',{consent:true});const r=await f.h('/agent/insights','POST',{scope:{},perspective:'patterns'});assert.equal((await f.finish(r.id)).status,'failed');await assert.rejects(f.h('/agent/runs/'+r.id+'/save','POST',{}));assert.equal((await f.repo.read('alice')).objects.length,1);
});
test('service: silent insight can be discussed but cannot be saved as a claimed finding',async t=>{
  const f=await fixture(t,mock(()=>reply('{"silent":true,"summary":"证据不足"}')));await f.add('note');await f.h('/agent/settings','POST',{consent:true});const r=await f.h('/agent/insights','POST',{scope:{},perspective:'patterns'}),done=await f.finish(r.id);assert.equal(done.status,'completed');assert.equal(done.insight?.silent,true);await assert.rejects(f.h('/agent/runs/'+r.id+'/save','POST',{}));
});
test('service: existing session scope immutable; fork, archive, restore, export and purge work',async t=>{
  const f=await fixture(t),s=await f.session(),r=await f.h('/agent/runs','POST',{session_id:s.id,input:'hi'});await f.finish(r.id);await assert.rejects(f.h('/agent/sessions/'+s.id,'PATCH',{scope:{object_ids:[]}}));
  const visible=await f.h('/agent/sessions/'+s.id),branch=await f.h('/agent/sessions/'+s.id+'/fork','POST',{message_id:visible.session.messages[1].id});assert.notEqual(branch.id,s.id);assert.equal(branch.messages.length,2);assert.equal(branch.wire,undefined);
  await f.h('/agent/sessions/'+s.id,'PATCH',{archived:true});await assert.rejects(f.h('/agent/runs','POST',{session_id:s.id,input:'no'}));await f.h('/agent/sessions/'+s.id,'PATCH',{archived:false});assert.ok((await f.h('/agent/sessions/'+s.id+'/export')).session);
  await f.h('/agent/sessions/'+s.id+'/purge','POST',{});assert.equal(record<AgentSession>(await f.repo.read('alice'),s.id,'session').wire?.length,0);assert.equal((await f.h('/agent/runs/'+r.id)).output,'');
});
test('service: retry preserves failed output but does not duplicate the last user message',async t=>{
  let n=0;const f=await fixture(t,mock(()=>{if(++n===1)throw new Error('private internals');return reply('retry success');})),s=await f.session();const r=await f.h('/agent/runs','POST',{session_id:s.id,input:'hello'});assert.equal((await f.finish(r.id)).status,'failed');const next=await f.h('/agent/runs/'+r.id+'/retry','POST',{});assert.equal((await f.finish(next.id)).status,'completed');assert.equal((await f.h('/agent/sessions/'+s.id)).session.messages.length,2);
});
test('HTTP: Agent routes authenticated, same-origin and omit raw private records from bootstrap',async t=>{
  const f=await fixture(t),s=await f.session(),r=await f.h('/agent/runs','POST',{session_id:s.id,input:'hello'});await f.finish(r.id);
  const auth=new JWTAuth('a-long-test-secret-at-least-thirty-two-chars');const server=createDrillServer({repo:f.repo,auth,agent:f.service,assets:new DisabledAssets(),staticDir:f.dir});await new Promise<void>(r=>server.listen(0,'127.0.0.1',r));t.after(()=>{server.closeAllConnections();server.close();});
  const base='http://127.0.0.1:'+(server.address() as any).port;assert.equal((await fetch(base+'/agent/sessions')).status,401);
  const headers={Authorization:'Bearer '+auth.issue('alice')};assert.equal((await fetch(base+'/agent/sessions',{headers:{...headers,Origin:'https://evil.example'}})).status,403);
  const boot=await (await fetch(base+'/bootstrap',{headers})).text();assert.ok(!boot.includes('private-test-reasoning'));assert.ok(!boot.includes('agent_records'));assert.ok(!boot.includes('unit-test-only'));
  assert.equal((await fetch(base+'/agent/runs/'+r.id,{headers:{Authorization:'Bearer '+auth.issue('bob')}})).status,404);
});
test('Postgres DAL: ordinary reads do not load agent histories; opt-in reads bind user id',async()=>{
  const sqls:string[]=[];const client={query:async(sql:string,args?:unknown[])=>{sqls.push(sql);return {rows:sql==='SELECT * FROM users WHERE id=$1'?[{id:'alice',timezone:'UTC',created_at:1,settings:{}}]:[]};},release(){}};
  const repo=new PostgresRepository({connect:async()=>client});await repo.read('alice');assert.ok(!sqls.some(s=>s.startsWith('SELECT * FROM agent_records')));sqls.length=0;await repo.read('alice',{privateAgent:true});assert.ok(sqls.some(s=>s==='SELECT * FROM agent_records WHERE user_id=$1'));assert.ok(sqls.some(s=>s.includes('request.jwt.claims')));
});
test('Harness adapter: isolated official-runtime options, authenticated host bridge and denied shell',async()=>{
  const w=emptyWorkspace('alice',kinds);w.objects=[makeObject('my note','alice',{id:'a'})];let closed=0,home='';const c=context(w);const config=agentConfig({DRILL_AGENT_ENGINE:'harness',DEEPSEEK_API_KEY:'not-a-real-key'});
  const result=await harnessRun(config,[{role:'system',content:'safe prompt'},{role:'user',content:'read my note'}],c,async()=>{},options=>{
    const env=options.env as Record<string,string>;home=String(options.cwd);assert.equal(options.profile,'sdk-minimal');assert.notEqual(home,process.cwd());assert.equal(env.HOME,home);assert.equal(env.DATABASE_URL,undefined);assert.equal(env.NODE_OPTIONS,undefined);
    return {close:async()=>{closed++;},run:async()=>{
      assert.ok((await readFile((options.patches as string[])[0],'utf8')).includes('drill-tools.mjs'));
      const base=env.DRILL_BRIDGE_URL;assert.equal((await fetch(base+'/schemas')).status,403);const headers={Authorization:'Bearer '+env.DRILL_BRIDGE_TOKEN,'Content-Type':'application/json'};
      assert.equal((await fetch(base+'/tool',{method:'POST',headers,body:JSON.stringify({name:'bash',args:{command:'touch bad'}})})).status,400);
      const r=await fetch(base+'/tool',{method:'POST',headers,body:JSON.stringify({name:'search_notes',args:{query:''}})});assert.equal(r.status,200);assert.equal((await r.json() as any).notes[0].id,'a');return {finalResponse:'来自 [note:a]'};
    }};
  });assert.equal(result.text,'来自 [note:a]');assert.equal(closed,1);assert.equal(c.seen.size,1);await assert.rejects(stat(home));
});
test('Harness adapter: cancel closes the owned runtime and cleans up its private home',async()=>{
  const controller=new AbortController(),c=context(undefined,{signal:controller.signal});let rejectRun:(reason:unknown)=>void=()=>{},closed=0,home='';
  const pending=harnessRun(agentConfig({DRILL_AGENT_ENGINE:'harness',DEEPSEEK_API_KEY:'test'}),[{role:'user',content:'hi'}],c,async()=>{},options=>{home=String(options.cwd);return {run:async()=>new Promise((_res,rej)=>{rejectRun=rej;setTimeout(()=>controller.abort(),5);}),close:async()=>{closed++;rejectRun(new Error('closed'));}};});
  await assert.rejects(pending);assert.ok(closed>=1);await assert.rejects(stat(home));
});
test('Harness plugin: final deny guard rejects shell/run_code even when other tool plugins exist',async()=>{
  const oldFetch=globalThis.fetch,oldURL=process.env.DRILL_BRIDGE_URL,oldToken=process.env.DRILL_BRIDGE_TOKEN;let guard:(e:{name:string})=>unknown=()=>{},restrict:any,registered:any[]=[];
  try {
    process.env.DRILL_BRIDGE_URL='http://127.0.0.1:1';process.env.DRILL_BRIDGE_TOKEN='fake';globalThis.fetch=(async()=>Response.json({tools:[{schema:{function:{name:'search_notes',description:'search',parameters:{type:'object',properties:{}}}},readonly:true}]})) as typeof fetch;
    const location=new URL('../integrations/deepseek-harness/drill-tools.mjs',import.meta.url).href;const plugin=await import(location);
    await plugin.apply({tools:{guard:(f:any)=>{guard=f;},register:(t:any)=>registered.push(t),restrict:(r:any)=>{restrict=r;}}});
    assert.ok(guard({name:'bash'}));assert.ok(guard({name:'run_code'}));assert.equal(guard({name:'search_notes'}),undefined);assert.deepEqual(restrict.allow,['search_notes']);assert.equal(registered[0].output.schema.additionalProperties,false);
  } finally {globalThis.fetch=oldFetch;if(oldURL===undefined)delete process.env.DRILL_BRIDGE_URL;else process.env.DRILL_BRIDGE_URL=oldURL;if(oldToken===undefined)delete process.env.DRILL_BRIDGE_TOKEN;else process.env.DRILL_BRIDGE_TOKEN=oldToken;}
});

test('search pagination: later pages remain inside the selected scope',async()=>{
  const w=emptyWorkspace('alice',kinds);w.objects=Array.from({length:27},(_,i)=>makeObject('记录 '+i,'alice',{id:'n'+i,captured_at:i+1}));
  const c=context(w),tools=createTools(c);const first:any=await dispatchTool(tools,'search_notes',{query:'',limit:20},c);
  const second:any=await dispatchTool(tools,'search_notes',{query:'',limit:20,offset:first.next_offset},c);
  assert.equal(first.notes.length,20);assert.equal(second.notes.length,7);assert.equal(second.next_offset,null);
  assert.equal(new Set([...first.notes,...second.notes].map(o=>o.id)).size,27);
});
test('deployment: optional Harness installed at build time and credentials remain server-side',()=>{
  const docker=readFileSync(new URL('../infra/docker/Dockerfile',import.meta.url),'utf8');
  const compose=readFileSync(new URL('../infra/compose/compose.external.yml',import.meta.url),'utf8');
  assert.match(docker,/COPY packages\/recap-ui\/package.json/);assert.match(docker,/ARG DRILL_WITH_HARNESS=false/);
  assert.match(docker,/\/app\/integrations \.\/integrations/);assert.match(compose,/DEEPSEEK_API_KEY: \$\{DEEPSEEK_API_KEY:-\}/);
  assert.match(compose,/DRILL_WITH_HARNESS: \$\{DRILL_WITH_HARNESS:-false\}/);assert.doesNotMatch(compose,/VITE_DEEPSEEK_API_KEY/);
});
test('model routing: Harness subanalysis uses the separately configured REST model',()=>{
  const c=agentConfig({DRILL_AGENT_ENGINE:'harness',DRILL_HARNESS_MODEL:'harness-route',DEEPSEEK_MODEL:'rest-route'});
  assert.equal(c.model,'harness-route');assert.equal(c.nativeModel,'rest-route');
});
