// HTTP API for the site. Called either directly (browser, allowed Origin) or through Google Apps Script
// (header X-Site-Key) — workers.dev is blocked in Uzbekistan, script.google.com is not.
// The site keeps an unsent request in localStorage and repeats it until it gets {ok:true}; the client-made `id`
// makes every repeat safe (no duplicates).
import * as core from "./core.js";
import { flush } from "./outbox.js";
import { now, uid, kvGet, kvSet, log, setting, J } from "./lib.js";

const hits = new Map();
function limited(ip, max = 40) {
  const t = now(), rec = (hits.get(ip) || []).filter(x => t - x < 60000); rec.push(t); hits.set(ip, rec);
  if (hits.size > 5000) hits.clear();
  return rec.length > max;
}
const eq = (a, b) => { a = String(a || ""); b = String(b || ""); if (!a || a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; };

export function corsHeaders(env, origin) {
  const allowed = String(env.ORIGINS || "").split(",").map(s => s.trim()).filter(Boolean);
  const ok = origin && (allowed.includes(origin) || /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin));
  return { ok, h: { "Access-Control-Allow-Origin": ok ? origin : allowed[0] || "*", "Access-Control-Allow-Methods": "POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, X-Site-Key", "Access-Control-Max-Age": "86400", Vary: "Origin" } };
}
const out = (obj, status = 200, h = {}) => new Response(JSON.stringify(obj), { status, headers: { ...h, "Content-Type": "application/json; charset=utf-8" } });

async function admin(env, token) {
  if (!token) return null;
  const s = await env.DB.prepare("SELECT * FROM sessions WHERE token=? AND exp>?").bind(String(token), now()).first();
  return s ? { id: null, name: "Админка сайта" } : null;
}

