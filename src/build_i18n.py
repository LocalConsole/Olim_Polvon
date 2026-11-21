"""Makes /uz/ and /en/ copies of the Russian pages: same markup and style, translated text,
fixed relative paths, hreflang links and a language switch. Run from build.py."""
import json, re, copy
from bs4 import BeautifulSoup, Comment, NavigableString
from i18n import T, STORY
from menu_data import CATS, UNITS, ITEMS
# menu names, descriptions, units and categories come straight from the menu data
for _c in CATS: T.setdefault(_c[2], (_c[1], _c[3]))
for _u in UNITS.values(): T.setdefault(_u[1], (_u[0], _u[2]))
for _r in ITEMS:
    T.setdefault(_r[3], (_r[2], _r[4]))
    if _r[6]: T.setdefault(_r[6], (_r[5], _r[7]))


LANGS = ["ru", "uz", "en"]
PAGES = ["index.html", "menu.html", "about.html", "contact.html", "404.html"]
CUR = {"uz": "so'm", "en": "UZS"}
LOCALE = {"ru": "ru_RU", "uz": "uz_UZ", "en": "en_US"}
SKIP_KEYS = {"key", "id", "cat", "img", "@type", "@context", "@id", "url", "image", "logo", "hasMenu", "sameAs", "telephone",
             "mainEntityOfPage", "item", "suitableForDiet", "priceCurrency", "dayOfWeek", "opens", "closes", "inLanguage"}
cyr = re.compile("[А-Яа-яЁё]")
price_re = re.compile(r"(\d[\d   ]*)\s*сум")

def tr(s, lang):
    if not s or not cyr.search(s): return s
    core = s.strip()
    if core in T:
        out = T[core][0 if lang == "uz" else 1]
        return s.replace(core, out)
    m = price_re.fullmatch(core)
    if m: return s.replace(core, m.group(1).strip() + " " + CUR[lang])
    m = re.fullmatch(r"(\d+) позиций", core)
    if m: return s.replace(core, m.group(1) + (" ta taom" if lang == "uz" else " dishes"))
    m = re.fullmatch(r"(.+), (\d[\d\u202f\u00a0 ]*\s*сум|цена уточняется|под заказ)", core)
    if m: return s.replace(core, tr(m.group(1), lang) + ", " + tr(m.group(2), lang))
    return s

def tr_json(o, lang, key=None):
    if isinstance(o, dict): return {k: tr_json(v, lang, k) for k, v in o.items()}
    if isinstance(o, list): return [tr_json(v, lang, key) for v in o]
    if isinstance(o, str) and key not in SKIP_KEYS: return tr(o, lang)
    return o

def story_html(words):
    out = []
    for t, cls in words:
        if t.startswith("pill:"):
            out.append(f'<span class="pill"><img src="../assets/img/{t[5:]}" alt="" loading="lazy"></span>')
        else:
            out += [f'<span class="w{" " + cls if cls else ""}">{w}</span>' for w in t.split(" ")]
    return " ".join(out)

def rel(lang, page, target_lang):
    """href from `page` in `lang` to the same page in target_lang."""
    up = "" if lang == "ru" else "../"
    return up + ("" if target_lang == "ru" else target_lang + "/") + page

def fix_paths(soup):
    for tag in soup.find_all(True):
        for a in ("href", "src"):
            v = tag.get(a)
            if v and (v.startswith("assets/") or v in ("site.webmanifest", "admin.html")):
                tag[a] = "../" + v
        if tag.get("srcset"):
            tag["srcset"] = ", ".join("../" + p.strip() if p.strip().startswith("assets/") else p.strip() for p in tag["srcset"].split(","))

def add_head_links(soup, lang, page, domain):
    head = soup.head
    for old in head.find_all("link", rel="alternate"): old.decompose()
    path = "" if page == "index.html" else page
    for L in LANGS:
        link = soup.new_tag("link", rel="alternate", hreflang=L, href=f"{domain}/{'' if L == 'ru' else L + '/'}{path}")
        head.append(link)
    head.append(soup.new_tag("link", rel="alternate", hreflang="x-default", href=f"{domain}/{path}"))

