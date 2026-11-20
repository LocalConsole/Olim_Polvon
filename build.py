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
    "instagram": "https://instagram.com/_olim_polvon",
    "yandex": "https://yandex.uz/maps/org/89114477009/",
    "rating": "5,0", "ratings": "1500+",
    "hours": [("Ежедневно", "06:00 – 23:00")],
    "hours_schema": [("Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"), "06:00", "23:00"],
    "price_range": "от 150 000 сум на человека",
}
MAP = SITE["yandex"]
YEAR = datetime.date.today().year
IMG = "assets/img/"

# ---------------------------------------------------------------- menu data
# tags: hit, spicy, veg. Prices in sum (assumed until the restaurant sends its own).
MENU = [
    {"id": "kabob", "title": "Шашлык и кабобы", "photo": None,
     "text": "Кабобы жарим на углях, мясо халяль. Цены за 100 г, если не указано иное.",
     "items": [
        ("Шашлык кусковой из баранины", "Мякоть баранины на углях, с луком", "100 г", 37800, ["hit"]),
        ("Шашлык молотый", "Рубленая баранина с курдюком", "110 г", 35100, []),
        ("Шашлык из курицы", "Куриное филе в маринаде", "100 г", 28350, []),
        ("Тахта кабоб", "Подаётся на деревянной доске", "1 порция", None, []),
        ("Наполеон кабоб", "Слоёный кабоб, одна из визитных карточек дома", "1 порция", None, ["hit"]),
        ("Кавказ кабоб", "Кабоб по-кавказски", "1 порция", None, []),
        ("Гиждуван қийма кабоб", "Рубленое мясо по-гиждувански", "1 шампур", None, []),
        ("Балиқ кабоб", "Рыба на мангале", "1 порция", None, []),
     ]},
    {"id": "milliy", "title": "Национальные блюда", "photo": "own-plov", "alt": "Плов с говядиной, нутом и жёлтой морковью на синем блюде",
     "text": "То, за чем приезжают на Большую кольцевую: норин, бешбармак, халим.",
     "items": [
        ("Норин", "Тонко нарезанное тесто и конина, по-ташкентски", "250 г", 67500, ["hit"]),
        ("Норин с казы", "Большая порция на компанию, с казы", "1 кг", 189000, []),
        ("Бешбармак", "Тесто, отварное мясо, лук, бульон отдельно", "600 г", 118800, []),
        ("Халим с говядиной", "Пшеница, томлённая с говядиной до однородности", "400 г", 81000, []),
        ("Жаркоп", "Мясо с картофелем, томлённое в казане", "1 порция", None, []),
        ("Узбекский плов", "Рис, говядина, жёлтая морковь, нут", "1 порция", None, ["hit"]),
        ("Тандир гўшт", "Баранина, запечённая в тандире, с луком", "1 порция", None, []),
        ("Юпқа", "Тонкие лепёшки-конверты из теста, обжаренные на сковороде", "1 порция", None, []),
        ("Долма", "Виноградные листья с мясом и рисом", "1 порция", None, []),
     ]},
    {"id": "lagman", "title": "Лагман", "photo": None,
     "text": "Лапшу тянем вручную. Қовурма лағмон — блюдо, которое гости называют главным у нас.",
     "items": [
        ("Қовурма лағмон", "Жареная тянутая лапша с мясом, перцем и чесноком", "400 г", 62100, ["hit", "spicy"]),
        ("Лагман с мясом", "Тянутая лапша с мясной заправкой", "350 г", 66150, []),
        ("Уйгурский лагман", "Лапша отдельно, заправка с овощами", "1 порция", None, ["spicy"]),
     ]},
    {"id": "soups", "title": "Супы", "photo": None,
     "text": "Густые супы на костном бульоне — с утра, с 06:00.",
     "items": [
        ("Илик шўрва", "Суп на мозговой кости", "1 порция", None, []),
        ("Нўхат шўрак", "Нут с мясом в наваристом бульоне", "1 порция", None, []),
     ]},
    {"id": "desserts", "title": "Десерты", "photo": "own-medovik", "alt": "Кусок медовика на тарелке",
     "text": "К чаю.",
     "items": [
        ("Медовик", "Медовые коржи со сметанным кремом", "1 кусок", None, []),
     ]},
    {"id": "meat", "title": "Мясной центр", "photo": "own-tandir-butun", "alt": "Запечённое мясо целым куском на блюде",
     "text": "При ресторане работает мясная лавка: домашние казы, рулеты и копчёности. Цены уточняйте по телефону.",
     "items": [
        ("Казы из конины", "Домашняя колбаса из конины", "1 кг", None, []),
        ("Рулет из конины", "", "1 кг", None, []),
        ("Говяжий рулет", "", "1 кг", None, []),
        ("Тандир-рулет из баранины", "", "1 кг", None, []),
        ("Копчёная курица", "", "1 шт", None, []),
     ]},
]

