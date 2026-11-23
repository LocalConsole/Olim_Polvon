// Small helpers shared by every module.
export const now = () => Date.now();
export const esc = s => String(s ?? "").replace(/[&<>]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
export const money = (n, lang = "ru") => n == null ? "—" : n.toLocaleString("ru-RU").replace(/\s/g, " ") + (lang === "uz" ? " so'm" : lang === "en" ? " UZS" : " сум");
export const uid = (p = "") => p + crypto.randomUUID().replace(/-/g, "").slice(0, 16);
export const J = (s, d) => { try { return s ? JSON.parse(s) : d; } catch { return d; } };

// Tashkent local date helpers (Workers run in UTC)
export const tz = env => (+(env.TZ_OFFSET || 5)) * 3600e3;
export const localDay = (env, t = now(), add = 0) => new Date(t + tz(env) + add * 864e5).toISOString().slice(0, 10);
export const localTime = (env, t = now()) => new Date(t + tz(env)).toISOString().slice(11, 16);
export const dayStart = (env, t = now()) => { const d = localDay(env, t); return Date.parse(d + "T00:00:00Z") - tz(env); };

export async function kvGet(env, k, d = null) { const r = await env.DB.prepare("SELECT v FROM kv WHERE k=?").bind(k).first(); return r ? r.v : d; }
export async function kvSet(env, k, v) { await env.DB.prepare("INSERT INTO kv(k,v) VALUES(?,?) ON CONFLICT(k) DO UPDATE SET v=excluded.v").bind(k, String(v)).run(); }

export async function log(env, level, src, msg) {
  try {
    console.log(level, src, msg);
    await env.DB.prepare("INSERT INTO logs(at,level,src,msg) VALUES(?,?,?,?)").bind(now(), level, src, String(msg).slice(0, 1500)).run();
  } catch (e) { console.log("log failed", e); }
}

// the site / Mini App address for a language
export const siteUrl = (env, lang = "ru", page = "") => (env.SITE_URL || "https://localconsole.github.io/Olim_Polvon/") + (lang && lang !== "ru" ? lang + "/" : "") + page;
export const menuApp = (env, lang) => siteUrl(env, lang, "menu.html?tg=1");

// Telegram Mini App: initData is signed with the bot token (HMAC-SHA256, key = HMAC("WebAppData", token)). Returns the user or null.
export async function tgWebAppUser(env, initData) {
  try {
    const q = new URLSearchParams(String(initData || "")), hash = q.get("hash"); if (!hash || !env.BOT_TOKEN) return null;
    q.delete("hash");
    const check = [...q.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => k + "=" + v).join("\n");
    const enc = new TextEncoder(), hmac = async (key, data) => new Uint8Array(await crypto.subtle.sign("HMAC", await crypto.subtle.importKey("raw", key, { name: "HMAC", hash: "SHA-256" }, false, ["sign"]), enc.encode(data)));
    const secret = await hmac(enc.encode("WebAppData"), env.BOT_TOKEN);
    const sig = [...await hmac(secret, check)].map(b => b.toString(16).padStart(2, "0")).join("");
    if (sig !== hash) return null;
    if (Date.now() / 1000 - (+q.get("auth_date") || 0) > 7 * 86400) return null;   // a week-old session is not trusted
    return JSON.parse(q.get("user") || "null");
  } catch { return null; }
}

export const devIds = env => String(env.DEV_IDS || "").split(/[\s,]+/).map(Number).filter(Boolean);

// Settings the owner will give later; until then safe placeholders
export const SETTINGS = {
  card: ["card_number", "8600 0000 0000 0000 (номер карты уточняется)"],
  card_owner: ["card_owner", "Olim Polvon"],
  booking_fee: ["booking_fee", ""],          // '' = staff names the price per booking
  delivery_info: ["delivery_info", "Стоимость доставки назовёт администратор."],
  tables: ["tables", "30"],
};
export async function setting(env, key) { const [k, d] = SETTINGS[key]; return kvGet(env, k, d); }

// Russian keys typed with the English layout and the other way round: "vtyb" -> "меню", "ьутг" -> "menu"
const EN = "qwertyuiop[]asdfghjkl;'zxcvbnm,.`", RU = "йцукенгшщзхъфывапролджэячсмитьбюё";
export function layoutFix(text) {
  const t = String(text || "");
  const lat = (t.match(/[a-z]/gi) || []).length, cyr = (t.match(/[а-яё]/gi) || []).length;
  const map = (s, from, to) => [...s].map(ch => { const lo = ch.toLowerCase(), i = from.indexOf(lo); if (i < 0) return ch; const r = to[i]; return ch === lo ? r : r.toUpperCase(); }).join("");
  if (lat && !cyr) return map(t, EN, RU);
  if (cyr && !lat) return map(t, RU, EN);
  return "";
}
// Does a latin string look like Uzbek/English rather than Russian typed in the wrong layout?
export function looksLatinLang(t) {
  const w = t.toLowerCase();
  return /[aeiouy]/.test(w) && !/[;\[\]'`,.]{1}[a-z]/.test(w) && (w.match(/[aeiou]/g) || []).length / Math.max(1, (w.match(/[a-z]/g) || []).length) > 0.28;
}
