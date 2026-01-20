// LesPaw Mini App — app.js v84
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

async function fetchCSVWithCache(url, cacheKey) {
  const cached = loadCsvCache(cacheKey);
  // Если кеш свежий — используем сразу и параллельно обновляем в фоне
  if (cached && Date.now() - (cached.ts || 0) < CSV_CACHE_TTL_MS) {
    // фон-обновление (не блокируем UI)
    fetchCSV(url)
      .then((fresh) => saveCsvCache(cacheKey, fresh))
      .catch(() => {});
    return cached.data;
  }
  // иначе грузим как обычно
  const fresh = await fetchCSV(url);
  saveCsvCache(cacheKey, fresh);
  return fresh;
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

const CATEGORY_META = [
  { key: 'Фильмы', icon: '🎬' },
  { key: 'Игры', icon: '🎮' },
  { key: 'Сериалы', icon: '📺' },
  { key: 'Актрисы и певицы', icon: '🎤' },
  { key: 'Аниме', icon: '📘' },
  { key: 'Мультсериалы', icon: '🌈' },
  { key: 'Манхвы / манги', icon: '🌸' },
  { key: 'Лакорны', icon: '💋' },
  { key: 'Что-то тематическое', icon: '✨' },
];

function getCategoryIcon(name){
  const hit = (CATEGORY_META||[]).find(x=>x.key===name);
  return hit?hit.icon:'✨';
}

const OVERLAY_OPTIONS = [
  ["none", "Без ламинации"],
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

  // boxes
  if (s === "box" || s === "boxes" || s.includes("бокс")) return "box";

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
  return `<img class="pcardImg" src="${u}" alt="Фото товара" loading="lazy" decoding="async">`;
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

    updateBadges();
    resetToHome(); // уже можно открыть меню

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
      <div class="small">Выбери категорию</div>
      <hr>

      <div class="catGrid">
        ${FANDOM_TYPES.map(
          (t) => `
          <button class="catBtn" type="button" data-type="${t}">
            <div class="catIco" aria-hidden="true">${getCategoryIcon(t)}</div>
            <div class="catTitle">${t}</div>
          </button>
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

  const renderGrid = (arr) => `
    <div class="fanGrid">
      ${arr
        .map(
          (f) => `
        <button class="fanBtn" type="button" data-id="${f.fandom_id}">
          <div class="fanTitle">${f.fandom_name}</div>
        </button>
      `
        )
        .join("")}
    </div>
  `;

  view.innerHTML = `
    <div class="card">
      <div class="h2">${type}</div>
      <div class="small">Фандомы по алфавиту</div>
      <hr>

      ${letters.length ? renderGrid(letters) : `<div class="small">Пока пусто.</div>`}

      ${digits.length ? `<hr><div class="small"><b>0–9</b></div>${renderGrid(digits)}` : ``}
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

  const groupsOrder = [
    { key: "sticker", title: "Наклейки" },
    { key: "pin", title: "Значки" },
    { key: "poster", title: "Постеры" },
    { key: "box", title: "Боксы" },
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
            <div class="pcardTop">
              ${cardThumbHTML(p)}
              <div class="pcardMiniActions">
                <button class="miniBtn" type="button" data-fav="${p.id}" aria-label="В избранное">
                  ${fav.includes(p.id) ? "♥" : "♡"}
                </button>
                <button class="miniBtn" type="button" data-add="${p.id}" aria-label="В корзину">＋</button>
              </div>
            </div>
            <div class="pcardTitle">${p.name}</div>
            <div class="pcardMeta">${money(p.price)} · ${typeLabel(p.product_type)}</div>
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

  // open product
  view.querySelectorAll(".pcard[data-id]").forEach((el) => {
    el.onclick = (e) => {
      const t = e.target;
      if (t && (t.closest("button") || t.tagName === "BUTTON")) return;
      openPage(() => renderProduct(el.dataset.id));
    };
  });

  // fav toggle
  view.querySelectorAll("[data-fav]").forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const id = b.dataset.fav;
      if (fav.includes(id)) setFav(fav.filter((x) => x !== id));
      else setFav([...fav, id]);
      renderFandomPage(fandomId);
    };
  });

  // quick add to cart
  view.querySelectorAll("[data-add]").forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const id = b.dataset.add;
      const p = getProductById(id);
      if (!p) return;

      const t = normalizeTypeKey(p.product_type);
      const item = {
        id,
        qty: 1,
        overlay: t === "sticker" ? "none" : "",
        base: t === "sticker" ? "normal" : "",
        pin_lam: t === "pin" ? "base" : "",
      };

      const same = cart.find(
        (x) =>
          x.id === item.id &&
          (x.overlay || "") === (item.overlay || "") &&
          (x.base || "") === (item.base || "") &&
          (x.pin_lam || "") === (item.pin_lam || "")
      );

      if (same) {
        same.qty = (Number(same.qty) || 0) + 1;
        setCart([...cart]);
      } else {
        setCart([...cart, item]);
      }

      toast("Добавлено в корзину", "good");
    };
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

  document.getElementById("btnMain").onclick = () => tg?.openTelegramLink(MAIN_CHANNEL_URL);
  document.getElementById("btnSuggest").onclick = () => tg?.openTelegramLink(SUGGEST_URL);
  document.getElementById("btnManager").onclick = () => tg?.openTelegramLink(`https://t.me/${MANAGER_USERNAME}`);

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
                     <img class="reviewPhoto" src="${r.photo_url}" alt="Фото отзыва" loading="lazy" decoding="async">
                   </div>`
                : ``;

              const sourceBtn = r.source_url
                ? `<button class="btn btnMini" data-source="${encodeURIComponent(r.source_url)}">К оригиналу</button>`
                : ``;

              return `
                <div class="reviewCard">
                  <div class="reviewTop">
                    <div class="reviewAvatar" aria-hidden="true">${safeText(r.author).slice(0, 1).toUpperCase() || "★"}</div>
                    <div class="reviewHead">
                      <div class="reviewAuthor">${safeText(r.author) || "Покупательница"}</div>
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
      b.onclick = () => {
        mode = b.dataset.mode || "all";
        reviewsVisibleCount = 8;
        render();
      };
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
      el.onclick = () => {
        const url = decodeURIComponent(el.dataset.source || "");
        openExternal(url);
      };
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
      el.onclick = () => toggleReview(el.dataset.expand);
    });

    // explicit "show full" button
    view.querySelectorAll("[data-more]").forEach((el) => {
      el.onclick = () => toggleReview(el.dataset.more);
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
            ? `<img class="exImg" src="${img}" alt="${safeText(ex.title)}" loading="lazy" decoding="async">`
            : `<div class="exStub"><div class="exStubText">Нет фото</div></div>`;

          return `
            <div class="exCard" data-exid="${ex.id}">
              ${imgHTML}
              <div class="exTitle">${safeText(ex.title)}</div>
              ${ex.subtitle ? `<div class="exMeta">${safeText(ex.subtitle)}</div>` : ``}
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

      ${
        imgs.length
          ? `<div class="exBig">
              ${imgs
                .map(
                  (u) => `
                <div class="exBigBtn" style="cursor:default">
                  <img class="exBigImg" src="${u}" alt="${safeText(ex.title)}" loading="lazy" decoding="async">
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

  const typeKey = normalizeTypeKey(p.product_type);
  const isSticker = typeKey === "sticker";
  const isPin = typeKey === "pin";

  const overlayDelta = Number(settings.overlay_price_delta) || 0;
  const holoDelta = Number(settings.holo_base_price_delta) || 0;

  // defaults
  let selectedFilm = "glossy"; // glossy | holo
  let selectedLam = "none"; // for stickers: none + fancy
  let selectedPinLam = "base"; // base + fancy

  function inFav() {
    return fav.includes(p.id);
  }

  function favToggle() {
    if (inFav()) setFav(fav.filter((id) => id !== p.id));
    else setFav([...fav, p.id]);
    render();
  }

  function calcPrice() {
    let price = Number(p.price) || 0;

    if (isSticker) {
      if (selectedFilm === "holo") price += holoDelta;
      if (selectedLam !== "none") price += overlayDelta;
    }

    if (isPin) {
      if (selectedPinLam !== "base") price += overlayDelta;
    }

    return price;
  }

  function addToCart() {
    const item = {
      id: p.id,
      qty: 1,
      overlay: isSticker ? selectedLam : "",
      base: isSticker ? (selectedFilm === "holo" ? "holo" : "normal") : "",
      pin_lam: isPin ? selectedPinLam : "",
    };

    const existing = cart.find(
      (x) =>
        x.id === item.id &&
        (x.overlay || "") === (item.overlay || "") &&
        (x.base || "") === (item.base || "") &&
        (x.pin_lam || "") === (item.pin_lam || "")
    );

    if (existing) {
      existing.qty = (Number(existing.qty) || 0) + 1;
      setCart([...cart]);
    } else {
      setCart([...cart, item]);
    }

    toast("Добавлено в корзину", "good");
  }

  const lamOptions = OVERLAY_OPTIONS.filter(([k]) => k !== "none");

  function render() {
    const price = calcPrice();

    view.innerHTML = `
      <div class="card">
        <div class="pHead">
          <div class="pHeadMain">
            <div class="h2" style="margin:0">${p.name}</div>
            <div class="small">${fandom?.fandom_name ? `<b>${fandom.fandom_name}</b> · ` : ""}${typeLabel(p.product_type)}</div>
          </div>
          <button class="pFavBtn" id="btnFav" type="button" aria-label="В избранное">${inFav() ? "♥" : "♡"}</button>
        </div>
        <hr>

        ${img ? `<img class="thumb" src="${img}" alt="Фото товара" loading="lazy" decoding="async">` : ""}

        ${p.description ? `<div class="small" style="margin-top:10px">${p.description}</div>` : ""}
        ${p.description_short && !p.description ? `<div class="small" style="margin-top:10px">${p.description_short}</div>` : ""}

        ${
          isSticker
            ? `
          <hr>
          <div class="optBlock">
            <div class="optTitle">Плёнка</div>
            <div class="optRow">
              <button class="btn optBtn" data-film="glossy">Стандартная глянцевая</button>
              <button class="btn optBtn" data-film="holo">Голографическая</button>
            </div>

            <div style="height:10px"></div>

            <div class="optTitle">Ламинация</div>
            <div class="optRow optRowWrap">
              <button class="btn optBtn" data-lam="none">Без ламинации</button>
              ${lamOptions.map(([k, label]) => `<button class="btn optBtn" data-lam="${k}">${label}</button>`).join("")}
            </div>

            <div style="height:10px"></div>
            <button class="btn" id="openExamples" type="button">Посмотреть примеры плёнки и ламинации</button>
          </div>
        `
            : ""
        }

        ${
          isPin
            ? `
          <hr>
          <div class="optBlock">
            <div class="optTitle">Ламинация</div>
            <div class="small" style="margin-top:6px">Базовая глянцевая ламинация есть всегда. Если хочешь — можно добавить эффект сверху.</div>
            <div style="height:10px"></div>
            <div class="optRow optRowWrap">
              <button class="btn optBtn" data-pinlam="base">Глянцевая (базовая)</button>
              ${lamOptions.map(([k, label]) => `<button class="btn optBtn" data-pinlam="${k}">${label}</button>`).join("")}
            </div>
            <div style="height:10px"></div>
            <button class="btn" id="openExamples" type="button">Посмотреть примеры плёнки и ламинации</button>
          </div>
        `
            : ""
        }

        <hr>

        <div class="pActions">
          <button class="pActBtn" id="btnCart" type="button">Добавить в корзину · ${money(price)}</button>
        </div>
      </div>
    `;

    document.getElementById("btnFav")?.addEventListener("click", favToggle);
    document.getElementById("btnCart")?.addEventListener("click", addToCart);
    document.getElementById("openExamples")?.addEventListener("click", () => openExamples());

    // sticker film
    view.querySelectorAll("[data-film]").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.film === selectedFilm);
      b.onclick = () => {
        selectedFilm = b.dataset.film;
        render();
      };
    });

    // sticker lam
    view.querySelectorAll("[data-lam]").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.lam === selectedLam);
      b.onclick = () => {
        selectedLam = b.dataset.lam;
        render();
      };
    });

    // pin lam
    view.querySelectorAll("[data-pinlam]").forEach((b) => {
      b.classList.toggle("is-active", b.dataset.pinlam === selectedPinLam);
      b.onclick = () => {
        selectedPinLam = b.dataset.pinlam;
        render();
      };
    });
  }

  // init defaults: stickers glossy+none; pins base
  selectedFilm = "glossy";
  selectedLam = "none";
  selectedPinLam = "base";
  render();

  syncNav();
  syncBottomSpace();
}

// =====================
// Favorites
// =====================
function renderFavorites() {
  const items = (fav || []).map((id) => getProductById(id)).filter(Boolean);

  view.innerHTML = `
    <div class="card">
      <div class="h2">Избранное</div>
      <div class="small">Тут живут товары, которые тебе понравились.</div>
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
            : `
              <div class="emptyBox">
                <div class="emptyTitle">Пока пусто</div>
                <div class="small">Загляни в категории и добавь то, что тебе понравится 💜</div>
                <div style="height:12px"></div>
                <button class="btn is-active" id="goCats" type="button">Перейти в категории</button>
              </div>
            `
        }
      </div>
    </div>
  `;

  document.getElementById("goCats")?.addEventListener("click", () => openPage(renderFandomTypes));

  view.querySelectorAll("[data-open]").forEach((el) => {
    el.onclick = (e) => {
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
      const p = getProductById(id);
      if (!p) return;

      const t = normalizeTypeKey(p.product_type);
      const item = {
        id,
        qty: 1,
        overlay: t === "sticker" ? "none" : "",
        base: t === "sticker" ? "normal" : "",
        pin_lam: t === "pin" ? "base" : "",
      };

      const existing = cart.find(
        (x) =>
          x.id === item.id &&
          (x.overlay || "") === (item.overlay || "") &&
          (x.base || "") === (item.base || "") &&
          (x.pin_lam || "") === (item.pin_lam || "")
      );

      if (existing) {
        existing.qty = (Number(existing.qty) || 0) + 1;
        setCart([...cart]);
      } else {
        setCart([...cart, item]);
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

  // stickers
  if ((ci.base || "") === "holo") parts.push("Плёнка: голографическая");
  else if ((ci.base || "") === "normal") {
    // базовую плёнку не пишем
  }

  if (ci.overlay && ci.overlay !== "none") parts.push(`Ламинация: ${OVERLAY_LABELS[ci.overlay] || ci.overlay}`);

  // pins
  if (ci.pin_lam && ci.pin_lam !== "base") parts.push(`Ламинация: ${OVERLAY_LABELS[ci.pin_lam] || ci.pin_lam}`);

  return parts.length ? parts.join(" · ") : "";
}

function calcCartTotal() {
  let total = 0;
  const overlayDelta = Number(settings.overlay_price_delta) || 0;
  const holoDelta = Number(settings.holo_base_price_delta) || 0;

  (cart || []).forEach((ci) => {
    const p = getProductById(ci.id);
    if (!p) return;

    const t = normalizeTypeKey(p.product_type);

    let price = Number(p.price) || 0;

    if (t === "sticker") {
      if ((ci.overlay || "") && ci.overlay !== "none") price += overlayDelta;
      if ((ci.base || "") === "holo") price += holoDelta;
    }

    if (t === "pin") {
      if ((ci.pin_lam || "") && ci.pin_lam !== "base") price += overlayDelta;
    }

    total += price * (Number(ci.qty) || 0);
  });

  return total;
}

function renderCart() {
  const items = (cart || []).filter((ci) => getProductById(ci.id));

  const calcItemPrice = (ci) => {
    const p = getProductById(ci.id);
    if (!p) return 0;
    const overlayDelta = Number(settings.overlay_price_delta) || 0;
    const holoDelta = Number(settings.holo_base_price_delta) || 0;
    const t = normalizeTypeKey(p.product_type);
    let price = Number(p.price) || 0;
    if (t === "sticker") {
      if ((ci.overlay || "") && ci.overlay !== "none") price += overlayDelta;
      if ((ci.base || "") === "holo") price += holoDelta;
    }
    if (t === "pin") {
      if ((ci.pin_lam || "") && ci.pin_lam !== "base") price += overlayDelta;
    }
    return price;
  };

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
                  const img = firstImageUrl(p);
                  const unit = calcItemPrice(ci);
                  return `
                    <div class="cartItem" data-idx="${idx}">
                      ${img ? `<img class="cartThumb" src="${img}" alt="Фото" loading="lazy" decoding="async">` : `<div class="cartThumbStub" aria-hidden="true"></div>`}
                      <div class="cartMain">
                        <div class="cartTitle">${p.name}</div>
                        <div class="cartMeta">${money(unit)} за шт${opt ? ` · <span class=\"cartOpt\">${opt}</span>` : ``}</div>

                        <div class="row" style="margin-top:10px; align-items:center">
                          <button class="btn" data-dec="${idx}" aria-label="Минус">−</button>
                          <div class="small" style="min-width:34px; text-align:center"><b>${Number(ci.qty) || 1}</b></div>
                          <button class="btn" data-inc="${idx}" aria-label="Плюс">+</button>
                          <div style="flex:1"></div>
                          <div class="small"><b>${money(unit * (Number(ci.qty) || 1))}</b></div>
                        </div>
                      </div>
                    </div>
                  `;
                })
                .join("")
            : `
              <div class="emptyBox">
                <div class="emptyTitle">Корзина пустая</div>
                <div class="small">Выбери то, что тебе понравится — и добавь в корзину 💜</div>
                <div style="height:12px"></div>
                <button class="btn is-active" id="goCats" type="button">Перейти в категории</button>
              </div>
            `
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

  document.getElementById("goCats")?.addEventListener("click", () => openPage(renderFandomTypes));

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

  const btnClear = document.getElementById("btnClear");
  if (btnClear) {
    btnClear.onclick = () => {
      setCart([]);
      toast("Корзина очищена", "warn");
      renderCart();
    };
  }

  const btnCheckout = document.getElementById("btnCheckout");
  if (btnCheckout) btnCheckout.onclick = () => openCheckout();

  syncNav();
  syncBottomSpace();
}

// =====================
// Checkout
// =====================
const LS_CHECKOUT = "lespaw_checkout_v1";
let checkout = loadJSON(LS_CHECKOUT, {
  fio: "",
  phone: "",
  delivery_type: "yandex",
  pickup_address: "",
  comment: "",
});

// Гейт: галочки можно ставить только после перехода в «Важную информацию» из оформления
let checkoutInfoVisitedFromCheckout = false;

function openCheckout() {
  checkoutInfoVisitedFromCheckout = false;
  openPage(renderCheckout);
}

function saveCheckout(next) {
  checkout = next;
  saveJSON(LS_CHECKOUT, checkout);
}

function buildOrderText() {
  const lines = [];
  lines.push("🛍 Заказ LesPaw");

  if (checkout.fio) lines.push(`👤 ФИО: ${checkout.fio}`);
  if (checkout.phone) lines.push(`📱 Телефон: ${checkout.phone}`);
  if (checkout.delivery_type) lines.push(`🚚 Доставка: ${checkout.delivery_type === "yandex" ? "Пункт Яндекса" : "Пункт 5post"}`);
  if (checkout.pickup_address) lines.push(`📍 Адрес пункта выдачи: ${checkout.pickup_address}`);
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
    const t = normalizeTypeKey(p.product_type);

    if (t === "sticker") {
      if ((ci.overlay || "") && ci.overlay !== "none") price += overlayDelta;
      if ((ci.base || "") === "holo") price += holoDelta;
    }

    if (t === "pin") {
      if ((ci.pin_lam || "") && ci.pin_lam !== "base") price += overlayDelta;
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
        <button class="btn is-active" id="goCats">Перейти в категории</button>
      </div>
    `;
    document.getElementById("goCats").onclick = () => openPage(renderFandomTypes);
    syncNav();
    syncBottomSpace();
    return;
  }

  const fioVal = (checkout.fio || "").replace(/"/g, "&quot;");
  const phoneVal = (checkout.phone || "").replace(/"/g, "&quot;");
  const addrVal = (checkout.pickup_address || "").replace(/"/g, "&quot;");
  const commVal = (checkout.comment || "").replace(/"/g, "&quot;");

  view.innerHTML = `
    <div class="card">
      <div class="h2">Оформление заказа</div>
      <div class="small">Заполни данные — и нажми «Отправить заказ».</div>
      <hr>

      <div class="small"><b>ФИО</b></div>
      <input class="searchInput" id="cFio" placeholder="Фамилия Имя" value="${fioVal}">
      <div style="height:10px"></div>

      <div class="small"><b>Номер телефона</b></div>
      <input class="searchInput" id="cPhone" placeholder="+7..." value="${phoneVal}">
      <div style="height:10px"></div>

      <div class="small"><b>Доставка</b></div>
      <div class="radioRow" id="cDelRow">
        <button class="radioBtn" type="button" data-del="yandex">Пункт Яндекса</button>
        <button class="radioBtn" type="button" data-del="5post">Пункт 5post</button>
      </div>
      <div style="height:10px"></div>

      <div class="small"><b>Адрес пункта выдачи</b></div>
      <input class="searchInput" id="cAddr" placeholder="Область, город, улица, дом" value="${addrVal}">
      <div style="height:10px"></div>

      <div class="small"><b>Комментарий</b> <span style="font-weight:700; opacity:.65">(необязательно)</span></div>
      <input class="searchInput" id="cComment" placeholder="Например: удобное время" value="${commVal}">

      <hr>

      <div class="checkBox">
        <label class="checkLine">
          <input type="checkbox" id="ckInfo" />
          <span>Я прочитала «Важную информацию»</span>
        </label>
        <div class="small" id="ckHint" style="margin-top:8px; display:none">Сначала прочитай важную инфу.</div>
        <div style="height:8px"></div>
        <button class="btn" id="openInfo" type="button">Открыть важную информацию</button>
      </div>

      <hr>

      <button class="btn is-active" id="sendOrder" type="button">Отправить заказ</button>
    </div>
  `;

  // set delivery active
  const del = checkout.delivery_type || "yandex";
  view.querySelectorAll("[data-del]").forEach((b) => {
    b.classList.toggle("is-active", b.dataset.del === del);
    b.onclick = () => {
      const v = b.dataset.del;
      saveCheckout({ ...checkout, delivery_type: v });
      renderCheckout();
    };
  });

  // persist inputs
  const fioEl = document.getElementById("cFio");
  const phoneEl = document.getElementById("cPhone");
  const addrEl = document.getElementById("cAddr");
  const commEl = document.getElementById("cComment");

  fioEl?.addEventListener("input", (e) => saveCheckout({ ...checkout, fio: e.target.value || "" }));
  phoneEl?.addEventListener("input", (e) => saveCheckout({ ...checkout, phone: e.target.value || "" }));
  addrEl?.addEventListener("input", (e) => saveCheckout({ ...checkout, pickup_address: e.target.value || "" }));
  commEl?.addEventListener("input", (e) => saveCheckout({ ...checkout, comment: e.target.value || "" }));

  // Info gate
  const ck = document.getElementById("ckInfo");
  const hint = document.getElementById("ckHint");

  document.getElementById("openInfo")?.addEventListener("click", () => {
    checkoutInfoVisitedFromCheckout = true;
    openPage(renderInfo);
  });

  ck?.addEventListener("change", () => {
    if (!checkoutInfoVisitedFromCheckout && ck.checked) {
      ck.checked = false;
      hint.style.display = "";
      toast("Сначала прочитай важную инфу", "warn");
    } else {
      hint.style.display = "none";
    }
  });

  document.getElementById("sendOrder")?.addEventListener("click", () => {
    const fio = (checkout.fio || "").trim();
    const phone = (checkout.phone || "").trim();
    const addr = (checkout.pickup_address || "").trim();

    if (!fio || !phone || !addr) {
      toast("Заполни ФИО, телефон и адрес пункта выдачи", "warn");
      return;
    }

    if (!ck?.checked) {
      toast("Отметь галочку про важную информацию", "warn");
      return;
    }

    const text = buildOrderText();
    openTelegramText(MANAGER_USERNAME, text);
  });

  syncNav();
  syncBottomSpace();
}
