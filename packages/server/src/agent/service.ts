import type { Repository } from '../repository.ts';
import type { Workspace } from '../../../core/src/types.ts';
import type { AgentSession, AgentRun, AgentEvent, AgentAction, AgentMemory, AgentScope, WireMessage } from '../../../core/src/agent.ts';
import { PERSPECTIVES, SKILLS } from '../../../core/src/agent.ts';
import { makeObject, uid } from '../../../core/src/helpers.ts';
import { DomainError, pushBatch, getObject } from '../merge.ts';
import { agentConfig, type AgentConfig } from './config.ts';
import { deepseekCompletion, type Completion } from './provider.ts';
import { record, put, records, runs, sessions, memories, publicSession, recoverExpired } from './store.ts';
import { validateScope, scopedNotes, evidence, citationsIn, sanitizeCitations } from './scope.ts';
import { SYSTEM_PROMPT, nativeRun, prepareHistory } from './engine.ts';
import { metadataChanges, type ToolContext } from './tools.ts';
import { harnessRun, type HarnessFactory } from './harness.ts';
import { insightPrompt, parseInsight, insightText } from './insights.ts';
const active=(r:AgentRun)=>r.status==='queued'||r.status==='running';
const text=(v:unknown,max:number,label='文本')=>{if(typeof v!=='string'||!v.trim()||v.length>max)throw new DomainError(`${label}需要 1–${max} 个字符`);return v.trim();};
export interface ServiceOptions { config?:AgentConfig; completion?:Completion; harnessFactory?:HarnessFactory; fetcher?:typeof fetch }
/** Repository transactions are the authority; no provider call is made while holding a DB lock. */
export class AgentService {
  readonly config:AgentConfig; private readonly repo:Repository; private readonly complete:Completion;
  private readonly options:ServiceOptions;
  private controllers=new Map<string,AbortController>();private tasks=new Set<Promise<void>>();private closed=false;
  constructor(repo:Repository,options:ServiceOptions={}) {this.repo=repo;this.options=options;this.config=options.config??agentConfig();this.complete=options.completion??deepseekCompletion({...this.config,model:this.config.nativeModel},options.fetcher);}
  private async transaction<T>(user:string,fn:(w:Workspace)=>{workspace:Workspace;result:T}|Promise<{workspace:Workspace;result:T}>):Promise<T>{return this.repo.transaction(user,fn,{privateAgent:true});}
  private async updateRun(user:string,id:string,fn:(r:AgentRun,w:Workspace)=>void) {
    return this.transaction(user,w=>{const r=record<AgentRun>(w,id,'run');fn(r,w);put(w,'run',r);return {workspace:w,result:r};});
  }
  private async event(user:string,id:string,type:AgentEvent['type'],label:string,data?:Record<string,unknown>) {
    await this.updateRun(user,id,r=>{if(!active(r))throw new DomainError('运行已经结束',409);r.events.push({seq:++r.next_seq,at:Date.now(),type,label,data});r.events=r.events.slice(-300);r.updated_at=Date.now();r.lease_until=Date.now()+45000;});
  }
  async close() {this.closed=true;for(const c of this.controllers.values())c.abort(new Error('服务正在关闭'));await Promise.allSettled([...this.tasks]);}
  async idle() {await Promise.allSettled([...this.tasks]);}
  async createSession(user:string,b:any):Promise<AgentSession> {
    const mode=['chat','research','plan'].includes(b.mode)?b.mode:'chat';
    const s:AgentSession={id:uid(),title:typeof b.title==='string'?text(b.title,100,'标题'):'新的对话',mode,scope:validateScope(b.scope),messages:[],wire:[],created_at:Date.now(),updated_at:Date.now(),archived:false,allow_web:b.allow_web===true};
    return this.transaction(user,w=>{if(sessions(w).filter(s=>!s.archived).length>=200)throw new DomainError('最多保留 200 个活动对话，请先归档旧对话。');put(w,'session',s);return {workspace:w,result:publicSession(s)};});
  }
  async start(user:string,b:any):Promise<AgentRun> {
    if(this.closed)throw new DomainError('服务正在关闭',503);
    if(!this.config.configured)throw new DomainError('尚未配置 AI。请先在服务端填写 DEEPSEEK_API_KEY。',503);
    if(this.controllers.size>=32)throw new DomainError('服务繁忙，请稍后重试',429);
    const input=text(b.input,12000,'问题'),id=uid(),now=Date.now();
    const kind=b.kind==='insight'?'insight':'chat';
    const r=await this.transaction(user,w=>{
      recoverExpired(w);if(w.user.settings.agent_consent!==true)throw new DomainError('请先确认将所选资料发送给 AI 服务。',403);
      const s=record<AgentSession>(w,text(b.session_id,200,'会话ID'),'session');
      if(s.archived)throw new DomainError('此对话已归档，请恢复或新建。',409);
      const recent=runs(w).filter(r=>now-r.created_at<86400000);
      if(recent.length>=this.config.dailyLimit)throw new DomainError('已达到过去 24 小时的运行额度。',429);
      if(runs(w).filter(active).length>=2||runs(w).some(r=>r.session_id===s.id&&active(r)))throw new DomainError('该对话正在运行，或同时运行数已达上限。',409);
      if(s.messages.length>=160)throw new DomainError('此会话已达到 160 条消息，请分支或新建以控制上下文。',409);
      const next:AgentRun={id,session_id:s.id,kind,status:'queued',input,engine:this.config.engine,output:'',citations:[],web_sources:[],events:[],next_seq:0,actions:[],usage:{prompt_tokens:0,completion_tokens:0,cached_tokens:0},created_at:now,updated_at:now,lease_until:now+45000,scope:s.scope,...(kind==='insight'?{perspective:String(b.perspective??'patterns')}: {})};
      if(b.replace_run_id && s.messages.at(-1)?.run_id===b.replace_run_id)s.messages.pop();
      const display=kind==='insight'?'请按「'+(PERSPECTIVES.find(p=>p.id===next.perspective)?.name??'自定义')+'」视角阅读这些记录。':input;
      s.messages.push({id:uid(),role:'user',text:display,created_at:now,run_id:id});s.updated_at=now;
      if(s.title==='新的对话')s.title=display.slice(0,28);put(w,'session',s);put(w,'run',next);return {workspace:w,result:next};
    });
    const controller=new AbortController();this.controllers.set(id,controller);
    const task=this.execute(user,r,controller).finally(()=>{this.controllers.delete(id);this.tasks.delete(task);});this.tasks.add(task);
    return r;
  }
  private async execute(user:string,initial:AgentRun,controller:AbortController) {
    const id=initial.id,signal=AbortSignal.any([controller.signal,AbortSignal.timeout(this.config.timeoutMs)]);
    const usage={prompt_tokens:0,completion_tokens:0,cached_tokens:0};let output='',lastSave=0;
    const heartbeat=setInterval(()=>{void this.updateRun(user,id,r=>{if(!active(r)){controller.abort();return;}r.lease_until=Date.now()+45000;}).catch(()=>controller.abort());},12000);heartbeat.unref();
    try {
      await this.updateRun(user,id,r=>{if(!active(r))throw new DomainError('运行已取消');r.status='running';});
      const w=await this.repo.read(user,{privateAgent:true}),s=record<AgentSession>(w,initial.session_id,'session');
      const seen=new Map<string,ReturnType<typeof evidence>>(),webSeen:ToolContext['webSeen']=new Map();
      const list=scopedNotes(w,s.scope);
      const hist=prepareHistory(s.wire?.length?s.wire:[],this.config.contextChars);
      if(hist.compacted)await this.event(user,id,'compaction','较早对话已转为截断摘录；保留的最近工具链完整。');
      const event=(type:AgentEvent['type'],label:string,data?:Record<string,unknown>)=>this.event(user,id,type,label,data);
      const addUsage=(n:AgentRun['usage'])=>{for(const k of Object.keys(usage) as (keyof typeof usage)[])usage[k]+=n[k]||0;};
      const context:ToolContext={scope:s.scope,mode:initial.kind==='insight'?'research':s.mode,allowWeb:initial.kind==='chat'&&s.allow_web,webKey:this.config.webKey,
        useMemory:initial.kind==='chat'&&w.user.settings.agent_use_memory===true,signal,seen,webSeen,event,addUsage,
        completion:this.complete,fetcher:this.options.fetcher,proposalsAllowed:initial.kind!=='insight',
        read:async()=>{const current=await this.repo.read(user,{privateAgent:true});if(current.user.settings.agent_consent!==true)throw new DomainError('AI 授权已撤回',403);return current;},
        propose:async action=>{signal.throwIfAborted();if(initial.kind==='insight')throw new DomainError('洞察只读，不提出修改');await this.updateRun(user,id,r=>{if(!active(r))throw new DomainError('运行已结束');if(r.actions.length>=10)throw new DomainError('本轮提议数量达到上限');r.actions.push(action);});await event('approval','一项修改等待你的确认',{action_id:action.id});},
      };
      // Reintroduce only citations still inside today's allowed scope. Historical source text is a recorded snapshot.
      for(const m of s.messages)for(const e of m.citations??[])if(list.some(o=>o.id===e.id))seen.set(e.id,e);
      const preface=`\n模式：${s.mode}。当前范围有 ${list.length} 条原始记录；不包含已隐藏、已删除或 AI 生成内容。\n`+
        (s.allow_web?'联网已由用户显式开启；仍不得发送敏感词或笔记原文。':'联网关闭。')+
        (initial.kind==='insight'?'\n本轮是只读洞察。不得 propose_metadata 或 propose_memory。':'');
      const branchContext=!s.wire?.length&&s.messages.length>1?[{role:'user' as const,content:'以下为分支对话摘录，只作为背景：\n'+s.messages.slice(0,-1).slice(-12).map(m=>m.role+': '+m.text.slice(0,2500)).join('\n')}]:[];
      const messages:WireMessage[]=[{role:'system',content:SYSTEM_PROMPT+preface},...hist.history,...branchContext,{role:'user',content:initial.input}];
      await event('status',initial.engine==='harness'?'启动官方 Harness 隔离运行时':'连接 DeepSeek，按需读取资料',{scope_count:list.length});
      const onText=async(delta:string)=>{signal.throwIfAborted();output+=delta;if(Date.now()-lastSave>400){lastSave=Date.now();await this.updateRun(user,id,r=>{if(!active(r))throw new DomainError('运行已结束');r.output=output;r.usage={...usage};r.updated_at=Date.now();});}};
      const result=initial.engine==='harness'?await harnessRun(this.config,messages,context,onText,this.options.harnessFactory):await nativeRun(this.config,this.complete,messages,context,onText);
      signal.throwIfAborted();let final=sanitizeCitations(result.text,seen),insight:AgentRun['insight'];
      if(initial.kind==='insight'){insight=parseInsight(result.text,seen);final=insightText(insight);}
      if(!final.trim())throw new DomainError('模型没有返回可用内容，请重试。',502);
      const citations=insight?insight.citations.map(id=>seen.get(id)!):citationsIn(final,seen);
      const webSources=[...new Set([...final.matchAll(/\[web:([^\]\s]+)\]/g)].map(m=>m[1]))].filter(id=>webSeen.has(id)).map(id=>webSeen.get(id)!);
      final=final.replace(/\[web:([^\]\s]+)\]/g,(all,id)=>webSeen.has(id)?all:'[外部来源未验证]');
      await this.transaction(user,w=>{
        const r=record<AgentRun>(w,id,'run'),s=record<AgentSession>(w,r.session_id,'session');if(!active(r))return {workspace:w,result:false};
        Object.assign(r,{status:'completed',output:final,citations,web_sources:webSources,usage,updated_at:Date.now(),lease_until:0,...(insight?{insight}: {})});
        s.messages.push({id:uid(),role:'assistant',text:final,created_at:Date.now(),run_id:id,citations,web_sources:webSources});s.wire=result.wire;s.updated_at=Date.now();
        put(w,'run',r);put(w,'session',s);return {workspace:w,result:true};
      });
    } catch(e) {
      await this.updateRun(user,id,r=>{if(!active(r))return;
        r.status=controller.signal.aborted?'cancelled':'failed';r.output=output;r.usage=usage;r.updated_at=Date.now();r.lease_until=0;
        r.error=signal.aborted?(controller.signal.aborted?'运行已停止，部分输出已保留。':'本轮超时，已停止；缩小范围后可以重试。'):e instanceof DomainError?e.message:'运行失败。请查看服务配置或重试（密钥及原始响应不会写入错误消息）。';
      }).catch(()=>{/* Storage outage: lease expiry makes the interruption explicit on next read. */});
    } finally {clearInterval(heartbeat);}
  }
  async handle(user:string,path:string,method:string,params:URLSearchParams,b:any):Promise<unknown> {
    if(!b||typeof b!=='object'||Array.isArray(b))throw new DomainError('请求正文无效');
    if(path==='/agent/capabilities'&&method==='GET') {
      const w=await this.repo.read(user,{privateAgent:true});return {configured:this.config.configured,engine:this.config.engine,model:this.config.model,thinking:this.config.engine==='harness'||this.config.thinking,web_configured:!!this.config.webKey,consent:w.user.settings.agent_consent===true,use_memory:w.user.settings.agent_use_memory===true,max_steps:this.config.maxSteps,daily_limit:this.config.dailyLimit,harness_version:this.config.harnessVersion,skills:SKILLS,perspectives:PERSPECTIVES};
    }
    if(path==='/agent/settings'&&method==='POST')return this.transaction(user,w=>{
      if(typeof b.consent==='boolean') {
        w.user.settings.agent_consent=b.consent;
        if(!b.consent) for(const r of runs(w).filter(active)) { r.status='cancelled'; r.error='你撤回了 AI 资料授权，运行已停止。'; r.lease_until=0; put(w,'run',r); this.controllers.get(r.id)?.abort(); }
      }
      if(typeof b.use_memory==='boolean')w.user.settings.agent_use_memory=b.use_memory;
      return {workspace:w,result:{consent:w.user.settings.agent_consent===true,use_memory:w.user.settings.agent_use_memory===true}};
    });
    if(path==='/agent/scope'&&method==='POST') {const list=scopedNotes(await this.repo.read(user,{privateAgent:true}),validateScope(b.scope));return {count:list.length,notes:list.slice(0,100).map(o=>({id:o.id,title:o.title})),truncated:list.length>100};}
    if(path==='/agent/sessions') {
      if(method==='POST')return this.createSession(user,b);
      if(method==='GET')return this.transaction(user,w=>{recoverExpired(w);return {workspace:w,result:{sessions:sessions(w).filter(s=>params.get('archived')==='true'?s.archived:!s.archived).sort((a,b)=>b.updated_at-a.updated_at).slice(0,200).map(s=>({...publicSession(s),messages:[],message_count:s.messages.length})),runs:runs(w).filter(active).map(r=>({id:r.id,session_id:r.session_id,status:r.status}))}};});
    }
    if(path==='/agent/runs'&&method==='POST')return this.start(user,{...b,kind:'chat',replace_run_id:undefined});
    if(path==='/agent/insights') {
      if(method==='GET') {const w=await this.repo.read(user,{privateAgent:true});return {insights:runs(w).filter(r=>r.kind==='insight'&&r.input).sort((a,b)=>b.created_at-a.created_at).slice(0,100)};}
      if(method==='POST'){const perspective=String(b.perspective??'patterns'),input=insightPrompt(perspective,typeof b.custom==='string'?b.custom:'');
        const scope=validateScope(b.scope);if(!scopedNotes(await this.repo.read(user,{privateAgent:true}),scope).length)throw new DomainError('这个范围没有可读取的原始记录。请选择其他范围。');
        const s=await this.createSession(user,{scope,mode:'research',title:'洞察 · '+(PERSPECTIVES.find(p=>p.id===perspective)?.name??'自定义')});return this.start(user,{input,session_id:s.id,kind:'insight',perspective});}
    }
    if(path==='/agent/memories') {
      if(method==='GET')return {memories:memories(await this.repo.read(user,{privateAgent:true}))};
      if(method==='POST')return this.transaction(user,w=>{if(memories(w).filter(m=>m.text).length>=100)throw new DomainError('个人记忆最多 100 条，请先清理');const m:AgentMemory={id:uid(),text:text(b.text,1200),created_at:Date.now(),disabled:false};put(w,'memory',m);return {workspace:w,result:m};});
    }
    const mem=path.match(/^\/agent\/memories\/([^/]+)$/);
    if(mem && method==='PATCH')return this.transaction(user,w=>{const m=record<AgentMemory>(w,mem[1],'memory');if(b.remove===true){m.text='';m.disabled=true;}else {if(typeof b.disabled==='boolean')m.disabled=b.disabled;if(b.text!==undefined)m.text=text(b.text,1200);}put(w,'memory',m);return {workspace:w,result:m};});
    const sm=path.match(/^\/agent\/sessions\/([^/]+)(?:\/(fork|export|purge))?$/);
    if(sm) {
      if(method==='GET') {const w=await this.repo.read(user,{privateAgent:true}),s=record<AgentSession>(w,sm[1],'session');if(sm[2]==='export')return {version:1,session:publicSession(s)};return {session:publicSession(s),runs:runs(w).filter(r=>r.session_id===s.id).sort((a,b)=>a.created_at-b.created_at)};}
      if(method==='PATCH')return this.transaction(user,w=>{const s=record<AgentSession>(w,sm[1],'session');if(runs(w).some(r=>r.session_id===s.id&&active(r)))throw new DomainError('请先停止正在进行的分析',409);if(b.title!==undefined)s.title=text(b.title,100,'标题');if(typeof b.archived==='boolean')s.archived=b.archived;
        if(b.mode!==undefined){if(!['chat','plan','research'].includes(b.mode))throw new DomainError('模式无效');s.mode=b.mode;}
        if(typeof b.allow_web==='boolean')s.allow_web=b.allow_web;
        if(b.scope!==undefined){if(s.messages.length)throw new DomainError('已有对话的资料范围不可变；请新建对话。',409);s.scope=validateScope(b.scope);}s.updated_at=Date.now();put(w,'session',s);return {workspace:w,result:publicSession(s)};});
      if(method==='POST'&&sm[2]==='fork')return this.transaction(user,w=>{if(sessions(w).filter(s=>!s.archived).length>=200)throw new DomainError('最多保留 200 个活动对话，请先归档旧对话。');const old=record<AgentSession>(w,sm[1],'session'),index=old.messages.findIndex(m=>m.id===b.message_id);if(index<0)throw new DomainError('分支起点不存在');
        const s:AgentSession={...structuredClone(old),id:uid(),title:old.title.slice(0,80)+' · 分支',messages:old.messages.slice(0,index+1),wire:[],archived:false,created_at:Date.now(),updated_at:Date.now()};put(w,'session',s);return {workspace:w,result:publicSession(s)};});
      if(method==='POST'&&sm[2]==='purge')return this.transaction(user,w=>{const s=record<AgentSession>(w,sm[1],'session');if(runs(w).some(r=>r.session_id===s.id&&active(r)))throw new DomainError('请先停止运行',409);
        s.messages=[];s.wire=[];s.title='已清除的对话';s.scope={};s.archived=true;put(w,'session',s);
        for(const r of runs(w).filter(r=>r.session_id===s.id)){r.input='';r.output='';r.events=[];r.actions=[];r.citations=[];r.web_sources=[];r.scope={};delete r.insight;delete r.error;put(w,'run',r);}return {workspace:w,result:{ok:true,note:'已清除服务中的对话与私有协议历史；单独保存的 AI 对象不受影响。'}};});
    }
    const rm=path.match(/^\/agent\/runs\/([^/]+)(?:\/(cancel|retry|save|feedback|follow-up|approve))?$/);
    if(rm) {
      const id=rm[1],action=rm[2];
      if(method==='GET')return this.transaction(user,w=>{recoverExpired(w);const r=record<AgentRun>(w,id,'run'),after=Math.max(0,Number(params.get('after'))||0);return {workspace:w,result:{...r,events:r.events.filter(e=>e.seq>after),events_reset:after>0&&!!r.events.length&&after<r.events[0].seq-1}};});
      if(method==='POST'&&action==='cancel'){const out=await this.updateRun(user,id,r=>{if(active(r)){r.status='cancelled';r.error='你已停止本轮运行。';r.updated_at=Date.now();r.lease_until=0;}});this.controllers.get(id)?.abort();return out;}
      if(method==='POST'&&action==='retry'){const r=record<AgentRun>(await this.repo.read(user,{privateAgent:true}),id,'run');if(!['failed','cancelled','interrupted'].includes(r.status)||!r.input)throw new DomainError('只有未完成的运行可以重试',409);return this.start(user,{input:r.input,session_id:r.session_id,kind:r.kind,perspective:r.perspective,replace_run_id:r.id});}
      if(method==='POST'&&action==='follow-up'){const w=await this.repo.read(user,{privateAgent:true}),r=record<AgentRun>(w,id,'run');if(r.status!=='completed')throw new DomainError('请等待分析完成');return {session_id:r.session_id};}
      if(method==='POST'&&action==='feedback')return this.updateRun(user,id,r=>{if(!['helpful','not_helpful'].includes(b.value))throw new DomainError('反馈值无效');r.feedback=b.value;});
      if(method==='POST'&&action==='save')return this.saveOutput(user,id);
      if(method==='POST'&&action==='approve')return this.approve(user,id,b);
    }
    throw new DomainError('Agent 接口不存在',404);
  }
  private async saveOutput(user:string,id:string) {
    return this.transaction(user,w=>{
      const r=record<AgentRun>(w,id,'run');if(r.saved_object_id)return {workspace:w,result:{object_id:r.saved_object_id}};
      if(r.status!=='completed'||!r.output||r.insight?.silent)throw new DomainError('没有可保存的完整输出');
      for(const e of r.citations)getObject(w,e.id);
      const s=record<AgentSession>(w,r.session_id,'session');
      const o=makeObject(r.insight?.title??s.title,user,{kind:'ai_output',body:r.output,extra:{agent_run_id:r.id,engine:r.engine,citations:r.citations.map(e=>e.id),source_snapshots:r.citations,web_sources:r.web_sources,generated_at:Date.now()}});
      const change=(field:string,value:any)=>({mutation_id:uid(),object_id:o.id,base_rev:0,client_ts:Date.now(),field,value});
      let next=pushBatch(w,[change('create',o)],'agent-output','ai').workspace;
      for(const e of r.citations)next=pushBatch(next,[{...change('relation',{to_id:e.id,type:'cite'}),base_rev:getObject(next,o.id).rev}],'agent-citations').workspace;
      const stored=record<AgentRun>(next,id,'run');stored.saved_object_id=o.id;put(next,'run',stored);return {workspace:next,result:{object_id:o.id}};
    });
  }
  private async approve(user:string,id:string,b:any) {
    return this.transaction(user,w=>{
      const r=record<AgentRun>(w,id,'run'),a=r.actions.find(a=>a.id===b.action_id);if(!a)throw new DomainError('提议不存在',404);
      if(a.status!=='pending')return {workspace:w,result:a}; // Idempotent repeated click.
      if(b.decision==='rejected'){a.status='rejected';put(w,'run',r);return {workspace:w,result:a};}
      if(b.decision!=='accepted')throw new DomainError('需要明确的采纳或拒绝决定');
      if(active(r))throw new DomainError('分析仍在进行，请等待完成后确认',409);
      if(r.status!=='completed')throw new DomainError('未完成运行的提议不能采纳，请重试',409);
      let next=w;
      if(a.type==='metadata'){
        const o=getObject(w,a.object_id!);if(o.rev!==a.base_rev){a.status='stale';put(w,'run',r);return {workspace:w,result:a};}
        const eligible=scopedNotes(w,r.scope);
        if(!eligible.some(o=>o.id===a.object_id)||a.field==='belongs'&&!eligible.some(o=>o.id===a.value))throw new DomainError('对象已不在可用范围内',409);
        next=pushBatch(w,metadataChanges(w,a),'agent-user-confirmation').workspace;
      } else {
        if(memories(w).filter(m=>m.text).length>=100)throw new DomainError('记忆数量已达上限');
        put(next,'memory',{id:uid(),text:text(a.value,1200),created_at:Date.now(),disabled:false});
      }
      const rr=record<AgentRun>(next,id,'run'),aa=rr.actions.find(x=>x.id===a.id)!;aa.status='accepted';put(next,'run',rr);return {workspace:next,result:aa};
    });
  }
}
