#!/usr/bin/env python3
"""Builds the static Olim Polvon site: every page is real HTML (good for Google),
JS only adds animation, the AI assistant demo and the admin mode.
Edit SITE / MENU below, run `python3 build.py`, upload the folder."""
import json, html, datetime, pathlib

ROOT = pathlib.Path(__file__).parent
SITE = {
    "name": "Olim Polvon",
    "name_full": "Olim Polvon Milliy Taomlari",
    "name_ru": "Олим Полвон",
    "domain": "https://localconsole.github.io/Olim_Polvon",  # TODO: switch to the real .com domain
    "district": "Зангиота",
    "street": "Большая кольцевая, Эркин",
    "city": "Ташкент",
    "phone": "+998 95 343 43 43",
    "phone_href": "+998953434343",
    "delivery": [("+998 90 916 77 74", "+998909167774"), ("+998 97 766 99 88", "+998977669988")],
    "telegram": "https://t.me/olim_polvon",
    "bot": "https://t.me/Olimpolvon_bot",
    # Cloudflare Worker that talks to Gemini (see worker/worker.js). Empty = scripted demo answers.
    "ai_endpoint": "https://olim-ai.abduraxmanov349.workers.dev, https://script.google.com/macros/s/AKfycbxkmkdz8ZMbgoyUpwtY8l7BI0Sy2NJQMWIqTeMwlzC1QqgeDgNm_WckNVfBjjjtVS0F/exec",
    "instagram": "https://instagram.com/_olim_polvon",
    "yandex": "https://yandex.uz/maps/org/89114477009/",
    "rating": "5,0", "ratings": "1500+",
    "hours": [("Ежедневно", "06:00 – 23:00")],
    "hours_schema": [("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"), "06:00", "23:00"],
    "price_range": "от 150 000 сум на человека",
}
MAP = SITE["yandex"]
GMAP = "https://www.google.com/maps/search/?api=1&query=Olim+Polvon+Milliy+Taomlari+Tashkent"
GROUTE = "https://www.google.com/maps/dir/?api=1&destination=Olim+Polvon+Milliy+Taomlari+Tashkent"
YEMBED = "https://yandex.uz/map-widget/v1/?oid=89114477009&z=16"
GEMBED = "https://www.google.com/maps?q=Olim+Polvon+Milliy+Taomlari,+Tashkent&z=16&output=embed"
def map_block(cls=""):
    return f'''<div class="map-card {cls}" data-map>
  <div class="map-tabs" role="tablist" aria-label="Карта">
    <button role="tab" type="button" aria-selected="true" data-map-tab="y"><span class="map-dot map-dot--y"></span>Яндекс Карты</button>
    <button role="tab" type="button" aria-selected="false" data-map-tab="g"><span class="map-dot map-dot--g"></span>Google Карты</button>
  </div>
  <div class="map-frame">
    <iframe title="Olim Polvon на Яндекс Картах" data-src="{YEMBED}" data-frame="y" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe>
    <iframe title="Olim Polvon на Google Картах" data-src="{GEMBED}" data-frame="g" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade" hidden></iframe>
    <div class="map-pin" aria-hidden="true"><img src="assets/logo-light.png" alt="" width="64" height="64"><span>Загружаем карту…</span></div>
  </div>
  <div class="map-actions">
    <a class="btn" href="{MAP}" target="_blank" rel="noopener">{ic("i-pin")}Маршрут в Яндекс Картах</a>
    <a class="btn btn--ghost" href="{GROUTE}" target="_blank" rel="noopener">{ic("i-pin")}Маршрут в Google Maps</a>
  </div>
</div>'''
YEAR = datetime.date.today().year
IMG = "assets/img/"

# ---------------------------------------------------------------- menu data (from the restaurant's own online menu)
from menu_data import CATS, UNITS, ITEMS
MENU_IMG = "assets/menu/"

# ---- fast images: a 300px copy for phones/slow links + a tiny blurred preview drawn under every photo
import io
from PIL import Image as _PIL
def _small(path):
    """assets/menu/x.webp -> assets/menu/x-s.webp (300px), made once and refreshed when the photo changes"""
    p = ROOT / path; s = p.with_name(p.stem + "-s.webp")
    if not s.exists() or s.stat().st_mtime < p.stat().st_mtime:
        im = _PIL.open(p).convert("RGB"); im.thumbnail((300, 300)); im.save(s, quality=72, method=6)
    return str(pathlib.Path(path).with_name(s.name))
def fast_img(url, alt="", w=600, h=450, sizes="(max-width: 600px) 92vw, 360px", eager=False, extra="", cls=""):
    """menu photo: blurred preview at once, 300px for small screens/slow internet, 600px when needed"""
    path, _, q = url.partition("?"); q = ("?" + q) if q else ""
    small = _small(path) + q
    load = 'fetchpriority="high"' if eager else 'loading="lazy"'
    # class "lz": the restaurant logo (preloaded first) sits in the frame until the photo arrives
    return (f'<img class="lz{(" " + cls) if cls else ""}" src="{small}" srcset="{small} 300w, {url} 600w" sizes="{sizes}" alt="{html.escape(alt)}" '
            f'width="{w}" height="{h}" {load} decoding="async"{extra}>')

USED_PHOTOS = {"f163008803"}
TAG_LABEL = {"hit": "Хит", "spicy": "Острое", "veg": "Без мяса"}
HITS = {"Qovurma lag‘mon", "Norin", "Napoleon", "Shilpildoq", "Maxsus «Olim Polvon» salati", "Ilik sho‘rva", "Shashlik assorti"}
SPICY = {"Qovurma lag‘mon", "Uyg‘urcha lag‘mon", "Kolbasa achchiq", "Go‘sht say", "Ganfan", "Manpar"}

def slug(s):
    tr = dict(zip("абвгдеёжзийклмнопрстуфхцчшщъыьэюя", ["a","b","v","g","d","e","e","zh","z","i","y","k","l","m","n","o","p","r","s","t","u","f","h","c","ch","sh","sch","","y","","e","yu","ya"]))
    s = s.replace("‘", "").replace("’", "").replace("«", "").replace("»", "")
    out = "".join(tr.get(c, c) for c in s.lower())
    out = "".join(c if c.isalnum() else "-" for c in out).strip("-")
    while "--" in out: out = out.replace("--", "-")
    return out

def sum_fmt(n):
    if n is None: return "цена уточняется"
    return f"{n:,}".replace(",", " ") + " сум"

# temporarily off the site: no price yet, or the description only says "ask on Telegram"
HIDDEN = {"Куртоба"}  # waiting for a new photo; keep in sync with make_worker.py
# MENU: categories with their items, Russian is the build language (uz/en come from i18n)
MENU = []
for cid, uz, ru, en in CATS:
    items = []
    for (sid, cat, n_uz, n_ru, n_en, d_uz, d_ru, d_en, price, unit, has_ph) in ITEMS:
        if cat != cid or n_ru in HIDDEN: continue  # no price -> shown as «цена уточняется», no «+»
        tags = (["hit"] if n_uz in HITS else []) + (["spicy"] if n_uz in SPICY else [])
        items.append({"sid": sid, "id": slug(n_en), "uz": n_uz, "ru": n_ru, "en": n_en, "d_uz": d_uz, "d_ru": d_ru, "d_en": d_en,
                      "price": price, "unit": unit, "img": (MENU_IMG + sid + ".webp?v=" + str(int((ROOT / MENU_IMG / (sid + ".webp")).stat().st_mtime) % 100000)) if has_ph else None, "tags": tags})
    MENU.append({"id": cid, "uz": uz, "ru": ru, "en": en, "items": items})

MENU_JSON = [{"id": it["id"], "key": it["ru"], "cat": c["id"], "catTitle": c["ru"], "name": it["ru"], "desc": it["d_ru"],
              "weight": UNITS[it["unit"]][1], "price": it["price"], "tags": it["tags"], "img": (_small(it["img"].split("?")[0]) + "?" + it["img"].split("?")[1]) if it["img"] else None, "alt": it["uz"] + " " + it["en"]} for c in MENU for it in c["items"]]
BY_RU = {it["ru"]: it for c in MENU for it in c["items"]}
def dish(ru): return BY_RU[ru]


