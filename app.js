// LesPaw Mini App — app.js v45
// Полная рабочая версия (фикс: прошлый app.js был обрезан -> из-за синтаксической ошибки главное меню не отображалось)
//
// Фичи:
// - Глобальный поиск только сверху
// - Нижний навбар: назад / избранное / корзина (бейджи)
// - Категории -> типы фандомов -> список -> страница фандома
// - Страница фандома: автогруппировка товаров по типам (без вкладок)
// - Сетка товаров 2× + превью (если есть image/images/...)
// - Карточка товара: избранное, добавить в корзину; для наклеек — основа/покрытие + доплаты из settings
// - Корзина: управление количеством, удаление, сумма
// - Оформление: обязательная галочка; отправка предзаполненного текста менеджерке @LesPaw_manager

// =====================
// CSV ссылки (твои)
// =====================
const CSV_FANDOMS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ_WJrd_-W-ZSVqZqUs8YhumHkSjfHrt4xBV3nZEcUTRVyPeF15taLFiaw1gzJcK7m33sLjmkhP-Zk/pub?gid=0&single=true&output=csv";

const CSV_PRODUCTS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ_WJrd_-W-ZSVqZqUs8YhumHkSjfHrt4xBV3nZEcUTRVyPeF15taLFiaw1gzJcK7m33sLjmkhP-Zk/pub?gid=636991555&single=true&output=csv";

const CSV_SETTINGS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ_WJrd_-W-ZSVqZqUs8YhumHkSjfHrt4xBV3nZEcUTRVyPeF15taLFiaw1gzJcK7m33sLjmkhP-Zk/pub?gid=2041657059&single=true&output=csv";

// менеджерка (без @)
const MANAGER_USERNAME = "LesPaw_manager";

// ссылки
const REVIEWS_URL = "https://t.me/LesPaw/114";
const MAIN_CHANNEL_URL = "https://t.me/LessWolf";
const SUGGEST_URL = "https://t.me/LesPaw/280";

// =====================
// Telegram init
// =====================
const tg = window.Telegram?.WebApp;
try {
  tg?.ready();
  tg?.expand();
} catch {
  // no-op for browser
}

// =====================
// DOM
// =====================
const view = document.getElementById("view");
const globalSearch = document.getElementById("globalSearch");

const navBack = document.getElementById("navBack");
const navFav = document.getElementById("navFav");
const navCart = document.getElementById("navCart");

const favCount = document.getElementById("favCount");
const cartCount = document.getElementById("cartCount");

const wrapEl = document.querySelector(".wrap");
const navBarEl = document.querySelector(".navBar");

// =====================
// Storage
// =====================
const LS_CART = "lespaw_cart_v41";
const LS_FAV = "lespaw_fav_v41";

function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

let cart = loadJSON(LS_CART, []);
let fav = loadJSON(LS_FAV, []);

