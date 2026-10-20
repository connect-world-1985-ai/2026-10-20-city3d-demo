import sys,time,json
from playwright.sync_api import sync_playwright
url=sys.argv[1]; w=int(sys.argv[2]) if len(sys.argv)>2 else 960; h=int(sys.argv[3]) if len(sys.argv)>3 else 540
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg=b.new_page(viewport={'width':w,'height':h})
    logs=[]
    pg.on('console',lambda m:logs.append((m.type,m.text)))
    pg.on('pageerror',lambda e:logs.append(('pageerror',str(e))))
    pg.goto(url)
    t=time.time()
    pg.wait_for_function('window.__ready===true',timeout=240000)
    print('ready after %.1fs'%(time.time()-t))
    pg.evaluate('window.__city.pause()')
    pg.click('#startbtn')
    t=time.time(); pg.evaluate('window.__city.step(3,0.016)'); print('3 frames %.1fs'%(time.time()-t))
    pg.screenshot(path='/tmp/o1.png')
    print(json.dumps(pg.evaluate('window.__city.state()')))
    print(logs)
    b.close()
