// LesPaw Mini App — app.js v54
// FIX: предыдущий app.js был обрезан в конце (SyntaxError), из-за этого JS не запускался и главный экран был пустой.
//
// Фичи:
// - Главный экран (плитки)
// - Категории -> фандомы -> товары (сетка 2x + фото)
// - Поиск только сверху
// - Примеры ламинации/пленки внутри Mini App (без перехода в TG-пост)
// - Избранное + Корзина + Оформление
// - После добавления товара корзина НЕ открывается
// - На оформлении обязательная галочка (если нет — уведомление)
// - Отправка заказа менеджерке через Telegram link с предзаполненным текстом

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
  // если вне Telegram — не падаем
}

// =====================
// DOM
// =====================
const view = document.getElementById("view");
const globalSearch = document.getElementById("globalSearch");

const navBack = document.getElementById("navBack");
const navHome = document.getElementById("navHome");
const navFav = document.getElementById("navFav");
const navCart = document.getElementById("navCart");

const favCount = document.getElementById("favCount");
const cartCount = document.getElementById("cartCount");

const wrapEl = document.querySelector(".wrap");
const navBarEl = document.querySelector(".navBar");

// =====================
// Storage (старые ключи — чтобы не сбросить корзину/избранное)
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
  if (globalSearch) globalSearch.value = "";
  syncNav();
  renderHome();
  syncBottomSpace();
}

