// Web Push for site guests (no libraries: VAPID JWT ES256 + RFC 8291 aes128gcm with WebCrypto).
// Keys: `node scripts/vapid.mjs` → VAPID_PUBLIC (var, base64url 65-byte key) and VAPID_PRIVATE (secret, JWK json).
import { now, log } from "./lib.js";

const te = new TextEncoder();
const b64u = buf => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
const unb64u = s => Uint8Array.from(atob(String(s).replace(/-/g, "+").replace(/_/g, "/").padEnd(Math.ceil(s.length / 4) * 4, "=")), c => c.charCodeAt(0));
const cat = (...a) => { const out = new Uint8Array(a.reduce((n, x) => n + x.length, 0)); let o = 0; for (const x of a) { out.set(x, o); o += x.length; } return out; };

async function hkdf(salt, ikm, info, len) {
  const k = await crypto.subtle.importKey("raw", ikm, "HKDF", false, ["deriveBits"]);
  return new Uint8Array(await crypto.subtle.deriveBits({ name: "HKDF", hash: "SHA-256", salt, info }, k, len * 8));
}

// RFC 8291: encrypt `payload` for one subscription {p256dh, auth}
export async function encrypt(payload, p256dh, auth) {
  const uaPub = unb64u(p256dh), authSecret = unb64u(auth);
  const as = await crypto.subtle.generateKey({ name: "ECDH", namedCurve: "P-256" }, true, ["deriveBits"]);
  const asPub = new Uint8Array(await crypto.subtle.exportKey("raw", as.publicKey));
  const uaKey = await crypto.subtle.importKey("raw", uaPub, { name: "ECDH", namedCurve: "P-256" }, false, []);
  const shared = new Uint8Array(await crypto.subtle.deriveBits({ name: "ECDH", public: uaKey }, as.privateKey, 256));
  const ikm = await hkdf(authSecret, shared, cat(te.encode("WebPush: info\0"), uaPub, asPub), 32);
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const cek = await hkdf(salt, ikm, te.encode("Content-Encoding: aes128gcm\0"), 16);
  const nonce = await hkdf(salt, ikm, te.encode("Content-Encoding: nonce\0"), 12);
  const key = await crypto.subtle.importKey("raw", cek, "AES-GCM", false, ["encrypt"]);
  const ct = new Uint8Array(await crypto.subtle.encrypt({ name: "AES-GCM", iv: nonce }, key, cat(te.encode(payload), new Uint8Array([2]))));
  const head = new Uint8Array(21); head.set(salt); new DataView(head.buffer).setUint32(16, 4096); head[20] = 65;
  return cat(head, asPub, ct);
}

