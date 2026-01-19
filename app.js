// LesPaw Mini App — app.js v44 (thumbs in grid cards + robust safe bottom space)
//
// IMPORTANT:
// - Мини-карточки товара с фото (если есть ссылки)
// - splitList поддерживает: запятая, ;, переносы строк
// - images берём из: images / image / image_url / photo / img (fallback)
// - Нижний отступ под навбар рассчитываем JS (чтобы не перекрывалось)

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
tg?.ready();
tg?.expand();

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
// Storage (оставила прежние ключи, чтобы не сбросить корзину/избранное у людей)
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
// Safe bottom space (nav must NOT cover content)
// =====================
function syncBottomSpace() {
  if (!wrapEl || !navBarEl) return;
  const h = navBarEl.offsetHeight || 70;
  // 18px bottom gap + glow/air + nav height; safe-area учитываем через env()
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
const OVERLAY_LABELS = Object.fromEntries(OVERLAY_OPTIONS);

function truthy(v) {
  return String(v || "").trim().toUpperCase() === "TRUE";
}
function money(n) {
  return `${Number(n) || 0} ₽`;
}

// ✅ ВАЖНО: поддержка " , ; \n "
function splitList(s) {
  return (s || "")
    .split(/[,;\n]+/g)
    .map((x) => x.trim())
    .filter(Boolean);
}

function isDigitStart(name) {
  return /^[0-9]/.test((name || "").trim());
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
  // пробуем несколько названий колонок
  return (
    p?.images ||
    p?.image ||
    p?.image_url ||
    p?.photo ||
    p?.img ||
    ""
  );
}

function firstImageUrl(p) {
  const imgs = splitList(imagesField(p));
  return imgs[0] || "";
}

function cardThumbHTML(p) {
  const u = firstImageUrl(p);
  if (!u) return ""; // если пусто — просто без картинки (не ломаем сетку)
  return `<img class="pcardImg" src="${u}" alt="Фото товара" loading="lazy">`;
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
    products = await fetchCSV(CSV_PRODUCTS_URL);

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
        <div class="small">${String(e)}</div>
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
// Страница фандома → товары сеткой 2× (с фотками)
// =====================
function renderFandomPage(fandomId) {
  const f = getFandomById(fandomId);
  const all = products.filter((p) => p.fandom_id === fandomId);

  const typeTabs = ["all", "sticker", "pin", "poster", "box"];
  const tabNames = { all: "Все", sticker: "Наклейки", pin: "Значки", poster: "Постеры", box: "Боксы" };

  view.innerHTML = `
    <div class="card">
      <div class="h2">${f?.fandom_name || "Фандом"}</div>
      <div class="row" id="tabs">
        ${typeTabs.map((t) => `<button class="btn" data-t="${t}">${tabNames[t]}</button>`).join("")}
      </div>
      <hr>
      <div class="grid2" id="prodList"></div>
    </div>
  `;

  let currentTab = "all";

  function setActiveTab() {
    document.querySelectorAll("#tabs .btn").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.t === currentTab);
    });
  }

  function renderList() {
    const filtered = all.filter((p) => (currentTab === "all" ? true : p.product_type === currentTab));
    const prodList = document.getElementById("prodList");

    prodList.innerHTML = filtered.length
      ? filtered
          .map(
            (p) => `
          <div class="pcard" data-id="${p.id}">
            ${cardThumbHTML(p)}
            <div class="pcardTitle">${p.name}</div>
            <div class="pcardMeta">${money(p.price)} · ${typeLabel(p.product_type)}</div>
          </div>
        `
          )
          .join("")
      : `<div class="small">Пока нет товаров.</div>`;

    prodList.querySelectorAll("[data-id]").forEach((el) => {
      el.onclick = () => openPage(() => renderProduct(el.dataset.id));
    });

    syncBottomSpace();
  }

  document.querySelectorAll("#tabs .btn").forEach((b) => {
    b.onclick = () => {
      currentTab = b.dataset.t;
      setActiveTab();
      renderList();
    };
  });

  setActiveTab();
  renderList();
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

  document.getElementById("btnMain").onclick = () => tg?.openTelegramLink(MAIN_CHANNEL_URL);
  document.getElementById("btnSuggest").onclick = () => tg?.openTelegramLink(SUGGEST_URL);

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
  document.getElementById("openReviews").onclick = () => tg?.openTelegramLink(REVIEWS_URL);
  syncNav();
  syncBottomSpace();
}

function openExamples() {
  const url = settings.examples_url || "https://t.me/LesPaw";
  tg?.openTelegramLink(url);
}

// =====================
// Поиск (только сверху) — товары тоже с фотками
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
      <div class="h2">Поиск: “${q}”</div>

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
// Product page (полная карточка)
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

  // Покрытие / база (используем existing settings)
  const overlayDelta = Number(settings.overlay_price_delta) || 0;
  const holoDelta = Number(settings.holo_base_price_delta) || 0;

  const isSticker = (p.product_type || "") === "sticker";

  // состояние выбора
  let selectedOverlay = "none";
  let selectedBase = "normal"; // normal | holo (для наклеек)

  function calcPrice() {
    let price = Number(p.price) || 0;
    if (isSticker) {
      if (selectedOverlay !== "none") price += overlayDelta;
      if (selectedBase === "holo") price += holoDelta;
    }
    return price;
  }

  function inFav() {
    return fav.includes(p.id);
  }
  function favToggle() {
    if (inFav()) setFav(fav.filter((id) => id !== p.id));
    else setFav([...fav, p.id]);
    render(); // перерисуем кнопку
  }

  function addToCart() {
    const item = {
      id: p.id,
      qty: 1,
      // сохраняем опции (чтобы заказ сформировался корректно)
      overlay: isSticker ? selectedOverlay : "",
      base: isSticker ? selectedBase : "",
    };
    const existing = cart.find((x) => x.id === item.id && (x.overlay || "") === (item.overlay || "") && (x.base || "") === (item.base || ""));
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
