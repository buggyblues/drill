export type Form = 'text' | 'image' | 'audio' | 'video' | 'link' | 'canvas';
export type JSONValue = null | boolean | number | string | JSONValue[] | {
    [key: string]: JSONValue;
};
export type Property = {
    type: 'text' | 'number' | 'checkbox' | 'datetime' | 'label' | 'object';
    label?: string;
    options?: string[];
    kinds?: string[];
    required?: boolean;
    multiple?: boolean;
};
/** 对象之间只有这两种边。belongs = 归属（from 归属于 to）；cite = 引用（from 引用了 to）。 */
export type RelationType = 'belongs' | 'cite';
/** 一种 kind 允许建立的关系。targets 为空数组表示不允许这种关系。 */
export type RelationRule = {
    targets: string[];
    multiple?: boolean;
};
export type Kind = {
    id: string;
    label: string;
    icon: string;
    color: string;
    properties: Record<string, Property>;
    relations?: Record<string, RelationRule>;
    sort: number;
};
export type Clock = {
    ts: number;
    device: string;
};
export type Block = {
    id: string;
    key: string;
    text: string;
    deleted_at?: number | null;
};
export interface KnowledgeObject {
    id: string;
    user_id: string;
    kind: string | null;
    form: Form;
    title: string;
    body: string;
    body_blocks: {
        blocks: Block[];
    };
    series: string | null;
    tags_cached: string[];
    status: string | null;
    due_at: number | null;
    sort_key: string | null;
    supersedes_id: string | null;
    applies_to: string[];
    ephemeral: boolean;
    asset_id: string | null;
    source_id: string | null;
    source_ref: string | null;
    source_version: string | null;
    extra: Record<string, any>;
    captured_at: number;
    confirmed_at: number | null;
    valid_until: number | null;
    rev: number;
    created_at: number;
    updated_at: number;
    deleted_at: number | null;
}
export interface Relation {
    from_id: string;
    to_id: string;
    user_id: string;
    type: RelationType;
    source_field: string;
    source_block_id: string;
    created_at: number;
    deleted_at: number | null;
}
export interface Placement {
    canvas_id: string;
    object_id: string;
    user_id: string;
    x: number;
    y: number;
    w: number;
    h: number;
    z: number;
    display: null | 'title_only' | 'collapse_body' | 'full';
    group_id: string | null;
    deleted_at: number | null;
}
export interface Source {
    id: string;
    user_id: string;
    type: 'connector' | 'agent';
    connector: string;
    name: string;
    properties: Record<string, Property>;
    config: Record<string, any>;
    anchor: any;
    state: Record<string, any>;
    last_synced: number | null;
    enabled: boolean;
}
export interface Asset {
    id: string;
    user_id: string;
    hash: string;
    size: number;
    mime: string;
    storage_key: string;
    thumb_key: string | null;
    width: number | null;
    height: number | null;
    duration: number | null;
    created_at: number;
    committed: boolean;
    provider_data?: any;
}
export interface Proposal {
    id: string;
    session_id: string;
    object_id: string;
    field: string;
    ai_value: any;
    final_value: any;
    status: 'pending' | 'accepted' | 'edited' | 'rejected';
    decided_at: number | null;
    user_id: string;
}
export interface Change {
    mutation_id: string;
    object_id: string;
    field: string;
    value: any;
    base_rev: number;
    client_ts: number;
}
export interface LogChange extends Change {
    seq: number;
    user_id: string;
    device_id: string;
    created_at: number;
}
export interface Conflict {
    id: string;
    user_id: string;
    object_id: string;
    field: string;
    base_rev: number;
    server_rev: number;
    resolution: 'lww' | 'block_merge' | 'lost';
    device_id: string;
    created_at: number;
    losing_value: any;
}
export interface Version {
    object_id: string;
    rev: number;
    snapshot: KnowledgeObject;
    created_at: number;
    user_id: string;
}
export interface Tag {
    object_id: string;
    tag: string;
    user_id: string;
    deleted_at: number | null;
}
export interface Workspace {
    user: {
        id: string;
        timezone: string;
        created_at: number;
        settings: Record<string, any>;
    };
    objects: KnowledgeObject[];
    kinds: Kind[];
    relations: Relation[];
    placements: Placement[];
    tags: Tag[];
    assets: Asset[];
    sources: Source[];
    proposals: Proposal[];
    versions: Version[];
    conflicts: Conflict[];
    changes: LogChange[];
    clocks: Record<string, Clock>;
    mutations: string[];
    devices: Record<string, {
        last_seq: number;
        last_seen: number;
    }>;
    nextSeq: number;
}
export interface PublicSnapshot {
    objects: KnowledgeObject[];
    kinds: Kind[];
    relations: Relation[];
    placements: Placement[];
    sources: Source[];
    proposals: Proposal[];
    conflicts: Conflict[];
    user: Workspace['user'];
    latest_seq: number;
    capabilities: {
        ai: boolean;
        semantic: boolean;
        demo: boolean;
    };
}
