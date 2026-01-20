// LesPaw Mini App — app.js v57
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
// Normalize storage shapes (backward compatible)
// - cart: was {id, qty, overlay, base}; now {id, qty, film, lamination, pin_lamination}
// - fav: was [id]; now [{id, film, lamination, pin_lamination}]
function normalizeCartItem(ci){
  const o = ci && typeof ci === 'object' ? ci : { id: String(ci||''), qty: 1 };
  const id = String(o.id||'').trim();
  let qty = Number(o.qty)||1;
  // migrate sticker fields
  let film = (o.film!=null? String(o.film): '');
  let lamination = (o.lamination!=null? String(o.lamination): '');
  let pin_lamination = (o.pin_lamination!=null? String(o.pin_lamination): '');
  // legacy
  const base = String(o.base||'');
  const overlay = String(o.overlay||'');
  if (!film && base){
    film = base === 'holo' ? 'film_holo' : 'film_glossy';
  }
  if (!lamination && overlay){
    lamination = overlay;
  }
  return { id, qty, film, lamination, pin_lamination };
}
function normalizeFavItem(x){
  if (x && typeof x === 'object') {
    const id = String(x.id||'').trim();
    return { id, film: String(x.film||''), lamination: String(x.lamination||''), pin_lamination: String(x.pin_lamination||'') };
  }
  const id = String(x||'').trim();
  return { id, film: '', lamination: '', pin_lamination: '' };
}

cart = Array.isArray(cart) ? cart.map(normalizeCartItem).filter(x=>x.id) : [];
fav = Array.isArray(fav) ? fav.map(normalizeFavItem).filter(x=>x.id) : [];


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


