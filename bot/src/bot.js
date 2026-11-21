// Telegram update handler: guests (menu, cart, checkout, booking, receipts, AI) and staff panels.
import { CATS, ITEMS } from "./menu.gen.js";
import { tg, send, edit, answer, ik, btn, url, reply, noKb } from "./tg.js";
import { t, ROLE_NAMES } from "./texts.js";
import { now, esc, money, J, log, kvGet, kvSet, devIds, localDay, layoutFix, setting, uid } from "./lib.js";
import { enqueue, flush, runDue } from "./outbox.js";
import * as core from "./core.js";
import { ask } from "./ai.js";
import { pushMany } from "./push.js";

const LANGS = ["ru", "uz", "en"];
const li = l => ({ ru: 0, uz: 1, en: 2 }[l] ?? 0);
const name = (d, l) => d.n[li(l)] || d.n[0];
const can = (u, area) => ({ orders: ["orders", "checker", "dev"], bookings: ["bookings", "checker", "dev"], manage: ["checker", "dev"], dev: ["dev"], staff: ["orders", "bookings", "checker", "dev"] }[area] || []).includes(u.role);

// ---------- users
async function upsertUser(env, from) {
  const nm = [from.first_name, from.last_name].filter(Boolean).join(" ").slice(0, 60);
  const lang = /^uz/.test(from.language_code || "") ? "uz" : /^(ru|kk|ky|tg|be|uk)/.test(from.language_code || "") ? "ru" : from.language_code ? "en" : "ru";
  let u = await env.DB.prepare(`INSERT INTO users(id,name,username,lang,created,seen) VALUES(?,?,?,?,?,?)
    ON CONFLICT(id) DO UPDATE SET name=excluded.name, username=excluded.username, seen=excluded.seen RETURNING *`).bind(from.id, nm, from.username || null, lang, now(), now()).first();
  if (devIds(env).includes(from.id) && u.role !== "dev") { await env.DB.prepare("UPDATE users SET role='dev' WHERE id=?").bind(from.id).run(); u.role = "dev"; }
  u.isNew = u.created === u.seen;
  u.st = J(u.state, {}); u.cartObj = J(u.cart, {});
  return u;
}
const saveState = (env, u, st) => { u.st = st; return env.DB.prepare("UPDATE users SET state=? WHERE id=?").bind(JSON.stringify(st || {}), u.id).run(); };
const saveCart = (env, u, c) => { u.cartObj = c; return env.DB.prepare("UPDATE users SET cart=? WHERE id=?").bind(JSON.stringify(c), u.id).run(); };
const cartCount = c => Object.values(c).reduce((a, b) => a + b, 0);
const cartLines = c => Object.entries(c).map(([i, q]) => ({ d: ITEMS[+i], i: +i, q })).filter(x => x.d && x.d.p != null && x.q > 0);
const cartTotal = c => cartLines(c).reduce((s, l) => s + l.d.p * l.q, 0);

function mainKb(u) {
  const l = u.lang, rows = [[t(l, "m_menu"), t(l, "m_cart")], [t(l, "m_book"), t(l, "m_my")], [t(l, "m_info"), t(l, "m_lang")]];
  if (can(u, "staff")) rows.push([t(l, "m_staff")]);
  return reply(rows, { is_persistent: true });
}
const MAIN_KEYS = ["m_menu", "m_cart", "m_book", "m_my", "m_info", "m_lang", "m_staff"];
function mainKey(text) { for (const k of MAIN_KEYS) for (const l of LANGS) if (text === t(l, k)) return k; return null; }

// ---------- menu
async function showCats(env, u, msg) {
  const rows = []; for (let i = 0; i < CATS.length; i += 2) rows.push(CATS.slice(i, i + 2).map((c, j) => btn(c.n[li(u.lang)], "c:" + (i + j))));
  const n = cartCount(u.cartObj); if (n) rows.push([btn(t(u.lang, "cart_n", { n }), "k:show")]);
  return msg ? edit(env, u.id, msg, t(u.lang, "pick_cat"), ik(rows)) : send(env, u.id, t(u.lang, "pick_cat"), ik(rows));
}
async function showCat(env, u, ci, msg) {
  const c = CATS[ci]; if (!c) return showCats(env, u, msg);
  const list = ITEMS.map((d, i) => ({ d, i })).filter(x => x.d.cat === c.id);
  const text = `<b>${esc(c.n[li(u.lang)])}</b>\n` + list.map(({ d }) => `• ${esc(name(d, u.lang))} — ${d.p != null ? money(d.p, u.lang) : t(u.lang, "no_price")}`).join("\n");
  const rows = list.map(({ d, i }) => [btn(`${u.cartObj[i] ? "✓ " : ""}${name(d, u.lang)}${d.p != null ? " · " + Math.round(d.p / 1000) + "k" : ""}`, "d:" + i)]);
  const n = cartCount(u.cartObj);
  rows.push([btn(t(u.lang, "to_cats"), "c:list"), ...(n ? [btn(t(u.lang, "cart_n", { n }), "k:show")] : [])]);
  return msg ? edit(env, u.id, msg, text, ik(rows)) : send(env, u.id, text, ik(rows));
}
function dishCaption(d, u) {
  const l = li(u.lang), q = u.cartObj[ITEMS.indexOf(d)] || 0;
  return `<b>${esc(d.n[l])}</b>${d.u[l] ? " · " + esc(d.u[l]) : ""}\n${d.d[l] ? esc(d.d[l]) + "\n" : ""}<b>${d.p != null ? money(d.p, u.lang) : t(u.lang, "no_price")}</b>${q ? `\n🛒 ×${q}` : ""}${d.p == null ? "\n" + t(u.lang, "no_price_hint") : ""}`;
}
function dishKb(d, i, u) {
  const q = u.cartObj[i] || 0, n = cartCount(u.cartObj), ci = CATS.findIndex(c => c.id === d.cat);
  const rows = [];
  if (d.p != null) rows.push(q ? [btn("−", `q:${i}:-`), btn(`${q}`, "noop"), btn("+", `q:${i}:+`)] : [btn("➕ " + t(u.lang, "m_cart").replace(/^\S+\s/, ""), `q:${i}:+`)]);
  rows.push([btn(t(u.lang, "back"), `x:${ci}`), ...(n ? [btn(t(u.lang, "cart_n", { n }), "k:show")] : [])]);
  return ik(rows);
}
async function showDish(env, u, i) {
  const d = ITEMS[i]; if (!d) return;
  if (!d.ph) return send(env, u.id, dishCaption(d, u), dishKb(d, i, u));
  const cached = await kvGet(env, "ph:" + d.id);
  const r = await tg(env, "sendPhoto", { chat_id: u.id, photo: cached || (env.PHOTO_BASE + d.id + ".jpg"), caption: dishCaption(d, u), parse_mode: "HTML", reply_markup: dishKb(d, i, u) });
  if (r.ok && !cached) { const p = r.result.photo; if (p?.length) await kvSet(env, "ph:" + d.id, p[p.length - 1].file_id); }
  if (!r.ok) return send(env, u.id, dishCaption(d, u), dishKb(d, i, u));
}