def img(id_, alt, sizes="(max-width: 900px) 100vw, 50vw", eager=False, has1280=True, cls=""):
    srcset = f"{IMG}photo-{id_}-500.webp 500w, {IMG}photo-{id_}-960.webp 960w" + (f", {IMG}photo-{id_}.webp 1280w" if has1280 else "")
    src = f"{IMG}photo-{id_}-960.webp"
    load = 'fetchpriority="high"' if eager else 'loading="lazy"'
    c = f' class="{cls}"' if cls else ""
    c = f' class="lz {cls}"' if cls else ' class="lz"'
    return f'<img{c} src="{src}" srcset="{srcset}" sizes="{sizes}" alt="{html.escape(alt)}" {load} decoding="async">'
NO1280 = {"f163008803"}
def photo(id_, alt, **kw):
    kw.setdefault("has1280", id_ not in NO1280)
    return img(id_, alt, **kw)
def mphoto(ru, alt=None, eager=False):
    it = dish(ru)
    load = 'fetchpriority="high"' if eager else 'loading="lazy"'
    return fast_img(it["img"], alt or it["ru"], sizes="(max-width: 900px) 92vw, 600px", eager=eager)

# ---------------------------------------------------------------- icons
ICONS = """<svg width="0" height="0" style="position:absolute" aria-hidden="true">
<symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>
<symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></symbol>
<symbol id="i-bag" viewBox="0 0 24 24"><path d="M5 8h14l-1.2 11.2a2 2 0 0 1-2 1.8H8.2a2 2 0 0 1-2-1.8z"/><path d="M9 8V6.5a3 3 0 0 1 6 0V8"/></symbol>
<symbol id="i-clock" viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></symbol>
<symbol id="i-pin" viewBox="0 0 24 24"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></symbol>
<symbol id="i-phone" viewBox="0 0 24 24"><path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/></symbol>
<symbol id="i-send" viewBox="0 0 24 24"><path d="M4 12l16-8-6 16-3-7z"/><path d="M11 13l9-9"/></symbol>
<symbol id="i-close" viewBox="0 0 24 24"><path d="M6 6l12 12M18 6L6 18"/></symbol>
<symbol id="i-plus" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></symbol>
<symbol id="i-pause" viewBox="0 0 24 24"><path d="M9 6v12M15 6v12"/></symbol>
<symbol id="i-play" viewBox="0 0 24 24"><path d="M8 5.5v13l10-6.5z"/></symbol>
<symbol id="i-lock" viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/></symbol>
<symbol id="i-car" viewBox="0 0 24 24"><path d="M5 16V11l2-5h10l2 5v5M3 16h18v3H3zM7 19v1M17 19v1M5 11h14"/></symbol>
<symbol id="i-users" viewBox="0 0 24 24"><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20a6.5 6.5 0 0 1 13 0M16 4.5a3.5 3.5 0 0 1 0 7M21.5 20a6.5 6.5 0 0 0-4-6"/></symbol>
<symbol id="i-tg" viewBox="0 0 24 24"><path d="M21 4L3 11l6 2 2 6 3-4 5 4z"/><path d="M9 13l8-6"/></symbol>
<symbol id="i-ig" viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="5"/><circle cx="12" cy="12" r="3.5"/><circle cx="17" cy="7" r=".6"/></symbol>
<symbol id="i-grid" viewBox="0 0 24 24"><rect x="4" y="4" width="7" height="7" rx="1.5"/><rect x="13" y="4" width="7" height="7" rx="1.5"/><rect x="4" y="13" width="7" height="7" rx="1.5"/><rect x="13" y="13" width="7" height="7" rx="1.5"/></symbol>
<symbol id="i-cal" viewBox="0 0 24 24"><rect x="4" y="5" width="16" height="15" rx="2"/><path d="M4 10h16M9 3v4M15 3v4"/></symbol>
<symbol id="i-list" viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11M4 6h.01M4 12h.01M4 18h.01"/></symbol>
<symbol id="i-out" viewBox="0 0 24 24"><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3M10 16l-4-4 4-4M6 12h10"/></symbol>
<symbol id="i-search" viewBox="0 0 24 24"><circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/></symbol>
<symbol id="i-edit" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/></symbol>
<symbol id="mark" viewBox="0 0 24 24"><path fill="currentColor" d="M12 1.5l2.4 6.3 6.3-1.4-4 5.1 4 5.1-6.3-1.4L12 22.5l-2.4-6.3-6.3 1.4 4-5.1-4-5.1 6.3 1.4z"/></symbol>
</svg>"""
def mascot(cls=""):
    """Cute assistant: a round non (bread) in a do'ppi. Parts are classed so CSS can blink, bob and talk."""
    return f'''<svg class="mascot {cls}" viewBox="0 0 64 64" aria-hidden="true">
  <g class="m-all">
    <ellipse cx="32" cy="60" rx="15" ry="2.6" fill="rgba(0,0,0,.12)" class="m-shadow"/>
    <g class="m-body">
      <circle cx="32" cy="37" r="21" fill="#d9894a"/>
      <circle cx="32" cy="37" r="17.5" fill="#efb46c"/>
      <circle cx="32" cy="37" r="17.5" fill="none" stroke="#d9894a" stroke-width="1" stroke-dasharray="1.5 3.2" opacity=".7"/>
      <g fill="#fff3dc" opacity=".9"><ellipse cx="17" cy="30" rx="1" ry=".6" transform="rotate(-30 17 30)"/><ellipse cx="47" cy="31" rx="1" ry=".6" transform="rotate(30 47 31)"/><ellipse cx="45" cy="47" rx="1" ry=".6"/><ellipse cx="19" cy="46" rx="1" ry=".6"/></g>
      <ellipse class="m-cheek" cx="21.5" cy="43" rx="3.6" ry="2.1" fill="#ef7f6e" opacity=".55"/>
      <ellipse class="m-cheek" cx="42.5" cy="43" rx="3.6" ry="2.1" fill="#ef7f6e" opacity=".55"/>
      <g class="m-eyes">
        <g class="m-eye"><ellipse cx="25.5" cy="37" rx="2.7" ry="3.3" fill="#2a1d14"/><circle cx="26.4" cy="35.8" r=".9" fill="#fff"/></g>
        <g class="m-eye"><ellipse cx="38.5" cy="37" rx="2.7" ry="3.3" fill="#2a1d14"/><circle cx="39.4" cy="35.8" r=".9" fill="#fff"/></g>
      </g>
      <path class="m-smile" d="M28.5 43.2 Q32 46.6 35.5 43.2" fill="none" stroke="#2a1d14" stroke-width="1.9" stroke-linecap="round"/>
      <ellipse class="m-mouth" cx="32" cy="44.3" rx="2.6" ry="2.2" fill="#5a2418"/>
    </g>
    <g class="m-cap">
      <path d="M17.5 21.5 L46.5 21.5 L43.5 11.5 Q32 6.5 20.5 11.5 Z" fill="#1d1915"/>
      <rect x="17" y="19.6" width="30" height="2.6" rx="1.2" fill="#1c4c9c"/>
      <g fill="none" stroke="#fbf7f0" stroke-width="1.1" stroke-linecap="round"><path d="M24 17.5 q1.5-4 4-3.5"/><path d="M31 17 q1.2-4.2 3.6-4"/><path d="M38 17.5 q1.2-3.6 3.4-3"/></g>
    </g>
  </g>
</svg>'''

def ic(name, cls="icon"):
    return f'<svg class="{cls}" aria-hidden="true"><use href="#{name}"/></svg>'

# ---------------------------------------------------------------- schema.org
def restaurant_schema():
    h = SITE["hours_schema"]
    return {
        "@context": "https://schema.org",
        "@type": "Restaurant",
        "@id": SITE["domain"] + "/#restaurant",
        "name": SITE["name_full"],
        "alternateName": [SITE["name"], SITE["name_ru"], "Олим Полвон Миллий Таомлари", "Olim Polvon milliy taomlar"],
        "description": "Семейный ресторан узбекской, уйгурской и европейской кухни на Большой кольцевой (Эркин), Ташкент: қовурма лағмон, норин, шилпилдок, халим, кабобы на углях. Доставка.",
        "url": SITE["domain"] + "/",
        "image": [SITE["domain"] + "/" + dish("Ковурма лагман")["img"], SITE["domain"] + "/" + dish("Норин")["img"], SITE["domain"] + "/share.jpg"],
        "logo": SITE["domain"] + "/assets/icon-512.png",
        "telephone": SITE["phone"],
        "servesCuisine": ["Узбекская кухня", "Уйгурская кухня", "Европейская кухня", "Uzbek", "Uyghur"],
        "priceRange": SITE["price_range"],
        "currenciesAccepted": "UZS",
        "paymentAccepted": "Cash, Credit Card, Bank transfer, Installment",
        "acceptsReservations": "True",
        "hasMenu": SITE["domain"] + "/menu.html",
        "address": {"@type": "PostalAddress", "streetAddress": "Katta halqa yo'li, Erkin", "addressLocality": "Зангиатинский район", "addressRegion": "Ташкентская область", "addressCountry": "UZ"},
        "aggregateRating": {"@type": "AggregateRating", "ratingValue": "5.0", "ratingCount": 1545, "bestRating": "5"},
        "areaServed": SITE["city"],
        "openingHoursSpecification": [
            {"@type": "OpeningHoursSpecification", "dayOfWeek": list(h[0]), "opens": h[1], "closes": h[2]},
        ],
        "amenityFeature": [{"@type": "LocationFeatureSpecification", "name": n, "value": True} for n in ["Доставка", "Навынос", "Wi-Fi", "Оплата картой"]],
        "sameAs": [SITE["instagram"], SITE["telegram"], SITE["yandex"]],
    }

