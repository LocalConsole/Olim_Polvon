// One assistant, aware of who is asking. Groq first (fast), Gemini flash-lite as backup.
import { AI_MENU, AI_NOPRICE } from "./menu.gen.js";
import { layoutFix, looksLatinLang, now, log, kvGet, localDay } from "./lib.js";

const FACTS = `Ресторан «Olim Polvon Milliy Taomlari», Ташкент, узбекская и уйгурская кухня, мясо халяль, рейтинг 5,0 в Яндекс Картах.
Адрес: Катта халқа йўли (Большая кольцевая), «Эркин», Зангиатинский р-н. Часы: ежедневно 06:00–23:00 (утром илик шурпа, нохат шурак, халим).
Тел.: +998 95 343 43 43; доставка: +998 90 916 77 74, +998 97 766 99 88. Стоимость доставки называет администратор.
Оплата: наличными или переводом на карту (потом прислать скриншот чека в этот чат).
Бронь стола платная: сумму называет администратор, стол держат 20 минут. Свою еду, торты и напитки приносить нельзя — торт и всё для праздника заказывают у ресторана.`;

const GUEST = `Ты — Ёрдамчи, весёлая лепёшка-талисман и помощник ресторана в Telegram-боте. Тепло, на «вы», максимум одна лёгкая шутка, без эмодзи-спама.
ФАКТЫ (других не выдумывай; не знаешь — дай телефон):
${FACTS}
МЕНЮ «название ru/uz|цена (43к = 43 000)|состав». Другие блюда не придумывай:
${AI_MENU}
Без цены (есть, но сам не предлагай и не добавляй): ${AI_NOPRICE}
ПРАВИЛА: 1–2 коротких предложения. Отвечай на языке последнего сообщения (узбекский — латиницей, блюда — узбекские названия; английский — переведи названия). Цены полностью: «53 000 сум» / «53 000 so'm» / «53,000 UZS». Блюда советуй только если спрашивают о еде, максимум 3. Сообщение может быть набрано не в той раскладке — тогда смотри подсказку в скобках. Не обещай скидок и сроков доставки.
АКЦИИ (вписал администратор, это правда): {NOTES}
JSON: {"reply":"…","dishes":["точные РУССКИЕ названия советуемых блюд"],"add":[{"dish":"русское название","q":1}],"do":null}
"add" — только если гость прямо просит добавить/заказать конкретные блюда. "do": "menu" показать меню | "cart" корзина/оформить заказ | "book" забронировать стол | "info" адрес/контакты | "my" статус моего заказа | null.`;

const STAFF = `Ты — помощник сотрудников ресторана Olim Polvon в Telegram-боте. Роль собеседника: {ROLE}. Отвечай по-деловому, коротко (1–3 предложения), на языке сообщения (узбекский — латиницей). Ничего не выдумывай: используй только ДАННЫЕ ниже. Сам ничего не меняешь — действия делаются кнопками в карточках заказов и броней.
Как работать: новые заказы и брони приходят карточками с кнопками (Принять → Готовится → Передан курьеру → Выполнен; бронь: Подтвердить / Перезвоню / Отклонить / Назначить стоимость). Отменить заказ — кнопка ✖️ в карточке (с подтверждением). Чек об оплате приходит фото с кнопками «Оплата подтверждена» / «Нет оплаты». Команды: /panel, /orders, /bookings, /stats, /undelivered{DEVCMD}.
Сейчас {NOW}. ДАННЫЕ:
{DATA}
JSON: {"reply":"…","show":[]} — в "show" до 3 кнопок, которые помогут: "orders" открытые заказы, "bookings_today", "bookings_tomorrow", "stats" статистика дня, "undelivered", "receipts" чеки на проверке, "order:N", "booking:N"{DEVSHOW}.`;

const ROLE_RU = { orders: "приём заказов", bookings: "приём броней", checker: "проверяющий (менеджер/владелец)", dev: "разработчик" };

async function staffData(env, role) {
  const parts = [];
  if (role !== "bookings") {
    const o = await env.DB.prepare("SELECT num,type,status,total,name,pay,pay_status,created FROM orders WHERE status NOT IN ('done','cancelled') ORDER BY num DESC LIMIT 25").all();
    parts.push("Открытые заказы: " + ((o.results || []).map(x => `№${x.num} ${x.type} ${x.status} ${x.total} ${x.pay === "card" ? "карта:" + (x.pay_status || "-") : ""}`).join("; ") || "нет"));
  }
  if (role !== "orders") {
    const d0 = localDay(env), d1 = localDay(env, now(), 1);
    const b = await env.DB.prepare("SELECT num,day,time,guests,status,name,fee FROM bookings WHERE day IN (?,?) AND status NOT IN ('declined','cancelled') ORDER BY day,time").bind(d0, d1).all();
    parts.push(`Брони на ${d0} и ${d1}: ` + ((b.results || []).map(x => `№${x.num} ${x.day} ${x.time} ${x.guests}чел ${x.status}${x.fee ? " " + x.fee : ""}`).join("; ") || "нет"));
  }
  const st = await (await import("./core.js")).stats(env);
  parts.push("Сегодня заказы: " + (st.orders.map(r => `${r.status} ${r.n}`).join(", ") || "0") + "; брони: " + (st.bookings.map(r => `${r.status} ${r.n}`).join(", ") || "0") + `; чеков на проверке: ${st.receipts_wait}; недоставлено: ${(st.outbox.find(r => r.status === "failed") || {}).n || 0}`);
  if (role === "dev") {
    const l = await env.DB.prepare("SELECT at,level,src,msg FROM logs WHERE level IN ('warn','error') ORDER BY id DESC LIMIT 12").all();
    parts.push("Последние ошибки: " + ((l.results || []).map(x => `[${new Date(x.at).toISOString().slice(5, 16)} ${x.src}] ${x.msg.slice(0, 120)}`).join(" | ") || "нет"));
  }
  return parts.join("\n");
}

