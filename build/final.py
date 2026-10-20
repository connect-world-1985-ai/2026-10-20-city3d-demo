import sys,time,json
from playwright.sync_api import sync_playwright
url=sys.argv[1]; out='/workspace/city3d-demo/screenshots/'
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg=b.new_page(viewport={'width':1280,'height':720})
    logs=[]
    pg.on('console',lambda m:logs.append((m.type,m.text)))
    pg.on('pageerror',lambda e:logs.append(('pageerror',str(e))))
    pg.goto(url)
    pg.wait_for_function('window.__ready===true',timeout=240000)
    C=lambda s: pg.evaluate('(()=>{const c=window.__city;'+s+'})()')
    C('c.pause()')
    def shot(name,steps=3):
        C(f'c.step({steps},0.016)'); time.sleep(.3); pg.screenshot(path=out+name,timeout=180000)
    shot('00-start-help-overlay.png')
    pg.click('#startbtn')
    shot('01-orbit-dusk.png')
    C("c.setCamera([150,120,200],[0,20,0])"); shot('02-orbit-dusk-closer.png',2)
    C("c.setWalk(-150,41.5,-Math.PI/2,0.03)"); shot('03-walk-dusk-street.png',12)
    C("c.setTod('night',true);c.setMode('orbit');c.setCamera([250,170,330],[0,28,0])"); shot('04-orbit-night.png')
    C("c.setTod('day',true)"); shot('05-orbit-day.png')
    print(json.dumps(C("return c.state()")))
    print('LOGS',logs)
    b.close()
