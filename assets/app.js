/* Olim Polvon — interactions. Vanilla JS, no dependencies.
   Motion: WAAPI + CSS transitions on transform/opacity/clip-path (Emil Kowalski rules). */
(() => {
  'use strict';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const root = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = matchMedia('(hover: hover) and (pointer: fine)').matches;
  const EASE = 'cubic-bezier(0.23, 1, 0.32, 1)';
  const SPRING = getComputedStyle(root).getPropertyValue('--spring').trim() || EASE;
  const SPRING_SOFT = getComputedStyle(root).getPropertyValue('--spring-soft').trim() || EASE;

  const store = {
    get(k, d) { try { const v = localStorage.getItem('polvon_' + k); return v ? JSON.parse(v) : d; } catch { return d; } },
    set(k, v) { try { localStorage.setItem('polvon_' + k, JSON.stringify(v)); } catch {} },
    del(k) { try { localStorage.removeItem('polvon_' + k); } catch {} },
  };
  const LANG = (root.lang || 'ru').slice(0, 2);
  const I18N = window.POLVON_I18N || {};
  const tt = s => (LANG !== 'ru' && I18N[s]) || s;
  const LOCALE = { ru: 'ru-RU', uz: 'uz-Latn-UZ', en: 'en-GB' }[LANG] || 'ru-RU';
  const CUR = { ru: 'сум', uz: "so'm", en: 'UZS' }[LANG] || 'сум';
  const fmt = n => n.toLocaleString('ru-RU').replace(/\s/g, '\u202f') + '\u00a0' + CUR;
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function toast(text) {
    const host = $('.toast-host'); if (!host) return;
    const t = document.createElement('div'); t.className = 'toast'; t.textContent = text; host.append(t);
    setTimeout(() => { t.classList.add('is-out'); setTimeout(() => t.remove(), 220); }, 2600);
  }

  /* ---------------- menu data (+ admin overrides) ---------------- */
  const BASE_MENU = (() => { try { return JSON.parse($('#menu-data').textContent); } catch { return []; } })();
  const CAT_TITLES = Object.fromEntries(BASE_MENU.map(d => [d.cat, d.catTitle]));
  function getMenu() {
    const ov = store.get('menu', {});
    const custom = store.get('custom', []).map(d => ({ ...d, tags: d.tags || [], catTitle: CAT_TITLES[d.cat] || d.cat, custom: true }));
    return [...BASE_MENU, ...custom].filter(d => !(ov[d.id] || {}).deleted).map(d => {
      const o = ov[d.id] || {};
      const tags = d.tags.filter(t => t !== 'hit');
      const hit = o.hit !== undefined ? o.hit : d.tags.includes('hit');
      const cat = o.cat || d.cat;
      return { ...d, cat, catTitle: CAT_TITLES[cat] || d.catTitle, price: o.price ?? d.price, stop: !!o.stop, tags: hit ? ['hit', ...tags] : tags };
    });
  }
  function setOverride(id, patch) {
    const ov = store.get('menu', {}); ov[id] = { ...(ov[id] || {}), ...patch }; store.set('menu', ov);
  }

  /* ---------------- header ---------------- */
  const header = $('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('is-stuck', scrollY > 8);
    addEventListener('scroll', onScroll, { passive: true }); onScroll();
  }
  const toggle = $('.menu-toggle'), nav = $('#site-nav');
  if (toggle && nav) {
    const set = open => {
      toggle.setAttribute('aria-expanded', String(open));
      toggle.setAttribute('aria-label', open ? tt('Закрыть меню') : tt('Открыть меню'));
      nav.classList.toggle('is-open', open); document.body.classList.toggle('nav-open', open);
    };
    toggle.addEventListener('click', () => set(toggle.getAttribute('aria-expanded') !== 'true'));
    nav.addEventListener('click', e => { if (e.target.closest('a')) set(false); });
    addEventListener('keydown', e => { if (e.key === 'Escape' && nav.classList.contains('is-open')) { set(false); toggle.focus(); } });
  }

  /* ---------------- admin mode ---------------- */
  // Demo only: a client-side password is not security. The real panel checks it on the server (Cloudflare Worker).
  async function checkPass(p) {
    if (window.crypto?.subtle) {
      const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(p));
      const hex = Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, '0')).join('');
      return hex === ADMIN_SHA256;
    }
    return false; // no Web Crypto: refuse instead of comparing in plain text
  }
  const ADMIN_SHA256 = 'b5dd70130a443b64711dc3a210b238d7b272b49324fd8da5e798887f8543943e';
  const isAdmin = () => root.classList.contains('is-admin');
  function setAdmin(on) {
    try { on ? sessionStorage.setItem('polvon_admin', '1') : sessionStorage.removeItem('polvon_admin'); } catch {}
    root.classList.toggle('is-admin', on);
    document.dispatchEvent(new CustomEvent('admin-change', { detail: on }));
  }
  const modal = $('#staff-modal');
  $$('[data-staff-login]').forEach(b => b.addEventListener('click', () => {
    if (isAdmin()) { location.href = 'admin.html'; return; }
    modal?.showModal(); setTimeout(() => $('#staff-pass')?.focus(), 30);
  }));
  modal?.querySelector('[data-close]')?.addEventListener('click', () => modal.close());
  modal?.addEventListener('click', e => { if (e.target === modal) modal.close(); });
  const loginForm = $('[data-login-form]');
  async function handleLogin(form, input, after) {
    const err = form.querySelector('.err');
    if (await checkPass(input.value)) {
      setAdmin(true); err.textContent = ''; input.value = '';
      after?.(); toast(tt('Режим администратора включён'));
    } else {
      err.textContent = input.value ? tt('Неверный пароль. Попробуйте ещё раз.') : tt('Введите пароль.');
      form.classList.remove('shake'); void form.offsetWidth; form.classList.add('shake');
      input.select();
    }
  }
  loginForm?.addEventListener('submit', e => { e.preventDefault(); handleLogin(loginForm, $('#staff-pass'), () => modal.close()); });
  $$('[data-logout]').forEach(b => b.addEventListener('click', () => {
    setAdmin(false); toast(tt('Вы вышли из режима администратора'));
    if (root.dataset.page === 'admin') setTimeout(() => location.href = 'index.html', 500);
  }));

  /* ---------------- photo reveals (clip-path, once) ---------------- */
  const reveals = $$('.reveal');
  if (reveals.length && 'IntersectionObserver' in window && !reduce) {
    const delays = [0, 80, 140, 190];
    const io = new IntersectionObserver(entries => entries.forEach(en => {
      if (!en.isIntersecting) return;
      const el = en.target; const sibs = $$(':scope > .reveal, :scope > * > .reveal', el.parentElement.closest('.strip, .sig-grid, .about-pair') || el.parentElement);
      const i = Math.max(0, sibs.indexOf(el));
      el.style.transitionDelay = (delays[i] ?? i * 50) + 'ms';
      el.classList.add('is-in'); io.unobserve(el);
      setTimeout(() => { el.style.transitionDelay = ''; }, 1600);
    }), { rootMargin: '0px 0px -12% 0px' });
    reveals.forEach(r => io.observe(r));
  } else reveals.forEach(r => r.classList.add('is-in'));

  /* ---------------- HOME: hero entrance + dastarkhan ---------------- */
  const hero = $('.hero');
  if (hero) {
    const lines = $$('.line > span', hero);
    const disc = $('.table-disc', hero);
    const plates = $$('.orbit .plate-inner', hero);
    const center = $('.plate--center .plate-inner', hero);
    const enters = $$('[data-enter]', hero);
    const orbit = $('.orbit', hero);
    const finish = () => root.classList.add('entered');
    const startHero = () => {
    if (reduce || !hero.animate) { finish(); }
    else {
      orbit.style.setProperty('--spin-state', 'paused');
      const anims = [];
      const go = (el, kf, opt) => el && anims.push(el.animate(kf, { fill: 'both', ...opt }));
      lines.forEach((el, i) => go(el, [{ transform: 'translateY(105%)' }, { transform: 'none' }], { duration: 900, delay: [60, 150, 220][i] ?? 0, easing: EASE }));
      go(disc, [{ opacity: 0, transform: 'scale(.92) rotate(-8deg)' }, { opacity: 1, transform: 'none' }], { duration: 1100, delay: 100, easing: EASE });
      go(center, [{ opacity: 0, transform: 'scale(.6)' }, { opacity: 1, transform: 'none' }], { duration: 900, delay: 320, easing: SPRING });
      // plates are "set down" on the table one after another, gaps shrinking: 460, 560, 640, 700ms
      [460, 560, 640, 700].forEach((d, i) => go(plates[i], [{ opacity: 0, transform: 'translateY(-18%) scale(1.2)' }, { opacity: 1, transform: 'none' }], { duration: 950, delay: d, easing: SPRING }));
      enters.forEach((el, i) => go(el, [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }], { duration: 700, delay: [300, 380, 440, 1100][i] ?? 400, easing: EASE }));
      Promise.all(anims.map(a => a.finished)).then(() => {
        finish(); anims.forEach(a => { try { a.commitStyles?.(); } catch {} a.cancel(); });
        $$('.plate-inner, .line > span, .table-disc, [data-enter]', hero).forEach(el => { el.style.opacity = ''; el.style.transform = ''; });
        orbit.style.removeProperty('--spin-state');
      }).catch(finish);
      setTimeout(finish, 3500); // safety net
    }
    };
    // intro on the first visit of the session: mark draws, name rises, curtain lifts, then the hero enters
    const intro = $('[data-intro]');
    if (intro && !root.classList.contains('no-intro')) {
      document.body.style.overflow = 'hidden';
      let gone = false;
      const leave = () => {
        if (gone) return; gone = true;
        try { sessionStorage.setItem('polvon_intro', '1'); } catch {}
        intro.classList.add('is-leaving');
        setTimeout(startHero, 380);
        setTimeout(() => { intro.remove(); document.body.style.overflow = ''; }, 850);
      };
      intro.addEventListener('click', leave);
      setTimeout(leave, 1750);
    } else { intro?.remove(); startHero(); }

    // caption: blur crossfade between dish names
    const cap = $('[data-caption]', hero);
    if (!finePointer && cap) cap.textContent = tt('Нажмите на блюдо');
    let capTimer;
    const showDish = btn => {
      const html = `<b>${esc(btn.dataset.dish)}</b> · ${esc(btn.dataset.price)}`;
      if (cap.innerHTML === html) return;
      clearTimeout(capTimer); cap.classList.add('is-swapping');
      capTimer = setTimeout(() => { cap.innerHTML = html; cap.classList.remove('is-swapping'); }, 160);
    };
    $$('.plate', hero).forEach(p => {
      p.addEventListener('pointerenter', () => showDish(p));
      p.addEventListener('focus', () => showDish(p));
      p.addEventListener('click', () => { showDish(p); if (!finePointer) return; location.href = 'menu.html'; });
    });

    // pause / play: the loop runs past 5 s, so it gets a control. Also pauses itself off-screen.
    const spin = $('[data-spin]', hero);
    let userPaused = false;
    const applyPause = (p) => document.body.classList.toggle('is-paused', p);
    spin?.addEventListener('click', () => {
      userPaused = !userPaused; applyPause(userPaused);
      spin.setAttribute('aria-pressed', String(userPaused));
      spin.setAttribute('aria-label', userPaused ? tt('Запустить вращение') : tt('Остановить вращение'));
      spin.querySelector('use').setAttribute('href', userPaused ? '#i-play' : '#i-pause');
    });
    if ('IntersectionObserver' in window) {
      new IntersectionObserver(([e]) => { if (!userPaused) applyPause(!e.isIntersecting); }).observe(hero);
    }

    // pointer parallax with a spring-like lerp (decorative, marketing page)
    const table = $('[data-table-inner]', hero);
    if (finePointer && !reduce && table) {
      let tx = 0, ty = 0, x = 0, y = 0, raf = 0;
      const loop = () => {
        x += (tx - x) * 0.08; y += (ty - y) * 0.08;
        table.style.transform = `translate3d(${x.toFixed(2)}px, ${y.toFixed(2)}px, 0)`;
        if (Math.abs(tx - x) > 0.05 || Math.abs(ty - y) > 0.05) raf = requestAnimationFrame(loop); else raf = 0;
      };
      hero.addEventListener('pointermove', e => {
        const r = hero.getBoundingClientRect();
        tx = ((e.clientX - r.left) / r.width - 0.5) * 18; ty = ((e.clientY - r.top) / r.height - 0.5) * 14;
        if (!raf) raf = requestAnimationFrame(loop);
      });
      hero.addEventListener('pointerleave', () => { tx = 0; ty = 0; if (!raf) raf = requestAnimationFrame(loop); });
    }
  }

  /* ---------------- category list: a fixed card beside the list shows the hovered section ---------------- */
  const cats = $('[data-cats]'), card = $('[data-cat-card]');
  if (cats && card) {
    const imgs = $$('img[data-for]', card), title = $('[data-cat-card-title]', card), count = $('[data-cat-card-count]', card);
    const rows = $$('a[data-cat]', cats);
    const show = a => {
      rows.forEach(r => r.parentElement.classList.toggle('is-current', r === a));
      imgs.forEach(im => im.classList.toggle('is-on', im.dataset.for === a.dataset.cat));
      if (title.textContent !== a.dataset.title) {
        title.textContent = a.dataset.title; count.textContent = a.dataset.count;
        if (!reduce) title.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 260, easing: EASE });
      }
    };
    rows.forEach(a => { a.addEventListener('pointerenter', () => show(a)); a.addEventListener('focus', () => show(a)); });
    show(rows[0]);
  }

  /* ---------------- word highlight moment ---------------- */
  const words = $('[data-words]');
  if (words) {
    const ws = $$('.w', words);
    if (reduce) words.classList.add('static');
    else {
      let ticking = false;
      const update = () => {
        ticking = false;
        const r = words.getBoundingClientRect(); const vh = innerHeight;
        const p = Math.min(1, Math.max(0, (vh * 0.85 - r.top) / (r.height + vh * 0.35)));
        const n = Math.round(p * ws.length);
        ws.forEach((w, i) => w.classList.toggle('on', i < n));
      };
      addEventListener('scroll', () => { if (!ticking) { ticking = true; requestAnimationFrame(update); } }, { passive: true });
      update();
    }
  }

  /* ---------------- AI assistant (demo, scripted) ---------------- */
  const panel = $('#ai-panel');
  const msgs = $('[data-ai-msgs]'), chipsBox = $('[data-ai-chips]'), aiForm = $('[data-ai-form]'), aiInput = $('#ai-input'), ava = $('[data-ai-ava]');
  const AI_DEFAULTS = { greeting: tt('Ассалому алайкум! Я Ёрдамчи, AI-помощник Olim Polvon. Подскажу по меню, подберу блюда, расскажу про доставку и помогу забронировать стол.'), tone: 'warm' };
  const settings = () => { const s = { ...AI_DEFAULTS, ...store.get('ai', {}) }; if (!s.greeting) s.greeting = AI_DEFAULTS.greeting; return s; };
  let busy = false, greeted = false, lastFocus = null;
  const CHIPS = [tt('Что попробовать впервые?'), tt('Стол на 4 человека'), tt('Удиви меня'), tt('Недорого и сытно'), tt('Мой заказ'), tt('Доставка'), tt('Поострее'), tt('Забронировать стол')];

  /* ---- order basket (kept on this device) ---- */
  const TABLE_ID = () => { try { return new URLSearchParams(location.search).get('table') || sessionStorage.getItem('polvon_table') || ''; } catch { return ''; } };
  const cart = {
    get: () => store.get('cart', {}),
    set(c) { store.set('cart', c); renderCartBar(); window.dispatchEvent(new Event('polvon-cart')); },
    add(id, n = 1) { const c = cart.get(); c[id] = Math.max(0, (c[id] || 0) + n); if (!c[id]) delete c[id]; cart.set(c); },
    clear() { cart.set({}); },
    lines() { const m = getMenu(), c = cart.get(); return Object.entries(c).map(([id, q]) => ({ d: m.find(x => x.id === id), q })).filter(l => l.d); },
    total() { return cart.lines().reduce((s, l) => s + (l.d.price || 0) * l.q, 0); },
    count() { return cart.lines().reduce((s, l) => s + l.q, 0); },
  };
  const cartBar = $('[data-ai-cart]');
  function renderCartBar() {
    if (!cartBar) return;
    const n = cart.count();
    const row = cartBar.closest('[data-ai-cart-row]') || cartBar; row.hidden = !n;
    if (n) { $('[data-ai-cart-sum]', cartBar).textContent = `${n} ${tt('шт.')} · ${fmt(cart.total())}`; cartBar.classList.remove('bump'); void cartBar.offsetWidth; cartBar.classList.add('bump'); }
  }
  cartBar?.addEventListener('click', () => ask(tt('Мой заказ')));
  $('[data-ai-cart-clear]')?.addEventListener('click', () => { cart.clear(); $$('.ai-order').forEach(o => o.innerHTML = `<p>${esc(tt('Заказ отменён.'))}</p>`); toast(tt('Заказ отменён')); });
  const orderText = () => cart.lines().map(l => l.q > 1 ? `${l.d.name} × ${l.q}` : l.d.name).join(', ');

  /* ---- free text helpers ---- */
  const norm = s => s.toLowerCase().replace(/[ʻʼ‘’`']/g, "'").replace(/ё/g, 'е').replace(/қ/g, 'к').replace(/ғ/g, 'г').replace(/ў/g, 'у').replace(/ҳ/g, 'х');
  function findDishes(t) {
    const words = norm(t).split(/[^a-zа-я0-9']+/i).filter(w => w.length > 3);
    if (!words.length) return [];
    const scored = getMenu().filter(d => !d.stop).map(d => {
      const hay = norm(d.name + ' ' + d.key + ' ' + (d.alt || ''));
      const sc = words.reduce((s, w) => s + (hay.includes(w) ? 2 : hay.includes(w.slice(0, -1)) ? 1 : 0), 0);
      return { d, sc };
    }).filter(x => x.sc > 0).sort((a, b) => b.sc - a.sc || (a.d.price || 0) - (b.d.price || 0));
    if (!scored.length) return [];
    const best = scored[0].sc;
    return scored.filter(x => x.sc === best).slice(0, 4).map(x => x.d);
  }
  function parsePeople(t) {
    const m = t.match(/(?:на|для|for)\s*(\d{1,2})\b/) || t.match(/(\d{1,2})\s*(?:чел|персон|гост|кишил|kishi|people|person|guest|pax)/);
    return m ? Math.min(30, +m[1]) : 0;
  }
  function parseBudget(t) {
    const m = t.replace(/[\s\u202f\u00a0]/g, '').match(/(?:до|за|budget|бюджет|gacha|max)?(\d{2,7})(к|k|тыс|ming|000)?(?=сум|so'm|som|uzs|$|[^\d])/);
    if (!m) return 0;
    let n = +m[1]; if (m[2]) n *= (m[2] === '000' ? 1000 : 1000);
    return n >= 20000 ? n : 0;
  }
  // a balanced table: mains for everyone, something to share, bread and tea
  function planTable(people, budget) {
    const m = getMenu().filter(d => !d.stop && d.price);
    const by = k => m.find(d => d.key === k);
    const mains = ['Ковурма лагман', 'Норин, 250 г', 'Уйгурский лагман', 'Тахта кабоб', 'Казан-кабоб из баранины', 'Гушт сай', 'Сокоро', 'Манпар'].map(by).filter(Boolean);
    const grill = ['Наполеон', 'Джаз из баранины', 'Шашлык из фарша', 'Шашлык из курицы'].map(by).filter(Boolean);
    const sides = ['Аччик-чучук', 'Чиракчи', 'Чобан'].map(by).filter(Boolean);
    const bread = by('Лепёшка');
    const plan = [];
    const add = (d, q) => { if (!d || q < 1) return; const l = plan.find(p => p.d === d); l ? l.q += q : plan.push({ d, q }); };
    for (let i = 0; i < people; i++) add(mains[i % mains.length], 1);
    add(grill[0], people); if (people >= 3) add(grill[1], Math.ceil(people / 2));
    add(sides[0], Math.ceil(people / 3)); if (people >= 4) add(sides[1], 1);
    add(bread, Math.ceil(people / 2));
    const sum = () => plan.reduce((s, l) => s + l.d.price * l.q, 0);
    if (budget) {
      // trim the extras first, then swap mains for cheaper ones
      const trims = [() => { const l = plan.find(p => p.d === sides[1]); if (l) plan.splice(plan.indexOf(l), 1); },
                     () => { const l = plan.find(p => p.d === grill[1]); if (l) plan.splice(plan.indexOf(l), 1); },
                     () => { const l = plan.find(p => p.d === grill[0]); if (l && l.q > Math.ceil(people / 2)) l.q = Math.ceil(people / 2); }];
      for (const f of trims) { if (sum() <= budget) break; f(); }
      const cheap = [...mains].sort((a, b) => a.price - b.price);
      while (sum() > budget) {
        const l = plan.filter(p => mains.includes(p.d)).sort((a, b) => b.d.price - a.d.price)[0];
        if (!l || l.d === cheap[0]) break;
        l.q--; if (!l.q) plan.splice(plan.indexOf(l), 1); add(cheap[0], 1);
      }
    }
    return { plan, total: sum() };
  }

  const pick = (ids) => { const m = getMenu(); return ids.map(n => m.find(d => d.key === n)).filter(d => d && !d.stop); };
  let fallbackN = 0;
  function intent(text) {
    const t = norm(text);
    const has = (...w) => w.some(x => t.includes(x));
    // basket
    if (has('мой заказ', 'корзин', 'что в заказе', 'buyurtmam', 'savat', 'my order', 'basket', 'cart')) {
      if (!cart.count()) return { text: tt('Заказ пока пуст. Нажмите «+» у любого блюда в моих ответах — соберу заказ и посчитаю сумму.'), cards: pick(['Ковурма лагман', 'Норин, 250 г', 'Наполеон']) };
      return { text: tt('Ваш заказ:') + ' ' + orderText() + '. ' + tt('Итого') + ': ' + fmt(cart.total()) + '.', cart: true };
    }
    // table planner: "стол на 4", "на 6 человек до 500к"
    const people = parsePeople(t), budget = parseBudget(t);
    if (people || (budget && has('до', 'бюджет', 'за ', 'gacha', 'budget', 'under'))) {
      const n = people || Math.max(2, Math.round(budget / 90000));
      const { plan, total } = planTable(n, budget);
      const over = budget && total > budget;
      return { text: (over ? tt('Уложиться сложно, но вот самый экономный вариант') : tt('Собрал стол')) + ` — ${n} ${tt('чел.')}: ` + plan.map(l => `${l.d.name}${l.q > 1 ? ' × ' + l.q : ''}`).join(', ') + '. ' + tt('Итого') + ' ' + fmt(total) + (n > 1 ? ` (~${fmt(Math.round(total / n / 1000) * 1000)} ${tt('на человека')})` : '') + '.', cards: plan.map(l => l.d).slice(0, 4), planAll: plan };
    }
    if (has('удиви', 'сюрприз', 'случайн', 'любое', 'surprise', 'random', 'hayron', 'tasodif')) {
      const m = getMenu().filter(d => !d.stop && d.price && d.img && !['ichimlik'].includes(d.cat));
      const one = m[Math.floor(Math.random() * m.length)];
      return { text: tt('Сегодня советую попробовать') + ' ' + one.name + (one.desc ? ' — ' + one.desc.toLowerCase() : '') + '.', cards: [one] };
    }
    if (has('недорог', 'дешев', 'эконом', 'бюджетн', 'сытно', 'arzon', 'cheap', 'budget')) {
      const m = getMenu().filter(d => !d.stop && d.price && ['milliy', 'uygur'].includes(d.cat)).sort((a, b) => a.price - b.price).slice(0, 3);
      return { text: tt('Сытно и недорого:') + ' ' + m.map(d => `${d.name} — ${fmt(d.price)}`).join(', ') + '.', cards: m };
    }
    if (has('сколько стоит', 'цена', 'стоимост', 'qancha', 'narx', 'price', 'how much', 'cost')) {
      const f = findDishes(t);
      if (f.length) return { text: f.map(d => `${d.name}: ${d.price ? fmt(d.price) : tt('цена уточняется')}`).join('; ') + '.', cards: f };
    }
    if (has('брон', 'стол', 'зарезерв', 'место', 'band', 'stol', 'book', 'reserv', 'table')) return { text: tt('Конечно! Откройте форму брони: дата, время и число гостей — займёт минуту. Администратор перезвонит и подтвердит.'), link: [tt('Перейти к брони'), 'contact.html#booking'] };
    if (has('достав', 'привез', 'на дом', 'yetkaz', 'с собой', 'навынос', 'deliver', 'takeaway', 'olib ket')) return { text: tt('Доставка есть: звоните +998 90 916 77 74 или +998 97 766 99 88, либо закажите в Telegram-боте @Olimpolvon_bot. Можно и забрать с собой.'), link: [tt('Открыть Telegram-бот'), 'https://t.me/Olimpolvon_bot'] };
    if (has('остр', 'перц', 'пикант', 'spic', 'hot', 'achchiq')) return { text: tt('Если любите поострее — ковурма лагман, гушт сай и острые колбаски.'), cards: pick(['Ковурма лагман', 'Гушт сай', 'Колбаски острые']) };
    if (has('компан', 'много', 'банкет', 'день рожд', 'праздн', 'семь', 'group', 'party', 'family', 'davra', 'oila', 'bayram')) return { text: tt('На компанию берут бешбармак на большом блюде, норин на килограмм и шашлыки.'), cards: pick(['Бешбармак, среднее блюдо', 'Норин', 'Наполеон']) };
    if (has('час', 'работа', 'открыт', 'закры', 'когда', 'hour', 'open', 'close', 'soat', 'vaqt', 'ochiq')) return { text: tt('Мы работаем каждый день. С утра — илик шурпа, нохат шурак и халим, вечером — шашлыки на углях.') };
    if (has('адрес', 'где', 'добрат', 'парков', 'manzil', 'address', 'where', 'qayer', 'located')) return { text: tt('Мы на Большой кольцевой (Катта халқа йўли), «Эркин», Зангиатинский район. Маршрут удобно построить в Яндекс Картах.'), link: [tt('Открыть карту'), 'https://yandex.uz/maps/org/89114477009/'] };
    if (has('мяс', 'казы', 'конин', 'рулет', 'meat', "go'sht", 'qazi', 'kazy')) return { text: tt('Из мясного — мясное ассорти с казы, яхна гушт и баранья ножка.'), cards: pick(['Мясное ассорти', 'Яхна гушт', 'Баранья ножка']) };
    if (has('шашлык', 'кабоб', 'кебаб', 'мангал', 'kebab', 'kabob', 'shashlik', 'grill')) return { text: tt('Шашлыки жарим на углях из халяль-мяса. Попробуйте Наполеон, джаз из баранины и шашлык из фарша.'), cards: pick(['Наполеон', 'Джаз из баранины', 'Шашлык из фарша']) };
    if (has('лагман', 'лағмон', 'lagmon', "lag'mon", 'lagman', 'noodle')) return { text: tt('Ковурма лагман гости называют нашим главным блюдом. Есть и уйгурский лагман, и манпар.'), cards: pick(['Ковурма лагман', 'Уйгурский лагман', 'Манпар']) };
    if (has('норин', 'нарын', 'norin', 'бешбармак', 'beshbarm')) return { text: tt('Норин режем тонко, по-ташкентски: есть порция 250 г с казы и килограмм на компанию. Бешбармак — от одной порции до большого блюда.'), cards: pick(['Норин, 250 г', 'Норин', 'Бешбармак']) };
    if (has('суп', 'шурп', 'шорва', 'утр', 'завтрак', 'soup', "sho'rva", 'breakfast', 'nonushta', 'ertalab')) return { text: tt('С утра советую илик шурпу или нохат шурак, а если хочется сытнее — халим.'), cards: pick(['Илик шурпа', 'Нохат шурак', 'Халим']) };
    if (has('салат', 'salat', 'salad', 'овощ')) return { text: tt('К мясу берут аччик-чучук, чиракчи с сузьмой или чобан.'), cards: pick(['Аччик-чучук', 'Чиракчи', 'Чобан']) };
    if (has('плов', 'osh', 'plov', 'palov')) return { text: tt('Свадебный плов — с казы, изюмом и нутом.'), cards: pick(['Свадебный плов']) };
    if (has('впервые', 'попробовать', 'посовет', 'что взять', 'вкусн', 'рекоменд', 'хит', 'first', 'recommend', 'try', 'birinchi', 'tavsiya', 'maslahat', 'nima olsak')) return { text: tt('Если вы у нас впервые: ковурма лагман, норин и шашлык Наполеон. Это то, за чем к нам возвращаются.'), cards: pick(['Ковурма лагман', 'Норин, 250 г', 'Наполеон']) };
    if (has('привет', 'салам', 'здравств', 'ассалом', 'assalom', 'salom', 'hello', 'hi ')) return { text: tt('Ваалейкум ассалом! Чем помочь: подобрать блюда, оформить доставку или забронировать стол?') };
    const f = findDishes(t);
    if (f.length) return { text: f.length === 1 ? `${f[0].name}${f[0].desc ? ' — ' + f[0].desc.toLowerCase() : ''}. ${f[0].price ? fmt(f[0].price) : ''}` : tt('Вот что нашёл в меню:'), cards: f };
    // simple mode (AI not connected or busy): vary the wording instead of repeating one line
    const FB = {
      ru: ['Не совсем понял вопрос. Спросите про блюдо, доставку, бронь или часы работы.', 'Уточните, пожалуйста: вас интересует меню, бронь стола или доставка?', 'Могу подсказать по меню, собрать заказ или помочь с бронью. Что именно нужно?'],
      uz: ["Savolni unchalik tushunmadim. Taom, yetkazib berish, bron yoki ish vaqti haqida so'rang.", "Aniqlashtiring: sizni menyu, stol bron qilish yoki yetkazib berish qiziqtiradimi?", "Menyu bo'yicha maslahat beraman, buyurtma yig'aman yoki bron qilishga yordam beraman. Nima kerak?"],
      en: ["I didn't quite get that. Ask about a dish, delivery, booking or opening hours.", "Could you clarify: the menu, booking a table or delivery?", "I can help with the menu, put together an order or book a table. What do you need?"] };
    const FALLBACK = FB[msgLang(text)] || FB.ru;
    return { text: FALLBACK[(fallbackN++) % FALLBACK.length] };
  }

  const scrollDown = () => { msgs.scrollTop = msgs.scrollHeight; };
  function addMsg(who, text) {
    const m = document.createElement('div'); m.className = `msg msg--${who} pop`; m.textContent = text;
    msgs.append(m); scrollDown(); return m;
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  // phone numbers become one tappable, unbreakable link: +998 95 343 43 43
  const PHONE = /(\+?998[\s\u00a0\u202f()-]*\d{2}[\s\u00a0\u202f)-]*\d{3}[\s\u00a0\u202f-]*\d{2}[\s\u00a0\u202f-]*\d{2})/g;
  const glue = t => t.replace(PHONE, m => m.replace(/[\s\u202f]/g, '\u00a0'));
  function linkify(el, text) {
    el.innerHTML = esc(text).replace(PHONE, m => `<a class="tel" href="tel:+${m.replace(/\D/g, '')}">${m.replace(/[\s\u202f]/g, '&nbsp;')}</a>`);
  }
  async function stream(el, text) {
    if (reduce) { linkify(el, text); return; }
    el.classList.add('caret'); el.textContent = '';
    const shown = glue(text);
    const step = Math.max(1, Math.round(shown.length / 90));
    for (let i = 0; i < shown.length; i += step) { el.textContent = shown.slice(0, i + step); scrollDown(); await sleep(16); }
    el.classList.remove('caret'); linkify(el, text);
  }
  function renderCards(list, host) {
    if (!list?.length) return;
    const box = document.createElement('div'); box.className = 'ai-cards';
    list.forEach((d, i) => {
      const a = document.createElement('div'); a.className = 'ai-card'; a.style.animationDelay = [0, 60, 110, 150][i] + 'ms';
      a.innerHTML = `${d.img ? `<img src="${d.img}" alt="">` : '<span class="ai-card-ph"><svg aria-hidden="true"><use href="#mark"/></svg></span>'}<a href="menu.html#${d.id}"><b>${esc(d.name)}</b><small>${esc(d.weight)}</small></a><span class="price">${d.price ? fmt(d.price) : ''}</span>`;
      if (d.price) {
        const add = document.createElement('button'); add.type = 'button'; add.className = 'ai-add'; add.setAttribute('aria-label', tt('Добавить в заказ') + ': ' + d.name);
        add.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>';
        add.addEventListener('click', () => { cart.add(d.id); add.classList.add('is-added'); setTimeout(() => add.classList.remove('is-added'), 700); });
        a.append(add);
      }
      box.append(a);
    });
    host.append(box); scrollDown();
  }
  async function botReply(text, extra = {}) {
    busy = true; ava?.classList.add('is-thinking');
    const typing = document.createElement('div'); typing.className = 'msg msg--bot typing pop'; typing.innerHTML = '<i></i><i></i><i></i>';
    msgs.append(typing); scrollDown();
    await sleep(reduce || extra.fast ? 120 : 650 + Math.random() * 400);
    typing.remove();
    ava?.classList.remove('is-thinking'); ava?.classList.add('is-talking');
    const m = addMsg('bot', ''); await stream(m, text);
    ava?.classList.remove('is-talking');
    renderCards(extra.cards, msgs);
    if (extra.planAll) {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'btn msg pop'; b.style.cssText = 'align-self:flex-start;min-height:44px;font-size:15px';
      b.textContent = tt('Добавить всё в заказ');
      b.addEventListener('click', () => { extra.planAll.forEach(l => cart.add(l.d.id, l.q)); b.disabled = true; b.textContent = tt('Добавлено ✓'); });
      msgs.append(b); scrollDown();
    }
    if (extra.cart) renderOrder();
    if (extra.go) renderGo(extra.go);
    if (extra.link) { const a = document.createElement('a'); a.className = 'btn btn--cobalt msg pop'; a.style.cssText = 'align-self:flex-start;min-height:44px;font-size:15px'; a.href = extra.link[1]; a.textContent = extra.link[0]; msgs.append(a); scrollDown(); }
    ava?.classList.remove('is-thinking', 'is-talking'); busy = false;
  }
  /* ---- admin: the assistant never edits, it only takes you to the right place ---- */
  function goHref(go) {
    if (go.to === 'edit') { const n = x => norm(x).replace(/[«»"]/g, ''); const all = getMenu(); const d = all.find(x => n(x.key) === n(go.dish)) || all.find(x => n(x.key + ' ' + (x.alt || '')).includes(n(go.dish))); return d ? { href: `menu.html?admin=edit#${d.id}`, label: tt('Открыть правку: ') + d.name } : null; }
    if (go.to === 'add') { const c = ['shashlik', 'milliy', 'uygur', 'salat', 'yevropa', 'non', 'ichimlik'].includes(go.cat) ? go.cat : 'milliy'; return { href: `menu.html?admin=add#${c}`, label: tt('Добавить блюдо в раздел') }; }
    if (go.to === 'tab') { const t = ['bookings', 'menu', 'ai', 'overview'].includes(go.tab) ? go.tab : 'overview'; return { href: `admin.html#${t}`, label: { bookings: tt('Открыть брони'), menu: tt('Открыть меню и стоп-лист'), ai: tt('Открыть настройки помощника'), overview: tt('Открыть панель') }[t] }; }
    return null;
  }
  function renderGo(go) {
    const g = goHref(go); if (!g) return;
    const a = document.createElement('a'); a.className = 'btn msg pop ai-go'; a.href = g.href;
    a.innerHTML = `${esc(g.label)} <svg class="icon" aria-hidden="true"><use href="#i-arrow"/></svg>`;
    a.addEventListener('click', e => {
      const u = new URL(a.href, location.href);
      if (u.pathname === location.pathname) { e.preventDefault(); window.history.replaceState(null, '', u.search + u.hash); closeAI(); runAdminJump(); }
    });
    msgs.append(a); scrollDown();
  }
  function renderOrder() {
    const box = document.createElement('div'); box.className = 'ai-order pop';
    const draw = () => {
      const lines = cart.lines();
      if (!lines.length) { box.innerHTML = `<p>${esc(tt('Заказ пуст.'))}</p>`; return; }
      box.innerHTML = lines.map(l => `<div class="ai-order-row" data-id="${l.d.id}"><span>${esc(l.d.name)}</span><span class="qty"><button type="button" data-q="-1" aria-label="−">−</button><b>${l.q}</b><button type="button" data-q="1" aria-label="+">+</button></span><span class="price">${fmt(l.d.price * l.q)}</span></div>`).join('')
        + `<div class="ai-order-total"><span>${esc(tt('Итого'))}</span><b>${fmt(cart.total())}</b></div>`
        + `<div class="ai-order-actions"><button type="button" class="btn" data-order-checkout="delivery">${esc(tt('Оформить доставку'))}</button><button type="button" class="btn btn--ghost" data-order-checkout="${TABLE_ID() ? 'table' : 'pickup'}">${esc(TABLE_ID() ? tt('Отправить на кухню') : tt('Заберу сам'))}</button><button type="button" class="ai-order-copy" data-order-copy>${esc(tt('Скопировать заказ'))}</button><button type="button" class="mini-btn mini-btn--danger" data-order-clear>${esc(tt('Отменить заказ'))}</button></div>`;
    };
    box.addEventListener('click', e => {
      const q = e.target.closest('[data-q]'); if (q) { cart.add(q.closest('[data-id]').dataset.id, +q.dataset.q); draw(); return; }
      if (e.target.closest('[data-order-clear]')) { cart.clear(); draw(); toast(tt('Заказ отменён')); return; }
      if (e.target.closest('[data-order-copy]')) { navigator.clipboard?.writeText(tt('Заказ') + ': ' + orderText() + '. ' + tt('Итого') + ': ' + fmt(cart.total())).then(() => toast(tt('Заказ скопирован — вставьте его в Telegram-бот'))).catch(() => {}); return; }
      const co = e.target.closest('[data-order-checkout]'); if (co) { closeAI?.(); openCheckout(co.dataset.orderCheckout); return; }
    });
    draw(); msgs.append(box); scrollDown();
  }
  renderCartBar();

  /* ---------------- shop: «+» on menu cards, order bar, checkout ---------------- */
  const PHONE_OK = v => v.replace(/\D/g, '').length >= 9;
  function syncMenuAdds() {
    const m = getMenu(), c = cart.get();
    $$('.menu-item[data-id]').forEach(li => {
      const d = m.find(x => x.id === li.dataset.id); const ph = $('.dish-ph', li);
      let box = $('.mi-add', li);
      if (!d || !d.price || d.stop || !ph) { box?.remove(); return; }
      if (!box) { box = document.createElement('div'); box.className = 'mi-add'; ph.append(box); }
      const q = c[d.id] || 0;
      const html = q ? `<button type="button" data-mi="-1" aria-label="${esc(tt('Убрать одну порцию'))}">−</button><b aria-live="polite">${q}</b><button type="button" data-mi="1" aria-label="${esc(tt('Добавить ещё'))}">+</button>`
                     : `<button type="button" data-mi="1" class="mi-plus" aria-label="${esc(tt('Добавить в заказ'))}: ${esc(d.name)}">+</button>`;
      if (box.dataset.q !== String(q)) { box.innerHTML = html; box.dataset.q = q; box.classList.toggle('is-on', !!q); }
    });
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('.mi-add [data-mi]'); if (!b) return;
    e.preventDefault(); e.stopPropagation();
    const id = b.closest('.menu-item').dataset.id; const n = +b.dataset.mi;
    cart.add(id, n);
    if (n > 0 && cart.get()[id] === 1) toast(tt('Добавлено в заказ'));
  }, true);

  const orderBar = document.createElement('div');
  orderBar.className = 'order-bar'; orderBar.hidden = true;
  orderBar.innerHTML = `<button type="button" class="order-bar-main" data-checkout-open><span class="order-bar-ic" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M5 8h14l-1.3 11.2a2 2 0 0 1-2 1.8H8.3a2 2 0 0 1-2-1.8z"/><path d="M9 8V6a3 3 0 0 1 6 0v2"/></svg><i data-ob-n></i></span><span class="order-bar-txt"><small>${esc(tt('Ваш заказ'))}</small><b data-ob-sum></b></span><span class="order-bar-go">${esc(tt('Оформить'))}</span></button>`;
  document.body.append(orderBar);
  function renderOrderBar() {
    const n = cart.count(); const show = n > 0 && !/admin\.html$/.test(location.pathname);
    orderBar.hidden = !show; document.documentElement.classList.toggle('has-order', show);
    if (!show) return;
    $('[data-ob-n]', orderBar).textContent = n; $('[data-ob-sum]', orderBar).textContent = fmt(cart.total());
    orderBar.classList.remove('bump'); void orderBar.offsetWidth; orderBar.classList.add('bump');
  }
  orderBar.addEventListener('click', () => openCheckout());

  const co = document.createElement('dialog');
  co.className = 'checkout'; co.setAttribute('aria-labelledby', 'co-title');
  document.body.append(co);
  let coMode = 'delivery', coDraft = {};
  const coSaved = () => store.get('guest', {});
  function coLines() {
    const lines = cart.lines();
    if (!lines.length) return `<p class="co-empty">${esc(tt('Заказ пуст. Добавьте блюда кнопкой «+» в меню.'))}</p><a class="btn" href="menu.html">${esc(tt('Открыть меню'))}</a>`;
    return `<ul class="co-lines">${lines.map(l => `<li data-id="${l.d.id}"><span class="co-name">${esc(l.d.name)}</span><span class="qty"><button type="button" data-q="-1" aria-label="−">−</button><b>${l.q}</b><button type="button" data-q="1" aria-label="+">+</button></span><span class="co-price">${fmt(l.d.price * l.q)}</span></li>`).join('')}</ul>
      <div class="co-total"><span>${esc(tt('Итого за блюда'))}</span><b>${fmt(cart.total())}</b></div>`;
  }
  // table number comes only from the QR code on the table: ?table=5
  const TABLE = (() => { try { const q = new URLSearchParams(location.search); const t = (q.get('table') || q.get('stol') || '').replace(/\D/g, '').slice(0, 3); if (t) sessionStorage.setItem('polvon_table', t); return t || sessionStorage.getItem('polvon_table') || ''; } catch { return ''; } })();
  if (TABLE) coMode = 'table';
  const ymap = (lat, lon) => `https://yandex.uz/map-widget/v1/?ll=${lon},${lat}&z=17&pt=${lon},${lat},pm2rdm`;
  const ylink = (lat, lon) => `https://yandex.uz/maps/?pt=${lon},${lat}&z=17&l=map`;
  function geoBlock() {
    const d = coDraft;
    if (d.lat && d.ok === '1') return `<div class="co-geo is-ok"><div class="co-geo-row"><span>✓ ${esc(tt('Локация подтверждена'))}</span><button type="button" class="mini-btn" data-geo-reset>${esc(tt('Изменить'))}</button></div>
      <label class="co-live"><input type="checkbox" name="live" value="1" ${d.live === '1' ? 'checked' : ''}><span><b>${esc(tt('Транслировать моё местоположение'))}</b><small>${esc(tt('Курьер увидит, где вы, даже если вы переместитесь. Работает, пока страница открыта и есть интернет.'))}</small></span></label></div>`;
    if (d.lat) return `<div class="co-geo"><iframe class="co-geo-map" src="${ymap(d.lat, d.lon)}" title="${esc(tt('Ваше местоположение на карте'))}" loading="lazy"></iframe>
      <p class="co-geo-q">${esc(tt('Мы правильно определили, где вы?'))}${d.acc > 150 ? ` <small>${esc(tt('Точность низкая — проверьте метку.'))} ±${Math.round(d.acc)} ${esc(tt('м'))}</small>` : ''}</p>
      <div class="co-geo-row"><button type="button" class="btn" data-geo-yes>${esc(tt('Да, верно'))}</button><button type="button" class="btn btn--ghost" data-geo-again>${esc(tt('Определить ещё раз'))}</button><button type="button" class="mini-btn" data-geo-reset>${esc(tt('Нет, введу адрес'))}</button></div></div>`;
    return `<button type="button" class="co-geo-btn" data-geo><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg><span><b>${esc(tt('Отправить мою геолокацию'))}</b><small>${esc(tt('Браузер спросит разрешение — курьер найдёт вас точно'))}</small></span></button>`;
  }
  function coForm() {
    const g = coSaved();
    const tabs = TABLE ? [['table', tt('Стол') + ' №' + TABLE], ['delivery', tt('Доставка')], ['pickup', tt('Заберу сам')]] : [['delivery', tt('Доставка')], ['pickup', tt('Заберу сам')]];
    const seg = `<div class="co-seg" role="tablist" style="--n:${tabs.length}">${tabs.map(([k, t]) => `<button type="button" role="tab" aria-selected="${k === coMode}" data-mode="${k}">${esc(t)}</button>`).join('')}</div>`;
    if (coMode === 'table') return seg + `<form class="co-form" novalidate>
      <p class="co-table-badge">${esc(tt('Вы за столом'))} <b>№${esc(TABLE)}</b></p>
      <label class="field"><span>${esc(tt('Комментарий'))} <small>${esc(tt('необязательно'))}</small></span><input name="note" placeholder="${esc(tt('Например: без лука'))}"></label>
      <p class="co-hint">${esc(tt('Заказ сразу уйдёт на кухню, официант принесёт блюда к вашему столу. Оплата — как обычно, в конце.'))}</p>
      <button class="btn co-submit" type="submit">${esc(tt('Отправить на кухню'))} · ${fmt(cart.total())}</button></form>`;
    const del = coMode === 'delivery';
    const needAddr = !(coDraft.lat && coDraft.ok === '1');
    return seg + `<form class="co-form" novalidate>
      <div class="co-grid">
        <label class="field"><span>${esc(tt('Имя'))}</span><input name="name" autocomplete="name" required value="${esc(g.name || '')}"></label>
        <label class="field"><span>${esc(tt('Телефон'))}</span><input name="phone" type="tel" inputmode="tel" autocomplete="tel" placeholder="+998 __ ___ __ __" required value="${esc(g.phone || '')}"></label>
      </div>
      ${del ? `<div class="field"><span>${esc(tt('Куда привезти'))}</span>${geoBlock()}</div>
      <label class="field"><span>${needAddr ? esc(tt('Адрес доставки')) : esc(tt('Подъезд, этаж, квартира'))}</span><input name="address" autocomplete="street-address" placeholder="${esc(needAddr ? tt('Район, улица, дом, квартира, ориентир') : tt('Например: 2 подъезд, 5 этаж, кв. 18'))}" ${needAddr ? 'required' : ''} value="${esc(g.address || '')}"></label>` : ''}
      <fieldset class="co-chips"><legend>${esc(del ? tt('Когда привезти') : tt('Когда заберёте'))}</legend>
        <label><input type="radio" name="when" value="asap" checked><span>${esc(tt('Как можно скорее'))}</span></label>
        <label><input type="radio" name="when" value="time"><span>${esc(tt('Ко времени'))}</span></label>
        <input type="time" name="time" class="co-time" step="900" hidden>
      </fieldset>
      ${del ? `<fieldset class="co-chips"><legend>${esc(tt('Оплата'))}</legend>
        <label><input type="radio" name="pay" value="cash" checked><span>${esc(tt('Наличными'))}</span></label>
        <label><input type="radio" name="pay" value="transfer"><span>${esc(tt('Переводом'))}</span></label>
      </fieldset>` : ''}
      <label class="field"><span>${esc(tt('Комментарий'))} <small>${esc(tt('необязательно'))}</small></span><input name="note" placeholder="${esc(del ? tt('Например: позвонить у подъезда, без лука') : tt('Например: без лука'))}"></label>
      <p class="co-hint">${esc(del ? tt('Стоимость и время доставки администратор назовёт, когда перезвонит.') : tt('Адрес: Большая кольцевая (Эркин). Администратор перезвонит и скажет, когда будет готово.'))}</p>
      <button class="btn co-submit" type="submit">${esc(del ? tt('Заказать доставку') : tt('Заказать навынос'))} · ${fmt(cart.total())}</button>
    </form>`;
  }
  function locate(again) {
    if (!navigator.geolocation) { toast(tt('Браузер не умеет определять местоположение — впишите адрес')); return; }
    const btn = co.querySelector('[data-geo],[data-geo-again]'); if (btn) { btn.disabled = true; btn.classList.add('is-busy'); }
    navigator.geolocation.getCurrentPosition(p => {
      Object.assign(coDraft, { lat: p.coords.latitude.toFixed(6), lon: p.coords.longitude.toFixed(6), acc: p.coords.accuracy, ok: '' });
      drawCheckout(); co.querySelector('.co-geo')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
    }, err => {
      if (btn) { btn.disabled = false; btn.classList.remove('is-busy'); }
      toast(err.code === 1 ? tt('Доступ к геолокации запрещён. Разрешите его в настройках браузера или впишите адрес.') : tt('Не удалось определить местоположение. Включите GPS или впишите адрес.'));
    }, { enableHighAccuracy: true, timeout: 15000, maximumAge: again ? 0 : 30000 });
  }
  // live location while the order is on its way
  let liveWatch = null, wakeLock = null;
  async function startLive(orderId) {
    if (!navigator.geolocation) return;
    try { wakeLock = await navigator.wakeLock?.request('screen'); } catch {}
    liveWatch = navigator.geolocation.watchPosition(p => {
      const list = store.get('orders', []); const o = list.find(x => x.id === orderId); if (!o) return;
      o.lat = p.coords.latitude.toFixed(6); o.lon = p.coords.longitude.toFixed(6); o.liveAt = Date.now(); store.set('orders', list);
      const st = co.querySelector('[data-live-status]'); if (st) st.textContent = tt('Трансляция идёт') + ' · ' + new Date().toLocaleTimeString(LOCALE, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
    }, () => {}, { enableHighAccuracy: true, maximumAge: 5000 });
  }
  function stopLive() { if (liveWatch != null) navigator.geolocation.clearWatch(liveWatch); liveWatch = null; try { wakeLock?.release(); } catch {} wakeLock = null; }
  document.addEventListener('visibilitychange', async () => { if (liveWatch != null && document.visibilityState === 'visible') { try { wakeLock = await navigator.wakeLock?.request('screen'); } catch {} } });
  function drawCheckout() {
    const has = cart.count() > 0;
    co.innerHTML = `<div class="co-card"><header class="co-head"><h2 id="co-title">${esc(tt('Ваш заказ'))}</h2><button type="button" class="co-x" data-co-close aria-label="${esc(tt('Закрыть'))}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button></header>
      <div class="co-body">${coLines()}${has ? coForm() : ''}</div></div>`;
    restore(coDraft);
  }
  function openCheckout(mode) {
    if (mode) coMode = mode === 'table' && !TABLE ? 'delivery' : mode;
    drawCheckout();
    if (!co.open) { co.showModal(); document.documentElement.classList.add('co-open'); }
  }
  window.POLVON_CHECKOUT = openCheckout;
  const closeCheckout = () => { co.classList.add('is-closing'); setTimeout(() => { co.close(); co.classList.remove('is-closing'); }, 180); };
  co.addEventListener('close', () => document.documentElement.classList.remove('co-open'));
  co.addEventListener('click', e => {
    if (e.target === co || e.target.closest('[data-co-close]')) { closeCheckout(); return; }
    const q = e.target.closest('[data-q]');
    if (q) { cart.add(q.closest('[data-id]').dataset.id, +q.dataset.q); drawCheckout(); return; }
    const m = e.target.closest('[data-mode]');
    if (m) { coMode = m.dataset.mode; drawCheckout(); return; }
    if (e.target.closest('[data-geo]')) { locate(false); return; }
    if (e.target.closest('[data-geo-again]')) { locate(true); return; }
    if (e.target.closest('[data-geo-yes]')) { coDraft.ok = '1'; drawCheckout(); return; }
    if (e.target.closest('[data-geo-reset]')) { ['lat', 'lon', 'acc', 'ok', 'live'].forEach(k => delete coDraft[k]); drawCheckout(); return; }
    if (e.target.closest('[data-live-stop]')) { stopLive(); const st = co.querySelector('[data-live-status]'); if (st) st.textContent = tt('Трансляция остановлена'); e.target.closest('[data-live-stop]').remove(); return; }
  });
  function restore(v) {
    const f = co.querySelector('.co-form'); if (!f) return;
    ['name', 'phone', 'address', 'note', 'time'].forEach(k => { if (f.elements[k] && v[k]) f.elements[k].value = v[k]; });
    ['when', 'pay'].forEach(k => { const r = v[k] && f.querySelector(`input[name="${k}"][value="${v[k]}"]`); if (r) r.checked = true; });
    if (v.when === 'time' && f.querySelector('.co-time')) f.querySelector('.co-time').hidden = false;
  }
  co.addEventListener('input', e => { const f = e.target.form; if (f) Object.assign(coDraft, Object.fromEntries(new FormData(f))); });
  co.addEventListener('change', e => { const f = e.target.form; if (f) Object.assign(coDraft, Object.fromEntries(new FormData(f))); if (e.target.name === 'live') coDraft.live = e.target.checked ? '1' : ''; if (e.target.name === 'when') { const t = co.querySelector('.co-time'); t.hidden = e.target.value !== 'time'; if (!t.hidden) { if (!t.value) { const d = new Date(Date.now() + 75 * 6e4); t.value = `${String(d.getHours()).padStart(2, '0')}:${String(Math.ceil(d.getMinutes() / 15) * 15 % 60).padStart(2, '0')}`; } t.focus(); } } });
  co.addEventListener('submit', e => {
    e.preventDefault(); const f = e.target; let bad = null;
    ['name', 'phone', 'address'].forEach(k => { const i = f.elements[k]; if (!i) return; const ok = k === 'phone' ? PHONE_OK(i.value) : (!i.required || i.value.trim().length > 1); i.closest('.field').classList.toggle('is-invalid', !ok); if (!ok && !bad) bad = i; });
    if (bad) { bad.focus(); toast(tt('Проверьте выделенные поля')); return; }
    const v = { ...coDraft, ...Object.fromEntries(new FormData(f)) };
    const geo = coMode === 'delivery' && v.lat && v.ok === '1';
    const o = { id: Date.now(), type: coMode, table: coMode === 'table' ? TABLE : '', name: (v.name || '').trim(), phone: (v.phone || '').trim(), address: (v.address || '').trim(), lat: geo ? v.lat : '', lon: geo ? v.lon : '', live: geo && v.live === '1', when: coMode === 'table' ? tt('сейчас') : (v.when === 'time' && v.time ? v.time : tt('как можно скорее')), pay: coMode === 'delivery' ? v.pay || 'cash' : '', note: (v.note || '').trim(), items: orderText(), total: cart.total(), status: 'new' };
    const list = store.get('orders', []); list.unshift(o); store.set('orders', list);
    if (coMode !== 'table') store.set('guest', { name: o.name, phone: o.phone, address: o.address || coSaved().address || '' });
    const kind = { delivery: tt('Доставка'), pickup: tt('Навынос'), table: tt('Стол') + ' №' + TABLE }[coMode];
    const text = `${kind}: ${o.items}. ${tt('Итого')}: ${fmt(o.total)}.` + (coMode === 'table' ? (o.note ? ' ' + o.note : '') : ` ${o.name}, ${o.phone}${o.address ? ', ' + o.address : ''}${geo ? ', ' + ylink(o.lat, o.lon) : ''}. ${tt('Когда')}: ${o.when}${o.note ? '. ' + o.note : ''}`);
    cart.clear(); coDraft = {};
    const X = `<button type="button" class="co-x" data-co-close aria-label="${esc(tt('Закрыть'))}"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6 6 18"/></svg></button>`;
    const check = `<div class="co-check" aria-hidden="true"><svg viewBox="0 0 52 52"><circle cx="26" cy="26" r="24" fill="none" stroke="currentColor" stroke-width="2.5"/><path d="M15 27l7 7 15-16" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`;
    co.innerHTML = coMode === 'table'
      ? `<div class="co-card co-done">${X}${check}<h2 id="co-title" tabindex="-1">${esc(tt('Заказ на кухне!'))}</h2><p>${esc(tt('Официант принесёт блюда к вашему столу. Если захотите что-то ещё — добавьте в меню и отправьте снова.'))}</p><p class="co-summary">${esc(text)}</p><div class="co-done-actions"><a class="btn" href="menu.html">${esc(tt('Вернуться в меню'))}</a></div></div>`
      : `<div class="co-card co-done">${X}${check}<h2 id="co-title" tabindex="-1">${esc(tt('Заказ принят!'))}</h2>
      <p>${esc(tt('Администратор перезвонит в течение нескольких минут, подтвердит заказ и назовёт время.'))}</p>
      ${o.live ? `<div class="co-live-box"><span class="co-live-dot" aria-hidden="true"></span><div><b data-live-status>${esc(tt('Включаем трансляцию…'))}</b><small>${esc(tt('Не закрывайте эту страницу и не выключайте интернет, пока курьер в пути.'))}</small></div><button type="button" class="mini-btn" data-live-stop>${esc(tt('Остановить'))}</button></div>` : ''}
      <p class="co-summary">${esc(text)}</p>
      <div class="co-done-actions"><a class="btn" href="https://t.me/Olimpolvon_bot" target="_blank" rel="noopener" data-co-tg>${esc(tt('Продублировать в Telegram'))}</a><a class="btn btn--ghost" href="tel:+998909167774">${esc(tt('Позвонить'))}</a></div></div>`;
    co.querySelector('[data-co-tg]')?.addEventListener('click', () => { navigator.clipboard?.writeText(text).then(() => toast(tt('Заказ скопирован — вставьте его в Telegram-бот'))).catch(() => {}); });
    if (o.live) startLive(o.id);
    co.querySelector('h2').focus();
  });
  window.addEventListener('polvon-cart', () => { syncMenuAdds(); renderOrderBar(); });
  window.addEventListener('storage', e => { if (e.key === 'polvon_cart') { renderCartBar(); syncMenuAdds(); renderOrderBar(); } });
  syncMenuAdds(); renderOrderBar();
  // booking form picks up the order chosen in the assistant
  const note = $('#b-note'); const pre = store.get('booking_note', '');
  if (note && pre && !note.value) { note.value = pre; store.set('booking_note', ''); }
  function renderChips() {
    chipsBox.innerHTML = '';
    CHIPS.forEach((c, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = c; b.style.animationDelay = i * 40 + 'ms'; b.addEventListener('click', () => ask(c)); chipsBox.append(b); });
  }
  /* ---- live AI through the Cloudflare Worker (key never reaches the browser) ---- */
  // one or more addresses, comma separated: Cloudflare Worker first, Google Apps Script as a backup
  const aiEndpoints = () => (store.get('ai', {}).endpoint || panel?.dataset.aiEndpoint || '').split(/[\s,]+/).map(x => x.trim()).filter(Boolean);
  const aiEndpoint = () => aiEndpoints()[0] || '';
  // the address that answered last time is remembered for a day
  let goodEp = (() => { try { const v = JSON.parse(localStorage.getItem('polvon_ai_ep') || 'null'); return v && Date.now() - v.t < 864e5 ? v.u : ''; } catch { return ''; } })();
  const rememberEp = u => { goodEp = u; try { localStorage.setItem('polvon_ai_ep', JSON.stringify({ u, t: Date.now() })); } catch {} };
  // conversation survives page changes within the visit
  // chat and guest preferences live only on this device (localStorage), chat for 7 days
  const WEEK = 7 * 864e5;
  const history = (() => { try { const c = JSON.parse(localStorage.getItem('polvon_chat') || 'null'); return c && Date.now() - c.t < WEEK ? c.m : []; } catch { return []; } })();
  const memory = {
    get: () => { try { return JSON.parse(localStorage.getItem('polvon_mem') || '[]'); } catch { return []; } },
    set: a => { try { localStorage.setItem('polvon_mem', JSON.stringify(a.slice(-12))); } catch {} },
    apply(add, del) {
      let m = memory.get(); const n = x => x.toLowerCase().trim();
      if (del?.length) m = m.filter(x => !del.some(d => n(d) === n(x)));
      const fresh = (add || []).filter(x => !m.some(y => n(y) === n(x)));
      memory.set([...m, ...fresh]); return fresh;
    },
  };
  if (aiEndpoint()) { const f = $('.ai-foot'); if (f) f.textContent = tt('Отвечает ИИ, может ошибаться. Переписка хранится только на этом устройстве — не пишите сюда личные данные.'); }
  function matchDishes(names) {
    const m = getMenu().filter(d => !d.stop); const n = s => norm(s).replace(/[«»"]/g, '');
    return (names || []).map(x => m.find(d => n(d.key) === n(x)) || m.find(d => n(d.key + ' ' + (d.alt || '')).includes(n(x)))).filter((d, i, a) => d && a.indexOf(d) === i);
  }
  function sysNote(text) {
    const n = document.createElement('div'); n.className = 'msg msg--sys pop'; n.textContent = text; msgs.append(n); scrollDown(); return n;
  }
  let switchedShown = false;
  let aiWarm = false, unreachableShown = false;
  function warmAI() {   // first contact can fail on some networks (QUIC); a cheap OPTIONS ping opens the connection early
    if (aiWarm || !aiEndpoint()) return; aiWarm = true;
    // open connections early so the first answer comes faster
    aiEndpoints().forEach(u => fetch(u, { method: /script\.google/.test(u) ? 'GET' : 'OPTIONS', mode: /script\.google/.test(u) ? 'no-cors' : 'cors' }).catch(() => {}));
  }
  /* ---- wrong keyboard layout: "ghbdtn" → "привет", "ыфдщь" → "salom" ---- */
  const EN = "`qwertyuiop[]asdfghjkl;'zxcvbnm,.~QWERTYUIOP{}ASDFGHJKL:\"ZXCVBNM<>";
  const RU = "ёйцукенгшщзхъфывапролджэячсмитьбюЁЙЦУКЕНГШЩЗХЪФЫВАПРОЛДЖЭЯЧСМИТЬБЮ";
  const swap = (t, from, to) => [...t].map(c => { const i = from.indexOf(c); return i < 0 ? c : to[i]; }).join('');
  const RU_WORDS = /(^|\s)(я|а|и|в|на|не|что|как|где|когда|сколько|есть|нет|да|вы|мы|ты|у|с|по|за|для|это|мне|можно|хочу|привет|здравствуйте|спасибо|меню|стол|бронь|доставка|цена|стоит|работаете|часы|откуда|какой|какие|посоветуйте|блюдо|шашлык|плов|лагман|норин|уже|ещё|еще|сделал|сделай|давай|ок|пожалуйста|кто|почему|сегодня|завтра|если|возможно|сделаем|можете|хорошо|ладно|нужно|надо|будет|тоже|там|тут|все|всё|или|но|так|вот|сейчас|понял|делать)(?=\s|[?!.,]|$)/g;
  const UZ_WORDS = /(^|\s)(salom|assalomu|rahmat|qancha|qanaqa|qanday|nima|bormi|bor|yo'q|menga|bizga|stol|bron|osh|norin|kerak|bugun|ertaga|soat|ish|vaqt|yaxshi|necha|kishi|uchun|bilan|qayerda|ha|xop)(?=\s|[?!.,]|$)/g;
  const hits = (t, re) => (t.toLowerCase().match(re) || []).length;
  function fixLayout(t) {
    if (/[a-z]/i.test(t) && !/[а-яё]/i.test(t)) {
      const ru = swap(t, EN, RU);
      const odd = /[a-z][;'\[\],.`][a-z]/i.test(t) ? 1 : 0;              // ; ' [ inside a word = typed in the wrong layout
      // words with almost no Latin vowels ("cltkftv", "hfpdthnsdfybz") are Russian typed on the English layout
      const junk = t.toLowerCase().split(/\s+/).filter(w => w.length >= 4 && (w.match(/[aeiouy]/g) || []).length / w.length < 0.2).length;
      const ruScore = hits(ru, RU_WORDS) * 2 + odd + Math.min(2, junk) + (/[аеиоуыэюяё]/.test(ru) ? 0 : -2);
      const latScore = hits(t, UZ_WORDS) * 2 + (msgLang(t) === 'en' ? 2 : 0);
      if (ruScore >= 2 && ruScore > latScore) return ru;
    } else if (/[а-яё]/i.test(t) && !/[ўқғҳ]/i.test(t)) {
      const lat = swap(t, RU, EN);
      if (hits(lat, UZ_WORDS) * 2 + (msgLang(lat) === 'en' ? 2 : 0) >= 2 && hits(t, RU_WORDS) === 0) return lat;
    }
    return null;
  }
  // language of a single message: Cyrillic → ru (or uz if Uzbek Cyrillic letters), clear English → en, any other Latin → uz
  function msgLang(t) {
    const w = t.toLowerCase();
    if (/[ўқғҳ]/.test(w)) return 'uz';
    if (/[а-яё]/.test(w)) return 'ru';
    if (!/[a-z]/.test(w)) return LANG;
    const en = /\b(the|you|your|what|where|when|how|why|who|do|does|is|are|was|have|has|can|could|would|i|i'm|we|my|me|menu|price|prices|open|close|book|booking|table|recommend|food|dish|dishes|hello|hi|hey|thanks|thank|please|want|need|much|cheap|expensive|delivery)\b/g;
    const uz = /(o['ʻ‘’`]|g['ʻ‘’`]|\b(va|bor|bormi|yo'q|yoq|qanday|qanaqa|nima|nimalar|nechi|necha|qancha|kerak|salom|rahmat|menga|sizda|uchun|bilan|qayer|qayerda|ha|xop|mumkinmi|lekin|juda|yana|yanachi|yaxshi|kim|kimsan|sen|siz|biz|men|bu|shu|osh|taom|ovqat|non|stol|bron)\b|(lar|ingiz|imiz|miz|dan|ga|da|ni|chi|mi)\b)/g;
    const e = (w.match(en) || []).length, u = (w.match(uz) || []).length;
    return e > u ? 'en' : 'uz';
  }
  // admin promotions live in Google; the site loads them once per visit and passes them along
  let sharedNotes = null;
  const gasUrl = () => aiEndpoints().find(u => /script\.google/.test(u));
  async function loadNotes() {
    if (sharedNotes !== null) return sharedNotes;
    try { const c = JSON.parse(sessionStorage.getItem('polvon_notes') || 'null'); if (c && Date.now() - c.t < 10 * 60e3) return (sharedNotes = c.n); } catch {}
    const u = gasUrl(); if (!u) return (sharedNotes = '');
    try {
      const r = await fetch(u, { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify({ action: 'notes_get' }) });
      const j = await r.json(); sharedNotes = j.notes || '';
      try { sessionStorage.setItem('polvon_notes', JSON.stringify({ t: Date.now(), n: sharedNotes })); } catch {}
    } catch { sharedNotes = ''; }
    return sharedNotes;
  }
  window.POLVON_NOTES = { load: loadNotes, gasUrl, reset: () => { sharedNotes = null; try { sessionStorage.removeItem('polvon_notes'); } catch {} } };
  async function callOne(url, q, outer) {
    const gas = /script\.google/.test(url);
    const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), gas ? 30000 : 20000);
    outer?.addEventListener('abort', () => ctl.abort());
    try {
      // the whole recent conversation goes along, so a switch to the backup AI forgets nothing
      const r = await fetch(url, { method: 'POST', signal: ctl.signal, redirect: 'follow',
        // Apps Script accepts only "simple" requests (no CORS preflight), so send JSON as plain text there
        headers: { 'Content-Type': gas ? 'text/plain;charset=utf-8' : 'application/json' },
        body: JSON.stringify({ messages: [...history, { role: 'me', text: q }].slice(-12), tone: settings().tone, lang: msgLang(q), memory: memory.get(), admin: isAdmin(), notes: gas ? undefined : (sharedNotes || '') }) });
      const j = await r.json().catch(() => ({}));
      if (r.status === 429 || j.error === 'busy') return { busy: Math.min(60, Math.max(5, +j.retryAfter || 20)) };
      if (!r.ok || !j.reply) return { failed: true };
      return j;
    } catch { return { unreachable: true }; } finally { clearTimeout(to); }
  }
  async function callAI(q) {
    const list = aiEndpoints(); if (goodEp && list.includes(goodEp)) list.sort((a, b) => (b === goodEp) - (a === goodEp));
    // race: start with the preferred address; if it is silent for 2.5 s (blocked network), start the next one too.
    // The first real answer wins and the others are cancelled.
    return new Promise(resolve => {
      const ctls = []; let pending = 0, done = false, last = { unreachable: true }, i = 0;
      const finish = j => { if (done) return; done = true; ctls.forEach(c => c.abort()); resolve(j); };
      const start = () => {
        if (done || i >= list.length) return;
        const url = list[i++]; const c = new AbortController(); ctls.push(c); pending++;
        const nextTimer = setTimeout(start, 2500);
        callOne(url, q, c.signal).then(j => {
          pending--;
          if (j.reply) { clearTimeout(nextTimer); rememberEp(url); return finish(j); }
          if (j.busy) { clearTimeout(nextTimer); return finish(j); }
          last = j; clearTimeout(nextTimer); start();            // failed fast: go to the next one right away
          if (!pending && i >= list.length) finish(last.unreachable ? last : null);
        });
      };
      start();
    });
  }
  async function askAI(q, typing) {
    if (!aiEndpoint()) return null;
    let j = await callAI(q);
    if (j?.busy) {
      // every AI is at its limit right now: tell the guest, wait, try once more (conversation is kept)
      typing.remove();
      const note = sysNote(''); let left = j.busy;
      const tick = () => { note.textContent = tt('Сейчас много вопросов — ИИ переключается. Подождите {n} сек, я отвечу сам.').replace('{n}', left); };
      tick(); ava?.classList.add('is-thinking');
      await new Promise(res => { const t = setInterval(() => { left--; if (left <= 0) { clearInterval(t); res(); } else tick(); }, 1000); });
      note.textContent = tt('Продолжаем разговор…'); msgs.append(typing); scrollDown();
      j = await callAI(q);
      if (!j || j.busy) { note.textContent = tt('ИИ всё ещё занят — пока отвечу в простом режиме.'); return null; }
      note.remove();
    }
    if (j?.unreachable) { if (!unreachableShown) { unreachableShown = true; sysNote(tt('Не получается связаться с ИИ — проверьте интернет. Пока отвечаю в простом режиме.')); } return null; }
    if (!j) return null;
    if (j.switched && !switchedShown) { switchedShown = true; sysNote(tt('Основной ИИ на лимите — ответил запасной. Разговор сохранён.')); }
    const learned = memory.apply(j.remember, j.forget);
    if (learned.length) setTimeout(() => sysNote(tt('Запомнил на этом устройстве: ') + learned.join(', ') + '. ' + tt('Стереть — кнопка «Забыть меня».')), 400);
    let go = isAdmin() ? j.go : null;
    if (isAdmin() && !go) {
      // the model sometimes forgets the hint: infer it from the admin's own words
      const t = norm(q);
      if (/брон|заявк|bron|booking/.test(t)) go = { to: 'tab', tab: 'bookings' };
      else if (/добав|нов(ое|ый) блюд|qo'sh|add/.test(t)) go = { to: 'add', cat: '' };
      else if (/цен|стоп|законч|нет в наличии|убра|удал|перенес|narx|tugadi|price|remove|delete/.test(t)) {
        const d = getMenu().map(x => x).sort((a, b) => b.key.length - a.key.length).find(x => t.includes(norm(x.key).replace(/[«»"]/g, '').split(',')[0]));
        if (d) go = { to: 'edit', dish: d.key };
      }
    }
    return { text: j.reply, cards: isAdmin() ? [] : matchDishes(j.dishes), go };
  }
  async function ask(q) {
    if (busy || !q.trim()) return;
    q = q.trim(); addMsg('me', q); aiInput.value = '';
    const fixed = fixLayout(q);
    if (fixed) { sysNote(tt('Похоже, другая раскладка — понял так: ') + '«' + fixed + '»'); q = fixed; }
    let r = intent(q);
    // basket and table maths stay local (exact prices); everything else goes to the AI when it is connected
    if (!r.cart && !r.planAll && aiEndpoint()) {
      busy = true; ava?.classList.add('is-thinking');
      const typing = document.createElement('div'); typing.className = 'msg msg--bot typing pop'; typing.innerHTML = '<i></i><i></i><i></i>'; msgs.append(typing); scrollDown();
      const ai = await askAI(q, typing);
      typing.remove(); busy = false;
      if (ai) { r = ai; r.fast = true; }
    }
    history.push({ role: 'me', text: q }, { role: 'bot', text: r.text }); if (history.length > 20) history.splice(0, history.length - 20);
    try { localStorage.setItem('polvon_chat', JSON.stringify({ t: Date.now(), m: history })); } catch {}
    await botReply(r.text, r);
  }
  function greet() {
    if (greeted) return; greeted = true; renderChips();
    if (history.length) { history.forEach(m => addMsg(m.role === 'me' ? 'me' : 'bot', m.text)); sysNote(tt('Продолжаем с того места, где остановились.')); }
    else botReply(settings().greeting);
  }
  function openAI() {
    if (!panel) return;
    // on the home page the chat may already sit inside the "Не знаете, что выбрать?" block
    if (panel.classList.contains('ai-panel--inline')) { panel.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); setTimeout(() => aiInput?.focus({ preventScroll: true }), 300); return; }
    lastFocus = document.activeElement;
    hideHello?.(); warmAI(); loadNotes(); document.body.classList.add('ai-open'); root.classList.add('ai-open');
    $$('[data-ai-open]').forEach(b => b.setAttribute('aria-expanded', 'true'));
    setTimeout(() => aiInput?.focus({ preventScroll: true }), 120);
    greet();
  }
  function closeAI() {
    root.classList.remove('ai-open'); document.body.classList.remove('ai-open');
    $$('[data-ai-open]').forEach(b => b.setAttribute('aria-expanded', 'false'));
    lastFocus?.focus?.({ preventScroll: true });
  }
  $$('[data-ai-open]').forEach(b => b.addEventListener('click', openAI));
  // the mascot says hello once per session, after the visitor has looked around a little
  const hello = $('[data-ai-hello]'), launch = $('.ai-launch');
  const hideHello = () => { if (!hello || hello.hidden) return; hello.classList.add('is-out'); setTimeout(() => hello.hidden = true, 200); };
  let seenHello = false; try { seenHello = !!sessionStorage.getItem('polvon_hello'); } catch {}
  if (hello && !seenHello) {
    const showHello = () => {
      if (root.classList.contains('ai-open')) return;
      hello.hidden = false; launch?.classList.add('m-wave');
      try { sessionStorage.setItem('polvon_hello', '1'); } catch {}
      setTimeout(hideHello, 8000);
    };
    if (matchMedia('(max-width: 720px)').matches) {
      // on phones the bubble would cover the hero copy: wait until the first screen is scrolled past
      const onScroll = () => { if (scrollY > innerHeight * 0.9) { removeEventListener('scroll', onScroll); setTimeout(showHello, 600); } };
      addEventListener('scroll', onScroll, { passive: true });
    } else {
      setTimeout(showHello, root.dataset.page === 'home' && !root.classList.contains('no-intro') ? 5200 : 3200);
    }
  }
  $('[data-hello-close]')?.addEventListener('click', hideHello);
  $('[data-ai-close]')?.addEventListener('click', closeAI);
  const forgetBtn = $('[data-ai-forget]');
  forgetBtn?.addEventListener('click', () => {
    if (!forgetBtn.dataset.sure) { forgetBtn.dataset.sure = '1'; forgetBtn.textContent = tt('Точно стереть?'); setTimeout(() => { delete forgetBtn.dataset.sure; forgetBtn.textContent = tt('Забыть меня'); }, 3500); return; }
    delete forgetBtn.dataset.sure; forgetBtn.textContent = tt('Забыть меня');
    try { ['polvon_chat', 'polvon_mem', 'polvon_cart'].forEach(k => localStorage.removeItem(k)); sessionStorage.removeItem('polvon_ai_ep'); } catch {}
    history.length = 0; cart.clear?.(); msgs.innerHTML = '';
    sysNote(tt('Готово: переписка и предпочтения стёрты с этого устройства.'));
    botReply(settings().greeting);
  });
  // tap outside the panel closes it
  document.addEventListener('pointerdown', e => {
    if (!root.classList.contains('ai-open') || e.target.closest('#ai-panel, [data-ai-open], .ai-hello, .toast-host')) return;
    closeAI();
  });
  const teaser = $('.ai-teaser');
  if (teaser && 'IntersectionObserver' in window) new IntersectionObserver(([e]) => root.classList.toggle('teaser-in', e.isIntersecting), { threshold: 0.35 }).observe(teaser);
  // live chat inside the home-page block: the same panel moves in while the block is on screen
  const slot = $('[data-chat-preview]'); const home = panel?.parentNode, homeNext = panel?.nextSibling;
  if (slot && panel && 'IntersectionObserver' in window) {
    const mountInline = () => {
      if (panel.classList.contains('ai-panel--inline') || root.classList.contains('ai-open')) return;
      slot.after(panel); panel.classList.add('ai-panel--inline'); root.classList.add('ai-inline');
      panel.setAttribute('role', 'region'); warmAI(); loadNotes(); greet();
    };
    const unmountInline = () => {
      if (!panel.classList.contains('ai-panel--inline')) return;
      if (panel.contains(document.activeElement)) return;        // the guest is typing: keep it in place
      panel.classList.remove('ai-panel--inline'); root.classList.remove('ai-inline');
      panel.setAttribute('role', 'dialog'); home.insertBefore(panel, homeNext);
    };
    new IntersectionObserver(([e]) => e.isIntersecting ? mountInline() : unmountInline(), { rootMargin: '200px 0px' }).observe(slot.parentElement);
  }
  // hints scroll: wheel, drag and arrows
  const chipWrap = $('.ai-chips-wrap');
  if (chipWrap && chipsBox) {
    const upd = () => { chipWrap.classList.toggle('can-l', chipsBox.scrollLeft > 4); chipWrap.classList.toggle('can-r', chipsBox.scrollLeft + chipsBox.clientWidth < chipsBox.scrollWidth - 4); };
    chipsBox.addEventListener('scroll', upd, { passive: true }); addEventListener('resize', upd);
    new MutationObserver(upd).observe(chipsBox, { childList: true });
    chipsBox.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX)) { chipsBox.scrollLeft += e.deltaY; e.preventDefault(); } }, { passive: false });
    let sx = 0, sl = 0, moved = false, down = false;
    chipsBox.addEventListener('pointerdown', e => { if (e.pointerType !== 'mouse') return; down = true; moved = false; sx = e.clientX; sl = chipsBox.scrollLeft; });
    addEventListener('pointermove', e => { if (!down) return; const dx = e.clientX - sx; if (Math.abs(dx) > 5) { moved = true; chipsBox.classList.add('is-dragging'); } chipsBox.scrollLeft = sl - dx; });
    addEventListener('pointerup', () => { if (!down) return; down = false; setTimeout(() => chipsBox.classList.remove('is-dragging'), 0); });
    chipsBox.addEventListener('click', e => { if (moved) { e.stopPropagation(); e.preventDefault(); moved = false; } }, true);
    $$('[data-chip-dir]', chipWrap).forEach(b => b.addEventListener('click', () => chipsBox.scrollBy({ left: +b.dataset.chipDir * chipsBox.clientWidth * 0.7, behavior: reduce ? 'auto' : 'smooth' })));
    upd();
  }
  addEventListener('keydown', e => { if (e.key === 'Escape' && root.classList.contains('ai-open')) closeAI(); });
  aiForm?.addEventListener('submit', e => { e.preventDefault(); ask(aiInput.value); });

  // chat preview on the home page: plays once when scrolled into view
  const preview = $('[data-chat-preview]');
  if (preview && 'IntersectionObserver' in window) {
    const io = new IntersectionObserver(async ([e]) => {
      if (!e.isIntersecting) return; io.disconnect();
      const add = (who, text) => { const m = document.createElement('div'); m.className = `msg msg--${who} pop`; m.textContent = text; preview.append(m); return m; };
      await sleep(300); add('me', tt('Мы впервые, что взять на двоих?'));
      const pava = $('[data-preview-ava]'); pava?.classList.add('is-thinking');
      await sleep(500); const t = add('bot', ''); t.classList.add('typing'); t.innerHTML = '<i></i><i></i><i></i>';
      await sleep(reduce ? 100 : 1100); t.classList.remove('typing'); pava?.classList.remove('is-thinking'); pava?.classList.add('is-talking');
      const txt = tt('Возьмите ковурма лагман и норин на двоих, а к ним пару шампуров Наполеона.');
      if (reduce) t.textContent = txt; else { t.classList.add('caret'); for (let i = 0; i <= txt.length; i += 2) { t.textContent = txt.slice(0, i); await sleep(18); } t.classList.remove('caret'); }
      pava?.classList.remove('is-talking'); await sleep(200); renderCards(pick(['Ковурма лагман', 'Норин, 250 г', 'Наполеон']), preview);
    }, { threshold: 0.4 });
    io.observe(preview);
  }

  /* ---------------- MENU page ---------------- */
  const catNav = $('[data-cat-nav]');
  if (catNav) {
    const links = $$('a', catNav), pill = $('.cat-pill', catNav);
    const sections = links.map(a => $(a.getAttribute('href')));
    let active = null;
    const setActive = (a) => {
      if (!a || a === active) return; active = a;
      links.forEach(l => l.classList.toggle('is-active', l === a));
      pill.style.width = a.offsetWidth + 'px'; pill.style.transform = `translateX(${a.offsetLeft}px)`;
      const target = a.offsetLeft - catNav.clientWidth / 2 + a.offsetWidth / 2;
      catNav.scrollTo({ left: target, behavior: reduce ? 'auto' : 'smooth' });
    };
    const spy = () => {
      const y = (parseFloat(getComputedStyle(root).scrollPaddingTop) || 160) + 80;
      let cur = links[0];
      sections.forEach((s, i) => { if (s && !s.classList.contains('is-empty') && s.getBoundingClientRect().top <= y) cur = links[i]; });
      setActive(cur);
    };
    let tk = false;
    addEventListener('scroll', () => { if (!tk) { tk = true; requestAnimationFrame(() => { tk = false; spy(); }); } }, { passive: true });
    addEventListener('resize', () => { const a = active; active = null; setActive(a); });
    spy();

    // filters (an item must have every selected tag)
    const chips = $$('[data-filter]'); const selected = new Set();
    chips.forEach(c => c.addEventListener('click', () => {
      const f = c.dataset.filter; selected.has(f) ? selected.delete(f) : selected.add(f);
      c.setAttribute('aria-pressed', String(selected.has(f)));
      applyFilter();
    }));
    const search = $('[data-menu-search]'), empty = $('[data-menu-empty]');
    const norm = s => s.toLowerCase().replace(/[‘’'`ʻ]/g, '').replace(/ё/g, 'е').trim();
    search?.addEventListener('input', () => applyFilter());
    function applyFilter() {
      const q = norm(search?.value || '');
      $$('.menu-item').forEach(li => {
        const tags = (li.dataset.tags || '').split(' ');
        const show = [...selected].every(t => tags.includes(t)) && (!q || norm(li.dataset.search || '').includes(q));
        const was = !li.classList.contains('is-hidden');
        li.classList.toggle('is-hidden', !show);
        if (show && !was && !reduce) { li.classList.add('is-entering'); requestAnimationFrame(() => requestAnimationFrame(() => li.classList.remove('is-entering'))); }
      });
      $$('.menu-cat').forEach(s => s.classList.toggle('is-empty', !$$('.menu-item:not(.is-hidden)', s).length));
      if (empty) empty.hidden = !!$('.menu-item:not(.is-hidden)');
      spy();
    }

    // overrides from the admin panel: price, stop-list, hit
    const listOf = cat => $(`#${cat} .menu-list`);
    function buildLi(d) {
      const li = document.createElement('li'); li.className = 'menu-item'; li.id = d.id; li.dataset.id = d.id;
      li.dataset.search = (d.name + ' ' + (d.desc || '')).toLowerCase();
      li.innerHTML = (d.img ? `<div class="dish-ph"><img src="${esc(d.img)}" alt="${esc(d.name)}" width="600" height="450" loading="lazy"></div>`
        : `<div class="dish-ph dish-ph--empty"><span class="ph-name">${esc(d.name)}</span><small>${esc(tt('Фото скоро'))}</small></div>`)
        + `<div class="menu-item-top"><h3>${esc(d.name)}</h3><span class="price" data-price></span></div>`
        + (d.desc ? `<p>${esc(d.desc)}</p>` : '')
        + `<div class="meta"><span class="unit">${esc(d.weight || tt('1 порция'))}</span><button class="edit-btn" type="button" data-edit><svg class="icon" aria-hidden="true"><use href="#i-edit"/></svg>${esc(tt('Изменить'))}</button></div>`;
      return li;
    }
    function applyOverrides() {
      const m = getMenu(); const live = new Set(m.map(d => d.id));
      $$('.menu-item').forEach(li => li.classList.toggle('is-deleted', !live.has(li.dataset.id)));
      m.forEach(d => {
        let li = document.getElementById(d.id);
        if (!li && d.custom) { li = buildLi(d); listOf(d.cat)?.append(li); }
        if (!li) return;
        if (li.closest('.menu-cat')?.id !== d.cat && listOf(d.cat)) listOf(d.cat).append(li);
        if (d.custom && !$('.tag--new', li)) li.classList.add('is-custom');
        $('[data-price]', li).textContent = d.price ? fmt(d.price) : tt('цена уточняется');
        li.classList.toggle('is-stop', d.stop);
        li.dataset.tags = d.tags.join(' ');
        const meta = $('.meta', li);
        $$('.tag', meta).forEach(t => t.remove());
        const edit = $('[data-edit]', meta);
        const labels = { hit: tt('Хит'), spicy: tt('Острое'), veg: tt('Без мяса') };
        d.tags.forEach(t => { const s = document.createElement('span'); s.className = 'tag tag--' + t; s.textContent = labels[t]; meta.insertBefore(s, edit); });
        if (d.stop) { const s = document.createElement('span'); s.className = 'tag tag--stop'; s.textContent = tt('Нет в наличии'); meta.insertBefore(s, edit); }
      });
      $$('.menu-cat').forEach(sec => {
        const n = $$('.menu-item:not(.is-deleted)', sec).length;
        const c = $('[data-cat-count]', sec); if (c) c.textContent = `${n} ${tt('позиций')}`;
        const nav = $(`.cat-nav a[href="#${sec.id}"] small`); if (nav) nav.textContent = n;
      });
    }
    applyOverrides(); applyFilter();
    document.addEventListener('polvon:menu', () => { applyOverrides(); applyFilter(); const d = getMenu().slice(-1)[0]; document.getElementById(d.id)?.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' }); });

    // inline edit (admin)
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-edit]'); if (!btn || !isAdmin()) return;
      const li = btn.closest('.menu-item'); const d = getMenu().find(x => x.id === li.dataset.id);
      if ($('.inline-edit', li)) return;
      const box = document.createElement('div'); box.className = 'inline-edit';
      box.style.cssText = 'grid-column:1/-1;display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:12px;background:var(--cobalt-tint);border-radius:12px;margin-top:6px';
      box.innerHTML = `<label style="display:flex;gap:8px;align-items:center;font-size:14px;font-weight:600">Цена <input type="number" step="1000" min="0" value="${d.price ?? ''}" style="height:40px;width:130px;border:1px solid var(--line-strong);border-radius:8px;padding:0 10px"></label>
        <label style="display:flex;gap:8px;align-items:center;font-size:14px;font-weight:600"><span class="switch"><input type="checkbox" ${d.stop ? 'checked' : ''}><span></span></span>Стоп-лист</label>
        <label style="display:flex;gap:8px;align-items:center;font-size:14px;font-weight:600">${tt('Раздел')} <select data-cat-sel>${Object.entries(CAT_TITLES).map(([k, v]) => `<option value="${k}" ${k === d.cat ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select></label>
        <button class="mini-btn" type="button" data-save style="margin-left:auto">${tt('Сохранить')}</button><button class="mini-btn" type="button" data-cancel>${tt('Отмена')}</button><button class="mini-btn mini-btn--danger" type="button" data-remove>${tt('Удалить')}</button>`;
      li.append(box); $('input[type=number]', box).focus();
      $('[data-cancel]', box).onclick = () => box.remove();
      $('[data-save]', box).onclick = () => {
        const cat = $('[data-cat-sel]', box).value;
        setOverride(d.id, { price: Math.max(0, parseInt($('input[type=number]', box).value, 10) || 0), stop: $('input[type=checkbox]', box).checked, cat: cat !== d.cat || (store.get('menu', {})[d.id] || {}).cat ? cat : undefined });
        box.remove(); applyOverrides(); applyFilter(); toast(tt('Сохранено: ') + d.name);
      };
      const rm = $('[data-remove]', box);
      rm.onclick = () => {
        if (!rm.dataset.sure) { rm.dataset.sure = '1'; rm.textContent = tt('Точно удалить?'); return; }
        if (d.custom) store.set('custom', store.get('custom', []).filter(x => x.id !== d.id)); else setOverride(d.id, { deleted: true });
        box.remove(); applyOverrides(); applyFilter(); toast(tt('Удалено: ') + d.name);
      };
    });
  }

  /* ---------------- admin: arrive from an assistant hint ---------------- */
  function runAdminJump() {
    if (!isAdmin()) return;
    const mode = new URLSearchParams(location.search).get('admin'); const id = decodeURIComponent(location.hash.slice(1));
    if (!mode || !id) return;
    setTimeout(() => {
      if (mode === 'edit') {
        const li = document.getElementById(id); if (!li) return;
        li.scrollIntoView({ block: 'center', behavior: reduce ? 'auto' : 'smooth' });
        li.classList.add('flash'); setTimeout(() => li.classList.remove('flash'), 2200);
        if (!$('.inline-edit', li)) $('[data-edit]', li)?.click();
      } else if (mode === 'add') {
        const sec = document.getElementById(id); if (!sec) return;
        sec.scrollIntoView({ block: 'start', behavior: reduce ? 'auto' : 'smooth' });
        $('[data-add-dish]', sec)?.click();
      }
      window.history.replaceState(null, '', location.pathname + location.hash);
    }, 350);
  }
  if (root.dataset.page === 'menu') addEventListener('load', runAdminJump);

  /* ---------------- admin: add a dish to a section ---------------- */
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-add-dish]'); if (!b || !isAdmin()) return;
    const sec = b.closest('.menu-cat'); if ($('.admin-dish-form', sec)) return;
    const f = document.createElement('form'); f.className = 'admin-dish-form';
    f.innerHTML = `<input name="name" required placeholder="${tt('Название блюда')}" aria-label="${tt('Название блюда')}">
      <input name="price" type="number" min="0" step="1000" required placeholder="${tt('Цена, сум')}" aria-label="${tt('Цена, сум')}">
      <input name="weight" placeholder="${tt('Выход, например 1 порция')}" aria-label="${tt('Выход')}">
      <select name="cat" aria-label="${tt('Раздел')}">${Object.entries(CAT_TITLES).map(([k, v]) => `<option value="${k}" ${k === b.dataset.addDish ? 'selected' : ''}>${esc(v)}</option>`).join('')}</select>
      <textarea name="desc" placeholder="${tt('Состав или описание')}" aria-label="${tt('Состав или описание')}"></textarea>
      <div class="row"><label class="mini-btn" style="display:inline-flex;align-items:center;cursor:pointer">${tt('Фото')}<input name="photo" type="file" accept="image/*" hidden></label><span class="muted" data-photo-name style="font-size:13px"></span>
      <button class="mini-btn" type="submit" style="margin-left:auto">${tt('Добавить')}</button><button class="mini-btn" type="button" data-x>${tt('Отмена')}</button></div>`;
    $('.menu-list', sec).before(f); f.name.focus();
    let photo = null;
    f.photo.addEventListener('change', () => {
      const file = f.photo.files[0]; if (!file) return;
      const im = new Image(); im.onload = () => {   // shrink to 600px so it fits in browser storage
        const c = document.createElement('canvas'); const k = Math.min(1, 600 / im.width); c.width = im.width * k; c.height = im.height * k;
        c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); photo = c.toDataURL('image/webp', 0.8); $('[data-photo-name]', f).textContent = file.name;
      }; im.src = URL.createObjectURL(file);
    });
    $('[data-x]', f).onclick = () => f.remove();
    f.addEventListener('submit', ev => {
      ev.preventDefault();
      const d = { id: 'custom-' + Date.now().toString(36), key: f.name.value.trim(), name: f.name.value.trim(), cat: f.cat.value, desc: f.desc.value.trim(),
                  weight: f.weight.value.trim() || tt('1 порция'), price: Math.max(0, parseInt(f.price.value, 10) || 0), img: photo, tags: [] };
      try { store.set('custom', [...store.get('custom', []), d]); } catch { toast(tt('Фото слишком большое')); return; }
      f.remove(); document.dispatchEvent(new CustomEvent('polvon:menu')); toast(tt('Добавлено: ') + d.name);
    });
  });

  /* ---------------- booking form ---------------- */
  const booking = $('[data-booking]');
  if (booking) {
    const date = $('#b-date'), time = $('#b-time'); const today = new Date();
    const iso = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    date.min = iso(today); const tm = new Date(today); tm.setDate(tm.getDate() + 1);
    // tap-to-pick: 21 days ahead, 30-minute slots
    const daysBox = $('[data-days]'), timesBox = $('[data-times]');
    const SLOTS = []; for (let h = 10; h <= 22; h++) for (const m of [0, 30]) if (!(h === 22 && m === 30)) SLOTS.push(`${String(h).padStart(2, '0')}:${m ? '30' : '00'}`);
    const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
    const WD = { ru: ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'], uz: ['Yak', 'Du', 'Se', 'Chor', 'Pay', 'Ju', 'Sha'], en: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'] }[LANG] || [];
    const MO = { ru: ['янв', 'фев', 'мар', 'апр', 'мая', 'июн', 'июл', 'авг', 'сен', 'окт', 'ноя', 'дек'], uz: ['yan', 'fev', 'mar', 'apr', 'may', 'iyn', 'iyl', 'avg', 'sen', 'okt', 'noy', 'dek'], en: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] }[LANG] || [];
    function renderDays() {
      daysBox.innerHTML = '';
      for (let i = 0; i < 21; i++) {
        const d = new Date(today); d.setDate(today.getDate() + i);
        const b = document.createElement('button'); b.type = 'button'; b.className = 'day'; b.dataset.v = iso(d); b.setAttribute('role', 'radio');
        const top = i === 0 ? tt('Сегодня') : i === 1 ? tt('Завтра') : WD[d.getDay()];
        b.innerHTML = `<small>${esc(top)}</small><b>${d.getDate()}</b><small>${esc(MO[d.getMonth()])}</small>`;
        if (d.getDay() === 0 || d.getDay() === 6) b.classList.add('is-weekend');
        b.addEventListener('click', () => setDate(b.dataset.v, true));
        daysBox.append(b);
      }
    }
    function renderTimes() {
      timesBox.innerHTML = '';
      const now = new Date(); const isToday = date.value === iso(now);
      const groups = [[tt('Днём'), SLOTS.filter(t => t < '17:00')], [tt('Вечером'), SLOTS.filter(t => t >= '17:00')]];
      groups.forEach(([title, list]) => {
        const g = document.createElement('div'); g.className = 'time-group'; g.innerHTML = `<span>${esc(title)}</span>`;
        const row = document.createElement('div'); row.className = 'time-row';
        list.forEach(t => {
          const b = document.createElement('button'); b.type = 'button'; b.className = 'slot'; b.textContent = t; b.dataset.v = t; b.setAttribute('role', 'radio');
          const [h, m] = t.split(':').map(Number);
          if (isToday && h * 60 + m < now.getHours() * 60 + now.getMinutes() + 60) { b.disabled = true; }
          b.addEventListener('click', () => setTime(t));
          row.append(b);
        });
        g.append(row); timesBox.append(g);
      });
      const cur = $(`.slot[data-v="${time.value}"]:not(:disabled)`, timesBox) || $('.slot:not(:disabled)', timesBox);
      setTime(cur ? cur.dataset.v : '');
    }
    function setDate(v, user) {
      date.value = v;
      $$('.day', daysBox).forEach(b => { const on = b.dataset.v === v; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on); b.tabIndex = on ? 0 : -1; });
      const on = $('.day.is-on', daysBox);
      if (on && user) on.scrollIntoView({ inline: 'center', block: 'nearest', behavior: reduce ? 'auto' : 'smooth' });
      renderTimes();
    }
    function setTime(v) {
      time.value = v;
      $$('.slot', timesBox).forEach(b => { const on = b.dataset.v === v; b.classList.toggle('is-on', on); b.setAttribute('aria-checked', on); });
    }
    $$('[data-scroll="days"]', booking).forEach(n => n.addEventListener('click', () => daysBox.scrollBy({ left: +n.dataset.dir * daysBox.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' })));
    // arrow keys move between days
    daysBox.addEventListener('keydown', e => {
      if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return; e.preventDefault();
      const all = $$('.day', daysBox); const i = all.findIndex(b => b.classList.contains('is-on'));
      const n = all[Math.min(all.length - 1, Math.max(0, i + (e.key === 'ArrowRight' ? 1 : -1)))]; setDate(n.dataset.v, true); n.focus();
    });
    renderDays(); time.value = '19:00'; setDate(iso(tm));
    let guests = 2; const out = $('[data-guests]');
    $$('[data-g]', booking).forEach(b => b.addEventListener('click', () => {
      guests = Math.min(40, Math.max(1, guests + Number(b.dataset.g))); out.textContent = guests;
      if (!reduce) out.animate([{ transform: 'scale(1.25)' }, { transform: 'none' }], { duration: 260, easing: SPRING_SOFT });
    }));
    const success = $('[data-success]');
    booking.addEventListener('submit', e => {
      e.preventDefault();
      let ok = true;
      const need = [['name', v => v.trim().length >= 2, tt('Напишите, как к вам обращаться')],
                    ['phone', v => v.replace(/\D/g, '').length >= 9, tt('Нужен номер, по которому мы перезвоним')],
                    ['date', v => !!v && v >= date.min, tt('Выберите дату не раньше сегодняшней')]];
      need.forEach(([n, test, msg]) => {
        const inp = booking.elements[n]; const f = inp.closest('.field');
        const good = test(inp.value); f.toggleAttribute('data-invalid', !good); f.querySelector('.err').textContent = good ? '' : msg;
        if (!good && ok) { ok = false; inp.focus(); }
      });
      if (ok && !time.value) { ok = false; const f = time.closest('.field'); f.toggleAttribute('data-invalid', true); f.querySelector('.err').textContent = tt('Выберите время'); }
      else time.closest('.field').toggleAttribute('data-invalid', false);
      if (!ok) return;
      const b = { id: Date.now(), name: booking.elements.name.value.trim(), phone: booking.elements.phone.value.trim(), date: date.value, time: booking.elements.time.value, guests, zone: booking.elements.zone.value, note: booking.elements.note.value.trim(), status: 'new' };
      const list = store.get('bookings', []); list.unshift(b); store.set('bookings', list);
      const dd = new Date(b.date + 'T00:00'); const d = `${dd.getDate()} ${MO[dd.getMonth()]} (${WD[dd.getDay()]})`;
      $('[data-success-text]').textContent = tt('{name}, ждём вас {date} в {time}, гостей: {n}.').replace('{name}', b.name).replace('{date}', d).replace('{time}', b.time).replace('{n}', b.guests);
      booking.hidden = true; success.classList.add('is-on'); success.querySelector('h2').setAttribute('tabindex', '-1'); success.querySelector('h2').focus();
    });
    $('[data-again]')?.addEventListener('click', () => { success.classList.remove('is-on'); booking.hidden = false; booking.reset(); guests = 2; out.textContent = 2; time.value = '19:00'; setDate(iso(tm)); });
  }

  /* ---------------- ADMIN page ---------------- */
  if (root.dataset.page === 'admin') {
    const loginBox = $('[data-admin-login]'), app = $('[data-admin-app]');
    const show = () => { const on = isAdmin(); loginBox.hidden = on; app.hidden = !on; if (on) renderAll(); };
    loginBox.addEventListener('submit', e => { e.preventDefault(); handleLogin(loginBox, $('#a-pass'), show); });
    document.addEventListener('admin-change', show);

    const tabs = $$('[role=tab]', app);
    const fromHash = () => { const t = $('#t-' + location.hash.slice(1), app); if (t) t.click(); };
    setTimeout(fromHash, 0); addEventListener('hashchange', fromHash);
    tabs.forEach(t => t.addEventListener('click', () => {
      tabs.forEach(x => x.setAttribute('aria-selected', String(x === t)));
      $$('.admin-panel', app).forEach(p => p.hidden = p.id !== t.getAttribute('aria-controls'));
      const p = $('#' + t.getAttribute('aria-controls'));
      if (!reduce) p.animate([{ opacity: 0, transform: 'translateY(6px)' }, { opacity: 1, transform: 'none' }], { duration: 220, easing: EASE });
    }));

    function renderKpis() {
      const m = getMenu();
      $('[data-kpi=bookings]').textContent = store.get('bookings', []).length;
      $('[data-kpi=dishes]').textContent = m.length;
      $('[data-kpi=stop]').textContent = m.filter(d => d.stop).length;
    }
    function renderBookings() {
      const host = $('[data-bookings]'); const list = store.get('bookings', []);
      if (!list.length) { host.innerHTML = tt('<div class="empty-state">Заявок пока нет. Отправьте тестовую с <a href="contact.html#booking">страницы контактов</a>.</div>'); return; }
      host.innerHTML = `<table class="data"><thead><tr><th>Гость</th><th>Телефон</th><th>Когда</th><th>Гостей</th><th>Зона</th><th>Пожелания</th><th>Статус</th><th></th></tr></thead><tbody>${list.map(b => `
        <tr data-id="${b.id}"><td><b>${esc(b.name)}</b></td><td><a href="tel:${esc(b.phone)}">${esc(b.phone)}</a></td><td class="num" style="white-space:nowrap">${esc(b.date)} ${esc(b.time)}</td><td class="num">${b.guests}</td><td>${esc(b.zone)}</td><td>${esc(b.note || '—')}</td>
        <td><span class="status-pill ${b.status === 'ok' ? 'status-pill--ok' : ''}">${b.status === 'ok' ? tt('Подтверждена') : tt('Новая')}</span></td>
        <td><div class="row-actions">${b.status === 'ok' ? '' : tt('<button class="mini-btn" data-ok>Подтвердить</button>')}<button class="mini-btn" data-del>Удалить</button></div></td></tr>`).join('')}</tbody></table>`;
    }
    function renderOrders() {
      const host = $('[data-orders]'); if (!host) return; const list = store.get('orders', []);
      const k = $('[data-kpi=orders]'); if (k) k.textContent = list.length;
      if (!list.length) { host.innerHTML = `<div class="empty-state">${esc(tt('Заказов пока нет. Добавьте блюда кнопкой «+» в меню и оформите доставку.'))}</div>`; return; }
      const TYPE = { delivery: tt('Доставка'), pickup: tt('Навынос'), table: tt('Стол') }, PAY = { cash: tt('Наличными'), transfer: tt('Переводом') };
      host.innerHTML = `<table class="data"><thead><tr><th>${esc(tt('Тип'))}</th><th>${esc(tt('Гость'))}</th><th>${esc(tt('Заказ'))}</th><th>${esc(tt('Сумма'))}</th><th>${esc(tt('Адрес и время'))}</th><th>${esc(tt('Статус'))}</th><th></th></tr></thead><tbody>${list.map(o => `
        <tr data-id="${o.id}"><td><span class="type-pill type-pill--${o.type}">${esc(TYPE[o.type] || o.type)}${o.table ? ' №' + esc(o.table) : ''}</span></td><td>${o.phone ? `<b>${esc(o.name)}</b><br><a href="tel:${esc(o.phone)}">${esc(o.phone)}</a>` : '—'}</td><td>${esc(o.items)}${o.note ? `<br><small class="muted">${esc(o.note)}</small>` : ''}</td><td class="num" style="white-space:nowrap">${fmt(o.total)}${o.pay ? `<br><small class="muted">${esc(PAY[o.pay] || '')}</small>` : ''}</td><td>${esc(o.address || (o.lat ? '' : '—'))}${o.lat ? `${o.address ? '<br>' : ''}<a class="geo-link" href="https://yandex.uz/maps/?pt=${o.lon},${o.lat}&z=17&l=map" target="_blank" rel="noopener">📍 ${esc(tt('На карте'))}</a>${o.live ? ` <span class="live-pill">${esc(tt('онлайн'))}</span>` : ''}` : ''}<br><small class="muted">${esc(o.when)}</small></td>
        <td><span class="status-pill ${o.status === 'ok' ? 'status-pill--ok' : ''}">${o.status === 'ok' ? esc(tt('Принят')) : esc(tt('Новый'))}</span></td>
        <td><div class="row-actions">${o.status === 'ok' ? '' : `<button class="mini-btn" data-ook>${esc(tt('Принять'))}</button>`}<button class="mini-btn" data-odel>${esc(tt('Удалить'))}</button></div></td></tr>`).join('')}</tbody></table>`;
    }
    $('[data-orders]')?.addEventListener('click', e => {
      const tr = e.target.closest('tr'); if (!tr) return; const id = Number(tr.dataset.id);
      let list = store.get('orders', []);
      if (e.target.closest('[data-ook]')) { list = list.map(o => o.id === id ? { ...o, status: 'ok' } : o); toast(tt('Заказ принят')); }
      else if (e.target.closest('[data-odel]')) { list = list.filter(o => o.id !== id); toast(tt('Заказ удалён')); }
      else return;
      store.set('orders', list); renderOrders();
    });
    $('[data-bookings]')?.addEventListener('click', e => {
      const tr = e.target.closest('tr'); if (!tr) return; const id = Number(tr.dataset.id);
      let list = store.get('bookings', []);
      if (e.target.closest('[data-ok]')) { list = list.map(b => b.id === id ? { ...b, status: 'ok' } : b); toast(tt('Бронь подтверждена')); }
      else if (e.target.closest('[data-del]')) { list = list.filter(b => b.id !== id); toast(tt('Заявка удалена')); }
      else return;
      store.set('bookings', list); renderBookings(); renderKpis();
    });
    function renderMenuEditor() {
      const host = $('[data-menu-editor]'); const m = getMenu(); let cat = '';
      host.innerHTML = `<table class="data"><thead><tr><th>Блюдо</th><th>Выход</th><th>Цена, сум</th><th>Хит</th><th>Стоп-лист</th></tr></thead><tbody>${m.map(d => {
        const row = (d.cat !== cat ? `<tr class="cat-row"><td colspan="5">${esc(d.catTitle)}</td></tr>` : '') + `
        <tr data-id="${d.id}"><td>${esc(d.name)}</td><td class="muted">${esc(d.weight)}</td>
        <td><input type="number" step="1000" min="0" value="${d.price ?? ''}" placeholder="уточняется" data-f="price" aria-label="Цена: ${esc(d.name)}"></td>
        <td><label class="switch"><input type="checkbox" data-f="hit" ${d.tags.includes('hit') ? 'checked' : ''} aria-label="Хит: ${esc(d.name)}"><span></span></label></td>
        <td><label class="switch"><input type="checkbox" data-f="stop" ${d.stop ? 'checked' : ''} aria-label="Стоп-лист: ${esc(d.name)}"><span></span></label></td></tr>`;
        cat = d.cat; return row; }).join('')}</tbody></table>`;
    }
    let saveT;
    $('[data-menu-editor]')?.addEventListener('change', e => {
      const inp = e.target.closest('[data-f]'); if (!inp) return; const id = inp.closest('tr').dataset.id;
      const f = inp.dataset.f; setOverride(id, { [f]: f === 'price' ? (inp.value === '' ? null : Math.max(0, parseInt(inp.value, 10) || 0)) : inp.checked });
      renderKpis(); clearTimeout(saveT); saveT = setTimeout(() => toast(tt('Сохранено')), 150);
    });
    $('[data-menu-reset]')?.addEventListener('click', () => { store.del('menu'); store.del('custom'); renderMenuEditor(); renderKpis(); toast(tt('Меню сброшено к исходному')); });
    const notesForm = $('[data-ai-notes]');
    if (notesForm) {
      const st = $('[data-notes-status]'), meta = $('[data-notes-meta]');
      const N = () => window.POLVON_NOTES;
      const gas = () => N()?.gasUrl();
      const call = body => fetch(gas(), { method: 'POST', headers: { 'Content-Type': 'text/plain;charset=utf-8' }, body: JSON.stringify(body) }).then(r => r.json());
      if (gas()) call({ action: 'notes_get' }).then(j => { notesForm.notes.value = j.notes || ''; if (j.updated) meta.textContent = tt('Обновлено: ') + new Date(j.updated).toLocaleString(LOCALE); })
        .catch(() => meta.textContent = tt('Не удалось загрузить из Google.'));
      else meta.textContent = tt('Адрес Google-сервера не подключён.');
      const save = notes => {
        if (!gas()) return;
        st.textContent = tt('Сохраняем…');
        call({ action: 'notes_set', password: notesForm.password.value, notes }).then(j => {
          if (j.ok) { notesForm.notes.value = j.notes; st.textContent = tt('Сохранено. Помощник уже рассказывает об этом всем гостям.'); N()?.reset(); toast(tt('Сохранено для всех')); meta.textContent = tt('Обновлено: ') + new Date().toLocaleString(LOCALE); }
          else st.textContent = j.error === 'wrong password' ? tt('Неверный пароль.') : tt('Ошибка: ') + (j.error || '');
        }).catch(() => st.textContent = tt('Не удалось связаться с Google. Обновлён ли код в Google Apps Script?'));
      };
      notesForm.addEventListener('submit', e => { e.preventDefault(); save(notesForm.notes.value.trim()); });
      $('[data-notes-clear]')?.addEventListener('click', () => { if (!notesForm.password.value) { notesForm.password.focus(); st.textContent = tt('Введите пароль.'); return; } save(''); });
    }
    const aiSet = $('[data-ai-settings]');
    aiSet?.addEventListener('submit', e => { e.preventDefault(); store.set('ai', { greeting: aiSet.greeting.value, tone: aiSet.tone.value, endpoint: aiSet.endpoint.value.trim() }); toast(tt('Настройки помощника сохранены'));
      const st = $('[data-ai-status]'); const u = aiSet.endpoint.value.trim();
      if (st && u) { st.textContent = tt('Проверяем подключение…');
        Promise.all(u.split(/[\s,]+/).filter(Boolean).map(url => {
          const gas = /script\.google/.test(url);
          return fetch(url, { method: 'POST', redirect: 'follow', headers: { 'Content-Type': gas ? 'text/plain;charset=utf-8' : 'application/json' }, body: JSON.stringify({ messages: [{ role: 'me', text: 'Привет' }] }) })
            .then(r => r.json().then(j => (gas ? 'Google: ' : 'Cloudflare: ') + (j.reply ? '✓ ' + j.reply : tt('Ошибка: ') + (j.error || r.status) + (j.detail ? ' — ' + j.detail : ''))))
            .catch(() => (gas ? 'Google: ' : 'Cloudflare: ') + tt('не открывается из этой сети'));
        })).then(lines => st.textContent = lines.join('  |  ')); } });
    function renderAll() {
      renderKpis(); renderBookings(); renderOrders(); renderMenuEditor();
      if (aiSet) { const s = settings(); aiSet.greeting.value = s.greeting; aiSet.tone.value = s.tone; aiSet.endpoint.value = store.get('ai', {}).endpoint || ''; }
    }
    show();
  }
})();

/* ---------------- maps: load when scrolled near, switch Yandex / Google ---------------- */
(() => {
  document.querySelectorAll('[data-map]').forEach(card => {
    const frames = card.querySelectorAll('[data-frame]'), pin = card.querySelector('.map-pin');
    const load = f => { if (!f.src) { setTimeout(() => { if (!f.classList.contains('is-loaded')) pin.querySelector('span').textContent = tt('Карта не загрузилась — откройте её по кнопке ниже'); }, 9000); f.src = f.dataset.src; f.addEventListener('load', () => { f.classList.add('is-loaded'); if (!f.hidden) pin.classList.add('is-gone'); }, { once: true }); } };
    const show = k => {
      card.querySelectorAll('[data-map-tab]').forEach(t => t.setAttribute('aria-selected', String(t.dataset.mapTab === k)));
      frames.forEach(f => { const on = f.dataset.frame === k; f.hidden = !on; if (on) { load(f); pin.classList.toggle('is-gone', f.classList.contains('is-loaded')); } });
    };
    card.querySelectorAll('[data-map-tab]').forEach(t => t.addEventListener('click', () => show(t.dataset.mapTab)));
    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(([e]) => { if (e.isIntersecting) { show('y'); io.disconnect(); } }, { rootMargin: '300px' });
      io.observe(card);
    } else show('y');
  });
})();

/* ---------------- theme (light / dark) + ornament in-view ---------------- */
(() => {
  const d = document.documentElement;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const meta = document.querySelector('meta[name="theme-color"]');
  const sync = () => { if (meta) meta.content = d.dataset.theme === 'light' ? '#f6efe2' : '#12100e'; };
  sync();
  const btn = document.querySelector('[data-theme-toggle]');
  btn?.addEventListener('click', e => {
    const next = d.dataset.theme === 'light' ? 'dark' : 'light';
    const apply = () => {
      d.dataset.theme = next; sync();
      try { localStorage.setItem('polvon_theme', next); } catch {}
      try { sessionStorage.setItem('polvon_theme', next); } catch {}
      try { document.cookie = `polvon_theme=${next}; path=/; max-age=31536000; SameSite=Lax`; } catch {}
    };
    if (!document.startViewTransition || reduce) { apply(); return; }
    // the new theme grows as a circle out of the button
    const r = btn.getBoundingClientRect(), x = r.left + r.width / 2, y = r.top + r.height / 2;
    const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
    d.classList.add('theme-switching');
    const vt = document.startViewTransition(apply);
    vt.ready.then(() => d.animate({ clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
      { duration: 620, easing: 'cubic-bezier(0.77, 0, 0.175, 1)', pseudoElement: '::view-transition-new(root)' }));
    vt.finished.finally(() => d.classList.remove('theme-switching'));
  });
  const els = document.querySelectorAll('.medallion, .orn-rule, .table-orn');
  if (!('IntersectionObserver' in window) || reduce) { els.forEach(el => el.classList.add('in')); return; }
  const io = new IntersectionObserver(es => es.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } }), { threshold: 0.25 });
  els.forEach(el => io.observe(el));
})();
