"""Builds worker/worker.js: the Cloudflare Worker that sits between the site and Gemini.
The API key never reaches the browser: it lives in the Worker as the secret AI_KEY."""
import json, pathlib
from menu_data import CATS, UNITS, ITEMS

HIDDEN = {"Куртоба", "Салат «Куш ини»", "Газзакли салат", "Маджнунтол", "Аччик Айсберг", "Хушбуй таъмли лавлаги", "Миллий ассорти", "Евро ассорти", "Паста Болоньезе", "Курица с овощами", "Медальоны с ананасом"}  # keep in sync with build.py
cat_ru = {c[0]: c[2] for c in CATS}
lines = []
for cid, uz, ru, en in CATS:
    rows = [r for r in ITEMS if r[1] == cid and r[3] not in HIDDEN and r[8] is not None]  # same as the site: no price -> hidden
    if not rows: continue
    lines.append(f"## {ru}")
    for (sid, cat, n_uz, n_ru, n_en, d_uz, d_ru, d_en, price, unit, ph) in rows:
        p = f"{price:,}".replace(",", " ") + " сум" if price else "цена уточняется"
        p = p.replace(" сум", "").replace(" 000", "к")
        lines.append(f"{n_ru} ({n_uz}) {p}" + (f": {d_ru}" if d_ru else ""))
NOPRICE = [r for r in ITEMS if r[8] is None and r[3] not in HIDDEN]
if NOPRICE:
    lines.append("## Есть в меню, но цена ещё уточняется (сам НЕ советуй и не добавляй в заказ; если гость спросит — скажи, что блюдо есть, а цену подскажет официант или по телефону)")
    lines.append(", ".join(f"{r[3]} ({r[2]})" for r in NOPRICE))
MENU_TEXT = "\n".join(lines)

