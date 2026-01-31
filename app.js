// LesPaw Mini App — app.js v160 (hotfix: syntax + csv bg update)
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

// Отзывы (CSV)
// Колонки в листе reviews: is_active, author, text, date, rating, photo_url, source_url
// Если ссылка пустая — вкладка «Отзывы» откроет Telegram-пост.
const CSV_REVIEWS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ_WJrd_-W-ZSVqZqUs8YhumHkSjfHrt4xBV3nZEcUTRVyPeF15taLFiaw1gzJcK7m33sLjmkhP-Zk/pub?gid=1255489745&single=true&output=csv";

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
// Analytics (GA4) — LesPaw
// =====================
function gaEvent(name, params = {}) {
  try {
    if (typeof window.gtag === "function") {
      window.gtag("event", name, params || {});
    }
  } catch {}
}

let __gaAppOpenFired = false;
function gaAppOpen() {
  if (__gaAppOpenFired) return;
  __gaAppOpenFired = true;
  gaEvent("app_open");
}

// =====================
// DOM
// =====================
const view = document.getElementById("view");
const globalSearch = document.getElementById("globalSearch");
const searchClear = document.getElementById("searchClear");
const searchWrap = globalSearch ? globalSearch.closest(".searchWrap") : null;

const navBack = document.getElementById("navBack");
const navHome = document.getElementById("navHome");
const navFav = document.getElementById("navFav");
const navCart = document.getElementById("navCart");

const favCount = document.getElementById("favCount");
const cartCount = document.getElementById("cartCount");

const wrapEl = document.querySelector(".wrap");
const navBarEl = document.querySelector(".navBar");

// =====================
// Storage (локально + синхронизация между устройствами через Telegram CloudStorage)
// =====================
// локальные ключи (оставляем старые — чтобы не сбросить корзину/избранное после обновлений)
const LS_CART = "lespaw_cart_v41";
const LS_FAV = "lespaw_fav_v41";

// Гейт важной информации (для оформления)
const LS_INFO_VIEWED = "lespaw_info_viewed_v1";

// Флаг: ознакомилась ли пользователька с "Важной информацией"
let infoViewed = false;
try { infoViewed = (localStorage.getItem(LS_INFO_VIEWED) === "1"); } catch {}

// Флаг на текущую сессию оформления: галочку можно поставить только после перехода на вкладку
let infoViewedThisSession = false;


// облачные ключи (единые для одного Telegram-аккаунта на всех устройствах)
const CS_CART = "lespaw_cart";
const CS_FAV = "lespaw_fav";
const CS_INFO_VIEWED = "lespaw_info_viewed";

function loadJSON(key, fallback) {
  try {
    return JSON.parse(localStorage.getItem(key)) ?? fallback;
  } catch {
    return fallback;
  }
}
function saveJSON(key, value) {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch {}
}

// Формат синхронизации: { items: [...], updatedAt: number }
// Для обратной совместимости принимаем и массив.
function normalizeSynced(raw) {
  try {
    if (Array.isArray(raw)) return { items: raw, updatedAt: 0 };
    if (raw && typeof raw === "object" && Array.isArray(raw.items)) {
      const ts = Number(raw.updatedAt || 0);
      return { items: raw.items, updatedAt: Number.isFinite(ts) ? ts : 0 };
    }
  } catch {}
  return { items: [], updatedAt: 0 };
}


function cloudAvailable() {
  return !!tg?.CloudStorage?.getItem && !!tg?.CloudStorage?.setItem;
}
function cloudGet(key) {
  return new Promise((resolve) => {
    if (!cloudAvailable()) return resolve(null);
    try {
      tg.CloudStorage.getItem(key, (err, value) => {
        if (err || value == null || value === "") return resolve(null);
        resolve(value);
      });
    } catch {
      resolve(null);
    }
  });
}
function cloudSet(key, value) {
  return new Promise((resolve) => {
    if (!cloudAvailable()) return resolve(false);
    try {
      tg.CloudStorage.setItem(key, value, (err) => resolve(!err));
    } catch {
      resolve(false);
    }
  });
}

async function loadSyncedState() {
  // 1) локальное состояние (быстрый старт)
  const localCartRaw = loadJSON(LS_CART, []);
  const localFavRaw = loadJSON(LS_FAV, []);
  const localCartN = normalizeSynced(localCartRaw);
  const localFavN = normalizeSynced(localFavRaw);

  // 2) облако (может быть пустым / старым / в старом формате-массиве)
  const [cloudCartRawStr, cloudFavRawStr, cloudInfoRawStr] = await Promise.all([cloudGet(CS_CART), cloudGet(CS_FAV), cloudGet(CS_INFO_VIEWED)]);
  let cloudCartRaw = null;
  let cloudFavRaw = null;

  try { if (cloudCartRawStr) cloudCartRaw = JSON.parse(cloudCartRawStr); } catch {}
  try { if (cloudFavRawStr) cloudFavRaw = JSON.parse(cloudFavRawStr); } catch {}

  const cloudCartN = normalizeSynced(cloudCartRaw);
  const cloudFavN = normalizeSynced(cloudFavRaw);

  // 3) выбор источника истины: если в облаке есть данные — сравним свежесть
  const pickNewer = (a, b) => (Number(a.updatedAt || 0) >= Number(b.updatedAt || 0) ? a : b);

  const chosenCartN =
    (cloudCartN.items && cloudCartN.items.length)
      ? (localCartN.items && localCartN.items.length ? pickNewer(cloudCartN, localCartN) : cloudCartN)
      : localCartN;

  const chosenFavN =
    (cloudFavN.items && cloudFavN.items.length)
      ? (localFavN.items && localFavN.items.length ? pickNewer(cloudFavN, localFavN) : cloudFavN)
      : localFavN;

  cart = Array.isArray(chosenCartN.items) ? chosenCartN.items : [];
  fav = Array.isArray(chosenFavN.items) ? chosenFavN.items : [];

  cartUpdatedAt = Number(chosenCartN.updatedAt || 0) || 0;
  favUpdatedAt = Number(chosenFavN.updatedAt || 0) || 0;

  // 4) если облако пустое, но локальные данные есть — зальём их в облако (инициализация)
  if (!(cloudCartN.items && cloudCartN.items.length) && cart.length) {
    cartUpdatedAt = cartUpdatedAt || Date.now();
    cloudSet(CS_CART, JSON.stringify({ items: cart, updatedAt: cartUpdatedAt })).catch(() => {});
  }
  if (!(cloudFavN.items && cloudFavN.items.length) && fav.length) {
    favUpdatedAt = favUpdatedAt || Date.now();
    cloudSet(CS_FAV, JSON.stringify({ items: fav, updatedAt: favUpdatedAt })).catch(() => {});
  }

  // 5) сохраним в локалку выбранное (быстрый старт дальше)
  saveJSON(LS_CART, { items: cart, updatedAt: cartUpdatedAt || 0 });
  saveJSON(LS_FAV, { items: fav, updatedAt: favUpdatedAt || 0 });


  // 6) синхронизация гейта "Важная информация" (однажды прочитала — сохраняем навсегда)
  try {
    let cloudInfo = null;
    if (cloudInfoRawStr) {
      // поддержка старых форматов: "1" или {"v":1}
      if (cloudInfoRawStr === "1") cloudInfo = 1;
      else {
        try { const o = JSON.parse(cloudInfoRawStr); cloudInfo = (o?.v === 1 || o?.v === "1") ? 1 : null; } catch {}
      }
    }
    if (cloudInfo === 1) {
      infoViewed = true;
      try { localStorage.setItem(LS_INFO_VIEWED, "1"); } catch {}
  cloudSet(CS_INFO_VIEWED, "1").catch(() => {});
    } else if (infoViewed) {
      // если локально уже было "прочитано", а в облаке пусто — инициализируем облако
      cloudSet(CS_INFO_VIEWED, "1").catch(() => {});
    }
  } catch {}

}

let cart = [];
let fav = [];
let cartUpdatedAt = 0;
let favUpdatedAt = 0;

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
// Scroll helper (always open screens from top)
// =====================
function scrollToTop() {
  try {
    // Telegram WebView sometimes keeps scroll between renders
    window.scrollTo(0, 0);
    document.documentElement && (document.documentElement.scrollTop = 0);
    document.body && (document.body.scrollTop = 0);
  } catch {}
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
  if (typeof renderFn !== "function") {
    console.error("openPage: renderFn is not a function", renderFn);
    return;
  }
  if (currentRender) navStack.push(currentRender);
  currentRender = renderFn;
  syncNav();
  try { renderFn(); } catch (err) {
    console.error(err);
    toast("Ошибка экрана", "warn");
    currentRender = renderHome;
    navStack.length = 0;
    syncNav();
    renderHome();
  }
  scrollToTop();
  syncBottomSpace();
}

function goBack() {
  if (navStack.length === 0) {
    resetToHome();
    return;
  }
  const prev = navStack.pop();
  currentRender = (typeof prev === "function") ? prev : renderHome;
  syncNav();
  try { currentRender(); } catch (err) {
    console.error(err);
    resetToHome();
  }
  scrollToTop();
  syncBottomSpace();
}