// ---------- cart
function cartView(u) {
  const lines = cartLines(u.cartObj);
  if (!lines.length) return { text: t(u.lang, "cart_empty"), kb: ik([[btn(t(u.lang, "m_menu"), "c:list")]]) };
  const text = t(u.lang, "cart_title") + "\n" + lines.map(l => `• ${esc(name(l.d, u.lang))} ×${l.q} — ${money(l.d.p * l.q, u.lang)}`).join("\n") + `\n\n<b>${t(u.lang, "total")}: ${money(cartTotal(u.cartObj), u.lang)}</b>`;
  const rows = lines.map(l => [btn("−", `k:${l.i}:-`), btn(name(l.d, u.lang).slice(0, 22) + " ×" + l.q, "noop"), btn("+", `k:${l.i}:+`)]);
  rows.push([btn(t(u.lang, "checkout"), "k:co")], [btn(t(u.lang, "m_menu"), "c:list"), btn(t(u.lang, "clear"), "k:clear")]);
  return { text, kb: ik(rows) };
}
const showCart = (env, u, msg) => { const v = cartView(u); return msg ? edit(env, u.id, msg, v.text, v.kb) : send(env, u.id, v.text, v.kb); };

// ---------- checkout dialog
async function tableOf(env, u) { const v = J(await kvGet(env, "table:" + u.id), null); return v && now() - v.at < 4 * 3600e3 ? v.n : ""; }
async function coStart(env, u) {
  if (!cartLines(u.cartObj).length) return send(env, u.id, t(u.lang, "cart_empty"));
  const table = await tableOf(env, u);
  await saveState(env, u, { f: "co", step: "type", table });
  const rows = [[btn(t(u.lang, "t_delivery"), "ct:delivery"), btn(t(u.lang, "t_pickup"), "ct:pickup")]];
  if (table) rows.unshift([btn(t(u.lang, "t_table", { n: table }), "ct:table")]);
  rows.push([btn(t(u.lang, "cancel"), "cx")]);
  return send(env, u.id, t(u.lang, "how"), ik(rows));
}
async function coNext(env, u) {
  const s = u.st, l = u.lang;
  if (s.type === "table") return coConfirm(env, u);
  if (!s.phone) {
    s.step = "phone"; await saveState(env, u, s);
    const rows = [[{ text: t(l, "share_phone"), request_contact: true }]]; if (u.phone) rows.push([t(l, "use_phone", { p: u.phone })]); rows.push([t(l, "cancel")]);
    return send(env, u.id, t(l, "ask_phone"), reply(rows, { one_time_keyboard: true }));
  }
  if (s.type === "delivery" && !s.lat && !s.address) {
    s.step = "loc"; await saveState(env, u, s);
    return send(env, u.id, t(l, "ask_loc"), reply([[{ text: t(l, "send_loc"), request_location: true }], [t(l, "cancel")]], { one_time_keyboard: true }));
  }
  if (s.type === "delivery" && s.lat && s.flat == null) { s.step = "flat"; await saveState(env, u, s); return send(env, u.id, t(l, "ask_flat"), noKb); }
  if (!s.when) { s.step = "when"; await saveState(env, u, s); return send(env, u.id, t(l, "ask_when"), ik([[btn(t(l, "asap"), "cw:asap"), btn(t(l, "at_time"), "cw:time")]])); }
  if (s.type === "delivery" && !s.pay) { s.step = "pay"; await saveState(env, u, s); return send(env, u.id, t(l, "ask_pay"), ik([[btn(t(l, "cash"), "cp:cash"), btn(t(l, "card"), "cp:card")]])); }
  if (s.note == null) { s.step = "note"; await saveState(env, u, s); return send(env, u.id, t(l, "ask_note"), ik([[btn(t(l, "no_note"), "cn")]])); }
  return coConfirm(env, u);
}
async function coConfirm(env, u) {
  const s = u.st, l = u.lang; s.step = "confirm"; await saveState(env, u, s);
  const lines = cartLines(u.cartObj);
  const head = s.type === "table" ? t(l, "t_table", { n: s.table }) : s.type === "delivery" ? t(l, "t_delivery") : t(l, "t_pickup");
  const txt = [t(l, "confirm_q"), "", `<b>${head}</b>`, ...lines.map(x => `• ${esc(name(x.d, l))} ×${x.q} — ${money(x.d.p * x.q, l)}`), `<b>${t(l, "total")}: ${money(cartTotal(u.cartObj), l)}</b>`,
    s.phone ? "📱 " + esc(s.phone) : "", s.lat ? "📍 ✓" : "", s.address || s.flat ? "🏠 " + esc([s.address, s.flat].filter(x => x && x !== "-").join(", ")) : "",
    s.when ? "🕐 " + esc(s.when === "asap" ? t(l, "asap") : s.when) : "", s.pay ? (s.pay === "card" ? t(l, "card") : t(l, "cash")) : "", s.note ? "💬 " + esc(s.note) : ""].filter(Boolean).join("\n");
  return send(env, u.id, txt, ik([[btn(t(l, "confirm"), "cc"), btn(t(l, "cancel"), "cx")]]));
}
async function coSubmit(env, u, ctx) {
  const s = u.st, l = u.lang;
  if (s.f !== "co" || !s.type) return;
  const items = cartLines(u.cartObj).map(x => ({ id: x.d.id, q: x.q }));
  s.oid = s.oid || uid("tg"); await saveState(env, u, s);   // same id if the guest taps twice
  const r = await core.createOrder(env, { id: s.oid, source: "bot", tg_user: u.id, type: s.type, table: s.table, name: u.name, phone: s.phone,
    address: [s.address, s.flat].filter(x => x && x !== "-").join(", "), lat: s.lat, lon: s.lon, live: s.live, when: s.when === "asap" ? "как можно скорее" : s.when, pay: s.pay, note: s.note, items, lang: l });
  ctx.waitUntil(flush(env, r.ids));
  await saveCart(env, u, {}); await saveState(env, u, {});
  if (s.phone && s.phone !== u.phone) await env.DB.prepare("UPDATE users SET phone=? WHERE id=?").bind(s.phone, u.id).run();
  await send(env, u.id, s.type === "table" ? t(l, "table_ok", { n: r.row.num, t: s.table }) : t(l, "order_ok", { n: r.row.num }), mainKb(u));
  if (r.row.pay === "card") await send(env, u.id, t(l, "pay_card", { sum: money(r.row.total, l), card: esc(await setting(env, "card")), owner: esc(await setting(env, "card_owner")) }));
}

