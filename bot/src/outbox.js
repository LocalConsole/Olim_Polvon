// Reliable delivery: every message is first written to D1, then sent; the cron retries what failed.
// Why not Queues/Durable Objects: the volume is tiny (a restaurant), D1 already holds the data,
// and a table lets the owner SEE what was not delivered (/undelivered) — a queue would hide it.
import { tg } from "./tg.js";
import { now, J, log, devIds } from "./lib.js";

const BACKOFF = [0.5, 1, 2, 5, 10, 20, 30, 60, 120, 240]; // minutes

export async function enqueue(env, chat_id, method, payload, ref = "") {
  const r = await env.DB.prepare("INSERT INTO outbox(chat_id,method,payload,ref,next_at,created) VALUES(?,?,?,?,?,?) RETURNING id")
    .bind(chat_id, method, JSON.stringify({ ...payload, chat_id }), ref, now(), now()).first();
  return r.id;
}

async function resolvePhoto(env, p) {
  if (typeof p.photo !== "string" || !p.photo.startsWith("receipt:")) return { payload: p };
  const rc = await env.DB.prepare("SELECT num,file_id,data FROM receipts WHERE num=?").bind(+p.photo.slice(8)).first();
  if (!rc) return { payload: { ...p, photo: undefined }, missing: true };
  if (rc.file_id) return { payload: { ...p, photo: rc.file_id } };
  const bytes = Uint8Array.from(atob(rc.data || ""), c => c.charCodeAt(0));
  const { photo, ...rest } = p;
  return { payload: rest, file: { field: "photo", name: `receipt-${rc.num}.jpg`, bytes }, receipt: rc.num };
}

export async function deliver(env, row) {
  let p = J(row.payload, {}), file, receipt;
  if (row.method === "sendPhoto") {
    const r = await resolvePhoto(env, p);
    if (r.missing) { row.method = "sendMessage"; p = { chat_id: p.chat_id, text: p.caption || "чек", parse_mode: "HTML", reply_markup: p.reply_markup }; }
    else ({ payload: p, file, receipt } = r);
  }
  const res = await tg(env, row.method, p, { file, quiet: true });
  if (res.ok) {
    const msg = Array.isArray(res.result) ? res.result[0] : res.result;
    if (receipt && msg?.photo) {
      const fid = msg.photo[msg.photo.length - 1].file_id;
      await env.DB.prepare("UPDATE receipts SET file_id=?, data=NULL WHERE num=?").bind(fid, receipt).run();
    }
    await env.DB.prepare("UPDATE outbox SET status='sent', msg_id=?, tries=tries+1, error=NULL WHERE id=?").bind(msg?.message_id || null, row.id).run();
    return true;
  }
  const code = res.error_code, desc = String(res.description || "");
  const permanent = code === 403 || (code === 400 && /chat not found|user is deactivated|bot was blocked|PEER_ID_INVALID/i.test(desc));
  const tries = (row.tries || 0) + 1;
  const wait = code === 429 ? (+(res.parameters?.retry_after || 5)) * 1000 : (BACKOFF[Math.min(tries - 1, BACKOFF.length - 1)]) * 60e3;
  const failed = permanent || tries >= BACKOFF.length;
  await env.DB.prepare("UPDATE outbox SET tries=?, next_at=?, status=?, error=? WHERE id=?")
    .bind(tries, now() + wait, failed ? "failed" : "pending", `${code} ${desc}`.slice(0, 300), row.id).run();
  if (failed) {
    await log(env, "error", "outbox", `#${row.id} to ${row.chat_id} (${row.ref}) failed: ${code} ${desc}`);
    // tell the managers right away (directly, not through the outbox, so it can't loop)
    const who = await env.DB.prepare("SELECT id FROM users WHERE role IN ('checker','dev') AND id<>?").bind(row.chat_id).all();
    const ids = new Set([...(who.results || []).map(r => r.id), ...devIds(env)]); ids.delete(row.chat_id);
    for (const id of ids) await tg(env, "sendMessage", { chat_id: id, text: `⚠️ Не доставлено сообщение (${row.ref || row.method}) пользователю ${row.chat_id}: ${desc.slice(0, 120)}. Список: /undelivered` }, { quiet: true });
  }
  return false;
}

export async function flush(env, ids) {
  if (!ids?.length) return;
  const rows = await env.DB.prepare(`SELECT * FROM outbox WHERE id IN (${ids.map(() => "?").join(",")}) AND status='pending' ORDER BY id`).bind(...ids).all();
  for (const r of rows.results || []) await deliver(env, r);
}

export async function runDue(env, limit = 40) {
  const rows = await env.DB.prepare("SELECT * FROM outbox WHERE status='pending' AND next_at<=? ORDER BY id LIMIT ?").bind(now(), limit).all();
  for (const r of rows.results || []) await deliver(env, r);
  return (rows.results || []).length;
}

// messages already sent for an object (to edit them when its status changes)
export async function sentFor(env, ref) {
  const r = await env.DB.prepare("SELECT id, chat_id, msg_id, method FROM outbox WHERE ref=? AND status='sent' AND msg_id IS NOT NULL").bind(ref).all();
  return r.results || [];
}
