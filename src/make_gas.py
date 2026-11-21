"""Builds worker/Code.gs: the same AI middleman as worker.js, for Google Apps Script
(script.google.com is reachable from Uzbek networks where *.workers.dev is not)."""
import re, pathlib
w = (pathlib.Path(__file__).parent.parent / "worker" / "worker.js").read_text(encoding="utf-8")
SYSTEM = re.search(r'^const SYSTEM = (".*?");$', w, re.M | re.S).group(1)
TONES = re.search(r'^const TONES = (\{.*?\});$', w, re.M).group(1)
ADMIN = re.search(r'^const ADMIN = (".*?");$', w, re.M | re.S).group(1)
gas = r'''// Olim Polvon — AI middleman for Google Apps Script (backup to the Cloudflare Worker).
// Project Settings → Script Properties: AI_KEY = Gemini key, GROQ_KEY = Groq key.
// Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
// Orders/bookings relay to the bot (workers.dev is blocked in Uzbekistan, script.google.com is not):
//   BOT_URL = https://olim-bot.<account>.workers.dev   SITE_KEY = the same value as `wrangler secret put SITE_KEY`
const SYSTEM = __SYSTEM__;
const TONES = __TONES__;
const ADMIN = __ADMIN__;
// Google keeps the admin's promotions itself, so here they never come from the visitor
const NOTES_OF = () => { const n = PropertiesService.getScriptProperties().getProperty("NOTES") || ""; return n.trim() ? n.slice(0, 1500).replace(/[\r\n]+/g, " | ") : "сейчас нет"; };

function doGet() { return out_({ ok: true, hint: "POST only" }); }

function doPost(e) {
  try { return out_(handle_(JSON.parse(e.postData.contents || "{}"))); }
  catch (err) { return out_({ error: "bad request", detail: String(err).slice(0, 200) }); }
}

function out_(obj) { return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON); }

// site → Google → bot Worker. Returns the Worker's JSON as is; one quick retry on a 5xx/network error.
function relay_(P, body) {
  const url = P.getProperty("BOT_URL"), key = P.getProperty("SITE_KEY");
  if (!url || !key) return { error: "relay not configured" };
  const route = String(body.api || "").replace(/[^a-z\/]/g, "").slice(0, 30);
  const payload = Object.assign({}, body.payload || {}, { _ip: String(body.payload && body.payload._ip || "") });
  for (let i = 0; i < 2; i++) {
    try {
      const r = UrlFetchApp.fetch(url.replace(/\/$/, "") + "/api/" + route, { method: "post", contentType: "application/json", headers: { "X-Site-Key": key }, payload: JSON.stringify(payload), muteHttpExceptions: true });
      const code = r.getResponseCode();
      if (code >= 500 && i === 0) { Utilities.sleep(500); continue; }
      let j; try { j = JSON.parse(r.getContentText()); } catch (x) { j = { error: "bad reply", detail: r.getContentText().slice(0, 200) }; }
      j._status = code; return j;
    } catch (e) { if (i) return { error: "relay", detail: String(e).slice(0, 200) }; Utilities.sleep(500); }
  }
  return { error: "relay" };
}

function post_(url, headers, body) {
  const r = UrlFetchApp.fetch(url, { method: "post", contentType: "application/json", headers: headers, payload: JSON.stringify(body), muteHttpExceptions: true });
  return { status: r.getResponseCode(), text: r.getContentText(), retry: +(r.getHeaders()["Retry-After"] || r.getHeaders()["retry-after"] || 0) };
}

function handle_(body) {
  const P = PropertiesService.getScriptProperties();
  const AI_KEY = P.getProperty("AI_KEY"), GROQ_KEY = P.getProperty("GROQ_KEY"), MODEL = P.getProperty("MODEL"), GROQ_MODEL = P.getProperty("GROQ_MODEL");

  if (body.api) return relay_(P, body);

  // ---- promotions / news written by the admin, shared by everyone ----
  if (body.action === "notes_get") return { notes: P.getProperty("NOTES") || "", updated: P.getProperty("NOTES_AT") || "" };
  if (body.action === "notes_set") {
    const c = CacheService.getScriptCache(); const tries = +(c.get("bad_pw") || 0);
    if (tries >= 5) return { error: "too many attempts, wait 10 minutes" };
    const pass = P.getProperty("ADMIN_PASS") || "129091";
    if (String(body.password || "") !== pass) { c.put("bad_pw", String(tries + 1), 600); return { error: "wrong password" }; }
    const notes = String(body.notes || "").slice(0, 1500);
    P.setProperty("NOTES", notes); P.setProperty("NOTES_AT", new Date().toISOString());
    if (P.getProperty("BOT_URL")) relay_(P, { api: "notes", payload: { notes: notes } });   // the bot's assistant tells guests the same promotions
    return { ok: true, notes: notes };
  }

  if (!AI_KEY && !GROQ_KEY) return { error: "AI_KEY is not set" };

  // simple global limit: 60 requests per minute for the whole site
  const cache = CacheService.getScriptCache(); const slot = "m" + Math.floor(Date.now() / 60000);
  const used = +(cache.get(slot) || 0); if (used > 60) return { error: "busy", retryAfter: 30 }; cache.put(slot, String(used + 1), 120);

  const msgs = (Array.isArray(body.messages) ? body.messages : []).slice(-10)
    .filter(m => m && typeof m.text === "string" && m.text.trim())
    .map(m => ({ role: m.role === "bot" ? "model" : "user", parts: [{ text: m.text.slice(0, 600) }] }));
  if (!msgs.length || msgs[msgs.length - 1].role !== "user") return { error: "no question" };

__CORE__
}
'''
# reuse the language/prompt/provider logic from the worker verbatim, adapted to UrlFetchApp
core = re.search(r'    const last = msgs\[msgs.length - 1\]\.parts\[0\]\.text;.*?const NOTE = .*?msgs\[msgs.length - 1\] = \{[^\n]*\n', w, re.S).group(0)
core += r'''    let raw = "", err = "", provider = "", retryAfter = 0, limited = false;
    if (AI_KEY) {
      const tries = [];
      [MODEL, "gemini-3.5-flash-lite", "gemini-flash-latest"].filter(Boolean).forEach(model =>
        [{ thinkingLevel: "minimal" }, { thinkingBudget: 0 }, null].forEach(think => tries.push({ model: model, think: think })));
      const okRaw = cache.get("gem_ok"); const ok = okRaw ? JSON.parse(okRaw) : null;
      const order = ok ? [ok].concat(tries) : tries;
      let r;
      for (const t of order) {
        const payload = { systemInstruction: { parts: [{ text: SYS }] }, contents: msgs, generationConfig: { temperature: 0.7, maxOutputTokens: 900, responseMimeType: "application/json" } };
        if (t.think) payload.generationConfig.thinkingConfig = t.think;
        r = post_("https://generativelanguage.googleapis.com/v1beta/models/" + t.model + ":generateContent", { "x-goog-api-key": AI_KEY }, payload);
        if (r.status === 200) { cache.put("gem_ok", JSON.stringify(t), 21600); break; }
        if ([400, 404].indexOf(r.status) < 0) break;
      }
      if (r.status === 200) { const d = JSON.parse(r.text); raw = ((d.candidates || [])[0]?.content?.parts || []).map(p => p.text || "").join(""); if (raw) provider = "gemini"; }
      else { err = "gemini " + r.status + ": " + r.text.slice(0, 200); if (r.status === 429) { limited = true; retryAfter = r.retry; } }
    }
    if (!raw && GROQ_KEY) {
      const chat = [{ role: "system", content: SYS }].concat(msgs.map(m => ({ role: m.role === "model" ? "assistant" : "user", content: m.parts[0].text })));
      for (const model of [GROQ_MODEL, "openai/gpt-oss-120b", "qwen/qwen3.8-27b", "openai/gpt-oss-20b"].filter(Boolean)) {
        const extra = model.indexOf("openai/") === 0 ? { reasoning_effort: "low" } : model.indexOf("qwen/") === 0 ? { reasoning_format: "hidden" } : {};
        const g = post_("https://api.groq.com/openai/v1/chat/completions", { Authorization: "Bearer " + GROQ_KEY },
          Object.assign({ model: model, messages: chat, temperature: 0.7, max_tokens: 900, response_format: { type: "json_object" } }, extra));
        if (g.status === 200) { const d = JSON.parse(g.text); raw = (d.choices || [])[0]?.message?.content || ""; if (raw) { provider = "groq"; break; } continue; }
        if (g.status === 429) { limited = true; retryAfter = Math.max(retryAfter, Math.ceil(g.retry || 0)); }
        err += " | groq " + g.status + ": " + g.text.slice(0, 160);
        if ([400, 404, 429].indexOf(g.status) < 0) break;
      }
    }
    if (!raw && limited) return { error: "busy", retryAfter: Math.min(60, Math.max(5, retryAfter || 20)) };
    if (!raw) return { error: "ai unavailable", detail: err.slice(0, 400) };
    let o; try { o = JSON.parse(raw); } catch (x) { o = { reply: raw.replace(/[{}"]/g, "").trim(), dishes: [] }; }
    const clean = a => (Array.isArray(a) ? a : []).filter(x => typeof x === "string" && x.trim()).slice(0, 3).map(x => x.trim().slice(0, 80));
    const goList = (Array.isArray(o.go) ? o.go : o.go ? [o.go] : []).filter(g => g && typeof g === "object" && ["edit", "add", "tab"].indexOf(g.to) >= 0).slice(0, 3)
      .map(g => ({ to: g.to, dish: String(g.dish || "").slice(0, 80), cat: String(g.cat || "").slice(0, 20), tab: String(g.tab || "").slice(0, 20) }));
    const go = body.admin && goList.length ? goList : null;
    return { reply: String(o.reply || "").slice(0, 900), go: go, dishes: Array.isArray(o.dishes) ? o.dishes.slice(0, 4) : [], remember: clean(o.remember), forget: clean(o.forget), provider: provider, switched: provider === "groq" && !!AI_KEY };
'''
gas = gas.replace("__ADMIN__", ADMIN).replace("__SYSTEM__", SYSTEM).replace("__TONES__", TONES).replace("__CORE__", core)
(pathlib.Path(__file__).parent.parent / "worker" / "Code.gs").write_text(gas, encoding="utf-8")
print("Code.gs", len(gas))
