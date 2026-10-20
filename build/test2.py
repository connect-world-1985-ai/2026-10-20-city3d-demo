import sys,time,json
from playwright.sync_api import sync_playwright
url=sys.argv[1]; w=960; h=540
shots=sys.argv[2]
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg=b.new_page(viewport={'width':w,'height':h})
    logs=[]
    pg.on('console',lambda m:logs.append((m.type,m.text)))
    pg.on('pageerror',lambda e:logs.append(('pageerror',str(e))))
    pg.goto(url)
    pg.wait_for_function('window.__ready===true',timeout=240000)
    C=lambda s: pg.evaluate('(()=>{const c=window.__city;'+s+'})()')
    C('c.pause()')
    pg.click('#startbtn')
    def shot(name,steps=3):
        C(f'c.step({steps},0.016)'); pg.screenshot(path=f'/tmp/{name}.png')
    if 'a' in shots:
        shot('orb_dusk')
        C("c.setTod('night',true)");shot('orb_night')
        C("c.setTod('day',true)");shot('orb_day')
    if 'b' in shots:
        C("c.setTod('dusk',true);c.setCamera([60,45,150],[0,25,0])");shot('orb_close')
        C("c.setWalk(-150,41.5,-Math.PI/2,0.02)");shot('walk_dusk')
        C("c.setTod('night',true);c.setWalk(0,70,0,0.1)");shot('walk_night')
    print(logs)
    b.close()
