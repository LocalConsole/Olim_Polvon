// Orders, bookings and receipts: creation (idempotent), staff notifications, status changes.
// Used by both the Telegram side and the site API, so both see exactly the same data.
import { ITEMS } from "./menu.gen.js";
import { now, esc, money, J, log, devIds, kvGet, setting } from "./lib.js";
import { enqueue, flush, sentFor } from "./outbox.js";
import { tg, ik, btn, url } from "./tg.js";
import { t } from "./texts.js";
import { pushToClient, pt } from "./push.js";

export const BY_ID = new Map(ITEMS.map((d, i) => [d.id, { ...d, i }]));
export const ORDER_FLOW = ["new", "accepted", "cooking", "courier", "done"];
const TYPE_RU = { delivery: "🛵 Доставка", pickup: "🏃 Навынос", table: "🍽 Стол" };
const ST_RU = { new: "🆕 новый", accepted: "✅ принят", cooking: "👨‍🍳 готовится", courier: "🛵 у курьера", done: "🏁 выполнен", cancelled: "✖️ отменён" };
const BST_RU = { new: "🆕 новая", confirmed: "✅ подтверждена", declined: "✖️ отклонена", callback: "📞 перезвонить", cancelled: "✖️ отменена", done: "🏁 состоялась" };
const PAY_RU = { "": "", wait: "ждём чек", sent: "чек на проверке", ok: "✅ оплачено", no: "❌ оплаты нет" };
export const ylink = (lat, lon) => `https://yandex.uz/maps/?pt=${lon},${lat}&z=17&l=map`;

// --- price check: the server never trusts prices from the client
export function priceLines(raw) {
  const lines = []; let total = 0, warn = false;
  for (const l of (Array.isArray(raw) ? raw : []).slice(0, 60)) {
    const q = Math.max(1, Math.min(99, parseInt(l?.q ?? l?.qty, 10) || 1));
    const d = BY_ID.get(String(l?.id || ""));
    if (d && d.p != null) { lines.push({ id: d.id, n: d.n[0], q, p: d.p }); total += d.p * q; }
    else if (l?.name && Number.isFinite(+l.price) && +l.price > 0) { // dish added by the admin on the site: name/price come from the client
      lines.push({ id: String(l.id || "").slice(0, 40), n: String(l.name).slice(0, 80) + " ⚠", q, p: Math.round(+l.price) }); total += Math.round(+l.price) * q; warn = true;
    }
  }
  return { lines, total, warn };
}

// --- who gets what
async function recipients(env, role, test) {
  if (test) return devIds(env);
  const r = await env.DB.prepare("SELECT id FROM users WHERE role=? OR (role='checker' AND notify=1) OR (role='dev' AND notify=1)").bind(role).all();
  const ids = [...new Set((r.results || []).map(x => x.id))];
  if (!ids.length) { await log(env, "warn", "notify", `nobody has role ${role}; sending to devs`); return devIds(env); }
  return ids;
}
export async function isTest(env, tgUser) { return (await kvGet(env, "test_mode", "0")) === "1" || (tgUser && devIds(env).includes(+tgUser) && (await kvGet(env, "dev_orders_test", "1")) === "1"); }