function syncNav() {
  navBack?.classList.toggle("is-active", navStack.length > 0);
  navHome?.classList.toggle("is-active", currentRender === renderHome && navStack.length === 0);
  navFav?.classList.toggle("is-active", currentRender === renderFavorites);
  navCart?.classList.toggle("is-active", currentRender === renderCart);
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

// =====================
// Примеры ламинации / пленки (локально в приложении)
//
// Как пользоваться:
// 1) Вставь прямые ссылки на картинки (https://...jpg/png/webp)
//    Лучше всего — изображения, доступные без авторизации.
// 2) Можно добавлять несколько фото на один пример.
//
// Если images пустой — карточка покажет заглушку (чтобы ты не теряла название).
// =====================
const LAMINATION_EXAMPLES = [
  {
    id: "sugar",
    title: "Сахар",
    subtitle: "Микрорельеф, блестящая крошка",
    images: ["https://raw.githubusercontent.com/bananana624-byte/lespaw-miniapp/main/lamination/%D0%9B%D0%B0%D0%BC%D0%B8%D0%BD%D0%B0%D1%86%D0%B8%D1%8F%20%D0%A1%D0%B0%D1%85%D0%B0%D1%80.jpg"],
  },
  {
    id: "stars",
    title: "Звёздочки",
    subtitle: "Мелкие звёзды",
    images: ["https://raw.githubusercontent.com/bananana624-byte/lespaw-miniapp/main/lamination/%D0%9B%D0%B0%D0%BC%D0%B8%D0%BD%D0%B0%D1%86%D0%B8%D1%8F%20%D0%97%D0%B2%D1%91%D0%B7%D0%B4%D0%BE%D1%87%D0%BA%D0%B8.jpg"],
  },
  {
    id: "snowflakes_small",
    title: "Маленькие снежинки",
    subtitle: "Зимний эффект",
    images: ["https://raw.githubusercontent.com/bananana624-byte/lespaw-miniapp/main/lamination/%D0%9B%D0%B0%D0%BC%D0%B8%D0%BD%D0%B0%D1%86%D0%B8%D1%8F%20%D0%9C%D0%B0%D0%BB%D0%B5%D0%BD%D1%8C%D0%BA%D0%B8%D0%B5%20%D1%81%D0%BD%D0%B5%D0%B6%D0%B8%D0%BD%D0%BA%D0%B8.jpg"],
  },
  {
    id: "stars_big",
    title: "Большие звёзды",
    subtitle: "Крупные звёзды",
    images: ["https://raw.githubusercontent.com/bananana624-byte/lespaw-miniapp/main/lamination/%D0%9B%D0%B0%D0%BC%D0%B8%D0%BD%D0%B0%D1%86%D0%B8%D1%8F%20%D0%91%D0%BE%D0%BB%D1%8C%D1%88%D0%B8%D0%B5%20%D0%B7%D0%B2%D1%91%D0%B7%D0%B4%D1%8B.jpg"],
  },
  {
    id: "holo_overlay",
    title: "Голографическая ламинация",
    subtitle: "Радужные переливы",
    images: ["https://raw.githubusercontent.com/bananana624-byte/lespaw-miniapp/main/lamination/%D0%9B%D0%B0%D0%BC%D0%B8%D0%BD%D0%B0%D1%86%D0%B8%D1%8F%20%D0%93%D0%BE%D0%BB%D0%BE%D0%B3%D1%80%D0%B0%D1%84%D0%B8%D1%8F%20%D0%B1%D0%B5%D0%B7%20%D1%80%D0%B8%D1%81%D1%83%D0%BD%D0%BA%D0%B0.jpg"],
  },

  {
    id: "film_glossy",
    title: "Стандартная глянцевая плёнка",
    subtitle: "Базовая плёнка — всегда глянец",
    description: "Это стандартная плёнка с глянцевой поверхностью. Она всегда глянцевая по своей природе и даёт ровный, чистый блеск без дополнительных эффектов.",
    images: ["https://raw.githubusercontent.com/bananana624-byte/lespaw-miniapp/main/lamination/gl.jpg"],
  },
  {
    id: "film_holo",
    title: "Голографическая плёнка",
    subtitle: "Самая яркая голография (за счёт текстуры плёнки)",
    description: "Тут эффект голографии обычно заметнее и «сочнее», потому что сама плёнка уже голографическая по текстуре. А голографическая ламинация — это прозрачное покрытие с эффектом сверху: оно тоже красиво переливается, но выглядит мягче, потому что основа остаётся прозрачной.",
    images: ["https://raw.githubusercontent.com/bananana624-byte/lespaw-miniapp/main/lamination/gologr.jpg"],
  },

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

  if (favCount) {
    if (favN > 0) {
      favCount.style.display = "";
      favCount.textContent = String(favN);
    } else favCount.style.display = "none";
  }

  if (cartCount) {
    if (cartN > 0) {
      cartCount.style.display = "";
      cartCount.textContent = String(cartN);
    } else cartCount.style.display = "none";
  }
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
  return String(s ?? "").trim();
}

function openTelegramText(toUsername, text) {
  const link = `https://t.me/${toUsername}?text=${encodeURIComponent(text)}`;
  tg?.openTelegramLink(link);
}

function openExternal(url) {
  const u = String(url || "").trim();
  if (!u) return;
  // Telegram WebApp: openLink работает для любых ссылок
  if (tg?.openLink) tg.openLink(u);
  else if (tg?.openTelegramLink && u.startsWith("https://t.me/")) tg.openTelegramLink(u);
  else window.open(u, "_blank", "noopener,noreferrer");
}

// =====================
// Init
// =====================
async function init() {
  try {
    navBack.onclick = () => goBack();
    navHome.onclick = () => resetToHome();
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
// Категории -> типы фандомов
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
// Страница фандома -> товары сеткой 2x (с фото)
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

// =====================
// Примеры ламинации / пленки (внутри приложения)
// =====================
function openExamples() {
  openPage(renderLaminationExamples);
}

function renderLaminationExamples() {
  view.innerHTML = `
    <div class="card">
      <div class="h2">Примеры ламинации и пленки</div>
      <div class="small">Все примеры — прямо здесь, без перехода в Telegram.</div>
      <hr>
      <div class="small"><b>Подсказка:</b> нажми на пример, чтобы открыть его крупно.</div>
      <div class="grid2 exGrid" id="exGrid">
        ${LAMINATION_EXAMPLES.map((ex) => {
          const img = ex.images?.[0] || "";
          const imgHTML = img
            ? `<img class="exImg" src="${img}" alt="${safeText(ex.title)}" loading="lazy">`
            : `<div class="exStub" aria-hidden="true">
                <div class="exStubGlow"></div>
                <div class="exStubText">Нет фото</div>
              </div>`;
          return `
            <div class="exCard" data-exid="${ex.id}">
              ${imgHTML}
              <div class="exTitle">${safeText(ex.title)}</div>
              ${ex.subtitle ? `<div class="exMeta">${safeText(ex.subtitle)}</div>` : ``}
            </div>
          `;
        }).join("")}
      </div>

      <hr>
      <div class="small">
        Если хочешь, я могу вынести эти примеры в отдельную Google-таблицу (CSV), чтобы ты меняла их без правок кода.
      </div>
    </div>
  `;

  view.querySelectorAll("[data-exid]").forEach((el) => {
    el.onclick = () => openPage(() => renderLaminationExampleDetail(el.dataset.exid));
  });

  syncNav();
  syncBottomSpace();
}

function renderLaminationExampleDetail(exId) {
  const ex = LAMINATION_EXAMPLES.find((x) => x.id === exId);
  if (!ex) {
    view.innerHTML = `<div class="card"><div class="h2">Пример не найден</div></div>`;
    syncNav();
    syncBottomSpace();
    return;
  }

  const imgs = Array.isArray(ex.images) ? ex.images.filter(Boolean) : [];

  view.innerHTML = `
    <div class="card">
      <div class="h2">${safeText(ex.title)}</div>
      ${ex.subtitle ? `<div class="small">${safeText(ex.subtitle)}</div>` : ``}
      
      ${ex.description ? `<div class="small" style="margin-top:8px">${safeText(ex.description)}</div>` : ``}
<hr>

      ${imgs.length
        ? `<div class="exBig">
            ${imgs
              .map(
                (u) => `
              <button class="exBigBtn" type="button" data-openimg="${u}">
                <img class="exBigImg" src="${u}" alt="${safeText(ex.title)}" loading="lazy">
              </button>
            `
              )
              .join("")}
          </div>
          <div class="small">Нажми на фото, чтобы открыть отдельно (если нужно приблизить).</div>`
        : `<div class="small">Фото для этого примера пока не добавлено.</div>`}

      <hr>
      <button class="btn" id="exBack">К списку примеров</button>
    </div>
  `;

  document.getElementById("exBack").onclick = () => goBack();
  view.querySelectorAll("[data-openimg]").forEach((b) => {
    b.onclick = () => openExternal(b.dataset.openimg);
  });

  syncNav();
  syncBottomSpace();
}

// =====================
// Поиск (только сверху)
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

  const overlayDelta = Number(settings.overlay_price_delta) || 0;
  const holoDelta = Number(settings.holo_base_price_delta) || 0;

  const isSticker = (p.product_type || "") === "sticker";

  let selectedOverlay = "none";
  let selectedBase = "normal"; // normal | holo

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
    render();
  }

  function addToCart() {
    const item = {
      id: p.id,
      qty: 1,
      overlay: isSticker ? selectedOverlay : "",
      base: isSticker ? selectedBase : "",
    };

    const existing = cart.find(
      (x) => x.id === item.id && (x.overlay || "") === (item.overlay || "") && (x.base || "") === (item.base || "")
    );

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


      // стартовые состояния
      syncBtns();
    }

    syncNav();
    syncBottomSpace();
  }

  render();
}

