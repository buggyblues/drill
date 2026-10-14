import { setTimeout as sleep } from 'node:timers/promises';
import type { WireMessage, ToolCall, AgentRun } from '../../../core/src/agent.ts';
import type { AgentConfig } from './config.ts';
import { checkProviderURL } from './config.ts';
import { DomainError } from '../merge.ts';
export type ToolSchema = { type: 'function'; function: { name: string; description: string; parameters: Record<string,unknown> } };
export type ModelResult = { message: WireMessage; usage: AgentRun['usage']; finishReason: string };
export type Completion = (messages: WireMessage[], tools: ToolSchema[], signal: AbortSignal, onText: (s:string)=>Promise<void>, onRetry?: (n:number)=>Promise<void>)=>Promise<ModelResult>;
/** UTF-8 streaming SSE parser. Handles fragmented lines, comments, CRLF and multiline data. */
export async function* sseData(stream: ReadableStream<Uint8Array>, signal: AbortSignal): AsyncGenerator<string> {
  const reader = stream.getReader(), decoder = new TextDecoder(); let buf='', data:string[]=[];
  const abort = () => { void reader.cancel(signal.reason).catch(() => {}); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    for (;;) {
      signal.throwIfAborted(); const {done,value}=await reader.read(); signal.throwIfAborted(); buf+=done ? decoder.decode() : decoder.decode(value,{stream:true});
      let nl:number;
      while ((nl=buf.indexOf('\n'))>=0) { const line=buf.slice(0,nl).replace(/\r$/,''); buf=buf.slice(nl+1);
        if (!line) { if (data.length) {yield data.join('\n');data=[];} }
        else if (line.startsWith('data:')) data.push(line.slice(5).replace(/^ /,''));
      }
      if (buf.length>1024*1024) throw new DomainError('模型数据帧过大',502);
      if (done) {if(buf.startsWith('data:')) data.push(buf.slice(5).trimStart()); if(data.length)yield data.join('\n');break;}
    }
  } finally { signal.removeEventListener('abort', abort); await reader.cancel().catch(()=>{}); reader.releaseLock(); }
}
export function deepseekCompletion(config: AgentConfig, fetcher: typeof fetch = fetch): Completion {
  return async (messages, tools, signal, onText, onRetry) => {
    if (!config.key) throw new DomainError('尚未配置 DEEPSEEK_API_KEY。请在服务端配置，不要填入浏览器。',503);
    checkProviderURL(config.base);
    let response: Response | undefined;
    for (let attempt=0;attempt<3;attempt++) {
      signal.throwIfAborted();
      try {
        response = await fetcher(config.base+'/chat/completions', {method:'POST',signal,
          headers:{Authorization:'Bearer '+config.key,'Content-Type':'application/json'},
          body:JSON.stringify({model:config.model,messages,stream:true,stream_options:{include_usage:true},max_tokens:config.maxTokens,
            thinking:{type:config.thinking?'enabled':'disabled'},...(config.thinking?{reasoning_effort:config.effort}:{temperature:0.3}),
            ...(tools.length?{tools}:{}),}),});
      } catch(e) {if(signal.aborted)throw e;if(attempt===2)throw new DomainError('无法连接 AI 服务，请检查服务端网络和地址。',502);}
      if (response?.ok) break;
      if (response && ![429,500,502,503,504].includes(response.status)) {
        const code=response.status; await response.body?.cancel();
        throw new DomainError(code===401||code===403?'AI 服务密钥无效或没有模型访问权限。':code===402?'AI 服务余额不足。':`AI 服务拒绝请求（HTTP ${code}）；请检查模型名和协议配置。`,502);
      }
      await response?.body?.cancel();
      if(attempt===2)throw new DomainError('AI 服务繁忙，已达到重试上限。',502);
      await onRetry?.(attempt+1); await sleep(500*2**attempt,undefined,{signal});
    }
    if(!response?.body)throw new DomainError('AI 服务未返回响应流',502);
    let text='', reasoning='', finishReason=''; const calls=new Map<number,ToolCall>();
    const usage={prompt_tokens:0,completion_tokens:0,cached_tokens:0}; let ended=false;
    for await (const data of sseData(response.body,signal)) {
      if(data==='[DONE]'){ended=true;break;}
      let c:any;try{c=JSON.parse(data);}catch{throw new DomainError('AI 响应流格式错误，请重试。',502);}
      if(c.error)throw new DomainError('AI 服务在生成过程中返回错误，请重试。',502);
      if(c.usage){usage.prompt_tokens=Number(c.usage.prompt_tokens)||0;usage.completion_tokens=Number(c.usage.completion_tokens)||0;usage.cached_tokens=Number(c.usage.prompt_cache_hit_tokens)||0;}
      const choice=c.choices?.[0],d=choice?.delta??{};
      if(typeof d.content==='string'){text+=d.content;await onText(d.content);}
      if(typeof d.reasoning_content==='string')reasoning+=d.reasoning_content;
      for(const t of d.tool_calls??[]) {
        if(!Number.isInteger(t.index)||t.index<0||t.index>31)throw new DomainError('工具调用数量或索引无效',502);
        const old=calls.get(t.index)??{id:'',type:'function' as const,function:{name:'',arguments:''}};
        if(t.id)old.id+=String(t.id); if(t.function?.name)old.function.name+=String(t.function.name); if(t.function?.arguments)old.function.arguments+=String(t.function.arguments);
        if(old.function.arguments.length>24000)throw new DomainError('工具参数超过安全上限',502);calls.set(t.index,old);
      }
      if(choice?.finish_reason)finishReason=choice.finish_reason;
      if(text.length+reasoning.length>1000000)throw new DomainError('模型输出超过本次预算',502);
    }
    if(!ended&&!finishReason)throw new DomainError('AI 流意外中断，已保留部分输出；不会自动重复工具操作。',502);
    if(finishReason==='length')throw new DomainError('模型达到输出上限，结果未完成。缩小资料范围后重试。',502);
    const tc=[...calls.values()];if(tc.some(c=>!c.id||!c.function.name))throw new DomainError('模型返回了不完整的工具调用',502);
    return {message:{role:'assistant',content:text,...(reasoning?{reasoning_content:reasoning}:{}),...(tc.length?{tool_calls:tc}:{})},usage,finishReason};
  };
}