// ---------- booking dialog
async function bkStart(env, u) {
  await saveState(env, u, { f: "bk", step: "name" });
  await send(env, u.id, "ℹ️ " + t(u.lang, "b_rules"));
  return send(env, u.id, t(u.lang, "b_name"), u.name ? reply([[u.name], [t(u.lang, "cancel")]], { one_time_keyboard: true }) : noKb);
}
async function bkNext(env, u) {
  const s = u.st, l = u.lang;
  if (!s.name) return bkStart(env, u);
  if (!s.phone) {
    s.step = "phone"; await saveState(env, u, s);
    const rows = [[{ text: t(l, "share_phone"), request_contact: true }]]; if (u.phone) rows.push([t(l, "use_phone", { p: u.phone })]); rows.push([t(l, "cancel")]);
    return send(env, u.id, t(l, "ask_phone"), reply(rows, { one_time_keyboard: true }));
  }
  if (!s.day) {
    s.step = "day"; await saveState(env, u, s);
    const days = [...Array(8)].map((_, k) => localDay(env, now(), k));
    const lbl = (d, k) => k === 0 ? t(l, "today") : k === 1 ? t(l, "tomorrow") : d.slice(8, 10) + "." + d.slice(5, 7);
    const rows = [days.slice(0, 4).map((d, k) => btn(lbl(d, k), "bd:" + d)), days.slice(4).map((d, k) => btn(lbl(d, k + 4), "bd:" + d))];
    return send(env, u.id, t(l, "b_day"), ik([...rows, [btn(t(l, "cancel"), "cx")]]));
  }
  if (!s.time) {
    s.step = "time"; await saveState(env, u, s);
    const times = []; for (let h = 10; h <= 22; h++) { times.push(`${String(h).padStart(2, "0")}:00`); if (h < 22) times.push(`${String(h).padStart(2, "0")}:30`); }
    const nowT = new Date(now() + 5 * 3600e3 + 30 * 60e3).toISOString().slice(11, 16);
    const ok = times.filter(x => s.day !== localDay(env) || x > nowT);
    const rows = []; for (let i = 0; i < ok.length; i += 5) rows.push(ok.slice(i, i + 5).map(x => btn(x, "bt:" + x)));
    return send(env, u.id, t(l, "b_time"), ik([...rows, [btn(t(l, "back"), "bd:-")]]));
  }
  if (!s.guests) { s.step = "guests"; await saveState(env, u, s); return send(env, u.id, t(l, "b_guests"), ik([[1, 2, 3, 4, 5].map(n => btn(String(n), "bg:" + n)), [6, 8, 10, 15, 20].map(n => btn(n === 20 ? "20+" : String(n), "bg:" + n))])); }
  if (!s.zone) { s.step = "zone"; await saveState(env, u, s); return send(env, u.id, t(l, "b_zone"), ik([[btn(t(l, "z_any"), "bz:z_any")], [btn(t(l, "z_hall"), "bz:z_hall")], [btn(t(l, "z_family"), "bz:z_family")]])); }
  if (s.note == null) { s.step = "note"; await saveState(env, u, s); return send(env, u.id, t(l, "b_note"), ik([[btn(t(l, "b_nonote"), "bn")]])); }
  s.step = "confirm"; await saveState(env, u, s);
  return send(env, u.id, `${t(l, "confirm_q")}\n\n👤 ${esc(s.name)} ${esc(s.phone)}\n📅 ${s.day} · ${s.time}\n👥 ${s.guests}\n🪑 ${t(l, s.zone)}${s.note ? "\n💬 " + esc(s.note) : ""}`, ik([[btn(t(l, "confirm"), "bc"), btn(t(l, "cancel"), "cx")]]));
}
async function bkSubmit(env, u, ctx) {
  const s = u.st; if (s.f !== "bk" || !s.day) return;
  s.bid = s.bid || uid("tg"); await saveState(env, u, s);
  const r = await core.createBooking(env, { id: s.bid, source: "bot", tg_user: u.id, name: s.name, phone: s.phone, day: s.day, time: s.time, guests: s.guests, zone: t("ru", s.zone), note: s.note, lang: u.lang });
  ctx.waitUntil(flush(env, r.ids));
  await saveState(env, u, {});
  if (s.phone !== u.phone) await env.DB.prepare("UPDATE users SET phone=? WHERE id=?").bind(s.phone, u.id).run();
  return send(env, u.id, t(u.lang, "b_ok", { n: r.row.num }), mainKb(u));
}

// ---------- guest: my orders
async function showMy(env, u) {
  const o = await env.DB.prepare("SELECT * FROM orders WHERE tg_user=? ORDER BY num DESC LIMIT 5").bind(u.id).all();
  const b = await env.DB.prepare("SELECT * FROM bookings WHERE tg_user=? ORDER BY num DESC LIMIT 3").bind(u.id).all();
  const l = u.lang, lines = [];
  for (const x of o.results || []) lines.push(`📦 №${x.num} · ${money(x.total, l)} · ${t(l, "st_" + x.status)}${x.pay === "card" ? " · 💳 " + ({ wait: "⏳", sent: "🔎", ok: "✅", no: "❌" }[x.pay_status] || "") : ""}`);
  for (const x of b.results || []) lines.push(`📅 №${x.num} · ${x.day} ${x.time} · ${t(l, "bs_" + x.status)}${x.fee ? " · " + money(x.fee, l) : ""}`);
  return send(env, u.id, lines.length ? lines.join("\n") : t(l, "my_none"));
}

// ---------- receipts from the guest
async function pendingPays(env, u) {
  const o = await env.DB.prepare("SELECT num FROM orders WHERE tg_user=? AND pay='card' AND pay_status IN ('wait','no','sent') AND status<>'cancelled' AND created>? ORDER BY num DESC LIMIT 5").bind(u.id, now() - 3 * 864e5).all();
  const b = await env.DB.prepare("SELECT num FROM bookings WHERE tg_user=? AND fee>0 AND pay_status IN ('wait','no','sent') AND status NOT IN ('declined','cancelled') ORDER BY num DESC LIMIT 3").bind(u.id).all();
  return [...(o.results || []).map(x => ({ kind: "order", num: x.num })), ...(b.results || []).map(x => ({ kind: "booking", num: x.num }))];
}
async function takeReceipt(env, u, fileId, ctx, kind, num) {
  const r = await core.addReceipt(env, { id: "tg" + fileId.slice(-40).replace(/[^\w-]/g, "") + kind[0] + num, kind, ref: num, file_id: fileId });
  ctx.waitUntil(flush(env, r.ids));
  return send(env, u.id, t(u.lang, "receipt_got"));
}

// ---------- staff panel
function panelKb(u) {
  const rows = [];
  if (can(u, "orders")) rows.push([btn("📦 Открытые заказы", "p:orders"), btn("🧾 Чеки", "p:receipts")]);
  if (can(u, "bookings")) rows.push([btn("📅 Брони сегодня", "p:bt"), btn("📅 Завтра", "p:bm")]);
  rows.push([btn("📊 Статистика дня", "p:stats"), btn("⚠️ Недоставленное", "p:und")]);
  if (can(u, "manage")) rows.push([btn("👥 Роли", "p:roles"), btn(u.notify ? "🔔 Уведомления: вкл" : "🔕 Уведомления: выкл", "p:notify")]);
  if (can(u, "dev")) rows.push([btn("🩺 Здоровье", "p:health"), btn("📜 Логи", "p:logs"), btn("🧪 Тест-режим", "p:test")]);
  return ik(rows);
}
const showPanel = (env, u) => send(env, u.id, `🧑‍🍳 Панель · роль: <b>${ROLE_NAMES[u.role]}</b>\nСпросите меня обычными словами: «что сейчас ждёт», «брони на вечер», «сколько заказов сегодня».`, panelKb(u));

