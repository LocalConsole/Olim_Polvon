# Olim Polvon Milliy Taomlari — сайт

Статический сайт ресторана: 3 языка (RU — корень, `/uz/`, `/en/`), AI-помощник (демо), бронь, админ-панель (демо; вход — кнопка «Вход для персонала» внизу страницы).

## Как править
1. Данные ресторана, меню и цены — в начале `build.py` (`SITE`, `MENU`).
2. Переводы — `i18n.py`.
3. Стили — `assets/base.css` и `assets/pages.css`; `assets/style.css` = блок шрифтов @font-face + base.css + pages.css.
4. Сборка: `pip install beautifulsoup4 && python3 build.py` — пересоздаёт все `.html`, `/uz/`, `/en/`, `sitemap.xml`.

Хостинг — GitHub Pages (HTTPS автоматически). Когда появится домен .com, поменяйте `SITE["domain"]` в `build.py` и добавьте файл `CNAME`.