def menu_schema():
    return {
        "@context": "https://schema.org", "@type": "Menu", "@id": SITE["domain"] + "/menu.html#menu",
        "name": f"Меню ресторана {SITE['name']}", "inLanguage": "ru",
        "mainEntityOfPage": SITE["domain"] + "/menu.html",
        "hasMenuSection": [{
            "@type": "MenuSection", "name": c["ru"],
            "hasMenuItem": [{
                "@type": "MenuItem", "name": it["ru"], **({"description": it["d_ru"]} if it["d_ru"] else {}),
                **({"image": SITE["domain"] + "/" + it["img"]} if it["img"] else {}),
                **({"offers": {"@type": "Offer", "price": it["price"], "priceCurrency": "UZS"}} if it["price"] else {}),
            } for it in c["items"]],
        } for c in MENU],
    }

def crumbs_schema(name, path):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Главная", "item": SITE["domain"] + "/"},
        {"@type": "ListItem", "position": 2, "name": name, "item": SITE["domain"] + "/" + path}]}

FAQ = [
    ("Есть ли доставка?", f"Да. Заказать можно по телефонам {SITE['delivery'][0][0]} и {SITE['delivery'][1][0]} или через Telegram-бот @Olimpolvon_bot."),
    ("Во сколько вы открываетесь?", "Работаем ежедневно с 06:00 до 23:00. С утра — супы и национальные блюда."),
    ("Бронь стола платная?", "Да, бронь платная. Стоимость администратор назовёт, когда перезвонит подтвердить заявку."),
    ("Можно прийти со своим тортом?", "Нет, свою еду, торты и напитки приносить нельзя. Торт и десерты для праздника можно заказать у нас."),
    ("Нужно ли бронировать стол?", "Для компании и на выходные лучше забронировать заранее: через форму на сайте или по телефону."),
    ("Как можно оплатить?", "Наличными, картой, переводом или в рассрочку."),
    ("Можно ли взять мясо домой?", "Да, при ресторане работает мясной центр: казы и рулеты из конины, говяжий и бараний рулет, копчёная курица."),
    ("Можно ли провести праздник?", "Да, позвоните или оставьте заявку с пометкой «праздник» — администратор предложит меню и порции на компанию."),
]
def faq_schema():
    return {"@context": "https://schema.org", "@type": "FAQPage", "mainEntity": [
        {"@type": "Question", "name": q, "acceptedAnswer": {"@type": "Answer", "text": a}} for q, a in FAQ]}

def ld(*objs):
    return "\n".join(f'<script type="application/ld+json">{json.dumps(o, ensure_ascii=False)}</script>' for o in objs)

# ---------------------------------------------------------------- layout
NAV = [("index.html", "Главная"), ("menu.html", "Меню"), ("about.html", "О нас"), ("contact.html", "Контакты")]

def head(page, title, desc, path, schemas, og_img="share.jpg", noindex=False, preload_img=None):
    url = SITE["domain"] + "/" + ("" if path == "index.html" else path)
    robots = '<meta name="robots" content="noindex, nofollow">' if noindex else '<meta name="robots" content="index, follow, max-image-preview:large">'
    pre = '<link rel="preload" as="image" href="assets/ph-logo.webp" fetchpriority="high">' + (f'<link rel="preload" as="image" href="{preload_img}" fetchpriority="high">' if preload_img else "")
    return f"""<!doctype html>
<html lang="ru" class="no-js" data-page="{page}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
{robots}
<link rel="canonical" href="{url}">
<meta name="theme-color" content="#12100e">
<meta name="format-detection" content="telephone=no">
<meta property="og:type" content="restaurant.restaurant">
<meta property="og:site_name" content="{SITE['name']}">
<meta property="og:locale" content="ru_RU">
<meta property="og:title" content="{html.escape(title)}">
<meta property="og:description" content="{html.escape(desc)}">
<meta property="og:url" content="{url}">
<meta property="og:image" content="{SITE['domain']}/{og_img}">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta name="twitter:card" content="summary_large_image">
<meta name="geo.region" content="UZ-TK">
<meta name="geo.placename" content="{SITE['city']}">
<link rel="icon" href="assets/favicon-64.png" type="image/png" sizes="64x64">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
<link rel="manifest" href="site.webmanifest">
<link rel="preload" href="assets/fonts2/AlumniSans-normal-500-900-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts2/Onest-normal-400-700-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
{pre}
<link rel="stylesheet" href="assets/style.css?v={ASSET_V}">
<script>(function(d){{d.classList.replace('no-js','js');var t=null;try{{t=localStorage.getItem('polvon_theme')}}catch(e){{}}if(!t){{var m=document.cookie.match(/(?:^|; )polvon_theme=(light|dark)/);if(m)t=m[1]}}try{{if(!t)t=sessionStorage.getItem('polvon_theme')}}catch(e){{}}if(!t)t=matchMedia('(prefers-color-scheme: light)').matches?'light':'dark';d.dataset.theme=t;try{{if(sessionStorage.getItem('polvon_admin')==='1')d.classList.add('is-admin');if(sessionStorage.getItem('polvon_intro')||matchMedia('(prefers-reduced-motion: reduce)').matches)d.classList.add('no-intro')}}catch(e){{d.classList.add('no-intro')}}}})(document.documentElement)</script>
{ld(*schemas)}
</head>"""

def header(active):
    links = "\n".join(f'<a href="{h}"{" aria-current=\"page\"" if h == active else ""}>{t}</a>' for h, t in NAV)
    return f"""<body>
{ICONS}
<a class="skip" href="#main">Перейти к содержимому</a>
<div class="admin-bar" role="region" aria-label="Панель администратора">
  <div class="wrap">
    <span class="admin-badge"><span class="dot"></span><span class="hide-xs">Режим администратора</span><span class="show-xs">Админ</span></span>
    <span class="hide-sm" style="opacity:.75">Изменения видны только на этом устройстве (демо)</span>
    <nav aria-label="Администрирование">
      <a href="admin.html">{ic("i-grid")}<span class="hide-sm">Панель</span></a>
      <a href="menu.html">{ic("i-edit")}<span class="hide-sm">Меню</span></a>
      <button type="button" data-logout>{ic("i-out")}Выйти</button>
    </nav>
  </div>
</div>
<header class="site-header">
  <div class="wrap">
    <a class="brand" href="index.html" aria-label="{SITE['name']}, на главную">
      <img src="assets/logo-light.png" alt="" width="50" height="50"><span class="brand-word">Olim Polvon<small>Milliy taomlar</small></span>
    </a>
    <nav class="nav" id="site-nav" aria-label="Основное меню">
      {links}
      <div class="lang-switch" role="group" aria-label="Язык / Til / Language"><a data-lang="ru" lang="ru" hreflang="ru" href="#">RU</a><a data-lang="uz" lang="uz" hreflang="uz" href="#">UZ</a><a data-lang="en" lang="en" hreflang="en" href="#">EN</a></div>
      <a class="btn btn--cobalt" href="contact.html#booking">Забронировать стол</a>
    </nav>
    <button class="theme-toggle" type="button" data-theme-toggle aria-label="Светлая / тёмная тема" title="Светлая / тёмная тема"><svg class="i-sun" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="4.2"/><path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6"/></svg><svg class="i-moon" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 14.6A8.3 8.3 0 0 1 9.4 4a8.3 8.3 0 1 0 10.6 10.6z"/></svg></button>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Открыть меню"><span></span><span></span></button>
  </div>
</header>"""

