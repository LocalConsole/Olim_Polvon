"""Change the Telegram bot username everywhere in one go:  python3 src/set_bot.py NewName_bot
Then run src/build.sh (site) and `npm run deploy` in bot/ (worker)."""
import pathlib, re, sys
new = sys.argv[1].lstrip("@") if len(sys.argv) > 1 else sys.exit(__doc__)
if not re.fullmatch(r"[A-Za-z][A-Za-z0-9_]{3,31}[Bb][Oo][Tt]", new): sys.exit("Username must end with 'bot'")
root = pathlib.Path(__file__).resolve().parent.parent
toml = root / "bot" / "wrangler.toml"
old = re.search(r'BOT_USERNAME = "([^"]+)"', toml.read_text(encoding="utf-8")).group(1)
if old == new: sys.exit("Already " + new)
files = [toml] + [p for p in (root / "src").rglob("*") if p.suffix in (".py", ".js", ".css", ".html", ".gs") and p.is_file()]
n = 0
for p in files:
    s = p.read_text(encoding="utf-8")
    if old in s: p.write_text(s.replace(old, new), encoding="utf-8"); n += 1
print(f"@{old} → @{new} in {n} files. Now: sh src/build.sh  and  cd bot && npm run deploy")