USED_PHOTOS = {"f163008803"}
TAG_LABEL = {"hit": "Хит", "spicy": "Острое", "veg": "Без мяса"}

def slug(s):
    tr = dict(zip("абвгдеёжзийклмнопрстуфхцчшщъыьэюя", ["a","b","v","g","d","e","e","zh","z","i","y","k","l","m","n","o","p","r","s","t","u","f","h","c","ch","sh","sch","","y","","e","yu","ya"]))
    out = "".join(tr.get(c, c) for c in s.lower())
    return "".join(c if c.isalnum() else "-" for c in out).strip("-").replace("--", "-")

def sum_fmt(n):
    if n is None: return "цена уточняется"
    return f"{n:,}".replace(",", " ") + " сум"

ITEM_IMG = {"Узбекский плов": IMG + "plate-own-plov.webp", "Долма": IMG + "plate-own-dolma.webp", "Юпқа": IMG + "plate-own-yupqa.webp", "Тандир гўшт": IMG + "plate-own-tandir.webp", "Медовик": IMG + "photo-own-medovik-500.webp", "Казы из конины": IMG + "photo-own-tandir-butun-500.webp"}
for _n in ["Шашлык кусковой из баранины", "Шашлык молотый", "Шашлык из курицы", "Тахта кабоб", "Наполеон кабоб", "Кавказ кабоб", "Гиждуван қийма кабоб", "Балиқ кабоб"]:
    ITEM_IMG[_n] = ""
MENU_JSON = []
for cat in MENU:
    for name, desc, weight, price, tags in cat["items"]:
        MENU_JSON.append({"id": slug(name), "key": name, "cat": cat["id"], "catTitle": cat["title"], "name": name, "desc": desc,
                          "weight": weight, "price": price, "tags": tags,
                          "img": ITEM_IMG.get(name) or None})

def img(id_, alt, sizes="(max-width: 900px) 100vw, 50vw", eager=False, has1280=True, cls=""):
    srcset = f"{IMG}photo-{id_}-500.webp 500w, {IMG}photo-{id_}-960.webp 960w" + (f", {IMG}photo-{id_}.webp 1280w" if has1280 else "")
    src = f"{IMG}photo-{id_}-960.webp"
    load = 'fetchpriority="high"' if eager else 'loading="lazy"'
    c = f' class="{cls}"' if cls else ""
    return f'<img{c} src="{src}" srcset="{srcset}" sizes="{sizes}" alt="{html.escape(alt)}" {load} decoding="async">'
NO1280 = {"f35692261", "f163008803", "f35800820", "f87375834", "f199837380"}
def photo(id_, alt, **kw):
    kw.setdefault("has1280", id_ not in NO1280)
    return img(id_, alt, **kw)

