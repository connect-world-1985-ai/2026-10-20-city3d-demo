import sys,json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':640,'height':360})
    pg.goto(sys.argv[1]); pg.wait_for_function('window.__ready===true',timeout=240000)
    C=lambda s: pg.evaluate('(()=>{const c=window.__city;'+s+'})()')
    C('c.pause()'); pg.click('#startbtn')
    C("c.setWalk(-300,41.5,0,0)"); C("c.key('KeyW',true)")
    for i in range(25):
        C("c.sim(16,0.016)"); s=C("return c.state().player"); print(i,round(s['x'],2),round(s['z'],2))
    C("c.key('KeyW',false)")
    C("c.setWalk(-150,41.5,0,0)")
    pg.keyboard.press('Space'); 
    ys=[]
    for i in range(14):
        C("c.sim(3,0.016)"); ys.append(round(C("return c.state().player.y"),2))
    print('jump',ys)
    b.close()
