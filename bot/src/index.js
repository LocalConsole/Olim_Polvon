// Olim Polvon — Telegram bot + site API on one Cloudflare Worker (D1 storage, cron retries).
import { handleUpdate } from "./bot.js";
import { handleApi } from "./api.js";
import { runDue } from "./outbox.js";
import { tg } from "./tg.js";
import { log, now, kvGet, kvSet, localDay, localTime, money, devIds } from "./lib.js";
import { stats, ST_RU, BST_RU } from "./core.js";
import { missYou } from "./push.js";

const COMMANDS = {
  ru: [["menu", "Меню"], ["cart", "Корзина"], ["book", "Бронь стола"], ["my", "Мои заказы"], ["lang", "Язык"]],
  uz: [["menu", "Menyu"], ["cart", "Savat"], ["book", "Stol band qilish"], ["my", "Buyurtmalarim"], ["lang", "Til"]],
  en: [["menu", "Menu"], ["cart", "Cart"], ["book", "Book a table"], ["my", "My orders"], ["lang", "Language"]],
};

// Additions to the database made after the first install. Runs once per Worker instance; "already exists" is fine.
const MIGRATIONS = [
  "CREATE TABLE IF NOT EXISTS mem (key TEXT PRIMARY KEY, facts TEXT DEFAULT '[]', recent TEXT DEFAULT '[]', updated INTEGER)",
  "ALTER TABLE users ADD COLUMN cid TEXT",
  "ALTER TABLE orders ADD COLUMN cid TEXT",
  "ALTER TABLE bookings ADD COLUMN cid TEXT",
  "CREATE TABLE IF NOT EXISTS push_subs (id INTEGER PRIMARY KEY AUTOINCREMENT, endpoint TEXT UNIQUE NOT NULL, p256dh TEXT, auth TEXT, cid TEXT, lang TEXT DEFAULT 'ru', created INTEGER, last_seen INTEGER, last_sent INTEGER, last_miss INTEGER, unanswered INTEGER DEFAULT 0)",
];
let migrated = false;
async function migrate(env) {
  if (migrated) return; migrated = true;
  for (const sql of MIGRATIONS) { try { await env.DB.prepare(sql).run(); } catch (e) { if (!/duplicate column|already exists/i.test(String(e))) console.log("migration", sql, String(e)); } }
}

export default {
  async fetch(req, env, ctx) {
    await migrate(env);
    const u = new URL(req.url);
    if (u.pathname === "/tg" && req.method === "POST") {
      if (!env.WEBHOOK_SECRET || req.headers.get("X-Telegram-Bot-Api-Secret-Token") !== env.WEBHOOK_SECRET) return new Response("forbidden", { status: 403 });
      const upd = await req.json().catch(() => null);
      // answer Telegram at once; the work continues in the background (no repeats of slow updates)
      if (upd) ctx.waitUntil(handleUpdate(env, upd, ctx).catch(e => log(env, "error", "update", (e.stack || String(e)).slice(0, 800))));
      return new Response("ok");
    }
    if (u.pathname.startsWith("/api/") || (req.method === "OPTIONS" && u.pathname.startsWith("/api"))) return handleApi(env, req, ctx, u.pathname);
    if (u.pathname === "/setup" && req.method === "POST") {
      // one-time: curl -X POST https://<worker>/setup -H "X-Site-Key: <SITE_KEY>"
      if (!env.SITE_KEY || req.headers.get("X-Site-Key") !== env.SITE_KEY) return new Response("forbidden", { status: 403 });
      const hook = await tg(env, "setWebhook", { url: u.origin + "/tg", secret_token: env.WEBHOOK_SECRET, allowed_updates: ["message", "edited_message", "callback_query"], drop_pending_updates: false, max_connections: 20 });
      const res = { webhook: hook };
      res.menu_button = await tg(env, "setChatMenuButton", { menu_button: { type: "web_app", text: "Menyu", web_app: { url: (await import("./lib.js")).menuApp(env, "uz") } } });
      for (const [lang, list] of Object.entries(COMMANDS)) res["commands_" + lang] = await tg(env, "setMyCommands", { commands: list.map(([command, description]) => ({ command, description })), ...(lang === "ru" ? {} : { language_code: lang }) });
      return Response.json(res);
    }
    if (u.pathname === "/") return new Response("Olim Polvon bot ✓");
    return new Response("not found", { status: 404 });
  },

  async scheduled(event, env, ctx) {
    try {
      await migrate(env);
      await runDue(env);
      const day = localDay(env), hm = localTime(env);
      // daily report to managers at 23:05 Tashkent
      if (hm >= "23:05" && (await kvGet(env, "report_day")) !== day) {
        await kvSet(env, "report_day", day);
        const s = await stats(env);
        const sum = s.orders.filter(x => x.status !== "cancelled").reduce((a, x) => a + (x.s || 0), 0);
        const text = `📊 <b>Итоги дня ${day}</b>\nЗаказы: ${s.orders.reduce((a, x) => a + x.n, 0)} (${s.orders.map(x => `${ST_RU[x.status]} ${x.n}`).join(", ") || "нет"})\nСумма: ${money(sum)}\nБрони: ${s.bookings.reduce((a, x) => a + x.n, 0)} (${s.bookings.map(x => `${BST_RU[x.status]} ${x.n}`).join(", ") || "нет"})\nЧеков не проверено: ${s.receipts_wait}`;
        const r = await env.DB.prepare("SELECT id FROM users WHERE role='checker' AND notify=1").all();
        for (const id of new Set([...(r.results || []).map(x => x.id)])) await tg(env, "sendMessage", { chat_id: id, text, parse_mode: "HTML" }, { quiet: true });
      }
      // «Ёрдамчи помнит вас» once a day at 12:30 Tashkent
      if (hm >= "12:30" && (await kvGet(env, "miss_day")) !== day) { await kvSet(env, "miss_day", day); const r = await missYou(env); if (r.ok || r.gone) await log(env, "info", "push", `miss-you: sent ${r.ok}, dead ${r.gone}`); }
      // housekeeping once an hour
      if (new Date().getUTCMinutes() === 7) {
        const old = now() - 14 * 864e5;
        await env.DB.batch([
          env.DB.prepare("DELETE FROM logs WHERE at<?").bind(now() - 30 * 864e5),
          env.DB.prepare("DELETE FROM outbox WHERE status='sent' AND created<?").bind(old),
          env.DB.prepare("DELETE FROM sessions WHERE exp<?").bind(now()),
          env.DB.prepare("DELETE FROM kv WHERE k LIKE 'loginfail:%' OR (k LIKE 'table:%' AND json_extract(v,'$.at')<?)").bind(now() - 864e5),
        ]);
      }
    } catch (e) { await log(env, "error", "cron", (e.stack || String(e)).slice(0, 800)); }
  },
};
