// Telegram Bot API calls. TG_API can point to a mock server for local tests.
import { log } from "./lib.js";

const base = env => (env.TG_API || "https://api.telegram.org") + "/bot" + env.BOT_TOKEN + "/";

// returns {ok, result, error_code, description, parameters}
export async function tg(env, method, payload = {}, opts = {}) {
  let body, headers = {};
  if (opts.file) {               // multipart upload: opts.file = {field, name, bytes, type}
    body = new FormData();
    for (const [k, v] of Object.entries(payload)) if (v != null) body.append(k, typeof v === "object" ? JSON.stringify(v) : String(v));
    body.append(opts.file.field, new Blob([opts.file.bytes], { type: opts.file.type || "image/jpeg" }), opts.file.name || "photo.jpg");
  } else { body = JSON.stringify(payload); headers["Content-Type"] = "application/json"; }
  try {
    const r = await fetch(base(env) + method, { method: "POST", headers, body, signal: AbortSignal.timeout(opts.timeout || 10000) });
    const d = await r.json().catch(() => ({ ok: false, error_code: r.status, description: "bad json" }));
    if (!d.ok && !opts.quiet && !/message is not modified|query is too old/.test(d.description || "")) await log(env, "warn", "tg." + method, `${d.error_code} ${d.description}`);
    return d;
  } catch (e) {
    if (!opts.quiet) await log(env, "error", "tg." + method, String(e));
    return { ok: false, error_code: 0, description: String(e) };
  }
}

export const send = (env, chat_id, text, kb, extra = {}) =>
  tg(env, "sendMessage", { chat_id, text, parse_mode: "HTML", disable_web_page_preview: true, ...(kb ? { reply_markup: kb } : {}), ...extra });
export const edit = (env, chat_id, message_id, text, kb) =>
  tg(env, "editMessageText", { chat_id, message_id, text, parse_mode: "HTML", disable_web_page_preview: true, ...(kb ? { reply_markup: kb } : {}) }, { quiet: true });
export const answer = (env, id, text, alert = false) => tg(env, "answerCallbackQuery", { callback_query_id: id, ...(text ? { text, show_alert: alert } : {}) }, { quiet: true });

// keyboards
export const ik = rows => ({ inline_keyboard: rows.filter(r => r && r.length) });
export const btn = (text, data) => ({ text, callback_data: String(data).slice(0, 64) });
export const url = (text, u) => ({ text, url: u });
export const reply = (rows, extra = {}) => ({ keyboard: rows, resize_keyboard: true, ...extra });
export const noKb = { remove_keyboard: true };
