import React, { useCallback, useEffect, useState } from 'react';
import { Button, Badge, Surface } from '@recap/ui';
import { request, isDesktop } from '../api.ts';
import { Icon } from '../Icon.tsx';
import type { AgentCapabilities, AgentRun, AgentScope, AgentAction, Evidence, WebEvidence } from '../../../core/src/agent.ts';
import type { KnowledgeObject, Relation } from '../../../core/src/types.ts';
export const ongoing = (run:AgentRun|null|undefined) => !!run && ['queued','running'].includes(run.status);
export const statusName:Record<string,string>={queued:'等待开始',running:'正在分析',completed:'已完成',failed:'未完成',cancelled:'已停止',interrupted:'运行中断'};
export function useCapabilities() {
  const [caps,setCaps]=useState<AgentCapabilities|null>(null),[error,setError]=useState('');
  const refresh=useCallback(async()=>{try{setCaps(await request('/agent/capabilities'));setError('');}catch(e:any){setError(e.message);}},[]);
  useEffect(()=>{void refresh();},[refresh]);return {caps,error,refresh};
}
/** Polling carries the same cumulative snapshots over Web and the Electron JSON IPC bridge. */
export function useAgentRun(id:string|null) {
  const [run,setRun]=useState<AgentRun|null>(null),[error,setError]=useState(''),[revision,bump]=useState(0);
  useEffect(()=>{
    let disposed=false,timer:ReturnType<typeof setTimeout>|undefined;setRun(null);setError('');
    if(!id)return;
    const poll=async()=>{try{const next:AgentRun=await request('/agent/runs/'+encodeURIComponent(id));if(disposed)return;setRun(next);setError('');if(ongoing(next))timer=setTimeout(poll,650);}catch(e:any){if(!disposed){setError(e.message);timer=setTimeout(poll,3000);}}};
    void poll();return()=>{disposed=true;if(timer)clearTimeout(timer);};
  },[id,revision]);return {run,error,refresh:()=>bump(v=>v+1)};
}
export function ConnectionGate({caps,error,refresh,onSettings}:{caps:AgentCapabilities|null;error:string;refresh:()=>Promise<void>;onSettings:()=>void}) {
  const [busy,setBusy]=useState(false),[failure,setFailure]=useState('');
  if(error)return <div className="agent-notice" role="alert"><Icon name="help"/><span>{isDesktop()?'Agent 需要连接同一个 Drill 后端；尚未同步的本地记录不可用。':'无法连接 Agent 服务。'} {error}</span><Button size="sm" onClick={onSettings}>检查连接</Button></div>;
  if(!caps)return <p className="agent-muted" role="status">正在检查 Agent 服务…</p>;
  if(!caps.configured)return <div className="agent-notice"><Icon name="spark"/><div><strong>接上 DeepSeek，开始一起思考</strong><p>请在服务端配置密钥和模型。密钥不会保存在网页或对话里。</p></div><Button size="sm" onClick={onSettings}>查看设置</Button></div>;
  if(!caps.consent)return <Surface className="agent-consent"><Icon name="eye"/><div><strong>由你决定，哪些记录可以被读取</strong><p>开启后，问题、对话上下文及所选范围中检索到的资料会发送至 AI 提供商。原文不会被自动修改。联网搜索和个人记忆需另外开启。</p><Button disabled={busy} onClick={async()=>{setBusy(true);try{await request('/agent/settings','POST',{consent:true});await refresh();}catch(e:any){setFailure(e.message);}finally{setBusy(false);}}}>同意并启用 Agent</Button>{failure&&<p role="alert">{failure}</p>}</div></Surface>;
  return null;
}
export function ScopePicker({objects,relations=[],value,onChange,disabled=false}:{objects:KnowledgeObject[];relations?:Relation[];value:AgentScope;onChange:(s:AgentScope)=>void;disabled?:boolean}) {
  const derive=()=>value.object_ids?'selection':value.belongs?'project':value.canvas_id?'canvas':value.tags?.length?'tag':value.until?'dates':value.since?(Date.now()-value.since>25*86400000?'month':'week'):'all';
  const [mode,setMode]=useState(derive),[query,setQuery]=useState('');
  useEffect(()=>{setMode(derive());},[JSON.stringify(value)]);
  const dateValue=(time:number|undefined)=>{if(time===undefined)return '';const d=new Date(time);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const eligible=objects.filter(o=>!o.deleted_at&&!o.ephemeral&&o.kind!=='ai_output'&&o.form!=='canvas'&&o.kind!=='group');
  const tags=[...new Set(eligible.flatMap(o=>o.tags_cached))].sort();
  const changeMode=(m:string)=>{setMode(m);onChange(m==='week'?{since:Date.now()-7*86400000}:m==='month'?{since:Date.now()-30*86400000}:m==='selection'?{object_ids:[]}:m==='project'?{belongs:eligible.find(o=>['project','domain'].includes(o.kind??''))?.id??'__no_available_container__'}:m==='canvas'?{canvas_id:objects.find(o=>o.form==='canvas')?.id??'__no_available_canvas__'}:m==='tag'?{tags:tags.slice(0,1)}:m==='dates'?{since:Date.now()-7*86400000,until:Date.now()}:{});};
  return <fieldset className="agent-scope" disabled={disabled}><legend>资料范围</legend><div className="agent-inline"><select aria-label="资料范围" value={mode} onChange={e=>changeMode(e.target.value)}><option value="all">全部原始记录</option><option value="week">最近 7 天</option><option value="month">最近 30 天</option><option value="selection">选择一条或多条</option><option value="project">领域 / 项目</option><option value="canvas">画布中的记录</option><option value="tag">按标签</option><option value="dates">自定义日期</option></select>
    {mode==='project'&&<select aria-label="选择领域或项目" value={value.belongs??''} onChange={e=>onChange({belongs:e.target.value})}><option value="" disabled>选择领域或项目</option>{eligible.filter(o=>['project','domain'].includes(o.kind??'')).map(o=><option key={o.id} value={o.id}>{o.title}</option>)}</select>}
    {mode==='canvas'&&<select aria-label="选择画布" value={value.canvas_id??''} onChange={e=>onChange({canvas_id:e.target.value})}><option value="" disabled>选择画布</option>{objects.filter(o=>!o.deleted_at&&o.form==='canvas').map(o=><option key={o.id} value={o.id}>{o.title}</option>)}</select>}
    {mode==='tag'&&<select aria-label="选择标签" value={value.tags?.[0]??''} onChange={e=>onChange({tags:[e.target.value]})}><option value="" disabled>选择标签</option>{tags.map(t=><option key={t} value={t}>#{t}</option>)}</select>}
    {mode==='dates'&&<><input aria-label="开始日期" type="date" value={dateValue(value.since)} onChange={e=>{if(e.target.value)onChange({...value,since:new Date(e.target.value+'T00:00:00').getTime()});}}/><span>至</span><input aria-label="结束日期" type="date" value={dateValue(value.until)} onChange={e=>{if(e.target.value)onChange({...value,until:new Date(e.target.value+'T23:59:59.999').getTime()});}}/></>}
    </div>{mode==='selection'&&<details className="agent-note-picker" open={!value.object_ids?.length}><summary>已选择 {value.object_ids?.length??0} 条记录</summary><input aria-label="筛选可选记录" placeholder="搜索标题…" value={query} onChange={e=>setQuery(e.target.value)}/><div>{eligible.filter(o=>o.title.toLowerCase().includes(query.toLowerCase())).slice(0,100).map(o=><label key={o.id}><input type="checkbox" checked={value.object_ids?.includes(o.id)??false} onChange={e=>onChange({object_ids:e.target.checked?[...value.object_ids??[],o.id]:(value.object_ids??[]).filter(id=>id!==o.id)})}/><span>{o.title}</span></label>)}</div>{value.object_ids?.length===1&&<Button size="sm" variant="ghost" onClick={()=>{const id=value.object_ids![0],related=relations.filter(r=>!r.deleted_at&&(r.from_id===id||r.to_id===id)).flatMap(r=>[r.from_id,r.to_id]);onChange({object_ids:[...new Set([id,...related])].filter(id=>eligible.some(o=>o.id===id)).slice(0,100)});}}>也选择直接关联的记录</Button>}</details>}
    <small>新检索不读取隐藏、删除、临时或 AI 生成的内容。日期按当前设备时区计算。</small></fieldset>;
}
function Inline({text,citations,webSources,onOpen}:{text:string;citations:Evidence[];webSources:WebEvidence[];onOpen:(id:string)=>void}) {
  const pieces=text.split(/(\[note:[^\]\s]+\]|\[web:[^\]\s]+\]|\*\*[^*]+\*\*)/g);
  return <>{pieces.map((p,i)=>{
    const m=p.match(/^\[(note|web):([^\]]+)\]$/);
    if(m?.[1]==='note'){const index=citations.findIndex(e=>e.id===m[2]);return index<0?<span key={i}>[来源未验证]</span>:<button className="agent-inline-cite" key={i} onClick={()=>onOpen(m[2])} title={citations[index].title}>{index+1}</button>;}
    if(m?.[1]==='web'){const e=webSources.find(e=>e.id===m[2]);return e?<a className="agent-inline-cite" key={i} href={e.url} target="_blank" rel="noopener noreferrer" title={e.title}>↗</a>:<span key={i}>[外部来源未验证]</span>;}
    if(p.startsWith('**')&&p.endsWith('**'))return <strong key={i}>{p.slice(2,-2)}</strong>;
    return <React.Fragment key={i}>{p}</React.Fragment>;
  })}</>;
}
export function AgentText({text,citations=[],webSources=[],onOpen}:{text:string;citations?:Evidence[];webSources?:WebEvidence[];onOpen:(id:string)=>void}) {
  return <div className="agent-prose">{text.split(/\n{2,}/).map((p,i)=>p.startsWith('```')?<pre key={i}>{p.replace(/^```[^\n]*\n?/,'').replace(/```$/,'')}</pre>:<p key={i}><Inline text={p.replace(/^#{1,4} /,'')} citations={citations} webSources={webSources} onOpen={onOpen}/></p>)}</div>;
}
export function SourceList({citations,onOpen}:{citations:Evidence[];onOpen:(id:string)=>void}) {
  if(!citations.length)return null;return <details className="agent-sources"><summary><Icon name="link" size={14}/> 依据 {citations.length} 条原始记录</summary>{citations.map((e,i)=><button key={e.id} onClick={()=>onOpen(e.id)}><span className="agent-source-index">{i+1}</span><span><strong>{e.title}</strong><small>{e.excerpt.slice(0,120)||'只有标题'} · 版本 {e.rev}</small></span><Icon name="arrow" size={14}/></button>)}</details>;
}
export function RunTrace({run}:{run:AgentRun}) {
  const plan=run.events.filter(e=>e.type==='plan').at(-1)?.data?.steps as {title:string;status:string}[]|undefined;
  return <details className="agent-trace"><summary><Icon name="list" size={14}/>{statusName[run.status]} · {run.events.filter(e=>e.type==='tool_start').length} 次工具调用<span>{run.engine==='harness'?'官方 Harness':`${run.usage.prompt_tokens+run.usage.completion_tokens} tokens`}</span></summary>{plan&&<ol className="agent-plan">{plan.map((p,i)=><li key={i} data-state={p.status}><Icon name={p.status==='done'?'check':p.status==='active'?'clock':'minus'} size={13}/>{p.title}</li>)}</ol>}<ol>{run.events.map(e=><li key={e.seq}><span>{new Date(e.at).toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'})}</span>{e.label}</li>)}</ol><small>不显示原始思考链或服务凭证。缓存命中：{run.usage.cached_tokens} tokens；子分析计入原生引擎总用量。</small></details>;
}
export function ActionCards({run,onChange,onOpen}:{run:AgentRun;onChange:()=>void;onOpen?:(id:string)=>void}) {
  const [busy,setBusy]=useState(''),[error,setError]=useState('');
  if(!run.actions.length)return null;
  const decide=async(a:AgentAction,decision:string)=>{setBusy(a.id);setError('');try{await request('/agent/runs/'+run.id+'/approve','POST',{action_id:a.id,decision});onChange();}catch(e:any){setError(e.message);}finally{setBusy('');}};
  return <div className="agent-actions">{run.actions.map(a=><Surface key={a.id} className="agent-action-card"><div className="agent-inline"><Icon name={a.type==='memory'?'memory':'eye'}/><strong>{a.type==='memory'?'建议记住这件事':'属性调整提议'}</strong><Badge>{({pending:'尚未修改',accepted:'已采纳',rejected:'已拒绝',stale:'原记录已变化'})[a.status]}</Badge></div>{a.object_id&&<button className="agent-action-target" onClick={()=>onOpen?.(a.object_id!)}>{a.object_title??a.object_id}</button>}{a.field&&<small>字段：{a.field} · 基于版本 {a.base_rev}{a.field==='tags'?' · 追加标签（保留已有标签）':''}</small>}<div className="agent-diff">{a.type==='metadata'&&<del>{JSON.stringify(a.before)}</del>}<ins>{typeof a.value==='string'?a.value:JSON.stringify(a.value)}</ins></div>{a.status==='pending'&&<div className="agent-inline"><Button size="sm" variant="primary" disabled={busy===a.id||run.status!=='completed'} onClick={()=>void decide(a,'accepted')}>确认采纳</Button><Button size="sm" variant="ghost" disabled={busy===a.id} onClick={()=>void decide(a,'rejected')}>不采纳</Button></div>}{a.status==='stale'&&<small>没有覆盖新版本。请重新分析后再确认。</small>}</Surface>)}{error&&<p className="agent-error" role="alert">{error}</p>}</div>;
}
export function exportJSON(filename:string,data:unknown) {const u=URL.createObjectURL(new Blob([JSON.stringify(data,null,2)],{type:'application/json'}));const a=document.createElement('a');a.href=u;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(u),1000);}