let signKey = null;
export async function vapidAuth(env, endpoint) {
  if (!signKey) signKey = await crypto.subtle.importKey("jwk", JSON.parse(env.VAPID_PRIVATE), { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
  const enc = o => b64u(te.encode(JSON.stringify(o)));
  const unsigned = enc({ typ: "JWT", alg: "ES256" }) + "." + enc({ aud: new URL(endpoint).origin, exp: Math.floor(now() / 1000) + 12 * 3600, sub: env.VAPID_SUBJECT || "mailto:admin@olimpolvon.uz" });
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, signKey, te.encode(unsigned));
  return `vapid t=${unsigned}.${b64u(sig)}, k=${env.VAPID_PUBLIC}`;
}

// send one message; returns "ok" | "gone" (subscription is dead, delete it) | "retry"
export async function pushOne(env, sub, msg) {
  if (!env.VAPID_PRIVATE || !env.VAPID_PUBLIC) return "retry";
  try {
    if (msg.url && msg.url.startsWith("./") && sub.lang && sub.lang !== "ru") msg = { ...msg, url: "./" + sub.lang + "/" + msg.url.slice(2) }; // uz/en pages
    const body = await encrypt(JSON.stringify(msg), sub.p256dh, sub.auth);
    const r = await fetch(sub.endpoint, { method: "POST", body, signal: AbortSignal.timeout(8000),
      headers: { "Content-Encoding": "aes128gcm", "Content-Type": "application/octet-stream", TTL: String(msg.ttl || 86400), Urgency: msg.urgent ? "high" : "normal", Authorization: await vapidAuth(env, sub.endpoint) } });
    if (r.ok) return "ok";
    if (r.status === 404 || r.status === 410) return "gone";
    await log(env, "warn", "push", `${r.status} ${(await r.text()).slice(0, 150)}`);
    return "retry";
  } catch (e) { await log(env, "warn", "push", String(e)); return "retry"; }
}

// texts in the guest's language: [ru, uz, en]
const L = { ru: 0, uz: 1, en: 2 };
export const PT = {
  order: ["Заказ №{n}", "№{n} buyurtma", "Order #{n}"],
  booking: ["Бронь №{n}", "№{n} bron", "Booking #{n}"],
  st_accepted: ["Принят — скоро начнём готовить", "Qabul qilindi — tez orada tayyorlaymiz", "Accepted — we'll start cooking soon"],
  st_cooking: ["Готовится 👨‍🍳", "Tayyorlanmoqda 👨‍🍳", "Cooking 👨‍🍳"],
  st_courier: ["Курьер уже в пути 🛵", "Kuryer yo'lda 🛵", "The courier is on the way 🛵"],
  st_done: ["Готово! Приятного аппетита", "Tayyor! Yoqimli ishtaha", "Done! Enjoy your meal"],
  st_cancelled: ["Отменён. Вопросы: +998 95 343 43 43", "Bekor qilindi. Savollar: +998 95 343 43 43", "Cancelled. Questions: +998 95 343 43 43"],
  bs_confirmed: ["Подтверждена — ждём вас!", "Tasdiqlandi — sizni kutamiz!", "Confirmed — see you soon!"],
  bs_declined: ["Не получилось подтвердить. Позвоните +998 95 343 43 43", "Tasdiqlab bo'lmadi. +998 95 343 43 43 ga qo'ng'iroq qiling", "We couldn't confirm it. Call +998 95 343 43 43"],
  bs_callback: ["Администратор вам перезвонит", "Administrator sizga qo'ng'iroq qiladi", "The administrator will call you"],
  bs_cancelled: ["Бронь отменена", "Bron bekor qilindi", "Booking cancelled"],
  fee: ["Стоимость брони: {sum}. Оплатите и загрузите чек", "Bron narxi: {sum}. To'lab, chekni yuklang", "Booking price: {sum}. Pay and upload the receipt"],
  pay_ok: ["Оплата подтверждена ✓", "To'lov tasdiqlandi ✓", "Payment confirmed ✓"],
  pay_no: ["Оплату не нашли — проверьте перевод", "To'lov topilmadi — o'tkazmani tekshiring", "Payment not found — please check the transfer"],
  miss_t: ["Ёрдамчи помнит вас 🫓", "Yordamchi sizni eslaydi 🫓", "Yordamchi remembers you 🫓"],
  miss_b: ["Давно не виделись! Тандыр горячий, лепёшки румяные. Заглянете?", "Ko'rishmaganimizga ancha bo'ldi! Tandir qizigan, nonlar qip-qizil. Kelasizmi?", "Long time no see! The tandoor is hot and the bread is fresh. Drop by?"],
  miss_n: ["У нас новость: {notes}", "Yangilik bor: {notes}", "News from us: {notes}"],
};
export const pt = (lang, k, v = {}) => { let s = (PT[k] || [k])[L[lang] ?? 0] || PT[k][0]; for (const [a, b] of Object.entries(v)) s = s.split("{" + a + "}").join(b); return s; };

// to every device of one guest (cid = random id the site keeps in localStorage)
export async function pushToClient(env, cid, msgFor) {
  if (!cid) return 0;
  const r = await env.DB.prepare("SELECT * FROM push_subs WHERE cid=?").bind(cid).all();
  let sent = 0;
  for (const s of r.results || []) {
    const res = await pushOne(env, s, msgFor(s.lang || "ru"));
    if (res === "gone") await env.DB.prepare("DELETE FROM push_subs WHERE id=?").bind(s.id).run();
    else if (res === "ok") { sent++; await env.DB.prepare("UPDATE push_subs SET last_sent=? WHERE id=?").bind(now(), s.id).run(); }
  }
  return sent;
}

// broadcast or «we miss you». kind: 'miss' counts as unanswered until the guest opens it
export async function pushMany(env, subs, msgFor, kind) {
  let ok = 0, gone = 0;
  for (const s of subs) {
    const res = await pushOne(env, s, msgFor(s.lang || "ru"));
    if (res === "gone") { gone++; await env.DB.prepare("DELETE FROM push_subs WHERE id=?").bind(s.id).run(); }
    else if (res === "ok") { ok++; await env.DB.prepare(`UPDATE push_subs SET last_sent=?${kind === "miss" ? ", last_miss=?, unanswered=unanswered+1" : ""} WHERE id=?`).bind(...(kind === "miss" ? [now(), now(), s.id] : [now(), s.id])).run(); }
  }
  return { ok, gone };
}

// cron, once a day: guests who have been away 14+ days hear from the mascot; never more often than every 14 days,
// and after 3 ignored ones we stop (the site also erases a long-kept chat after 4 months without activity)
export async function missYou(env) {
  const day = 864e5, t = now();
  const r = await env.DB.prepare(`SELECT * FROM push_subs WHERE last_seen < ? AND COALESCE(last_miss,0) < ? AND unanswered < 3 LIMIT 200`).bind(t - 14 * day, t - 14 * day).all();
  const notes = ((await env.DB.prepare("SELECT v FROM kv WHERE k='notes'").first())?.v || "").trim().slice(0, 120);
  return pushMany(env, r.results || [], lang => ({ title: pt(lang, "miss_t"), body: notes ? pt(lang, "miss_n", { notes }) : pt(lang, "miss_b"), url: "./?from=push&ai=1", tag: "miss" }), "miss");
}
