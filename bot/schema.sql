-- Olim Polvon bot — D1 schema. Apply: npx wrangler d1 execute olim-bot --remote --file=schema.sql
-- Times are unix ms. Every order/booking has `id` made by the client (site or bot) so a retry never makes a duplicate,
-- and `num` — the short number people say on the phone.

CREATE TABLE IF NOT EXISTS users (
  id INTEGER PRIMARY KEY,            -- Telegram user id
  name TEXT, username TEXT, lang TEXT DEFAULT 'ru',
  role TEXT DEFAULT '',              -- '' guest | orders | bookings | checker | dev
  phone TEXT, notify INTEGER DEFAULT 1,
  state TEXT DEFAULT '{}',           -- current dialog step (checkout, booking…)
  cart TEXT DEFAULT '{}',            -- {dishId: qty}
  hist TEXT DEFAULT '[]',            -- last AI turns
  created INTEGER, seen INTEGER
);

CREATE TABLE IF NOT EXISTS orders (
  num INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT UNIQUE NOT NULL,
  source TEXT,                       -- site | bot
  tg_user INTEGER,                   -- guest in the bot (status messages go there)
  type TEXT,                         -- delivery | pickup | table
  table_no TEXT, name TEXT, phone TEXT, address TEXT,
  lat REAL, lon REAL, live INTEGER DEFAULT 0, live_at INTEGER,
  when_txt TEXT, pay TEXT,           -- cash | card
  pay_status TEXT DEFAULT '',        -- '' | wait | sent | ok | no
  items TEXT, total INTEGER, note TEXT,
  status TEXT DEFAULT 'new',         -- new | accepted | cooking | courier | done | cancelled
  staff INTEGER, staff_name TEXT,     -- who accepted it
  lang TEXT, test INTEGER DEFAULT 0,
  created INTEGER, updated INTEGER
);
CREATE INDEX IF NOT EXISTS orders_created ON orders(created);
CREATE INDEX IF NOT EXISTS orders_user ON orders(tg_user);

CREATE TABLE IF NOT EXISTS bookings (
  num INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT UNIQUE NOT NULL,
  source TEXT, tg_user INTEGER,
  name TEXT, phone TEXT, day TEXT, time TEXT, guests INTEGER, zone TEXT, note TEXT,
  status TEXT DEFAULT 'new',         -- new | confirmed | declined | callback | cancelled | done
  fee INTEGER,                       -- price of the booking, set by staff
  pay_status TEXT DEFAULT '',
  staff INTEGER, staff_name TEXT,
  lang TEXT, test INTEGER DEFAULT 0,
  created INTEGER, updated INTEGER
);
CREATE INDEX IF NOT EXISTS bookings_day ON bookings(day);

CREATE TABLE IF NOT EXISTS receipts (
  num INTEGER PRIMARY KEY AUTOINCREMENT,
  id TEXT UNIQUE NOT NULL,
  kind TEXT, ref INTEGER,            -- order | booking + its num
  file_id TEXT,                      -- Telegram file_id once uploaded
  data TEXT,                         -- base64 JPEG from the site until Telegram has it
  status TEXT DEFAULT 'wait',        -- wait | ok | no
  by INTEGER, created INTEGER
);

-- every message to staff/guests goes through here: sent at once, retried by cron until delivered
CREATE TABLE IF NOT EXISTS outbox (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER, method TEXT, payload TEXT,
  ref TEXT,                          -- 'order:12' / 'booking:3' / 'receipt:5' — to edit the message later
  tries INTEGER DEFAULT 0, next_at INTEGER, status TEXT DEFAULT 'pending', -- pending | sent | failed
  error TEXT, msg_id INTEGER, created INTEGER
);
CREATE INDEX IF NOT EXISTS outbox_due ON outbox(status, next_at);
CREATE INDEX IF NOT EXISTS outbox_ref ON outbox(ref);

CREATE TABLE IF NOT EXISTS invites (code TEXT PRIMARY KEY, role TEXT, by INTEGER, created INTEGER, used_by INTEGER);
CREATE TABLE IF NOT EXISTS sessions (token TEXT PRIMARY KEY, who TEXT, exp INTEGER);
CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT);
CREATE TABLE IF NOT EXISTS logs (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER, level TEXT, src TEXT, msg TEXT);
CREATE INDEX IF NOT EXISTS logs_at ON logs(at);