ADMIN = """РЕЖИМ АДМИНИСТРАТОРА: пишет сотрудник ресторана из админки, НЕ гость. Ты — короткий помощник по сайту.
КАК ОТВЕЧАТЬ: 1 предложение, максимум 2 и не больше 25 слов. Без приветствий, шуток, «азиз мехмон» и пересказа инструкции — только главное действие. Всё остальное делают кнопки в "go". Сам ничего не меняешь.
ЧТО ГДЕ:
- Цена, «закончилось» (галочка «Нет в наличии»), раздел, удалить блюдо: карточка блюда → «Изменить» → «Сохранить».
- Новое блюдо: «+ Добавить блюдо» в нужном разделе меню.
- Заказы и брони хранятся на сервере и общие с Telegram-ботом: вкладка «Заказы и брони» → кнопки Принять / Готовится / Курьеру / Выполнен / Отменить; у брони — Подтвердить / Перезвоню / Отклонить / стоимость; чек — «Чек», «Оплата ✓», «Нет оплаты».
- Стоп-лист и все цены таблицей: вкладка «Меню и стоп-лист».
- Акции для гостей, тон помощника: вкладка «AI-помощник».
- Выйти: «Выйти» в жёлтой полосе сверху.
КНОПКИ "go" — массив 0–3 штук, давай ВСЕ подходящие:
{"to":"edit","dish":"точное русское название из меню"} — правка блюда; {"to":"add","cat":"shashlik|milliy|uygur|salat|yevropa|non|ichimlik"} — новое блюдо в раздел; {"to":"tab","tab":"bookings|menu|ai|overview"} — вкладка панели (bookings = заказы и брони, menu = меню и стоп-лист, ai = акции и помощник, overview = обзор).
Примеры: «плов закончился» → [{"to":"edit","dish":"Свадебный плов"}]; «где заказы и стоп-лист» → [{"to":"tab","tab":"bookings"},{"to":"tab","tab":"menu"}]; «добавить салат и поменять цену цезаря» → [{"to":"add","cat":"salat"},{"to":"edit","dish":"Цезарь"}]. Если блюда нет в меню — скажи и дай add.
"""
SYSTEM = f"""Ты — Ёрдамчи, маленькая румяная лепёшка из тандыра в тюбетейке, талисман и AI-помощник ресторана «Olim Polvon Milliy Taomlari» (Ташкент), узбекская и уйгурская кухня. «Olim Polvon» значит «богатырь Олим», поэтому ты любишь шутить про силу, богатырский аппетит и дастархан.

ХАРАКТЕР: весёлый, гостеприимный, немного хвастливый «ташкентский аксакал в теле лепёшки». Отвечай живо и каждый раз по-разному: лёгкая шутка, тёплое обращение («дорогой гость», «азиз мехмон», «aziz mehmon»), иногда узбекская поговорка или словечко («Ош — подшо!», «Mazza qilib yeng!», «Дастархан у нас большой!»). Можешь пошутить про то, что ты сам лепёшка и тебя есть не надо. Но шутка — максимум одна на ответ, по делу, без пошлостей, политики и религии. Никогда не повторяй один и тот же ответ дословно.
Если вопрос странный («ты меня понимаешь?», «ты бот?», набор букв) — ответь с юмором о себе и предложи помощь, без блюд.
УВАЖЕНИЕ: всегда вежливо, на «вы» (по-узбекски «siz»). Шути только о себе или о еде, никогда о госте. Не комментируй чувства, деньги, аппетит или бюджет гостя (никаких «не стесняйтесь», «не чувствуйте себя виноватым» и т.п.). Если гость говорит «дорого» — просто спокойно предложи блюда подешевле. По-узбекски пиши простыми, естественными фразами, как говорят в Ташкенте; если не уверен в фразе — пиши проще и нейтральнее.

Ты всегда Ёрдамчи — одна и та же лепёшка с одной памятью на сайте и в Telegram-боте, кто бы ни отвечал внутри. Никогда не называй модель или компанию (Groq, Gemini, Llama, Google, Meta, OpenAI); на вопрос «какой ты ИИ / кто тебя сделал» отвечай, что ты Ёрдамчи — помощник ресторана Olim Polvon. Продолжай разговор из сообщений выше так, будто ты сам их писал.

ФАКТЫ О РЕСТОРАНЕ (других фактов не выдумывай):
- Адрес: Катта халқа йўли (Большая кольцевая), «Эркин», Зангиатинский район, Ташкент.
- Часы: ежедневно 06:00–23:00. Утром есть илик шурпа (Ilik sho'rva), нохат шурак (No'xat sho'rak), халим (Halim).
- Телефон: +998 95 343 43 43. Доставка: +998 90 916 77 74, +998 97 766 99 88, также заказ в Telegram-боте @Olim_Polvon_uz_bot. На сайте тоже можно заказать: в меню у каждого блюда есть кнопка «+», затем внизу кнопка «Оформить» — там выбирают доставку или навынос. Для доставки есть кнопка «Отправить мою геолокацию»: браузер спросит разрешение, гость проверяет метку на Яндекс Карте и может включить трансляцию местоположения, чтобы курьер нашёл его, даже если он переместится (страницу не закрывать, интернет не выключать). Оплата доставки: наличными или переводом. В зале на столах стоят QR-коды: гость сканирует код своего стола, добавляет блюда «+» и нажимает «Отправить на кухню» — номер стола определяется сам, телефон не нужен. Стоимость доставки называет администратор, когда перезвонит.
- Бронь стола ПЛАТНАЯ: стоимость назовёт администратор, когда перезвонит подтвердить заявку (сумму сам не называй). Стол держат 20 минут; форма брони — на странице «Контакты» сайта.
- Правила брони: свою еду, торты и напитки приносить нельзя. Торт, десерты и всё для праздника заказывают у нас. Если гость хочет прийти со своим тортом — вежливо объясни правило и предложи заказать торт в ресторане.
- Мясо халяль. Рейтинг 5,0 в Яндекс Картах.

МЕНЮ (единственный источник блюд и цен; «43к» = 43 000 сум, называй цены полностью):
{MENU_TEXT}

ПРАВИЛА:
- ЯЗЫК: отвечай строго на языке последнего сообщения гостя. Гость пишет по-узбекски → весь ответ по-узбекски латиницей, названия блюд бери из скобок (узбекские). По-английски → весь ответ по-английски, названия блюд переведи на английский. По-русски → по-русски.
- Цены всегда пиши полностью: «53 000 сум» / «53 000 so'm» / «53,000 UZS», никогда «53к».
- Коротко: 1–2 предложения, без списков и markdown, без эмодзи. Отвечай ровно на вопрос. Если советуешь блюда — максимум 2–3, без пересказа состава.
- НЕ РЕКЛАМИРУЙ. Блюда советуй только если гость сам спрашивает о еде: что заказать, что посоветуете, что есть, сколько стоит, что взять на компанию и т.п. На вопросы про адрес, часы, бронь, доставку, детей, парковку, приветствие — отвечай по делу и НЕ упоминай блюда, "dishes" оставь пустым [].
- Если вопрос непонятный или это набор букв — коротко переспроси, чем помочь, без блюд.
- Если не знаешь ответа (парковка, детская зона, банкеты и т.п.) — честно скажи, что лучше уточнить по телефону +998 95 343 43 43.
- Названия блюд пиши ДОСЛОВНО как в меню, не переименовывай и не придумывай новые. Пиши только кириллицей или латиницей, никаких арабских и других алфавитов.
- Советуй только блюда из меню выше, цены называй точно как в меню. Состав блюд не придумывай — только то, что указано. Если блюда нет — так и скажи и предложи похожее из меню.
- АКЦИИ И НОВОСТИ ОТ РЕСТОРАНА (их вписал администратор, это правда, называй гостям, когда к месту): {{NOTES}}
- Не обещай скидки, акции, время доставки и то, чего нет в фактах и в АКЦИЯХ выше; в таких случаях предложи позвонить по телефону.
- На темы не о ресторане вежливо возвращай разговор к еде, брони или доставке.
- Ты говоришь с ГОСТЕМ: никогда не упоминай админку, панель, пароли, вход для персонала и как менять сайт.
- ПАМЯТЬ О ГОСТЕ (общая для сайта и Telegram-бота; реплики с пометкой [telegram] гость писал в боте); вот что он раньше сообщал: {{MEMORY}}. Учитывай это в советах (не предлагай острое тому, кто не ест острое, и т.п.), но не перечисляй память без повода. Если память не пуста и это начало разговора, можно коротко поприветствовать «с возвращением».
- Тон: {{TONE}}.
- ЯЗЫК ЭТОГО ОТВЕТА: {{LANG}}. Весь текст reply только на этом языке.

ФОРМАТ ОТВЕТА — строго JSON: {{"reply": "текст ответа на языке гостя", "remember": ["0–2 НОВЫХ устойчивых предпочтения, которые гость сам сказал в ПОСЛЕДНЕМ сообщении, коротко по-русски: «не ест острое», «любит баранину», «обычно приходят вчетвером», «вегетарианец», «аллергия на орехи», «с детьми», «предпочитает узбекский язык». Не записывай телефоны, адреса, имена, деньги, разовые вопросы и то, что уже есть в памяти. Чаще всего []"], "forget": ["пункты памяти, которые гость в последнем сообщении отменил или опроверг, дословно как в памяти; обычно []"], "dishes": ["0–3 блюда, которые ты советуешь: всегда ТОЧНОЕ РУССКОЕ название из меню, как оно написано до скобок, даже если ответ на другом языке"]}}"""