function hint(text) {
  if (text.length > 120) return "";
  const fixed = layoutFix(text);
  if (!fixed) return "";
  if (/[a-z]/i.test(text) && looksLatinLang(text)) return ""; // real Uzbek/English
  if (/[а-яё]/i.test(text)) { // proper Russian has many vowels; "руддщ" (hello) does not
    const ru = text.toLowerCase().match(/[а-яё]/g) || [], v = ru.filter(c => "аеёиоуыэюя".includes(c)).length;
    if (v / ru.length > 0.25 || !looksLatinLang(fixed)) return "";
  }
  return `\n(возможно, набрано не в той раскладке: «${fixed}»)`;
}

async function groq(env, sys, msgs) {
  const chat = [{ role: "system", content: sys }, ...msgs];
  let err = "";
  for (const model of [env.GROQ_MODEL, "openai/gpt-oss-120b", "llama-3.3-70b-versatile", "openai/gpt-oss-20b"].filter(Boolean)) {
    const extra = model.startsWith("openai/") ? { reasoning_effort: "low" } : {};
    try {
      const r = await fetch((env.GROQ_API || "https://api.groq.com") + "/openai/v1/chat/completions", {
        method: "POST", headers: { "Content-Type": "application/json", Authorization: "Bearer " + env.GROQ_KEY },
        body: JSON.stringify({ model, messages: chat, temperature: 0.6, max_tokens: 500, response_format: { type: "json_object" }, ...extra }),
        signal: AbortSignal.timeout(7000) });
      if (r.ok) { const d = await r.json(); const raw = d?.choices?.[0]?.message?.content; if (raw) return { raw, provider: "groq:" + model }; }
      err += ` ${model} ${r.status}`;
      if (![400, 404, 429, 503].includes(r.status)) break;
    } catch (e) { err += ` ${model} ${e.name}`; }
  }
  throw new Error("groq:" + err);
}
async function gemini(env, sys, msgs) {
  const model = env.MODEL || "gemini-3.5-flash-lite";
  const r = await fetch(`${env.GEMINI_API || "https://generativelanguage.googleapis.com"}/v1beta/models/${model}:generateContent`, {
    method: "POST", headers: { "Content-Type": "application/json", "x-goog-api-key": env.AI_KEY },
    body: JSON.stringify({ systemInstruction: { parts: [{ text: sys }] }, contents: msgs.map(m => ({ role: m.role === "assistant" ? "model" : "user", parts: [{ text: m.content }] })),
      generationConfig: { temperature: 0.6, maxOutputTokens: 500, responseMimeType: "application/json", thinkingConfig: { thinkingBudget: 0 } } }),
    signal: AbortSignal.timeout(9000) });
  if (!r.ok) throw new Error("gemini " + r.status + " " + (await r.text()).slice(0, 120));
  const d = await r.json(); const raw = d?.candidates?.[0]?.content?.parts?.map(p => p.text || "").join("");
  if (!raw) throw new Error("gemini empty");
  return { raw, provider: "gemini:" + model };
}

// role: '' (guest) | orders | bookings | checker | dev. hist: [{role:'user'|'assistant', content}]
export async function ask(env, role, text, hist = []) {
  const t0 = now();
  let sys;
  if (!role) sys = GUEST.replace("{NOTES}", (await kvGet(env, "notes", "")).slice(0, 800).replace(/\s+/g, " ") || "сейчас нет");
  else sys = STAFF.replace("{ROLE}", ROLE_RU[role] || role).replace("{NOW}", new Date(now() + 5 * 3600e3).toISOString().slice(0, 16).replace("T", " "))
    .replace("{DATA}", await staffData(env, role)).replace("{DEVCMD}", role === "dev" ? ", /health, /logs, /test" : "").replace("{DEVSHOW}", role === "dev" ? ', "health", "logs"' : "");
  const msgs = [...hist.slice(-6), { role: "user", content: text.slice(0, 600) + hint(text) }];
  let res, errs = [];
  for (const f of [env.GROQ_KEY && groq, env.AI_KEY && gemini].filter(Boolean)) {
    try { res = await f(env, sys, msgs); break; } catch (e) { errs.push(String(e.message || e)); }
  }
  const ms = now() - t0;
  if (!res) { await log(env, "error", "ai", errs.join(" | ") || "no AI keys"); return { error: true, ms }; }
  let out; try { out = JSON.parse(res.raw); } catch { out = { reply: res.raw.replace(/[{}"]/g, "").trim() }; }
  if (ms > 4000) await log(env, "warn", "ai", `slow ${ms}ms ${res.provider}`);
  return { ...out, reply: String(out.reply || "").slice(0, 1200), provider: res.provider, ms };
}