// --- cards for staff (Russian; staff panels are in Russian)
export function orderText(o) {
  const items = J(o.items, []);
  const geo = o.lat ? `\n📍 <a href="${ylink(o.lat, o.lon)}">на карте</a>${o.live ? " · трансляция" + (o.live_at ? " " + new Date(o.live_at + 5 * 3600e3).toISOString().slice(11, 16) : "") : ""}` : "";
  return [
    `${o.test ? "🧪 ТЕСТ · " : ""}<b>Заказ №${o.num}</b> · ${TYPE_RU[o.type] || o.type}${o.table_no ? " №" + esc(o.table_no) : ""} · ${o.source === "bot" ? "бот" : "сайт"}`,
    `Статус: <b>${ST_RU[o.status] || o.status}</b>${o.staff_name ? " · " + esc(o.staff_name) : ""}`,
    o.phone ? `👤 ${esc(o.name || "")} ${esc(o.phone)}` : "",
    o.address ? `🏠 ${esc(o.address)}` : "", geo.trim() ? geo.slice(1) : "",
    o.type !== "table" ? `🕐 ${esc(o.when_txt || "как можно скорее")}` : "",
    o.type !== "table" ? (o.pay === "card" ? `💳 Переводом${o.pay_status ? " — " + PAY_RU[o.pay_status] : ""}` : "💵 Наличными") : "",
    "", ...items.map(l => `• ${esc(l.n)} ×${l.q} — ${money(l.p * l.q)}`),
    `<b>Итого: ${money(o.total)}</b>`, o.note ? `💬 ${esc(o.note)}` : "",
  ].filter((x, i, a) => x !== "" || (i > 0 && a[i - 1] !== "")).join("\n");
}
export function orderKb(o) {
  const n = o.num, rows = [];
  if (o.status === "new") rows.push([btn("✅ Принять", `o:${n}:accepted`), btn("✖️ Отменить", `o:${n}:cancel?`)]);
  else if (o.status === "accepted") rows.push([btn("👨‍🍳 Готовится", `o:${n}:cooking`), btn("✖️", `o:${n}:cancel?`)]);
  else if (o.status === "cooking") rows.push(o.type === "delivery" ? [btn("🛵 Передан курьеру", `o:${n}:courier`)] : [btn("🏁 Выполнен", `o:${n}:done`)]);
  else if (o.status === "courier") rows.push([btn("🏁 Доставлен", `o:${n}:done`)]);
  if (o.lat) rows.push([url("🗺 Открыть карту", ylink(o.lat, o.lon))]);
  if (o.pay === "card" && ["wait", "sent", "no"].includes(o.pay_status)) rows.push([btn("✅ Оплата подтверждена", `o:${n}:payok`), btn("❌ Нет оплаты", `o:${n}:payno`)]);
  return ik(rows);
}
export function bookingText(b) {
  return [
    `${b.test ? "🧪 ТЕСТ · " : ""}<b>Бронь №${b.num}</b> · ${b.source === "bot" ? "бот" : "сайт"}`,
    `Статус: <b>${BST_RU[b.status] || b.status}</b>${b.staff_name ? " · " + esc(b.staff_name) : ""}`,
    `👤 ${esc(b.name)} ${esc(b.phone)}`, `📅 ${esc(b.day)} в ${esc(b.time)} · гостей: ${b.guests}`, `🪑 ${esc(b.zone || "неважно")}`,
    `💰 Стоимость брони: ${b.fee ? money(b.fee) : "не назначена"}${b.pay_status ? " — " + PAY_RU[b.pay_status] : ""}`,
    b.note ? `💬 ${esc(b.note)}` : "",
  ].filter(Boolean).join("\n");
}
export function bookingKb(b) {
  const n = b.num, rows = [];
  if (["new", "callback"].includes(b.status)) rows.push([btn("✅ Подтвердить", `b:${n}:confirmed`), btn("✖️ Отклонить", `b:${n}:declined`)]);
  if (b.status === "new") rows.push([btn("📞 Перезвоню", `b:${n}:callback`)]);
  if (!["declined", "cancelled", "done"].includes(b.status)) rows.push([btn(b.fee ? "💰 Изменить стоимость" : "💰 Назначить стоимость", `b:${n}:fee`)]);
  if (b.status === "confirmed") rows.push([btn("🏁 Состоялась", `b:${n}:done`), btn("✖️ Отменить", `b:${n}:cancelled`)]);
  if (["wait", "sent", "no"].includes(b.pay_status)) rows.push([btn("✅ Оплата подтверждена", `b:${n}:payok`), btn("❌ Нет оплаты", `b:${n}:payno`)]);
  return ik(rows);
}

export const getOrder = (env, num) => env.DB.prepare("SELECT * FROM orders WHERE num=?").bind(num).first();
export const getBooking = (env, num) => env.DB.prepare("SELECT * FROM bookings WHERE num=?").bind(num).first();