async function sendCard(env, u, kind, num, ctx) {
  const row = kind === "order" ? await core.getOrder(env, num) : await core.getBooking(env, num);
  if (!row) return send(env, u.id, "Не найдено.");
  const id = await enqueue(env, u.id, "sendMessage", { text: kind === "order" ? core.orderText(row) : core.bookingText(row), parse_mode: "HTML", disable_web_page_preview: true, reply_markup: kind === "order" ? core.orderKb(row) : core.bookingKb(row) }, kind + ":" + num);
  await flush(env, [id]);
}
async function listOrders(env, u) {
  const r = await env.DB.prepare("SELECT * FROM orders WHERE status NOT IN ('done','cancelled') ORDER BY num DESC LIMIT 30").all();
  const L = r.results || []; if (!L.length) return send(env, u.id, "Открытых заказов нет ✨");
  const text = "<b>Открытые заказы</b>\n" + L.map(o => `№${o.num} · ${core.TYPE_RU[o.type]}${o.table_no ? " " + o.table_no : ""} · ${core.ST_RU[o.status]} · ${money(o.total)}${o.pay === "card" ? " · 💳 " + (core.PAY_RU[o.pay_status] || "") : ""}${o.test ? " · тест" : ""}`).join("\n");
  const rows = []; for (let i = 0; i < Math.min(L.length, 20); i += 4) rows.push(L.slice(i, i + 4).map(o => btn("№" + o.num, "p:o:" + o.num)));
  return send(env, u.id, text, ik(rows));
}
async function listBookings(env, u, day) {
  const r = await env.DB.prepare("SELECT * FROM bookings WHERE day=? AND status NOT IN ('declined','cancelled') ORDER BY time").bind(day).all();
  const L = r.results || []; if (!L.length) return send(env, u.id, `Броней на ${day} нет.`);
  const text = `<b>Брони на ${day}</b>\n` + L.map(b => `${b.time} · №${b.num} · ${esc(b.name)} · ${b.guests} чел · ${core.BST_RU[b.status]}${b.fee ? " · " + money(b.fee) : ""}`).join("\n");
  const rows = []; for (let i = 0; i < Math.min(L.length, 20); i += 4) rows.push(L.slice(i, i + 4).map(b => btn("№" + b.num, "p:b:" + b.num)));
  return send(env, u.id, text, ik(rows));
}
async function showStats(env, u) {
  const s = await core.stats(env);
  const o = s.orders, sum = o.filter(x => x.status !== "cancelled").reduce((a, x) => a + (x.s || 0), 0);
  const text = `<b>📊 Сегодня (${localDay(env)})</b>\nЗаказы: ${o.reduce((a, x) => a + x.n, 0)} — ${o.map(x => `${core.ST_RU[x.status]} ${x.n}`).join(", ") || "нет"}\nСумма (без отменённых): ${money(sum)}\nБрони: ${s.bookings.reduce((a, x) => a + x.n, 0)} — ${s.bookings.map(x => `${core.BST_RU[x.status]} ${x.n}`).join(", ") || "нет"}\nЧеков на проверке: ${s.receipts_wait}\nДоставка сообщений (2 дня): ${s.outbox.map(x => `${x.status} ${x.n}`).join(", ") || "—"}`;
  return send(env, u.id, text);
}
async function listUndelivered(env, u) {
  const r = await env.DB.prepare("SELECT id,chat_id,ref,tries,error,status FROM outbox WHERE status='failed' OR (status='pending' AND tries>0) ORDER BY id DESC LIMIT 20").all();
  const L = r.results || []; if (!L.length) return send(env, u.id, "Всё доставлено ✅");
  return send(env, u.id, "<b>Недоставленное</b>\n" + L.map(x => `#${x.id} → ${x.chat_id} · ${esc(x.ref)} · ${x.status} · попыток ${x.tries}\n   ${esc((x.error || "").slice(0, 80))}`).join("\n"), ik([[btn("🔁 Повторить всё", "p:retry")]]));
}
async function listReceipts(env, u) {
  const r = await env.DB.prepare("SELECT num,kind,ref FROM receipts WHERE status='wait' ORDER BY num DESC LIMIT 20").all();
  const L = r.results || []; if (!L.length) return send(env, u.id, "Чеков на проверке нет.");
  for (const x of L) { const id = await enqueue(env, u.id, "sendPhoto", { photo: "receipt:" + x.num, caption: `🧾 Чек к ${x.kind === "booking" ? "брони" : "заказу"} №${x.ref}`, reply_markup: ik([[btn("✅ Оплата подтверждена", `r:${x.num}:ok`), btn("❌ Нет оплаты", `r:${x.num}:no`)]]) }, "receipt:" + x.num); await flush(env, [id]); }
}
async function showRoles(env, u) {
  const r = await env.DB.prepare("SELECT id,name,username,role FROM users WHERE role<>'' ORDER BY role").all();
  const L = r.results || [];
  const text = "<b>👥 Сотрудники</b>\n" + (L.map(x => `${ROLE_NAMES[x.role]}: ${esc(x.name)}${x.username ? " @" + esc(x.username) : ""} (<code>${x.id}</code>)`).join("\n") || "пока никого") +
    "\n\nЧтобы добавить сотрудника, нажмите роль — я дам одноразовую ссылку, её нужно открыть сотруднику. Или: <code>/grant ID роль</code> (orders, bookings, checker" + (can(u, "dev") ? ", dev" : "") + ").";
  const rows = [[btn("➕ Приём заказов", "inv:orders"), btn("➕ Приём броней", "inv:bookings")], [btn("➕ Проверяющий", "inv:checker"), ...(can(u, "dev") ? [btn("➕ Разработчик", "inv:dev")] : [])]];
  for (const x of L) if (x.id !== u.id && !(x.role === "dev" && !can(u, "dev"))) rows.push([btn(`✖️ Снять: ${x.name}`.slice(0, 40), "rm:" + x.id)]);
  return send(env, u.id, text, ik(rows));
}
async function setRole(env, by, id, role, ctx) {
  if (!["orders", "bookings", "checker", "dev", ""].includes(role)) return "Роль: orders, bookings, checker, dev";
  if ((role === "dev") && !can(by, "dev")) return "Назначать разработчика может только разработчик.";
  const target = await env.DB.prepare("SELECT * FROM users WHERE id=?").bind(id).first();
  if (!target) return "Этот человек ещё не запускал бота. Пусть нажмёт /start или откроет ссылку-приглашение.";
  if (target.role === "dev" && !can(by, "dev")) return "Нельзя менять роль разработчика.";
  if (devIds(env).includes(+id) && role !== "dev") return "Этот id указан в DEV_IDS — его роль меняется только там.";
  await env.DB.prepare("UPDATE users SET role=? WHERE id=?").bind(role, id).run();
  await log(env, "info", "roles", `${by.name} (${by.id}) set ${id} -> ${role || "guest"}`);
  ctx.waitUntil(flush(env, [await enqueue(env, +id, "sendMessage", { text: role ? t(target.lang, "role_set", { r: ROLE_NAMES[role] }) : t(target.lang, "role_off"), parse_mode: "HTML", reply_markup: mainKb({ ...target, role }) }, "role")]));
  return `Готово: ${esc(target.name)} — ${ROLE_NAMES[role]}.`;
}
async function health(env, u) {
  const wh = await tg(env, "getWebhookInfo", {}, { quiet: true });
  const t0 = now(); const ai = await ask(env, "", "ping: ответь одним словом ok"); const ms = now() - t0;
  const ob = await env.DB.prepare("SELECT status, COUNT(*) n FROM outbox GROUP BY status").all();
  const w = wh.result || {};
  return send(env, u.id, `<b>🩺 Состояние</b>\nВебхук: ${esc(w.url || "не задан")}\nОжидают в Telegram: ${w.pending_update_count ?? "?"}${w.last_error_message ? `\nПоследняя ошибка вебхука: ${esc(w.last_error_message)} (${new Date((w.last_error_date || 0) * 1000).toISOString().slice(0, 16)})` : ""}\nAI: ${ai.error ? "❌ не отвечает" : "✅ " + esc(ai.provider)} · ${ms} мс\nOutbox: ${(ob.results || []).map(x => `${x.status} ${x.n}`).join(", ") || "пусто"}\nТест-режим: ${(await kvGet(env, "test_mode", "0")) === "1" ? "ВКЛ — заказы идут только разработчику" : "выкл"}`);
}
async function showLogs(env, u) {
  const r = await env.DB.prepare("SELECT at,level,src,msg FROM logs ORDER BY id DESC LIMIT 25").all();
  return send(env, u.id, "<b>📜 Логи</b>\n" + ((r.results || []).map(x => `${new Date(x.at + 5 * 3600e3).toISOString().slice(5, 16).replace("T", " ")} ${x.level === "error" ? "🔴" : x.level === "warn" ? "🟡" : "⚪"} ${esc(x.src)}: ${esc(x.msg.slice(0, 140))}`).join("\n") || "пусто"));
}