function resetToHome() {
  navStack.length = 0;
  currentRender = renderHome;
  if (globalSearch) globalSearch.value = "";
  syncNav();
  renderHome();
  scrollToTop();
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
let reviews = [];
let reviewsVisibleCount = 8;
let settings = {
  overlay_price_delta: 100,
  holo_base_price_delta: 100,
  examples_url: "https://t.me/LesPaw",
};

// =====================
// CSV utils
// =====================
// =====================
// CSV CACHE (ускорение загрузки)
// - сначала пробуем взять данные из localStorage (быстро)
// - затем тихо обновляем в фоне (чтобы данные не устаревали)
// =====================
const LS_CSV_CACHE_FANDOMS = "lespaw_csv_cache_fandoms_v1";
const LS_CSV_CACHE_PRODUCTS = "lespaw_csv_cache_products_v1";
const LS_CSV_CACHE_SETTINGS = "lespaw_csv_cache_settings_v1";
const LS_CSV_CACHE_REVIEWS = "lespaw_csv_cache_reviews_v1";
const CSV_CACHE_TTL_MS = 1000 * 60 * 60 * 6; // 6 часов

function loadCsvCache(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !Array.isArray(obj.data)) return null;
    return obj;
  } catch {
    return null;
  }
}
function saveCsvCache(key, data) {
  try {
    localStorage.setItem(key, JSON.stringify({ ts: Date.now(), data }));
  } catch {
    // ignore
  }
}
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
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CSV fetch failed (${res.status})`);
  return parseCSV(await res.text());
}

// Быстрое сравнение больших CSV без JSON.stringify (меньше лагов на слабых телефонах)
function fnv1aUpdate(h, str) {
  str = String(str ?? "");
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function hashRows(rows) {
  if (!Array.isArray(rows)) return 0;
  let h = 2166136261 >>> 0;
  for (let r = 0; r < rows.length; r++) {
    const row = rows[r] || {};
    for (const k in row) {
      h = fnv1aUpdate(h, k);
      h = fnv1aUpdate(h, row[k]);
    }
    h = fnv1aUpdate(h, "\n");
  }
  // смешаем ещё длину
  h = fnv1aUpdate(h, rows.length);
  return h >>> 0;
}


async function fetchCSVWithCache(url, cacheKey) {
  const cached = loadCsvCache(cacheKey);
  // Если кеш свежий — используем сразу и параллельно обновляем в фоне
  if (cached && Date.now() - (cached.ts || 0) < CSV_CACHE_TTL_MS) {
    // фон-обновление (не блокируем UI)
    fetchCSV(url)
      .then((fresh) => {
        try {
          const same = (hashRows(fresh) === hashRows(cached.data));
          saveCsvCache(cacheKey, fresh);
          if (!same) onCsvBackgroundUpdate(cacheKey, fresh);
        } catch {
          saveCsvCache(cacheKey, fresh);
        }
      })
      .catch(() => {});
    return cached.data;
  }
  // иначе грузим как обычно
  const fresh = await fetchCSV(url);
  saveCsvCache(cacheKey, fresh);
  return fresh;
}


let _csvBgToastShown = false;
function onCsvBackgroundUpdate(cacheKey, freshData) {
  try {
    if (cacheKey === LS_CSV_CACHE_PRODUCTS) {
      products = normalizeProducts(freshData || []);
    } else if (cacheKey === LS_CSV_CACHE_REVIEWS) {
      reviews = normalizeReviews(freshData || []);
    } else if (cacheKey === LS_CSV_CACHE_FANDOMS) {
      fandoms = normalizeFandoms(freshData || []);
    } else if (cacheKey === LS_CSV_CACHE_SETTINGS) {
      // settings хранится как объект key->value
      const next = {};
      (freshData || []).forEach((row) => {
        const k = String(row.key || "").trim();
        const v = String(row.value ?? "").trim();
        if (!k) return;
        if (k === "overlay_price_delta" || k === "holo_base_price_delta") next[k] = Number(v);
        else next[k] = v;
      });
      settings = next;
    } else return;

    try {
      if (typeof currentRender === "function" && currentRender !== renderHome) currentRender();
    } catch {}

    if (!_csvBgToastShown) {
      _csvBgToastShown = true;
      toast("Каталог обновлён ✨");
    }
  } catch {}
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

const CATEGORY_EMOJI = {
  "Фильмы": "🎬",
  "Игры": "🎮",
  "Сериалы": "📺",
  "Актрисы и певицы": "🎤",
  "Аниме": "📘",
  "Мультсериалы": "🌈",
  "Манхвы / манги": "🌸",
  "Лакорны": "💋",
  "Что-то тематическое": "✨",
};

const FILM_LABELS = {
  film_glossy: "Стандартная глянцевая плёнка",
  film_holo: "Голографическая плёнка",
};
const STICKER_LAM_LABELS = {
  none: "Без ламинации",
  sugar: "Сахар",
  stars: "Звёздочки",
  snowflakes_small: "Маленькие снежинки",
  stars_big: "Большие звёзды",
  holo_overlay: "Голографическая ламинация",
};
const PIN_LAM_LABELS = {
  pin_base: "Глянцевая ламинация (базовая)",
  sugar: "Сахар",
  stars: "Звёздочки",
  snowflakes_small: "Маленькие снежинки",
  stars_big: "Большие звёзды",
  holo_overlay: "Голографическая ламинация",
};

// Posters: packs + paper (interactive options)
const POSTER_PACKS = [
  ["p10x15_8", "8 фотопостеров 10 × 15 см", 450],
  ["p21x30_5", "5 фотопостеров 21 × 30 см", 750],
  ["p_mix", "8 фотопостеров 10 × 15 см + 5 фотопостеров 21 × 30 см", 1100],
];
const POSTER_PAPERS = [
  ["glossy", "Глянцевая — яркие цвета и выразительный блеск", 0],
  ["matte", "Матовая — мягкая цветопередача без бликов", 0],
];
const POSTER_PACK_LABELS = Object.fromEntries(POSTER_PACKS.map(x=>[x[0], x[1]]));
const POSTER_PAPER_LABELS = Object.fromEntries(POSTER_PAPERS.map(x=>[x[0], x[1]]));
const POSTER_PACK_PRICES = Object.fromEntries(POSTER_PACKS.map(x=>[x[0], Number(x[2]||0)]));


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
  // ===== ПЛЁНКА (основа) =====
  {
    id: "film_glossy",
    kind: "film",
    title: "Стандартная глянцевая плёнка",
    subtitle: "База (по умолчанию)",
    description:
      "Это стандартная глянцевая плёнка, на которой печатаются все наклейки по умолчанию. " +
      "Даёт ровную поверхность, хорошую цветопередачу и насыщенные оттенки. " +
      "Если не указано иное — наклейка будет напечатана именно на этой плёнке.",
    images: ["https://raw.githubusercontent.com/bananana624-byte/lespaw-miniapp/main/lamination/gl.jpg"],
  },
  {
    id: "film_holo",
    kind: "film",
    title: "Голографическая плёнка",
    subtitle: "Яркая голография",
    description:
      "Плёнка с выраженной голографической текстурой по всей поверхности — эффект заметный при любом освещении. " +
      "Важно: у плёнки сероватая основа, поэтому при печати цвета могут выглядеть немного тусклее и уходить в серый оттенок " +
      "(по сравнению с обычной глянцевой плёнкой). " +
      "Зато голографический эффект получается максимально «сочным».",
    images: ["https://raw.githubusercontent.com/bananana624-byte/lespaw-miniapp/main/lamination/gologr.jpg"],
  },

  // ===== ЛАМИНАЦИЯ (прозрачное покрытие сверху) =====
  {
    id: "sugar",
    kind: "lamination",
    title: "Сахар",
    subtitle: "Мелкие искры",
    description:
      "Ламинация с мелкой блестящей «крошкой». " +
      "Смотрится как нежное мерцание — красиво подсвечивает дизайн, но не перетягивает внимание.",
    images: [
      "https://raw.githubusercontent.com/bananana624-byte/lespaw-miniapp/main/lamination/%D0%9B%D0%B0%D0%BC%D0%B8%D0%BD%D0%B0%D1%86%D0%B8%D1%8F%20%D0%A1%D0%B0%D1%85%D0%B0%D1%80.jpg",
    ],
  },
  {
    id: "stars",
    kind: "lamination",
    title: "Звёздочки",
    subtitle: "Милые звёзды",
    description:
      "Прозрачная ламинация с маленькими звёздами. " +
      "Переливается при наклоне и даёт эффект «волшебства», при этом рисунок остаётся читаемым.",
    images: [
      "https://raw.githubusercontent.com/bananana624-byte/lespaw-miniapp/main/lamination/%D0%9B%D0%B0%D0%BC%D0%B8%D0%BD%D0%B0%D1%86%D0%B8%D1%8F%20%D0%97%D0%B2%D1%91%D0%B7%D0%B4%D0%BE%D1%87%D0%BA%D0%B8.jpg",
    ],
  },
  {
    id: "snowflakes_small",
    kind: "lamination",
    title: "Маленькие снежинки",
    subtitle: "Самый яркий блеск",
    description:
      "Ламинация с большим количеством мелких снежинок и точечного блеска по всей поверхности. " +
      "Эффект очень ярко выражен: активно переливается при движении и на свету. " +
      "По насыщенности блеска ярче, чем «Звёздочки», и заметнее, чем «Сахар» — если хочется максимального сияния.",
    images: [
      "https://raw.githubusercontent.com/bananana624-byte/lespaw-miniapp/main/lamination/%D0%9B%D0%B0%D0%BC%D0%B8%D0%BD%D0%B0%D1%86%D0%B8%D1%8F%20%D0%9C%D0%B0%D0%BB%D0%B5%D0%BD%D1%8C%D0%BA%D0%B8%D0%B5%20%D1%81%D0%BD%D0%B5%D0%B6%D0%B8%D0%BD%D0%BA%D0%B8.jpg",
    ],
  },
  {
    id: "stars_big",
    kind: "lamination",
    title: "Большие звёзды",
    subtitle: "Акцентные звёзды",
    description:
      "Ламинация с более крупными звёздами — эффект заметный и «праздничный». " +
      "Лучше всего раскрывается на контрастных дизайнах и крупных деталях.",
    images: [
      "https://raw.githubusercontent.com/bananana624-byte/lespaw-miniapp/main/lamination/%D0%9B%D0%B0%D0%BC%D0%B8%D0%BD%D0%B0%D1%86%D0%B8%D1%8F%20%D0%91%D0%BE%D0%BB%D1%8C%D1%88%D0%B8%D0%B5%20%D0%B7%D0%B2%D1%91%D0%B7%D0%B4%D1%8B.jpg",
    ],
  },
  {
    id: "holo_overlay",
    kind: "lamination",
    title: "Голографическая ламинация",
    subtitle: "Мягкий перелив",
    description:
      "Прозрачная ламинация с голографическим переливом. " +
      "В отличие от голографической плёнки, основа остаётся обычной, а эффект появляется только сверху — " +
      "поэтому цветопередача почти не меняется, а перелив выглядит деликатнее.",
    images: [
      "https://raw.githubusercontent.com/bananana624-byte/lespaw-miniapp/main/lamination/%D0%9B%D0%B0%D0%BC%D0%B8%D0%BD%D0%B0%D1%86%D0%B8%D1%8F%20%D0%93%D0%BE%D0%BB%D0%BE%D0%B3%D1%80%D0%B0%D1%84%D0%B8%D1%8F%20%D0%B1%D0%B5%D0%B7%20%D1%80%D0%B8%D1%81%D1%83%D0%BD%D0%BA%D0%B0.jpg",
    ],
  },
];

function truthy(v) {
  return String(v || "").trim().toUpperCase() === "TRUE";
}
function money(n) {
  return `${Number(n) || 0} ₽`;
}

function moneyDisplay(v) {
  const raw = String(v ?? "").trim();
  if (!raw) return money(0);
  if (/^от\s*\d+/i.test(raw)) {
    const m = raw.match(/(\d[\d\s]*)/);
    const num = m ? m[1].replace(/\s+/g, "") : "";
    return num ? `от ${num} ₽` : `от 0 ₽`;
  }
  const numStr = raw.replace(/\s+/g, "");
  const n = Number(numStr);
  if (Number.isFinite(n)) return money(n);
  if (raw.includes("₽")) return raw;
  if (/[0-9]/.test(raw)) return raw + " ₽";
  return raw;
}

// =====================
// Reviews helpers
// =====================
function parseReviewRating(v) {
  const n = Number(String(v || "").replace(/[^0-9]/g, ""));
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(5, Math.round(n)));
}

function parseReviewDateToTs(s) {
  const raw = String(s || "").trim();
  if (!raw) return 0;

  // YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const d = new Date(`${raw}T00:00:00`);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }

  // DD.MM.YYYY
  if (/^\d{2}\.\d{2}\.\d{4}$/.test(raw)) {
    const [dd, mm, yyyy] = raw.split(".");
    const d = new Date(`${yyyy}-${mm}-${dd}T00:00:00`);
    return Number.isNaN(d.getTime()) ? 0 : d.getTime();
  }

  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? 0 : d.getTime();
}

function formatReviewDate(s) {
  const raw = String(s || "").trim();
  if (!raw) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) {
    const [y, m, d] = raw.split("-");
    return `${d}.${m}.${y}`;
  }
  return raw;
}

function normalizeReviews(rows) {
  const arr = (rows || [])
    .map((r) => {
      const isActive = r.is_active === "" || r.is_active == null ? true : truthy(r.is_active);
      const author = safeText(r.author || r.name || r.user || "Покупательница");
      const text = safeText(r.text || r.review || r.message || "");
      const date = safeText(r.date || r.created_at || r.time || "");
      const rating = parseReviewRating(r.rating);
      const photo_url = safeText(r.photo_url || r.photo || r.image || "");
      const source_url = safeText(r.source_url || r.source || "");
      const ts = parseReviewDateToTs(date);
      return { isActive, author, text, date, ts, rating, photo_url, source_url };
    })
    .filter((x) => x.isActive)
    .filter((x) => x.text || x.photo_url);

  // свежие сверху; если даты нет — в конец
  arr.sort((a, b) => (b.ts || 0) - (a.ts || 0));
  return arr;
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
  const k = normalizeTypeKey(t);
  const map = { sticker: "Наклейки", pin: "Значки", poster: "Постеры", box: "Боксы" };
  return map[k] || (t || "");
}

function typeLabelDetailed(t) {
  const raw = String(t || "").trim();
  const s = raw.toLowerCase();

  // Explicit cases first
  if (s.includes("конверт")) return "Сюрприз-конверт";
  if (s.includes("бокс") || s.includes("короб")) return "Сюрприз-бокс";

  const k = normalizeTypeKey(t);
  if (k === "sticker") return "Наклейки";
  if (k === "pin") {
    // prefer "Набор значков" when it looks like a set
    if (s.includes("набор") || s.includes("значков")) return "Набор значков";
    return "Значки";
  }
  if (k === "poster") return "Постеры";
  if (k === "box") return "Боксы";

  return raw || "";
}


// Нормализуем тип товара из CSV (в таблице могут быть как ключи sticker/pin,
// так и русские подписи вроде "Наклейки", "Набор значков" и т.п.)
function normalizeTypeKey(t) {
  const s = String(t || "").trim().toLowerCase();
  if (!s) return "";

  // stickers
  if (
    s === "sticker" ||
    s === "stickers" ||
    s === "наклейка" ||
    s === "наклейки" ||
    s === "стикер" ||
    s === "стикеры" ||
    s.includes("наклей")
  )
    return "sticker";

  // pins
  if (
    s === "pin" ||
    s === "pins" ||
    s === "значок" ||
    s === "значки" ||
    s.includes("значк")
  )
    return "pin";

  // posters
  if (s === "poster" || s === "posters" || s.includes("постер")) return "poster";

  // boxes / envelopes
  if (s === "box" || s === "boxes" || s.includes("бокс") || s.includes("конверт")) return "box";

  return s;
}

function getFandomById(id) {
  return fandoms.find((f) => f.fandom_id === id);
}
function getProductById(id) {
  return products.find((p) => p.id === id);
}

function setCart(next) {
  cart = next;
  cartUpdatedAt = Date.now();
  const payload = { items: cart, updatedAt: cartUpdatedAt };

  saveJSON(LS_CART, payload);
  // синхронизация между устройствами (не блокируем UI)
  cloudSet(CS_CART, JSON.stringify(payload)).catch(() => {});
  updateBadges();
}
function setFav(next) {
  fav = next;
  favUpdatedAt = Date.now();
  const payload = { items: fav, updatedAt: favUpdatedAt };

  saveJSON(LS_FAV, payload);
  // синхронизация между устройствами (не блокируем UI)
  cloudSet(CS_FAV, JSON.stringify(payload)).catch(() => {});
  updateBadges();
}


function favKeyFromParts(parts){
  // parts: {id, film, lamination, pin_lamination, poster_pack, poster_paper}
  const id = String(parts?.id || "").trim();
  const film = String(parts?.film || "").trim();
  const lam = String(parts?.lamination || "").trim();
  const pinLam = String(parts?.pin_lamination || "").trim();
  const pack = String(parts?.poster_pack || parts?.poster_pack || "").trim();
  const paper = String(parts?.poster_paper || "").trim();
  return [id, film, lam, pinLam, pack, paper].join("|");
}

function favKey(id, opts){
  return favKeyFromParts({
    id,
    film: opts?.film,
    lamination: opts?.lamination,
    pin_lamination: opts?.pin_lamination,
    poster_pack: opts?.poster_pack,
    poster_paper: opts?.poster_paper
  });
}

function favIndexByKey(key){
  const k = String(key||"").trim();
  return (fav || []).findIndex((x) => favKeyFromParts(normalizeFavItem(x)) === k);
}

function isFav(id, opts){
  return favIndexByKey(favKey(id, opts)) >= 0;
}

function toggleFavVariant(id, opts){
  const key = favKey(id, opts);
  if (!String(id||"").trim()) return;
  const i = favIndexByKey(key);
  if (i >= 0) {
    const next = [...(fav||[])];
    next.splice(i, 1);
    setFav(next);
    gaEvent("remove_from_wishlist", { item_id: String(id).trim() });
    gaEvent("remove_from_favorite", { item_id: String(id).trim() });
    toast("Убрано из избранного", "warn");
    haptic("light");
  } else {
    const next = [...(fav||[])];
    next.push({
      id: String(id).trim(),
      film: String(opts?.film||""),
      lamination: String(opts?.lamination||""),
      pin_lamination: String(opts?.pin_lamination||""),
      poster_pack: String(opts?.poster_pack||""),
      poster_paper: String(opts?.poster_paper||""),
    });
    setFav(next);
    gaEvent("add_to_wishlist", { item_id: String(id).trim() });
    gaEvent("add_to_favorite", { item_id: String(id).trim() });
    toast("Добавлено в избранное", "ok");
    haptic("success");
  }
  updateBadges();
}

function normalizeFavItem(raw){
  // Поддержка разных форматов избранного (на всякий случай)
  // Ожидаемый формат: { id, film, lamination, pin_lamination }
  if (raw == null) return { id: "" };
  if (typeof raw === "string" || typeof raw === "number") {
    return { id: String(raw) };
  }
  const id = String(raw.id || raw.product_id || raw.pid || "").trim();
  return {
    id,
    film: String(raw.film || ""),
    lamination: String(raw.lamination || raw.lam || ""),
    pin_lamination: String(raw.pin_lamination || raw.pinLam || raw.pin_lam || ""),
    poster_pack: String(raw.poster_pack || raw.posterPack || raw.pack || ""),
    poster_paper: String(raw.poster_paper || raw.posterPaper || raw.paper || "")
  };
}


function isFavId(id){
  // Для мини-сердечек в сетке: считаем базовый вариант товара (без доп. опций)
  return isFav(String(id||"").trim(), null);
}

// В некоторых местах старого кода toggleFav вызывался без опций.
// Оставляем совместимость: это будет переключать базовый вариант.
function toggleFav(id, opts){
  return toggleFavVariant(id, opts);
}

function addToCartById(id, opts){
  const sid = String(id||"").trim();
  if (!sid) return;

  const p = getProductById(sid);
  const typeKey = normalizeTypeKey(p?.product_type);

  // options (with safe defaults)
  let film = String(opts?.film||"");
  let lamination = String(opts?.lamination||"");
  let pin_lamination = String(opts?.pin_lamination||"");
  let poster_pack = String(opts?.poster_pack||"");
  let poster_paper = String(opts?.poster_paper||"");

  if (typeKey === "sticker") {
    if (!film) film = "film_glossy";
    if (!lamination) lamination = "none";
  }
  if (typeKey === "pin") {
    if (!pin_lamination) pin_lamination = "pin_base";
  }
  if (typeKey === "poster") {
    if (!poster_pack) poster_pack = POSTER_PACKS?.[0]?.[0] || "p10x15_8";
    if (!poster_paper) poster_paper = POSTER_PAPERS?.[0]?.[0] || "glossy";
  }

  const match = (ci) =>
    String(ci.id) === sid &&
    String(ci.film||"") === film &&
    String(ci.lamination||"") === lamination &&
    String(ci.pin_lamination||"") === pin_lamination &&
    String(ci.poster_pack||"") === poster_pack &&
    String(ci.poster_paper||"") === poster_paper;

  const existing = (cart||[]).find(match);
  if (existing) {
    existing.qty = (Number(existing.qty)||0) + 1;
    setCart([...(cart||[])]);
    gaEvent("add_to_cart", { item_id: sid, quantity: 1 });
  } else {
    setCart([...(cart||[]), { id: sid, qty: 1, film, lamination, pin_lamination, poster_pack, poster_paper }]);
    gaEvent("add_to_cart", { item_id: sid, quantity: 1 });
  }

  // tactile feedback
  haptic("success");

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
  // Поддерживаем разные названия колонок в CSV (особенно для значков)
  return (
    p?.images ||
    p?.image ||
    p?.image_url ||
    p?.photo ||
    p?.img ||
    p?.pin_image ||
    p?.pin_photo ||
    p?.pin_photo_url ||
    p?.thumb ||
    p?.thumb_url ||
    p?.preview ||
    p?.preview_url ||
    p?.cover ||
    p?.cover_url ||
    ""
  );
}

function firstImageUrl(p) {
  const imgs = splitList(imagesField(p));
  return imgs[0] || "";
}

function cardThumbHTML(p) {
  const u = firstImageUrl(p);
  if (!u) return "";
  return `<img class="pcardImg" src="${safeUrl(u)}" alt="Фото товара" loading="lazy" decoding="async" onerror="this.style.display='none'">`;
}

function safeText(s) {
  return String(s ?? "").trim();
}

// Экранирование HTML (защита от XSS из таблиц/CSV)
function escapeHTML(s) {
  return String(s ?? "").replace(/[&<>"']/g, (ch) => {
    switch (ch) {
      case "&": return "&amp;";
      case "<": return "&lt;";
      case ">": return "&gt;";
      case '"': return "&quot;";
      case "'": return "&#39;";
      default: return ch;
    }
  });
}
// Частый кейс: текст из таблицы, который пойдёт в innerHTML
function h(s) {
  return escapeHTML(safeText(s));
}

// Безопасный URL для src/href (отбрасываем javascript:)

function haptic(kind) {
  try {
    const hf = tg?.HapticFeedback;
    if (!hf) return;

    if (kind === "select") {
      if (hf.selectionChanged) hf.selectionChanged();
      return;
    }

    if (kind === "success" || kind === "warning" || kind === "error") {
      hf.notificationOccurred(kind);
      return;
    }

    // On some Telegram clients impactOccurred("light") is unreliable — prefer selectionChanged when available.
    if ((kind || "light") === "light" && hf.selectionChanged) {
      hf.selectionChanged();
      return;
    }

    hf.impactOccurred(kind || "light");
  } catch {}
}

function formatPhoneLive(raw) {
  const digits = String(raw || "").replace(/\D+/g, "");
  if (!digits) return "";
  // Preferred RU-ish groups:
  // 11 digits -> 1-3-3-2-2  (8-952-512-62-98)
  // 10 digits -> 3-3-2-2   (952-512-62-98)
  const groups = (digits.length <= 10) ? [3,3,2,2] : [1,3,3,2,2];
  let out = "";
  let i = 0;
  for (let gi = 0; gi < groups.length && i < digits.length; gi++) {
    const take = Math.min(groups[gi], digits.length - i);
    const part = digits.slice(i, i + take);
    if (part) out += (out ? "-" : "") + part;
    i += take;
  }
  // If there are still digits left (non-standard length), append grouped by 3
  if (i < digits.length) {
    const rest = digits.slice(i);
    out += (out ? "-" : "") + rest.replace(/(\d{3})(?=\d)/g, "$1-");
  }
  return out;
}

// Preserve caret position while auto-formatting on input
function applyPhoneMask(inputEl) {
  try {
    const v = inputEl.value || "";
    const sel = inputEl.selectionStart || 0;

    // How many digits were before the caret?
    const before = v.slice(0, sel).replace(/\D/g, "").length;

    const formatted = formatPhoneLive(v);
    inputEl.value = formatted;

    // Place caret after the same count of digits in the formatted string
    if (typeof inputEl.setSelectionRange === "function") {
      if (before <= 0) {
        inputEl.setSelectionRange(0, 0);
        return;
      }
      let pos = 0, seen = 0;
      while (pos < formatted.length) {
        if (/\d/.test(formatted[pos])) seen++;
        pos++;
        if (seen >= before) break;
      }
      inputEl.setSelectionRange(pos, pos);
    }
  } catch {}
}

function safeUrl(u) {
  const raw = String(u ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, window.location.href);
    const p = url.protocol.toLowerCase();
    if (p === "http:" || p === "https:" || p === "tg:") return url.href;
    return "";
  } catch {
    return "";
  }
}


// Render multiline text as readable blocks (blank lines -> separate blocks)
function renderTextBlocks(raw) {
  const t = String(raw ?? "").replace(/\r/g, "").trim();
  if (!t) return "";

  let blocks = t.split(/\n\s*\n+/g).map((x) => x.trim()).filter(Boolean);

  const isTitleLine = (line) => {
    const s = String(line || "").trim();
    if (!s) return false;
    return /(О\s+товаре|В\s+наборе|Внутри|Важно|Характеристики|Варианты\s+наборов|Бумага\s+для\s+печати)/i.test(s);
  };

  // Merge continuation blocks (e.g. when "📦 Внутри" list got split by empty lines)
  const merged = [];
  for (const b of blocks) {
    const lines = b.split(/\n/);
    const first = String(lines[0] || "").trim();

    const isBulletOnly = !isTitleLine(first) && /^[•\-–]/.test(first);
    const prev = merged.length ? merged[merged.length - 1] : "";

    if (isBulletOnly && prev) {
      const prevFirst = String(prev.split(/\n/)[0] || "").trim();
      if (/Внутри/i.test(prevFirst) || /В\s+наборе/i.test(prevFirst)) {
        merged[merged.length - 1] = prev.replace(/\s*$/, "") + "\n" + b;
        continue;
      }
    }

    merged.push(b);
  }
  blocks = merged;

  return blocks
    .map((b) => {
      const lines = b.split(/\n/);
      const first = lines[0] || "";
      const rest = lines.slice(1).join("\n").trim();

      if (isTitleLine(first)) {
        const titleHtml = `<div class="dTitle"><strong>${escapeHTML(first)}</strong></div>`;
        const bodyHtml = rest ? `<div class="dText">${escapeHTML(rest).replace(/\n/g, "<br>")}</div>` : "";
        return `<div class="dBlock">${titleHtml}${bodyHtml}</div>`;
      }

      const html = escapeHTML(b).replace(/\n/g, "<br>");
      return `<div class="dBlock">${html}</div>`;
    })
    .join("");
}

function pickFirstField(obj, keys) {
  for (const k of keys) {
    const v = obj?.[k];
    const s = String(v ?? "").trim();
    if (s) return s;
  }
  return "";
}

function looksLikeGenericDesc(s) {
  const t = String(s ?? "").trim();
  if (!t) return true;
  // if very short and no structure — treat as generic
  if (t.length < 80 && !t.includes("\n")) return true;
  // if doesn't include our block markers — often generic
  const markers = ["✨", "📦", "📏", "🎲", "🖨️", "⚠️", "💜"];
  const hasMarker = markers.some((m) => t.includes(m));
  if (!hasMarker && t.length < 160) return true;
  return false;
}

// =====================
// Surprise items: enforce different "Внутри" blocks for Сюрприз-конверт vs Сюрприз-бокс
// (нужно на всех товарах, даже если описание приходит из CSV)
// =====================
function applySurpriseInsideOverride(rawDesc, p) {
  const desc = String(rawDesc ?? "").replace(/\r/g, "");
  const blob = (String(p?.name || "") + " " + String(p?.product_type || "")).toLowerCase();

  const isEnvelope = blob.includes("конверт");
  const isBox = blob.includes("бокс") || blob.includes("короб");

  if (!isEnvelope && !isBox) return desc;

  const replacementLines = isEnvelope
    ? [
        "📦 Внутри",
        "• 2 набора наклеек",
        "• 8 глянцевых фотопостера 10 × 15 см",
        "• 5 глянцевых фотопостера 21 × 30 см",
        "• 2 3D-стикера (2,5 × 2,5 см)",
      ]
    : [
        "📦 Внутри",
        "• 1 набор значков",
        "• 2 набора наклеек",
        "• 4 глянцевых фотопостера 10 × 15 см",
        "• 3 глянцевых фотопостера 21 × 30 см",
        "• 2 3D-стикера (2,5 × 2,5 см)",
        "• Круглый металлический брелок (44 мм)",
      ];

  // ===== Line-based replacement (robust against CSV "dangling" bullets) =====
  const lines = desc.split("\n");

  const isInsideHeaderLine = (ln) => {
    const s = String(ln || "").trim();
    return /^(?:📦\s*)?Внутри$/i.test(s);
  };
  const isBulletLine = (ln) => String(ln || "").trim().startsWith("•");

  // Find "Внутри" header line
  let insideIdx = -1;
  for (let i = 0; i < lines.length; i++) {
    if (isInsideHeaderLine(lines[i])) {
      insideIdx = i;
      break;
    }
  }

  // If no "Внутри" in text — insert after "О товаре" header if present, else prepend.
  if (insideIdx === -1) {
    let aboutIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      const s = String(lines[i] || "").trim();
      if (/^(?:✨\s*)?О\s+товаре$/i.test(s)) {
        aboutIdx = i;
        break;
      }
    }
    if (aboutIdx >= 0) {
      // insert after the "О товаре" block (until next empty line or end)
      let j = aboutIdx + 1;
      while (j < lines.length && String(lines[j] || "").trim() !== "") j++;
      const before = lines.slice(0, j);
      const after = lines.slice(j);
      const outLines = [...before, "", ...replacementLines, "", ...after];
      return outLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    }
    const outLines = [...replacementLines, "", ...lines];
    return outLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
  }

  // We have "Внутри" header. Keep everything before it, then insert replacement block,
  // then SKIP any following bullet lines (even if they belong to the old CSV and were duplicated),
  // until we hit a non-bullet line that is not just empty spacing.
  const before = lines.slice(0, insideIdx);

  // move pointer after header line
  let k = insideIdx + 1;

  // skip old inside content: bullets and empty lines
  while (k < lines.length) {
    const s = String(lines[k] || "").trim();
    if (s === "" || isBulletLine(lines[k])) {
      k++;
      continue;
    }
    break; // reached next section
  }

  const after = lines.slice(k);

  // Ensure blank line separation so renderTextBlocks makes a clean block
  const outLines = [
    ...before,
    ...(before.length && String(before[before.length - 1] || "").trim() !== "" ? [""] : []),
    ...replacementLines,
    "",
    ...after,
  ];

  return outLines.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}


function defaultShortByType(p) {
  const typeKey = normalizeTypeKey(p?.product_type);
  const nm = String(p?.name || "").toLowerCase();

  if (typeKey === "pin") return "6 значков в наборе • металл • 44 мм";
  if (typeKey === "sticker") return "Лист наклеек • глянец • 16×25 см";
  if (typeKey === "poster") return "Рандомные фотопостеры • выбор формата";
  if (typeKey === "box") {
    if (nm.includes("конверт")) return "Сюрприз-конверт • компактный набор";
    return "Большой сюрприз-бокс • много наполнения";
  }
  return "";
}

function defaultFullByType(p) {
  const typeKey = normalizeTypeKey(p?.product_type);
  const nm = String(p?.name || "").toLowerCase();

  if (typeKey === "pin") {
    return [
      "✨ О товаре\nНабор из шести аккуратных значков с яркой печатью.\nХорошо подойдут для рюкзаков, сумок, курток или коллекций — лёгкие, удобные и приятные в использовании.",
      "📦 В наборе\n• 6 значков",
      "📏 Характеристики\n• Размер одного значка: 44 мм\n• Материал: металл\n• Крепление: булавка сзади",
    ].join("\n\n");
  }

  if (typeKey === "sticker") {
    return [
      "✨ О товаре\nЯркие наклейки на глянцевой плёнке с чёткой печатью.\nПодойдут для декора ноутбуков, планшетов, ежедневников и других гладких поверхностей.",
      "📏 Характеристики\n• Размер листа: 16 × 25 см\n• Материал: глянцевая плёнка",
      "⚠️ Важно\nНаклейки не вырезаны по контуру — лист идёт цельным.",
    ].join("\n\n");
  }

  if (typeKey === "poster") {
    return [
      "✨ О товаре\nНабор рандомных фотопостеров с аккуратной печатью и приятной цветопередачей.\nКаждый заказ собирается случайным образом, поэтому каждый набор получается уникальным ✨",
      "🎲 Важно\nФотопостеры в заказе подбираются случайным образом.\n\nМы не кладем повторы внутри одного заказа, но при повторных заказах в будущем возможны повторения изображений, так как подбор осуществляется заново.",
      "📦 Варианты наборов\n• 8 фотопостеров 10 × 15 см — 450 ₽\n• 5 фотопостеров 21 × 30 см — 750 ₽\n• 8 фотопостеров 10 × 15 см + 5 фотопостеров 21 × 30 см — 1100 ₽",
      "🖨️ Бумага для печати\n• Глянцевая — яркие цвета и выразительный блеск\n• Матовая — мягкая цветопередача без бликов",
      "📏 Характеристики\n• Тип: фотопостеры\n• Печать: качественная струйная\n• Подбор изображений: рандомный",
    ].join("\n\n");
  }

  if (typeKey === "box") {
    const isEnvelope = nm.includes("конверт");
    if (isEnvelope) {
      return [
        "✨ О товаре\nНебольшой конверт с аккуратно подобранным наполнением.\nПодойдёт для тех, кто любит сюрпризы, атмосферу уюта и приятные мелочи 💌",
        "📦 Внутри\n• 2 набора наклеек\n• 8 глянцевых фотопостера 10 × 15 см\n• 5 глянцевых фотопостера 21 × 30 см\n• 2 3D-стикера (2,5 × 2,5 см)",
        "💜 Важно\nЕсли вы ранее не покупали наборы наклеек или значков — будут вложены готовые наборы из ассортимента.\n\nЕсли вы уже покупали товары из текущего ассортимента — для вас будут собраны новые уникальные наборы (обязательно укажите в комментарии к заказу, что вы уже ранее заказывали).\nПосле выполнения заказа такие наборы будут добавлены в ассортимент магазина.",
      ].join("\n\n");
    }
    return [
      "✨ О товаре\nКоробочка с тщательно подобранным наполнением и вниманием к деталям.\nКаждый бокс собирается индивидуально и дарит ощущение небольшого, приятного сюрприза 💖",
      "📦 Внутри\n• 1 набор значков\n• 2 набора наклеек\n\n• 4 глянцевых фотопостера 10 × 15 см\n• 3 глянцевых фотопостера 21 × 30 см\n\n• 2 3D-стикера (2,5 × 2,5 см)\n• Круглый металлический брелок (44 мм)",
      "💜 Важно\nЕсли вы ранее не покупали наборы наклеек или значков — в бокс будут вложены готовые наборы из ассортимента.\n\nЕсли вы уже покупали товары из текущего ассортимента — для вас будут собраны новые уникальные наборы (обязательно укажите в комментарии к заказу, что вы уже ранее заказывали).\nПосле выполнения заказа такие наборы будут добавлены в ассортимент магазина.",
    ].join("\n\n");
  }

  return "";
}

function getShortDesc(p) {
  // support multiple column names
  const s = pickFirstField(p, ["description_short", "short_description", "description_shor", "desc_short", "meta"]);
  return s;
}

function stripPosterStaticChoiceBlocks(raw) {
  const t = String(raw ?? "").replace(/\r/g, "").trim();
  if (!t) return "";
  const blocks = t.split(/\n\s*\n+/g).map((x) => x.trim()).filter(Boolean);
  const filtered = blocks.filter((b) => {
    const firstLine = String((b.split(/\n/)[0] || "")).trim().toLowerCase();
    if (firstLine.includes("варианты наборов")) return false;
    if (firstLine.includes("бумага для печати")) return false;
    return true;
  });
  return filtered.join("\n\n");
}

function getFullDesc(p) {
  const fromCsv = pickFirstField(p, ["description_full", "description", "full_description", "descriptionFull", "desc"]);
  if (!fromCsv) return applySurpriseInsideOverride((defaultFullByType(p) || ""), p);

  // If the csv text is too generic, upgrade to our default template
  if (looksLikeGenericDesc(fromCsv)) return applySurpriseInsideOverride((defaultFullByType(p) || fromCsv), p);

  // Even if description comes from CSV — we still enforce different "Внутри" for конверт/бокс
  return applySurpriseInsideOverride(fromCsv, p);
}

function cardMetaText(p) {
  return getShortDesc(p) || defaultShortByType(p) || "";
}


function openTelegramText(toUsername, text) {
  const link = `https://t.me/${toUsername}?text=${encodeURIComponent(text)}`;
  try {
    // В Telegram WebApp чаще надёжнее сначала openTelegramLink (как "внутренний" переход),
    // а уже потом openLink.
    if (tg?.openTelegramLink) tg.openTelegramLink(link);
    else if (tg?.openLink) tg.openLink(link);
    else {
      const a = document.createElement("a");
      a.href = link;
      a.target = "_blank";
      a.rel = "noopener noreferrer";
      document.body.appendChild(a);
      a.click();
      a.remove();
    }
  } catch {
    try {
      // фоллбек — пробуем хотя бы открыть чат без префилла
      const bare = `https://t.me/${toUsername}`;
      if (tg?.openTelegramLink) tg.openTelegramLink(bare);
      else if (tg?.openLink) tg.openLink(bare);
      else window.open(bare, "_blank", "noopener,noreferrer");
    } catch {
      try { window.open(link, "_blank", "noopener,noreferrer"); } catch {}
    }
  }
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
// Tap helper (фикс кликов в разных WebView)
// =====================
function bindTap(el, handler) {
  if (!el) return;

  // Telegram/WebView and mobile browsers can generate a "ghost click":
  // touchend/pointerup fires, the UI rerenders, then a delayed click lands
  // on a NEW element under the finger (e.g. opens the first fandom).
  // We guard globally, not per-element.
  window.__LP_LAST_TAP_TS = window.__LP_LAST_TAP_TS || 0;
  window.__LP_LAST_TAP_SRC = window.__LP_LAST_TAP_SRC || "";

  let touchMoved = false;

  const fire = (e, src) => {
    const now = Date.now();

    // Suppress delayed ghost clicks after a touch/pointer action.
    if (src === "click" && now - window.__LP_LAST_TAP_TS < 700) {
      try { e?.preventDefault?.(); } catch {}
      try { e?.stopPropagation?.(); } catch {}
      return;
    }

    // Deduplicate very close events (same element).
    // (We use the same global stamp to also dedupe pointerup+touchend on hybrid devices.)
    if (now - window.__LP_LAST_TAP_TS < 140 && window.__LP_LAST_TAP_SRC !== "click") {
      try { e?.preventDefault?.(); } catch {}
      try { e?.stopPropagation?.(); } catch {}
      return;
    }

    // Record real taps (not delayed clicks).
    if (src !== "click") {
      window.__LP_LAST_TAP_TS = now;
      window.__LP_LAST_TAP_SRC = src;
    }

    try { e?.preventDefault?.(); } catch {}
    try { e?.stopPropagation?.(); } catch {}
    try { handler(e); } catch (err) {
      console.error(err);
      toast("Ошибка действия", "warn");
    }
  };

  // touch path
  el.addEventListener("touchstart", () => { touchMoved = false; }, { passive: true });
  el.addEventListener("touchmove", () => { touchMoved = true; }, { passive: true });
  el.addEventListener("touchend", (e) => {
    if (touchMoved) return;
    fire(e, "touch");
  }, { passive: false });

  // pointer path (desktop + modern mobile)
  el.addEventListener("pointerup", (e) => fire(e, "pointer"), { passive: false });

  // click fallback (desktop / some WebViews)
  el.addEventListener("click", (e) => fire(e, "click"), { passive: false });
}

