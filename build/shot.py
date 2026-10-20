import sys,time,json
from playwright.sync_api import sync_playwright
url=sys.argv[1]; out=sys.argv[2]
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--enable-webgl'])
    pg=b.new_page(viewport={'width':1280,'height':720})
    logs=[]
    pg.on('console',lambda m:logs.append((m.type,m.text)))
    pg.on('pageerror',lambda e:logs.append(('pageerror',str(e))))
    pg.goto(url)
    t=time.time()
    try:
        pg.wait_for_function('window.__ready===true',timeout=120000)
    except Exception as e: print('NOT READY',e)
    print('ready after',time.time()-t)
    time.sleep(2)
    pg.screenshot(path=out)
    print(json.dumps(pg.evaluate('window.__city&&window.__city.state()')))
    print(logs)
    b.close()