function addItemToCart(productId, opts={}) {
  const id = String(productId||'').trim();
  const p = getProductById(id);
  if (!p) return;
  const t = normalizeTypeKey(p.product_type);
  const item = {
    id,
    qty: 1,
    film: t === 'sticker' ? String(opts.film||'film_glossy') : '',
    lamination: t === 'sticker' ? String(opts.lamination||'none') : '',
    pin_lamination: t === 'pin' ? String(opts.pin_lamination||'base_glossy') : '',
  };
  const existing = (cart||[]).find((x) =>
    x.id === item.id && String(x.film||'')===String(item.film||'') && String(x.lamination||'')===String(item.lamination||'') && String(x.pin_lamination||'')===String(item.pin_lamination||'')
  );
  if (existing) {
    existing.qty = (Number(existing.qty) || 0) + 1;
    setCart([...(cart||[])]);
  } else {
    setCart([...(cart||[]), item]);
  }
  toast('Добавлено в корзину', 'good');
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
  const favN = (fav||[]).length;
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


// ===== favorites helpers =====
function favFind(id, opts={}){
  const fid = String(id||'').trim();
  const film = String(opts.film||'');
  const lamination = String(opts.lamination||'');
  const pin_lamination = String(opts.pin_lamination||'');
  return (fav||[]).findIndex(x => String(x.id||'')===fid && String(x.film||'')===film && String(x.lamination||'')===lamination && String(x.pin_lamination||'')===pin_lamination);
}
function favHas(id, opts={}){
  return favFind(id, opts) >= 0;
}
function favAdd(id, opts={}){
  const fid=String(id||'').trim();
  const item={ id: fid, film: String(opts.film||''), lamination: String(opts.lamination||''), pin_lamination: String(opts.pin_lamination||'') };
  if (favHas(fid, item)) return;
  fav = [...(fav||[]), item];
  saveJSON(LS_FAV, fav);
  updateBadges();
}
function favRemoveAt(i){
  const next=[...(fav||[])];
  next.splice(i,1);
  fav=next;
  saveJSON(LS_FAV, fav);
  updateBadges();
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
      <div class="grid2 catGrid">
        ${FANDOM_TYPES.map(
          (t) => `
          <button class="catBtn" type="button" data-type="${t}">
            <div class="catTitle">${t}</div>
            <div class="catEmoji" aria-hidden="true">${CATEGORY_EMOJI[t] || ""}</div>
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
    <div class="grid2 fandomGrid">
      ${arr
        .map(
          (f) => `
        <button class="fandomBtn" type="button" data-id="${f.fandom_id}">
          <div class="fandomBtnTitle">${f.fandom_name}</div>
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
      ${renderGrid(letters)}
      ${digits.length ? `<hr><div class="small">0–9</div>` : ``}
      ${digits.length ? renderGrid(digits) : ``}
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
            ${cardThumbHTML(p)}
            <div class="pcardTitle">${p.name}</div>
            <div class="pcardMeta">${money(p.price)} · ${typeLabel(p.product_type)}</div>
            <div class="pcardActions">
              <button class="pcardActBtn" type="button" data-act="fav" data-pid="${p.id}" aria-label="В избранное">♡</button>
              <button class="pcardActBtn is-primary" type="button" data-act="cart" data-pid="${p.id}" aria-label="В корзину">＋</button>
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

  view.querySelectorAll("[data-id]").forEach((el) => {
    el.onclick = () => openPage(() => renderProduct(el.dataset.id));
  });

  // actions on mini cards (fav/cart)
  view.querySelectorAll('[data-act]').forEach((b) => {
    b.onclick = (e) => {
      e.stopPropagation();
      const pid = b.dataset.pid;
      const p = getProductById(pid);
      if (!p) return;
      const t = normalizeTypeKey(p.product_type);
      const defaults = { film: '', lamination: '', pin_lamination: '' };
      if (t === 'sticker') { defaults.film = 'film_glossy'; defaults.lamination = 'none'; }
      if (t === 'pin') { defaults.pin_lamination = 'base_glossy'; }
      if (b.dataset.act === 'fav') {
        if (favHas(pid, defaults)) {
          const i = favFind(pid, defaults);
          if (i >= 0) favRemoveAt(i);
          toast('Убрано из избранного', 'warn');
        } else {
          favAdd(pid, defaults);
          toast('Добавлено в избранное', 'good');
        }
        // визуально не перерисовываем весь экран — просто бейдж
      } else {
        addItemToCart(pid, defaults);
      }
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

  const overlayDelta = Number(settings.overlay_price_delta) || 0; // доплата за ламинацию
  const holoDelta = Number(settings.holo_base_price_delta) || 0; // доплата за голографическую плёнку

  const tkey = normalizeTypeKey(p.product_type);
  const isSticker = tkey === "sticker";
  const isPin = tkey === "pin";

  // defaults
  let film = isSticker ? "film_glossy" : ""; // film_glossy | film_holo
  let lamination = isSticker ? "none" : ""; // none | sugar | ...
  let pinLam = isPin ? "base_glossy" : ""; // base_glossy | sugar | ...

  const FILM_OPTIONS = [
    ["film_glossy", "Стандартная глянцевая"],
    ["film_holo", "Голографическая плёнка"],
  ];
  const LAM_OPTIONS = [["none", "Без ламинации"], ...OVERLAY_OPTIONS.filter(([k]) => k !== "none")];
  const PIN_LAM_OPTIONS = [["base_glossy", "Глянцевая ламинация (базовая)"], ...OVERLAY_OPTIONS.filter(([k]) => k !== "none")];

  function ciFromSelection() {
    return {
      id: p.id,
      qty: 1,
      film: isSticker ? film : "",
      lamination: isSticker ? lamination : "",
      pin_lamination: isPin ? pinLam : "",
    };
  }

  function calcPrice() {
    const ci = ciFromSelection();
    return calcItemPrice(p, ci);
  }

  function isInFavCurrent() {
    return (fav || []).some((x) => String(x?.id || x) === String(p.id) && JSON.stringify({
      film: x?.film || "",
      lamination: x?.lamination || "",
      pin_lamination: x?.pin_lamination || "",
    }) === JSON.stringify({
      film: isSticker ? film : "",
      lamination: isSticker ? lamination : "",
      pin_lamination: isPin ? pinLam : "",
    }));
  }

  function toggleFav() {
    const entry = ciFromSelection();
    entry.qty = undefined;
    const existsIdx = (fav || []).findIndex((x) => {
      if (!x) return false;
      if (typeof x === "string") return false;
      return String(x.id) === String(entry.id) && String(x.film||"")===String(entry.film||"") && String(x.lamination||"")===String(entry.lamination||"") && String(x.pin_lamination||"")===String(entry.pin_lamination||"");
    });
    if (existsIdx >= 0) {
      const next = [...fav];
      next.splice(existsIdx, 1);
      setFav(next);
      toast("Убрано из избранного", "warn");
    } else {
      setFav([...(fav || []), entry]);
      toast("Добавлено в избранное", "good");
    }
    render();
  }

  function addToCart() {
    const item = ciFromSelection();
    const existing = (cart || []).find(
      (x) =>
        String(x.id) === String(item.id) &&
        String(x.film || "") === String(item.film || "") &&
        String(x.lamination || "") === String(item.lamination || "") &&
        String(x.pin_lamination || "") === String(item.pin_lamination || "")
    );

    if (existing) {
      existing.qty = (Number(existing.qty) || 0) + 1;
      setCart([...(cart || [])]);
    } else {
      setCart([...(cart || []), item]);
    }

    toast("Добавлено в корзину", "good");
  }

  function render() {
    view.innerHTML = `
      <div class="card">
        <div class="prodTop">
          <div>
            <div class="h2" style="margin:0">${p.name}</div>
            <div class="small">${fandom?.fandom_name ? `<b>${fandom.fandom_name}</b> · ` : ""}${typeLabel(p.product_type)}</div>
          </div>
          <button class="favIconBtn ${isInFavCurrent() ? "is-on" : ""}" type="button" id="btnFavIcon" aria-label="В избранное">${isInFavCurrent() ? "♥" : "♡"}</button>
        </div>

        <hr>

        ${img ? `<img class="thumb" src="${img}" alt="Фото товара" loading="lazy" decoding="async">` : ""}

        ${p.description ? `<div class="small" style="margin-top:10px">${p.description}</div>` : ""}
        ${p.description_short && !p.description ? `<div class="small" style="margin-top:10px">${p.description_short}</div>` : ""}

        ${(isSticker || isPin) ? `<hr>` : ``}

        ${isSticker ? `
          <div class="optBlock">
            <div class="optTitle">Плёнка</div>
            <div class="optDesc">Основа наклейки. По умолчанию — стандартная глянцевая.</div>
            <div class="row" id="filmRow">
              ${FILM_OPTIONS.map(([k, label]) => `<button class="btn" data-film="${k}">${label}</button>`).join("")}
            </div>
          </div>

          <div class="optDivider"></div>

          <div class="optBlock">
            <div class="optTitle">Ламинация</div>
            <div class="optDesc">Прозрачное покрытие сверху. Можно оставить без ламинации.</div>
            <div class="row" id="lamRow">
              ${LAM_OPTIONS.map(([k, label]) => `<button class="btn" data-lam="${k}">${label}</button>`).join("")}
            </div>
            <button class="btnAlt" id="btnExamples" type="button">Посмотреть примеры плёнки и ламинации</button>
          </div>
        ` : ``}

        ${isPin ? `
          <div class="optBlock">
            <div class="optTitle">Ламинация</div>
            <div class="optDesc">По умолчанию: глянцевая (базовая) — значки делаются именно так.</div>
            <div class="row" id="pinLamRow">
              ${PIN_LAM_OPTIONS.map(([k, label]) => `<button class="btn" data-pinlam="${k}">${label}</button>`).join("")}
            </div>
            <button class="btnAlt" id="btnExamples" type="button">Посмотреть примеры ламинации и плёнки</button>
          </div>
        ` : ``}

        <div class="buyBar">
          <button class="btn is-active buyBtn" id="btnCart" type="button">Добавить в корзину · ${money(calcPrice())}</button>
        </div>
      </div>
    `;

    document.getElementById("btnFavIcon")?.addEventListener("click", toggleFav);
    document.getElementById("btnCart")?.addEventListener("click", addToCart);
    document.getElementById("btnExamples")?.addEventListener("click", () => openExamples());

    if (isSticker) {
      const filmRow = document.getElementById("filmRow");
      const lamRow = document.getElementById("lamRow");
      const btnCart = document.getElementById("btnCart");

      const sync = () => {
        filmRow?.querySelectorAll(".btn").forEach((b) => b.classList.toggle("is-active", b.dataset.film === film));
        lamRow?.querySelectorAll(".btn").forEach((b) => b.classList.toggle("is-active", b.dataset.lam === lamination));
        if (btnCart) btnCart.textContent = `Добавить в корзину · ${money(calcPrice())}`;
        const favBtn = document.getElementById("btnFavIcon");
        if (favBtn) {
          const on = isInFavCurrent();
          favBtn.textContent = on ? "♥" : "♡";
          favBtn.classList.toggle("is-on", on);
        }
      };

      filmRow?.querySelectorAll("[data-film]").forEach((b) => {
        b.addEventListener("click", () => {
          film = b.dataset.film || "film_glossy";
          sync();
        });
      });
      lamRow?.querySelectorAll("[data-lam]").forEach((b) => {
        b.addEventListener("click", () => {
          lamination = b.dataset.lam || "none";
          sync();
        });
      });

      sync();
    }

    if (isPin) {
      const pinLamRow = document.getElementById("pinLamRow");
      const btnCart = document.getElementById("btnCart");

      const sync = () => {
        pinLamRow?.querySelectorAll(".btn").forEach((b) => b.classList.toggle("is-active", b.dataset.pinlam === pinLam));
        if (btnCart) btnCart.textContent = `Добавить в корзину · ${money(calcPrice())}`;
        const favBtn = document.getElementById("btnFavIcon");
        if (favBtn) {
          const on = isInFavCurrent();
          favBtn.textContent = on ? "♥" : "♡";
          favBtn.classList.toggle("is-on", on);
        }
      };

      pinLamRow?.querySelectorAll("[data-pinlam]").forEach((b) => {
        b.addEventListener("click", () => {
          pinLam = b.dataset.pinlam || "base_glossy";
          sync();
        });
      });

      sync();
    }

    syncNav();
    syncBottomSpace();
  }

  render();
}

// =====================
// Favorites
// =====================
function favEntryLabel(p, fe) {
  const lines = []
  const t = normalizeTypeKey(p.product_type);
  if (t === "sticker") {
    const film = String(fe.film || "film_glossy");
    const lam = String(fe.lamination || "none");
    const filmLabel = film === "film_holo" ? "Плёнка: голографическая" : "Плёнка: стандартная глянцевая";
    const lamLabel = lam === "none" ? "Ламинация: без" : `Ламинация: ${OVERLAY_LABELS[lam] || lam}`;
    lines.push(filmLabel)
    lines.push(lamLabel)
  }
  if (t === "pin") {
    const lam = String(fe.pin_lamination || "base_glossy");
    const lamLabel = lam === "base_glossy" ? "Ламинация: глянцевая (базовая)" : `Ламинация: ${OVERLAY_LABELS[lam] || lam}`;
    lines.push(lamLabel)
  }
  return lines;
}

function renderFavorites() {
  const items = (fav || []).map((fe) => {
    if (typeof fe === "string") fe = { id: fe };
    const p = getProductById(fe.id);
    if (!p) return null;
    return { fe, p };
  }).filter(Boolean);

  view.innerHTML = `
    <div class="card">
      <div class="h2">Избранное</div>
      <div class="small">Товары, которые ты отметила сердечком.</div>
      <hr>

      ${items.length ? `
        <div class="list">
          ${items.map(({fe, p}, idx) => {
            const img = firstImageUrl(p);
            const price = calcItemPrice(p, { ...fe, qty: 1 });
            const lines = optionLinesForItem(p, fe);
            return `
              <div class="pickRow" data-openfav="${idx}">
                ${img ? `<img class="pickThumb" src="${img}" alt="Превью" loading="lazy" decoding="async">` : `<div class="pickThumb pickStub"></div>`}
                <div class="pickBody">
                  <div class="pickTitle">${p.name}</div>
                  <div class="pickPrice">${money(price)}</div>
                  ${lines}
                  <div class="row" style="margin-top:10px">
                    <button class="btn" type="button" data-fav-rm="${idx}">Убрать</button>
                    <button class="btn is-active" type="button" data-fav-cart="${idx}">В корзину</button>
                  </div>
                </div>
              </div>
            `;
          }).join("")}
        </div>
      ` : `
        <div class="emptyBox">
          <div class="emptyTitle">Пока пусто</div>
          <div class="small">Зайди в категории и отметь то, что тебе понравится ✨</div>
          <div style="height:10px"></div>
          <button class="btn is-active" id="goCatsFav" type="button">Перейти в категории</button>
        </div>
      `}
    </div>
  `;

  document.getElementById("goCatsFav")?.addEventListener("click", () => openPage(renderFandomTypes));

  view.querySelectorAll("[data-openfav]").forEach((el) => {
    el.addEventListener("click", (e) => {
      const t = e.target;
      if (t && (t.closest("button") || t.tagName === "BUTTON")) return;
      const idx = Number(el.dataset.openfav);
      const obj = items[idx];
      if (obj) openPage(() => renderProduct(obj.p.id));
    });
  });

  view.querySelectorAll("[data-fav-rm]").forEach((b) => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = Number(b.dataset.favRm);
      const next = [...(fav||[])];
      next.splice(idx, 1);
      setFav(next);
      toast("Убрано из избранного", "warn");
      renderFavorites();
    });
  });

  view.querySelectorAll("[data-fav-cart]").forEach((b) => {
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      const idx = Number(b.dataset.favCart);
      const obj = items[idx];
      if (!obj) return;
      const fe = obj.fe;
      const item = {
        id: fe.id,
        qty: 1,
        film: fe.film || "",
        lamination: fe.lamination || "",
        pin_lamination: fe.pin_lamination || "",
      };
      const existing = (cart||[]).find((x) => String(x.id)===String(item.id) && String(x.film||"")===String(item.film||"") && String(x.lamination||"")===String(item.lamination||"") && String(x.pin_lamination||"")===String(item.pin_lamination||""));
      if (existing) {
        existing.qty = (Number(existing.qty)||0)+1;
        setCart([...(cart||[])]);
      } else {
        setCart([...(cart||[]), item]);
      }
      toast("Добавлено в корзину", "good");
    });
  });

  syncNav();
  syncBottomSpace();
}

// =====================
// Cart helpers
// =====================
function calcItemPrice(p, ci) {
  const overlayDelta = Number(settings.overlay_price_delta) || 0;
  const holoDelta = Number(settings.holo_base_price_delta) || 0;

  let price = Number(p?.price) || 0;
  const t = normalizeTypeKey(p?.product_type);

  if (t === "sticker") {
    const film = String(ci?.film || "film_glossy");
    const lam = String(ci?.lamination || "none");
    if (film === "film_holo") price += holoDelta;
    if (lam && lam !== "none") price += overlayDelta;
  }

  if (t === "pin") {
    const lam = String(ci?.pin_lamination || "base_glossy");
    if (lam && lam !== "base_glossy") price += overlayDelta;
  }

  return price;
}

function optionLinesForItem(p, ci) {
  const t = normalizeTypeKey(p?.product_type);
  const lines = [];

  if (t === "sticker") {
    const film = String(ci?.film || "film_glossy");
    const lam = String(ci?.lamination || "none");
    const filmLabel = film === "film_holo" ? "Голографическая плёнка" : "Стандартная глянцевая плёнка";
    const lamLabel = lam === "none" ? "Без ламинации" : (OVERLAY_LABELS[lam] || lam);
    lines.push(`<div class="pickOptLine"><b>Плёнка:</b> ${filmLabel}</div>`);
    lines.push(`<div class="pickOptLine"><b>Ламинация:</b> ${lamLabel}</div>`);
  }

  if (t === "pin") {
    const lam = String(ci?.pin_lamination || "base_glossy");
    const lamLabel = lam === "base_glossy" ? "Глянцевая (базовая)" : (OVERLAY_LABELS[lam] || lam);
    lines.push(`<div class="pickOptLine"><b>Ламинация:</b> ${lamLabel}</div>`);
  }

  if (!lines.length) return ``;
  return `<div class="pickOpts">${lines.join("")}</div>`;
}

function calcCartTotal() {
  let total = 0;
  (cart || []).forEach((ci) => {
    const p = getProductById(ci.id);
    if (!p) return;
    const one = calcItemPrice(p, ci);
    total += one * (Number(ci.qty) || 0);
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

      ${
        items.length
          ? `<div class="list" id="cartList">
              ${items
                .map((ci, idx) => {
                  const p = getProductById(ci.id);
                  const img = firstImageUrl(p);
                  const priceOne = calcItemPrice(p, ci);
                  const priceText = `${money(priceOne)} × ${Number(ci.qty) || 1} = ${money(priceOne * (Number(ci.qty) || 1))}`;
                  const lines = optionLinesForItem(p, ci);

                  return `
                    <div class="pickRow">
                      ${img ? `<img class="pickThumb" src="${img}" alt="Превью" loading="lazy" decoding="async">` : `<div class="pickThumb pickStub"></div>`}
                      <div class="pickBody">
                        <div class="pickTitle">${p.name}</div>
                        <div class="pickPrice">${priceText}</div>
                        ${lines}

                        <div class="qtyRow">
                          <button class="btn" type="button" data-dec="${idx}">−</button>
                          <div class="qtyNum"><b>${Number(ci.qty) || 1}</b></div>
                          <button class="btn" type="button" data-inc="${idx}">+</button>
                        </div>
                      </div>
                    </div>
                  `;
                })
                .join("")}
            </div>`
          : `
            <div class="emptyBox">
              <div class="emptyTitle">Корзина пустая</div>
              <div class="small">Зайди в категории и выбери то, что тебе понравится ✨</div>
              <div style="height:10px"></div>
              <button class="btn is-active" id="goCats" type="button">Перейти в категории</button>
            </div>
          `
      }

      ${
        items.length
          ? `
        <hr>
        <div class="small">Итого: <b>${money(calcCartTotal())}</b></div>
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

  document.getElementById("goCats")?.addEventListener("click", () => openPage(renderFandomTypes));

  view.querySelectorAll("[data-inc]").forEach((b) => {
    b.addEventListener("click", () => {
      const i = Number(b.dataset.inc);
      const next = [...(cart || [])];
      next[i].qty = (Number(next[i].qty) || 0) + 1;
      setCart(next);
      renderCart();
    });
  });

  view.querySelectorAll("[data-dec]").forEach((b) => {
    b.addEventListener("click", () => {
      const i = Number(b.dataset.dec);
      const next = [...(cart || [])];
      const q = (Number(next[i].qty) || 1) - 1;
      if (q <= 0) next.splice(i, 1);
      else next[i].qty = q;
      setCart(next);
      renderCart();
    });
  });

  document.getElementById("btnClear")?.addEventListener("click", () => {
    setCart([]);
    toast("Корзина очищена", "warn");
    renderCart();
  });

  document.getElementById("btnCheckout")?.addEventListener("click", () => openCheckout());

  syncNav();
  syncBottomSpace();
}

// =====================
// Checkout
// =====================
const LS_CHECKOUT = "lespaw_checkout_v1";
let checkout = loadJSON(LS_CHECKOUT, {
  full_name: '',
  phone: '',
  delivery_method: 'yandex',
  pickup_address: '',
  comment: '',
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
  const dm = checkout.delivery_method === "5post" ? "Пункт 5post" : "Пункт Яндекса";

  const lines = [];
  lines.push("🛍️ Заказ LesPaw");
  lines.push("");
  lines.push(`ФИО: ${safeText(checkout.full_name)}`);
  lines.push(`Телефон: ${safeText(checkout.phone)}`);
  lines.push(`Доставка: ${dm}`);
  lines.push(`Адрес ПВЗ: ${safeText(checkout.pickup_address)}`);
  if (safeText(checkout.comment)) lines.push(`Комментарий: ${safeText(checkout.comment)}`);

  lines.push("");
  lines.push("Позиции:");

  let n = 1;
  (cart || []).forEach((ci) => {
    const p = getProductById(ci.id);
    if (!p) return;
    const one = calcItemPrice(p, ci);
    const sum = one * (Number(ci.qty) || 0);
    lines.push(`${n}. ${p.name} × ${Number(ci.qty) || 1} — ${money(sum)}`);

    const opts = [];
    const t = normalizeTypeKey(p.product_type);
    if (t === "sticker") {
      const film = String(ci.film || "film_glossy");
      const lam = String(ci.lamination || "none");
      const filmLabel = film === "film_holo" ? "Голографическая плёнка" : "Стандартная глянцевая плёнка";
      const lamLabel = lam === "none" ? "Без ламинации" : (OVERLAY_LABELS[lam] || lam);
      opts.push(`   • Плёнка: ${filmLabel}`);
      opts.push(`   • Ламинация: ${lamLabel}`);
    }
    if (t === "pin") {
      const lam = String(ci.pin_lamination || "base_glossy");
      const lamLabel = lam === "base_glossy" ? "Глянцевая ламинация (базовая)" : (OVERLAY_LABELS[lam] || lam);
      opts.push(`   • Ламинация: ${lamLabel}`);
    }
    if (opts.length) lines.push(...opts);

    n++;
  });

  lines.push("");
  lines.push(`Итого (без доставки): ${money(calcCartTotal())}`);

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

  const safeVal = (s) => String(s || "").replace(/"/g, "&quot;");

  view.innerHTML = `
    <div class="card">
      <div class="h2">Оформление заказа</div>
      <div class="small">Заполни данные — и нажми «Отправить заказ».</div>
      <hr>

      <div class="small"><b>ФИО</b></div>
      <input class="searchInput" id="cFullName" placeholder="Фамилия Имя" value="${safeVal(checkout.full_name)}">
      <div style="height:10px"></div>

      <div class="small"><b>Номер телефона</b></div>
      <input class="searchInput" id="cPhone" placeholder="+7…" value="${safeVal(checkout.phone)}">
      <div style="height:10px"></div>

      <div class="small"><b>Доставка</b></div>
      <div class="segmented" id="deliverySeg">
        <button class="segBtn" data-del="yandex">Пункт Яндекса</button>
        <button class="segBtn" data-del="5post">Пункт 5post</button>
      </div>
      <div style="height:10px"></div>

      <div class="small"><b>Адрес пункта выдачи</b></div>
      <input class="searchInput" id="cPickup" placeholder="Область, город, улица, дом" value="${safeVal(checkout.pickup_address)}">
      <div style="height:10px"></div>

      <div class="small"><b>Комментарий</b></div>
      <input class="searchInput" id="cComment" placeholder="необязательно" value="${safeVal(checkout.comment)}">

      <hr>

      <div class="mustRead" id="mustRead">
        <div class="mustReadText"><b>Важно:</b> перед отправкой заказа нужно ознакомиться с условиями — особенно с порядком оформления и оплаты.</div>
        <button class="mustReadBtn" id="openInfoFromCheckout" type="button">Открыть важную информацию</button>
      </div>

      <div class="checkoutGap"></div>

      <div class="checkoutChecks">
        <label class="checkRow small">
          <input type="checkbox" id="agree" style="margin-top:2px" ${checkoutInfoVisitedFromCheckout ? "" : "disabled"}>
          <span>
            Я ознакомилась с «Важной информацией» и понимаю порядок оформления и оплаты заказа.
            ${checkoutInfoVisitedFromCheckout ? "" : '<span class="checkHint">(сначала прочитай важную инфу)</span>'}
          </span>
        </label>

        <label class="checkRow small">
          <input type="checkbox" id="confirmItems" style="margin-top:2px" ${checkoutInfoVisitedFromCheckout ? "" : "disabled"}>
          <span>Я проверила позиции в заказе — всё верно.</span>
        </label>

        <div class="checkoutNote">
          После нажатия <b>«Отправить заказ»</b> тебя перебросит в чат с менеджеркой — там уже будет готовый текст заказа.
          Пожалуйста, отправь его <b>без изменений</b>.
        </div>
      </div>

      <div style="height:12px"></div>

      <div class="row">
        <button class="btn is-active" id="btnSend">Отправить заказ</button>
      </div>
    </div>
  `;

  const cFullName = document.getElementById("cFullName");
  const cPhone = document.getElementById("cPhone");
  const cPickup = document.getElementById("cPickup");
  const cComment = document.getElementById("cComment");

  const seg = document.getElementById("deliverySeg");
  const btnSend = document.getElementById("btnSend");
  const agree = document.getElementById("agree");
  const confirmItems = document.getElementById("confirmItems");

  function setDelivery(method) {
    checkout.delivery_method = method;
    saveCheckout(checkout);
    seg?.querySelectorAll('[data-del]').forEach((b) => b.classList.toggle('is-active', b.dataset.del === method));
  }

  // init delivery
  if (!checkout.delivery_method) checkout.delivery_method = 'yandex';
  setDelivery(checkout.delivery_method);

  seg?.querySelectorAll('[data-del]').forEach((b) => {
    b.onclick = () => setDelivery(b.dataset.del);
  });

  function syncCheckout() {
    saveCheckout({
      full_name: cFullName.value || "",
      phone: cPhone.value || "",
      delivery_method: checkout.delivery_method || "yandex",
      pickup_address: cPickup.value || "",
      comment: cComment.value || "",
    });
  }

  [cFullName, cPhone, cPickup, cComment].forEach((el) => el.addEventListener("input", syncCheckout));

  const openInfoFromCheckout = document.getElementById("openInfoFromCheckout");
  if (openInfoFromCheckout)
    openInfoFromCheckout.onclick = () => {
      checkoutInfoVisitedFromCheckout = true;
      openPage(renderInfo);
    };

  function syncSendState() {
    const gateOk = !!checkoutInfoVisitedFromCheckout;
    const ok = gateOk && !!agree?.checked && !!confirmItems?.checked;
    if (btnSend) {
      btnSend.disabled = !ok;
      btnSend.classList.toggle("is-disabled", !ok);
    }
  }

  agree?.addEventListener("change", syncSendState);
  confirmItems?.addEventListener("change", syncSendState);
  syncSendState();

  btnSend.onclick = () => {
    syncCheckout();

    if (!checkoutInfoVisitedFromCheckout) {
      toast("Сначала прочитай «Важную информацию» — кнопка выше 👆", "warn");
      return;
    }
    if (!agree.checked) {
      toast("Нужно подтвердить, что ты ознакомилась с условиями 😿", "warn");
      return;
    }
    if (!confirmItems.checked) {
      toast("Пожалуйста, подтверди, что проверила позиции заказа 😿", "warn");
      return;
    }

    const text = buildOrderText();
    const link = `https://t.me/${MANAGER_USERNAME}?text=${encodeURIComponent(text)}`;
    tg?.openTelegramLink(link);
    toast("Открываю чат с менеджеркой…", "good");
  };

  syncNav();
  syncBottomSpace();
}
