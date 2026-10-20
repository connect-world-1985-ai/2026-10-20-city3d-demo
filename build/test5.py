import sys,json
from playwright.sync_api import sync_playwright
with sync_playwright() as p:
    b=p.chromium.launch(headless=True,args=['--use-angle=swiftshader','--enable-unsafe-swiftshader'])
    pg=b.new_page(viewport={'width':640,'height':360})
    pg.goto(sys.argv[1]); pg.wait_for_function('window.__ready===true',timeout=240000)
    print(pg.evaluate("""(()=>{const c=window.__city.cityObj;const out=[];
      for(let z=41.5;z>=36;z-=0.5){const p={x:-300,z};const h=c.resolve(p,.45);out.push([z,h,p.x.toFixed(2),p.z.toFixed(2)]);}return JSON.stringify(out)})()"""))
    b.close()