# ---------------------------------------------------------------- icons
ICONS = """<svg width="0" height="0" style="position:absolute" aria-hidden="true">
<symbol id="i-arrow" viewBox="0 0 24 24"><path d="M5 12h14M13 6l6 6-6 6"/></symbol>
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
<symbol id="i-edit" viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13 7l4 4"/></symbol>
<symbol id="mark" viewBox="0 0 40 40"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="9.5" y="9.5" width="21" height="21" rx="2"/><rect x="9.5" y="9.5" width="21" height="21" rx="2" transform="rotate(45 20 20)"/></g><circle cx="20" cy="20" r="3.6" fill="currentColor"/></symbol>
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
        "description": "Семейный ресторан узбекской, уйгурской и европейской кухни на Большой кольцевой (Эркин), Ташкент: қовурма лағмон, норин, бешбармак, халим, кабобы на углях. Доставка.",
        "url": SITE["domain"] + "/",
        "image": [SITE["domain"] + "/" + IMG + "photo-own-plov.webp", SITE["domain"] + "/" + IMG + "photo-own-gosht.webp", SITE["domain"] + "/share.jpg"],
        "logo": SITE["domain"] + "/assets/favicon.svg",
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
            "@type": "MenuSection", "name": c["title"], "description": c["text"],
            "hasMenuItem": [{
                "@type": "MenuItem", "name": n, "description": d,
                **({"offers": {"@type": "Offer", "price": p, "priceCurrency": "UZS"}} if p else {}),
                **({"suitableForDiet": "https://schema.org/VegetarianDiet"} if "veg" in t else {}),
            } for n, d, w, p, t in c["items"]],
        } for c in MENU],
    }

def crumbs_schema(name, path):
    return {"@context": "https://schema.org", "@type": "BreadcrumbList", "itemListElement": [
        {"@type": "ListItem", "position": 1, "name": "Главная", "item": SITE["domain"] + "/"},
        {"@type": "ListItem", "position": 2, "name": name, "item": SITE["domain"] + "/" + path}]}

FAQ = [
    ("Есть ли доставка?", f"Да. Заказать можно по телефонам {SITE['delivery'][0][0]} и {SITE['delivery'][1][0]} или через Telegram-бот @Olimpolvon_bot."),
    ("Во сколько вы открываетесь?", "Работаем ежедневно с 06:00 до 23:00. С утра — супы и национальные блюда."),
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
    pre = f'<link rel="preload" as="image" href="{preload_img}" fetchpriority="high">' if preload_img else ""
    return f"""<!doctype html>
<html lang="ru" class="no-js" data-page="{page}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<title>{html.escape(title)}</title>
<meta name="description" content="{html.escape(desc)}">
{robots}
<link rel="canonical" href="{url}">
<meta name="theme-color" content="#f4ede1">
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
<link rel="icon" href="assets/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="assets/apple-touch-icon.png">
<link rel="manifest" href="site.webmanifest">
<link rel="preload" href="assets/fonts/CormorantGaramond-normal-600-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="assets/fonts/Manrope-normal-400-700-cyrillic.woff2" as="font" type="font/woff2" crossorigin>
{pre}
<link rel="stylesheet" href="assets/style.css">
<script>(function(d){{d.classList.replace('no-js','js');try{{if(sessionStorage.getItem('polvon_admin')==='1')d.classList.add('is-admin');if(sessionStorage.getItem('polvon_intro')||matchMedia('(prefers-reduced-motion: reduce)').matches)d.classList.add('no-intro')}}catch(e){{d.classList.add('no-intro')}}}})(document.documentElement)</script>
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
      <svg aria-hidden="true"><use href="#mark"/></svg><span class="brand-word">{SITE['name']}</span>
    </a>
    <nav class="nav" id="site-nav" aria-label="Основное меню">
      {links}
      <div class="lang-switch" role="group" aria-label="Язык / Til / Language"><a data-lang="ru" lang="ru" hreflang="ru" href="#">RU</a><a data-lang="uz" lang="uz" hreflang="uz" href="#">UZ</a><a data-lang="en" lang="en" hreflang="en" href="#">EN</a></div>
      <a class="btn btn--cobalt" href="contact.html#booking">Забронировать стол</a>
    </nav>
    <button class="menu-toggle" type="button" aria-expanded="false" aria-controls="site-nav" aria-label="Открыть меню"><span></span><span></span></button>
  </div>
