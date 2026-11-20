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
  function getMenu() {
    const ov = store.get('menu', {});
    return BASE_MENU.map(d => {
      const o = ov[d.id] || {};
      const tags = d.tags.filter(t => t !== 'hit');
      const hit = o.hit !== undefined ? o.hit : d.tags.includes('hit');
      return { ...d, price: o.price ?? d.price, stop: !!o.stop, tags: hit ? ['hit', ...tags] : tags };
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

  /* ---------------- category list: a photo follows the cursor ---------------- */
  const cats = $('[data-cats]'), prev = $('[data-cat-preview]');
  if (cats && prev && finePointer && !reduce) {
    const imgs = {};
    let tx = 0, ty = 0, x = 0, y = 0, raf = 0, on = false;
    const loop = () => {
      x += (tx - x) * 0.16; y += (ty - y) * 0.16;
      prev.style.left = x + 'px'; prev.style.top = y + 'px';
      raf = (Math.abs(tx - x) > .3 || Math.abs(ty - y) > .3) ? requestAnimationFrame(loop) : 0;
    };
    $$('a[data-preview]', cats).forEach(a => {
      a.addEventListener('pointerenter', e => {
        const src = a.dataset.preview;
        if (!imgs[src]) { const im = new Image(); im.src = src; im.alt = ''; prev.append(im); imgs[src] = im; }
        Object.values(imgs).forEach(im => im.classList.toggle('is-on', im === imgs[src]));
        if (!on) { x = tx = e.clientX + 170; y = ty = e.clientY; prev.style.left = x + 'px'; prev.style.top = y + 'px'; }
        on = true; prev.classList.add('is-on');
      });
    });
    cats.addEventListener('pointermove', e => { tx = e.clientX + 170; ty = e.clientY; if (!raf) raf = requestAnimationFrame(loop); });
    cats.addEventListener('pointerleave', () => { on = false; prev.classList.remove('is-on'); });
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
  const settings = () => store.get('ai', { greeting: tt('Ассалому алайкум! Я Ёрдамчи, AI-помощник Olim Polvon. Подскажу по меню, подберу блюда, расскажу про доставку и помогу забронировать стол.'), tone: 'warm' });
  let busy = false, greeted = false, lastFocus = null;
  const CHIPS = [tt('Что попробовать впервые?'), tt('Стол на 4 человека'), tt('Удиви меня'), tt('Недорого и сытно'), tt('Мой заказ'), tt('Доставка'), tt('Поострее'), tt('Забронировать стол')];

  /* ---- order basket (kept on this device) ---- */
  const cart = {
    get: () => store.get('cart', {}),
    set(c) { store.set('cart', c); renderCartBar(); },
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
    cartBar.hidden = !n;
    if (n) { $('[data-ai-cart-sum]', cartBar).textContent = `${n} ${tt('шт.')} · ${fmt(cart.total())}`; cartBar.classList.remove('bump'); void cartBar.offsetWidth; cartBar.classList.add('bump'); }
  }
  cartBar?.addEventListener('click', () => ask(tt('Мой заказ')));
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
    const sides = ['Аччик-чучук', 'Фирменный салат «Олим Полвон»', 'Чобан'].map(by).filter(Boolean);
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
    if (has('компан', 'много', 'банкет', 'день рожд', 'праздн', 'семь', 'group', 'party', 'family', 'davra', 'oila', 'bayram')) return { text: tt('На компанию берут бешбармак на большом блюде, ассорти шашлыков и норин на килограмм.'), cards: pick(['Бешбармак, среднее блюдо', 'Ассорти шашлыков', 'Норин']) };
    if (has('час', 'работа', 'открыт', 'закры', 'когда', 'hour', 'open', 'close', 'soat', 'vaqt', 'ochiq')) return { text: tt('Мы работаем каждый день. С утра — илик шурпа, нохат шурак и халим, вечером — шашлыки на углях.') };
    if (has('адрес', 'где', 'добрат', 'парков', 'manzil', 'address', 'where', 'qayer', 'located')) return { text: tt('Мы на Большой кольцевой (Катта халқа йўли), «Эркин», Зангиатинский район. Маршрут удобно построить в Яндекс Картах.'), link: [tt('Открыть карту'), 'https://yandex.uz/maps/org/89114477009/'] };
    if (has('мяс', 'казы', 'конин', 'рулет', 'meat', "go'sht", 'qazi', 'kazy')) return { text: tt('Из мясного — мясное ассорти с казы, яхна гушт и баранья ножка.'), cards: pick(['Мясное ассорти', 'Яхна гушт', 'Баранья ножка']) };
    if (has('шашлык', 'кабоб', 'кебаб', 'мангал', 'kebab', 'kabob', 'shashlik', 'grill')) return { text: tt('Шашлыки жарим на углях из халяль-мяса. Попробуйте Наполеон, джаз из баранины и шашлык из фарша.'), cards: pick(['Наполеон', 'Джаз из баранины', 'Шашлык из фарша']) };
    if (has('лагман', 'лағмон', 'lagmon', "lag'mon", 'lagman', 'noodle')) return { text: tt('Ковурма лагман гости называют нашим главным блюдом. Есть и уйгурский лагман, и манпар.'), cards: pick(['Ковурма лагман', 'Уйгурский лагман', 'Манпар']) };
    if (has('норин', 'нарын', 'norin', 'бешбармак', 'beshbarm')) return { text: tt('Норин режем тонко, по-ташкентски: есть порция 250 г с казы и килограмм на компанию. Бешбармак — от одной порции до большого блюда.'), cards: pick(['Норин, 250 г', 'Норин', 'Бешбармак']) };
    if (has('суп', 'шурп', 'шорва', 'утр', 'завтрак', 'soup', "sho'rva", 'breakfast', 'nonushta', 'ertalab')) return { text: tt('С утра советую илик шурпу или нохат шурак, а если хочется сытнее — халим.'), cards: pick(['Илик шурпа', 'Нохат шурак', 'Халим']) };
    if (has('салат', 'salat', 'salad', 'овощ')) return { text: tt('К мясу берут аччик-чучук, а фирменный салат «Олим Полвон» — с говядиной и моцареллой.'), cards: pick(['Аччик-чучук', 'Фирменный салат «Олим Полвон»', 'Чобан']) };
    if (has('плов', 'osh', 'plov', 'palov')) return { text: tt('Свадебный плов — с казы, изюмом и нутом. Чайханский плов готовим под заказ.'), cards: pick(['Свадебный плов', 'Чайханский плов']) };
    if (has('впервые', 'попробовать', 'посовет', 'что взять', 'вкусн', 'рекоменд', 'хит', 'first', 'recommend', 'try', 'birinchi', 'tavsiya', 'maslahat', 'nima olsak')) return { text: tt('Если вы у нас впервые: ковурма лагман, норин и шашлык Наполеон. Это то, за чем к нам возвращаются.'), cards: pick(['Ковурма лагман', 'Норин, 250 г', 'Наполеон']) };
    if (has('привет', 'салам', 'здравств', 'ассалом', 'assalom', 'salom', 'hello', 'hi ')) return { text: tt('Ваалейкум ассалом! Чем помочь: подобрать блюда, оформить доставку или забронировать стол?') };
    const f = findDishes(t);
    if (f.length) return { text: f.length === 1 ? `${f[0].name}${f[0].desc ? ' — ' + f[0].desc.toLowerCase() : ''}. ${f[0].price ? fmt(f[0].price) : ''}` : tt('Вот что нашёл в меню:'), cards: f };
    return { text: tt('Не совсем понял. Могу собрать стол на компанию («стол на 4 до 400 000»), найти блюдо по названию, посчитать заказ или рассказать про доставку и бронь.') };
  }

  const scrollDown = () => { msgs.scrollTop = msgs.scrollHeight; };
  function addMsg(who, text) {
    const m = document.createElement('div'); m.className = `msg msg--${who} pop`; m.textContent = text;
    msgs.append(m); scrollDown(); return m;
  }
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  async function stream(el, text) {
    if (reduce) { el.textContent = text; return; }
    el.classList.add('caret'); el.textContent = '';
    const step = Math.max(1, Math.round(text.length / 90));
    for (let i = 0; i < text.length; i += step) { el.textContent = text.slice(0, i + step); scrollDown(); await sleep(16); }
    el.classList.remove('caret');
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
    await sleep(reduce ? 200 : 650 + Math.random() * 400);
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
    if (extra.link) { const a = document.createElement('a'); a.className = 'btn btn--cobalt msg pop'; a.style.cssText = 'align-self:flex-start;min-height:44px;font-size:15px'; a.href = extra.link[1]; a.textContent = extra.link[0]; msgs.append(a); scrollDown(); }
    ava?.classList.remove('is-thinking', 'is-talking'); busy = false;
  }
  function renderOrder() {
    const box = document.createElement('div'); box.className = 'ai-order pop';
    const draw = () => {
      const lines = cart.lines();
      if (!lines.length) { box.innerHTML = `<p>${esc(tt('Заказ пуст.'))}</p>`; return; }
      box.innerHTML = lines.map(l => `<div class="ai-order-row" data-id="${l.d.id}"><span>${esc(l.d.name)}</span><span class="qty"><button type="button" data-q="-1" aria-label="−">−</button><b>${l.q}</b><button type="button" data-q="1" aria-label="+">+</button></span><span class="price">${fmt(l.d.price * l.q)}</span></div>`).join('')
        + `<div class="ai-order-total"><span>${esc(tt('Итого'))}</span><b>${fmt(cart.total())}</b></div>`
        + `<div class="ai-order-actions"><a class="btn" href="contact.html#booking" data-order-book>${esc(tt('Забронировать с этим заказом'))}</a><a class="btn btn--ghost" href="tel:+998909167774">${esc(tt('Заказать доставку'))}</a><button type="button" class="ai-order-copy" data-order-copy>${esc(tt('Скопировать заказ'))}</button><button type="button" class="ai-order-copy" data-order-clear>${esc(tt('Очистить'))}</button></div>`;
    };
    box.addEventListener('click', e => {
      const q = e.target.closest('[data-q]'); if (q) { cart.add(q.closest('[data-id]').dataset.id, +q.dataset.q); draw(); return; }
      if (e.target.closest('[data-order-clear]')) { cart.clear(); draw(); return; }
      if (e.target.closest('[data-order-copy]')) { navigator.clipboard?.writeText(tt('Заказ') + ': ' + orderText() + '. ' + tt('Итого') + ': ' + fmt(cart.total())).then(() => toast(tt('Заказ скопирован — вставьте его в Telegram-бот'))).catch(() => {}); return; }
      if (e.target.closest('[data-order-book]')) store.set('booking_note', tt('Заказ к приходу') + ': ' + orderText());
    });
    draw(); msgs.append(box); scrollDown();
  }
  renderCartBar();
  // booking form picks up the order chosen in the assistant
  const note = $('#b-note'); const pre = store.get('booking_note', '');
  if (note && pre && !note.value) { note.value = pre; store.set('booking_note', ''); }
  function renderChips() {
    chipsBox.innerHTML = '';
    CHIPS.forEach((c, i) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = c; b.style.animationDelay = i * 40 + 'ms'; b.addEventListener('click', () => ask(c)); chipsBox.append(b); });
  }
  async function ask(q) {
    if (busy || !q.trim()) return;
    addMsg('me', q.trim()); aiInput.value = '';
    const r = intent(q); await botReply(r.text, r);
  }
  function openAI() {
    if (!panel) return;
    lastFocus = document.activeElement;
    hideHello?.(); document.body.classList.add('ai-open'); root.classList.add('ai-open');
    $$('[data-ai-open]').forEach(b => b.setAttribute('aria-expanded', 'true'));
    setTimeout(() => aiInput?.focus({ preventScroll: true }), 120);
    if (!greeted) { greeted = true; renderChips(); botReply(settings().greeting); }
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
    function applyOverrides() {
      const m = getMenu();
      m.forEach(d => {
        const li = document.getElementById(d.id); if (!li) return;
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
    }
    applyOverrides(); applyFilter();

    // inline edit (admin)
    document.addEventListener('click', e => {
      const btn = e.target.closest('[data-edit]'); if (!btn || !isAdmin()) return;
      const li = btn.closest('.menu-item'); const d = getMenu().find(x => x.id === li.dataset.id);
      if ($('.inline-edit', li)) return;
      const box = document.createElement('div'); box.className = 'inline-edit';
      box.style.cssText = 'grid-column:1/-1;display:flex;flex-wrap:wrap;gap:10px;align-items:center;padding:12px;background:var(--cobalt-tint);border-radius:12px;margin-top:6px';
      box.innerHTML = `<label style="display:flex;gap:8px;align-items:center;font-size:14px;font-weight:600">Цена <input type="number" step="1000" min="0" value="${d.price ?? ''}" style="height:40px;width:130px;border:1px solid var(--line-strong);border-radius:8px;padding:0 10px"></label>
        <label style="display:flex;gap:8px;align-items:center;font-size:14px;font-weight:600"><span class="switch"><input type="checkbox" ${d.stop ? 'checked' : ''}><span></span></span>Стоп-лист</label>
        <button class="mini-btn" type="button" data-save style="margin-left:auto">Сохранить</button><button class="mini-btn" type="button" data-cancel>Отмена</button>`;
      li.append(box); $('input[type=number]', box).focus();
      $('[data-cancel]', box).onclick = () => box.remove();
      $('[data-save]', box).onclick = () => {
        setOverride(d.id, { price: Math.max(0, parseInt($('input[type=number]', box).value, 10) || 0), stop: $('input[type=checkbox]', box).checked });
        box.remove(); applyOverrides(); applyFilter(); toast(tt('Сохранено: ') + d.name);
      };
    });
  }

  /* ---------------- booking form ---------------- */
  const booking = $('[data-booking]');
  if (booking) {
    const date = $('#b-date'); const today = new Date(); const iso = d => d.toISOString().slice(0, 10);
    date.min = iso(today); const tm = new Date(today); tm.setDate(tm.getDate() + 1); date.value = iso(tm);
    $('#b-time').value = '19:00';
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
      if (!ok) return;
      const b = { id: Date.now(), name: booking.elements.name.value.trim(), phone: booking.elements.phone.value.trim(), date: date.value, time: booking.elements.time.value, guests, zone: booking.elements.zone.value, note: booking.elements.note.value.trim(), status: 'new' };
      const list = store.get('bookings', []); list.unshift(b); store.set('bookings', list);
      const d = new Date(b.date + 'T00:00').toLocaleDateString(LOCALE, { day: 'numeric', month: 'long', weekday: 'long' });
      $('[data-success-text]').textContent = tt('{name}, ждём вас {date} в {time}, гостей: {n}.').replace('{name}', b.name).replace('{date}', d).replace('{time}', b.time).replace('{n}', b.guests);
      booking.hidden = true; success.classList.add('is-on'); success.querySelector('h2').setAttribute('tabindex', '-1'); success.querySelector('h2').focus();
    });
    $('[data-again]')?.addEventListener('click', () => { success.classList.remove('is-on'); booking.hidden = false; booking.reset(); guests = 2; out.textContent = 2; date.value = iso(tm); $('#b-time').value = '19:00'; });
  }

  /* ---------------- ADMIN page ---------------- */
  if (root.dataset.page === 'admin') {
    const loginBox = $('[data-admin-login]'), app = $('[data-admin-app]');
    const show = () => { const on = isAdmin(); loginBox.hidden = on; app.hidden = !on; if (on) renderAll(); };
    loginBox.addEventListener('submit', e => { e.preventDefault(); handleLogin(loginBox, $('#a-pass'), show); });
    document.addEventListener('admin-change', show);

    const tabs = $$('[role=tab]', app);
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
    $('[data-menu-reset]')?.addEventListener('click', () => { store.del('menu'); renderMenuEditor(); renderKpis(); toast(tt('Меню сброшено к исходному')); });
    const aiSet = $('[data-ai-settings]');
    aiSet?.addEventListener('submit', e => { e.preventDefault(); store.set('ai', { greeting: aiSet.greeting.value, tone: aiSet.tone.value }); toast(tt('Настройки помощника сохранены')); });
    function renderAll() {
      renderKpis(); renderBookings(); renderMenuEditor();
      if (aiSet) { const s = settings(); aiSet.greeting.value = s.greeting; aiSet.tone.value = s.tone; }
    }
    show();
  }
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
    const apply = () => { d.dataset.theme = next; sync(); try { localStorage.setItem('polvon_theme', next); } catch {} };
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