// --- create (idempotent by id). Returns {row, created}
export async function createOrder(env, d) {
  const id = String(d.id || "").slice(0, 64); if (!/^[\w.:-]{6,64}$/.test(id)) throw new Error("bad id");
  const old = await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first();
  if (old) return { row: old, created: false };
  const { lines, total } = priceLines(d.items);
  if (!lines.length) throw new Error("empty order");
  const type = ["delivery", "pickup", "table"].includes(d.type) ? d.type : "delivery";
  const lat = Number.isFinite(+d.lat) && d.lat !== "" && d.lat != null ? +(+d.lat).toFixed(6) : null, lon = lat != null ? +(+d.lon).toFixed(6) : null;
  const test = await isTest(env, d.tg_user) ? 1 : 0;
  const pay = type === "table" ? "" : (d.pay === "card" || d.pay === "transfer" ? "card" : "cash");
  const row = await env.DB.prepare(`INSERT INTO orders(id,source,tg_user,type,table_no,name,phone,address,lat,lon,live,when_txt,pay,pay_status,items,total,note,status,lang,test,created,updated,cid)
    VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,'new',?,?,?,?,?) ON CONFLICT(id) DO NOTHING RETURNING *`).bind(
    id, d.source || "site", d.tg_user || null, type, type === "table" ? String(d.table || "").slice(0, 4) : "",
    String(d.name || "").slice(0, 60), String(d.phone || "").slice(0, 30), String(d.address || "").slice(0, 200),
    lat, lon, d.live && lat != null ? 1 : 0, String(d.when || "").slice(0, 40), pay, pay === "card" ? "wait" : "",
    JSON.stringify(lines), total, String(d.note || "").slice(0, 300), ["ru", "uz", "en"].includes(d.lang) ? d.lang : "ru", test, now(), now(), d.cid ? String(d.cid).slice(0, 40) : null).first();
  if (!row) return { row: await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(id).first(), created: false }; // lost a race: same id
  const ids = [];
  for (const chat of await recipients(env, "orders", test)) {
    ids.push(await enqueue(env, chat, "sendMessage", { text: orderText(row), parse_mode: "HTML", disable_web_page_preview: true, reply_markup: orderKb(row) }, "order:" + row.num));
    if (row.lat != null) ids.push(await enqueue(env, chat, "sendLocation", { latitude: row.lat, longitude: row.lon, ...(row.live ? { live_period: 43200 } : {}) }, "live:" + row.num));
  }
  await log(env, "info", "order", `#${row.num} ${row.source} ${row.type} ${row.total}`);
  return { row, created: true, ids };
}

export async function createBooking(env, d) {
  const id = String(d.id || "").slice(0, 64); if (!/^[\w.:-]{6,64}$/.test(id)) throw new Error("bad id");
  const old = await env.DB.prepare("SELECT * FROM bookings WHERE id=?").bind(id).first();
  if (old) return { row: old, created: false };
  if (!/^\d{4}-\d\d-\d\d$/.test(d.day || d.date || "") || !/^\d\d:\d\d$/.test(d.time || "")) throw new Error("bad date");
  if (String(d.phone || "").replace(/\D/g, "").length < 9) throw new Error("bad phone");
  const test = await isTest(env, d.tg_user) ? 1 : 0;
  const fee = +(await setting(env, "booking_fee")) || null;
  const row = await env.DB.prepare(`INSERT INTO bookings(id,source,tg_user,name,phone,day,time,guests,zone,note,status,fee,lang,test,created,updated,cid)
    VALUES(?,?,?,?,?,?,?,?,?,?,'new',?,?,?,?,?,?) ON CONFLICT(id) DO NOTHING RETURNING *`).bind(
    id, d.source || "site", d.tg_user || null, String(d.name || "").slice(0, 60), String(d.phone || "").slice(0, 30), d.day || d.date, d.time,
    Math.max(1, Math.min(200, parseInt(d.guests, 10) || 2)), String(d.zone || "").slice(0, 60), String(d.note || "").slice(0, 300),
    fee, ["ru", "uz", "en"].includes(d.lang) ? d.lang : "ru", test, now(), now(), d.cid ? String(d.cid).slice(0, 40) : null).first();
  if (!row) return { row: await env.DB.prepare("SELECT * FROM bookings WHERE id=?").bind(id).first(), created: false };
  const ids = [];
  for (const chat of await recipients(env, "bookings", test))
    ids.push(await enqueue(env, chat, "sendMessage", { text: bookingText(row), parse_mode: "HTML", reply_markup: bookingKb(row) }, "booking:" + row.num));
  await log(env, "info", "booking", `#${row.num} ${row.day} ${row.time} x${row.guests}`);
  return { row, created: true, ids };
}