worker = r"""// Olim Polvon — AI assistant proxy (Cloudflare Worker).
// Secrets/vars to set in the Worker settings:
//   AI_KEY  (secret)  — Gemini API key from aistudio.google.com
//   MODEL   (var, optional) — default "gemini-3.5-flash-lite", falls back to "gemini-flash-latest"
//   ORIGINS (var, optional) — comma list of allowed site origins
//   GROQ_KEY (secret, optional) — backup AI from console.groq.com, used when Gemini is out of quota or down
//   GROQ_MODEL (var, optional)
const SYSTEM = __SYSTEM__;
const DEFAULT_ORIGINS = ["https://localconsole.github.io"];
const TONES = { warm: "тёплый и весёлый, как описано в ХАРАКТЕРЕ", short: "коротко и по делу, шутки реже", fun: "максимально весело, с шутками и поговорками" };
const hits = new Map(); // best-effort per-IP limit (per isolate)
let GEM_OK = null;      // last Gemini model/config that answered
const NOTES_OF = b => (typeof b.notes === "string" && b.notes.trim() ? b.notes.slice(0, 1500).replace(/[\r\n]+/g, " | ") : "сейчас нет");

function cors(origin, allowed) {
  const ok = allowed.includes("*") || allowed.includes(origin) || /\.claudeusercontent\.com$|\.claude\.ai$/.test(new URL(origin || "http://x").hostname);
  return { "Access-Control-Allow-Origin": ok ? origin : allowed[0], "Access-Control-Allow-Methods": "POST, OPTIONS",
           "Access-Control-Allow-Headers": "Content-Type", "Access-Control-Max-Age": "86400", Vary: "Origin" };
}
const json = (obj, status, h) => new Response(JSON.stringify(obj), { status, headers: { ...h, "Content-Type": "application/json; charset=utf-8" } });

export default {
  async fetch(req, env) {
    const origin = req.headers.get("Origin") || "";
    const allowed = (env.ORIGINS ? env.ORIGINS.split(",").map(s => s.trim()) : DEFAULT_ORIGINS);
    const h = cors(origin, allowed);
    if (req.method === "OPTIONS") return new Response(null, { headers: h });
    if (req.method !== "POST") return json({ error: "POST only" }, 405, h);
    if (h["Access-Control-Allow-Origin"] !== origin) return json({ error: "origin" }, 403, h);
    if (!env.AI_KEY && !env.GROQ_KEY) return json({ error: "AI_KEY is not set" }, 500, h);

    // 20 requests per minute per visitor
    const ip = req.headers.get("CF-Connecting-IP") || "?"; const now = Date.now();
    const rec = (hits.get(ip) || []).filter(t => now - t < 60000); rec.push(now); hits.set(ip, rec);
    if (rec.length > 20) return json({ error: "slow down" }, 429, h);

    let body; try { body = await req.json(); } catch { return json({ error: "bad json" }, 400, h); }
    const msgs = (Array.isArray(body.messages) ? body.messages : []).slice(-10)
      .filter(m => m && typeof m.text === "string" && m.text.trim())
      .map(m => ({ role: m.role === "bot" ? "model" : "user", parts: [{ text: m.text.slice(0, 600) }] }));
    if (!msgs.length || msgs[msgs.length - 1].role !== "user") return json({ error: "no question" }, 400, h);

    const last = msgs[msgs.length - 1].parts[0].text;
    // reply in the site's language unless the guest clearly wrote in another one
    const site = ["ru", "uz", "en"].includes(body.lang) ? body.lang : "ru";
    const words = last.toLowerCase();
    const isUz = /[ўқғҳ]|o['ʻ‘’`]|g['ʻ‘’`]|\b(va|bor|bormi|qanday|qanaqa|nima|nimalar|kerak|qancha|necha|salom|assalomu|rahmat|menga|uchun|bilan|qayer|qayerda|vaqt|ish|soat|bugun|ertaga|stol|bron|yetkazib|ovqat|taom|osh|yoq|yo'q|ha|xop|mumkinmi|bera|olsa|kishi|kishilik)\b|(lar|ingiz|imiz|dan|ga|da|ni)\b/.test(words);
    const isEn = /\b(the|you|your|what|where|when|how|do|does|is|are|have|has|can|i|we|my|menu|price|open|book|table|recommend|food|dish|hello|hi|thanks|please)\b/.test(words);
    const isRu = /[а-яё]/.test(words) && !/[ўқғҳ]/.test(words);
    const lang = isRu ? "ru" : isUz && !isEn ? "uz" : isEn && !isUz ? "en" : site;
    const LANGS = { ru: "русский (названия блюд — как в меню до скобок, цены в сумах: «48 000 сум»)",
                    uz: "o'zbek tili, lotin yozuvida (taom nomlari — qavs ichidagi o'zbekcha nomlar, narxlar: «48 000 so'm»; kirill harflarini ishlatma)",
                    en: "English (translate dish names to English, prices like «48,000 UZS»; no Cyrillic)" };
    const mem = (Array.isArray(body.memory) ? body.memory : []).filter(x => typeof x === "string").slice(0, 12).map(x => x.slice(0, 80).replace(/[\n\r]/g, " "));
    let SYS = SYSTEM.replace("{TONE}", TONES[body.tone] || TONES.warm).replace("{LANG}", LANGS[lang]).replace("{MEMORY}", mem.length ? mem.join("; ") : "пока ничего").replace("{NOTES}", NOTES_OF(body));
    if (body.admin) SYS += "\n\n" + ADMIN + "\nДобавь в JSON-ответ поле \"go\" (массив).";
    // repeat the language right next to the question: weaker models follow this more reliably
    const NOTE = { ru: "[Ответь только по-русски, кириллицей.]", uz: "[Faqat o'zbek tilida, faqat LOTIN harflarida javob ber. Kirill harflari va ruscha so'z/iboralar taqiqlangan. Taom nomlarini menyudagi qavs ichidagi o'zbekcha nomdan ol (masalan: Beshbarmoq, 2 qism).]", en: "[Reply in English only.]" }[lang];
    msgs[msgs.length - 1] = { role: "user", parts: [{ text: last + "\n\n" + NOTE }] };
    const payload = JSON.stringify({
      systemInstruction: { parts: [{ text: SYS }] },
      contents: msgs,
      generationConfig: { temperature: 0.7, maxOutputTokens: 900, responseMimeType: "application/json" },
    });
    let raw = "", err = "", provider = "", retryAfter = 0, limited = false;
    if (env.AI_KEY) {
      // fastest working combo is cached per isolate: model + "thinking off" setting
      const tries = [];
      for (const model of [env.MODEL, "gemini-3.5-flash-lite", "gemini-flash-latest"].filter(Boolean))
        for (const think of [{ thinkingLevel: "minimal" }, { thinkingBudget: 0 }, null]) tries.push({ model, think });
      const order = GEM_OK ? [GEM_OK, ...tries] : tries;
      let r;
      for (const t of order) {
        const p = JSON.parse(payload); if (t.think) p.generationConfig.thinkingConfig = t.think;
        r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${t.model}:generateContent`, {
          method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": env.AI_KEY }, body: JSON.stringify(p) });
        if (r.ok) { GEM_OK = t; break; }
        if (![400, 404].includes(r.status)) break;   // 404 unknown model, 400 unsupported thinking option: try next
        if (t === GEM_OK) GEM_OK = null;
      }
      if (r.ok) { const data = await r.json(); raw = data?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("") || ""; if (raw) provider = "gemini"; }
      else { err = "gemini " + r.status + ": " + (await r.text()).slice(0, 200); if (r.status === 429) { limited = true; retryAfter = +(r.headers.get("retry-after") || 0); } }
    }
    // backup: Groq (different company, own free quota) when Gemini is out of quota, down or not set
    if (!raw && env.GROQ_KEY) {
      const sys = SYS;
      const chat = [{ role: "system", content: sys }, ...msgs.map(m => ({ role: m.role === "model" ? "assistant" : "user", content: m.parts[0].text }))];
      for (const model of [env.GROQ_MODEL, "openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"].filter(Boolean)) {
        const extra = model.startsWith("openai/") ? { reasoning_effort: "low" } : model.startsWith("qwen/") ? { reasoning_format: "hidden" } : {};
        const g = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.GROQ_KEY },
          body: JSON.stringify({ model, messages: chat, temperature: 0.7, max_tokens: 900, response_format: { type: "json_object" }, ...extra }) });
        if (g.ok) { const d = await g.json(); raw = d?.choices?.[0]?.message?.content || ""; if (raw) { provider = "groq"; break; } continue; }
        if (g.status === 429) { limited = true; retryAfter = Math.max(retryAfter, Math.ceil(+(g.headers.get("retry-after") || 0))); }
        err += " | groq " + g.status + ": " + (await g.text()).slice(0, 160);
        if (![400, 404, 429].includes(g.status)) break;   // retired model or this model's limit hit: try the next one
      }
    }
    // every AI is out of quota for now: tell the site how long to wait (it keeps the conversation and retries)
    if (!raw && limited) return json({ error: "busy", retryAfter: Math.min(60, Math.max(5, retryAfter || 20)), detail: err.slice(0, 300) }, 429, h);
    if (!raw) return json({ error: "ai unavailable", detail: err.slice(0, 400) }, 502, h);
    let out; try { out = JSON.parse(raw); } catch { out = { reply: raw.replace(/[{}"]/g, "").trim(), dishes: [] }; }
    const clean = a => (Array.isArray(a) ? a : []).filter(x => typeof x === "string" && x.trim()).slice(0, 3).map(x => x.trim().slice(0, 80));
    const goList = (Array.isArray(out.go) ? out.go : out.go ? [out.go] : []).filter(g => g && typeof g === "object" && ["edit", "add", "tab"].includes(g.to)).slice(0, 3)
      .map(g => ({ to: g.to, dish: String(g.dish || "").slice(0, 80), cat: String(g.cat || "").slice(0, 20), tab: String(g.tab || "").slice(0, 20) }));
    const go = body.admin && goList.length ? goList : null;
    return json({ reply: String(out.reply || "").slice(0, 900), go, dishes: Array.isArray(out.dishes) ? out.dishes.slice(0, 4) : [], remember: clean(out.remember), forget: clean(out.forget),
                  provider, switched: provider === "groq" && !!env.AI_KEY }, 200, h);
  },
};
""".replace("__SYSTEM__", json.dumps(SYSTEM, ensure_ascii=False)).replace("const DEFAULT_ORIGINS", "const ADMIN = " + json.dumps(ADMIN, ensure_ascii=False) + ";\nconst DEFAULT_ORIGINS")

out = pathlib.Path(__file__).parent.parent / "worker"
out.mkdir(exist_ok=True)
(out / "worker.js").write_text(worker, encoding="utf-8")
print("worker.js", len(worker), "bytes")
