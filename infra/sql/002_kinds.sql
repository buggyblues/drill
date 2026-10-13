-- Kind definitions are database records, not client constants.
INSERT INTO kinds(id,label,icon,color,properties,parent_allowed,sort) VALUES ('domain','领域','▣','#73758c','{}',ARRAY['domain','project'],0) ON CONFLICT(id) DO NOTHING;
INSERT INTO kinds(id,label,icon,color,properties,parent_allowed,sort) VALUES ('project','项目','▤','#7185a0','{}',ARRAY['domain'],1) ON CONFLICT(id) DO NOTHING;
INSERT INTO kinds(id,label,icon,color,properties,parent_allowed,sort) VALUES ('canvas','画布','▢','#719697','{}',ARRAY['domain','project'],2) ON CONFLICT(id) DO NOTHING;
INSERT INTO kinds(id,label,icon,color,properties,parent_allowed,sort) VALUES ('group','分组','⬚','#93908d','{}',ARRAY['domain','project'],3) ON CONFLICT(id) DO NOTHING;
INSERT INTO kinds(id,label,icon,color,properties,parent_allowed,sort) VALUES ('action','行动','◉','#b18459','{"status": {"type": "label", "label": "状态", "options": ["todo", "doing", "blocked", "done"]}, "due_at": {"type": "datetime", "label": "截止时间"}}',ARRAY['domain','project'],4) ON CONFLICT(id) DO NOTHING;
INSERT INTO kinds(id,label,icon,color,properties,parent_allowed,sort) VALUES ('artifact','产物','◆','#96809d','{}',ARRAY['domain','project'],5) ON CONFLICT(id) DO NOTHING;
INSERT INTO kinds(id,label,icon,color,properties,parent_allowed,sort) VALUES ('distill','沉淀','●','#719582','{}',ARRAY['domain','project'],6) ON CONFLICT(id) DO NOTHING;
INSERT INTO kinds(id,label,icon,color,properties,parent_allowed,sort) VALUES ('material','资料','○','#83909c','{}',ARRAY['domain','project'],7) ON CONFLICT(id) DO NOTHING;
INSERT INTO kinds(id,label,icon,color,properties,parent_allowed,sort) VALUES ('thought','想法','◌','#b39b64','{}',ARRAY['domain','project'],8) ON CONFLICT(id) DO NOTHING;
INSERT INTO kinds(id,label,icon,color,properties,parent_allowed,sort) VALUES ('self','自我认知','◎','#b08380','{"applies_to": {"type": "label", "label": "适用范围", "options": ["工具选择", "学习方式", "创作决策", "工作节奏", "生活安排"], "multiple": true, "required": true}}',ARRAY['domain','project'],9) ON CONFLICT(id) DO NOTHING;
INSERT INTO kinds(id,label,icon,color,properties,parent_allowed,sort) VALUES ('ai_output','AI生成','✳','#aaa6a2','{}',ARRAY['domain','project'],10) ON CONFLICT(id) DO NOTHING;