// --- refresh every staff copy of a card after a change
async function refreshCards(env, ref, text, kb) {
  for (const m of await sentFor(env, ref)) await tg(env, "editMessageText", { chat_id: m.chat_id, message_id: m.msg_id, text, parse_mode: "HTML", disable_web_page_preview: true, reply_markup: kb }, { quiet: true });
}
async function tellGuest(env, row, key, vars, extraKb) {
  if (!row.tg_user) return [];
  return [await enqueue(env, row.tg_user, "sendMessage", { text: t(row.lang, key, vars), parse_mode: "HTML", ...(extraKb ? { reply_markup: extraKb } : {}) }, "guest:" + key)];
}

export async function setOrderStatus(env, num, status, who) {
  const o = await getOrder(env, num); if (!o) return { error: "not found" };
  if (["done", "cancelled"].includes(o.status) && status !== o.status) return { error: "closed", row: o };
  const st = status === "cancel" ? "cancelled" : status;
  if (![...ORDER_FLOW, "cancelled"].includes(st)) return { error: "bad status" };
  await env.DB.prepare("UPDATE orders SET status=?, updated=?, staff=COALESCE(staff,?), staff_name=COALESCE(staff_name,?) WHERE num=?").bind(st, now(), who?.id || null, who?.name || null, num).run();
  const row = await getOrder(env, num);
  await refreshCards(env, "order:" + num, orderText(row), orderKb(row));
  if (["done", "cancelled"].includes(st)) for (const m of await sentFor(env, "live:" + num)) await tg(env, "stopMessageLiveLocation", { chat_id: m.chat_id, message_id: m.msg_id }, { quiet: true });
  const ids = await tellGuest(env, row, "status_upd", { n: num, s: t(row.lang, "st_" + st) });
  if (st !== "new") await pushToClient(env, row.cid, l => ({ title: pt(l, "order", { n: num }), body: pt(l, "st_" + st), url: "./?from=push", tag: "order" + num, urgent: st === "courier" }));
  await log(env, "info", "order", `#${num} -> ${st} by ${who?.name || "?"}`);
  return { row, ids };
}

const PT_B = ["confirmed", "declined", "callback", "cancelled"];
export async function setBookingStatus(env, num, status, who, fee) {
  const b = await getBooking(env, num); if (!b) return { error: "not found" };
  if (status === "fee") {
    await env.DB.prepare("UPDATE bookings SET fee=?, pay_status=CASE WHEN pay_status IN ('','no') THEN 'wait' ELSE pay_status END, updated=? WHERE num=?").bind(fee, now(), num).run();
  } else {
    if (!["confirmed", "declined", "callback", "cancelled", "done"].includes(status)) return { error: "bad status" };
    await env.DB.prepare("UPDATE bookings SET status=?, updated=?, staff=COALESCE(staff,?), staff_name=COALESCE(staff_name,?) WHERE num=?").bind(status, now(), who?.id || null, who?.name || null, num).run();
  }
  const row = await getBooking(env, num);
  await refreshCards(env, "booking:" + num, bookingText(row), bookingKb(row));
  let ids = [];
  if (status === "fee") ids = await tellGuest(env, row, "b_fee", { sum: money(fee, row.lang), card: await setting(env, "card"), owner: await setting(env, "card_owner") });
  else ids = await tellGuest(env, row, "b_upd", { n: num, d: row.day, t: row.time, s: t(row.lang, "bs_" + status) });
  if (status === "fee" || PT_B.includes(status)) await pushToClient(env, row.cid, l => ({ title: pt(l, "booking", { n: num }), body: status === "fee" ? pt(l, "fee", { sum: money(fee, l) }) : pt(l, "bs_" + status), url: "./?from=push", tag: "booking" + num }));
  await log(env, "info", "booking", `#${num} -> ${status}${fee ? " " + fee : ""} by ${who?.name || "?"}`);
  return { row, ids };
}