def footer():
    hours = "".join(f"<span>{d}</span><span>{t}</span>" for d, t in SITE["hours"])
    return f"""<footer class="site-footer">
  <div class="wrap">
    <div class="footer-top">
      <div>
        <div class="footer-brand"><img src="assets/logo-light.png" alt="Olim Polvon" width="96" height="96" loading="lazy"><h2>Olim<br>Polvon</h2></div>
        <p class="footer-lede">Семейный ресторан узбекской, уйгурской и европейской кухни на Большой кольцевой. Доставка: {SITE['delivery'][0][0]}.</p>
      </div>
      <div>
        <h3>Адрес</h3>
        <ul>
          <li><a href="{MAP}" target="_blank" rel="noopener">Катта халқа йўли, «Эркин»</a></li>
          <li><a href="tel:{SITE['phone_href']}">{SITE['phone']}</a></li>
        </ul>
      </div>
      <div>
        <h3>Часы работы</h3>
        <div class="hours">{hours}</div>
      </div>
      <div>
        <h3>Сайт</h3>
        <ul>
          <li><a href="menu.html">Меню и цены</a></li>
          <li><a href="contact.html#booking">Бронь стола</a></li>
          <li><a href="{SITE['bot']}" target="_blank" rel="noopener">Telegram-бот</a></li><li><a href="{SITE['telegram']}" target="_blank" rel="noopener">Telegram-канал</a></li>
          <li><a href="{SITE['instagram']}" target="_blank" rel="noopener">Instagram</a></li>
        </ul>
      </div>
    </div>
    <div class="footer-bottom">
      <span>© {YEAR} {SITE['name']}. Фото — ресторана Olim Polvon</span>
      <button class="staff-login" type="button" data-staff-login>{ic("i-lock")}Вход для персонала</button>
    </div>
  </div>
</footer>

<dialog class="modal" id="staff-modal" aria-labelledby="staff-title">
  <form class="modal-body" method="dialog" data-login-form novalidate>
    <h2 id="staff-title">Вход для персонала</h2>
    <p class="muted">Откроет режим администратора: правка меню, стоп-лист и заявки на бронь.</p>
    <div class="field">
      <label for="staff-pass">Пароль</label>
      <input id="staff-pass" name="password" type="password" autocomplete="current-password" required>
      <span class="err" aria-live="polite"></span>
    </div>
    <div class="modal-actions">
      <button class="btn btn--ghost" type="button" data-close>Отмена</button>
      <button class="btn" type="submit">Войти</button>
    </div>
  </form>
</dialog>

<div class="ai-hello" data-ai-hello hidden><button type="button" class="ai-hello-close" data-hello-close aria-label="Скрыть">{ic("i-close")}</button><button type="button" class="ai-hello-text" data-ai-open>Ассалому алайкум! Помочь выбрать блюдо?</button></div>
<button class="ai-launch" type="button" data-ai-open aria-controls="ai-panel" aria-expanded="false">
  <span class="ai-mascot">{mascot()}</span><span class="ai-launch-label">Спросить помощника</span>
</button>
<section class="ai-panel" id="ai-panel" data-ai-endpoint="{SITE['ai_endpoint']}" role="dialog" aria-label="Ёрдамчи, AI-помощник ресторана" aria-modal="false">
  <div class="ai-head">
    <span class="ai-ava ai-ava--mascot" data-ai-ava>{mascot()}</span>
    <div><b>Ёрдамчи</b><span class="ai-status">AI-помощник {SITE['name']}</span></div>
    <button class="ai-voice" type="button" data-ai-voice aria-pressed="false" aria-label="Озвучивать ответы" title="Озвучивать ответы"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4z"/><path class="w1" d="M15.5 9.5a3.5 3.5 0 0 1 0 5"/><path class="w2" d="M18.5 6.5a8 8 0 0 1 0 11"/></svg></button>
    <button class="ai-forget" type="button" data-ai-forget title="Забыть меня: стереть переписку и предпочтения с этого устройства">Забыть меня</button>
    <button class="ai-close" type="button" data-ai-close aria-label="Закрыть чат">{ic("i-close")}</button>
  </div>
  <div class="ai-msgs" data-ai-msgs aria-live="polite"></div>
  <div class="ai-chips-wrap"><button class="chip-arrow chip-arrow--l" type="button" data-chip-dir="-1" aria-label="Назад">{ic("i-arrow")}</button><div class="ai-chips" data-ai-chips></div><button class="chip-arrow chip-arrow--r" type="button" data-chip-dir="1" aria-label="Дальше">{ic("i-arrow")}</button></div>
  <div>
    <div class="ai-cart-row" data-ai-cart-row hidden><button class="ai-cart" type="button" data-ai-cart><span class="ai-cart-ic" aria-hidden="true">{ic("i-bag")}</span><span data-ai-cart-sum></span><span class="ai-cart-go">Мой заказ {ic("i-arrow")}</span></button><button class="ai-cart-x" type="button" data-ai-cart-clear aria-label="Отменить заказ" title="Отменить заказ">{ic("i-close")}</button></div>
    <form class="ai-form" data-ai-form>
      <label class="sr-only" for="ai-input">Сообщение</label>
      <input id="ai-input" type="text" placeholder="Например: стол на 4 до 400 000" autocomplete="off" maxlength="300">
      <button class="ai-send" type="submit" aria-label="Отправить">{ic("i-send")}</button>
    </form>
    <p class="ai-foot">Переписка и ваши предпочтения хранятся только на этом устройстве. Не пишите сюда телефоны и личные данные.</p>
    <label class="ai-keep"><input type="checkbox" data-ai-keep> <span>Хранить переписку дольше (на этом телефоне)</span></label>
  </div>
</section>
<div class="toast-host" aria-live="polite"></div>
<script id="menu-data" type="application/json">{json.dumps(MENU_JSON, ensure_ascii=False)}</script>
<script src="assets/app.js?v={ASSET_V}" defer></script>
</body>
</html>"""

def write(name, content):
    (ROOT / name).write_text(content, encoding="utf-8")

def price_of(name):
    for x in MENU_JSON:
        if x["name"] == name: return sum_fmt(x["price"])


import math
def _medallion():
    c = 200; parts = []
    parts.append(f'<circle class="m-draw" pathLength="1" cx="{c}" cy="{c}" r="194"/>')
    parts.append(f'<circle class="m-draw" pathLength="1" cx="{c}" cy="{c}" r="184" stroke-dasharray="0 1"/>')
    parts.append("".join(f'<circle class="m-dot" cx="{c + 184 * math.cos(a):.1f}" cy="{c + 184 * math.sin(a):.1f}" r="2.4"/>' for a in [i * math.pi / 32 for i in range(64)]))
    def star(n, r1, r2, rot=0):
        pts = []
        for i in range(2 * n):
            r = r1 if i % 2 == 0 else r2; a = math.pi * i / n + rot
            pts.append(f"{c + r * math.cos(a):.1f},{c + r * math.sin(a):.1f}")
        return " ".join(pts)
    parts.append(f'<polygon class="m-draw" pathLength="1" points="{star(16, 172, 140)}"/>')
    parts.append(f'<polygon class="m-draw" pathLength="1" points="{star(8, 150, 104, math.pi / 8)}"/>')
    parts.append(f'<circle class="m-draw" pathLength="1" cx="{c}" cy="{c}" r="100"/>')
    for i in range(12):
        a = i * 30
        parts.append(f'<path class="m-draw" pathLength="1" transform="rotate({a} {c} {c})" d="M{c} {c-100} C{c+18} {c-122} {c+18} {c-146} {c} {c-160} C{c-18} {c-146} {c-18} {c-122} {c} {c-100}Z"/>')
    return "".join(parts)
MEDALLION_SVG = _medallion()
def medallion(cls="", logo=True, src="assets/logo-light.png"):
    inner = f'<img class="medallion-logo" src="{src}" alt="" width="150" height="150" loading="lazy">' if logo else ""
    return f'<div class="medallion {cls}" aria-hidden="true"><svg viewBox="0 0 400 400">{MEDALLION_SVG}</svg>{inner}</div>'
ORN_RULE = '<div class="orn-rule" aria-hidden="true"><span></span><svg viewBox="0 0 24 24"><path d="M12 1l3 6.5 6.5-3-3 6.5 3 6.5-6.5-3L12 23l-3-6.5-6.5 3 3-6.5-3-6.5 6.5 3z"/></svg><span></span></div>'