def set_switch(soup, lang, page):
    for a in soup.select(".lang-switch a"):
        L = a["data-lang"]
        a["href"] = rel(lang, page, L)
        if L == lang: a["aria-current"] = "true"
        elif a.has_attr("aria-current"): del a["aria-current"]

def run(root, SITE):
    domain = SITE["domain"]
    js_src = (root / "assets/app.js").read_text(encoding="utf-8")
    js_keys = set(re.findall(r"tt\('((?:[^'\\\n]|\\.)*)'\)", js_src))
    for page in PAGES:
        src = (root / page).read_text(encoding="utf-8")
        ru = BeautifulSoup(src, "html.parser")
        add_head_links(ru, "ru", page, domain); set_switch(ru, "ru", page)
        (root / page).write_text(str(ru), encoding="utf-8")
        for lang in ("uz", "en"):
            soup = BeautifulSoup(src, "html.parser")
            soup.html["lang"] = lang
            # text nodes
            for t in list(soup.find_all(string=True)):
                if isinstance(t, Comment) or t.parent.name in ("script", "style"): continue
                if t.find_parent(class_="admin-bar") or t.find_parent(id="staff-modal"): continue
                nt = tr(str(t), lang)
                if nt != str(t): t.replace_with(NavigableString(nt))
            for tag in soup.find_all(True):
                for a in ("alt", "aria-label", "placeholder", "title", "content", "data-dish", "data-price", "data-title", "data-count"):
                    if tag.get(a): tag[a] = tr(tag[a], lang)
            # JSON (structured data + menu data)
            for sc in soup.find_all("script", type=["application/json", "application/ld+json"]):
                data = tr_json(json.loads(sc.string), lang)
                if sc.get("id") == "menu-data":
                    for d in data:
                        if d.get("img"): d["img"] = "../" + d["img"]
                sc.string = json.dumps(data, ensure_ascii=False)
            # story moment
            p = soup.find(attrs={"data-words": True})
            if p is not None:
                p.clear(); p.append(BeautifulSoup(story_html(STORY[lang]), "html.parser"))
            # urls and metas
            path = "" if page == "index.html" else page
            canon = soup.find("link", rel="canonical")
            if canon: canon["href"] = f"{domain}/{lang}/{path}"
            ogu = soup.find("meta", property="og:url")
            if ogu: ogu["content"] = f"{domain}/{lang}/{path}"
            ogl = soup.find("meta", property="og:locale")
            if ogl: ogl["content"] = LOCALE[lang]
            fix_paths(soup)
            add_head_links(soup, lang, page, domain); set_switch(soup, lang, page)
            # strings for the script
            i18n = {k: T[k][0 if lang == "uz" else 1] for k in js_keys if k in T}
            app = soup.find("script", src=re.compile("app.js"))
            s = soup.new_tag("script"); s.string = "window.POLVON_I18N=" + json.dumps(i18n, ensure_ascii=False) + ";"
            app.insert_before(s)
            out = root / lang / page
            out.parent.mkdir(exist_ok=True)
            out.write_text(str(soup), encoding="utf-8")
    # sitemap with language alternates
    rows = []
    for page, pr in [("", "1.0"), ("menu.html", "0.9"), ("contact.html", "0.8"), ("about.html", "0.6")]:
        alts = "".join(f'<xhtml:link rel="alternate" hreflang="{L}" href="{domain}/{"" if L == "ru" else L + "/"}{page}"/>' for L in LANGS)
        for L in LANGS:
            rows.append(f'  <url><loc>{domain}/{"" if L == "ru" else L + "/"}{page}</loc><priority>{pr}</priority>{alts}</url>')
    (root / "sitemap.xml").write_text('<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">\n' + "\n".join(rows) + "\n</urlset>\n", encoding="utf-8")
    print("i18n: uz, en built")