// =====================
// Toast
// =====================
function toast(msg, kind = "") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`.trim();
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

// =====================
// Safe bottom space
// =====================
function syncBottomSpace() {
  if (!wrapEl || !navBarEl) return;
  const h = navBarEl.offsetHeight || 70;
  wrapEl.style.paddingBottom = `calc(${h + 80}px + env(safe-area-inset-bottom))`;
}
window.addEventListener("resize", syncBottomSpace);

// =====================
// Navigation stack
// =====================
const navStack = [];
let currentRender = null;

function openPage(renderFn) {
  if (currentRender) navStack.push(currentRender);
  currentRender = renderFn;
  syncNav();
  renderFn();
  syncBottomSpace();
}

function goBack() {
  const prev = navStack.pop();
  currentRender = prev || renderHome;
  syncNav();
  currentRender();
  syncBottomSpace();
}

function resetToHome() {
  navStack.length = 0;
  currentRender = renderHome;
  syncNav();
  renderHome();
  syncBottomSpace();
}

function syncNav() {
  navBack.classList.toggle("is-active", navStack.length > 0);
  navFav.classList.toggle("is-active", currentRender === renderFavorites);
  navCart.classList.toggle("is-active", currentRender === renderCart);
}

// =====================
// Data
// =====================
let fandoms = [];
let products = [];
let settings = {
  overlay_price_delta: 100,
  holo_base_price_delta: 100,
  examples_url: "https://t.me/LesPaw",
};

// =====================
// CSV utils
// =====================
function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;

  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        const next = s[i + 1];
        if (next === '"') {
          field += '"';
          i++;
        } else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else field += c;
    }
  }
  row.push(field);
  rows.push(row);

  const cleaned = rows.filter((r) => r.some((cell) => String(cell).trim() !== ""));
  if (!cleaned.length) return [];

  const headers = cleaned[0].map((h) => String(h).trim());
  return cleaned.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => (obj[h] = (r[idx] ?? "").toString().trim()));
    return obj;
  });
}

async function fetchCSV(url) {
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`CSV fetch failed (${res.status})`);
  return parseCSV(await res.text());
}

// =====================
// Helpers
// =====================
const FANDOM_TYPES = [
  "Фильмы",
  "Игры",
  "Сериалы",
  "Актрисы и певицы",
  "Аниме",
  "Мультсериалы",
  "Манхвы / манги",
  "Лакорны",
  "Что-то тематическое",
];

const OVERLAY_OPTIONS = [
  ["none", "Без покрытия"],
  ["sugar", "Сахар"],
  ["stars", "Звёздочки"],
  ["snowflakes_small", "Маленькие снежинки"],
  ["stars_big", "Большие звёзды"],
  ["holo_overlay", "Голографическая ламинация"],
];

function truthy(v) {
  return String(v || "").trim().toUpperCase() === "TRUE";
}

function money(n) {
  return `${Number(n) || 0} ₽`;
}

// поддержка: запятая, ;, переносы строк
function splitList(s) {
  return (s || "")
    .split(/[,;\n]+/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function isDigitStart(name) {
  return /^[0-9]/.test((name || "").trim());
}

// Нормализуем тип товара из CSV (на случай, если там русские названия или мн. число)
function normalizeProductType(t) {
  const s = String(t || '').trim().toLowerCase();
  if (!s) return '';

  // sticker
  if (['sticker', 'stickers', 'stикер', 'stikers'].includes(s)) return 'sticker';
  if (['наклейка', 'наклейки', 'стикер', 'стикеры'].includes(s)) return 'sticker';

  // pin (значки)
  if (['pin', 'pins', 'badge', 'badges'].includes(s)) return 'pin';
  if (['значок', 'значки', 'набор значков', 'наборы значков'].includes(s)) return 'pin';

  // poster
  if (['poster', 'posters'].includes(s)) return 'poster';
  if (['постер', 'постеры'].includes(s)) return 'poster';

  // box
  if (['box', 'boxes'].includes(s)) return 'box';
  if (['бокс', 'боксы'].includes(s)) return 'box';

  return s;
}

function typeLabel(t) {
  const map = { sticker: "Наклейки", pin: "Набор значков", poster: "Постеры", box: "Боксы" };
  return map[t] || t || "";
}

function getFandomById(id) {
  return fandoms.find((f) => f.fandom_id === id);
}
function getProductById(id) {
  return products.find((p) => p.id === id);
}

function setCart(next) {
  cart = next;
  saveJSON(LS_CART, cart);
  updateBadges();
}
function setFav(next) {
  fav = next;
  saveJSON(LS_FAV, fav);
  updateBadges();
}

function updateBadges() {
  const favN = fav.length;
  const cartN = cart.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);

  if (favN > 0) {
    favCount.style.display = "";
    favCount.textContent = String(favN);
  } else favCount.style.display = "none";

  if (cartN > 0) {
    cartCount.style.display = "";
    cartCount.textContent = String(cartN);
  } else cartCount.style.display = "none";
}

// ===== thumbnails helpers =====
function imagesField(p) {
  return p?.images || p?.image || p?.image_url || p?.photo || p?.img || "";
}

function firstImageUrl(p) {
  const imgs = splitList(imagesField(p));
  return imgs[0] || "";
}

function cardThumbHTML(p) {
  const u = firstImageUrl(p);
  if (!u) return "";
  return `<img class="pcardImg" src="${u}" alt="Фото товара" loading="lazy">`;
}

function safeText(s) {
  return String(s || "").replace(/[<>]/g, "");
}

function openTelegram(url) {
  try {
    tg?.openTelegramLink(url);
  } catch {
    window.open(url, "_blank");
  }
}

// =====================
// Init
// =====================
async function init() {
  try {
    navBack.onclick = () => goBack();
    navFav.onclick = () => openPage(renderFavorites);
    navCart.onclick = () => openPage(renderCart);

    globalSearch.addEventListener("input", (e) => {
      const q = e.target.value || "";
      if (q.trim()) openPage(() => renderSearch(q));
      else resetToHome();
    });

    fandoms = await fetchCSV(CSV_FANDOMS_URL);
    const rawProducts = await fetchCSV(CSV_PRODUCTS_URL);
    products = rawProducts.map((p) => ({
      ...p,
      product_type_raw: p.product_type,
      product_type: normalizeProductType(p.product_type),
    }));

    const s = await fetchCSV(CSV_SETTINGS_URL);
    s.forEach((row) => {
      const k = row.key;
      const v = row.value;
      if (!k) return;
      if (k === "overlay_price_delta" || k === "holo_base_price_delta") settings[k] = Number(v);
      else settings[k] = v;
    });

    updateBadges();
    resetToHome();
    syncBottomSpace();
  } catch (e) {
    view.innerHTML = `
      <div class="card">
        <div class="h2">Ошибка загрузки данных</div>
        <div class="small">${safeText(String(e))}</div>
        <hr>
        <div class="small">Проверь публикацию таблиц и CSV-ссылки.</div>
      </div>
    `;
    syncBottomSpace();
  }
}
init();

// =====================
// HOME (плитки)
// =====================
function renderHome() {
  view.innerHTML = `
    <div class="tile" id="tCat">
      <div class="tileTitle">Категории</div>
      <div class="tileSub">Выбор фандома по типу</div>
    </div>

    <div class="tile" id="tEx">
      <div class="tileTitle">Примеры ламинации и пленки</div>
      <div class="tileSub">Как выглядит</div>
    </div>

    <div class="tile" id="tRev">
      <div class="tileTitle">Отзывы</div>
      <div class="tileSub">Отзывы от наших покупательниц</div>
    </div>

    <div class="tile" id="tInfo">
      <div class="tileTitle">Важная информация</div>
      <div class="tileSub">Оплата, сроки, доставка</div>
    </div>
  `;

  document.getElementById("tCat").onclick = () => openPage(renderFandomTypes);
  document.getElementById("tEx").onclick = () => openExamples();
  document.getElementById("tRev").onclick = () => openPage(renderReviews);
  document.getElementById("tInfo").onclick = () => openPage(renderInfo);

  syncNav();
  syncBottomSpace();
}

// =====================
// Категории → типы фандомов
// =====================
function renderFandomTypes() {
  view.innerHTML = `
    <div class="card">
      <div class="h2">Категории</div>
      <div class="small">Выбери тип фандома</div>
      <hr>
      <div class="list">
        ${FANDOM_TYPES.map(
          (t) => `
          <div class="item" data-type="${t}">
            <div class="title">${t}</div>
            <div class="meta">Открыть список фандомов</div>
          </div>
        `
        ).join("")}
      </div>
    </div>
  `;

  view.querySelectorAll("[data-type]").forEach((el) => {
    el.onclick = () => openPage(() => renderFandomList(el.dataset.type));
  });

  syncNav();
  syncBottomSpace();
}

// =====================
// Список фандомов (алфавит + цифры в конце)
// =====================
function renderFandomList(type) {
  const list = fandoms
    .filter((f) => truthy(f.is_active))
    .filter((f) => f.fandom_type === type)
    .sort((a, b) => (a.fandom_name || "").localeCompare(b.fandom_name || "", "ru"));

  const letters = list.filter((f) => !isDigitStart(f.fandom_name));
  const digits = list.filter((f) => isDigitStart(f.fandom_name));

  view.innerHTML = `
    <div class="card">
      <div class="h2">${type}</div>
      <div class="small">Фандомы по алфавиту</div>
      <hr>
      <div class="list">
        ${letters
          .map(
            (f) => `
          <div class="item" data-id="${f.fandom_id}">
            <div class="title">${f.fandom_name}</div>
            <div class="meta">Открыть товары фандома</div>
          </div>
        `
          )
          .join("")}

        ${digits.length ? `<div class="small">0–9</div>` : ""}

        ${digits
          .map(
            (f) => `
          <div class="item" data-id="${f.fandom_id}">
            <div class="title">${f.fandom_name}</div>
            <div class="meta">Открыть товары фандома</div>
          </div>
        `
          )
          .join("")}
      </div>
    </div>
  `;

  view.querySelectorAll("[data-id]").forEach((el) => {
    el.onclick = () => openPage(() => renderFandomPage(el.dataset.id));
  });

  syncNav();
  syncBottomSpace();
}

// =====================
// Страница фандома → товары сеткой 2× (с фотками) + автогруппировка по типам
// =====================
function renderFandomPage(fandomId) {
  const f = getFandomById(fandomId);
  const all = products.filter((p) => p.fandom_id === fandomId);

  // порядок секций (можно менять)
  const order = ["sticker", "pin", "poster", "box"];
  const labels = {
    sticker: "Наклейки",
    pin: "Значки",
    poster: "Постеры",
    box: "Боксы",
  };

  // Если в CSV типы записаны нестандартно — они нормализуются в init().
  // Но на всякий случай показываем и "прочие" типы, чтобы товары не пропадали.
  const present = Array.from(new Set(all.map((p) => String(p.product_type || "").trim()).filter(Boolean)));
  const ordered = order.filter((t) => present.includes(t));
  const others = present.filter((t) => !order.includes(t));
  const activeTypes = [...ordered, ...others];

  function sectionHTML(t) {
    const items = all.filter((p) => p.product_type === t);
    if (!items.length) return "";

    const title = labels[t] || typeLabel(t) || t;

    return `
      <div class="small" style="margin-top:2px"><b>${title}</b></div>
      <div style="height:10px"></div>
      <div class="grid2">
        ${items
          .map(
            (p) => `
          <div class="pcard" data-id="${p.id}">
            ${cardThumbHTML(p)}
            <div class="pcardTitle">${p.name}</div>
            <div class="pcardMeta">${money(p.price)} · ${typeLabel(p.product_type)}</div>
          </div>
        `
          )
          .join("")}
      </div>
    `;
  }

  view.innerHTML = `
    <div class="card">
      <div class="h2">${f?.fandom_name || "Фандом"}</div>
      <div class="small">Товары сгруппированы по типам</div>
      <hr>

      ${
        all.length
          ? activeTypes
              .map((t, idx) => `${sectionHTML(t)}${idx < activeTypes.length - 1 ? "<hr>" : ""}`)
              .join("")
          : `<div class="small">Пока нет товаров.</div>`
      }
    </div>
  `;

  view.querySelectorAll("[data-id]").forEach((el) => {
    el.onclick = () => openPage(() => renderProduct(el.dataset.id));
  });

  syncNav();
  syncBottomSpace();
}


// =====================
// Инфо / отзывы / примеры
// =====================
function renderInfo() {
  view.innerHTML = `
    <div class="card">
      <div class="h2">Важная информация</div>
      <div class="small">
        💚 <b>Оплата</b><br>
        💳 Заказ собирается после <b>100% предоплаты</b>. Оплата на карту Т-Банка.<br><br>

        💚 <b>Сроки</b><br>
        ⏳ Сборка и отправка — <b>4–5 дней</b>.<br>
        🚚 Доставка — <b>5–15 дней</b>.<br><br>

        💚 <b>Доставка</b><br>
        📦 Яндекс Доставка: ПВЗ Яндекс / 5post.<br>
        ⏳ Хранение — <b>6 дней</b>.<br><br>

        💚 <b>Возврат</b><br>
        ❌ Возврат невозможен (под заказ).<br><br>

        💚 <b>Печать</b><br>
        🖨 Струйная печать, цвета могут чуть отличаться.<br><br>

        💚 <b>Наклейки</b><br>
        ✂️ Не вырезаны по контуру — нужно вырезать самостоятельно.<br><br>

        💚 <b>Индивидуальный заказ</b><br>
        👉 <b>@${MANAGER_USERNAME}</b>
      </div>
      <hr>
      <div class="row">
        <button class="btn" id="btnMain">Наш основной канал</button>
        <button class="btn" id="btnSuggest">Предложить фандом</button>
      </div>
    </div>
  `;

  document.getElementById("btnMain").onclick = () => openTelegram(MAIN_CHANNEL_URL);
  document.getElementById("btnSuggest").onclick = () => openTelegram(SUGGEST_URL);

  syncNav();
  syncBottomSpace();
}

function renderReviews() {
  view.innerHTML = `
    <div class="card">
      <div class="h2">Отзывы</div>
      <div class="small">Откроется пост с отзывами в Telegram.</div>
      <hr>
      <button class="btn" id="openReviews">Открыть отзывы</button>
    </div>
  `;
  document.getElementById("openReviews").onclick = () => openTelegram(REVIEWS_URL);
  syncNav();
  syncBottomSpace();
}

function openExamples() {
  const url = settings.examples_url || "https://t.me/LesPaw";
  openTelegram(url);
}

// =====================
// Поиск — товары тоже с фотками
// =====================
function renderSearch(q) {
  const query = (q || "").toLowerCase().trim();

  const fHits = fandoms
    .filter((f) => truthy(f.is_active))
    .filter((f) => (f.fandom_name || "").toLowerCase().includes(query))
    .slice(0, 20);

  const pHits = products
    .filter((p) => {
      const typeName = (p.product_type || "").toLowerCase();
      const hay = `${p.name || ""} ${p.description_short || ""} ${p.tags || ""} ${typeName}`.toLowerCase();
      return hay.includes(query);
    })
    .slice(0, 40);

  view.innerHTML = `
    <div class="card">
      <div class="h2">Поиск: “${safeText(q)}”</div>

      <div class="small"><b>Фандомы</b></div>
      <div class="list">
        ${
          fHits.length
            ? fHits
                .map(
                  (f) => `
          <div class="item" data-fid="${f.fandom_id}">
            <div class="title">${f.fandom_name}</div>
            <div class="meta">${f.fandom_type}</div>
          </div>
        `
                )
                .join("")
            : `<div class="small">Ничего не найдено</div>`
        }
      </div>

      <hr>

      <div class="small"><b>Товары</b></div>
      <div class="grid2">
        ${
          pHits.length
            ? pHits
                .map(
                  (p) => `
          <div class="pcard" data-pid="${p.id}">
            ${cardThumbHTML(p)}
            <div class="pcardTitle">${p.name}</div>
            <div class="pcardMeta">${money(p.price)} · ${typeLabel(p.product_type)}</div>
          </div>
        `
                )
                .join("")
            : `<div class="small">Ничего не найдено</div>`
        }
      </div>
    </div>
  `;

  view.querySelectorAll("[data-fid]").forEach((el) => (el.onclick = () => openPage(() => renderFandomPage(el.dataset.fid))));
  view.querySelectorAll("[data-pid]").forEach((el) => (el.onclick = () => openPage(() => renderProduct(el.dataset.pid))));

  syncNav();
  syncBottomSpace();
}

// =====================
// Price helpers (options)
// =====================
function calcItemUnitPrice(p, item) {
  let price = Number(p?.price) || 0;
  if ((p?.product_type || "") === "sticker") {
    const overlayDelta = Number(settings.overlay_price_delta) || 0;
    const holoDelta = Number(settings.holo_base_price_delta) || 0;
    if ((item?.overlay || "none") !== "none") price += overlayDelta;
    if ((item?.base || "normal") === "holo") price += holoDelta;
  }
  return price;
}

function optionLabel(item) {
  const p = getProductById(item?.id);
  if (!p) return "";
  if ((p.product_type || "") !== "sticker") return "";

  const base = (item.base || "normal") === "holo" ? "Голографическая основа" : "Обычная основа";
  const ovKey = item.overlay || "none";
  const ov = OVERLAY_OPTIONS.find((x) => x[0] === ovKey)?.[1] || "Без покрытия";
  return `${base}; покрытие: ${ov}`;
}

function cartKey(item) {
  return `${item.id}__${item.base || ""}__${item.overlay || ""}`;
}

// =====================
// Product page
// =====================
function renderProduct(productId) {
  const p = getProductById(productId);
  if (!p) {
    view.innerHTML = `<div class="card"><div class="h2">Товар не найден</div></div>`;
    syncNav();
    syncBottomSpace();
    return;
  }

  const fandom = getFandomById(p.fandom_id);
  const img = firstImageUrl(p);

  const isSticker = (p.product_type || "") === "sticker";

  let selectedOverlay = "none";
  let selectedBase = "normal"; // normal | holo

  function inFav() {
    return fav.includes(p.id);
  }

  function favToggle() {
    if (inFav()) setFav(fav.filter((id) => id !== p.id));
    else setFav([...fav, p.id]);
    render();
  }

  function calcPrice() {
    return calcItemUnitPrice(p, { id: p.id, base: selectedBase, overlay: selectedOverlay });
  }

  function addToCart() {
    const item = {
      id: p.id,
      qty: 1,
      overlay: isSticker ? selectedOverlay : "",
      base: isSticker ? selectedBase : "",
    };

    const key = cartKey(item);
    const existing = cart.find((x) => cartKey(x) === key);

    if (existing) {
      existing.qty = (Number(existing.qty) || 0) + 1;
      setCart([...cart]);
    } else {
      setCart([...cart, item]);
    }

    toast("Добавлено в корзину", "good");
  }

  function render() {
    view.innerHTML = `
      <div class="card">
        <div class="h2">${p.name}</div>
        <div class="small">${fandom?.fandom_name ? `<b>${fandom.fandom_name}</b> · ` : ""}${typeLabel(p.product_type)}</div>
        <hr>

        ${img ? `<img class="thumb" src="${img}" alt="Фото товара" loading="lazy">` : ""}

        ${p.description ? `<div class="small" style="margin-top:10px">${p.description}</div>` : ""}
        ${p.description_short && !p.description ? `<div class="small" style="margin-top:10px">${p.description_short}</div>` : ""}

        <hr>

        ${
          isSticker
            ? `
          <div class="small"><b>Основа</b></div>
          <div class="row" id="baseRow">
            <button class="btn" data-base="normal">Обычная</button>
            <button class="btn" data-base="holo">Голографическая</button>
          </div>

          <div style="height:10px"></div>

          <div class="small"><b>Покрытие</b></div>
          <div class="row" id="ovRow">
            ${OVERLAY_OPTIONS.map(([k, label]) => `<button class="btn" data-ov="${k}">${label}</button>`).join("")}
          </div>

          <hr>
        `
            : ""
        }

        <div class="row">
          <button class="btn" id="btnFav">${inFav() ? "♥ В избранном" : "♡ В избранное"}</button>
          <button class="btn is-active" id="btnCart">Добавить в корзину · ${money(calcPrice())}</button>
        </div>
      </div>
    `;

    const btnFav = document.getElementById("btnFav");
    const btnCart = document.getElementById("btnCart");

    btnFav.onclick = () => favToggle();
    btnCart.onclick = () => addToCart();

    if (isSticker) {
      const baseRow = document.getElementById("baseRow");
      const ovRow = document.getElementById("ovRow");

      function syncBtns() {
        baseRow.querySelectorAll(".btn").forEach((b) => b.classList.toggle("is-active", b.dataset.base === selectedBase));
        ovRow.querySelectorAll(".btn").forEach((b) => b.classList.toggle("is-active", b.dataset.ov === selectedOverlay));
        btnCart.textContent = `Добавить в корзину · ${money(calcPrice())}`;
      }

      baseRow.querySelectorAll("[data-base]").forEach((b) => {
        b.onclick = () => {
          selectedBase = b.dataset.base;
          syncBtns();
        };
      });
      ovRow.querySelectorAll("[data-ov]").forEach((b) => {
        b.onclick = () => {
          selectedOverlay = b.dataset.ov;
          syncBtns();
        };
      });

      syncBtns();
    }
  }

  render();
  syncNav();
  syncBottomSpace();
}

// =====================
// Favorites
// =====================
function renderFavorites() {
  const list = fav
    .map((id) => getProductById(id))
    .filter(Boolean);

  view.innerHTML = `
    <div class="card">
      <div class="h2">Избранное</div>
      <div class="small">${list.length ? "Нажми на товар, чтобы открыть карточку" : "Пока пусто"}</div>
      <hr>
      ${
        list.length
          ? `<div class="grid2">
              ${list
                .map(
                  (p) => `
                <div class="pcard" data-id="${p.id}">
                  ${cardThumbHTML(p)}
                  <div class="pcardTitle">${p.name}</div>
                  <div class="pcardMeta">${money(p.price)} · ${typeLabel(p.product_type)}</div>
                </div>
              `
                )
                .join("")}
            </div>
            <div style="height:12px"></div>
            <button class="btn" id="btnClearFav">Очистить избранное</button>`
          : ""
      }
    </div>
  `;

  view.querySelectorAll("[data-id]").forEach((el) => {
    el.onclick = () => openPage(() => renderProduct(el.dataset.id));
  });

  const btnClear = document.getElementById("btnClearFav");
  if (btnClear) {
    btnClear.onclick = () => {
      setFav([]);
      toast("Избранное очищено", "good");
      renderFavorites();
    };
  }

  syncNav();
  syncBottomSpace();
}

// =====================
// Cart
// =====================
function renderCart() {
  const items = cart
    .map((it) => {
      const p = getProductById(it.id);
      if (!p) return null;
      return { it, p };
    })
    .filter(Boolean);

  const total = items.reduce((sum, x) => sum + calcItemUnitPrice(x.p, x.it) * (Number(x.it.qty) || 0), 0);

  view.innerHTML = `
    <div class="card">
      <div class="h2">Корзина</div>
      <div class="small">${items.length ? "Проверь количество и оформи заказ" : "Пока пусто"}</div>
      <hr>

      ${
        items.length
          ? `
        <div class="list">
          ${items
            .map(({ it, p }) => {
              const unit = calcItemUnitPrice(p, it);
              const line = unit * (Number(it.qty) || 0);
              const opt = optionLabel(it);
              return `
                <div class="item" data-key="${cartKey(it)}">
                  <div class="title">${p.name}</div>
                  <div class="meta">${money(unit)} за шт. · ${typeLabel(p.product_type)}${opt ? ` · ${opt}` : ""}</div>
                  <div style="height:10px"></div>
                  <div class="row" style="align-items:center; justify-content:space-between">
                    <div class="row" style="gap:8px; align-items:center">
                      <button class="btn" data-act="minus">−</button>
                      <div class="small" style="min-width:36px; text-align:center"><b>${Number(it.qty) || 0}</b></div>
                      <button class="btn" data-act="plus">+</button>
                    </div>
                    <div class="small"><b>${money(line)}</b></div>
                    <button class="btn" data-act="remove">Удалить</button>
                  </div>
                </div>
              `;
            })
            .join("")}
        </div>

        <hr>
        <div class="row" style="justify-content:space-between; align-items:center">
          <div class="small"><b>Итого</b></div>
          <div class="h2" style="margin:0">${money(total)}</div>
        </div>

        <div style="height:10px"></div>
        <div class="row">
          <button class="btn" id="btnClearCart">Очистить корзину</button>
          <button class="btn is-active" id="btnCheckout">Оформить заказ</button>
        </div>
      `
          : ""
      }
    </div>
  `;

  // handlers
  view.querySelectorAll(".item[data-key]").forEach((row) => {
    const key = row.getAttribute("data-key");

    row.querySelectorAll("[data-act]").forEach((b) => {
      b.onclick = (e) => {
        e.stopPropagation();
        const act = b.getAttribute("data-act");

        const idx = cart.findIndex((x) => cartKey(x) === key);
        if (idx < 0) return;

        const next = [...cart];
        const cur = { ...next[idx] };
        const q = Number(cur.qty) || 0;

        if (act === "plus") cur.qty = q + 1;
        if (act === "minus") cur.qty = Math.max(1, q - 1);
        if (act === "remove") {
          next.splice(idx, 1);
          setCart(next);
          renderCart();
          return;
        }

        next[idx] = cur;
        setCart(next);
        renderCart();
      };
    });

    // tap on row opens product
    row.onclick = () => {
      const id = key.split("__")[0];
      if (id) openPage(() => renderProduct(id));
    };
  });

  const btnClear = document.getElementById("btnClearCart");
  if (btnClear) {
    btnClear.onclick = () => {
      setCart([]);
      toast("Корзина очищена", "good");
      renderCart();
    };
  }

  const btnCheckout = document.getElementById("btnCheckout");
  if (btnCheckout) btnCheckout.onclick = () => openPage(renderCheckout);

  syncNav();
  syncBottomSpace();
}

// =====================
// Checkout
// =====================
function renderCheckout() {
  if (!cart.length) {
    view.innerHTML = `
      <div class="card">
        <div class="h2">Корзина пуста</div>
        <div class="small">Добавь товары, чтобы оформить заказ.</div>
      </div>
    `;
    syncNav();
    syncBottomSpace();
    return;
  }

  view.innerHTML = `
    <div class="card">
      <div class="h2">Оформление заказа</div>
      <div class="small">Заполни данные — и отправим менеджерке предзаполненное сообщение.</div>
      <hr>

      <div class="small"><b>Имя</b></div>
      <input class="searchInput" id="cName" placeholder="Как к тебе обращаться?" style="background:rgba(0,0,0,.06); border-radius:14px; margin-top:8px; padding:12px 14px; color:#0b0b12" />

      <div style="height:12px"></div>
      <div class="small"><b>Контакт</b></div>
      <input class="searchInput" id="cContact" placeholder="@ник или телефон" style="background:rgba(0,0,0,.06); border-radius:14px; margin-top:8px; padding:12px 14px; color:#0b0b12" />

      <div style="height:12px"></div>
      <div class="small"><b>Доставка</b></div>
      <input class="searchInput" id="cDelivery" placeholder="Яндекс ПВЗ / 5post / другое" style="background:rgba(0,0,0,.06); border-radius:14px; margin-top:8px; padding:12px 14px; color:#0b0b12" />

      <div style="height:12px"></div>
      <div class="small"><b>Адрес/ПВЗ</b></div>
      <input class="searchInput" id="cAddr" placeholder="Город, адрес или код/адрес ПВЗ" style="background:rgba(0,0,0,.06); border-radius:14px; margin-top:8px; padding:12px 14px; color:#0b0b12" />

      <div style="height:12px"></div>
      <div class="small"><b>Комментарий (опционально)</b></div>
      <input class="searchInput" id="cComment" placeholder="Например: объединить в один заказ" style="background:rgba(0,0,0,.06); border-radius:14px; margin-top:8px; padding:12px 14px; color:#0b0b12" />

      <hr>

      <label class="item" style="display:flex; gap:10px; align-items:flex-start">
        <input type="checkbox" id="cAgree" style="margin-top:4px" />
        <div>
          <div class="title">Я проверила состав заказа</div>
          <div class="meta">Без этой галочки отправить заказ нельзя</div>
        </div>
      </label>

      <div style="height:12px"></div>
      <button class="btn is-active" id="cSend">Отправить заказ менеджерке</button>

      <div style="height:10px"></div>
      <div class="small">Откроется чат с @${MANAGER_USERNAME} и предзаполненным текстом.</div>
    </div>
  `;

  document.getElementById("cSend").onclick = () => {
    const agree = document.getElementById("cAgree").checked;
    if (!agree) {
      toast("Поставь галочку подтверждения", "warn");
      return;
    }

    const name = document.getElementById("cName").value.trim();
    const contact = document.getElementById("cContact").value.trim();
    const delivery = document.getElementById("cDelivery").value.trim();
    const addr = document.getElementById("cAddr").value.trim();
    const comment = document.getElementById("cComment").value.trim();

    const text = buildOrderText({ name, contact, delivery, addr, comment });
    const url = `https://t.me/${MANAGER_USERNAME}?text=${encodeURIComponent(text)}`;
    openTelegram(url);
  };

  syncNav();
  syncBottomSpace();
}