import hashlib
ASSET_V = hashlib.md5((ROOT / "assets/app.js").read_bytes() + (ROOT / "assets/style.css").read_bytes()).hexdigest()[:8]
# ---------------------------------------------------------------- INDEX
marquee_items = ["Ковурма лагман", "Норин", "Наполеон", "Шилпилдок", "Халим", "Тахта кабоб", "Илик шурпа", "Казан-кабоб"]
mq = "".join(f"<span>{t}</span>{ic('mark','')}" for t in marquee_items)
plates = [
    ("dish-qovurma.webp?v=5", "Ковурма лагман", "-22%", "-24%"),
    ("dish-norin.webp?v=5", "Норин", "22%", "-24%"),
    ("dish-taxta.webp?v=5", "Тахта кабоб", "22%", "24%"),
    ("dish-noxat.webp?v=5", "Нохат шурак", "-22%", "24%"),
]
plate_html = "".join(f'<button class="plate" type="button" style="--x:{x};--y:{y}" data-dish="{n}" data-price="{price_of(n)}" aria-label="{n}, {price_of(n)}"><span class="plate-inner"><img src="{IMG}{f}" alt="" width="560" height="380" decoding="async"></span></button>' for f, n, x, y in plates)

story_words = [("Лапшу тянем вручную,", None), ("норин режем тонко,", None),
               ("шашлык жарим на углях.", None), ("Мясо — халяль", "accent"), ("и из своего мясного центра.", None)]
def story_html():
    out = []
    for t, cls in story_words:
        if t.startswith("pill:"):
            out.append(f'<span class="pill"><img src="{IMG}{t[5:]}" alt="" loading="lazy"></span>')
        else:
            out += [f'<span class="w{" " + cls if cls else ""}">{w}</span>' for w in t.split(" ")]
    return " ".join(out)

delivery_html = " · ".join(f'<a href="tel:{h}">{p}</a>' for p, h in SITE["delivery"])
CAT_PREVIEW = {"shashlik": "Наполеон", "milliy": "Норин", "uygur": "Ковурма лагман", "salat": "Чиракчи", "yevropa": "Колбаски классические", "non": "Лепёшка", "ichimlik": "Coca-Cola"}
cats_rows = "".join(f'''<li class="cat-row"><a href="menu.html#{c["id"]}" data-cat="{c["id"]}" data-title="{c["ru"]}" data-count="{len(c["items"])} позиций" data-preview="{dish(CAT_PREVIEW[c["id"]])["img"]}">
  <img class="cat-thumb" src="{_small(dish(CAT_PREVIEW[c["id"]])["img"].split("?")[0])}" alt="" loading="lazy" width="64" height="64">
  <span class="cat-name">{c["ru"]}</span><span class="cat-count">{len(c["items"])} позиций</span><span class="cat-arrow">{ic("i-arrow")}</span></a></li>''' for c in MENU)

INTRO = f'''<div class="intro" data-intro aria-hidden="true">
  <div class="intro-inner">
    <img class="intro-logo" src="assets/logo-light.png" alt="" width="150" height="150">
    <div class="intro-word">{"".join(f'<span style="animation-delay:{d}ms">{"&nbsp;" if ch == " " else ch}</span>' for ch, d in zip("Olim Polvon", [420, 455, 485, 512, 535, 555, 573, 590, 605, 618, 630]))}</div>
    <div class="intro-sub">Milliy taomlar</div>
  </div>
</div>
'''
index = head("home",
    f"{SITE['name_full']} — национальная кухня на Большой кольцевой, Ташкент",
    "Olim Polvon Milliy Taomlari — семейный ресторан узбекской и уйгурской кухни: ковурма лагман, норин, шилпилдок, шашлыки на углях. Рейтинг 5,0 в Яндекс Картах. Доставка по Ташкенту.",
    "index.html", [restaurant_schema(), {"@context": "https://schema.org", "@type": "WebSite", "name": SITE["name_full"], "url": SITE["domain"] + "/", "inLanguage": "ru"}],
    preload_img=IMG + "dish-non.webp") + header("index.html").replace('<a class="skip"', INTRO + '<a class="skip"', 1) + f"""
<main id="main">
  <section class="hero" aria-labelledby="hero-title">
    <div class="wrap hero-stage">
      <h1 id="hero-title"><span class="line"><span>Olim</span></span><span class="line line--2"><span>Polvon</span></span><span class="h1-sub" data-enter>Ресторан узбекской и уйгурской кухни в Ташкенте</span></h1>
      <div class="table-stage" data-table>
        <div class="table" data-table-inner>
          <div class="table-disc"></div>
          <svg class="table-orn" viewBox="0 0 400 400" aria-hidden="true">{MEDALLION_SVG}</svg>
          <div class="orbit">{plate_html}</div>
          <button class="plate plate--center" type="button" data-dish="Лепёшка" data-price="{price_of('Лепёшка')}" aria-label="Лепёшка, {price_of('Лепёшка')}"><span class="plate-inner"><img src="{IMG}dish-non.webp?v=5" alt="" width="480" height="426" decoding="async"></span></button>
          <div class="steam" aria-hidden="true"><span></span><span></span><span></span></div>
        </div>
        <div class="dish-caption" data-enter>
          <span class="dish-caption-text" data-caption aria-live="polite">Наведите на блюдо</span>
          <button class="spin-toggle" type="button" data-spin aria-pressed="false" aria-label="Остановить вращение">{ic("i-pause")}</button>
        </div>
      </div>
      <div class="hero-copy">
        <p class="tagline" data-enter>Har luqmada sifat, har tashrifda mamnuniyat.</p>
        <p class="lede" data-enter>Норин, ковурма лагман, шилпилдок и шашлыки на углях — дворец национальных блюд на Большой кольцевой.</p>
        <div class="hero-actions" data-enter>
          <a class="btn" href="contact.html#booking">Забронировать стол {ic("i-arrow")}</a>
          <a class="btn btn--ghost" href="menu.html">Смотреть меню</a>
        </div>
        <div class="hero-facts" data-enter>
          <a href="{SITE['yandex']}" target="_blank" rel="noopener"><span class="star">★</span>5,0 в Яндекс Картах</a>
          <span>{ic("i-clock")}Ежедневно</span>
          <span>{ic("i-car")}Доставка</span>
        </div>
      </div>
    </div>
  </section>

  <div class="marquee" aria-hidden="true"><div class="marquee-track"><div class="marquee-group">{mq}</div><div class="marquee-group">{mq}</div></div></div>

  <section class="section" aria-labelledby="cats-title">
    <div class="wrap">
      <div class="section-head">
        <h2 id="cats-title">Что выберете <em>сегодня?</em></h2>
        <p>{sum(len(c["items"]) for c in MENU)} блюд от утренней шурпы до шашлыков на углях. Наведите на раздел — покажем, как он выглядит на столе.</p>
      </div>
      <div class="cats-layout">
        <ul class="cats" data-cats>{cats_rows}</ul>
        <aside class="cat-card" data-cat-card aria-hidden="true">
          <div class="cat-card-ph">{"".join(fast_img(dish(CAT_PREVIEW[c["id"]])["img"], sizes="(max-width: 900px) 92vw, 520px", extra=f' data-for="{c["id"]}"', cls="is-on" if i == 0 else "") for i, c in enumerate(MENU))}</div>
          <div class="cat-card-cap"><b data-cat-card-title>{MENU[0]["ru"]}</b><span data-cat-card-count>{len(MENU[0]["items"])} позиций</span></div>
        </aside>
      </div>
    </div>
  </section>

  <section class="section section--alt" aria-labelledby="sig-title">
    <div class="wrap">
      <div class="section-head">
        <h2 id="sig-title">Любимое <em>гостями</em></h2>
        <a class="link" href="menu.html">Всё меню {ic("i-arrow")}</a>
      </div>
      <div class="sig-grid">
        <a class="dish-card sig-main" href="menu.html#{dish('Ковурма лагман')['id']}">
          <div class="ph reveal">{mphoto("Ковурма лагман", "Ковурма лагман — жареная тянутая лапша с говядиной")}</div>
          <div class="dish-card-body"><div><h3>Ковурма лагман</h3><p>Жареная лапша, говядина, помидор, сельдерей, чеснок</p></div><span class="price">{price_of("Ковурма лагман")}</span></div>
        </a>
        <div class="sig-side">
          <a class="dish-card" href="menu.html#{dish('Норин')['id']}">
            <div class="ph reveal">{mphoto("Норин", "Норин с казы")}</div>
            <div class="dish-card-body"><div><h3>Норин</h3><p>Конина, тонко нарезанное тесто, казы — за 1 кг</p></div><span class="price">{price_of("Норин")}</span></div>
          </a>
          <a class="dish-card" href="menu.html#{dish('Наполеон')['id']}">
            <div class="ph reveal">{mphoto("Наполеон", "Шашлык Наполеон на шампурах")}</div>
            <div class="dish-card-body"><div><h3>Наполеон</h3><p>Говядина в сальнике, на углях</p></div><span class="price">{price_of("Наполеон")}</span></div>
          </a>
        </div>
      </div>
    </div>
  </section>

  <section class="section story" aria-labelledby="story-title">
    <div class="wrap story-grid">
      <div>
        {ORN_RULE}
        <h2 id="story-title" class="sr-only">Как мы готовим</h2>
        <p class="story-text" data-words>{story_html()}</p>
        <div class="story-foot"><span>5,0 из 5 по 1500+ оценкам в Яндекс Картах</span><a class="link" href="about.html">О ресторане {ic("i-arrow")}</a></div>
      </div>
      {medallion("medallion--story")}
    </div>
  </section>

  <section class="section" aria-labelledby="gallery-title">
    <div class="wrap">
      <div class="gallery-head">
        <h2 id="gallery-title">С нашего <em>дастархана</em></h2>
        <p>Шашлык Наполеон, казан-кабоб, свадебный плов и тахта кабоб — блюда для большого семейного стола.</p>
      </div>
      <div class="strip">
        <a class="ph reveal" href="menu.html#shashlik">{mphoto("Наполеон")}<span class="ph-label">Наполеон</span></a>
        <a class="ph reveal" href="menu.html#milliy">{mphoto("Казан-кабоб из баранины")}<span class="ph-label">Казан-кабоб</span></a>
        <a class="ph reveal" href="menu.html#milliy">{mphoto("Свадебный плов")}<span class="ph-label">Свадебный плов</span></a>
        <a class="ph reveal" href="menu.html#uygur">{mphoto("Тахта кабоб")}<span class="ph-label">Тахта кабоб</span></a>
      </div>
    </div>
  </section>

  <section class="section section--alt ai-teaser" aria-labelledby="ai-title">
    <div class="wrap">
      <div>
        <h2 id="ai-title">Не знаете, что <em>выбрать?</em></h2>
        <p class="lede">AI-помощник знает всё меню: подберёт блюда поострее или для компании, подскажет, как оформить доставку, и поможет забронировать стол.</p>
        <button class="btn" type="button" data-ai-open>Спросить помощника {ic("i-arrow")}</button>
      </div>
      <div class="chat-preview" data-chat-preview aria-hidden="true">
        <div class="chat-preview-head"><span class="ai-ava ai-ava--mascot" data-preview-ava>{mascot()}</span><div><b>Ёрдамчи</b><small>AI-помощник {SITE['name']}</small></div></div>
      </div>
    </div>
  </section>

  <section class="section" id="visit" aria-labelledby="visit-title">
    <div class="wrap">
      <h2 id="visit-title" class="sr-only">Как нас найти</h2>
      <p class="visit-moment"><a href="{MAP}" target="_blank" rel="noopener">Большая<br>кольцевая, <span class="gold">Эркин</span></a></p>
      <div class="visit-split">
        <div class="visit-panel">
          <div class="visit-cols">
            <div><h3>Адрес</h3><p class="visit-addr"><a href="{MAP}" target="_blank" rel="noopener">Катта халқа йўли, «Эркин»,<br>Зангиатинский район</a></p></div>
            <div><h3>Часы</h3><div class="hours">{"".join(f"<span>{d}</span><span>{t}</span>" for d, t in SITE["hours"])}</div></div>
          </div>
          <div class="visit-rows">
            <div>{ic("i-phone")}<a href="tel:{SITE['phone_href']}">{SITE['phone']}</a></div>
            <div>{ic("i-car")}<span>Доставка: {delivery_html}</span></div>
            <div>{ic("i-tg")}<a href="{SITE['bot']}" target="_blank" rel="noopener">Всё меню в Telegram-боте</a></div>
          </div>
        </div>
        {map_block("visit-map")}
      </div>
    </div>
  </section>

  <section class="section close-band" aria-labelledby="close-title">
    {medallion("medallion--close", src="assets/logo-dark.png")}
    <div class="wrap">
      <div>
        <h2 id="close-title">Соберёте семью или друзей? Забронируйте стол заранее</h2>
        <p>Оставьте заявку на сайте — администратор перезвонит и подтвердит бронь.</p>
      </div>
      <a class="btn btn--dark" href="contact.html#booking">Забронировать стол {ic("i-arrow")}</a>
    </div>
  </section>
</main>
""" + footer()
write("index.html", index)

