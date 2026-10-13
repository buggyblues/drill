"""UI tests against the real local HTTP service using an explicit in-memory browser transport.
This verifies UI + server behavior, not CSP enforcement, Vite bundling, or Electron IPC.
No external network requests are used. Browser policy remains untouched.
"""
import os, json, time, subprocess, tempfile
from pathlib import Path
from collections import deque
import requests
from playwright.sync_api import sync_playwright, expect
ROOT = Path(__file__).resolve().parents[1]
SHOTS = ROOT / 'validation/screenshots'
SHOTS.mkdir(parents=True, exist_ok=True)
passes=[]
def passed(name):
    passes.append(name); print(f'PASS {len(passes):02d} {name}', flush=True)

def run():
    with tempfile.TemporaryDirectory(prefix='drill-ui-') as data:
        port=18887; base=f'http://127.0.0.1:{port}'
        env={**os.environ,'PORT':str(port),'DEMO_DATA_DIR':data}
        server=subprocess.Popen(['node','--experimental-strip-types','scripts/demo.ts'],cwd=ROOT,env=env,stdout=subprocess.DEVNULL,stderr=subprocess.DEVNULL)
        session=requests.Session()
        try:
            for _ in range(60):
                try:
                    if session.get(base+'/health',timeout=.5).ok: break
                except requests.RequestException: pass
                time.sleep(.1)
            def send(data):
                path=data['path']
                if not path.startswith('/') or path.startswith('//'): raise ValueError('Fixture only accepts relative Drill endpoints')
                response=session.request(data['method'],base+path,data=data.get('body'),headers={'Content-Type':'application/json'},timeout=25)
                return {'status':response.status_code,'body':response.text,'headers':{'Content-Type':response.headers.get('Content-Type','application/json')}}
            def snapshot(): return session.get(base+'/bootstrap').json()
            def wait_for(predicate):
                for _ in range(100):
                    if predicate(): return
                    page.wait_for_timeout(60)
                raise AssertionError('Timed out waiting for persisted state')
            with sync_playwright() as p:
                browser=p.chromium.launch(executable_path=os.environ.get('CHROMIUM_PATH','/usr/bin/chromium'),args=['--no-sandbox'])
                context=browser.new_context(viewport={'width':1440,'height':960},device_scale_factor=1)
                page=context.new_page();errors=[];dialog_answers=deque()
                page.on('pageerror',lambda e:errors.append(str(e)))
                page.on('dialog',lambda d:d.accept(dialog_answers.popleft() if dialog_answers else ''))
                page.expose_function('fixtureRequest',send)
                page.set_content('<!DOCTYPE html><html lang="zh-CN"><head></head><body><div id="root"></div></body></html>')
                page.add_style_tag(content=(ROOT/'packages/ui/src/styles.css').read_text())
                page.add_script_tag(content="window.fetch=async(path,options={})=>{const r=await window.fixtureRequest({path,method:options.method||'GET',body:options.body});return new Response(r.body,{status:r.status,headers:r.headers});};if(!crypto.randomUUID)crypto.randomUUID=()=>('10000000-1000-4000-8000-100000000000').replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));")
                for f in ['react.demo.js','react-dom.demo.js']:page.add_script_tag(content=(ROOT/'preview/vendor'/f).read_text())
                page.add_script_tag(content=(ROOT/'validation/browser-fixture.js').read_text())
                expect(page.locator('.page-heading h1')).to_have_text('新增');passed('三栏界面与持久化示例加载')
                page.wait_for_timeout(400);page.screenshot(path=str(SHOTS/'01-recent.png'))
                page.get_by_role('button',name='快速捕获',exact=True).click()
                expect(page.get_by_role('dialog',name='快速捕获')).to_be_visible();passed('顶部按钮打开捕获窗口')
                for i in range(3):
                    page.locator('.capture-modal textarea').fill(f'验收捕获 {i+1}')
                    page.get_by_role('button',name='存下',exact=True).click()
                    wait_for(lambda:any(o['title']==f'验收捕获 {i+1}' for o in snapshot()['objects']))
                    expect(page.locator('.capture-modal textarea')).to_have_value('')
                passed('连续保存三条，真实服务有记录且捕获窗不关闭')
                page.screenshot(path=str(SHOTS/'02-capture.png'))
                page.keyboard.press('Escape');expect(page.locator('.capture-modal')).to_have_count(0);passed('Escape关闭捕获')
                page.get_by_role('option',name='验收捕获 3',exact=False).click()
                page.get_by_label('对象类型').select_option('thought')
                wait_for(lambda:any(o['title']=='验收捕获 3' and o['kind']=='thought' for o in snapshot()['objects']));passed('对象类型修改持久化')
                page.get_by_label('对象归属').select_option('domain-design')
                wait_for(lambda:any(o['title']=='验收捕获 3' and o['parent_id']=='domain-design' for o in snapshot()['objects']));passed('对象单一归属修改持久化')
                dialog_answers.append('验收');page.get_by_label('添加标签',exact=True).click()
                wait_for(lambda:any(o['title']=='验收捕获 3' and '验收' in o['tags_cached'] for o in snapshot()['objects']));passed('手动标签写入与展示')
                page.locator('.right-pane').get_by_role('button',name='版本 ·',exact=False).click()
                expect(page.locator('.versions-list details').first).to_be_visible();passed('历史版本可打开阅读')
                page.keyboard.press('Escape')
                page.get_by_title('全局搜索 ⌘K').click();page.locator('.search-modal input').fill('验收捕获')
                expect(page.locator('.search-results button')).to_have_count(3);passed('全局字面搜索读取真实结果')
                expect(page.get_by_role('button',name='语义',exact=True)).to_be_disabled();passed('未配置向量服务时禁用语义搜索')
                page.keyboard.press('Escape')
                page.locator('.sidebar').get_by_role('button',name='行动',exact=True).click()
                expect(page.locator('.board-column')).to_have_count(4);passed('行动状态按数据库枚举生成看板')
                page.screenshot(path=str(SHOTS/'03-actions.png'))
                card=page.locator('.board-card').filter(has_text='录一段30秒').first
                target=page.locator('.board-column').nth(1)
                card.drag_to(target)
                wait_for(lambda:next(o for o in snapshot()['objects'] if o['id']=='note-action')['status']=='doing');passed('拖拽行动改变状态并落库')
                page.locator('.sidebar').get_by_role('button',name='封面这件事',exact=True).click()
                expect(page.locator('.canvas-card')).to_have_count(7);passed('自由画布加载已有摆放与分组')
                page.wait_for_timeout(400);page.screenshot(path=str(SHOTS/'04-canvas.png'))
                card=page.locator('.canvas-card').filter(has_text='浅色封面为什么').first
                old=next(x for x in snapshot()['placements'] if x['object_id']=='note-light')['x']
                box=card.bounding_box();page.mouse.move(box['x']+40,box['y']+50);page.mouse.down();page.mouse.move(box['x']+65,box['y']+70,steps=8);page.mouse.up()
                wait_for(lambda:next(x for x in snapshot()['placements'] if x['object_id']=='note-light')['x']!=old);passed('拖动画布卡片保存真实坐标')
                dialog_answers.append('临时的分支')
                page.get_by_label('临时文字',exact=True).click()
                wait_for(lambda:any(o['title']=='临时的分支' and o['ephemeral'] for o in snapshot()['objects']));passed('临时卡片只作为画布对象创建')
                canvas_card=page.locator('.canvas-card').filter(has_text='开头怎么说').first
                canvas_card.get_by_role('button',name='进入',exact=False).click()
                expect(page.locator('.canvas-breadcrumb')).to_contain_text('开头怎么说');expect(page.locator('.canvas-empty')).to_be_visible();passed('嵌套画布进入与空状态')
                page.keyboard.press('Escape');expect(page.locator('.canvas-card').first).to_be_visible();passed('Escape返回上层画布')
                page.locator('.sidebar').get_by_role('button',name='洞察',exact=True).click();expect(page.locator('.service-notice')).to_contain_text('AI 尚未连接');passed('AI未配置展示真实不可用状态')
                page.screenshot(path=str(SHOTS/'05-insight-unconfigured.png'))
                page.locator('.sidebar').get_by_role('button',name='认知地图',exact=True).click();expect(page.locator('.discovery-body')).to_contain_text('bge-m3');passed('认知地图没有用假随机图替代向量服务')
                page.locator('.sidebar').get_by_role('button',name='新增',exact=True).click()
                expect(page.get_by_role('option',name='临时的分支',exact=False)).to_have_count(0);passed('临时对象不进入新增列表')
                page.locator('.sidebar-footer').get_by_role('button',name='偏好与连接',exact=True).click();expect(page.locator('.settings-page')).to_be_visible();passed('设置与连接器状态页可打开')
                page.screenshot(path=str(SHOTS/'06-settings.png'))
                page.get_by_title('折叠上下文栏').click();page.set_viewport_size({'width':390,'height':844})
                page.locator('.sidebar').get_by_title('新增').click() if page.locator('.sidebar').get_by_title('新增').count() else page.locator('.sidebar .nav-item').first.click()
                expect(page.locator('.mobile-capture')).to_be_visible();page.screenshot(path=str(SHOTS/'07-mobile-web.png'));passed('窄屏Web布局与捕获入口可见（非iOS真机）')
                assert not errors, errors;passed('浏览器运行无未捕获JavaScript异常')
                browser.close()
            (ROOT/'validation/browser-results.json').write_text(json.dumps({'passed':len(passes),'cases':passes,'environment':'Chromium; React16 isolated preview fixture; Python transport to real Node HTTP; not Vite/Electron/iOS validation'},ensure_ascii=False,indent=2))
        finally:
            server.terminate()
            try:server.wait(timeout=3)
            except subprocess.TimeoutExpired:server.kill()
if __name__=='__main__':run()
