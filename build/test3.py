import sys,time,json
from playwright.sync_api import sync_playwright
url=sys.argv[1]
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'])
    pg=b.new_page(viewport={'width':960,'height':540})
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
    C("c.setTod('dusk',true)");shot('orb_dusk2')
    # collision test: walk north into the block from the road at several x
    res=[]
    for x in [-300,-224,-150,-74,0,74,150,224,300]:
        C(f"c.setWalk({x},41.5,0,0)")
        C("c.key('KeyW',true)")
        C("c.sim(400,0.016)")
        st=C("return c.state()")
        C("c.key('KeyW',false)")
        pl=st['player']
        inside=C(f"return c.buildings.some(b=>{pl['x']}>b.x0-0.44&&{pl['x']}<b.x1+0.44&&{pl['z']}>b.z0-0.44&&{pl['z']}<b.z1+0.44&&!({pl['x']}<=b.x0-0.449||{pl['x']}>=b.x1+0.449))")
        res.append((x,round(pl['x'],2),round(pl['z'],2),inside))
    print('collision',res)
    # jump test
    C("c.setWalk(-150,41.5,-Math.PI/2,0)")
    pass;C("c.sim(1,0.016);c.key('Space',false)")
    ys=[]
    for i in range(12):
        C("c.sim(3,0.016)");ys.append(round(C("return c.state().player.y"),2))
    print('jump y',ys)
    # run test
    C("c.setWalk(-150,41.5,-Math.PI/2,0)")
    x0=C("return c.state().player.x");
    C("c.key('KeyW',true);c.key('ShiftLeft',true);c.sim(60,0.016)")
    x1=C("return c.state().player.x");print('run 0.96s moved',round(x1-x0,2),'m (expect ~10)')
    C("c.key('KeyW',false);c.key('ShiftLeft',false)")
    C("c.setTod('night',true);c.setWalk(-150,41.5,-Math.PI/2,0.05)");shot('walk_night2')
    C("c.setTod('dusk',true);c.teleport(150-0,-152+50,Math.PI);");shot('walk_wheel')
    print(C("return JSON.stringify(c.state())"))
    print(logs)
    b.close()