# ---------------------------------------------------------------- MENU
def menu_items(cat):
    rows = []
    for it in cat["items"]:
        tg = "".join(f'<span class="tag tag--{t}">{TAG_LABEL[t]}</span>' for t in it["tags"])
        ph = (f'<div class="dish-ph">{fast_img(it["img"], it["ru"])}</div>'
              if it["img"] else f'<div class="dish-ph dish-ph--empty"><svg class="ph-orn" viewBox="0 0 400 400" aria-hidden="true">{MEDALLION_SVG}</svg><span class="ph-name">{it["ru"]}</span><small>Фото скоро</small></div>')
        desc = f'<p>{it["d_ru"]}</p>' if it["d_ru"] else ""
        rows.append(f"""<li class="menu-item" id="{it['id']}" data-id="{it['id']}" data-tags="{' '.join(it['tags'])}" data-search="{html.escape((it['ru'] + ' ' + it['uz'] + ' ' + it['en'] + ' ' + it['d_ru']).lower())}">
  {ph}
  <div class="menu-item-top"><h3>{it['ru']}</h3><span class="price{" price--na" if it["price"] is None else ""}" data-price>{sum_fmt(it['price'])}</span></div>
  {desc}
  <div class="meta"><span class="unit">{UNITS[it['unit']][1]}</span>{tg}<button class="edit-btn" type="button" data-edit>{ic("i-edit")}Изменить</button></div>
</li>""")
    return "\n".join(rows)

cats_nav = "".join(f'<a href="#{c["id"]}">{c["ru"]}<small>{len(c["items"])}</small></a>' for c in MENU)
cats_html = "".join(f"""<section class="menu-cat" id="{c['id']}" aria-labelledby="h-{c['id']}">
  <div class="wrap">
    <div class="menu-cat-head"><h2 id="h-{c['id']}">{c['ru']}</h2><span><button class="mini-btn admin-add" type="button" data-add-dish="{c['id']}">+ Добавить блюдо</button> <span data-cat-count>{len(c['items'])} позиций</span></span></div>
    <ul class="menu-list">{menu_items(c)}</ul>
  </div>
</section>
""" for c in MENU)
menu = head("menu",
    f"Меню {SITE['name_full']} с ценами — шашлыки, норин, лагман, шилпилдок",
    "Полное меню и цены Olim Polvon Milliy Taomlari: шашлыки на углях, норин, шилпилдок, ковурма лагман, уйгурская кухня, супы, салаты. Фото каждого блюда. Доставка по Ташкенту.",
    "menu.html", [restaurant_schema(), menu_schema(), crumbs_schema("Меню", "menu.html")]) + header("menu.html") + f"""
<main id="main">
  <div class="page-head">
    <div class="wrap menu-head">
      <div>
        <nav class="crumbs" aria-label="Хлебные крошки"><a href="index.html">Главная</a><span aria-hidden="true">/</span><span>Меню</span></nav>
        <h1>Меню</h1>
        <p class="lede">Все блюда с фото и ценами — так, как их подают на стол. Меню также есть в Telegram-боте.</p>
      </div>
      <label class="menu-search"><span class="sr-only">Поиск по меню</span>{ic("i-search")}<input type="search" data-menu-search placeholder="Найти блюдо: норин, шашлык…" autocomplete="off"></label>
    </div>
  </div>
  <div class="menu-bar">
    <div class="wrap">
      <nav class="cat-nav" aria-label="Разделы меню" data-cat-nav><span class="cat-pill" aria-hidden="true"></span>{cats_nav}</nav>
    </div>
  </div>
  {cats_html}
  <div class="wrap"><p class="menu-empty" data-menu-empty hidden>Ничего не нашли. Попробуйте другое слово или спросите помощника.</p><p class="menu-note">Цены могут меняться. Об аллергиях предупредите официанта.</p></div>
</main>
""" + footer()
write("menu.html", menu)