</header>"""

def footer():
    hours = "".join(f"<span>{d}</span><span>{t}</span>" for d, t in SITE["hours"])
    return f"""<footer class="site-footer">
  <div class="wrap">
    <div class="footer-top">
      <div>
        <h2>{SITE['name']}</h2>
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
      <span>© {YEAR} {SITE['name']}. <a href="about.html#credits">Фото и лицензии</a></span>
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
<section class="ai-panel" id="ai-panel" role="dialog" aria-label="Ёрдамчи, AI-помощник ресторана" aria-modal="false">
  <div class="ai-head">
    <span class="ai-ava ai-ava--mascot" data-ai-ava>{mascot()}</span>
    <div><b>Ёрдамчи</b><span class="ai-status">AI-помощник {SITE['name']}</span></div>
    <button class="ai-close" type="button" data-ai-close aria-label="Закрыть чат">{ic("i-close")}</button>
  </div>
  <div class="ai-msgs" data-ai-msgs aria-live="polite"></div>
  <div class="ai-chips" data-ai-chips></div>
  <div>
    <form class="ai-form" data-ai-form>
      <label class="sr-only" for="ai-input">Сообщение</label>
      <input id="ai-input" type="text" placeholder="Спросите про меню или бронь" autocomplete="off" maxlength="300">
      <button class="ai-send" type="submit" aria-label="Отправить">{ic("i-send")}</button>
    </form>
    <p class="ai-foot">Демо-версия: ответы пока заготовлены, подключим Gemini позже</p>
  </div>
</section>
<div class="toast-host" aria-live="polite"></div>
<script id="menu-data" type="application/json">{json.dumps(MENU_JSON, ensure_ascii=False)}</script>
<script src="assets/app.js" defer></script>
</body>
</html>"""

def write(name, content):
    (ROOT / name).write_text(content, encoding="utf-8")

def price_of(name):
    for x in MENU_JSON:
        if x["name"] == name: return sum_fmt(x["price"])

# ---------------------------------------------------------------- INDEX
marquee_items = ["Қовурма лағмон", "Норин", "Наполеон кабоб", "Бешбармак", "Халим", "Тахта кабоб", "Илик шўрва", "Уйгурский лагман"]
mq = "".join(f"<span>{t}</span>{ic('mark','')}" for t in marquee_items)
plates = [  # positions on the dastarkhan (x, y in % of table)
    ("plov", "plate-own-plov.webp", "Узбекский плов", "-23%", "-21%"),
    ("dolma", "plate-own-dolma.webp", "Долма", "23%", "-21%"),
    ("tandir", "plate-own-tandir.webp", "Тандир гўшт", "23%", "21%"),
    ("yupqa", "plate-own-yupqa.webp", "Юпқа", "-23%", "21%"),
]
plate_html = "".join(f'<button class="plate" type="button" style="--x:{x};--y:{y}" data-dish="{n}" data-price="{price_of(n)}" aria-label="{n}, {price_of(n)}"><span class="plate-inner"><img src="{IMG}{f}" alt="" width="560" height="560" decoding="async"></span></button>' for k, f, n, x, y in plates)

story_words = [("Плов", None), ("pill:plate-own-plov.webp", None), ("готовим в казане,", None), ("мясо", None), ("pill:plate-own-tandir.webp", None), ("запекаем в тандире,", None),
               ("лапшу для лагмана тянем вручную.", None),
               ("Всё — из халяль-продуктов", "accent"), ("и своего мясного центра.", None)]
def story_html():
    out = []
    for t, cls in story_words:
        if t.startswith("pill:"):
            out.append(f'<span class="pill"><img src="{IMG}{t[5:]}" alt="" loading="lazy"></span>')
        else:
            for w in t.split(" "):
                out.append(f'<span class="w{" " + cls if cls else ""}">{w}</span>')
    return " ".join(out)

delivery_html = " · ".join(f'<a href="tel:{h}">{p}</a>' for p, h in SITE["delivery"])

INTRO = f'''<div class="intro" data-intro aria-hidden="true">
  <div class="intro-inner">
    <svg class="intro-mark" viewBox="0 0 40 40"><g fill="none" stroke="currentColor" stroke-width="2.2" stroke-linejoin="round"><rect x="9.5" y="9.5" width="21" height="21" rx="2"/><rect x="9.5" y="9.5" width="21" height="21" rx="2" transform="rotate(45 20 20)"/><circle cx="20" cy="20" r="3.6" fill="currentColor" stroke="none"/></g></svg>
    <div class="intro-word">{"".join(f'<span style="animation-delay:{d}ms">{"&nbsp;" if c == " " else c}</span>' for c, d in zip("Olim Polvon", [300, 340, 375, 405, 430, 450, 470, 488, 505, 520, 535]))}</div>
    <div class="intro-sub">Milliy taomlari</div>
  </div>
</div>
'''
index = head("home",
    f"{SITE['name_full']} — национальная кухня на Большой кольцевой, Ташкент",
    "Olim Polvon Milliy Taomlari — семейный ресторан узбекской и уйгурской кухни: қовурма лағмон, норин, бешбармак, кабобы на углях. Рейтинг 5,0 в Яндекс Картах. Доставка по Ташкенту.",
    "index.html", [restaurant_schema(), {"@context": "https://schema.org", "@type": "WebSite", "name": SITE["name_full"], "url": SITE["domain"] + "/", "inLanguage": "ru"}],
    preload_img=IMG + "plate-own-plov.webp") + header("index.html").replace('<a class="skip"', INTRO + '<a class="skip"', 1) + f"""
