// Ёрдамчи's memory about a person — one record shared by the site assistant and the Telegram bot,
// so every AI (Cloudflare, Groq, Gemini) gets the same facts and the same recent conversation.
import { now, J } from "./lib.js";

export const memKey = u => (u.cid ? "c:" + u.cid : "tg:" + u.id);
const clean = a => (Array.isArray(a) ? a : []).filter(x => typeof x === "string" && x.trim()).map(x => x.trim().replace(/[\n\r]/g, " ").slice(0, 80));

export async function memGet(env, key) {
  try {
    const r = await env.DB.prepare("SELECT facts, recent FROM mem WHERE key=?").bind(key).first();
    return { facts: J(r?.facts, []), recent: J(r?.recent, []) };
  } catch (e) { console.log("memGet", String(e)); return { facts: [], recent: [] }; }
}
async function save(env, key, m) {
  await env.DB.prepare("INSERT INTO mem(key,facts,recent,updated) VALUES(?,?,?,?) ON CONFLICT(key) DO UPDATE SET facts=excluded.facts, recent=excluded.recent, updated=excluded.updated")
    .bind(key, JSON.stringify(m.facts.slice(-16)), JSON.stringify(m.recent.slice(-12)), now()).run();
}
// learn / unlearn facts and add the last exchange
export async function memUpdate(env, key, args) {
  try { return await memUpdate_(env, key, args); } catch (e) { console.log("memUpdate", String(e)); }
}
async function memUpdate_(env, key, { remember, forget, turn, src }) {
  const m = await memGet(env, key), n = x => x.toLowerCase();
  const fg = clean(forget).map(n);
  m.facts = m.facts.filter(f => !fg.includes(n(f)));
  for (const f of clean(remember).slice(0, 3)) if (!m.facts.some(x => n(x) === n(f))) m.facts.push(f);
  if (turn) for (const [role, text] of turn) if (text) m.recent.push({ src, role, text: String(text).slice(0, 300), at: now() });
  // the same answer twice in a row is a stuck model — keep only one copy
  m.recent = m.recent.filter((x, i, a) => !(x.role !== "user" && a.slice(Math.max(0, i - 4), i).some(y => y.role !== "user" && y.text === x.text)));
  await save(env, key, m);
  return m;
}
// site sends its whole local memory + its last turns
export async function memFromSite(env, cid, facts, turns) {
  const key = "c:" + cid, m = await memGet(env, key), n = x => x.toLowerCase();
  for (const f of clean(facts).slice(-16)) if (!m.facts.some(x => n(x) === n(f))) m.facts.push(f);
  const site = (Array.isArray(turns) ? turns : []).slice(-6).map(t => ({ src: "site", role: t.role === "me" || t.role === "user" ? "user" : "assistant", text: String(t.text || "").slice(0, 300), at: now() })).filter(t => t.text);
  m.recent = [...m.recent.filter(t => t.src !== "site"), ...site].sort((a, b) => a.at - b.at);
  await save(env, key, m);
  return m;
}
// guest opened the bot from the site: move the bot's memory into the shared one
export async function memLink(env, u, cid) {
  const from = "tg:" + u.id, to = "c:" + cid;
  const a = await memGet(env, from), b = await memGet(env, to), n = x => x.toLowerCase();
  for (const f of a.facts) if (!b.facts.some(x => n(x) === n(f))) b.facts.push(f);
  b.recent = [...b.recent, ...a.recent].sort((x, y) => x.at - y.at);
  await save(env, to, b);
  await env.DB.prepare("DELETE FROM mem WHERE key=?").bind(from).run();
  await env.DB.prepare("UPDATE users SET cid=? WHERE id=?").bind(cid, u.id).run();
  u.cid = cid;
}
export async function memReset(env, key) { await env.DB.prepare("DELETE FROM mem WHERE key=?").bind(key).run(); }

// for the prompt
export function memPrompt(m) {
  const facts = m.facts.length ? m.facts.join("; ") : "пока ничего";
  const recent = m.recent.slice(-8).map(t => `${t.src === "site" ? "[сайт]" : "[telegram]"} ${t.role === "user" ? "гость" : "ты"}: ${t.text}`).join("\n");
  return { facts, recent: recent || "—" };
}