# ---------------------------------------------------------------- ABOUT
credits = json.loads((ROOT / IMG / "credits.json").read_text())["photos"]
cred_html = "".join(f'<li><a href="{c["page"]}" target="_blank" rel="noopener">{html.escape(c["alt"])}</a> — {html.escape(c["by"])}, <a href="{c["licenceUrl"]}" target="_blank" rel="noopener">{c["licence"]}</a></li>' for c in credits if c["id"] in USED_PHOTOS)
features = [("Кухня", "узбекская, уйгурская, европейская"), ("Часы", "ежедневно, 06:00 – 23:00"), ("Оплата", "наличные, карта, перевод, рассрочка"),
            ("Доставка и навынос", "есть"), ("Wi-Fi", "есть"), ("Спортивные трансляции", "есть")]
about = head("about",
    f"О ресторане {SITE['name_full']} — семейный ресторан национальной кухни",
    "Olim Polvon Milliy Taomlari — семейный ресторан узбекской, уйгурской и европейской кухни на Большой кольцевой в Ташкенте. Мясной центр, доставка, рейтинг 5,0 в Яндекс Картах.",
    "about.html", [restaurant_schema(), crumbs_schema("О нас", "about.html")]) + header("about.html") + f"""
<main id="main">
  <div class="page-head">
    <div class="wrap">
      <nav class="crumbs" aria-label="Хлебные крошки"><a href="index.html">Главная</a><span aria-hidden="true">/</span><span>О нас</span></nav>
      <h1>Семейный ресторан национальной кухни</h1>
      <p class="lede">{SITE['name_full']} — место, куда приезжают всей семьёй за норином, қовурма лағмоном и кабобами. Узбекская, уйгурская и европейская кухня в одном меню.</p>
    </div>
  </div>
  <section class="section" style="padding-top:0" aria-label="Фотографии">
    <div class="wrap about-pair">
      <div class="ph reveal">{mphoto("Шилпилдок", "Шилпилдок на резной деревянной доске")}</div>
      <div class="ph reveal">{mphoto("Норин")}</div>
    </div>
  </section>
  <section class="section" style="padding-top:0" aria-labelledby="kitchen-title">
    <div class="wrap">
      <div class="prose">
        <h2 id="kitchen-title">Кухня</h2>
        <div class="prose-body">
          <p>Основа меню — блюда, ради которых в Ташкенте ходят в «милли таомлар»: норин, шилпилдок, халим, жаркоп, илик шўрва и нўхат шўрак.</p>
          <p>Уйгурская часть — это лагманы. Лапшу тянут вручную, а қовурма лағмон гости называют главным блюдом ресторана.</p>
          <p>Кабобы жарят на углях из халяль-мяса: тахта, наполеон, кавказ, гиждуван қийма, куриный и рыбный.</p>
        </div>
      </div>
      <div class="principles">
        <div><h3>Мясной центр</h3><p>При ресторане работает мясная лавка: казы и рулеты из конины, говяжий и бараний рулет, копчёная курица.</p></div>
        <div><h3>Доставка</h3><p>Заказ по телефонам {", ".join(p for p, h in SITE["delivery"])} или через Telegram-бот.</p></div>
        <div><h3>Для всей семьи</h3><p>Большие порции на компанию — например, норин с казы на килограмм.</p></div>
      </div>
    </div>
  </section>
  <section class="section section--alt" id="hall" aria-labelledby="hall-title">
    <div class="wrap hall">
      <div class="ph reveal">{mphoto("Казан-кабоб из говядины")}</div>
      <div>
        <h2 id="hall-title">Что важно знать</h2>
        <ul class="hall-facts">{"".join(f"<li><span>{a}</span><span>{b}</span></li>" for a, b in features)}</ul>
        <div style="margin-top:32px"><a class="btn" href="contact.html#booking">Забронировать стол {ic("i-arrow")}</a></div>
      </div>
    </div>
  </section>
</main>
""" + footer()
write("about.html", about)

# ---------------------------------------------------------------- CONTACT
faq_html = "".join(f'<details><summary>{q}{ic("i-plus")}</summary><p>{a}</p></details>' for q, a in FAQ)
times = "".join(f'<option>{h:02d}:{m:02d}</option>' for h in range(10, 23) for m in (0, 30))
contact = head("contact",
    f"Контакты и бронь — {SITE['name_full']}, Большая кольцевая, Ташкент",
    "Адрес, телефоны доставки и онлайн-бронь стола в Olim Polvon Milliy Taomlari: Катта халқа йўли, Эркин. Работаем ежедневно 06:00–23:00.",
    "contact.html", [restaurant_schema(), faq_schema(), crumbs_schema("Контакты", "contact.html")]) + header("contact.html") + f"""
<main id="main">
  <div class="page-head">
    <div class="wrap">
      <nav class="crumbs" aria-label="Хлебные крошки"><a href="index.html">Главная</a><span aria-hidden="true">/</span><span>Контакты</span></nav>
      <h1>Бронь стола и контакты</h1>
      <p class="lede">Оставьте заявку — администратор подтвердит её звонком или сообщением в Telegram в течение 15 минут.</p>
    </div>
  </div>
  <section class="section" style="padding-top:0" aria-label="Бронирование">
    <div class="wrap contact-grid">
      <div class="booking" id="booking">
        <form data-booking novalidate>
          <h2>Забронировать стол</h2>
          <p class="muted">Бронь платная: стоимость подскажет администратор, когда перезвонит. Держим стол 20 минут.</p>
          <div class="booking-rules"><b>Правила брони</b><ul><li>Свою еду, торты и напитки приносить нельзя.</li><li>Торт, десерты и всё для праздника можно заказать у нас.</li></ul></div>
          <div class="form-grid">
            <div class="field"><label for="b-name">Имя</label><input id="b-name" name="name" autocomplete="given-name" required><span class="err"></span></div>
            <div class="field"><label for="b-phone">Телефон</label><input id="b-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+998" required><span class="err"></span></div>
            <div class="field full picker"><span class="lbl" id="d-label">День</span>
              <div class="pick-row"><button class="pick-nav" type="button" data-scroll="days" data-dir="-1" aria-label="Назад">{ic("i-arrow")}</button><div class="day-strip" role="radiogroup" aria-labelledby="d-label" data-days></div><button class="pick-nav" type="button" data-scroll="days" data-dir="1" aria-label="Дальше">{ic("i-arrow")}</button></div>
              <input id="b-date" name="date" type="hidden" required><span class="err"></span></div>
            <div class="field full picker"><span class="lbl" id="t-label">Время</span>
              <div class="time-grid" role="radiogroup" aria-labelledby="t-label" data-times></div>
              <input id="b-time" name="time" type="hidden" required><span class="err"></span></div>
            <div class="field"><label id="g-label">Гостей</label>
              <div class="guests" role="group" aria-labelledby="g-label"><button type="button" data-g="-1" aria-label="Меньше гостей">−</button><output data-guests aria-live="polite">2</output><button type="button" data-g="1" aria-label="Больше гостей">+</button></div>
            </div>
            <div class="field"><label for="b-zone">Где сесть</label><select id="b-zone" name="zone"><option>Неважно</option><option>Общий зал</option><option>Отдельный стол для семьи</option></select></div>
            <div class="field full"><label for="b-note">Пожелания</label><textarea id="b-note" name="note" placeholder="День рождения, детский стульчик, норин к приходу…"></textarea></div>
            <div class="full"><button class="btn btn--cobalt" type="submit" style="width:100%">Отправить заявку {ic("i-arrow")}</button></div>
          </div>
        </form>
        <div class="form-success" data-success role="status">
          <svg class="check-draw" viewBox="0 0 72 72" aria-hidden="true"><circle cx="36" cy="36" r="34"/><path d="M23 37l9 9 17-19"/></svg>
          <h2>Заявка принята</h2>
          <p class="muted" data-success-text></p>
          <p class="hint">Демо: заявка сохранена в админ-панели этого браузера. После запуска будет приходить администратору в Telegram.</p>
          <button class="btn btn--ghost" type="button" data-again>Новая заявка</button>
        </div>
      </div>
      <aside class="info-panel" aria-label="Контакты">
        <div class="info-block"><h3>Адрес</h3><p><a href="{MAP}" target="_blank" rel="noopener">Катта халқа йўли, «Эркин», Зангиатинский район</a></p></div>
        <div class="info-block"><h3>Телефон</h3><p><a href="tel:{SITE['phone_href']}">{SITE['phone']}</a></p></div>
        <div class="info-block"><h3>Часы работы</h3><div class="hours" style="font-size:18px">{"".join(f"<span>{d}</span><span>{t}</span>" for d, t in SITE["hours"])}</div></div>
        <div class="info-block"><h3>Доставка</h3><p>{" · ".join(f'<a href="tel:{h}">{p}</a>' for p, h in SITE["delivery"])}</p></div>
        <div class="info-block"><h3>Telegram</h3><p><a href="{SITE['bot']}" target="_blank" rel="noopener">@Olimpolvon_bot — всё меню</a></p></div>
      </aside>
    </div>
    <div class="wrap contact-map" id="map" aria-labelledby="map-title">
      <h2 id="map-title">Как нас <em>найти</em></h2>
      {map_block()}
    </div>
    <div class="wrap faq" aria-labelledby="faq-title">
      <h2 id="faq-title" style="margin-bottom:24px">Частые вопросы</h2>
      {faq_html}
    </div>
  </section>
</main>
""" + footer()
write("contact.html", contact)