<main id="main">
  <section class="hero" aria-labelledby="hero-title">
    <div class="wrap hero-grid">
      <div>
        <h1 id="hero-title"><span class="line"><span>Национальная</span></span><span class="line"><span>кухня от</span></span><span class="line"><span><em>Olim Polvon</em></span></span></h1>
        <p class="lede" data-enter>Семейный ресторан узбекской и уйгурской кухни на Большой кольцевой: қовурма лағмон, норин, бешбармак и кабобы на углях.</p>
        <div class="hero-actions" data-enter>
          <a class="btn btn--cobalt" href="contact.html#booking">Забронировать стол {ic("i-arrow")}</a>
          <a class="btn btn--ghost" href="menu.html">Смотреть меню</a>
        </div>
        <div class="hero-facts" data-enter>
          <span>{ic("i-clock")}Ежедневно до 23:00</span>
          <span><a href="{SITE['yandex']}" target="_blank" rel="noopener" style="text-decoration:none">★ {SITE['rating']} в Яндекс Картах</a></span>
          <span>{ic("i-car")}Доставка</span>
        </div>
      </div>
      <div class="table-stage" data-table>
        <div class="table" data-table-inner>
          <div class="table-disc"></div>
          <div class="orbit">{plate_html}</div>
          <button class="plate plate--center" type="button" data-dish="Лепёшка к столу" data-price="к каждому заказу" aria-label="Лепёшка к столу"><span class="plate-inner"><img src="{IMG}plate-patyr.webp" alt="" width="560" height="560" decoding="async"></span></button>
          <div class="steam" aria-hidden="true"><span></span><span></span><span></span></div>
        </div>
        <div class="dish-caption" data-enter>
          <span class="dish-caption-text" data-caption aria-live="polite">Наведите на блюдо</span>
          <button class="spin-toggle" type="button" data-spin aria-pressed="false" aria-label="Остановить вращение">{ic("i-pause")}</button>
        </div>
      </div>
    </div>
  </section>

  <div class="marquee" aria-hidden="true"><div class="marquee-track"><div class="marquee-group">{mq}</div><div class="marquee-group">{mq}</div></div></div>

  <section class="section" aria-labelledby="sig-title">
    <div class="wrap">
      <div class="section-head">
        <h2 id="sig-title">Что заказывают первым</h2>
        <a class="link" href="menu.html">Всё меню {ic("i-arrow")}</a>
      </div>
      <div class="sig-grid">
        <a class="dish-card sig-main" href="menu.html#milliy">
          <div class="ph reveal">{photo("own-plov", "Узбекский плов с говядиной, нутом и жёлтой морковью", sizes="(max-width: 1000px) 100vw, 700px")}</div>
          <div class="dish-card-body"><div><h3>Узбекский плов</h3><p>Рис, говядина, жёлтая морковь, нут</p></div></div>
        </a>
        <div class="sig-side">
          <a class="dish-card" href="menu.html#milliy">
            <div class="ph reveal">{photo("own-tandir", "Тандир гўшт: запечённая баранина с луком", sizes="(max-width: 1000px) 50vw, 480px")}</div>
            <div class="dish-card-body"><div><h3>Тандир гўшт</h3><p>Баранина из тандира с луком</p></div></div>
          </a>
          <a class="dish-card" href="menu.html#milliy">
            <div class="ph reveal">{photo("own-yupqa", "Юпқа: тонкие лепёшки-конверты", sizes="(max-width: 1000px) 50vw, 480px")}</div>
            <div class="dish-card-body"><div><h3>Юпқа</h3><p>Тонкие конверты из теста</p></div></div>
          </a>
        </div>
      </div>
    </div>
  </section>

  <section class="section story" aria-labelledby="story-title">
    <div class="wrap">
      <h2 id="story-title" class="sr-only">Как мы готовим</h2>
      <p class="story-text" data-words>{story_html()}</p>
      <div class="story-foot"><span>{SITE['rating']} из 5 по {SITE['ratings']} оценкам в Яндекс Картах</span><a class="link" href="about.html">О ресторане {ic("i-arrow")}</a></div>
    </div>
  </section>

  <section class="section" aria-labelledby="kabob-title">
    <div class="wrap">
      <div class="strip-head">
        <h2 id="kabob-title">Мясо — из халяль-продуктов</h2>
        <p>Кабобы на углях, тандир гўшт и мясо целым куском для большого стола. При ресторане работает свой мясной центр.</p>
      </div>
      <div class="strip strip--3">
        <a class="ph reveal" href="menu.html#kabob">{photo("own-gosht", "Жареное мясо на блюде с красным луком и зеленью", sizes="(max-width: 1000px) 50vw, 384px")}</a>
        <a class="ph reveal" href="menu.html#meat">{photo("own-tandir-butun", "Запечённое мясо целым куском", sizes="(max-width: 1000px) 50vw, 384px")}</a>
        <a class="ph reveal" href="menu.html#milliy">{photo("own-dolma", "Долма в виноградных листьях", sizes="(max-width: 1000px) 50vw, 384px")}</a>
      </div>
    </div>
  </section>

  <section class="section section--alt ai-teaser" aria-labelledby="ai-title">
    <div class="wrap">
      <div>
        <h2 id="ai-title">Не знаете, что выбрать? Спросите помощника</h2>
        <p class="lede">AI-помощник знает всё меню: подберёт блюда поострее или для компании, подскажет, как оформить доставку, и поможет забронировать стол.</p>
        <button class="btn" type="button" data-ai-open>Открыть чат {ic("i-arrow")}</button>
      </div>
      <div class="chat-preview" data-chat-preview aria-hidden="true">
        <div class="chat-preview-head"><span class="ai-ava ai-ava--mascot" data-preview-ava>{mascot()}</span><div><b>Ёрдамчи</b><small>AI-помощник {SITE['name']}</small></div></div>
      </div>
    </div>
  </section>

  <section class="section" id="visit" aria-labelledby="visit-title">
    <div class="wrap">
      <h2 id="visit-title">Как нас найти</h2>
      <p class="visit-moment"><a href="{MAP}" target="_blank" rel="noopener">Большая кольцевая,<br>Эркин</a></p>
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
          <div><a class="btn btn--ghost" href="{MAP}" target="_blank" rel="noopener">Построить маршрут {ic("i-arrow")}</a></div>
        </div>
        <a class="ph visit-photo reveal" href="menu.html#milliy">{photo("own-yupqa", "Юпқа на тёмном блюде", sizes="(max-width: 1000px) 100vw, 588px")}</a>
      </div>
    </div>
  </section>

  <section class="section close-band" aria-labelledby="close-title">
    <div class="wrap">
      <div>
        <h2 id="close-title">Соберёте семью или друзей? Забронируйте стол заранее</h2>
        <p>Оставьте заявку на сайте — администратор перезвонит и подтвердит бронь.</p>
      </div>
      <a class="btn btn--light" href="contact.html#booking">Забронировать стол {ic("i-arrow")}</a>
    </div>
  </section>
