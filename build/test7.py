import sys,time,json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    # 2. touch device
    ctx=b.new_context(viewport={'width':390,'height':780},has_touch=True,is_mobile=True,device_scale_factor=2)
    pg=ctx.new_page(); logs=[]
    pg.on('console',lambda m:logs.append((m.type,m.text)));pg.on('pageerror',lambda e:logs.append(('pageerror',str(e))))
    pg.goto('file:///workspace/city3d-demo/index.html?q=low')
    pg.wait_for_function('window.__ready===true',timeout=240000)
    pg.evaluate('window.__city.pause()')
    pg.tap('#startbtn')
    pg.evaluate("window.__city.setMode('walk')")
    pg.evaluate('window.__city.step(2,0.016)')
    print('touch: joy display',pg.evaluate("getComputedStyle(document.querySelector('#joy')).display"),'jump',pg.evaluate("getComputedStyle(document.querySelector('#jumpbtn')).display"))
    pg.screenshot(path='/tmp/touch_walk.png',timeout=120000)
    print('TOUCH LOGS',logs)
    b.close()