// =====================
// Favorites
// =====================
function renderFavorites() {
  const items = (fav || [])
    .map((id) => getProductById(id))
    .filter(Boolean);

  view.innerHTML = `
    <div class="card">
      <div class="h2">Избранное</div>
      <div class="small">Товары, которые ты отметила сердечком.</div>
      <hr>

      <div class="list" id="favList">
        ${
          items.length
            ? items
                .map((p) => {
                  const img = firstImageUrl(p);
                  return `
                    <div class="item" data-open="${p.id}">
                      <div class="title">${p.name}</div>
                      <div class="meta">${money(p.price)} · ${typeLabel(p.product_type)}${img ? " · есть фото" : ""}</div>
                      <div class="row" style="margin-top:10px">
                        <button class="btn" data-remove="${p.id}">Убрать</button>
                        <button class="btn is-active" data-to-cart="${p.id}">В корзину</button>
                      </div>
                    </div>
                  `;
                })
                .join("")
            : `<div class="small">Пока пусто. Открой товар и нажми “♡ В избранное”.</div>`
        }
      </div>
    </div>
  `;

  view.querySelectorAll("[data-open]").forEach((el) => {
    el.onclick = (e) => {
      // если кликнули по кнопкам — не открываем карточку
      const t = e.target;
      if (t && (t.closest("button") || t.tagName === "BUTTON")) return;
      openPage(() => renderProduct(el.dataset.open));
    };
  });

  view.querySelectorAll("[data-remove]").forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const id = b.dataset.remove;
      setFav((fav || []).filter((x) => x !== id));
      toast("Убрано из избранного", "warn");
      renderFavorites();
    };
  });

  view.querySelectorAll("[data-to-cart]").forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const id = b.dataset.toCart;
      // в избранном опций (покрытие/основа) нет — добавляем базовый вариант
      const existing = cart.find((x) => x.id === id && !(x.overlay || "") && !(x.base || ""));
      if (existing) {
        existing.qty = (Number(existing.qty) || 0) + 1;
        setCart([...cart]);
      } else {
        setCart([...cart, { id, qty: 1, overlay: "", base: "" }]);
      }
      toast("Добавлено в корзину", "good");
      renderFavorites();
    };
  });

  syncNav();
  syncBottomSpace();
}

