import type { Evidence, InsightResult } from '../../../core/src/agent.ts';
import { PERSPECTIVES } from '../../../core/src/agent.ts';
import { DomainError } from '../merge.ts';
export function insightPrompt(perspective:string,custom='') {
  const p=PERSPECTIVES.find(p=>p.id===perspective);if(!p)throw new DomainError('洞察视角无效');
  if(p.id==='custom'&&(!custom.trim()||custom.length>1500))throw new DomainError('请填写 1–1500 字的自定义视角');
  return `请对本次资料范围生成洞察。先 search_notes 和 read_notes 读取证据，再总结。单条笔记也能洞察，但不能从单个例子断言长期模式。
视角：${p.prompt || custom}。
只返回 JSON 对象，不要 Markdown 围栏。结构：
{"silent":false,"title":"简短标题","summary":"概览","findings":[{"observation":"记录中实际发生的事","interpretation":"可能的解释（非诊断）","citations":["原始ID"]}],"questions":["一个值得追问的问题"],"next_step":"可选的低成本尝试","citations":["原始ID"]}。
每条 finding 必须有实际读到的引用。证据不足则返回 silent:true、说明缺口的 summary、空 findings 和 citations；不凑结论。不把相关性写成因果。不要推断人格、疾病或敏感身份。最多四条 findings、三个问题。`;
}
export function parseInsight(text:string,seen:Map<string,Evidence>):InsightResult {
  let out:any;try{out=JSON.parse(text.trim().replace(/^```(?:json)?\s*/,'').replace(/\s*```$/,''));}catch{throw new DomainError('洞察格式未通过验证，未保存。可以重试或更换视角。',502);}
  if(!out||typeof out.silent!=='boolean')throw new DomainError('洞察缺少明确的证据判断',502);
  const s=(v:unknown,max:number)=>typeof v==='string'?v.slice(0,max):'';
  if(out.silent)return {silent:true,title:'这次先不下结论',summary:s(out.summary,3000)||'资料尚不足以支持新的判断。',findings:[],questions:[],next_step:'',citations:[]};
  if(!Array.isArray(out.findings)||!out.findings.length||!Array.isArray(out.citations))throw new DomainError('洞察没有可验证的发现或来源',502);
  const allIds=new Set<string>();
  const findings=out.findings.slice(0,4).map((f:any)=>{
    if(!Array.isArray(f.citations)||!f.citations.length||f.citations.some((id:unknown)=>typeof id!=='string'||!seen.has(id)))throw new DomainError('洞察引用了未读取的资料，已阻止保存。',502);
    f.citations.forEach((id:string)=>allIds.add(id));
    const observation=s(f.observation,1800),interpretation=s(f.interpretation,1800);if(!observation||!interpretation)throw new DomainError('洞察缺少观察或解释',502);
    return {observation,interpretation,citations:[...new Set<string>(f.citations)]};
  });
  if(out.citations.some((id:unknown)=>typeof id!=='string'||!seen.has(id)))throw new DomainError('洞察总引用列表有未验证来源',502);
  return {silent:false,title:s(out.title,160)||'一次新的发现',summary:s(out.summary,3000),findings,
    questions:Array.isArray(out.questions)?out.questions.filter((s:unknown)=>typeof s==='string').slice(0,3).map((s:string)=>s.slice(0,500)):[],
    next_step:s(out.next_step,1200),citations:[...allIds]};
}
export function insightText(o:InsightResult) {return [o.title,o.summary,...o.findings.map(f=>`${f.observation}\n${f.interpretation} ${f.citations.map(id=>'[note:'+id+']').join(' ')}`),...o.questions.map(q=>'值得追问：'+q),o.next_step?'下一小步：'+o.next_step:''].filter(Boolean).join('\n\n');}