</main>
""" + footer()
write("index.html", index)

# ---------------------------------------------------------------- MENU
def menu_items(cat):
    rows = []
    for name, desc, weight, price, tags in cat["items"]:
        tg = "".join(f'<span class="tag tag--{t}">{TAG_LABEL[t]}</span>' for t in tags)
        rows.append(f"""<li class="menu-item" id="{slug(name)}" data-id="{slug(name)}" data-tags="{' '.join(tags)}">
  <h3>{name}</h3><span class="price{" price--na" if price is None else ""}" data-price>{sum_fmt(price)}</span>
  <p>{desc}</p>
  <div class="meta"><span>{weight}</span>{tg}<button class="edit-btn" type="button" data-edit>{ic("i-edit")}Изменить</button></div>
</li>""")
    return "\n".join(rows)

cats_nav = "".join(f'<a href="#{c["id"]}">{c["title"]}</a>' for c in MENU)
cats_html = ""
for c in MENU:
    ph = f'<div class="ph reveal">{photo(c["photo"], c["alt"], sizes="(max-width: 900px) 100vw, 480px")}</div>' if c.get("photo") else ""
    cats_html += f"""<section class="menu-cat" id="{c['id']}" aria-labelledby="h-{c['id']}">
  <div class="wrap menu-cat-grid">
    <div class="menu-cat-aside"><h2 id="h-{c['id']}">{c['title']}</h2><p>{c['text']}</p>{ph}</div>
    <ul class="menu-list">{menu_items(c)}</ul>
  </div>
