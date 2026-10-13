import React, { useRef, useState } from 'react';
import { Icon } from './icons';
import { Callout, IconButton, EmptyState } from './foundations';
import { Select } from './forms';
import { type KnowledgeObject, type LinkEdge, KIND_LABELS } from '../lib/domain';

export interface AudioPlayerProps { src: string; title: string; transcript?: string; }
export function AudioPlayer({ src, title, transcript }: AudioPlayerProps) {
  const player = useRef<HTMLAudioElement>(null);
  const [rate, setRate] = useState('1'), [error, setError] = useState(false);
  return <section className="rc-audio-player" aria-label={title}><header><Icon name="audio" /><strong>{title}</strong></header>
    <audio ref={player} key={src} controls src={src} preload="metadata" onError={() => setError(true)} onLoadedMetadata={() => setError(false)} aria-label={`${title}播放器`} />
    <Select label="播放速度" value={rate} onValueChange={value => { setRate(value); if (player.current) player.current.playbackRate = Number(value); }}
      options={['0.75', '1', '1.25', '1.5', '2'].map(value => ({ value, label: `${value}×` }))} />
    {error && <Callout tone="danger">音频不可用，请检查文件地址或格式。</Callout>}
    {transcript && <details><summary>查看文字稿</summary><p>{transcript}</p></details>}
  </section>;
}
export interface GraphViewProps { objects: KnowledgeObject[]; edges: LinkEdge[]; onOpen: (id: string) => void; selectedId?: string; }
export function GraphView({ objects, edges, onOpen, selectedId }: GraphViewProps) {
  const [zoom, setZoom] = useState(1);
  if (!objects.length) return <EmptyState icon="graph" title="连接，从一个对象开始" description="创建对象与显式引用后，这里将显示关系。" />;
  const shown = objects.slice(0, 80);
  const nodes = shown.map((object, index) => {
    const angle = index / Math.max(1, shown.length - 1) * Math.PI * 2 - Math.PI / 2;
    return { ...object, x: index === 0 ? 430 : 430 + Math.cos(angle) * (index % 2 ? 250 : 170), y: index === 0 ? 230 : 230 + Math.sin(angle) * (index % 2 ? 150 : 110) };
  });
  const validEdges = edges.filter(edge => nodes.some(node => node.id === edge.from) && nodes.some(node => node.id === edge.to));
  return <div className="rc-graph"><div className="rc-graph-legend">{Array.from(new Set(shown.map(object => object.kind))).map(kind => <span key={kind} data-tone={kind}><span className="rc-dot" />{KIND_LABELS[kind]}</span>)}</div>
    <svg viewBox={`${430 - 430 / zoom} ${230 - 230 / zoom} ${860 / zoom} ${460 / zoom}`} role="group" aria-label="对象关系图，节点可通过键盘打开">
      {validEdges.map((edge, index) => {
        const a = nodes.find(node => node.id === edge.from)!, b = nodes.find(node => node.id === edge.to)!;
        return <line key={`${edge.from}-${edge.to}-${index}`} x1={a.x} y1={a.y} x2={b.x} y2={b.y} className="rc-graph-edge" />;
      })}
      {nodes.map(node => <g key={node.id} className="rc-graph-node" transform={`translate(${node.x},${node.y})`} data-tone={node.kind}
        data-selected={node.id === selectedId || undefined} role="button" tabIndex={0} aria-label={`打开${KIND_LABELS[node.kind]}：${node.title}`}
        onClick={() => onOpen(node.id)} onKeyDown={event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); onOpen(node.id); } }}>
        <circle r={node.id === selectedId ? 16 : 12} /><text y="32" textAnchor="middle">{node.title.slice(0, 16)}</text>
      </g>)}
    </svg><div className="rc-graph-controls"><IconButton icon="plus" label="放大图谱" onClick={() => setZoom(value => Math.min(2, value + 0.2))} /><button type="button" className="rc-button rc-button--ghost rc-button--sm" onClick={() => setZoom(1)} aria-label="重置缩放">{Math.round(zoom * 100)}%</button><IconButton icon="back" label="缩小图谱" onClick={() => setZoom(value => Math.max(0.6, value - 0.2))} /></div>
    {objects.length > 80 && <Callout tone="warning">此轻量视图只显示前 80 个节点。完整大图布局应由应用接入专门的图引擎。</Callout>}
    <details className="rc-graph-fallback"><summary>以文字查看关系（{validEdges.length}）</summary><ul>{validEdges.map((edge, index) => <li key={index}>
      <button type="button" onClick={() => onOpen(edge.from)}>{nodes.find(node => node.id === edge.from)?.title}</button> → {edge.label || '引用'} → <button type="button" onClick={() => onOpen(edge.to)}>{nodes.find(node => node.id === edge.to)?.title}</button>
    </li>)}</ul></details>
  </div>;
}