export async function handleApi(env, req, ctx, path) {
  const origin = req.headers.get("Origin") || "";
  const { ok: originOk, h } = corsHeaders(env, origin);
  if (req.method === "OPTIONS") return new Response(null, { headers: h });
  if (req.method !== "POST") return out({ error: "POST only" }, 405, h);
  const viaGas = env.SITE_KEY && eq(req.headers.get("X-Site-Key"), env.SITE_KEY);
  if (!viaGas && !originOk) return out({ error: "forbidden" }, 403, h);
  let body; try { body = await req.json(); } catch { return out({ error: "bad json" }, 400, h); }
  const ip = viaGas ? "gas:" + String(body._ip || "?") : req.headers.get("CF-Connecting-IP") || "?";
  if (limited(ip, viaGas ? 400 : 60)) return out({ error: "slow down", retryAfter: 20 }, 429, h);
  const route = path.replace(/^\/api\//, "");
  try {
    if (route === "order") {
      const r = await core.createOrder(env, { ...body, source: "site", tg_user: null });
      ctx.waitUntil(flush(env, r.ids));
      return out({ ok: true, num: r.row.num, status: r.row.status, total: r.row.total, dup: !r.created, card: r.row.pay === "card" ? { number: await setting(env, "card"), owner: await setting(env, "card_owner") } : null }, 200, h);
    }
    if (route === "booking") {
      const r = await core.createBooking(env, { ...body, source: "site", tg_user: null });
      ctx.waitUntil(flush(env, r.ids));
      return out({ ok: true, num: r.row.num, status: r.row.status, dup: !r.created }, 200, h);
    }
    if (route === "status") {
      const ids = (Array.isArray(body.ids) ? body.ids : []).slice(0, 20);
      const items = [];
      for (const x of ids) {
        if (x?.kind === "booking") items.push(core.publicBooking(await env.DB.prepare("SELECT * FROM bookings WHERE id=?").bind(String(x.id)).first()));
        else items.push(core.publicOrder(await env.DB.prepare("SELECT * FROM orders WHERE id=?").bind(String(x?.id)).first()));
      }
      return out({ ok: true, items: items.filter(Boolean), card: { number: await setting(env, "card"), owner: await setting(env, "card_owner") } }, 200, h);
    }
    if (route === "live") {
      const o = await env.DB.prepare("SELECT num FROM orders WHERE id=?").bind(String(body.id)).first();
      if (!o) return out({ error: "not found" }, 404, h);
      const r = await core.liveUpdate(env, o.num, body.lat, body.lon);
      if (r.ids) ctx.waitUntil(flush(env, r.ids));
      return out({ ok: !r.error, stop: r.error === "closed" }, 200, h);
    }
    if (route === "receipt") {
      const kind = body.kind === "booking" ? "booking" : "order";
      const obj = await env.DB.prepare(`SELECT num FROM ${kind === "booking" ? "bookings" : "orders"} WHERE id=?`).bind(String(body.ref)).first();
      if (!obj) return out({ error: "not found" }, 404, h);
      const data = String(body.data || "").replace(/^data:image\/\w+;base64,/, "");
      if (data.length < 500) return out({ error: "no image" }, 400, h);
      const r = await core.addReceipt(env, { id: body.id, kind, ref: obj.num, data });
      ctx.waitUntil(flush(env, r.ids));
      return out({ ok: true, dup: !r.created }, 200, h);
    }
    if (route === "notes") { // promotions from the site admin, forwarded by Google Apps Script only
      if (!viaGas) return out({ error: "forbidden" }, 403, h);
      await kvSet(env, "notes", String(body.notes || "").slice(0, 1500)); return out({ ok: true }, 200, h);
    }
    // ---- push notifications for site guests
    if (route === "push/key") return out({ ok: true, key: env.VAPID_PUBLIC || "" }, 200, h);
    if (route === "push/sub") {
      const s = body.sub || {}, ep = String(s.endpoint || "");
      if (!/^https:\/\/[\w.-]+\//.test(ep) || ep.length > 600 || !s.keys?.p256dh || !s.keys?.auth) return out({ error: "bad subscription" }, 400, h);
      await env.DB.prepare(`INSERT INTO push_subs(endpoint,p256dh,auth,cid,lang,created,last_seen,unanswered) VALUES(?,?,?,?,?,?,?,0)
        ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh, auth=excluded.auth, cid=excluded.cid, lang=excluded.lang, last_seen=excluded.last_seen, unanswered=0`)
        .bind(ep, String(s.keys.p256dh).slice(0, 200), String(s.keys.auth).slice(0, 60), String(body.cid || "").slice(0, 40), ["ru", "uz", "en"].includes(body.lang) ? body.lang : "ru", now(), now()).run();
      return out({ ok: true }, 200, h);
    }
    if (route === "push/seen") { // a visit or an opened notification: the guest is active again
      if (body.cid) await env.DB.prepare("UPDATE push_subs SET last_seen=?, unanswered=0, lang=COALESCE(?,lang) WHERE cid=?").bind(now(), ["ru", "uz", "en"].includes(body.lang) ? body.lang : null, String(body.cid).slice(0, 40)).run();
      return out({ ok: true }, 200, h);
    }
    if (route === "push/unsub") { await env.DB.prepare("DELETE FROM push_subs WHERE endpoint=?").bind(String(body.endpoint || "")).run(); return out({ ok: true }, 200, h); }
    if (route === "config") return out({ ok: true, card: { number: await setting(env, "card"), owner: await setting(env, "card_owner") } }, 200, h);

    // ---- admin panel of the site
    if (route === "admin/login") {
      const slot = "loginfail:" + Math.floor(now() / 600000), fails = +(await kvGet(env, slot, "0"));
      if (fails >= 10) return out({ error: "too many attempts, wait 10 minutes" }, 429, h);
      if (!env.ADMIN_PASS || !eq(body.password, env.ADMIN_PASS)) { await kvSet(env, slot, fails + 1); await log(env, "warn", "admin", "wrong password from " + ip); return out({ error: "wrong password" }, 401, h); }
      const token = uid("s") + uid();
      await env.DB.prepare("INSERT INTO sessions(token,who,exp) VALUES(?,?,?)").bind(token, "site-admin", now() + 7 * 864e5).run();
      await log(env, "info", "admin", "login from " + ip);
      return out({ ok: true, token, exp: now() + 7 * 864e5 }, 200, h);
    }
    if (route.startsWith("admin/")) {
      const who = await admin(env, body.token);
      if (!who) return out({ error: "login" }, 401, h);
      if (route === "admin/logout") { await env.DB.prepare("DELETE FROM sessions WHERE token=?").bind(String(body.token)).run(); return out({ ok: true }, 200, h); }
      if (route === "admin/list") {
        const since = now() - Math.min(30, Math.max(1, +body.days || 3)) * 864e5;
        const o = await env.DB.prepare("SELECT num,id,source,type,table_no,name,phone,address,lat,lon,live,live_at,when_txt,pay,pay_status,items,total,note,status,staff_name,test,created,updated FROM orders WHERE created>=? ORDER BY num DESC LIMIT 200").bind(since).all();
        const b = await env.DB.prepare("SELECT num,id,source,name,phone,day,time,guests,zone,note,status,fee,pay_status,staff_name,test,created FROM bookings WHERE created>=? OR day>=? ORDER BY day DESC, time DESC LIMIT 200").bind(since, new Date(since).toISOString().slice(0, 10)).all();
        const rc = await env.DB.prepare("SELECT num,kind,ref,status,created FROM receipts WHERE created>=? ORDER BY num DESC").bind(since).all();
        return out({ ok: true, orders: (o.results || []).map(x => ({ ...x, items: J(x.items, []) })), bookings: b.results || [], receipts: rc.results || [] }, 200, h);
      }
      if (route === "admin/set") {
        const num = +body.num; let r;
        if (body.kind === "booking") r = body.fee != null ? await core.setBookingStatus(env, num, "fee", who, Math.max(0, parseInt(body.fee, 10) || 0)) : body.pay != null ? await core.setPay(env, "booking", num, !!body.pay, who) : await core.setBookingStatus(env, num, String(body.status), who);
        else r = body.pay != null ? await core.setPay(env, "order", num, !!body.pay, who) : await core.setOrderStatus(env, num, String(body.status), who);
        if (r.error) return out({ error: r.error }, 400, h);
        ctx.waitUntil(flush(env, r.ids));
        return out({ ok: true }, 200, h);
      }
      if (route === "admin/receipt") { // the photo itself, for the admin page
        const rc = await env.DB.prepare("SELECT file_id,data FROM receipts WHERE num=?").bind(+body.num).first();
        if (!rc) return out({ error: "not found" }, 404, h);
        if (rc.data) return out({ ok: true, data: "data:image/jpeg;base64," + rc.data }, 200, h);
        const f = await (await import("./tg.js")).tg(env, "getFile", { file_id: rc.file_id });
        if (!f.ok) return out({ error: "telegram" }, 502, h);
        const bin = new Uint8Array(await (await fetch(`${env.TG_API || "https://api.telegram.org"}/file/bot${env.BOT_TOKEN}/${f.result.file_path}`)).arrayBuffer());
        let s = ""; for (let i = 0; i < bin.length; i += 8192) s += String.fromCharCode(...bin.subarray(i, i + 8192));
        return out({ ok: true, data: "data:image/jpeg;base64," + btoa(s) }, 200, h);
      }
    }
    return out({ error: "unknown route" }, 404, h);
  } catch (e) {
    const msg = String(e.message || e);
    if (/bad id|empty order|bad date|bad phone|not found|too big/.test(msg)) return out({ error: msg }, 400, h);
    await log(env, "error", "api." + route, msg + " " + (e.stack || "").slice(0, 300));
    return out({ error: "server" }, 500, h);
  }
}
