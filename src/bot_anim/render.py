# Renders the Ёрдамчи animations for the Telegram bot: python3 render.py [scene ...]
# Needs: pip install playwright && playwright install chromium (or set CHROME=/path/to/chrome), and ffmpeg.
# Scenes are drawn in anim.html; output goes to ../../assets/menu/tg/anim/<scene>.mp4 (480x480, 2.5 s loop, no sound).
import asyncio, subprocess, os, sys
from playwright.async_api import async_playwright
SCENES=sys.argv[1:] or ["hello","thinking","accepted","cooking","courier","done","booking"]
FR=60
OUT=os.path.join(os.path.dirname(os.path.abspath(__file__)),'..','..','assets','menu','tg','anim'); os.makedirs(OUT, exist_ok=True)
async def main():
    async with async_playwright() as p:
        b=await p.chromium.launch(**({"executable_path": os.environ["CHROME"]} if os.environ.get("CHROME") else {}))
        pg=await b.new_page(viewport={"width":480,"height":480})
        await pg.goto("file://"+os.path.abspath(os.path.join(os.path.dirname(__file__),"anim.html"))+"")
        for sc in SCENES:
            os.makedirs(f"fr/{sc}",exist_ok=True)
            for i in range(FR):
                await pg.evaluate(f"render('{sc}',{i/FR})")
                await pg.screenshot(path=f"fr/{sc}/{i:03d}.png",clip={"x":0,"y":0,"width":480,"height":480})
            subprocess.run(["ffmpeg","-y","-loglevel","error","-framerate","24","-i",f"fr/{sc}/%03d.png","-vf","format=yuv420p","-c:v","libx264","-preset","veryfast","-crf","26","-movflags","+faststart","-an",os.path.join(OUT, f"{sc}.mp4")],check=True)
        await b.close()
asyncio.run(main())