// =====================
// Cart
// =====================
function optionLabelForCartItem(ci) {
  const parts = [];
  if ((ci.base || "") === "holo") parts.push("Основа: голографическая");
  else if ((ci.base || "") === "normal") parts.push("Основа: обычная");

  if (ci.overlay && ci.overlay !== "none") parts.push(`Покрытие: ${OVERLAY_LABELS[ci.overlay] || ci.overlay}`);
  else if (ci.overlay === "none") parts.push("Покрытие: без");

  return parts.length ? parts.join(" · ") : "";
}

function calcCartTotal() {
  let total = 0;
  const overlayDelta = Number(settings.overlay_price_delta) || 0;
  const holoDelta = Number(settings.holo_base_price_delta) || 0;

  (cart || []).forEach((ci) => {
    const p = getProductById(ci.id);
    if (!p) return;
    let price = Number(p.price) || 0;
    if ((p.product_type || "") === "sticker") {
      if ((ci.overlay || "") && ci.overlay !== "none") price += overlayDelta;
      if ((ci.base || "") === "holo") price += holoDelta;
    }
    total += price * (Number(ci.qty) || 0);
  });

  return total;
}

function renderCart() {
  const items = (cart || []).filter((ci) => getProductById(ci.id));

  view.innerHTML = `
    <div class="card">
      <div class="h2">Корзина</div>
      <div class="small">Тут собирается твой заказ.</div>
      <hr>

      <div class="list" id="cartList">
        ${
          items.length
            ? items
                .map((ci, idx) => {
                  const p = getProductById(ci.id);
                  const opt = optionLabelForCartItem(ci);
                  return `
                    <div class="item" data-idx="${idx}">
                      <div class="title">${p.name}</div>
                      <div class="meta">${money(p.price)} · ${typeLabel(p.product_type)}${opt ? ` · ${opt}` : ""}</div>

                      <div class="row" style="margin-top:10px; align-items:center">
                        <button class="btn" data-dec="${idx}">−</button>
                        <div class="small" style="min-width:34px; text-align:center"><b>${Number(ci.qty) || 1}</b></div>
                        <button class="btn" data-inc="${idx}">+</button>
                        <div style="flex:1"></div>
                        <button class="btn" data-rm="${idx}">Удалить</button>
                      </div>
                    </div>
                  `;
                })
                .join("")
            : `<div class="small">Корзина пустая. Открой фандом → товар → “Добавить в корзину”.</div>`
        }
      </div>

      ${
        items.length
          ? `
        <hr>
        <div class="small">Итого: <b>${money(calcCartTotal())}</b></div>
        <div style="height:10px"></div>
        <div class="row">
          <button class="btn" id="btnClear">Очистить</button>
          <button class="btn is-active" id="btnCheckout">Оформить заказ</button>
        </div>
      `
          : ""
      }
    </div>
  `;

  view.querySelectorAll("[data-inc]").forEach((b) => {
    b.onclick = () => {
      const i = Number(b.dataset.inc);
      const next = [...cart];
      next[i].qty = (Number(next[i].qty) || 0) + 1;
      setCart(next);
      renderCart();
    };
  });

  view.querySelectorAll("[data-dec]").forEach((b) => {
    b.onclick = () => {
      const i = Number(b.dataset.dec);
      const next = [...cart];
      const q = (Number(next[i].qty) || 1) - 1;
      if (q <= 0) next.splice(i, 1);
      else next[i].qty = q;
      setCart(next);
      renderCart();
    };
  });

  view.querySelectorAll("[data-rm]").forEach((b) => {
    b.onclick = () => {
      const i = Number(b.dataset.rm);
      const next = [...cart];
      next.splice(i, 1);
      setCart(next);
      toast("Удалено", "warn");
      renderCart();
    };
  });

  const btnClear = document.getElementById("btnClear");
  if (btnClear) {
    btnClear.onclick = () => {
      setCart([]);
      toast("Корзина очищена", "warn");
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
const LS_CHECKOUT = "lespaw_checkout_v1";
let checkout = loadJSON(LS_CHECKOUT, {
  name: "",
  contact: "",
  city: "",
  delivery: "",
  comment: "",
});

function saveCheckout(next) {
  checkout = next;
  saveJSON(LS_CHECKOUT, checkout);
}

function buildOrderText() {
  const lines = [];
  lines.push("🛍 Заказ LesPaw");

  if (checkout.name) lines.push(`👤 Имя: ${checkout.name}`);
  if (checkout.contact) lines.push(`📱 Контакт: ${checkout.contact}`);
  if (checkout.city) lines.push(`🏙 Город: ${checkout.city}`);
  if (checkout.delivery) lines.push(`🚚 Доставка/ПВЗ: ${checkout.delivery}`);
  if (checkout.comment) lines.push(`📝 Комментарий: ${checkout.comment}`);

  lines.push("\n📦 Товары:");

  const overlayDelta = Number(settings.overlay_price_delta) || 0;
  const holoDelta = Number(settings.holo_base_price_delta) || 0;

  let total = 0;

  (cart || []).forEach((ci) => {
    const p = getProductById(ci.id);
    if (!p) return;

    const fandom = getFandomById(p.fandom_id);

    let price = Number(p.price) || 0;
    if ((p.product_type || "") === "sticker") {
      if ((ci.overlay || "") && ci.overlay !== "none") price += overlayDelta;
      if ((ci.base || "") === "holo") price += holoDelta;
    }

    const qty = Number(ci.qty) || 1;
    total += price * qty;

    const opt = optionLabelForCartItem(ci);
    const fandomName = fandom?.fandom_name ? ` — ${fandom.fandom_name}` : "";
    lines.push(`• ${p.name}${fandomName}`);
    if (opt) lines.push(`  ${opt}`);
    lines.push(`  ${qty} шт · ${money(price)} за шт`);
  });

  lines.push(`\n💜 Итого: ${money(total)}`);
  lines.push(`\nСвязь: @${MANAGER_USERNAME}`);

  return lines.join("\n");
}

function renderCheckout() {
  if (!cart || !cart.length) {
    view.innerHTML = `
      <div class="card">
        <div class="h2">Оформление</div>
        <div class="small">Корзина пустая — нечего оформлять.</div>
        <hr>
        <button class="btn is-active" id="goHome">На главную</button>
      </div>
    `;
    document.getElementById("goHome").onclick = () => resetToHome();
    syncNav();
    syncBottomSpace();
    return;
  }

  view.innerHTML = `
    <div class="card">
      <div class="h2">Оформление заказа</div>
      <div class="small">Заполни данные — и нажми «Отправить заказ».</div>
      <hr>

      <div class="small"><b>Имя</b></div>
      <input class="searchInput" id="cName" placeholder="Как к тебе обращаться" value="${(checkout.name || "").replace(/"/g, "&quot;")}">
      <div style="height:10px"></div>

      <div class="small"><b>Контакт</b></div>
      <input class="searchInput" id="cContact" placeholder="@ник или телефон" value="${(checkout.contact || "").replace(/"/g, "&quot;")}">
      <div style="height:10px"></div>

      <div class="small"><b>Город</b></div>
      <input class="searchInput" id="cCity" placeholder="Город" value="${(checkout.city || "").replace(/"/g, "&quot;")}">
      <div style="height:10px"></div>

      <div class="small"><b>Доставка / ПВЗ</b></div>
      <input class="searchInput" id="cDelivery" placeholder="Напр. Яндекс ПВЗ / 5post + адрес/код" value="${(checkout.delivery || "").replace(/"/g, "&quot;")}">
      <div style="height:10px"></div>

      <div class="small"><b>Комментарий</b></div>
      <input class="searchInput" id="cComment" placeholder="Если нужно" value="${(checkout.comment || "").replace(/"/g, "&quot;")}">

      <hr>

      <label class="small" style="display:flex; gap:10px; align-items:flex-start; user-select:none">
        <input type="checkbox" id="agree" style="margin-top:2px">
        <span>Я ознакомилась с «Важной информацией» (оплата, сроки, доставка) и согласна с условиями.</span>
      </label>

      <div style="height:12px"></div>

      <div class="row">
        <button class="btn" id="btnPreview">Посмотреть текст заказа</button>
        <button class="btn is-active" id="btnSend">Отправить заказ менеджерке</button>
      </div>

      <div id="preview" style="display:none; margin-top:12px">
        <hr>
        <div class="small" style="white-space:pre-wrap" id="orderText"></div>
      </div>
    </div>
  `;

  const cName = document.getElementById("cName");
  const cContact = document.getElementById("cContact");
  const cCity = document.getElementById("cCity");
  const cDelivery = document.getElementById("cDelivery");
  const cComment = document.getElementById("cComment");

  function syncCheckout() {
    saveCheckout({
      name: cName.value || "",
      contact: cContact.value || "",
      city: cCity.value || "",
      delivery: cDelivery.value || "",
      comment: cComment.value || "",
    });
  }

  [cName, cContact, cCity, cDelivery, cComment].forEach((el) => el.addEventListener("input", syncCheckout));

  const btnPreview = document.getElementById("btnPreview");
  const btnSend = document.getElementById("btnSend");
  const agree = document.getElementById("agree");

  btnPreview.onclick = () => {
    syncCheckout();
    const box = document.getElementById("preview");
    const textEl = document.getElementById("orderText");
    textEl.textContent = buildOrderText();
    box.style.display = "";
    syncBottomSpace();
  };

  btnSend.onclick = () => {
    syncCheckout();

    if (!agree.checked) {
      toast("Поставь галочку, пожалуйста: нужно подтвердить условия 😿", "warn");
      return;
    }

    const text = buildOrderText();
    // Открываем чат с менеджеркой и подставляем текст.
    // В Telegram поле ввода в любом случае можно редактировать — но внутри приложения мы НЕ даём редактируемое поле.
    const link = `https://t.me/${MANAGER_USERNAME}?text=${encodeURIComponent(text)}`;
    tg?.openTelegramLink(link);
    toast("Открываю чат с менеджеркой…", "good");
  };

  syncNav();
  syncBottomSpace();
}