// ---------- AI reply rendering
async function aiReply(env, u, text, ctx) {
  tg(env, "sendChatAction", { chat_id: u.id, action: "typing" }, { quiet: true });
  const hist = J((await env.DB.prepare("SELECT hist FROM users WHERE id=?").bind(u.id).first())?.hist, []);
  const role = can(u, "staff") ? u.role : "";
  const a = await ask(env, role, text, hist);
  if (a.error) return send(env, u.id, t(u.lang, "ai_down"));
  const rows = [];
  if (!role) {
    // dishes the assistant suggests → buttons; "add" → straight to the cart
    const find = n => ITEMS.findIndex(d => d.p != null && [d.n[0], d.n[1], d.n[2]].some(x => x && x.toLowerCase() === String(n || "").toLowerCase().trim()));
    let added = [];
    for (const x of (Array.isArray(a.add) ? a.add : []).slice(0, 5)) { const i = find(x.dish); if (i >= 0) { u.cartObj[i] = (u.cartObj[i] || 0) + Math.max(1, Math.min(20, parseInt(x.q, 10) || 1)); added.push(name(ITEMS[i], u.lang)); } }
    if (added.length) await saveCart(env, u, u.cartObj);
    for (const n of (Array.isArray(a.dishes) ? a.dishes : []).slice(0, 3)) { const i = find(n); if (i >= 0) rows.push([btn("🍽 " + name(ITEMS[i], u.lang), "d:" + i)]); }
    const doMap = { menu: [t(u.lang, "m_menu"), "c:list"], cart: [t(u.lang, "m_cart"), "k:show"], book: [t(u.lang, "m_book"), "go:book"], info: [t(u.lang, "m_info"), "go:info"], my: [t(u.lang, "m_my"), "go:my"] };
    if (doMap[a.do]) rows.push([btn(...doMap[a.do])]);
    if (added.length) { a.reply += "\n\n" + t(u.lang, "added", { d: added.join(", ") }); if (a.do !== "cart") rows.push([btn(t(u.lang, "cart_n", { n: cartCount(u.cartObj) }), "k:show")]); }
  } else {
    const SHOW = { orders: ["📦 Открытые заказы", "p:orders"], bookings_today: ["📅 Брони сегодня", "p:bt"], bookings_tomorrow: ["📅 Брони завтра", "p:bm"], stats: ["📊 Статистика", "p:stats"], undelivered: ["⚠️ Недоставленное", "p:und"], receipts: ["🧾 Чеки", "p:receipts"], health: ["🩺 Здоровье", "p:health"], logs: ["📜 Логи", "p:logs"] };
    for (const s of (Array.isArray(a.show) ? a.show : []).slice(0, 3)) {
      const m = /^(order|booking):(\d+)$/.exec(s);
      if (m) rows.push([btn(`${m[1] === "order" ? "📦 Заказ" : "📅 Бронь"} №${m[2]}`, `p:${m[1][0]}:${m[2]}`)]);
      else if (SHOW[s] && (s !== "health" && s !== "logs" || can(u, "dev"))) rows.push([btn(...SHOW[s])]);
    }
  }
  const newHist = [...hist, { role: "user", content: text.slice(0, 300) }, { role: "assistant", content: a.reply.slice(0, 300) }].slice(-8);
  ctx.waitUntil(env.DB.prepare("UPDATE users SET hist=? WHERE id=?").bind(JSON.stringify(newHist), u.id).run());
  return send(env, u.id, esc(a.reply) + (u.role === "dev" ? `\n<i>${esc(a.provider)} · ${a.ms} мс</i>` : ""), rows.length ? ik(rows) : undefined);
}

// fast path: plain words that mean a button, in any of 3 languages or the wrong keyboard layout
function quickIntent(text) {
  const v = [text.toLowerCase().trim(), layoutFix(text).toLowerCase().trim()];
  const is = re => v.some(x => re.test(x));
  if (is(/^(меню|menu|menyu|меню пожалуйста)$/)) return "menu";
  if (is(/^(корзина|savat|cart|basket)$/)) return "cart";
  if (is(/^(бронь|забронировать|bron|band qilish|book|booking)$/)) return "book";
  if (is(/^(адрес|manzil|address|контакты|kontakt)$/)) return "info";
  return null;
}

