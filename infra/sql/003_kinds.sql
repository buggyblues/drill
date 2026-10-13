-- 由 scripts/gen-kinds-sql.mjs 从 kinds.json 生成，不要手改。
-- relations 说明每种 kind 允许建立的关系：belongs = 归属（from 归属于 to）。
-- 项目对领域是多对多（multiple: true），其余归属唯一；targets 为空数组即不允许归属。
INSERT INTO kinds(id,label,icon,color,properties,relations,sort) VALUES ('domain','领域','▣','#73758c','{}','{"belongs":{"targets":[],"multiple":false}}',0) ON CONFLICT(id) DO NOTHING;
INSERT INTO kinds(id,label,icon,color,properties,relations,sort) VALUES ('project','项目','▤','#7185a0','{}','{"belongs":{"targets":["domain"],"multiple":true}}',1) ON CONFLICT(id) DO NOTHING;
INSERT INTO kinds(id,label,icon,color,properties,relations,sort) VALUES ('canvas','画布','▢','#719697','{}','{"belongs":{"targets":["domain","project"],"multiple":false}}',2) ON CONFLICT(id) DO NOTHING;
INSERT INTO kinds(id,label,icon,color,properties,relations,sort) VALUES ('group','分组','⬚','#93908d','{}','{"belongs":{"targets":["domain","project"],"multiple":false}}',3) ON CONFLICT(id) DO NOTHING;
INSERT INTO kinds(id,label,icon,color,properties,relations,sort) VALUES ('action','行动','◉','#b18459','{"status":{"type":"label","label":"状态","options":["todo","doing","blocked","done"]},"due_at":{"type":"datetime","label":"截止时间"}}','{"belongs":{"targets":["domain","project"],"multiple":false}}',4) ON CONFLICT(id) DO NOTHING;
INSERT INTO kinds(id,label,icon,color,properties,relations,sort) VALUES ('artifact','产物','◆','#96809d','{}','{"belongs":{"targets":["domain","project"],"multiple":false}}',5) ON CONFLICT(id) DO NOTHING;
INSERT INTO kinds(id,label,icon,color,properties,relations,sort) VALUES ('distill','沉淀','●','#719582','{}','{"belongs":{"targets":["domain","project"],"multiple":false}}',6) ON CONFLICT(id) DO NOTHING;
INSERT INTO kinds(id,label,icon,color,properties,relations,sort) VALUES ('material','资料','○','#83909c','{}','{"belongs":{"targets":["domain","project"],"multiple":false}}',7) ON CONFLICT(id) DO NOTHING;
INSERT INTO kinds(id,label,icon,color,properties,relations,sort) VALUES ('thought','想法','◌','#b39b64','{}','{"belongs":{"targets":["domain","project"],"multiple":false}}',8) ON CONFLICT(id) DO NOTHING;
INSERT INTO kinds(id,label,icon,color,properties,relations,sort) VALUES ('self','自我认知','◎','#b08380','{"applies_to":{"type":"label","label":"适用范围","options":["工具选择","学习方式","创作决策","工作节奏","生活安排"],"multiple":true,"required":true}}','{"belongs":{"targets":["domain","project"],"multiple":false}}',9) ON CONFLICT(id) DO NOTHING;
INSERT INTO kinds(id,label,icon,color,properties,relations,sort) VALUES ('ai_output','AI生成','✳','#aaa6a2','{}','{"belongs":{"targets":["domain","project"],"multiple":false}}',10) ON CONFLICT(id) DO NOTHING;