</section>
"""
menu = head("menu",
    f"Меню {SITE['name_full']} с ценами — лагман, норин, бешбармак, кабобы",
    "Меню и цены Olim Polvon Milliy Taomlari: қовурма лағмон, норин, бешбармак, халим, шашлык и кабобы на углях, супы, мясной центр. Доставка по Ташкенту.",
    "menu.html", [restaurant_schema(), menu_schema(), crumbs_schema("Меню", "menu.html")]) + header("menu.html") + f"""
<main id="main">
  <div class="page-head">
    <div class="wrap">
      <nav class="crumbs" aria-label="Хлебные крошки"><a href="index.html">Главная</a><span aria-hidden="true">/</span><span>Меню</span></nav>
      <h1>Меню и цены</h1>
      <p class="lede">Цены — из Яндекс Карт, часть блюд уточняется. Полное меню также в Telegram-боте.</p>
    </div>
  </div>
  <div class="menu-bar">
    <div class="wrap">
      <nav class="cat-nav" aria-label="Разделы меню" data-cat-nav><span class="cat-pill" aria-hidden="true"></span>{cats_nav}</nav>
      <div class="filters" role="group" aria-label="Фильтр блюд">
        <button class="chip" type="button" aria-pressed="false" data-filter="hit">Хиты</button>
        <button class="chip" type="button" aria-pressed="false" data-filter="spicy">Острое</button>
              </div>
    </div>
  </div>
  {cats_html}
  <div class="wrap"><p class="menu-note">Цены могут меняться. Об аллергиях предупредите официанта.</p></div>
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
      <div class="ph reveal">{photo("own-plov", "Плов на синем блюде", sizes="(max-width: 900px) 100vw, 700px")}</div>
      <div class="ph reveal">{photo("own-tandir-butun", "Запечённое мясо на блюде с зеленью", sizes="(max-width: 900px) 100vw, 480px")}</div>
    </div>
  </section>
  <section class="section" style="padding-top:0" aria-labelledby="kitchen-title">
    <div class="wrap">
      <div class="prose">
        <h2 id="kitchen-title">Кухня</h2>
        <div class="prose-body">
          <p>Основа меню — блюда, ради которых в Ташкенте ходят в «милли таомлар»: норин, бешбармак, халим, жаркоп, илик шўрва и нўхат шўрак.</p>
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
      <div class="ph reveal">{photo("own-gosht", "Мясное блюдо для большого стола", sizes="(max-width: 900px) 100vw, 640px")}</div>
      <div>
        <h2 id="hall-title">Что важно знать</h2>
        <ul class="hall-facts">{"".join(f"<li><span>{a}</span><span>{b}</span></li>" for a, b in features)}</ul>
        <div style="margin-top:32px"><a class="btn" href="contact.html#booking">Забронировать стол {ic("i-arrow")}</a></div>
      </div>
    </div>
  </section>
  <section class="section" id="credits" aria-labelledby="credits-title">
    <div class="wrap credits">
      <h2 id="credits-title" style="font-size:32px">Фотографии</h2>
      <p style="margin-top:12px">Фото блюд — ресторана Olim Polvon. Фото лепёшки — Wikimedia Commons:</p>
      <ul>{cred_html}</ul>
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
          <p class="muted">Бронь бесплатная, держим стол 20 минут.</p>
          <div class="form-grid">
            <div class="field"><label for="b-name">Имя</label><input id="b-name" name="name" autocomplete="given-name" required><span class="err"></span></div>
            <div class="field"><label for="b-phone">Телефон</label><input id="b-phone" name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+998" required><span class="err"></span></div>
            <div class="field"><label for="b-date">Дата</label><input id="b-date" name="date" type="date" required><span class="err"></span></div>
            <div class="field"><label for="b-time">Время</label><select id="b-time" name="time" required>{times}</select><span class="err"></span></div>
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
        <div class="ph reveal" style="aspect-ratio:4/3">{photo("own-medovik", "Медовик на тарелке", sizes="(max-width: 900px) 100vw, 480px")}</div>
      </aside>
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
        <button role="tab" aria-selected="false" aria-controls="p-bookings" id="t-bookings">{ic("i-cal")}Брони</button>
        <button role="tab" aria-selected="false" aria-controls="p-menu" id="t-menu">{ic("i-list")}Меню и стоп-лист</button>
        <button role="tab" aria-selected="false" aria-controls="p-ai" id="t-ai">{ic("mark")}AI-помощник</button>
      </nav>
      <div>
        <section class="admin-panel" id="p-overview" role="tabpanel" aria-labelledby="t-overview">
          <h1 style="font-size:52px;margin-bottom:24px">Добрый день!</h1>
          <div class="kpis">
            <div class="kpi"><span>Заявок на бронь</span><b data-kpi="bookings">0</b></div>
            <div class="kpi"><span>Блюд в меню</span><b data-kpi="dishes">0</b></div>
            <div class="kpi"><span>В стоп-листе</span><b data-kpi="stop">0</b></div>
          </div>
          <p class="muted">Это демо-панель: данные хранятся в этом браузере. В рабочей версии заявки, меню и стоп-лист будут общими для сайта и Telegram-бота (Cloudflare Workers + D1).</p>
        </section>
        <section class="admin-panel" id="p-bookings" role="tabpanel" aria-labelledby="t-bookings" hidden>
          <h2>Заявки на бронь</h2>
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
          <form class="admin-form" data-ai-settings>
            <div class="field"><label for="ai-greet">Приветствие</label><textarea id="ai-greet" name="greeting"></textarea></div>
            <div class="field"><label for="ai-tone">Тон ответов</label><select id="ai-tone" name="tone"><option value="warm">Тёплый, на «вы»</option><option value="short">Коротко и по делу</option><option value="fun">С юмором</option></select></div>
            <div class="field"><label for="ai-model">Модель</label><select id="ai-model" name="model" disabled><option>Gemini — подключим при запуске</option></select><span class="hint">Сейчас помощник отвечает по заготовленным сценариям.</span></div>
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
    "background_color": "#f4ede1", "theme_color": "#f4ede1", "icons": [{"src": "assets/favicon.svg", "sizes": "any", "type": "image/svg+xml"}, {"src": "assets/apple-touch-icon.png", "sizes": "180x180", "type": "image/png"}]}, ensure_ascii=False, indent=1))
print("built", [p.name for p in ROOT.glob("*.html")])

# ---------------------------------------------------------------- languages
import build_i18n
build_i18n.run(ROOT, SITE)