# ---------------------------------------------------------------- ADMIN
admin = head("admin", f"Панель администратора — {SITE['name']}", "Служебная страница.", "admin.html", [], noindex=True) + header("") + f"""
<main id="main" class="admin-page">
  <div class="wrap">
    <form class="admin-login" data-admin-login novalidate hidden>
      <h1 style="font-size:44px">Вход для персонала</h1>
      <div class="field"><label for="a-pass">Пароль</label><input id="a-pass" type="password" autocomplete="current-password" required><span class="err" aria-live="polite"></span></div>
      <button class="btn" type="submit">Войти</button>
    </form>
    <div class="admin-layout" data-admin-app hidden>
      <nav class="admin-side" role="tablist" aria-label="Разделы панели">
        <button role="tab" aria-selected="true" aria-controls="p-overview" id="t-overview">{ic("i-grid")}Обзор</button>
        <button role="tab" aria-selected="false" aria-controls="p-bookings" id="t-bookings">{ic("i-cal")}Заказы и брони</button>
        <button role="tab" aria-selected="false" aria-controls="p-menu" id="t-menu">{ic("i-list")}Меню и стоп-лист</button>
        <button role="tab" aria-selected="false" aria-controls="p-ai" id="t-ai">{ic("mark")}AI-помощник</button>
      </nav>
      <div>
        <section class="admin-panel" id="p-overview" role="tabpanel" aria-labelledby="t-overview">
          <h1 style="font-size:52px;margin-bottom:24px">Добрый день!</h1>
          <div class="kpis">
            <div class="kpi"><span>Заявок на бронь</span><b data-kpi="bookings">0</b></div>
            <div class="kpi"><span>Заказов на доставку</span><b data-kpi="orders">0</b></div>
            <div class="kpi"><span>Блюд в меню</span><b data-kpi="dishes">0</b></div>
            <div class="kpi"><span>В стоп-листе</span><b data-kpi="stop">0</b></div>
          </div>
          <p class="muted">Это демо-панель: данные хранятся в этом браузере. В рабочей версии заявки, меню и стоп-лист будут общими для сайта и Telegram-бота (Cloudflare Workers + D1).</p>
        </section>
        <section class="admin-panel" id="p-bookings" role="tabpanel" aria-labelledby="t-bookings" hidden>
          <h2>Заказы: доставка и навынос</h2>
          <div class="table-wrap" data-orders></div>
          <h2 style="margin-top:40px">Заявки на бронь</h2>
          <div class="table-wrap" data-bookings></div>
        </section>
        <section class="admin-panel" id="p-menu" role="tabpanel" aria-labelledby="t-menu" hidden>
          <h2>Меню и стоп-лист</h2>
          <p class="muted" style="margin:-8px 0 20px">Цена и стоп-лист сразу меняются на странице меню и в ответах AI-помощника.</p>
          <div class="table-wrap" data-menu-editor></div>
          <div style="display:flex;gap:12px;margin-top:20px"><button class="btn btn--ghost" type="button" data-menu-reset>Сбросить изменения</button></div>
        </section>
        <section class="admin-panel" id="p-ai" role="tabpanel" aria-labelledby="t-ai" hidden>
          <h2>AI-помощник</h2>
          <form class="admin-form admin-notes" data-ai-notes>
            <h3>Акции и новости для всех гостей</h3>
            <p class="muted">Напишите обычным текстом — помощник запомнит и будет рассказывать об этом всем гостям. Сохраняется в Google, видно сразу на всех устройствах.</p>
            <div class="field"><label for="ai-notes">Что сейчас действует</label><textarea id="ai-notes" name="notes" rows="6" maxlength="1500" placeholder="Например:&#10;Скидка 10% на всё меню навынос до 31 декабря.&#10;По пятницам с 19:00 живая музыка.&#10;Детский стульчик есть, парковка во дворе бесплатная."></textarea><span class="hint" data-notes-meta></span></div>
            <div class="field"><label for="ai-notes-pass">Пароль администратора</label><input id="ai-notes-pass" name="password" type="password" autocomplete="current-password" required><span class="hint">Пароль проверяет Google, а не браузер.</span></div>
            <div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn" type="submit">Сохранить для всех</button><button class="btn btn--ghost" type="button" data-notes-clear>Очистить</button></div>
            <p class="hint" data-notes-status role="status"></p>
          </form>
          <h3 style="margin-top:40px">Настройки этого устройства</h3>
          <form class="admin-form" data-ai-settings>
            <div class="field"><label for="ai-greet">Приветствие</label><textarea id="ai-greet" name="greeting"></textarea></div>
            <div class="field"><label for="ai-tone">Тон ответов</label><select id="ai-tone" name="tone"><option value="warm">Тёплый, на «вы»</option><option value="short">Коротко и по делу</option><option value="fun">С юмором</option></select></div>
            <div class="field"><label for="ai-endpoint">Адрес AI-сервера (Cloudflare Worker)</label><input id="ai-endpoint" name="endpoint" type="url" placeholder="https://olim-ai.….workers.dev"><span class="hint" data-ai-status>Пусто — помощник отвечает по заготовленным сценариям. Ключ Gemini хранится только в Cloudflare.</span></div>
            <div><button class="btn" type="submit">Сохранить</button></div>
          </form>
        </section>
      </div>
    </div>
  </div>
</main>
""" + footer()
write("admin.html", admin)

# ---------------------------------------------------------------- 404, robots, sitemap, manifest
write("404.html", head("404", f"Страница не найдена — {SITE['name']}", "Такой страницы нет.", "404.html", [], noindex=True) + header("") + f"""
<main id="main"><div class="page-head"><div class="wrap"><h1>Такой страницы нет</h1><p class="lede">Возможно, страницу переместили. Начните с главной или загляните в меню.</p><div class="hero-actions"><a class="btn" href="index.html">На главную</a><a class="btn btn--ghost" href="menu.html">Меню</a></div></div></div></main>
""" + footer())
today = datetime.date.today().isoformat()
pages = [("", "1.0", "weekly"), ("menu.html", "0.9", "weekly"), ("contact.html", "0.8", "monthly"), ("about.html", "0.6", "monthly")]
write("sitemap.xml", '<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' + "".join(
    f"  <url><loc>{SITE['domain']}/{p}</loc><lastmod>{today}</lastmod><changefreq>{f}</changefreq><priority>{pr}</priority></url>\n" for p, pr, f in pages) + "</urlset>\n")
write("robots.txt", f"User-agent: *\nAllow: /\nDisallow: /admin.html\n\nSitemap: {SITE['domain']}/sitemap.xml\n")
write("site.webmanifest", json.dumps({"name": f"{SITE['name_full']}", "short_name": SITE["name"], "start_url": "/", "display": "standalone",
    "background_color": "#f4ede1", "theme_color": "#f4ede1", "icons": [{"src": "assets/icon-512.png", "sizes": "512x512", "type": "image/png"}, {"src": "assets/apple-touch-icon.png", "sizes": "180x180", "type": "image/png"}]}, ensure_ascii=False, indent=1))
print("built", [p.name for p in ROOT.glob("*.html")])

# ---------------------------------------------------------------- languages
import build_i18n
build_i18n.run(ROOT, SITE)