// ---------- entry points
export async function handleUpdate(env, upd, ctx) {
  if (upd.callback_query) return onCallback(env, upd.callback_query, ctx);
  const m = upd.message || upd.edited_message;
  if (!m || !m.from || m.chat?.type !== "private") return;
  const u = await upsertUser(env, m.from);

  // live location updates arrive as edited messages
  if (upd.edited_message) {
    if (m.location) {
      const o = await env.DB.prepare("SELECT num FROM orders WHERE tg_user=? AND type='delivery' AND status NOT IN ('done','cancelled') AND created>? ORDER BY num DESC LIMIT 1").bind(u.id, now() - 6 * 3600e3).first();
      if (o) ctx.waitUntil(core.liveUpdate(env, o.num, m.location.latitude, m.location.longitude));
    }
    return;
  }
  const s = u.st, l = u.lang, text = (m.text || "").trim();

  if (m.location) {
    if (s.f === "co" && s.step === "loc") { Object.assign(s, { lat: m.location.latitude, lon: m.location.longitude, live: !!m.location.live_period }); await saveState(env, u, s); return coNext(env, u); }
    const o = await env.DB.prepare("SELECT num FROM orders WHERE tg_user=? AND type='delivery' AND status NOT IN ('done','cancelled') AND created>? ORDER BY num DESC LIMIT 1").bind(u.id, now() - 6 * 3600e3).first();
    if (o) { ctx.waitUntil(core.liveUpdate(env, o.num, m.location.latitude, m.location.longitude)); return send(env, u.id, "📍 ✓"); }
    return;
  }
  if (m.contact) {
    if (m.contact.user_id && m.contact.user_id !== u.id) return send(env, u.id, t(l, "ask_phone"));
    const p = "+" + String(m.contact.phone_number).replace(/\D/g, "");
    await env.DB.prepare("UPDATE users SET phone=? WHERE id=?").bind(p, u.id).run(); u.phone = p;
    if ((s.f === "co" || s.f === "bk") && s.step === "phone") { s.phone = p; await saveState(env, u, s); await send(env, u.id, "📱 ✓", noKb); return s.f === "co" ? coNext(env, u) : bkNext(env, u); }
    return;
  }
  if (m.photo || (m.document && /^image\//.test(m.document.mime_type || ""))) {
    const fid = m.photo ? m.photo[m.photo.length - 1].file_id : m.document.file_id;
    const pend = await pendingPays(env, u);
    if (!pend.length) return send(env, u.id, t(l, "my_none"));
    if (pend.length === 1) return takeReceipt(env, u, fid, ctx, pend[0].kind, pend[0].num);
    await saveState(env, u, { ...s, rcFile: fid });
    return send(env, u.id, t(l, "receipt_which"), ik(pend.map(p => [btn(`${p.kind === "order" ? "📦" : "📅"} №${p.num}`, `rc:${p.kind[0]}:${p.num}`)])));
  }
  if (!text) return;

  // commands
  if (text.startsWith("/")) {
    const [cmd0, ...args] = text.split(/\s+/); const cmd = cmd0.split("@")[0].toLowerCase();
    if (cmd === "/start") {
      const p = args[0] || "";
      if (/^r_\w+$/.test(p)) {
        const inv = await env.DB.prepare("SELECT * FROM invites WHERE code=?").bind(p.slice(2)).first();
        if (!inv || inv.used_by || now() - inv.created > 2 * 864e5) return send(env, u.id, "Ссылка-приглашение недействительна или уже использована.");
        await env.DB.prepare("UPDATE invites SET used_by=? WHERE code=?").bind(u.id, inv.code).run();
        await env.DB.prepare("UPDATE users SET role=? WHERE id=?").bind(inv.role, u.id).run(); u.role = inv.role;
        await log(env, "info", "roles", `invite ${inv.code}: ${u.name} (${u.id}) -> ${inv.role}`);
        ctx.waitUntil(flush(env, [await enqueue(env, inv.by, "sendMessage", { text: `✅ ${u.name} принял(а) приглашение: ${ROLE_NAMES[inv.role]}` }, "role")]));
        await send(env, u.id, t(l, "role_set", { r: ROLE_NAMES[inv.role] }), mainKb(u));
        return showPanel(env, u);
      }
      if (/^table_?\d{1,3}$/i.test(p)) await kvSet(env, "table:" + u.id, JSON.stringify({ n: p.replace(/\D/g, ""), at: now() }));
      await saveState(env, u, {});
      await send(env, u.id, t(l, "hello"), mainKb(u));
      if (u.isNew) return send(env, u.id, t(l, "pick_lang"), ik([[btn("O'zbekcha", "lg:uz"), btn("Русский", "lg:ru"), btn("English", "lg:en")]]));
      if (/^table/.test(p)) return showCats(env, u);
      if (p === "book") return bkStart(env, u);
      return;
    }
    if (cmd === "/cancel") { await saveState(env, u, {}); return send(env, u.id, t(l, "cancelled_dialog"), mainKb(u)); }
    if (cmd === "/menu") return showCats(env, u);
    if (cmd === "/cart") return showCart(env, u);
    if (cmd === "/book") return bkStart(env, u);
    if (cmd === "/my") return showMy(env, u);
    if (cmd === "/lang") return send(env, u.id, t(l, "pick_lang"), ik([[btn("O'zbekcha", "lg:uz"), btn("Русский", "lg:ru"), btn("English", "lg:en")]]));
    if (cmd === "/id") return send(env, u.id, `Ваш Telegram ID: <code>${u.id}</code>`);
    if (!can(u, "staff")) return send(env, u.id, t(l, "hello"), mainKb(u));
    if (cmd === "/panel") return showPanel(env, u);
    if (cmd === "/orders" && can(u, "orders")) return listOrders(env, u);
    if (cmd === "/bookings" && can(u, "bookings")) return listBookings(env, u, args[0] || localDay(env));
    if (cmd === "/stats") return showStats(env, u);
    if (cmd === "/undelivered") return listUndelivered(env, u);
    if (cmd === "/receipts") return listReceipts(env, u);
    if (cmd === "/roles" && can(u, "manage")) return showRoles(env, u);
    if (cmd === "/grant" && can(u, "manage")) return send(env, u.id, await setRole(env, u, +args[0], (args[1] || "").replace("guest", ""), ctx));
    if (cmd === "/health" && can(u, "dev")) return health(env, u);
    if (cmd === "/logs" && can(u, "dev")) return showLogs(env, u);
    if (cmd === "/test" && can(u, "dev")) { const on = (await kvGet(env, "test_mode", "0")) !== "1"; await kvSet(env, "test_mode", on ? "1" : "0"); return send(env, u.id, on ? "🧪 Тест-режим ВКЛ: все новые заказы и брони приходят только разработчикам, с пометкой ТЕСТ." : "Тест-режим выключен."); }
    if (cmd === "/push" && can(u, "manage")) { // /push текст — уведомление всем гостям сайта, разрешившим уведомления
      const msgText = args.join(" ").trim();
      const all = await env.DB.prepare("SELECT * FROM push_subs").all();
      if (!msgText) return send(env, u.id, `Подписано на уведомления сайта: ${(all.results || []).length}. Отправить всем: /push текст`);
      const r = await pushMany(env, all.results || [], () => ({ title: "Olim Polvon", body: msgText.slice(0, 180), url: "./?from=push", tag: "news" }));
      await log(env, "info", "push", `${u.name}: broadcast to ${r.ok}`);
      return send(env, u.id, `Отправлено: ${r.ok}. Отписались (удалены): ${r.gone}.`);
    }
    if (cmd === "/set" && can(u, "manage")) { // /set card 8600… | /set card_owner Имя | /set booking_fee 100000 | /set notes текст акций
      const key = args[0], val = args.slice(1).join(" ");
      const keys = { card: "card_number", card_owner: "card_owner", booking_fee: "booking_fee", notes: "notes", delivery_info: "delivery_info" };
      if (!keys[key]) return send(env, u.id, "Использование: /set card|card_owner|booking_fee|notes|delivery_info значение");
      await kvSet(env, keys[key], val); await log(env, "info", "settings", `${u.name}: ${key}=${val.slice(0, 60)}`);
      return send(env, u.id, `Сохранено: ${key}`);
    }
    return showPanel(env, u);
  }

  // main keyboard buttons work in any state and reset the dialog
  const mk = mainKey(text);
  if (mk || text === t(l, "cancel")) {
    if (s.f) await saveState(env, u, {});
    if (text === t(l, "cancel")) return send(env, u.id, t(l, "cancelled_dialog"), mainKb(u));
    if (mk === "m_menu") return showCats(env, u);
    if (mk === "m_cart") return showCart(env, u);
    if (mk === "m_book") return bkStart(env, u);
    if (mk === "m_my") return showMy(env, u);
    if (mk === "m_info") return send(env, u.id, t(l, "info"), ik([[url(t(l, "route"), "https://yandex.uz/maps/org/89114477009/")]]));
    if (mk === "m_lang") return send(env, u.id, t(l, "pick_lang"), ik([[btn("O'zbekcha", "lg:uz"), btn("Русский", "lg:ru"), btn("English", "lg:en")]]));
    if (mk === "m_staff" && can(u, "staff")) return showPanel(env, u);
  }

  // dialog steps that expect text
  if (s.f === "fee" && can(u, "bookings")) {
    const sum = parseInt(text.replace(/\D/g, ""), 10);
    if (!sum) return send(env, u.id, "Напишите сумму цифрами, например 100000");
    const r = await core.setBookingStatus(env, s.num, "fee", u, sum < 1000 ? sum * 1000 : sum);
    ctx.waitUntil(flush(env, r.ids)); await saveState(env, u, {});
    return send(env, u.id, `Стоимость брони №${s.num}: ${money(r.row.fee)} — гостю отправлено.`);
  }
  if ((s.f === "co" || s.f === "bk") && s.step === "phone" && !/\d/.test(text) && !LANGS.map(x => t(x, "use_phone", { p: u.phone })).includes(text)) {
    await aiReply(env, u, text, ctx); return send(env, u.id, t(l, "ask_phone")); // a question in the middle of the dialog
  }
  if ((s.f === "co" || s.f === "bk") && s.step === "phone") {
    const used = LANGS.map(x => t(x, "use_phone", { p: u.phone })).includes(text);
    const p = used ? u.phone : text.replace(/[^\d+]/g, "");
    if (p.replace(/\D/g, "").length < 9) return send(env, u.id, t(l, "bad_phone"));
    s.phone = p.startsWith("+") || p.length < 12 ? p : "+" + p; await saveState(env, u, s); await send(env, u.id, "📱 ✓", noKb);
    return s.f === "co" ? coNext(env, u) : bkNext(env, u);
  }
  if (s.f === "co") {
    if (s.step === "loc") { s.address = text.slice(0, 200); s.flat = ""; await saveState(env, u, s); await send(env, u.id, "🏠 ✓", noKb); return coNext(env, u); }
    if (s.step === "flat") { s.flat = text.slice(0, 120); await saveState(env, u, s); return coNext(env, u); }
    if (s.step === "time") { const m2 = /(\d{1,2})[:.\s-]?(\d{2})?/.exec(text); if (!m2) return send(env, u.id, t(l, "ask_time")); s.when = `${m2[1].padStart(2, "0")}:${m2[2] || "00"}`; await saveState(env, u, s); return coNext(env, u); }
    if (s.step === "note") { s.note = text.slice(0, 300); await saveState(env, u, s); return coNext(env, u); }
  }
  if (s.f === "bk") {
    if (s.step === "name") { s.name = text.slice(0, 60); await saveState(env, u, s); await send(env, u.id, "👤 ✓", noKb); return bkNext(env, u); }
    if (s.step === "note") { s.note = text.slice(0, 300); await saveState(env, u, s); return bkNext(env, u); }
  }

  const qi = !can(u, "staff") && quickIntent(text);
  if (qi === "menu") return showCats(env, u);
  if (qi === "cart") return showCart(env, u);
  if (qi === "book") return bkStart(env, u);
  if (qi === "info") return send(env, u.id, t(l, "info"));
  return aiReply(env, u, text, ctx);
}

async function onCallback(env, q, ctx) {
  const u = await upsertUser(env, q.from), l = u.lang, d = q.data || "", msg = q.message?.message_id;
  const [a, b, c] = d.split(":");
  const ok = (txt, alert) => answer(env, q.id, txt, alert);
  if (d === "noop") return ok();
  if (a === "lg" && LANGS.includes(b)) { await env.DB.prepare("UPDATE users SET lang=? WHERE id=?").bind(b, u.id).run(); u.lang = b; await ok("✓"); await tg(env, "deleteMessage", { chat_id: u.id, message_id: msg }, { quiet: true }); return send(env, u.id, t(b, "hello"), mainKb(u)); }
  // menu
  if (a === "c") { await ok(); return b === "list" ? showCats(env, u, msg) : showCat(env, u, +b, msg); }
  if (a === "x") { await ok(); await tg(env, "deleteMessage", { chat_id: u.id, message_id: msg }, { quiet: true }); return; }
  if (a === "d") { await ok(); return showDish(env, u, +b); }
  if (a === "q") {
    const i = +b, dd = ITEMS[i]; if (!dd || dd.p == null) return ok(t(l, "no_price_hint"), true);
    u.cartObj[i] = Math.max(0, (u.cartObj[i] || 0) + (c === "+" ? 1 : -1)); if (!u.cartObj[i]) delete u.cartObj[i];
    await saveCart(env, u, u.cartObj); await ok(c === "+" ? t(l, "added", { d: name(dd, l) }) : "−");
    if (q.message?.photo) return tg(env, "editMessageCaption", { chat_id: u.id, message_id: msg, caption: dishCaption(dd, u), parse_mode: "HTML", reply_markup: dishKb(dd, i, u) }, { quiet: true });
    return edit(env, u.id, msg, dishCaption(dd, u), dishKb(dd, i, u));
  }
  if (a === "k") {
    if (b === "show") { await ok(); return showCart(env, u); }
    if (b === "clear") { await saveCart(env, u, {}); await ok("🗑"); return showCart(env, u, msg); }
    if (b === "co") { await ok(); return coStart(env, u); }
    const i = +b; u.cartObj[i] = Math.max(0, (u.cartObj[i] || 0) + (c === "+" ? 1 : -1)); if (!u.cartObj[i]) delete u.cartObj[i];
    await saveCart(env, u, u.cartObj); await ok(); return showCart(env, u, msg);
  }
  if (a === "go") { await ok(); if (b === "book") return bkStart(env, u); if (b === "my") return showMy(env, u); if (b === "info") return send(env, u.id, t(l, "info")); return; }
  if (a === "cx") { await saveState(env, u, {}); await ok(); await edit(env, u.id, msg, t(l, "cancelled_dialog")); return send(env, u.id, "👌", mainKb(u)); }
  // checkout
  const s = u.st;
  if (a === "ct" && s.f === "co") { s.type = b; if (b === "table") s.table = s.table || (await tableOf(env, u)); await saveState(env, u, s); await ok(); await edit(env, u.id, msg, "✓ " + (b === "table" ? t(l, "t_table", { n: s.table }) : t(l, "t_" + b))); return coNext(env, u); }
  if (a === "cw" && s.f === "co") { await ok(); if (b === "asap") { s.when = "asap"; await saveState(env, u, s); await edit(env, u.id, msg, "✓ " + t(l, "asap")); return coNext(env, u); } s.step = "time"; await saveState(env, u, s); return edit(env, u.id, msg, t(l, "ask_time")); }
  if (a === "cp" && s.f === "co") { s.pay = b === "card" ? "card" : "cash"; await saveState(env, u, s); await ok(); await edit(env, u.id, msg, "✓ " + t(l, b === "card" ? "card" : "cash")); return coNext(env, u); }
  if (a === "cn" && s.f === "co") { s.note = ""; await saveState(env, u, s); await ok(); await edit(env, u.id, msg, "✓ " + t(l, "no_note")); return coNext(env, u); }
  if (a === "cc" && s.f === "co") { await ok("✓"); await tg(env, "editMessageReplyMarkup", { chat_id: u.id, message_id: msg, reply_markup: ik([]) }, { quiet: true }); return coSubmit(env, u, ctx); }
  // booking
  if (a === "bd" && s.f === "bk") { await ok(); if (b === "-") { delete s.day; delete s.time; } else { s.day = b; delete s.time; } await saveState(env, u, s); await tg(env, "deleteMessage", { chat_id: u.id, message_id: msg }, { quiet: true }); return bkNext(env, u); }
  if (a === "bt" && s.f === "bk") { s.time = `${b}:${c}`; await saveState(env, u, s); await ok(); await edit(env, u.id, msg, `✓ ${s.day} · ${s.time}`); return bkNext(env, u); }
  if (a === "bg" && s.f === "bk") { s.guests = +b; await saveState(env, u, s); await ok(); await edit(env, u.id, msg, "✓ 👥 " + b); return bkNext(env, u); }
  if (a === "bz" && s.f === "bk") { s.zone = b; await saveState(env, u, s); await ok(); await edit(env, u.id, msg, "✓ " + t(l, b)); return bkNext(env, u); }
  if (a === "bn" && s.f === "bk") { s.note = ""; await saveState(env, u, s); await ok(); await edit(env, u.id, msg, "✓"); return bkNext(env, u); }
  if (a === "bc" && s.f === "bk") { await ok("✓"); await tg(env, "editMessageReplyMarkup", { chat_id: u.id, message_id: msg, reply_markup: ik([]) }, { quiet: true }); return bkSubmit(env, u, ctx); }
  if (a === "rc" && s.rcFile) { await ok(); const fid = s.rcFile; delete s.rcFile; await saveState(env, u, s); return takeReceipt(env, u, fid, ctx, b === "b" ? "booking" : "order", +c); }
  if (["ct", "cw", "cp", "cn", "cc", "bd", "bt", "bg", "bz", "bn", "bc", "rc"].includes(a)) return ok(t(l, "cancelled_dialog"));

  // ----- staff
  if (!can(u, "staff")) return ok("—");
  if (a === "o") {
    if (!can(u, "orders")) return ok("Нет доступа: нужна роль «приём заказов».", true);
    const num = +b;
    if (c === "cancel?") { await ok(); return tg(env, "editMessageReplyMarkup", { chat_id: u.id, message_id: msg, reply_markup: ik([[btn("Да, отменить заказ №" + num, `o:${num}:cancel`)], [btn("Нет", `o:${num}:keep`)]]) }); }
    if (c === "keep") { const o = await core.getOrder(env, num); await ok(); return tg(env, "editMessageReplyMarkup", { chat_id: u.id, message_id: msg, reply_markup: core.orderKb(o) }); }
    if (c === "payok" || c === "payno") { const r = await core.setPay(env, "order", num, c === "payok", u); ctx.waitUntil(flush(env, r.ids)); return ok(c === "payok" ? "Оплата подтверждена" : "Отмечено: нет оплаты"); }
    const r = await core.setOrderStatus(env, num, c, u);
    if (r.error === "closed") return ok("Заказ уже закрыт: " + core.ST_RU[r.row.status], true);
    if (r.error) return ok(r.error, true);
    ctx.waitUntil(flush(env, r.ids)); return ok(core.ST_RU[r.row.status]);
  }
  if (a === "b") {
    if (!can(u, "bookings")) return ok("Нет доступа: нужна роль «приём броней».", true);
    const num = +b;
    if (c === "fee") { await saveState(env, u, { f: "fee", num }); await ok(); return send(env, u.id, `Сумма брони №${num} в сумах (например 100000 или 100):`); }
    if (c === "payok" || c === "payno") { const r = await core.setPay(env, "booking", num, c === "payok", u); ctx.waitUntil(flush(env, r.ids)); return ok("✓"); }
    const r = await core.setBookingStatus(env, num, c, u); if (r.error) return ok(r.error, true);
    ctx.waitUntil(flush(env, r.ids)); return ok(core.BST_RU[r.row.status]);
  }
  if (a === "r") {
    const rc = await env.DB.prepare("SELECT * FROM receipts WHERE num=?").bind(+b).first(); if (!rc) return ok("Нет чека", true);
    if (!can(u, rc.kind === "booking" ? "bookings" : "orders")) return ok("Нет доступа", true);
    const r = await core.setPay(env, rc.kind, rc.ref, c === "ok", u); ctx.waitUntil(flush(env, r.ids)); return ok(c === "ok" ? "Оплата подтверждена" : "Нет оплаты");
  }
  if (a === "p") {
    await ok();
    if (b === "orders" && can(u, "orders")) return listOrders(env, u);
    if (b === "bt" && can(u, "bookings")) return listBookings(env, u, localDay(env));
    if (b === "bm" && can(u, "bookings")) return listBookings(env, u, localDay(env, now(), 1));
    if (b === "o" && can(u, "orders")) return sendCard(env, u, "order", +c, ctx);
    if (b === "b" && can(u, "bookings")) return sendCard(env, u, "booking", +c, ctx);
    if (b === "stats") return showStats(env, u);
    if (b === "und") return listUndelivered(env, u);
    if (b === "receipts") return listReceipts(env, u);
    if (b === "retry") { const r = await env.DB.prepare("UPDATE outbox SET status='pending', next_at=?, tries=0 WHERE status='failed' OR (status='pending' AND tries>0)").bind(now()).run(); const n = await runDue(env); return send(env, u.id, `Повторно отправлено: ${n} (из ${r.meta?.changes ?? "?"})`); }
    if (b === "roles" && can(u, "manage")) return showRoles(env, u);
    if (b === "notify" && can(u, "manage")) { await env.DB.prepare("UPDATE users SET notify=1-notify WHERE id=?").bind(u.id).run(); u.notify = u.notify ? 0 : 1; return tg(env, "editMessageReplyMarkup", { chat_id: u.id, message_id: msg, reply_markup: panelKb(u) }); }
    if (b === "health" && can(u, "dev")) return health(env, u);
    if (b === "logs" && can(u, "dev")) return showLogs(env, u);
    if (b === "test" && can(u, "dev")) { const on = (await kvGet(env, "test_mode", "0")) !== "1"; await kvSet(env, "test_mode", on ? "1" : "0"); return send(env, u.id, on ? "🧪 Тест-режим ВКЛ" : "Тест-режим выключен"); }
    return;
  }
  if (a === "inv" && can(u, "manage")) {
    if (b === "dev" && !can(u, "dev")) return ok("Только разработчик", true);
    const code = uid().slice(0, 12);
    await env.DB.prepare("INSERT INTO invites(code,role,by,created) VALUES(?,?,?,?)").bind(code, b, u.id, now()).run();
    await ok();
    return send(env, u.id, `Ссылка для роли «${ROLE_NAMES[b]}» (одноразовая, 48 часов). Перешлите её сотруднику:\nhttps://t.me/${env.BOT_USERNAME}?start=r_${code}`);
  }
  if (a === "rm" && can(u, "manage")) { await ok(); return send(env, u.id, await setRole(env, u, +b, "", ctx)); }
  return ok();
}