//
// =====================
// Init
// =====================
async function init() {

  // FIX: blur search as early as possible on nav taps (prevents backspace-like behavior)
  try {
    const earlyBlur = () => {
      try {
        if (document.activeElement === globalSearch) globalSearch.blur();
      } catch {}
    };
    navBack?.addEventListener("pointerdown", earlyBlur, { passive: true });
    navBack?.addEventListener("touchstart", earlyBlur, { passive: true });
  } catch {}
  try {
    bindTap(navBack, () => {
      // FIX: если фокус в глобальном поиске, Telegram WebView может трактовать "Назад"
      // как backspace и удалять текст по букве. Нам нужно: 1) снять фокус, 2) очистить поле,
      // 3) выполнить навигацию назад.
      try {
        if (globalSearch) {
          const had = String(globalSearch.value || "").length > 0;
          globalSearch.blur();
          if (had) {
            globalSearch.value = "";
            // Триггерим обработчики ввода, чтобы UI сразу вернулся к нормальному состоянию.
            try { globalSearch.dispatchEvent(new Event("input", { bubbles: true })); } catch {}
          }
        }
      } catch {}
      goBack();
    });
    bindTap(navHome, () => resetToHome());
    bindTap(navFav, () => openPage(renderFavorites));
    bindTap(navCart, () => openPage(renderCart));

    // Поиск: лёгкий debounce, чтобы не перерисовывать экран на каждый символ (особенно на больших CSV)
    let __searchTimer = null;
    globalSearch.addEventListener("input", (e) => {
      const q = e.target.value || "";
      try {
        if (searchWrap) {
          if (q.trim()) searchWrap.classList.add("hasText");
          else searchWrap.classList.remove("hasText");
        }
      } catch {}
      try { if (__searchTimer) clearTimeout(__searchTimer); } catch {}

      // Если поле пустое — возвращаемся домой сразу (без задержки)
      if (!q.trim()) {
        resetToHome();
        return;
      }

      __searchTimer = setTimeout(() => {
        openPage(() => renderSearch(q));
      }, 200);
    });

    // Clear search
    if (searchClear) {
      bindTap(searchClear, () => {
        try { globalSearch.value = ""; } catch {}
        try { if (searchWrap) searchWrap.classList.remove("hasText"); } catch {}
        resetToHome();
        try { globalSearch.focus(); } catch {}
      });
    }

    // Быстрый старт: пробуем взять данные из кеша (если есть)
    // и сразу показываем главную, чтобы меню не "висело" пустым.
    try {
      const cachedF = loadCsvCache(LS_CSV_CACHE_FANDOMS);
      const cachedP = loadCsvCache(LS_CSV_CACHE_PRODUCTS);
      const cachedS = loadCsvCache(LS_CSV_CACHE_SETTINGS);
      const cachedR = loadCsvCache(LS_CSV_CACHE_REVIEWS);
      if (cachedF?.data?.length) fandoms = cachedF.data;
      if (cachedP?.data?.length) products = cachedP.data;
      if (cachedS?.data?.length) {
        // settings кешируем как массив строк (как из CSV)
        cachedS.data.forEach((row) => {
          const k = row.key;
          const v = row.value;
          if (!k) return;
          if (k === "overlay_price_delta" || k === "holo_base_price_delta") settings[k] = Number(v);
          else settings[k] = v;
        });
      }
      if (cachedR?.data?.length) reviews = normalizeReviews(cachedR.data);
    } catch {}

    await loadSyncedState();
    updateBadges();
    resetToHome(); // уже можно открыть меню

    gaAppOpen();

    // Параллельно грузим свежие CSV (быстрее, чем по очереди)
    const [fFresh, pFresh, sFresh, rFresh] = await Promise.all([
      fetchCSVWithCache(CSV_FANDOMS_URL, LS_CSV_CACHE_FANDOMS),
      fetchCSVWithCache(CSV_PRODUCTS_URL, LS_CSV_CACHE_PRODUCTS),
      fetchCSVWithCache(CSV_SETTINGS_URL, LS_CSV_CACHE_SETTINGS),
      CSV_REVIEWS_URL ? fetchCSVWithCache(CSV_REVIEWS_URL, LS_CSV_CACHE_REVIEWS) : Promise.resolve([]),
    ]);

    fandoms = fFresh || [];
    products = pFresh || [];

    // Пересобираем settings из свежих
    settings = {
      overlay_price_delta: settings.overlay_price_delta ?? 100,
      holo_base_price_delta: settings.holo_base_price_delta ?? 100,
      examples_url: settings.examples_url ?? "https://t.me/LesPaw",
    };
    (sFresh || []).forEach((row) => {
      const k = row.key;
      const v = row.value;
      if (!k) return;
      if (k === "overlay_price_delta" || k === "holo_base_price_delta") settings[k] = Number(v);
      else settings[k] = v;
    });

    reviews = normalizeReviews(rFresh || []);

    // Если пользователька уже в каталоге/поиске — перерисуем текущий экран с обновлёнными данными
    try {
      if (typeof currentRender === "function" && currentRender !== renderHome) currentRender();
    } catch {}
    syncBottomSpace();
} catch (e) {
    view.innerHTML = `
      <div class="card">
        <div class="h2">Ошибка загрузки данных</div>
        <div class="small">${escapeHTML(String(e))}</div>
        <hr>
        <div class="small">Проверь интернет и публикацию таблиц/CSV-ссылки.</div>
        <div style="height:10px"></div>
        <button class="btn" id="retryLoad">Повторить</button>
      </div>
    `;
    try { bindTap(document.getElementById("retryLoad"), () => { _csvBgToastShown = false; init(); }); } catch {}
    syncBottomSpace();
  }
}