// --- receipts (card payment screenshots)
export async function addReceipt(env, { id, kind, ref, file_id, data }) {
  const rid = String(id || "").slice(0, 64); if (!/^[\w.:-]{6,64}$/.test(rid)) throw new Error("bad id");
  const old = await env.DB.prepare("SELECT * FROM receipts WHERE id=?").bind(rid).first();
  if (old) return { row: old, created: false };
  const obj = kind === "booking" ? await getBooking(env, ref) : await getOrder(env, ref);
  if (!obj) throw new Error("not found");
  if (data && data.length > 1_400_000) throw new Error("too big");
  const row = await env.DB.prepare("INSERT INTO receipts(id,kind,ref,file_id,data,status,created) VALUES(?,?,?,?,?,'wait',?) ON CONFLICT(id) DO NOTHING RETURNING *")
    .bind(rid, kind === "booking" ? "booking" : "order", ref, file_id || null, file_id ? null : data || null, now()).first();
  if (!row) return { row: await env.DB.prepare("SELECT * FROM receipts WHERE id=?").bind(rid).first(), created: false };
  await env.DB.prepare(`UPDATE ${kind === "booking" ? "bookings" : "orders"} SET pay_status='sent', updated=? WHERE num=?`).bind(now(), ref).run();
  const fresh = kind === "booking" ? await getBooking(env, ref) : await getOrder(env, ref);
  const caption = `🧾 Чек к ${kind === "booking" ? "брони" : "заказу"} №${ref} · ${fresh.source === "bot" ? "бот" : "сайт"}\n👤 ${esc(fresh.name || "")} ${esc(fresh.phone || "")}\n💰 ${money(kind === "booking" ? fresh.fee : fresh.total)}`;
  const kb = ik([[btn("✅ Оплата подтверждена", `r:${row.num}:ok`), btn("❌ Нет оплаты", `r:${row.num}:no`)]]);
  const ids = [];
  // first recipient uploads the bytes, the rest reuse Telegram's file_id (outbox resolves it in order)
  for (const chat of await recipients(env, kind === "booking" ? "bookings" : "orders", fresh.test))
    ids.push(await enqueue(env, chat, "sendPhoto", { photo: "receipt:" + row.num, caption, parse_mode: "HTML", reply_markup: kb }, "receipt:" + row.num));
  if (kind === "booking") await refreshCards(env, "booking:" + ref, bookingText(fresh), bookingKb(fresh));
  else await refreshCards(env, "order:" + ref, orderText(fresh), orderKb(fresh));
  return { row, created: true, ids };
}