function buildOrderText({ name, contact, delivery, addr, comment }) {
  const lines = [];
  lines.push("🛒 Заказ LesPaw");
  lines.push("");

  if (name) lines.push(`👤 Имя: ${name}`);
  if (contact) lines.push(`📱 Контакт: ${contact}`);
  if (delivery) lines.push(`🚚 Доставка: ${delivery}`);
  if (addr) lines.push(`📍 Адрес/ПВЗ: ${addr}`);
  if (comment) lines.push(`📝 Комментарий: ${comment}`);

  lines.push("");
  lines.push("📦 Состав заказа:");

  let total = 0;

  cart.forEach((it, idx) => {
    const p = getProductById(it.id);
    if (!p) return;

    const fandom = getFandomById(p.fandom_id);
    const unit = calcItemUnitPrice(p, it);
    const qty = Number(it.qty) || 0;
    const lineTotal = unit * qty;
    total += lineTotal;

    const opt = optionLabel(it);
    lines.push(`${idx + 1}) ${p.name} — ${typeLabel(p.product_type)}${fandom?.fandom_name ? ` / ${fandom.fandom_name}` : ""}`);
    if (opt) lines.push(`   • Опции: ${opt}`);
    lines.push(`   • Кол-во: ${qty}`);
    lines.push(`   • Цена: ${money(unit)} / шт.`);
    lines.push(`   • Сумма: ${money(lineTotal)}`);
  });

  lines.push("");
  lines.push(`💳 Итого: ${money(total)}`);
  lines.push("");
  lines.push("✨ Отправлено из Mini App LesPaw");

  return lines.join("\n");
}