// безопасный запуск (даже если script без defer)
(function boot(){
  function start(){
    try { init(); } catch (e) {
      try {
        const v = document.getElementById("view");
        if (v) v.innerHTML = `<div class="card"><div class="h2">Ошибка запуска</div><div class="small">${escapeHTML(String(e))}</div></div>`;
      } catch {}
    }
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})();



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


<div class="homeSection newSection">
  <div class="newHeader">
    <div class="newTitleRow">
      <div class="newTitle">Новинки</div>
      <div class="newChip">NEW</div>
    </div>
    <div class="newSub">Последние добавленные товары</div>
  </div>
  <div class="newDivider"></div>

  <div class="newWrap">
    <div class="newCarousel" id="newCarousel" aria-label="Новинки">
      ${
        (() => {
          const latest = (products || []).slice(-28).reverse();
          const pages = [];
          for (let i = 0; i < latest.length; i += 4) pages.push(latest.slice(i, i + 4));
          return pages
            .map((page) => `
              <div class="newPage">
                ${page
                  .map(
                    (p) => `
                  <div class="pcard pcardMini newCard" data-id="${p.id}">
                    ${cardThumbHTML(p)}
                    <div class="pcardTitle">${h(p.name)}</div>
                    ${cardMetaText(p) ? `<div class="pcardMeta">${escapeHTML(cardMetaText(p))}</div>` : ``}
                    <div class="pcardPrice">${moneyDisplay(p.price)}</div>
                  </div>
                `
                  )
                  .join("")}
              </div>
            `)
            .join("");
        })()
      }
    </div>

    <div class="newControls" aria-label="Навигация новинок">
      <button class="newNavBtn" id="newPrev" type="button" aria-label="Предыдущие">‹</button>
      <div class="newDots" id="newDots" aria-hidden="true"></div>
      <button class="newNavBtn" id="newNext" type="button" aria-label="Следующие">›</button>
    </div>
  </div>
</div>
  `;

  bindTap(document.getElementById("tCat"), () => openPage(renderFandomTypes));
  bindTap(document.getElementById("tEx"), () => openExamples());
  bindTap(document.getElementById("tRev"), () => openPage(renderReviews));
  
bindTap(document.getElementById("tInfo"), () => openPage(renderInfo));

  // Новинки: тап по карточке открывает товар
  view.querySelectorAll("#newCarousel [data-id]").forEach((el) => {
    bindTap(el, () => openPage(() => renderProduct(el.dataset.id)));
  });

  // Новинки: кнопки + точки (чтобы было понятно на телефоне)
  const nc = document.getElementById("newCarousel");
  const prevBtn = document.getElementById("newPrev");
  const nextBtn = document.getElementById("newNext");
  const dots = document.getElementById("newDots");

  const pageCount = (() => {
    if (!nc) return 0;
    const n = nc.querySelectorAll(".newPage").length;
    return n || 0;
  })();

  const renderDots = () => {
    if (!dots) return;
    if (pageCount <= 1) {
      dots.innerHTML = "";
      return;
    }
    dots.innerHTML = new Array(pageCount)
      .fill(0)
      .map((_, i) => `<span class="newDot" data-i="${i}"></span>`)
      .join("");
  };

  const getActivePage = () => {
    if (!nc || !pageCount) return 0;
    const w = nc.getBoundingClientRect().width || nc.clientWidth || 1;
    const x = nc.scrollLeft || 0;
    return Math.max(0, Math.min(pageCount - 1, Math.round(x / w)));
  };

  const setActiveDot = () => {
    if (!dots || !pageCount) return;
    const a = getActivePage();
    dots.querySelectorAll(".newDot").forEach((d, i) => d.classList.toggle("isActive", i === a));
    if (prevBtn) prevBtn.disabled = a <= 0;
    if (nextBtn) nextBtn.disabled = a >= pageCount - 1;
  };

  const scrollToPage = (i) => {
    if (!nc) return;
    const w = nc.getBoundingClientRect().width || nc.clientWidth || 0;
    if (!w) return;
    nc.scrollTo({ left: i * w, behavior: "smooth" });
  };

  const scrollByPage = (dir) => scrollToPage(getActivePage() + dir);

  renderDots();
  setActiveDot();

  if (prevBtn) bindTap(prevBtn, () => scrollByPage(-1));
  if (nextBtn) bindTap(nextBtn, () => scrollByPage(1));

  if (dots) {
    dots.querySelectorAll("[data-i]").forEach((el) => {
      bindTap(el, () => scrollToPage(parseInt(el.dataset.i || "0", 10)));
    });
  }

  if (nc) {
    nc.addEventListener("scroll", () => {
      // троттлинг не нужен — лёгкая логика
      setActiveDot();
    }, { passive: true });
  }


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
      <div class="small">Выбери категорию</div>
      <hr>

      <div class="catGrid">
        ${FANDOM_TYPES.map((t) => {
          const em = CATEGORY_EMOJI[t] || "";
          return `
            <div class="catBtn" data-type="${t}">
              <div class="catTitle">${t}</div>
              ${em ? `<div class="catEmoji" aria-hidden="true">${em}</div>` : ``}
            </div>
          `;
        }).join("")}
      </div>
    </div>
  `;

  view.querySelectorAll("[data-type]").forEach((el) => {
    bindTap(el, () => openPage(() => renderFandomList(el.dataset.type)));
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

  const renderGrid = (arr) => `
    <div class="fandomGrid">
      ${arr
        .map(
          (f) => `
        <div class="fandomBtn" data-id="${f.fandom_id}">
          <div class="fandomTitle">${f.fandom_name}</div>
        </div>
      `
        )
        .join("")}
    </div>
  `;

  view.innerHTML = `
    <div class="card">
      <div class="h2">${type}</div>
      <div class="small">Выбери фандом</div>
      <hr>

      ${renderGrid(letters)}

      ${digits.length ? `<hr><div class="small" style="margin-top:6px">0–9</div>${renderGrid(digits)}` : ``}
    </div>
  `;

  view.querySelectorAll("[data-id]").forEach((el) => {
    bindTap(el, () => openPage(() => renderFandomPage(el.dataset.id)));
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

  const groupsOrder = [
    { key: "sticker", title: "Наклейки" },
    { key: "pin", title: "Значки" },
    { key: "poster", title: "Постеры" },
    { key: "box", title: "Боксы / конверты" },
  ];
  const knownKeys = new Set(groupsOrder.map((g) => g.key));

  const grouped = groupsOrder
    .map((g) => ({ ...g, items: all.filter((p) => normalizeTypeKey(p.product_type) === g.key) }))
    .filter((g) => g.items.length > 0);

  const other = all.filter((p) => !knownKeys.has(normalizeTypeKey(p.product_type)));
  if (other.length) grouped.push({ key: "other", title: "Другое", items: other });

  const sectionHtml = (title, items) => {
    const cards = items
      .map(
        (p) => `
          <div class="pcard" data-id="${p.id}">
            ${cardThumbHTML(p)}
            <div class="pcardTitle">${h(p.name)}</div>
            ${cardMetaText(p) ? `<div class="pcardMeta">${escapeHTML(cardMetaText(p))}</div>` : ``}
            <div class="pcardPrice">${moneyDisplay(p.price)}</div>
            <div class="pcardActions">
              <button class="iconBtn iconBtnHeart ${isFavId(p.id) ? "is-active" : ""}" data-fav="${p.id}" type="button" aria-label="В избранное">
                <span class="heartGlyph">${isFavId(p.id) ? "♥" : "♡"}</span>
              </button>
              <button class="iconBtn" data-add="${p.id}" type="button" aria-label="Добавить в корзину">
                <span class="plusGlyph">＋</span>
              </button>
            </div>
          </div>
        `
      )
      .join("");

    return `
      <div class="fGroup">
        <div class="h3">${title}</div>
        <div class="grid2" style="margin-top:10px">${cards}</div>
      </div>
    `;
  };

  view.innerHTML = `
    <div class="card">
      <div class="h2">${f?.fandom_name || "Фандом"}</div>
      <hr>
      ${
        grouped.length
          ? grouped
              .map((g, i) => sectionHtml(g.title, g.items) + (i < grouped.length - 1 ? "<hr>" : ""))
              .join("")
          : `<div class="small">Пока нет товаров.</div>`
      }
    </div>
  `;

  // открыть карточку по тапу на карточку
  view.querySelectorAll(".pcard[data-id]").forEach((el) => {
    bindTap(el, (e) => {
      const t = e?.target;
      if (t && (t.closest("button") || t.tagName === "BUTTON")) return;
      openPage(() => renderProduct(el.dataset.id));
    });
  });

  // мини-действия
  view.querySelectorAll("[data-fav]").forEach((b) => {
    bindTap(b, (e) => {
      try { e?.stopPropagation?.(); } catch {}
      const id = String(b.dataset.fav || "");
      toggleFav(id);
      // обновим сердечки не перерисовывая весь экран
      view.querySelectorAll(`[data-fav="${id}"]`).forEach((x) => {
        x.classList.toggle("is-active", isFavId(id));
        const g = x.querySelector(".heartGlyph");
        if (g) g.textContent = isFavId(id) ? "♥" : "♡";
      });
    });
  });

  view.querySelectorAll("[data-add]").forEach((b) => {
    bindTap(b, (e) => {
      try { e?.stopPropagation?.(); } catch {}
      const id = String(b.dataset.add || "");
      addToCartById(id);
      toast("Добавлено в корзину", "good");
    });
  });

  syncNav();
  syncBottomSpace();
}

// =====================
// Инфо / отзывы / примеры
// =====================
function renderInfo() {
  // фиксируем факт ознакомления: пользователька открыла вкладку
  infoViewed = true;
  infoViewedThisSession = true;
  try { localStorage.setItem(LS_INFO_VIEWED, "1"); } catch {}
  view.innerHTML = `
    <div class="card">
      <div class="h2">Важная информация</div>
      <div class="small infoLead">Пожалуйста, ознакомься перед оформлением заказа.</div>

      <div class="infoStack">
        <div class="infoSection">
          <div class="infoTitle">Наклейки</div>
          <ul class="infoList">
            <li>Наклейки <b>не вырезаны по контуру</b>.</li>
            <li>Требуется самостоятельная вырезка.</li>
          </ul>
        </div>

        <div class="infoSection">
          <div class="infoTitle">Оплата и оформление заказа</div>
          <ul class="infoList">
            <li>После оформления заказа ты отправляешь заявку менеджерке.</li>
            <li>Менеджерка проверяет состав заказа, выбранные варианты покрытия и доставку.</li>
            <li>После проверки ты получаешь сообщение с <b>итоговой суммой оплаты заказа, включая доставку</b>.</li>
            <li><b>Оплата производится только после этого сообщения.</b></li>
          </ul>
          <div class="infoNote">Такой порядок помогает избежать ошибок и сделать всё максимально прозрачно.</div>
        </div>

        <div class="infoSection">
          <div class="infoTitle">Сроки изготовления и доставки</div>
          <ul class="infoList">
            <li>Сборка заказа: <b>4–5 дней</b>.</li>
            <li>Доставка: <b>5–15 дней</b>.</li>
          </ul>
          <div class="infoNote">Сроки могут немного меняться в периоды повышенной нагрузки.</div>
        </div>

        <div class="infoSection">
          <div class="infoTitle">Доставка</div>
          <ul class="infoList">
            <li>Яндекс Доставка.</li>
            <li>Пункты выдачи: <b>Яндекс ПВЗ / 5post</b>.</li>
            <li>Срок хранения в пункте выдачи — <b>6 дней</b>.</li>
          </ul>
        </div>

        <div class="infoSection">
          <div class="infoTitle">Возврат и обмен</div>
          <ul class="infoList">
            <li>Все изделия изготавливаются <b>под заказ</b>, поэтому стандартный возврат не предусмотрен.</li>
            <li>Мы внимательно следим за качеством каждого заказа.</li>
            <li>Если вдруг что-то окажется не так — мы обязательно обсудим детали с тобой и постараемся найти подходящее решение в твоей ситуации.</li>
          </ul>
        </div>

        <div class="infoSection">
          <div class="infoTitle">Печать и внешний вид изделий</div>
          <ul class="infoList">
            <li>Печать выполняется <b>струйным способом</b>.</li>
            <li>Цвета на экране и вживую могут немного отличаться — это нормально.</li>
            <li>При длительном прямом воздействии света (солнечного или искусственного) струйная печать со временем может <b>терять насыщенность</b>.</li>
          </ul>
          <div class="infoNote">Это естественный и неизбежный процесс, характерный для любой струйной печати, и он не считается браком. Чтобы сохранить цвета дольше, не рекомендуется постоянно держать изделия под прямым светом.</div>
        </div>

        <div class="infoSection">
          <div class="infoTitle">Индивидуальные заказы и вопросы</div>
          <div class="infoNote">
            Хочешь товары с фандомом, которого нет у нас в ассортименте? Мы можем сделать их <b>под заказ</b>.
            А ещё по любым вопросам (варианты плёнки/ламинации, сроки, доставка) можно написать менеджерке:
          </div>
          <button class="infoLinkBtn" id="btnManager" type="button">@${MANAGER_USERNAME}</button>
        </div>
      </div>

      <hr>
      <div class="row">
        <button class="btn" id="btnMain">Наш основной канал</button>
        <button class="btn" id="btnSuggest">Предложить фандом</button>
      </div>
    </div>
  `;

  bindTap(document.getElementById("btnMain"), () => tg?.openTelegramLink(MAIN_CHANNEL_URL));
  bindTap(document.getElementById("btnSuggest"), () => tg?.openTelegramLink(SUGGEST_URL));
  bindTap(document.getElementById("btnManager"), () => tg?.openTelegramLink(`https://t.me/${MANAGER_USERNAME}`));

  syncNav();
  syncBottomSpace();
}

function renderReviews() {
  // Фильтры на уровне экрана (не сохраняем в storage — просто UX)
  let mode = "all"; // all | photos | 5

  const render = () => {
    const all = Array.isArray(reviews) ? reviews : [];
    const filtered = all
      .filter((r) => {
        if (mode === "photos") return !!r.photo_url;
        if (mode === "5") return (Number(r.rating) || 0) >= 5;
        return true;
      })
      .slice(0, reviewsVisibleCount);

    const totalCount = all.length;
    const avg = totalCount
      ? Math.round((all.reduce((s, r) => s + (Number(r.rating) || 0), 0) / totalCount) * 10) / 10
      : 0;

    const chips = `
      <div class="chips">
        <button class="chip ${mode === "all" ? "is-active" : ""}" data-mode="all">Все</button>
        <button class="chip ${mode === "photos" ? "is-active" : ""}" data-mode="photos">С фото</button>
        <button class="chip ${mode === "5" ? "is-active" : ""}" data-mode="5">5★</button>
      </div>
    `;

    const listHtml = filtered.length
      ? `<div class="reviewList">
          ${filtered
            .map((r, idx) => {
              const dateText = formatReviewDate(r.date);
              const stars = r.rating
                ? `<div class="stars" aria-label="Оценка ${r.rating} из 5">
                    ${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}
                  </div>`
                : ``;

              const photoHtml = r.photo_url
                ? `<div class="reviewPhotoWrap">
                     <img class="reviewPhoto" src="${safeUrl(r.photo_url)}" alt="Фото отзыва" loading="lazy" decoding="async" onerror="this.style.display='none'">
                   </div>`
                : ``;

              const sourceBtn = r.source_url
                ? `<button class="btn btnMini" data-source="${encodeURIComponent(r.source_url)}">К оригиналу</button>`
                : ``;

              const author = safeText(r.author) || "Покупательница";
              const initial = (author.slice(0, 1).toUpperCase() || "★");

              return `
                <div class="reviewCard">
                  <div class="reviewTop">
                    <div class="reviewAvatar" aria-hidden="true">${escapeHTML(initial)}</div>
                    <div class="reviewHead">
                      <div class="reviewAuthor">${escapeHTML(author)}</div>
                      <div class="reviewMeta">
                        ${dateText ? `<span class="reviewDate">${dateText}</span>` : ``}
                        ${stars}
                      </div>
                    </div>
                  </div>
                  ${photoHtml}

                  ${
                    r.text
                      ? (() => {
                          const txt = safeText(r.text);
                          const showMore = txt.length > 180; // эвристика: если отзыв длинный — показываем подсказку
                          return `
                            <div class="reviewTextWrap">
                              <div class="reviewText" data-expand="${idx}">${txt}</div>
                              ${showMore ? `<button class="reviewMore" type="button" data-more="${idx}">Показать полностью</button>` : ``}
                            </div>
                          `;
                        })()
                      : ``
                  }

                  ${sourceBtn ? `<div class="reviewActions">${sourceBtn}</div>` : ``}
                </div>
              `;
            })
            .join("")}
        </div>`
      : `<div class="small" style="margin-top:6px">Пока нет отзывов для отображения в этом режиме.</div>`;

    const moreBtn =
      (mode === "all" ? reviewsVisibleCount < all.length : reviewsVisibleCount < all.filter((r) => (mode === "photos" ? !!r.photo_url : (Number(r.rating) || 0) >= 5)).length)
        ? `<button class="btn" id="revMore">Показать ещё</button>`
        : ``;

    const hasCsv = !!String(CSV_REVIEWS_URL || "").trim();

    view.innerHTML = `
      <div class="card">
        <div class="h2">Отзывы</div>
        <div class="revHero">
          <div class="revStat">
            <div class="revStatBig">${avg || 0}</div>
            <div class="revStatSmall">средняя оценка</div>
          </div>
          <div class="revStat">
            <div class="revStatBig">${totalCount}</div>
            <div class="revStatSmall">отзывов</div>
          </div>
        </div>

        ${chips}
        ${
          hasCsv
            ? ``
            : `<div class="small" style="margin-top:10px">Подключи CSV-лист reviews — и отзывы будут отображаться прямо здесь.</div>`
        }

        ${listHtml}

        ${moreBtn ? `<div class="row" style="margin-top:12px">${moreBtn}</div>` : ``}

        <hr>
        <div class="row">
          <button class="btn" id="openReviews">Открыть все отзывы в Telegram</button>
          <button class="btn" id="leaveReview">Оставить отзыв</button>
        </div>
      </div>
    `;

    // chips
    view.querySelectorAll("[data-mode]").forEach((b) => {
      bindTap(b, () => {
        mode = b.dataset.mode || "all";
        reviewsVisibleCount = 8;
        render();
      });
    });

    // open all / leave
    document.getElementById("openReviews")?.addEventListener("click", () => tg?.openTelegramLink(REVIEWS_URL));
    document.getElementById("leaveReview")?.addEventListener("click", () => tg?.openTelegramLink(REVIEWS_URL));

    document.getElementById("revMore")?.addEventListener("click", () => {
      reviewsVisibleCount += 8;
      render();
    });

    // open source
    view.querySelectorAll("[data-source]").forEach((el) => {
      bindTap(el, () => {
        const url = decodeURIComponent(el.dataset.source || "");
        openExternal(url);
      });
    });

    function toggleReview(idx) {
      const i = String(idx);
      const textEl = view.querySelector(`.reviewText[data-expand="${i}"]`);
      if (!textEl) return;
      const isOpen = textEl.classList.toggle("is-open");
      const btn = view.querySelector(`.reviewMore[data-more="${i}"]`);
      if (btn) btn.textContent = isOpen ? "Свернуть" : "Показать полностью";
    }

    // expand text on tap (folded by CSS)
    view.querySelectorAll("[data-expand]").forEach((el) => {
      bindTap(el, () => toggleReview(el.dataset.expand));
    });

    // explicit "show full" button
    view.querySelectorAll("[data-more]").forEach((el) => {
      bindTap(el, () => toggleReview(el.dataset.more));
    });
  };

  // Если отзывы ещё не успели подгрузиться, всё равно покажем UI и дадим кнопки.
  render();
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
  const films = LAMINATION_EXAMPLES.filter((ex) => ex.kind === "film");
  const laminations = LAMINATION_EXAMPLES.filter((ex) => ex.kind !== "film");

  const renderGrid = (items) => `
    <div class="grid2 exGrid">
      ${items
        .map((ex) => {
          const img = ex.images?.[0] || "";
          const imgHTML = img
            ? `<img class="exImg" src="${safeUrl(img)}" alt="${h(ex.title)}" loading="lazy" decoding="async" onerror="this.style.display='none'">`
            : `<div class="exStub"><div class="exStubText">Нет фото</div></div>`;

          return `
            <div class="exCard" data-exid="${ex.id}">
              ${imgHTML}
              <div class="exTitle">${h(ex.title)}</div>
              ${ex.subtitle ? `<div class="exMeta">${h(ex.subtitle)}</div>` : ``}
            </div>
          `;
        })
        .join("")}
    </div>
  `;

  view.innerHTML = `
    <div class="card">
      <div class="h2">Примеры ламинации и плёнки</div>

      <hr>
      <div class="h3">Плёнка</div>
      <div class="small" style="margin-top:6px">Основа наклейки: задаёт блеск, текстуру и «характер» сразу.</div>
      ${renderGrid(films)}

      <hr>
      <div class="h3">Ламинация</div>
      <div class="small" style="margin-top:6px">Прозрачное покрытие сверху — добавляет эффект и защищает поверхность.</div>
      ${renderGrid(laminations)}
    </div>
  `;

  view.querySelectorAll("[data-exid]").forEach((el) => {
    bindTap(el, () => openPage(() => renderLaminationExampleDetail(el.dataset.exid)));
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
      <div class="h2">${h(ex.title)}</div>
      ${ex.subtitle ? `<div class="small">${h(ex.subtitle)}</div>` : ``}
      ${ex.description ? `<div class="small" style="margin-top:8px">${h(ex.description)}</div>` : ``}

      <hr>

      ${
        imgs.length
          ? `<div class="exBig">
              ${imgs
                .map(
                  (u) => `
                <div class="exBigBtn" style="cursor:default">
                  <img class="exBigImg" src="${safeUrl(u)}" alt="${h(ex.title)}" loading="lazy" decoding="async" onerror="this.style.display='none'">
                </div>
              `
                )
                .join("")}
            </div>`
          : `<div class="small">Фото для этого примера пока не добавлено.</div>`
      }
    </div>
  `;

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

  const rawPHits = products
    .filter((p) => {
      const typeName = (p.product_type || "").toLowerCase();
      const hay = `${p.name || ""} ${p.description_short || ""} ${p.tags || ""} ${typeName}`.toLowerCase();
      return hay.includes(query);
    })
    .slice(0, 120);

  const groupsOrder = [
    { key: "sticker", title: "Наклейки" },
    { key: "pin", title: "Значки" },
    { key: "poster", title: "Постеры" },
    { key: "box", title: "Боксы / конверты" },
  ];
  const knownKeys = new Set(groupsOrder.map((g) => g.key));

  const grouped = groupsOrder
    .map((g) => ({ ...g, items: rawPHits.filter((p) => normalizeTypeKey(p.product_type) === g.key) }))
    .filter((g) => g.items.length > 0);

  const other = rawPHits.filter((p) => !knownKeys.has(normalizeTypeKey(p.product_type)));
  if (other.length) grouped.push({ key: "other", title: "Другое", items: other });

  const sectionHtml = (title, items) => {
    const cards = items
      .map(
        (p) => `
          <div class="pcard" data-id="${p.id}">
            ${cardThumbHTML(p)}
            <div class="pcardTitle">${h(p.name)}</div>
            ${cardMetaText(p) ? `<div class="pcardMeta">${escapeHTML(cardMetaText(p))}</div>` : ``}
            <div class="pcardPrice">${moneyDisplay(p.price)}</div>
            <div class="pcardActions">
              <button class="iconBtn iconBtnHeart ${isFavId(p.id) ? "is-active" : ""}" data-fav="${p.id}" type="button" aria-label="В избранное">
                <span class="heartGlyph">${isFavId(p.id) ? "♥" : "♡"}</span>
              </button>
              <button class="iconBtn" data-add="${p.id}" type="button" aria-label="Добавить в корзину">
                <span class="plusGlyph">＋</span>
              </button>
            </div>
          </div>
        `
      )
      .join("");

    return `
      <div class="fGroup" style="margin-top:12px">
        <div class="h3">${title}</div>
        <div class="grid2" style="margin-top:10px">${cards}</div>
      </div>
    `;
  };

  view.innerHTML = `
    <div class="card">
      <div class="h2">Поиск: “${h(q)}”</div>

      <div class="small"><b>Фандомы</b></div>
      <div class="list">
        ${
          fHits.length
            ? fHits
                .map(
                  (f) => `
          <div class="item" data-fid="${f.fandom_id}">
            <div class="title">${h(f.fandom_name)}</div>
            <div class="meta">${h(f.fandom_type)}</div>
          </div>
        `
                )
                .join("")
            : `<div class="small">Ничего не найдено</div>`
        }
      </div>

      <hr>

      <div class="small"><b>Товары</b></div>
      ${
        grouped.length
          ? grouped.map((g) => sectionHtml(g.title, g.items)).join("")
          : `<div class="small">Ничего не найдено</div>`
      }
    </div>
  `;

  view.querySelectorAll("[data-fid]").forEach((el) => (bindTap(el, () => openPage(() => renderFandomPage(el.dataset.fid)))));

  // открыть карточку товара по тапу на карточку
  view.querySelectorAll(".pcard[data-id]").forEach((el) => {
    bindTap(el, (e) => {
      const t = e.target;
      if (t && (t.closest("button") || t.tagName === "BUTTON")) return;
      openPage(() => renderProduct(el.dataset.id));
    });
  });

  // сердечки
  view.querySelectorAll("[data-fav]").forEach((b) => {
    bindTap(b, (e) => {
      e.stopPropagation();
      const id = String(b.dataset.fav || "");
      toggleFav(id);
      view.querySelectorAll(`[data-fav="${id}"]`).forEach((x) => {
        x.classList.toggle("is-active", isFavId(id));
        const g = x.querySelector(".heartGlyph");
        if (g) g.textContent = isFavId(id) ? "♥" : "♡";
      });
    });
  });

  // в корзину
  view.querySelectorAll("[data-add]").forEach((b) => {
    bindTap(b, (e) => {
      e.stopPropagation();
      const id = String(b.dataset.add || "");
      addToCartById(id);
      toast("Добавлено в корзину", "good");
    });
  });

  syncNav();
  syncBottomSpace();
}


// =====================
// Product page (полная карточка)
// =====================
function renderProduct(productId, prefill) {
  const p = getProductById(productId);
  if (!p) {
    view.innerHTML = `<div class="card"><div class="h2">Товар не найден</div></div>`;
    syncNav();
    syncBottomSpace();
    return;
  }

  const fandom = getFandomById(p.fandom_id);
  const img = firstImageUrl(p);

  const overlayDelta = Number(settings.overlay_price_delta) || 100;
  const holoDelta = Number(settings.holo_base_price_delta) || 100;

  const typeKey = normalizeTypeKey(p.product_type);
  const isSticker = typeKey === "sticker";
  const isPin = typeKey === "pin";
  const isPoster = typeKey === "poster";

  // --- defaults ---
  let selectedFilm = "film_glossy"; // default
  let selectedStickerLam = "none"; // default: без ламинации
  let selectedPinLam = "pin_base"; // default: глянцевая базовая
  let selectedPosterPack = POSTER_PACKS?.[0]?.[0] || "p10x15_8"; // default pack
  let selectedPosterPaper = POSTER_PAPERS?.[0]?.[0] || "glossy"; // default paper


// --- prefill (из корзины/избранного) ---
const pf = prefill || {};
if (isSticker) {
  if (pf.film) selectedFilm = String(pf.film);
  if (pf.lamination) selectedStickerLam = String(pf.lamination);
}
if (isPin) {
  if (pf.pin_lamination) selectedPinLam = String(pf.pin_lamination);
}
if (isPoster) {
  if (pf.poster_pack) selectedPosterPack = String(pf.poster_pack);
  if (pf.poster_paper) selectedPosterPaper = String(pf.poster_paper);
}


  const FILM_OPTIONS = [
    ["film_glossy", "Стандартная глянцевая плёнка", 0],
    ["film_holo", "Голографическая плёнка", holoDelta],
  ];

  const STICKER_LAM_OPTIONS = [
    ["none", "Без ламинации", 0],
    ["sugar", "Сахар", overlayDelta],
    ["stars", "Звёздочки", overlayDelta],
    ["snowflakes_small", "Маленькие снежинки", overlayDelta],
    ["stars_big", "Большие звёзды", overlayDelta],
    ["holo_overlay", "Голографическая ламинация", overlayDelta],
  ];

  const PIN_LAM_OPTIONS = [
    ["pin_base", "Глянцевая ламинация (базовая)", 0],
    ["sugar", "Сахар", overlayDelta],
    ["stars", "Звёздочки", overlayDelta],
    ["snowflakes_small", "Маленькие снежинки", overlayDelta],
    ["stars_big", "Большие звёзды", overlayDelta],
    ["holo_overlay", "Голографическая ламинация", overlayDelta],
  ];

  function calcPrice() {
    let price = Number(p.price) || 0;
    if (isPoster) {
      const base = Number(POSTER_PACK_PRICES[selectedPosterPack]) || Number(p.price) || 0;
      price = base;
    }
    if (isSticker) {
      const filmOpt = FILM_OPTIONS.find((x) => x[0] === selectedFilm);
      const lamOpt = STICKER_LAM_OPTIONS.find((x) => x[0] === selectedStickerLam);
      price += Number(filmOpt?.[2] || 0);
      price += Number(lamOpt?.[2] || 0);
    }
    if (isPin) {
      const lamOpt = PIN_LAM_OPTIONS.find((x) => x[0] === selectedPinLam);
      price += Number(lamOpt?.[2] || 0);
    }
    return price;
  }

  function currentOpts() {
    return {
      film: isSticker ? selectedFilm : "",
      lamination: isSticker ? selectedStickerLam : "",
      pin_lamination: isPin ? selectedPinLam : "",
      poster_pack: isPoster ? selectedPosterPack : "",
      poster_paper: isPoster ? selectedPosterPaper : "",
    };
  }

  function renderOptionPanel(title, rows, selectedKey, onSelect) {
    return `
      <div class="optPanel">
        <div class="optTitle"><b>${title}</b></div>
        <div class="optList">
          ${rows
            .map(([key, label, delta]) => {
              const active = key === selectedKey;
              let deltaText = ``;
              if (title === "Варианты наборов") {
                const price = Number(delta) || 0;
                deltaText = price > 0 ? `&nbsp;<span class="optDelta">— ${money(price)}</span>` : ``;
              } else {
                deltaText = Number(delta) > 0 ? `&nbsp;<span class="optDelta">+${Number(delta)}₽</span>` : ``;
              }
              return `
                <button class="optItem ${active ? "is-active" : ""}" data-opt="${key}" type="button">
                  <span class="optBox" aria-hidden="true"><span class="optFill"></span></span>
                  <span class="optLabel">${label}${deltaText}</span>
                </button>
              `;
            })
            .join("")}
        </div>
      </div>
    `;
  }

  function render() {
    const inFavNow = isFav(p.id, currentOpts());
    const priceNow = calcPrice();

    view.innerHTML = `
      <div class="card">
        <div class="prodHead">
          <div>
            <div class="h2">${h(p.name)}</div>
            <div class="small">${fandom?.fandom_name ? `<b>${h(fandom.fandom_name)}</b> · ` : ""}${typeLabelDetailed(p.product_type)}</div>
          </div>
</div>

        <div class="prodPrice" id="prodPriceVal">${money(priceNow)}</div>

        ${img ? `<img class="thumb" src="${safeUrl(img)}" alt="Фото товара" loading="lazy" decoding="async" style="margin-top:12px" onerror="this.style.display='none'">` : ""}

        ${getFullDesc(p) ? `<div class="descBlocks" style="margin-top:10px">${renderTextBlocks(isPoster ? stripPosterStaticChoiceBlocks(getFullDesc(p)) : getFullDesc(p))}</div>` : ""}

        ${
          isPoster
            ? `
              <div style="height:10px"></div>
              ${renderOptionPanel("Варианты наборов", POSTER_PACKS, selectedPosterPack)}
              <div style="height:10px"></div>
              ${renderOptionPanel("Бумага для печати", POSTER_PAPERS, selectedPosterPaper)}
            `
            : ""
        }

        ${(isSticker || isPin || isPoster) ? `<hr>` : ``}

        ${
          isSticker
            ? `
              ${renderOptionPanel("Плёнка", FILM_OPTIONS, selectedFilm)}
              <div style="height:10px"></div>
              ${renderOptionPanel("Ламинация", STICKER_LAM_OPTIONS, selectedStickerLam)}
              <div style="height:10px"></div>
              <button class="btn btnGhost" id="btnExamples" type="button">Посмотреть примеры плёнки и ламинации</button>
            `
            : ""
        }

        ${
          isPin
            ? `
              ${renderOptionPanel("Ламинация", PIN_LAM_OPTIONS, selectedPinLam)}
              <div style="height:10px"></div>
              <button class="btn btnGhost" id="btnExamples" type="button">Посмотреть примеры ламинации</button>
            `
            : ""
        }

        <hr>

        <div class="row" style="gap:10px">
  <button class="btn btnIcon" id="btnFav" type="button" aria-label="В избранное">
    <span class="heartGlyph">${inFavNow ? "♥" : "♡"}</span>
  </button>
  <button class="btn is-active" id="btnCart" type="button">Добавить в корзину · ${money(priceNow)}</button>
</div>
      </div>
    `;

    const btnFav = document.getElementById("btnFav");
    const btnCart = document.getElementById("btnCart");
    const btnExamples = document.getElementById("btnExamples");

    if (btnFav) {
      bindTap(btnFav, () => {
        toggleFav(p.id, currentOpts());
        render();
      });
    }

    if (btnCart) {
      bindTap(btnCart, () => {
        addToCartById(p.id, currentOpts());
        toast("Добавлено в корзину", "good");
        render();
      });
    }

    // опции (делаем радиогруппы)
    view.querySelectorAll(".optPanel").forEach((panel) => {
      const title = panel.querySelector(".optTitle")?.textContent?.trim() || "";
      panel.querySelectorAll("[data-opt]").forEach((b) => {
        bindTap(b, () => {
          const key = b.dataset.opt;
          if (isSticker && title === "Плёнка") selectedFilm = key;
          else if (isSticker && title === "Ламинация") selectedStickerLam = key;
          else if (isPin && title === "Ламинация") selectedPinLam = key;
          else if (isPoster && title === "Варианты наборов") selectedPosterPack = key;
          else if (isPoster && title === "Бумага для печати") selectedPosterPaper = key;
          render();
        });
      });
    });

    if (btnExamples) {
      bindTap(btnExamples, () => openExamples());
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
  const items = (fav || []).map(normalizeFavItem).filter((x) => getProductById(x.id));

  view.innerHTML = `
    <div class="card">
      <div class="h2">Избранное</div>
      <div class="small">То, что понравилось — чтобы не потерять.</div>
      <hr>

      <div class="list" id="favList">
        ${
          items.length
            ? items
                .map((fi, idx) => {
                  const p = getProductById(fi.id);
                  const img = firstImageUrl(p);
                  const unit = calcItemUnitPrice(p, fi);
                  const pairs = optionPairsFor(fi, p);
                  return `
                    <div class="item" data-open="${p.id}" data-idx="${idx}">
                      <div class="miniRow">
                        ${img ? `<img class="miniThumb" src="${safeUrl(img)}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'">` : `<div class="miniThumbStub"></div>`}
                        <div class="miniBody">
                          <div class="title">${h(p.name)}</div>
                          <div class="miniPrice">${money(unit)}</div>
                          ${optionPairsHTML(pairs)}

                          <div class="row" style="margin-top:12px">
                            <button class="btn" data-remove="${idx}" type="button">Убрать</button>
                            <button class="btn is-active" data-to-cart="${idx}" type="button">В корзину</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  `;
                })
                .join("")
            : `
              <div class="emptyBox">
                <div class="small">Избранное пока пустое ✨</div>
                <div class="small" style="margin-top:6px">Выбери что-то, что тебе понравится — и нажми сердечко.</div>
                <div style="height:10px"></div>
                <button class="btn is-active" id="goCatsFromEmptyFav" type="button">Перейти в категории</button>
              </div>
            `
        }
      </div>
    </div>
  `;

  view.querySelectorAll("[data-open]").forEach((el) => {
    bindTap(el, (e) => {
      const t = e.target;
      if (t && (t.closest("button") || t.tagName === "BUTTON")) return;
      const idx = Number(el.dataset.idx || 0);
      const fi = items[idx];
      openPage(() => renderProduct(el.dataset.open, fi));
    });
  });

  const goCats = document.getElementById("goCatsFromEmptyFav");
  if (goCats) bindTap(goCats, () => openPage(renderFandomTypes));

  view.querySelectorAll("[data-remove]").forEach((b) => {
    bindTap(b, (e) => {
      e.stopPropagation();
      const i = Number(b.dataset.remove);
      const next = [...(fav || [])];
      next.splice(i, 1);
      setFav(next);
      toast("Убрано из избранного", "warn");
    haptic("light");
      renderFavorites();
    });
  });

  view.querySelectorAll("[data-to-cart]").forEach((b) => {
    bindTap(b, (e) => {
      e.stopPropagation();
      const i = Number(b.dataset.toCart);
      const fi = normalizeFavItem((fav || [])[i]);
      addToCartById(fi.id, fi);
      toast("Добавлено в корзину", "good");
      renderFavorites();
    });
  });

  syncNav();
  syncBottomSpace();
}

// =====================
// Cart
// =====================
function calcItemUnitPrice(p, ci){
  const overlayDelta = Number(settings.overlay_price_delta) || 100;
  const holoDelta = Number(settings.holo_base_price_delta) || 100;
  let price = Number(p?.price) || 0;
  const t = normalizeTypeKey(p?.product_type);
  if (t === "sticker") {
    const film = String(ci?.film||"") || "film_glossy";
    const lam = String(ci?.lamination||"") || "none";
    if (film === "film_holo") price += holoDelta;
    if (lam !== "none") price += overlayDelta;
  }
  if (t === "pin") {
    const lam = String(ci?.pin_lamination||"") || "pin_base";
    if (lam !== "pin_base") price += overlayDelta;
  }
  if (t === "poster") {
    const pack = String(ci?.poster_pack||"" ) || POSTER_PACKS?.[0]?.[0] || "p10x15_8";
    const base = Number(POSTER_PACK_PRICES[pack]) || Number(p?.price) || 0;
    price = base;
  }
  return price;
}

function optionPairsFor(ci, p) {
  const t = normalizeTypeKey(p?.product_type);
  const out = [];
  if (t === "sticker") {
    const film = String(ci?.film || "") || "film_glossy";
    const lam = String(ci?.lamination || "") || "none";
    // базовые варианты не показываем
    if (film !== "film_glossy") out.push({ k: "Плёнка", v: FILM_LABELS[film] || film });
    if (lam !== "none") out.push({ k: "Ламинация", v: STICKER_LAM_LABELS[lam] || lam });
  } else if (t === "pin") {
    const lam = String(ci?.pin_lamination || "") || "pin_base";
    if (lam !== "pin_base") out.push({ k: "Ламинация", v: PIN_LAM_LABELS[lam] || lam });
  } else if (t === "poster") {
    const pack = String(ci?.poster_pack||"") || POSTER_PACKS?.[0]?.[0] || "p10x15_8";
    const paper = String(ci?.poster_paper||"") || POSTER_PAPERS?.[0]?.[0] || "glossy";
    out.push({ k: "Набор", v: `${POSTER_PACK_LABELS[pack] || pack} — ${money(Number(POSTER_PACK_PRICES[pack]) || Number(p?.price)||0)}` });
    out.push({ k: "Бумага", v: POSTER_PAPER_LABELS[paper] || paper });
  }
  return out;
}

function optionPairsHTML(pairs) {
  if (!pairs?.length) return "";
  return `<div class="miniOpts">${pairs
    .map((x) => `<div><span class="optKey">${h(x.k)}:</span> ${h(x.v)}</div>`)
    .join("")}</div>`;
}


function calcCartTotal() {
  let total = 0;
  (cart || []).forEach((ci) => {
    const p = getProductById(ci.id);
    if (!p) return;
    const unit = calcItemUnitPrice(p, ci);
    total += unit * (Number(ci.qty) || 0);
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
                  const img = firstImageUrl(p);
                  const unit = calcItemUnitPrice(p, ci);
                  const pairs = optionPairsFor(ci, p);
                  return `
                    <div class="item" data-idx="${idx}" data-open="${p.id}">
                      <div class="miniRow">
                        ${img ? `<img class="miniThumb" src="${safeUrl(img)}" alt="" loading="lazy" decoding="async" onerror="this.style.display='none'">` : `<div class="miniThumbStub"></div>`}
                        <div class="miniBody">
                          <div class="title">${h(p.name)}</div>
                          <div class="miniPrice">${money(unit)}${(Number(ci.qty)||1) > 1 ? ` <span class="miniQty">× ${Number(ci.qty)||1}</span>` : ``}</div>
                          ${optionPairsHTML(pairs)}
                        </div>
                      </div>

                      <div class="row miniIndentRow" style="margin-top:12px; align-items:center">
                        <button class="btn" data-dec="${idx}">−</button>
                        <div class="small" style="min-width:34px; text-align:center"><b>${Number(ci.qty) || 1}</b></div>
                        <button class="btn" data-inc="${idx}">+</button>
                      </div>
                    </div>
                  `;
                })
                .join("")
            : `
              <div class="emptyBox">
                <div class="small">Корзина пока пустая ✨</div>
                <div style="height:10px"></div>
                <button class="btn is-active" id="goCatsFromEmptyCart" type="button">Перейти в категории</button>
              </div>
            `
        }
      </div>

      ${
        items.length
          ? `
        <hr>
        <div class="small">Итого: <b>${money(calcCartTotal())}</b><span class="totalNote">(без учёта доставки — она рассчитывается менеджеркой индивидуально)</span></div>
        <div style="height:10px"></div>
        <div class="row">
          <button class="btn" id="btnClear" type="button">Очистить</button>
          <button class="btn is-active" id="btnCheckout" type="button">Оформить заказ</button>
        </div>
      `
          : ""
      }
    </div>
  `;

  view.querySelectorAll("[data-inc]").forEach((b) => {
    bindTap(b, () => {
      const i = Number(b.dataset.inc);
      const next = [...cart];
      next[i].qty = (Number(next[i].qty) || 0) + 1;
      setCart(next);
      gaEvent("add_to_cart", { item_id: String(next[i]?.id || ""), quantity: 1 });
      haptic("select");
      renderCart();
    });
  });

  view.querySelectorAll("[data-dec]").forEach((b) => {
    bindTap(b, () => {
      const i = Number(b.dataset.dec);
      const next = [...cart];
      const q = (Number(next[i].qty) || 1) - 1;
      if (q <= 0) next.splice(i, 1);
      else next[i].qty = q;
      setCart(next);
      gaEvent("remove_from_cart", { item_id: String(next[i]?.id || ""), quantity: 1 });
      haptic("select");
      renderCart();
    });
  });

  
// Открытие карточки товара по тапу на позицию (кроме кнопок)
view.querySelectorAll("#cartList .item[data-idx]").forEach((el) => {
  bindTap(el, (e) => {
    const t = e.target;
    if (t && (t.closest("button") || t.tagName === "BUTTON")) return;
    const idx = Number(el.dataset.idx || 0);
    const ci = items[idx];
    if (!ci) return;
    openPage(() => renderProduct(ci.id, ci));
  });
});

const goCats = document.getElementById("goCatsFromEmptyCart");
  if (goCats) bindTap(goCats, () => openPage(renderFandomTypes));

  const btnClear = document.getElementById("btnClear");
  if (btnClear) {
    bindTap(btnClear, () => {
      setCart([]);
      toast("Корзина очищена", "warn");
      renderCart();
    });
  }

  const btnCheckout = document.getElementById("btnCheckout");
  if (btnCheckout) bindTap(btnCheckout, () => openCheckout());

  syncNav();
  syncBottomSpace();
}

// =====================
// Checkout
// =====================
const LS_CHECKOUT = "lespaw_checkout_v2";
const CLOUD_CHECKOUT = "lespaw_checkout_cloud_v2";

// Миграция со старых полей (чтобы пользовательки не потеряли введённые данные)
const oldCheckout = loadJSON("lespaw_checkout_v1", null);

let checkout = loadJSON(LS_CHECKOUT, {
  fio: oldCheckout?.name || "",
  phone: oldCheckout?.contact || "",
  pickupType: "yandex", // yandex | 5post
  pickupAddress: (oldCheckout?.delivery || ""),
  comment: oldCheckout?.comment || "",
});

let checkoutCloudTimer = null;

async function openCheckout() {
  gaEvent("begin_checkout");
  // каждый новый заход в оформление требует открыть "Важную информацию"
  infoViewedThisSession = false;
  await syncCheckoutFromCloud();
  openPage(renderCheckout);
}

function saveCheckout(next) {
  const stamped = { ...(next || {}), _updatedAt: Date.now() };
  checkout = stamped;
  saveJSON(LS_CHECKOUT, checkout);

  // Sync to Telegram CloudStorage so checkout fields follow the user across devices (same Telegram account).
  try {
    if (checkoutCloudTimer) clearTimeout(checkoutCloudTimer);
    checkoutCloudTimer = setTimeout(() => {
      (async () => {
        try {
          const payload = JSON.stringify({ data: checkout, updatedAt: checkout._updatedAt });
          await cloudSet(CLOUD_CHECKOUT, payload);
        } catch {}
      })();
    }, 350);
  } catch {}
}

async function syncCheckoutFromCloud() {
  try {
    const raw = await cloudGet(CLOUD_CHECKOUT);
    if (!raw) return;

    let cloudObj = null;
    try { cloudObj = JSON.parse(raw); } catch { cloudObj = null; }
    const cloudData = cloudObj?.data || null;
    const cloudTs = Number(cloudObj?.updatedAt || cloudData?._updatedAt || 0) || 0;
    const localTs = Number(checkout?._updatedAt || 0) || 0;

    if (cloudData && cloudTs > localTs) {
      checkout = { ...(checkout || {}), ...(cloudData || {}), _updatedAt: cloudTs };
      saveJSON(LS_CHECKOUT, checkout);
      return;
    }

    // If local is newer (or cloud missing ts), push local up.
    if (localTs && localTs >= cloudTs) {
      const payload = JSON.stringify({ data: checkout, updatedAt: localTs });
      await cloudSet(CLOUD_CHECKOUT, payload);
    }
  } catch {}
}


function optionLabelForCartItem(ci, p) {
  // Унифицированный вывод опций через актуальный optionPairsFor()
  try {
    const pairs = optionPairsFor(ci || {}, p || { product_type: ci?.product_type || ci?.type || "" });
    return (pairs || []).map(({ k, v }) => `${k}: ${v}`).join(" · ");
  } catch {
    return "";
  }
}


function buildOrderText() {
  // Важно: текст отправляется через tg:// / t.me/share?text=..., там НЕ работает Markdown (**жирный**, `моно`).
  // Поэтому делаем "выделение" визуально через капс/разделители и псевдо-моно для цифр.

  // Опции ровно как в приложении (лейблы на русском)
  const overlayDelta = Number(settings.overlay_price_delta) || 0;
  const holoDelta = Number(settings.holo_base_price_delta) || 0;

  const FILM_OPTIONS = [
    ["film_glossy", "Стандартная глянцевая плёнка", 0],
    ["film_holo", "Голографическая плёнка", holoDelta],
  ];

  const STICKER_LAM_OPTIONS = [
    ["none", "Без ламинации", 0],
    ["sugar", "Сахар", overlayDelta],
    ["stars", "Звёздочки", overlayDelta],
    ["snowflakes_small", "Маленькие снежинки", overlayDelta],
    ["stars_big", "Большие звёзды", overlayDelta],
    ["holo_overlay", "Голографическая ламинация", overlayDelta],
  ];

  const PIN_LAM_OPTIONS = [
    ["pin_base", "Глянцевая ламинация (базовая)", 0],
    ["sugar", "Сахар", overlayDelta],
    ["stars", "Звёздочки", overlayDelta],
    ["snowflakes_small", "Маленькие снежинки", overlayDelta],
    ["stars_big", "Большие звёзды", overlayDelta],
    ["holo_overlay", "Голографическая ламинация", overlayDelta],
  ];

  const filmLabelByKey = Object.fromEntries(FILM_OPTIONS.map((x) => [x[0], x[1]]));
  const stickerLamLabelByKey = Object.fromEntries(STICKER_LAM_OPTIONS.map((x) => [x[0], x[1]]));
  const pinLamLabelByKey = Object.fromEntries(PIN_LAM_OPTIONS.map((x) => [x[0], x[1]]));

  // Выделение "жирным" (симуляция): капс + двоеточие
  const H = (s) => String(s || "").toUpperCase(); // заголовок/лейбл
  const LBL = (s) => `${H(s)}:`; // лейбл с двоеточием

  // "Моно" (симуляция): заменяем цифры на математические моно-цифры + обрамляем скобками
  const formatPlainValue = (s) => String(s || "").trim();

  const formatPhoneForOrder = (s) => {
    const d = String(s || "").replace(/\D+/g, "");
    if (!d) return "";
    // Prefer 1-3-3-2-2: 8-952-512-62-98 (works well for RU 11-digit numbers)
    if (d.length === 11) {
      return `${d[0]}-${d.slice(1,4)}-${d.slice(4,7)}-${d.slice(7,9)}-${d.slice(9,11)}`;
    }
    if (d.length === 10) {
      return `${d.slice(0,3)}-${d.slice(3,6)}-${d.slice(6,8)}-${d.slice(8,10)}`;
    }
    // Fallback: group by 3s
    return d.replace(/(\d{3})(?=\d)/g, "$1-");
  };

  const pt = checkout.pickupType === "5post" ? "5Post" : "Яндекс";

  // группируем товары по типам
  const groupsOrder = [
    { key: "sticker", title: H("Наклейки") + ":" },
    { key: "pin", title: H("Значки") + ":" },
    { key: "poster", title: H("Постеры") + ":" },
    { key: "box", title: H("Боксы") + ":" },
  ];

  let total = 0;
  const groupedItems = new Map(groupsOrder.map((g) => [g.key, []]));

  // helper: аккуратно достать выбранные допки из разных версий корзины
  function pickStickerFilm(ci) {
    const k = String(ci?.film || "").trim() || String(ci?.base || "").trim();
    // совместимость: старое "holo" => film_holo
    if (k === "holo") return "film_holo";
    if (k === "glossy" || k === "matte") return "film_glossy";
    return k;
  }
  function pickStickerLam(ci) {
    const k = String(ci?.lamination || "").trim() || String(ci?.overlay || "").trim();
    // совместимость: старые ключи
    if (k === "softtouch") return "softtouch"; // если где-то ещё встречается — выведем как есть
    return k;
  }
  function pickPinLam(ci) {
    const k = String(ci?.pin_lamination || "").trim() || String(ci?.lamination || "").trim();
    return k;
  }

  (cart || []).forEach((ci) => {
    const p = getProductById(ci.id);
    if (!p) return;

    const typeKey = normalizeTypeKey(p.product_type);
    if (!groupedItems.has(typeKey)) return;

    const qty = Number(ci.qty) || 1;
    let unitPrice = Number(p.price) || 0;

    if (typeKey === "sticker") {
      const filmKey = pickStickerFilm(ci);
      const lamKey = pickStickerLam(ci);

      if (filmKey === "film_holo") unitPrice += holoDelta;

      // ламинации с доплатой: всё кроме "none"
      if (lamKey && lamKey !== "none") unitPrice += overlayDelta;
    }

    if (typeKey === "pin") {
      const lamKey = pickPinLam(ci);
      // доплата за всё кроме базовой
      if (lamKey && lamKey !== "pin_base") unitPrice += overlayDelta;
    }

    if (typeKey === "poster") {
      const pack = String(ci?.poster_pack||"").trim() || POSTER_PACKS?.[0]?.[0] || "p10x15_8";
      const base = Number(POSTER_PACK_PRICES[pack]) || Number(p.price) || 0;
      unitPrice = base;
    }

    total += unitPrice * qty;

    groupedItems.get(typeKey).push({ ci, p, qty, unitPrice });
  });

  const lines = [];
  lines.push("Здравствуйте! Хочу оформить заказ:");
  lines.push("");

  // секции товаров
  let anyProducts = false;

  groupsOrder.forEach((g) => {
    const items = groupedItems.get(g.key) || [];
    if (!items.length) return;

    anyProducts = true;

    // пустая строка между секциями (но не перед первой)
    if (lines.length > 2) lines.push("");

    lines.push(g.title);

    items.forEach(({ ci, p, qty, unitPrice }) => {
      // название товара без фандома

if (g.key === "box") {
  const pt = String(p.product_type || "").toLowerCase();
  const boxKind = pt.includes("конверт") ? "конверт" : "коробка";
  lines.push(`• ${p.name} - ${boxKind} - (${qty}шт — ${money(unitPrice * qty)})`);
} else {
  // название товара без фандома
  lines.push(`• ${p.name} (${qty}шт — ${money(unitPrice * qty)})`);
}

      if (g.key === "sticker") {
        const filmKey = pickStickerFilm(ci);
        const lamKey = pickStickerLam(ci);
        // Плёнка: базовую не пишем
        if (filmKey && filmKey !== "film_glossy" && filmKey !== "none") {
          const label = filmLabelByKey[filmKey] || String(filmKey);
          lines.push(`${LBL("Плёнка")} ${label}`);
        }

        // Ламинация: базовую не пишем
        if (lamKey && lamKey !== "none") {
          const label = stickerLamLabelByKey[lamKey] || String(lamKey);
          lines.push(`${LBL("Ламинация")} ${label}`);
        }
      } else if (g.key === "pin") {
        const lamKey = pickPinLam(ci);
        if (lamKey && lamKey !== "pin_base") {
          const label = pinLamLabelByKey[lamKey] || String(lamKey);
          lines.push(`${LBL("Ламинация")} ${label}`);
        }
      } else if (g.key === "poster") {
        const pack = String(ci?.poster_pack||"").trim() || POSTER_PACKS?.[0]?.[0] || "p10x15_8";
        const paper = String(ci?.poster_paper||"").trim() || POSTER_PAPERS?.[0]?.[0] || "glossy";
        const packLabel = POSTER_PACK_LABELS[pack] || pack;
        const paperLabel = POSTER_PAPER_LABELS[paper] || paper;
        lines.push(`${LBL("Набор")} ${packLabel}`);
        lines.push(`${LBL("Бумага")} ${paperLabel}`);
      } else {
        // остальные типы: допок нет
      }

      // пустая строка между позициями
      lines.push("");
    });

    // убираем лишние пустые строки
    while (lines.length && lines[lines.length - 1] === "" && lines[lines.length - 2] === "") {
      lines.pop();
    }
  });

  if (!anyProducts) {
    lines.push("Корзина пустая.");
    lines.push("");
  }

  lines.push("");
  lines.push(`${LBL("Итоговая сумма")} ${money(total)}`);
  lines.push("");
  lines.push(`${H("Данные для доставки")}:`);
  lines.push(`${LBL("ФИО")} ${checkout.fio || ""}`);
  lines.push(`${LBL("Номер телефона")} ${formatPhoneForOrder(checkout.phone || "")}`);
  lines.push(`${LBL("Пункт выдачи")} ${pt}`);
  lines.push(`${LBL("Адрес пункта выдачи")} ${formatPlainValue(checkout.pickupAddress || "")}`);

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
    bindTap(document.getElementById("goHome"), () => resetToHome());
    syncNav();
    syncBottomSpace();
    return;
  }

  const safeVal = (v) => String(v || "").replace(/"/g, "&quot;");

  view.innerHTML = `
    <div class="card">
      <div class="h2">Оформление заказа</div>
      <div class="small">Заполни данные и нажми «Оформить заказ».</div>
      <hr>

      <div class="small"><b>ФИО</b></div>
      <input class="searchInput" id="cFio" placeholder="Имя и фамилия" value="${safeVal(checkout.fio)}">
      <div style="height:10px"></div>

      <div class="small"><b>Номер телефона</b></div>
      <input class="searchInput" id="cPhone" placeholder="8-___-___-__-__" value="${safeVal(checkout.phone)}">
      <div style="height:10px"></div>

      <div class="small"><b>Пункт выдачи</b></div>
      <div class="row" style="margin-top:8px">
        <button class="btn ${checkout.pickupType === "yandex" ? "is-active" : ""}" id="ptYandex" type="button">Яндекс</button>
        <button class="btn ${checkout.pickupType === "5post" ? "is-active" : ""}" id="pt5Post" type="button">5Post</button>
      </div>
      <div style="height:10px"></div>

      <div class="small"><b>Адрес пункта выдачи</b></div>
      <input class="searchInput" id="cPickupAddress" placeholder="Область, город, улица, дом" value="${safeVal(checkout.pickupAddress)}">
      <div style="height:10px"></div>

      <div class="small"><b>Комментарий</b></div>
      <input class="searchInput" id="cComment" placeholder="необязательно" value="${safeVal(checkout.comment)}">

      <hr>

      <div class="checkoutSection">
        <div class="checkoutSectionTitle">Подтверждения</div>

        <div class="checkoutBlock" id="blockInfoGate">
          <div class="checkoutBlockTop">
            <div class="checkoutBlockTitle">Важная информация</div>
            <button class="btn btnGhost btnSmall" id="openInfoFromCheckout" type="button">Открыть</button>
          </div>
          <div class="checkoutBlockText small">
            Перед оформлением заказа нужно перейти на вкладку «Важная информация» и ознакомиться с условиями.
          </div>

          <div class="checkWrap">
            <label class="checkRow small" id="rowAgreeInfo">
              <input type="checkbox" id="agreeInfo" ${infoViewedThisSession ? "" : "disabled"}>
              <span>
                Я ознакомилась с «Важной информацией».
                <span class="checkHint">${infoViewedThisSession ? "можно поставить галочку" : "сначала открой вкладку"}</span>
              </span>
            </label>
          </div>
        </div>

        <div class="checkoutBlock" id="blockConfirmItems">
          <div class="checkoutBlockTitle">Проверка заказа</div>
          <div class="checkWrap">
            <label class="checkRow small" id="rowConfirmItems">
              <input type="checkbox" id="confirmItems">
              <span>Я проверила позиции в заказе (количество, варианты плёнки/ламинации, фандомы) — всё верно.</span>
            </label>
          </div>
        </div>
        <div class="checkoutNote">
          После нажатия <b>«Оформить заказ»</b> откроется чат с менеджеркой с готовым текстом заказа.
          Пожалуйста, отправь его <b>без изменений</b>.
        </div>
      </div>

      <div style="height:12px"></div>

      <div class="row">
        <button class="btn is-active" id="btnSend" type="button">Оформить заказ</button>
      </div>
    </div>
  `;

  const cFio = document.getElementById("cFio");
  const cPhone = document.getElementById("cPhone");
  const cPickupAddress = document.getElementById("cPickupAddress");
  const cComment = document.getElementById("cComment");

  function syncCheckout() {
    saveCheckout({
      fio: cFio.value || "",
      phone: cPhone.value || "",
      pickupType: checkout.pickupType || "yandex",
      pickupAddress: cPickupAddress.value || "",
      comment: cComment.value || "",
    });
  }
  [cFio, cPickupAddress, cComment].forEach((el) => el.addEventListener("input", () => { el.classList.remove("field-error"); syncCheckout(); }));

  // Live phone mask with dashes + sync
  if (cPhone) {
    cPhone.addEventListener("input", () => {
      cPhone.classList.remove("field-error");
      applyPhoneMask(cPhone);
      syncCheckout();
    });
  }

  // Ensure phone stays formatted on blur
  if (cPhone) {
    cPhone.addEventListener("blur", () => {
      try {
        const f = formatPhoneLive(cPhone.value || "");
        if (f !== (cPhone.value || "")) {
          cPhone.value = f;
          syncCheckout();
        }
      } catch {}
    });
  }

  const ptYandex = document.getElementById("ptYandex");
  const pt5Post = document.getElementById("pt5Post");
  bindTap(ptYandex, () => { checkout.pickupType = "yandex"; saveCheckout(checkout); renderCheckout(); });
  bindTap(pt5Post, () => { checkout.pickupType = "5post"; saveCheckout(checkout); renderCheckout(); });

  const openInfoFromCheckout = document.getElementById("openInfoFromCheckout");
  bindTap(openInfoFromCheckout, () => openPage(renderInfo));

  const btnSend = document.getElementById("btnSend");
  const agreeInfo = document.getElementById("agreeInfo");
  const confirmItems = document.getElementById("confirmItems");

  const rowAgreeInfo = document.getElementById("rowAgreeInfo");
  const rowConfirmItems = document.getElementById("rowConfirmItems");

  // визуальный статус для заблокированной галочки
  if (rowAgreeInfo && !infoViewedThisSession) rowAgreeInfo.classList.add("is-disabled");

  // если важная инфа ещё не открывалась — не даём поставить галочку
  // ВАЖНО: тут нельзя использовать bindTap(), потому что он делает preventDefault всегда,
  // и тогда чекбокс не переключается даже когда он разблокирован.
  rowAgreeInfo?.addEventListener("click", (e) => {
    if (!infoViewedThisSession) {
      try { e?.preventDefault?.(); } catch {}
      try { e?.stopPropagation?.(); } catch {}
      toast("Сначала открой «Важную информацию» 💜", "warn");
      rowAgreeInfo?.classList.add("is-error");
      // удобно: сразу ведём на вкладку
      setTimeout(() => openPage(renderInfo), 150);
    }
  }, { passive: false });

  agreeInfo?.addEventListener("change", () => rowAgreeInfo?.classList.remove("is-error"));
  confirmItems?.addEventListener("change", () => rowConfirmItems?.classList.remove("is-error"));

  bindTap(btnSend, () => {
    syncCheckout();

    // сброс подсветок
    [cFio, cPhone, cPickupAddress].forEach((el) => el?.classList.remove("field-error"));
    rowAgreeInfo?.classList.remove("is-error");
    rowConfirmItems?.classList.remove("is-error");

    let ok = true;

    const fio = (cFio?.value || "").trim();
    const phone = (cPhone?.value || "").trim();
    const addr = (cPickupAddress?.value || "").trim();

    if (!fio) { cFio?.classList.add("field-error"); ok = false; }
    if (!phone) { 
      cPhone?.classList.add("field-error"); 
      ok = false; 
    } else {
      const digits = (phone || "").replace(/\D/g, "");
      if (digits.length < 10) {
        cPhone?.classList.add("field-error");
        ok = false;
      }
    }
    if (!addr) { cPickupAddress?.classList.add("field-error"); ok = false; }

    // гейт: без открытия важной информации нельзя подтверждать
    if (!infoViewedThisSession) {
      rowAgreeInfo?.classList.add("is-error");
      ok = false;
    } else if (!agreeInfo?.checked) {
      rowAgreeInfo?.classList.add("is-error");
      ok = false;
    }

    if (!confirmItems?.checked) {
      rowConfirmItems?.classList.add("is-error");
      ok = false;
    }

    if (!ok) {
      toast("Проверь обязательные поля и галочки 💜", "warn");
      // прокрутим к первому проблемному месту
      const firstErr = view.querySelector(".field-error, .checkRow.is-error");
      firstErr?.scrollIntoView({ behavior: "smooth", block: "center" });
      return;
    }

    const text = buildOrderText();
    openTelegramText(MANAGER_USERNAME, text);
    toast("Открываю чат с менеджеркой…", "good");
  });

  syncNav();
  syncBottomSpace();
}