export async function setPay(env, kind, ref, ok, who) {
  const tbl = kind === "booking" ? "bookings" : "orders";
  await env.DB.prepare(`UPDATE ${tbl} SET pay_status=?, updated=? WHERE num=?`).bind(ok ? "ok" : "no", now(), ref).run();
  await env.DB.prepare("UPDATE receipts SET status=?, by=? WHERE kind=? AND ref=? AND status='wait'").bind(ok ? "ok" : "no", who?.id || null, kind, ref).run();
  const row = kind === "booking" ? await getBooking(env, ref) : await getOrder(env, ref);
  if (kind === "booking") await refreshCards(env, "booking:" + ref, bookingText(row), bookingKb(row));
  else await refreshCards(env, "order:" + ref, orderText(row), orderKb(row));
  const rcs = await env.DB.prepare("SELECT num FROM receipts WHERE kind=? AND ref=?").bind(kind, ref).all();
  for (const r of rcs.results || []) for (const m of await sentFor(env, "receipt:" + r.num))
    await tg(env, "editMessageReplyMarkup", { chat_id: m.chat_id, message_id: m.msg_id, reply_markup: ik([[btn(ok ? "✅ Оплата подтверждена · " + (who?.name || "") : "❌ Нет оплаты · " + (who?.name || ""), "noop")]]) }, { quiet: true });
  const ids = await tellGuest(env, row, ok ? "pay_ok" : "pay_no", { n: ref });
  await pushToClient(env, row.cid, l => ({ title: pt(l, kind === "booking" ? "booking" : "order", { n: ref }), body: pt(l, ok ? "pay_ok" : "pay_no"), url: "./?from=push", tag: kind + ref + "pay" }));
  await log(env, "info", "pay", `${kind} #${ref} ${ok ? "ok" : "no"} by ${who?.name || "?"}`);
  return { row, ids };
}

// --- live location from the site or from Telegram live location
export async function liveUpdate(env, num, lat, lon) {
  const o = await getOrder(env, num); if (!o || ["done", "cancelled"].includes(o.status)) return { error: "closed" };
  lat = +(+lat).toFixed(6); lon = +(+lon).toFixed(6);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return { error: "bad coords" };
  const throttled = o.live_at && now() - o.live_at < 8000;
  await env.DB.prepare("UPDATE orders SET lat=?, lon=?, live=1, live_at=? WHERE num=?").bind(lat, lon, now(), num).run();
  if (throttled) return { ok: true, throttled: true };
  const sent = await sentFor(env, "live:" + num);
  if (!sent.length) {
    const ids = [];
    for (const chat of await recipients(env, "orders", o.test)) ids.push(await enqueue(env, chat, "sendLocation", { latitude: lat, longitude: lon, live_period: 43200 }, "live:" + num));
    return { ok: true, ids };
  }
  for (const m of sent) {
    const r = await tg(env, "editMessageLiveLocation", { chat_id: m.chat_id, message_id: m.msg_id, latitude: lat, longitude: lon }, { quiet: true });
    if (!r.ok && /can't be edited|message to edit not found/i.test(r.description || "")) { // static pin or expired: send a fresh live one
      await env.DB.prepare("UPDATE outbox SET ref='live-old:'||? WHERE id=?").bind(num, m.id).run();
      await flush(env, [await enqueue(env, m.chat_id, "sendLocation", { latitude: lat, longitude: lon, live_period: 43200 }, "live:" + num)]);
    }
  }
  return { ok: true };
}

// --- public status for the guest (site polls it)
export function publicOrder(o) {
  return o && { kind: "order", id: o.id, num: o.num, status: o.status, pay: o.pay, pay_status: o.pay_status, total: o.total, type: o.type, updated: o.updated };
}
export function publicBooking(b) {
  return b && { kind: "booking", id: b.id, num: b.num, status: b.status, fee: b.fee, pay_status: b.pay_status, day: b.day, time: b.time, updated: b.updated };
}

export async function stats(env) {
  const from = (await import("./lib.js")).dayStart(env);
  const o = await env.DB.prepare("SELECT status, COUNT(*) n, SUM(total) s FROM orders WHERE created>=? AND test=0 GROUP BY status").bind(from).all();
  const b = await env.DB.prepare("SELECT status, COUNT(*) n FROM bookings WHERE created>=? AND test=0 GROUP BY status").bind(from).all();
  const rc = await env.DB.prepare("SELECT COUNT(*) n FROM receipts WHERE status='wait'").first();
  const ob = await env.DB.prepare("SELECT status, COUNT(*) n FROM outbox WHERE created>=? GROUP BY status").bind(from - 864e5).all();
  return { orders: o.results || [], bookings: b.results || [], receipts_wait: rc?.n || 0, outbox: ob.results || [] };
}
export { ST_RU, BST_RU, TYPE_RU, PAY_RU };
