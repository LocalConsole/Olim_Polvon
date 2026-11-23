"""Move the site to its own domain in one go:
    python3 src/set_domain.py https://olimpolvon.uz [--api https://api.olimpolvon.uz]
Changes: build.py (SEO address), CNAME for GitHub Pages, bot/wrangler.toml (allowed origins, photo and Mini App address),
make_worker.py (allowed origins of the site assistant), bot texts. The old github.io address stays allowed, so nothing breaks
during the switch. --api: the bot Worker on your own Cloudflare domain goes first, Google relay stays as a backup.
Then: sh src/build.sh, commit+push, `npm run deploy` in bot/, `npx wrangler deploy` in worker/."""
import pathlib, re, sys
args = sys.argv[1:]
if not args or not re.fullmatch(r"https://[a-z0-9.-]+\.[a-z]{2,}", args[0].rstrip("/")): sys.exit(__doc__)
dom = args[0].rstrip("/"); api = args[args.index("--api") + 1].rstrip("/") if "--api" in args else ""
root = pathlib.Path(__file__).resolve().parent.parent
def edit(path, fn):
    p = root / path; s = p.read_text(encoding="utf-8"); n = fn(s)
    if n != s: p.write_text(n, encoding="utf-8"); print("✓", path)
edit("src/build.py", lambda s: re.sub(r'"domain": "[^"]+",[^\n]*', f'"domain": "{dom}",', s, count=1))
if api: edit("src/build.py", lambda s: re.sub(r'"api_endpoint": "([^"]+)"', lambda m: '"api_endpoint": "' + ", ".join([api] + [x.strip() for x in m.group(1).split(",") if x.strip() != api]) + '"', s, count=1))
def toml(s):
    s = re.sub(r'ORIGINS = "([^"]*)"', lambda m: 'ORIGINS = "' + ",".join(dict.fromkeys([dom] + [x.strip() for x in m.group(1).split(",") if x.strip()])) + '"', s, count=1)
    s = re.sub(r'PHOTO_BASE = "[^"]*"', f'PHOTO_BASE = "{dom}/assets/menu/tg/"', s, count=1)
    return re.sub(r'SITE_URL = "[^"]*"', f'SITE_URL = "{dom}/"', s, count=1)
edit("bot/wrangler.toml", toml)
edit("src/make_worker.py", lambda s: re.sub(r'const DEFAULT_ORIGINS = \[([^\]]*)\];', lambda m: "const DEFAULT_ORIGINS = [" + ", ".join(dict.fromkeys([f'"{dom}"'] + [x.strip() for x in m.group(1).split(",") if x.strip()])) + "];", s, count=1))
edit("bot/src/texts.js", lambda s: s.replace("localconsole.github.io/Olim_Polvon", dom.replace("https://", "")))
(root / "CNAME").write_text(dom.replace("https://", "") + "\n", encoding="utf-8"); print("✓ CNAME")
print(f"\nDone. Next: sh src/build.sh → commit & push → in GitHub: Settings → Pages → Custom domain = {dom.replace('https://', '')}"
      + ("" if not api else f"\nCloudflare: Workers → olim-bot → Settings → Domains & Routes → Add custom domain {api.replace('https://', '')}")
      + "\nbot/: npm run deploy (the Mini App button and photos switch to the new address)")
