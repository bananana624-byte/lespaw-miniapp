// LesPaw Mini App — app.js v233 (hotfix: syntax + csv bg update + ux polish)
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
// Build
// =====================
const APP_BUILD = "235";

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


// =====================
// Важная информация — версия
// =====================
// ВАЖНО: когда вы меняете текст/условия во вкладке "Важная информация",
// просто увеличьте версию ниже. Тогда у всех клиенток статус "прочитано"
// автоматически сбросится.
const IMPORTANT_INFO_VERSION = "2026-02-01-5" // 2026-02-01-2";

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
const GA_MEASUREMENT_ID = "G-EHCT6BJYJQ";

// Инициализация gtag без inline-скриптов (чтобы CSP могла быть без 'unsafe-inline')
(function initGA4() {
  try {
    if (!GA_MEASUREMENT_ID) return;
    window.dataLayer = window.dataLayer || [];
    if (typeof window.gtag !== "function") {
      window.gtag = function gtag(){ window.dataLayer.push(arguments); };
    }
    window.gtag("js", new Date());
    window.gtag("config", GA_MEASUREMENT_ID);
  } catch {}
})();

function gaEvent(name, params = {}) {
  try {
    if (typeof window.gtag === "function") {
      const raw = params && typeof params === "object" ? params : {};
      const clean = {};
      const banRe = /(phone|tel|тел|телефон|address|адрес|fio|фио|паспорт|passport|email|e-mail)/i;
      for (const k in raw) {
        if (!Object.prototype.hasOwnProperty.call(raw, k)) continue;
        if (banRe.test(String(k))) continue;
        clean[k] = raw[k];
      }
      window.gtag("event", name, clean);
    }
  } catch {}
}


function gaItemFromProduct(p, extra = {}) {
  try {
    return {
      item_id: String(p?.id || ""),
      item_name: String(p?.name || ""),
      item_category: String(p?.product_type || ""),
      fandom_id: String(p?.fandom_id || ""),
      ...extra,
    };
  } catch {
    return { ...extra };
  }
}

function gaViewItemList(listName, items) {
  try {
    const safeItems = (items || []).slice(0, 20).map((p) => gaItemFromProduct(p));
    gaEvent("view_item_list", {
      item_list_name: String(listName || ""),
      items: safeItems,
      item_count: Number((items || []).length || 0),
    });
  } catch {}
}

function gaSelectItem(listName, p) {
  try {
    gaEvent("select_item", {
      item_list_name: String(listName || ""),
      items: [gaItemFromProduct(p)],
    });
  } catch {}
}

function gaViewItem(p, ci) {
  try {
    const unit = p ? calcItemUnitPrice(p, ci || {}) : 0;
    gaEvent("view_item", {
      currency: "RUB",
      value: Number(unit || 0),
      items: [gaItemFromProduct(p, { price: Number(unit || 0), quantity: 1 })],
    });
  } catch {}
}

function gaRemoveFromCart(p, ci, qtyDelta = 1) {
  try {
    const unit = p ? calcItemUnitPrice(p, ci || {}) : 0;
    gaEvent("remove_from_cart", {
      currency: "RUB",
      value: Number((unit || 0) * (Number(qtyDelta || 1))),
      items: [gaItemFromProduct(p, { price: Number(unit || 0), quantity: Number(qtyDelta || 1) })],
    });
  } catch {}
}

let _lastSearchEventQuery = "";
function gaSearch(query, resultsCount) {
  try {
    const q = String(query || "").trim();
    if (!q || q.length < 3) return;
    if (q === _lastSearchEventQuery) return;
    _lastSearchEventQuery = q;
    gaEvent("search", {
      search_term: q,
      results_count: Number(resultsCount || 0),
    });
  } catch {}
}

function gaAddToCart(p, ci, qtyDelta = 1) {
  try {
    const unit = p ? calcItemUnitPrice(p, ci) : 0;
    gaEvent("add_to_cart", {
      ...gaItemFromProduct(p),
      quantity: Number(qtyDelta || 1),
      price: Number(unit || 0),
      value: Number(unit || 0) * Number(qtyDelta || 1),
      currency: "RUB",
      film: String(ci?.film || ""),
      lamination: String(ci?.lamination || ""),
      pin_lamination: String(ci?.pin_lamination || ""),
      poster_pack: String(ci?.poster_pack || ""),
      poster_paper: String(ci?.poster_paper || ""),
    });
  } catch {}
}


let __gaAppOpenFired = false;
function gaAppOpen() {
  if (__gaAppOpenFired) return;
  __gaAppOpenFired = true;
  gaEvent("app_open");
}

// =====================
// Debug (safe for prod; enabled only if localStorage lespaw_debug === "1")
// =====================
const LS_DEBUG = "lespaw_debug";
function debugEnabled() {
  try { return String(localStorage.getItem(LS_DEBUG) || "") === "1"; } catch { return false; }
}
function dbg(...args) {
  try { if (debugEnabled()) console.log("[lespaw]", ...args); } catch {}
}
// =====================
// Global error guard (prevents silent blank screen in Telegram WebView)
// =====================
let _fatalShown = false;

function buildDiagPayload(err, extra) {
  try {
    const payload = {
      app_build: APP_BUILD,
      at: new Date().toISOString(),
      url: String(location.href || ""),
      ua: String(navigator.userAgent || ""),
      message: String(err?.message || err || ""),
      stack: String(err?.stack || ""),
      extra: extra ? String(extra) : "",
    };
    return JSON.stringify(payload, null, 2);
  } catch {
    return String(err || "");
  }
}

function renderFatalError(title, err, extra) {
  try {
    if (_fatalShown) return;
    _fatalShown = true;

    const msg = escapeHTML(String(err?.message || err || ""));
    const stack = debugEnabled() ? escapeHTML(String(err?.stack || "")) : "";
    const diag = debugEnabled() ? buildDiagPayload(err, extra) : "";

    view.innerHTML = `
      <div class="card">
        <div class="h2">${escapeHTML(title || "Ошибка")}</div>
        <div class="small">${msg}</div>
        ${stack ? `<div class="small mt10 prewrap opacity85">${stack}</div>` : ``}
        ${diag ? `
          <hr>
          <div class="small">Диагностика (видно только в debug)</div>
          <textarea class="diagBox" id="diagBox" readonly>${escapeHTML(diag)}</textarea>
          <div class="sp10"></div>
          <button class="btn" id="copyDiag" type="button">Скопировать диагностику</button>
        ` : ``}
        <div class="sp10"></div>
        <button class="btn" id="reloadApp" type="button">Перезапустить</button>
      </div>
    `;
    syncNav();
    syncBottomSpace();

    try {
      const btnR = document.getElementById("reloadApp");
      bindTap(btnR, () => { try { _fatalShown = false; location.reload(); } catch {} });
    } catch {}

    if (diag) {
      try {
        const btn = document.getElementById("copyDiag");
        bindTap(btn, async () => {
          try {
            const text = String(document.getElementById("diagBox")?.value || diag);
            if (navigator.clipboard?.writeText) {
              await navigator.clipboard.writeText(text);
            } else {
              const ta = document.getElementById("diagBox");
              ta?.focus();
              ta?.select();
              document.execCommand?.("copy");
            }
            toast("Диагностика скопирована", "good");
          } catch {
            toast("Не удалось скопировать — можно выделить вручную", "warn");
          }
        });
      } catch {}
    }
  } catch {}
}

try {
  window.addEventListener("error", (ev) => {
    try { renderFatalError("Ошибка приложения", ev?.error || ev?.message || ev, "window.error"); } catch {}
  });
  window.addEventListener("unhandledrejection", (ev) => {
    try { renderFatalError("Ошибка приложения", ev?.reason || ev, "unhandledrejection"); } catch {}
  });
} catch {}

// =====================
// DOM
// =====================
const view = document.getElementById("view");
const globalSearch = document.getElementById("globalSearch");
const searchClear = document.getElementById("searchClear");
const searchWrap = globalSearch ? globalSearch.closest(".searchWrap") : null;


// =====================
// Global click delegation (chips / mini actions) — reduces "forgot to bind" regressions (v232)
// =====================
if (view && !view.__lespawDelegationBound) {
  view.__lespawDelegationBound = true;

  view.addEventListener("click", (e) => {
    try {
      const t = e.target;

      // Chips: open type browse (works from any screen)
      const chip = t && t.closest ? t.closest("button.chip[data-type]") : null;
      if (chip) {
        try { e.preventDefault(); e.stopPropagation(); } catch {}
        const key = String(chip.dataset.type || "").trim();
        if (key) openTypeBrowse(key, (chip.textContent || "").trim());
        return;
      }

      // Favorite toggle (mini cards + any place using data-fav)
      const favEl = t && t.closest ? t.closest("[data-fav]") : null;
      if (favEl) {
        try { e.preventDefault(); e.stopPropagation(); } catch {}
        const id = String(favEl.getAttribute("data-fav") || "").trim();
        if (!id) return;
        try { toggleFav(id); } catch {}
        // Optimistic UI update for the clicked button
        try {
          const btn = favEl.classList && favEl.classList.contains("iconBtn") ? favEl : favEl.closest(".iconBtn");
          if (btn) {
            const active = !!isFavId(id);
            btn.classList.toggle("is-active", active);
            const g = btn.querySelector(".heartGlyph");
            if (g) g.textContent = active ? "♥" : "♡";
          }
        } catch {}
        return;
      }

      // Add to cart (mini cards + any place using data-add)
      const addEl = t && t.closest ? t.closest("[data-add]") : null;
      if (addEl) {
        try { e.preventDefault(); e.stopPropagation(); } catch {}
        const id = String(addEl.getAttribute("data-add") || "").trim();
        if (!id) return;
        try { addToCartById(id); } catch {}
        return;
      }
    } catch {}
  }, { passive: false });
}

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
// Плашка-онбординг на главной (можно скрыть)
// Флаг: ознакомилась ли пользователька с "Важной информацией"
let infoViewed = false;
try {
  const v = localStorage.getItem(LS_INFO_VIEWED);
  infoViewed = (v === IMPORTANT_INFO_VERSION);
  // поддержка старого формата: "1"
  if (!infoViewed && v === "1" && IMPORTANT_INFO_VERSION === "1") infoViewed = true;
} catch {}

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
// CloudStorage write queue (debounce + last-write-wins per key)
// Telegram WebView sometimes delivers CloudStorage writes out of order on slow networks.
// We keep only the latest value per key and flush in a small debounce window.
const __cloudPending = new Map();   // key -> value (string)
const __cloudTimers  = new Map();   // key -> timer
const __cloudWaiters = new Map();   // key -> [resolve]
const __cloudInFlight = new Set();  // key currently being written

function __cloudScheduleFlush(key, delayMs = 380) {
  try {
    if (__cloudTimers.has(key)) return;
    const t = setTimeout(() => __cloudFlushKey(key), delayMs);
    __cloudTimers.set(key, t);
  } catch {}
}

function __cloudFlushKey(key) {
  try {
    const t = __cloudTimers.get(key);
    if (t) clearTimeout(t);
  } catch {}
  __cloudTimers.delete(key);

  // If nothing pending or a write is already running — just schedule later.
  if (!__cloudPending.has(key) || __cloudInFlight.has(key)) {
    if (__cloudPending.has(key)) __cloudScheduleFlush(key, 200);
    return;
  }

  const value = __cloudPending.get(key);
  __cloudPending.delete(key);

  const waiters = __cloudWaiters.get(key) || [];
  __cloudWaiters.delete(key);

  if (!cloudAvailable()) {
    try { waiters.forEach((r) => r(false)); } catch {}
    return;
  }

  __cloudInFlight.add(key);

  try {
    tg.CloudStorage.setItem(key, value, (err) => {
      const ok = !err;
      try { waiters.forEach((r) => r(ok)); } catch {}
      __cloudInFlight.delete(key);

      // If something new arrived while writing — flush again soon.
      if (__cloudPending.has(key)) __cloudScheduleFlush(key, 120);
    });
  } catch {
    try { waiters.forEach((r) => r(false)); } catch {}
    __cloudInFlight.delete(key);
  }
}

function cloudSet(key, value) {
  return new Promise((resolve) => {
    if (!cloudAvailable()) return resolve(false);
    try {
      __cloudPending.set(key, value);
      const arr = __cloudWaiters.get(key) || [];
      arr.push(resolve);
      __cloudWaiters.set(key, arr);
      __cloudScheduleFlush(key);
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

  // Debug: show where state came from (local vs cloud)
  try {
    const cartSrc = (cloudCartN.items && cloudCartN.items.length)
      ? ((localCartN.items && localCartN.items.length)
          ? ((Number(cloudCartN.updatedAt || 0) >= Number(localCartN.updatedAt || 0)) ? "cloud" : "local")
          : "cloud")
      : "local";

    const favSrc = (cloudFavN.items && cloudFavN.items.length)
      ? ((localFavN.items && localFavN.items.length)
          ? ((Number(cloudFavN.updatedAt || 0) >= Number(localFavN.updatedAt || 0)) ? "cloud" : "local")
          : "cloud")
      : "local";

    dbg("sync cart:", cartSrc, "cloudTs=", Number(cloudCartN.updatedAt || 0), "localTs=", Number(localCartN.updatedAt || 0), "items=", Number((chosenCartN.items || []).length || 0));
    dbg("sync fav:", favSrc, "cloudTs=", Number(cloudFavN.updatedAt || 0), "localTs=", Number(localFavN.updatedAt || 0), "items=", Number((chosenFavN.items || []).length || 0));
  } catch {}

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


  // 6) синхронизация гейта "Важная информация" (храним версию; при изменениях версии статус "прочитано" сбрасывается)
  try {
    const normalizeInfoVer = (raw) => {
      if (!raw) return null;
      if (raw === "1") return "legacy";
      // может прилетать JSON {"v":"..."} или {"v":1}
      try {
        const o = JSON.parse(raw);
        const vv = o?.v;
        if (vv === 1 || vv === "1") return "legacy";
        if (typeof vv === "string") return vv;
      } catch {}
      // или сразу строка-версия
      if (typeof raw === "string") return raw;
      return null;
    };

    const cloudVer = normalizeInfoVer(cloudInfoRawStr);
    let localVer = null;
    try { localVer = localStorage.getItem(LS_INFO_VIEWED); } catch {}

    // определяем локальный статус
    infoViewed = (localVer === IMPORTANT_INFO_VERSION);

    // если облако уже содержит текущую версию — синкаем в локалку
    if (cloudVer === IMPORTANT_INFO_VERSION) {
      infoViewed = true;
      try { localStorage.setItem(LS_INFO_VIEWED, IMPORTANT_INFO_VERSION); } catch {}
      cloudSet(CS_INFO_VIEWED, JSON.stringify({ v: IMPORTANT_INFO_VERSION })).catch(() => {});
    } else if (infoViewed) {
      // если локально уже актуальная версия, а в облаке не она — обновляем облако
      cloudSet(CS_INFO_VIEWED, JSON.stringify({ v: IMPORTANT_INFO_VERSION })).catch(() => {});
    } else {
      // если в облаке legacy, а версия уже другая — считаем НЕ прочитанным (чтобы увидеть обновления)
      // ничего не делаем
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
let __toastEl = null;
function toast(msg, kind = "") {
  try { __toastEl?.remove?.(); } catch {}
  const el = document.createElement("div");
  el.className = `toast ${kind}`.trim();
  el.textContent = msg;
  el.setAttribute("role", "status");
  el.setAttribute("aria-live", "polite");
  el.setAttribute("aria-atomic", "true");
  document.body.appendChild(el);
  __toastEl = el;
  setTimeout(() => {
    if (__toastEl === el) __toastEl = null;
    el.remove();
  }, 2200);
}

// =====================
// Undo bar (for destructive actions like delete from cart)
// =====================
let __undoEl = null;
let __undoTimer = null;
function hideUndoBar() {
  try { if (__undoTimer) clearTimeout(__undoTimer); } catch {}
  __undoTimer = null;
  try { __undoEl?.remove?.(); } catch {}
  __undoEl = null;
}
function showUndoBar(text, onUndo) {
  try { hideUndoBar(); } catch {}
  const el = document.createElement("div");
  el.className = "undoBar";
  el.innerHTML = `
    <div class="undoText">${escapeHTML(String(text || ""))}</div>
    <button class="undoBtn" type="button" aria-label="Отменить действие">Отменить</button>
  `;
  document.body.appendChild(el);
  __undoEl = el;
  const btn = el.querySelector(".undoBtn");
  if (btn) {
    bindTap(btn, () => {
      try { onUndo && onUndo(); } catch {}
      hideUndoBar();
    });
  }
  __undoTimer = setTimeout(() => hideUndoBar(), 4200);
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

function postRenderEnhance() {
  try {
    const root = document;
    // 1) Безопасные обработчики изображений (вместо inline onerror — совместимо с CSP без 'unsafe-inline')
    root.querySelectorAll('img[data-hide-onerror="1"]').forEach((img) => {
      if (img.__lespawImgBound) return;
      img.__lespawImgBound = true;
      img.addEventListener("error", () => {
        try {
          const shell = img.closest(".imgShell");
          if (shell) shell.style.display = "none";
          else img.style.display = "none";
        } catch {}
      });
      img.addEventListener("load", () => {
        try {
          const shell = img.closest(".imgShell");
          if (shell) { shell.classList.add("is-loaded"); shell.classList.remove("is-loading"); }
          img.classList.add("is-loaded");
        } catch {}
      });
      // если картинка уже в кеше и успела загрузиться до бинда
      if (img.complete && img.naturalWidth > 0) {
        try {
          const shell = img.closest(".imgShell");
          if (shell) { shell.classList.add("is-loaded"); shell.classList.remove("is-loading"); }
          img.classList.add("is-loaded");
        } catch {}
      }
    });
  } catch {}
}

// =====================
// Navigation stack
// =====================
const navStack = [];
let currentRender = null;

// =====================
// In-app image viewer (modal)
// =====================
let __imgViewerEl = null;
let __imgViewerKeyHandler = null;
function openImageViewer(urls, startIndex = 0) {
  try {
    const list = (urls || []).map(String).filter(Boolean);
    if (!list.length) return;
    let idx = Math.max(0, Math.min(Number(startIndex || 0), list.length - 1));

    if (!__imgViewerEl) {
      __imgViewerEl = document.createElement("div");
      __imgViewerEl.className = "imgViewer";
      __imgViewerEl.innerHTML = `
        <div class="imgViewerBackdrop" data-close="1"></div>
        <div class="imgViewerInner" role="dialog" aria-modal="true">
          <button class="imgViewerClose" type="button" aria-label="Закрыть" data-close="1">×</button>
          <button class="imgViewerNav imgViewerPrev" type="button" aria-label="Предыдущее" data-prev="1">‹</button>
          <button class="imgViewerNav imgViewerNext" type="button" aria-label="Следующее" data-next="1">›</button>
          <div class="imgViewerStage">
            <div class="imgViewerPan" id="imgViewerPan">
              <img class="imgViewerImg" alt="Изображение товара" loading="eager" decoding="async">
            </div>
          </div>
          <div class="imgViewerZoom" aria-label="Масштаб">
            <button class="imgViewerZoomBtn" type="button" data-zoom-out="1" aria-label="Уменьшить">−</button>
            <input class="imgViewerZoomRange" type="range" min="1" max="4" step="0.05" value="1" aria-label="Масштаб" />
            <button class="imgViewerZoomBtn" type="button" data-zoom-in="1" aria-label="Увеличить">+</button>
          </div>
          <div class="imgViewerDots" aria-hidden="true"></div>
        </div>
      `;
      document.body.appendChild(__imgViewerEl);

      // close
      __imgViewerEl.addEventListener("click", (e) => {
        const t = e.target;
        if (!t) return;
        if (t.closest && t.closest("[data-close]")) closeImageViewer();
      });

      // swipe inside viewer
      let sx = 0, sy = 0, moved = false;
      __imgViewerEl.addEventListener("touchstart", (e) => {
        const p0 = e.touches && e.touches[0];
        if (!p0) return;
        sx = p0.clientX; sy = p0.clientY; moved = false;
      }, { passive: true });
      __imgViewerEl.addEventListener("touchmove", () => { moved = true; }, { passive: true });
      __imgViewerEl.addEventListener("touchend", (e) => {
        try {
          if (!moved) return;
          try { if (__imgViewerEl && __imgViewerEl.classList.contains("isZoomed")) return; } catch {}
          const p1 = e.changedTouches && e.changedTouches[0];
          if (!p1) return;
          const dx = p1.clientX - sx;
          const dy = p1.clientY - sy;
          if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
          const prevBtn = __imgViewerEl.querySelector("[data-prev]");
          const nextBtn = __imgViewerEl.querySelector("[data-next]");
          if (dx < 0) nextBtn && nextBtn.click();
          else prevBtn && prevBtn.click();
        } catch {}
      }, { passive: true });

      // zoom/pan inside viewer (pinch + double-tap + desktop wheel/drag)
      try {
        const panEl = __imgViewerEl.querySelector("#imgViewerPan");
        const zoomRange = __imgViewerEl.querySelector(".imgViewerZoomRange");
        const zoomInBtn = __imgViewerEl.querySelector("[data-zoom-in]");
        const zoomOutBtn = __imgViewerEl.querySelector("[data-zoom-out]");
        const zi = { scale: 1, tx: 0, ty: 0, min: 1, max: 4, lastTap: 0, drag: null, pinch: null };
        const apply = () => {
          if (!panEl) return;
          const s = Math.max(zi.min, Math.min(zi.scale, zi.max));
          zi.scale = s;
          panEl.style.transform = `translate3d(${zi.tx}px, ${zi.ty}px, 0) scale(${s})`;
          __imgViewerEl.classList.toggle("isZoomed", s > 1.001);
          try { if (zoomRange) zoomRange.value = String(s); } catch {}
        };
        const reset = () => { zi.scale = 1; zi.tx = 0; zi.ty = 0; zi.drag = null; zi.pinch = null; apply(); };

        const clampPan = () => {
          try {
            if (!panEl) return;
            const stage = __imgViewerEl.querySelector(".imgViewerStage");
            if (!stage) return;
            const rectS = stage.getBoundingClientRect();
            const rectP = panEl.getBoundingClientRect();
            // When zoomed, allow panning within bounds
            const overflowX = Math.max(0, (rectP.width - rectS.width) / 2);
            const overflowY = Math.max(0, (rectP.height - rectS.height) / 2);
            zi.tx = Math.max(-overflowX, Math.min(overflowX, zi.tx));
            zi.ty = Math.max(-overflowY, Math.min(overflowY, zi.ty));
          } catch {}
        };

        const dist = (t0, t1) => {
          const dx = (t1.clientX - t0.clientX);
          const dy = (t1.clientY - t0.clientY);
          return Math.sqrt(dx*dx + dy*dy);
        };
        const mid = (t0, t1) => ({ x: (t0.clientX + t1.clientX)/2, y: (t0.clientY + t1.clientY)/2 });

        const onTouchStart = (e) => {
          try {
            if (!e || !e.touches) return;
            if (e.touches.length === 2) {
              const t0 = e.touches[0], t1 = e.touches[1];
              zi.pinch = { d: dist(t0, t1), s: zi.scale, m: mid(t0, t1) };
            } else if (e.touches.length === 1) {
              const t = e.touches[0];
              zi.drag = { x: t.clientX, y: t.clientY, tx: zi.tx, ty: zi.ty };
            }
          } catch {}
        };
        const onTouchMove = (e) => {
          try {
            if (!e || !e.touches) return;
            if (e.touches.length === 2 && zi.pinch) {
              e.preventDefault();
              const t0 = e.touches[0], t1 = e.touches[1];
              const d = dist(t0, t1);
              const ratio = d / (zi.pinch.d || d || 1);
              zi.scale = Math.max(zi.min, Math.min(zi.max, (zi.pinch.s || 1) * ratio));
              apply();
              clampPan();
              apply();
              return;
            }
            if (e.touches.length === 1 && zi.drag && zi.scale > 1.001) {
              e.preventDefault();
              const t = e.touches[0];
              const dx = t.clientX - zi.drag.x;
              const dy = t.clientY - zi.drag.y;
              zi.tx = (zi.drag.tx || 0) + dx;
              zi.ty = (zi.drag.ty || 0) + dy;
              clampPan();
              apply();
            }
          } catch {}
        };
        const onTouchEnd = () => { zi.drag = null; zi.pinch = null; };

        // Double-tap to zoom
        const onTap = (e) => {
          try {
            const now = Date.now();
            const dt = now - (zi.lastTap || 0);
            zi.lastTap = now;
            if (dt > 0 && dt < 280) {
              // toggle zoom
              if (zi.scale > 1.001) reset();
              else {
                zi.scale = 2.4;
                zi.tx = 0; zi.ty = 0;
                apply();
              }
            }
          } catch {}
        };

        const stage = __imgViewerEl.querySelector(".imgViewerStage");
        if (stage) {
          stage.addEventListener("touchstart", onTouchStart, { passive: true });
          stage.addEventListener("touchmove", onTouchMove, { passive: false });
          stage.addEventListener("touchend", onTouchEnd, { passive: true });
          stage.addEventListener("click", onTap, { passive: true });

          // Desktop: mouse wheel zoom
          stage.addEventListener("wheel", (e) => {
            try {
              if (!__imgViewerEl || __imgViewerEl.style.display !== "block") return;
              e.preventDefault();
              const dy = Number(e.deltaY || 0);
              const factor = Math.exp(-dy * 0.002);
              const prev = zi.scale;
              zi.scale = Math.max(zi.min, Math.min(zi.max, zi.scale * factor));
              if (Math.abs(zi.scale - prev) < 0.0001) return;
              clampPan();
              apply();
            } catch {}
          }, { passive: false });

          // Desktop: drag to pan when zoomed
          stage.addEventListener("pointerdown", (e) => {
            try {
              if (!e) return;
              if (typeof e.button === "number" && e.button !== 0) return;
              if (zi.scale <= 1.001) return;
              e.preventDefault();
              stage.setPointerCapture && stage.setPointerCapture(e.pointerId);
              zi.drag = { x: e.clientX, y: e.clientY, tx: zi.tx, ty: zi.ty };
            } catch {}
          }, { passive: false });
          stage.addEventListener("pointermove", (e) => {
            try {
              if (!zi.drag || zi.scale <= 1.001) return;
              e.preventDefault();
              const dx = e.clientX - zi.drag.x;
              const dy = e.clientY - zi.drag.y;
              zi.tx = (zi.drag.tx || 0) + dx;
              zi.ty = (zi.drag.ty || 0) + dy;
              clampPan();
              apply();
            } catch {}
          }, { passive: false });
          stage.addEventListener("pointerup", () => { zi.drag = null; }, { passive: true });
          stage.addEventListener("pointercancel", () => { zi.drag = null; }, { passive: true });
        }

        // Zoom controls (range + +/-)
        const setScale = (s) => {
          zi.scale = Math.max(zi.min, Math.min(zi.max, Number(s || 1)));
          if (zi.scale <= 1.001) { zi.tx = 0; zi.ty = 0; }
          clampPan();
          apply();
        };
        if (zoomRange) {
          zoomRange.addEventListener("input", () => {
            try { setScale(Number(zoomRange.value || "1")); } catch {}
          }, { passive: true });
        }
        if (zoomInBtn) bindTap(zoomInBtn, () => setScale(zi.scale + 0.25));
        if (zoomOutBtn) bindTap(zoomOutBtn, () => setScale(zi.scale - 0.25));

        // expose for render() so we can reset zoom when switching images
        __imgViewerEl.__zoomReset = reset;
      } catch {}
    }

    const imgEl = __imgViewerEl.querySelector(".imgViewerImg");
    const dotsEl = __imgViewerEl.querySelector(".imgViewerDots");
    const prevBtn = __imgViewerEl.querySelector("[data-prev]");
    const nextBtn = __imgViewerEl.querySelector("[data-next]");

    const renderDots = () => {
      if (!dotsEl) return;
      if (list.length <= 1) { dotsEl.innerHTML = ""; return; }
      dotsEl.innerHTML = list.map((_, i) => `<span class="imgViewerDot ${i===idx?"is-active":""}"></span>`).join("");
    };

    const render = () => {
      try { __imgViewerEl && __imgViewerEl.__zoomReset && __imgViewerEl.__zoomReset(); } catch {}
      if (imgEl) imgEl.src = safeImgUrl(list[idx]);
      if (prevBtn) prevBtn.style.display = (list.length > 1 ? "flex" : "none");
      if (nextBtn) nextBtn.style.display = (list.length > 1 ? "flex" : "none");
      renderDots();
    };

    const step = (d) => {
      idx = (idx + d + list.length) % list.length;
      render();
    };

    if (prevBtn) prevBtn.onclick = () => step(-1);
    if (nextBtn) nextBtn.onclick = () => step(+1);

    __imgViewerEl.style.display = "block";
    document.body.classList.add("noScroll");
    // Esc to close (desktop)
    try {
      if (!__imgViewerKeyHandler) {
        __imgViewerKeyHandler = (ev) => {
          try {
            if (ev && (ev.key === "Escape" || ev.key === "Esc")) {
              closeImageViewer();
            }
          } catch {}
        };
      }
      window.addEventListener("keydown", __imgViewerKeyHandler, { passive: true });
    } catch {}
    render();
  } catch {}
}
function closeImageViewer() {
  try {
    if (!__imgViewerEl) return;
    __imgViewerEl.style.display = "none";
    document.body.classList.remove("noScroll");
    try {
      if (__imgViewerKeyHandler) window.removeEventListener("keydown", __imgViewerKeyHandler);
    } catch {}
  } catch {}
}
// =====================
// Stable scroll restore (fixes slight "jump" on back)
// =====================
function restoreScrollStable(y) {
  const target = Math.max(0, Number(y || 0));
  try {
    const apply = () => { try { window.scrollTo(0, target); } catch {} };
    requestAnimationFrame(() => {
      apply();
      requestAnimationFrame(() => {
        apply();
        setTimeout(() => {
          try {
            const now = Number(window.scrollY || 0);
            if (Math.abs(now - target) > 2) apply();
          } catch {}
        }, 120);
      });
    });
  } catch {
    try { window.scrollTo(0, target); } catch {}
  }
}


// =====================
// Last route (restore after refresh)
// =====================
const LS_LAST_ROUTE = "lespaw_last_route_v1";

let __currentRoute = { page: "home" };

function saveLastRoute(routeObj) {
  try {
    const r = routeObj && typeof routeObj === "object" ? routeObj : { page: "home" };
    localStorage.setItem(LS_LAST_ROUTE, JSON.stringify({ ts: Date.now(), route: r }));
  } catch {}
}
function loadLastRoute() {
  try {
    const raw = localStorage.getItem(LS_LAST_ROUTE);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    if (!obj || !obj.route) return null;
    return obj.route;
  } catch {
    return null;
  }
}
function setCurrentRoute(routeObj) {
  __currentRoute = (routeObj && typeof routeObj === "object") ? routeObj : { page: "home" };
  saveLastRoute(__currentRoute);
}

function restoreLastRouteIfAny() {
  const r = loadLastRoute();
  if (!r || !r.page) return false;
  // don't restore if we are already on something else (e.g., user typed search quickly)
  try {
    const q = String(globalSearch?.value || "").trim();
    if (q) return false;
  } catch {}
  try {
    const page = String(r.page || "");
    if (page === "home") {
      resetToHome();
      return true;
    }
    if (page === "category" && r.type) {
      currentRender = () => renderFandomList(String(r.type));
      syncNav();
      currentRender();
      try { postRenderEnhance(); } catch {}
      setCurrentRoute({ page: "category", type: String(r.type) });
      return true;
    }
    if (page === "thematic") {
      currentRender = () => renderThematicPage();
      syncNav();
      currentRender();
      try { postRenderEnhance(); } catch {}
      setCurrentRoute({ page: "thematic" });
      return true;
    }
    if (page === "fandom" && r.id) {
      const fid = String(r.id);
      currentRender = () => renderFandomPage(fid);
      syncNav();
      currentRender();
      try { postRenderEnhance(); } catch {}
      setCurrentRoute({ page: "fandom", id: fid });
      return true;
    }
    if (page === "favorites") {
      currentRender = renderFavorites;
      syncNav();
      currentRender();
      try { postRenderEnhance(); } catch {}
      setCurrentRoute({ page: "favorites" });
      return true;
    }
    if (page === "cart") {
      currentRender = renderCart;
      syncNav();
      currentRender();
      try { postRenderEnhance(); } catch {}
      setCurrentRoute({ page: "cart" });
      return true;
    }
    if (page === "product" && r.id) {
      const pid = String(r.id);
      currentRender = () => renderProduct(pid);
      syncNav();
      currentRender();
      try { postRenderEnhance(); } catch {}
      setCurrentRoute({ page: "product", id: pid });
      return true;
    }
  } catch {}
  return false;
}

// =====================
// Product swipe (only for "pin_single")
// =====================
let __pinSingleSwipeCtx = { ids: [], idx: -1, source: "" };
function setPinSingleSwipeContext(ids, currentId, sourceName) {
  try {
    const arr = (ids || []).map((x) => String(x)).filter(Boolean);
    const cid = String(currentId || "");
    const i = arr.indexOf(cid);
    __pinSingleSwipeCtx = { ids: arr, idx: i, source: String(sourceName || "") };
  } catch {
    __pinSingleSwipeCtx = { ids: [], idx: -1, source: "" };
  }
}
function clearPinSingleSwipeContext() {
  __pinSingleSwipeCtx = { ids: [], idx: -1, source: "" };
}
function canSwipePinSingles(currentId) {
  try {
    const cid = String(currentId || "");
    return __pinSingleSwipeCtx.ids.length > 1 && __pinSingleSwipeCtx.ids.indexOf(cid) !== -1;
  } catch { return false; }
}
function nextPinSingleId(currentId, dir) {
  try {
    const cid = String(currentId || "");
    const arr = __pinSingleSwipeCtx.ids || [];
    const i = arr.indexOf(cid);
    if (i < 0 || !arr.length) return "";
    const ni = (i + (dir > 0 ? 1 : -1) + arr.length) % arr.length;
    return arr[ni] || "";
  } catch { return ""; }
}
function replaceCurrentPage(renderFn, opts = {}) {
  if (typeof renderFn !== "function") return;
  currentRender = renderFn;
  if (opts && opts.route) setCurrentRoute(opts.route);
  syncNav();
  try { renderFn(); try { postRenderEnhance(); } catch {} } catch (err) { console.error(err); resetToHome(); return; }
  if (opts.scrollTop) scrollToTop();
  syncBottomSpace();
}


function openPage(renderFn, opts = {}) {
  if (typeof renderFn !== "function") {
    console.error("openPage: renderFn is not a function", renderFn);
    return;
  }
  if (currentRender) {
    navStack.push({
      renderFn: currentRender,
      scrollY: (typeof window !== 'undefined' ? window.scrollY : 0),
      anchorId: String(opts?.anchorId || ""),
      route: (__currentRoute && typeof __currentRoute === "object") ? __currentRoute : { page: "home" },
    });
  }
  currentRender = renderFn;
  if (opts && opts.route) setCurrentRoute(opts.route);
  syncNav();
  try { renderFn();
    try { postRenderEnhance(); } catch {}
  } catch (err) {
    console.error(err);
    try {
      const msg = String(err?.message || err || "");
      toast(debugEnabled() ? ("Ошибка экрана: " + msg) : "Ошибка экрана", "warn");
    } catch {
      toast("Ошибка экрана", "warn");
    }
    currentRender = renderHome;
  try { setCurrentRoute({ page: "home" }); } catch {}
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
  const prevFn = (prev && typeof prev === "object" && typeof prev.renderFn === "function") ? prev.renderFn : ((typeof prev === "function") ? prev : renderHome);
  const prevScroll = (prev && typeof prev === "object") ? (Number(prev.scrollY) || 0) : 0;
  const prevAnchor = (prev && typeof prev === "object") ? String(prev.anchorId || "") : "";
  currentRender = prevFn;
  try { if (prev && typeof prev === "object" && prev.route) __currentRoute = prev.route; } catch {}
  try { saveLastRoute(__currentRoute); } catch {}
  syncNav();
  try { currentRender();
    try { postRenderEnhance(); } catch {}
    try {
      if (prevAnchor) {
        const el = document.getElementById(prevAnchor);
        if (el && el.scrollIntoView) {
          requestAnimationFrame(() => {
            try { el.scrollIntoView({ block: "center", inline: "nearest" }); } catch {}
          });
        } else {
          restoreScrollStable(prevScroll);
        }
      } else {
        restoreScrollStable(prevScroll);
      }
    } catch {
      try { window.scrollTo(0, prevScroll); } catch {}
    }
  } catch (err) {
    console.error(err);
    resetToHome();
  }
  syncBottomSpace();
}

function resetToHome() {
  navStack.length = 0;
  currentRender = renderHome;
  try { setCurrentRoute({ page: "home" }); } catch {}
  if (globalSearch) globalSearch.value = "";
  syncNav();
  renderHome();
  try { postRenderEnhance(); } catch {}
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
let lastReviewsMode = "all";
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

async function fetchCSV(url, opts = {}) {
  const timeoutMs = Number(opts.timeoutMs ?? 15000);
  const controller = new AbortController();
  const t = setTimeout(() => {
    try { controller.abort(); } catch {}
  }, timeoutMs);

  let res;
  try {
    res = await fetch(url, { signal: controller.signal, cache: "no-store" });
  } catch (e) {
    const msg = (e && (e.name === "AbortError")) ? `CSV fetch timeout (${timeoutMs}ms)` : (e?.message || String(e));
    throw new Error(msg);
  } finally {
    try { clearTimeout(t); } catch {}
  }

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
    // stable key order to avoid false "changed" between parsers/engines
    const keys = Object.keys(row).sort();
    for (let i = 0; i < keys.length; i++) {
      const k = keys[i];
      h = fnv1aUpdate(h, k);
      h = fnv1aUpdate(h, row[k]);
    }
    h = fnv1aUpdate(h, "\n");
  }
  // смешаем ещё длину
  h = fnv1aUpdate(h, rows.length);
  return h >>> 0;
}

function hashRowsForCache(cacheKey, rows) {
  try {
    if (!Array.isArray(rows)) return 0;

    // Light-weight hashing for large tables (products) to reduce CPU.
    // Falls back to full hash if expected fields are not present.
    if (cacheKey === LS_CSV_CACHE_PRODUCTS) {
      const fields = ["id","sku","title","name","price","base_price","product_type","is_active","active","updated_at","updatedAt","updated","date"];
      const sample = rows[0] || {};
      const hasAny = fields.some((f) => Object.prototype.hasOwnProperty.call(sample, f));
      if (hasAny) {
        let h = 2166136261 >>> 0;
        for (let r = 0; r < rows.length; r++) {
          const row = rows[r] || {};
          for (let i = 0; i < fields.length; i++) {
            const k = fields[i];
            if (!Object.prototype.hasOwnProperty.call(row, k)) continue;
            h = fnv1aUpdate(h, k);
            h = fnv1aUpdate(h, row[k]);
          }
          h = fnv1aUpdate(h, "\n");
        }
        h = fnv1aUpdate(h, rows.length);
        return h >>> 0;
      }
    }
  } catch {}
  return hashRows(rows);
}

async function fetchCSVWithCache(url, cacheKey) {
  const cached = loadCsvCache(cacheKey);

  // If we have ANY cache (fresh or stale) — show it immediately, and refresh in background.
  if (cached && Array.isArray(cached.data)) {
    const isFresh = (Date.now() - (cached.ts || 0) < CSV_CACHE_TTL_MS);

    // background refresh (never blocks UI)
    fetchCSV(url)
      .then((fresh) => {
        try {
          const same = (hashRowsForCache(cacheKey, fresh) === hashRowsForCache(cacheKey, cached.data));
          saveCsvCache(cacheKey, fresh);
          if (!same) onCsvBackgroundUpdate(cacheKey, fresh);
        } catch {
          saveCsvCache(cacheKey, fresh);
        }
      })
      .catch((err) => {
        // If cache was stale and refresh failed — gently inform once (keeps app usable).
        try { if (!isFresh) onCsvBackgroundError(cacheKey, err); } catch {}
      });

    return cached.data;
  }

  // No cache at all: fetch normally (may throw -> init will show retry screen)
  const fresh = await fetchCSV(url);
  saveCsvCache(cacheKey, fresh);
  return fresh;
}


let _csvBgToastShown = false;
function onCsvBackgroundUpdate(cacheKey, freshData) {
  try {
    if (cacheKey === LS_CSV_CACHE_PRODUCTS) {
      products = sanitizeProducts(freshData || []);
    } else if (cacheKey === LS_CSV_CACHE_REVIEWS) {
      reviews = sanitizeReviews(freshData || []);
    } else if (cacheKey === LS_CSV_CACHE_FANDOMS) {
      fandoms = sanitizeFandoms(freshData || []);
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
      const inCheckoutFlow = (currentRender === renderCart || currentRender === renderCheckout);
      if (!inCheckoutFlow && typeof currentRender === "function") currentRender();
    } catch {}

    if (!_csvBgToastShown) {
      // Не отвлекаем во время корзины/оформления
      const inCheckoutFlow = (currentRender === renderCart || currentRender === renderCheckout);
      if (!inCheckoutFlow) {
        _csvBgToastShown = true;
        toast("Каталог обновлён ✨");
      }
    }
  } catch {}
}

let _csvBgErrorToastShown = false;
function onCsvBackgroundError(cacheKey, err) {
  try {
    if (_csvBgErrorToastShown) return;
    _csvBgErrorToastShown = true;
    console.warn(err);
    toast("Не удалось обновить каталог — показана сохранённая версия", "warn");
    dbg("csv refresh failed", { cacheKey, err: String(err || "") });
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



function isThematicTypeLabel(v) {
  const s = String(v ?? "")
    .toLowerCase()
    .replace(/[‐‑–—]/g, "-")
    .replace(/\s+/g, " ")
    .trim();
  // ловим варианты: "что-то тематическое", "что то тематическое", "тематическое", и т.п.
  return s.includes("темат");
}
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

function getOptionDefs(overlayDelta, holoDelta) {
  const od = Number(overlayDelta) || 0;
  const hd = Number(holoDelta) || 0;

  const FILM_OPTIONS = [
    ["film_glossy", FILM_LABELS.film_glossy, 0],
    ["film_holo", FILM_LABELS.film_holo, hd],
  ];

  const STICKER_LAM_OPTIONS = [
    ["none", STICKER_LAM_LABELS.none, 0],
    ["sugar", STICKER_LAM_LABELS.sugar, od],
    ["stars", STICKER_LAM_LABELS.stars, od],
    ["snowflakes_small", STICKER_LAM_LABELS.snowflakes_small, od],
    ["stars_big", STICKER_LAM_LABELS.stars_big, od],
    ["holo_overlay", STICKER_LAM_LABELS.holo_overlay, od],
  ];

  const PIN_LAM_OPTIONS = [
    ["pin_base", PIN_LAM_LABELS.pin_base, 0],
    ["sugar", PIN_LAM_LABELS.sugar, od],
    ["stars", PIN_LAM_LABELS.stars, od],
    ["snowflakes_small", PIN_LAM_LABELS.snowflakes_small, od],
    ["stars_big", PIN_LAM_LABELS.stars_big, od],
    ["holo_overlay", PIN_LAM_LABELS.holo_overlay, od],
  ];

  return {
    FILM_OPTIONS,
    STICKER_LAM_OPTIONS,
    PIN_LAM_OPTIONS,
    filmLabelByKey: Object.fromEntries(FILM_OPTIONS.map((x) => [x[0], x[1]])),
    stickerLamLabelByKey: Object.fromEntries(STICKER_LAM_OPTIONS.map((x) => [x[0], x[1]])),
    pinLamLabelByKey: Object.fromEntries(PIN_LAM_OPTIONS.map((x) => [x[0], x[1]])),
  };
}

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
    // split pins into sets vs single pieces
    if (isPinSingleType(t)) return "Значки поштучно";
    if (s.includes("набор") || s.includes("значков")) return "Набор значков";
    return "Значки";
  }

  if (k === "poster") return "Постеры";
  if (k === "box") return "Боксы";

  return raw || "";
}

function isPinSingleType(t) {
  const s = String(t || "").trim().toLowerCase();
  if (!s) return false;
  // Signals for single-piece pins
  if (s.includes("пошт")) return true; // поштучно / поштучные
  if (s.includes("по одной") || s.includes("по 1") || s.includes("1 шт")) return true;
  if (s.includes("один") && s.includes("значк")) return true;
  // If explicitly mentions "набор" — it's not single
  if (s.includes("набор")) return false;
  return false;
}

function typeGroupKey(p) {
  const base = normalizeTypeKey(p?.product_type);
  if (base === "pin") return isPinSingleType(p?.product_type) ? "pin_single" : "pin_set";
  return base;
}
// =====================
// Sanitize helpers (CSV -> стабильные структуры)
// =====================
function isActiveOrMissingFlag(v) {
  const s = String(v ?? "").trim();
  return s === "" ? true : truthy(s);
}

function sanitizeProducts(arr) {
  const out = [];
  (arr || []).forEach((p) => {
    try {
      if (!p) return;
      const id = String(p.id ?? "").trim();
      if (!id) return;
      const fandom_id = String(p.fandom_id ?? "").trim();
      const name = String(p.name ?? "").trim();
      const priceNum = Number(String(p.price ?? "").replace(",", "."));
      const price = Number.isFinite(priceNum) ? priceNum : 0;
      out.push({
        ...p,
        id,
        fandom_id,
        name,
        price,
        is_active: String(p.is_active ?? "").trim(),
        product_type: String(p.product_type ?? "").trim(),
      });
    } catch {}
  });
  return out;
}

function sanitizeFandoms(arr) {
  const out = [];
  (arr || []).forEach((f) => {
    try {
      if (!f) return;
      const fandom_id = String(f.fandom_id ?? "").trim();
      if (!fandom_id) return;
      out.push({
        ...f,
        fandom_id,
        fandom_name: String(f.fandom_name ?? f.name ?? "").trim(),
        fandom_type: String(f.fandom_type ?? "").trim(),
      });
    } catch {}
  });
  return out;
}

function sanitizeReviews(arr) {
  // reviews используются мягко; оставляем как есть, но нормализуем базовые поля
  const out = [];
  (arr || []).forEach((r) => {
    try {
      if (!r) return;
      out.push({
        ...r,
        date: String(r.date ?? "").trim(),
        author: String(r.author ?? "").trim(),
        rating: String(r.rating ?? "").trim(),
        text: String(r.text ?? "").trim(),
        photo_url: String(r.photo_url ?? "").trim(),
        source_url: String(r.source_url ?? "").trim(),
      });
    } catch {}
  });
  return out;
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
  if (s === "box" || s === "boxes" || s.includes("бокс") || s.includes("конверт") || s.includes("envelope")) return "box";

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


function favIndexesById(id){
  const sid = String(id||"").trim();
  if (!sid) return [];
  const arr = (fav || []);
  const idxs = [];
  for (let i = 0; i < arr.length; i++){
    try {
      const fi = normalizeFavItem(arr[i]);
      if (String(fi.id||"").trim() === sid) idxs.push(i);
    } catch {}
  }
  return idxs;
}

function isFavId(id){
  // Для мини-сердечек: считаем товар избранным, если в избранном есть ЛЮБОЙ вариант этого товара
  return favIndexesById(id).length > 0;
}

function removeFavAllVariants(id){
  const idxs = favIndexesById(id);
  if (!idxs.length) return false;
  const sid = String(id||"").trim();
  const next = [];
  const arr = (fav || []);
  for (let i = 0; i < arr.length; i++){
    // пропускаем все варианты этого товара
    if (idxs.includes(i)) continue;
    next.push(arr[i]);
  }
  setFav(next);
  gaEvent("remove_from_wishlist", { item_id: sid });
  gaEvent("remove_from_favorite", { item_id: sid });
  return true;
}

function toggleFavAny(id, optsForAdd){
  const sid = String(id||"").trim();
  if (!sid) return;
  if (isFavId(sid)){
    removeFavAllVariants(sid);
    toast("Убрано из избранного", "warn");
    haptic("light");
    updateBadges();
    return false;
  }
  // добавляем вариант (обычно текущие опции из полной карточки; из мини — базовый)
  const opts = optsForAdd || null;
  // напрямую добавляем (без двойных тостов)
  const next = [...(fav||[])];
  next.push({
    id: sid,
    film: String(opts?.film||""),
    lamination: String(opts?.lamination||""),
    pin_lamination: String(opts?.pin_lamination||""),
    poster_pack: String(opts?.poster_pack||""),
    poster_paper: String(opts?.poster_paper||""),
  });
  setFav(next);
  gaEvent("add_to_wishlist", { item_id: sid });
  gaEvent("add_to_favorite", { item_id: sid });
  toast("Добавлено в избранное", "ok");
  haptic("success");
  updateBadges();
  return true;
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
  const baseKey = normalizeTypeKey(p?.product_type);
  const groupKey = typeGroupKey(p);
  // options (with safe defaults)
  let film = String(opts?.film||"");
  let lamination = String(opts?.lamination||"");
  let pin_lamination = String(opts?.pin_lamination||"");
  let poster_pack = String(opts?.poster_pack||"");
  let poster_paper = String(opts?.poster_paper||"");
  if (baseKey === "sticker") {
    if (!film) film = "film_glossy";
    if (!lamination) lamination = "none";
  }
  if (groupKey === "pin_set" || groupKey === "pin_single") {
    if (!pin_lamination) pin_lamination = "pin_base";
  }
  if (baseKey === "poster") {
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
    gaAddToCart(p, { film, lamination, pin_lamination, poster_pack, poster_paper }, 1);
  } else {
    setCart([...(cart||[]), { id: sid, qty: 1, film, lamination, pin_lamination, poster_pack, poster_paper }]);
    gaAddToCart(p, { film, lamination, pin_lamination, poster_pack, poster_paper }, 1);
  }

  // подсветим бейдж корзины
  try { pulseBadge(cartCount); } catch {}

  // tactile feedback
  haptic("success");

}

function pulseBadge(el) {
  try {
    if (!el) return;
    el.classList.remove("is-pulse");
    // force reflow
    void el.offsetWidth;
    el.classList.add("is-pulse");
    setTimeout(() => { try { el.classList.remove("is-pulse"); } catch {} }, 650);
  } catch {}
}

let __pruningState = false;

function pruneState() {
  // очищаем "битые" элементы, чтобы не было странных бейджей и пустых списков
  try {
    if (__pruningState) return;
    __pruningState = true;

    // Favorites: normalize + drop unknown products + dedupe by variant key
    try {
      const norm = (fav || []).map(normalizeFavItem).filter((x) => x && x.id);
      const seen = new Set();
      const filtered = [];
      for (const it of norm) {
        if (Array.isArray(products) && products.length) {
          if (!getProductById(it.id)) continue;
        }
        const k = favKey(it.id, it);
        if (seen.has(k)) continue;
        seen.add(k);
        filtered.push(it);
      }
      if (filtered.length !== (fav || []).length) {
        // persist via setter (it will call updateBadges)
        setFav(filtered);
      }
    } catch {}

    // Cart: drop unknown products + drop qty<=0
    try {
      const normC = (cart || [])
        .map((x) => ({ ...x, qty: Math.max(0, Number(x?.qty) || 0) }))
        .filter((x) => x && x.id && (Number(x.qty) || 0) > 0);

      const filteredC = [];
      for (const it of normC) {
        if (Array.isArray(products) && products.length) {
          if (!getProductById(it.id)) continue;
        }
        filteredC.push(it);
      }
      if (filteredC.length !== (cart || []).length) {
        setCart(filteredC);
      }
    } catch {}
  } finally {
    __pruningState = false;
  }
}

function updateBadges() {
  try {
    if (!__pruningState) pruneState();
  } catch {}

  const favN = (fav || [])
    .map(normalizeFavItem)
    .filter((x) => x && x.id && (!products?.length || getProductById(x.id))).length;

  const cartN = (cart || [])
    .filter((it) => it && it.id && (!products?.length || getProductById(it.id)))
    .reduce((sum, it) => sum + (Number(it.qty) || 0), 0);

  if (favCount) {
    if (favN > 0) {
      favCount.classList.remove("isHidden");
      favCount.textContent = String(favN);
    } else favCount.classList.add("isHidden");
  }

  if (cartCount) {
    if (cartN > 0) {
      cartCount.classList.remove("isHidden");
      cartCount.textContent = String(cartN);
    } else cartCount.classList.add("isHidden");
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
  return `<img class="pcardImg" src="${safeImgUrl(u)}" alt="${escapeHTML("Фото: " + (p?.name || "товар"))}" loading="lazy" decoding="async" data-hide-onerror="1">`;
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

function shuffleArray(arr) {
  const a = [...(arr || [])];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Частый кейс: текст из таблицы, который пойдёт в innerHTML
function h(s) {
  return escapeHTML(safeText(s));
}

function setAriaInvalid(inputEl, isInvalid) {
  try {
    if (!inputEl) return;
    inputEl.setAttribute("aria-invalid", isInvalid ? "true" : "false");
  } catch {}
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


function getPhoneRule(countryId) {
  const id = String(countryId || "ru");
  const RULES = {
    ru: { cc: "+7",   ccDigits: "7",   nsn: 10, groups: [3, 3, 2, 2], example: "+7-999-123-45-67" },
    kz: { cc: "+7",   ccDigits: "7",   nsn: 10, groups: [3, 3, 2, 2], example: "+7-777-123-45-67" },
    by: { cc: "+375", ccDigits: "375", nsn: 9,  groups: [2, 3, 2, 2], example: "+375-29-123-45-67" },
    am: { cc: "+374", ccDigits: "374", nsn: 8,  groups: [2, 3, 3],    example: "+374-77-123-456" },
    kg: { cc: "+996", ccDigits: "996", nsn: 9,  groups: [3, 3, 3],    example: "+996-700-123-456" },
    uz: { cc: "+998", ccDigits: "998", nsn: 9,  groups: [2, 3, 2, 2], example: "+998-90-123-45-67" },
  };
  return RULES[id] || RULES.ru;
}

function getPhonePlaceholder(countryId) {
  return getPhoneRule(countryId).example;
}

function digitsOnly(s) {
  return String(s || "").replace(/\D+/g, "");
}

function formatPhoneByCountry(raw, countryId) {
  const rule = getPhoneRule(countryId);
  let s = String(raw || "").trim();
  if (!s) return "";

  const hasPlus = s.startsWith("+");
  let d = digitsOnly(s);

  // Special: RU/KZ users often start with 8XXXXXXXXXX
  if (rule.ccDigits === "7" && d.length >= 1 && d[0] === "8") {
    // if user entered a full national number (11 digits) starting with 8 -> replace with 7
    if (d.length >= 11) d = "7" + d.slice(1);
  }

  // Strip country code if present; we always enforce selected country
  if (d.startsWith(rule.ccDigits)) d = d.slice(rule.ccDigits.length);

  // Keep only required digits for the national number
  d = d.slice(0, rule.nsn);

  // Build groups with dashes
  const parts = [];
  let idx = 0;
  for (const g of rule.groups) {
    if (idx >= d.length) break;
    parts.push(d.slice(idx, idx + g));
    idx += g;
  }
  // If any leftover digits (shouldn't, because we truncated), append
  if (idx < d.length) parts.push(d.slice(idx));

  return rule.cc + (parts.length ? ("-" + parts.join("-")) : "");
}

// Preserve caret position while auto-formatting on input
function applyPhoneMask(inputEl, countryId) {
  // Telegram WebView can behave badly with caret math in masked inputs.
  // We use a stable "append-only" strategy: always keep caret at the end.
  try {
    if (!inputEl) return;
    const cid = countryId || inputEl?.dataset?.countryId || "ru";

    // Format based on current value and country rules (enforces max digits).
    const formatted = formatPhoneByCountry(String(inputEl.value || ""), cid);
    if (formatted !== String(inputEl.value || "")) inputEl.value = formatted;

    // Force caret to end (prevents digits mixing into +CC prefix).
    if (typeof inputEl.setSelectionRange === "function") {
      const end = inputEl.value.length;
      requestAnimationFrame(() => {
        try { inputEl.setSelectionRange(end, end); } catch {}
      });
    }
  } catch {}
}

function normalizePhoneDigitsForCountry(raw, countryId) {
  const rule = getPhoneRule(countryId);
  let s = String(raw || "").trim();
  if (!s) return "";

  const hasPlus = s.startsWith("+");
  let d = digitsOnly(s);

  // RU/KZ: 8XXXXXXXXXX -> 7XXXXXXXXXX
  if (rule.ccDigits === "7") {
    if (!hasPlus && d.length === 11 && d.startsWith("8")) d = "7" + d.slice(1);
  }

  // Enforce selected country code
  if (d.startsWith(rule.ccDigits)) d = d.slice(rule.ccDigits.length);

  // Exact required length for national part
  d = d.slice(0, rule.nsn);

  if (d.length !== rule.nsn) return "";

  return "+" + rule.ccDigits + d;
}
// ===== Shipping countries (only where Ozon / Wildberries are used in our flow) =====
const SHIPPING_COUNTRIES = [
  { id: "ru", name: "Россия",  code: "+7"   },
  { id: "kz", name: "Казахстан", code: "+7" },
  { id: "by", name: "Беларусь", code: "+375" },
  { id: "am", name: "Армения",  code: "+374" },
  { id: "kg", name: "Кыргызстан", code: "+996" },
  { id: "uz", name: "Узбекистан", code: "+998" },
];

function getCountryById(id) {
  return SHIPPING_COUNTRIES.find((c) => c.id === id) || SHIPPING_COUNTRIES[0];
}

function normalizePhoneE164(raw, countryId) {
  // STRICT: returns '+CC' + national digits (digits only), or empty string.
  return normalizePhoneDigitsForCountry(raw, countryId);
}

function isPhoneE164Like(e164) {
  const s = String(e164 || "").trim();
  if (!s) return false;
  if (!s.startsWith("+")) return false;
  const digits = s.slice(1).replace(/\D+/g, "");
  // E.164 max is 15 digits (excluding '+'). We'll require 10..15 digits for sanity.
  return digits.length >= 10 && digits.length <= 15;
}

function prettyPhone(e164) {
  // Keep as "+XXXXXXXX..." but insert spaces for readability (light formatting).
  const s = String(e164 || "").trim();
  if (!s) return "";
  if (!s.startsWith("+")) return s;
  const d = s.slice(1).replace(/\D+/g, "");
  if (!d) return "";
  // group: country code (1-3) + rest in chunks of 3/2
  // We'll do a very safe format: +CCC rest grouped by 3.
  const cc = d.length <= 11 ? d.slice(0,1) : (d.length <= 12 ? d.slice(0,2) : d.slice(0,3));
  const rest = d.slice(cc.length);
  const restGrouped = rest.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
  return "+" + cc + (restGrouped ? (" " + restGrouped) : "");
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

function safeImgUrl(u) {
  const raw = String(u ?? "").trim();
  if (!raw) return "";
  try {
    const url = new URL(raw, window.location.href);
    const p = url.protocol.toLowerCase();
    // Images should not use tg: links; allow common safe schemes for <img src>
    if (p === "http:" || p === "https:" || p === "data:" || p === "blob:") return url.href;
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
    // Treat placeholder slashes/dashes as empty (common in the sheet)
    if (!s) continue;
    if (s === "/" || s === "-" || s === "—") continue;
    return s;
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
  const groupKey = typeGroupKey(p);
  const nm = String(p?.name || "").toLowerCase();

  if (groupKey === "pin_set" || groupKey === "pin_single") {
    return isPinSingleType(p?.product_type) ? "1 значок • металл • 44 мм" : "6 значков в наборе • металл • 44 мм";
  }
  if (typeKey === "sticker") return "Лист наклеек • глянец • 16×25 см";
  if (typeKey === "poster") return "Рандомные фотопостеры • выбор формата";
  if (typeKey === "box") {
    if (nm.includes("конверт")) return "Сюрприз-конверт • компактный набор";
    return "Большой сюрприз-бокс • много наполнения";
  }
  return "";
}

function defaultFullByType(p) {
  // Use grouped type (needed to distinguish pin single vs pin set)
  const groupKey = typeGroupKey(p);
  const typeKey = normalizeTypeKey(p?.product_type);
  const baseKey = typeKey;
  const nm = String(p?.name || "").toLowerCase();

  // Pins: normalizeTypeKey() returns "pin" for both sets and single pieces,
  // so we rely on groupKey to split them.
  if (groupKey === "pin_single" || groupKey === "pin_set" || typeKey === "pin") {
    if (groupKey === "pin_single" || isPinSingleType(p?.product_type)) {
      return [
        "✨ О товаре\nЗначки по одной штуке — для тех, кто хочет конкретный дизайн без набора. Удобно комбинировать и собирать свою коллекцию, или взять один любимый.",
        "📏 Характеристики\n• Размер значка: 44 мм\n• Материал: металл\n• Крепление: булавка сзади",
      ].join("\n\n");
    }

    return [
      "✨ О товаре\nНабор из шести аккуратных значков с яркой печатью.\nХорошо подойдут для рюкзаков, сумок, курток или коллекций — лёгкие, удобные и приятные в использовании.",
      "📦 В наборе\n• 6 значков",
      "📏 Характеристики\n• Размер одного значка: 44 мм\n• Материал: металл\n• Крепление: булавка сзади",
    ].join("\n\n");
  }
  if (baseKey === "sticker") {
    return [
      "✨ О товаре\nЯркие наклейки на глянцевой плёнке с чёткой печатью.\nПодойдут для декора ноутбуков, планшетов, ежедневников и других гладких поверхностей.",
      "📏 Характеристики\n• Размер листа: 16 × 25 см\n• Материал: глянцевая плёнка",
      "⚠️ Важно\nНаклейки не вырезаны по контуру — лист идёт цельным.",
    ].join("\n\n");
  }
  if (baseKey === "poster") {
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

  // Pins: if this is a single-piece pin but CSV contains the set template — force the correct blocks.
  if (normalizeTypeKey(p?.product_type) === "pin" && isPinSingleType(p?.product_type)) {
    const t = String(fromCsv || "").toLowerCase();
    const looksLikeSet = t.includes("в наборе") || t.includes("6 значк") || t.includes("набор из шести");
    const looksLikeSingle = t.includes("по одной") || t.includes("пошт") || t.includes("1 знач");
    if (!fromCsv || looksLikeGenericDesc(fromCsv) || looksLikeSet) {
      // If CSV is empty/generic/wrong-for-single — use our single-piece template
      return applySurpriseInsideOverride((defaultFullByType(p) || fromCsv), p);
    }
    // If CSV already explicitly looks like single-piece — respect it
    if (looksLikeSingle) return applySurpriseInsideOverride(fromCsv, p);
  }
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

function openExternal(url, opts = {}) {
  const raw = String(url || "").trim();
  if (!raw) return;

  // Нормализуем и режем опасные протоколы
  let parsed = null;
  try { parsed = new URL(raw, window.location.href); } catch {}
  const href = parsed ? parsed.href : raw;

  // Разрешаем только http(s)
  const proto = (parsed?.protocol || "").toLowerCase();
  if (parsed && proto !== "http:" && proto !== "https:") {
    toast("Ссылка выглядит небезопасной и не будет открыта", "warn");
    return;
  }

  // Allow-list доменов (особенно важно для ссылок из CSV)
  const host = (parsed?.hostname || "").toLowerCase();
  const allowHosts = new Set([
    "t.me",
    "telegram.me",
    "telegram.org",
    "www.telegram.org",
    "docs.google.com",
    "spreadsheets.google.com",
    "docs.googleusercontent.com",
    "www.google-analytics.com",
    "analytics.google.com",
    "region1.google-analytics.com",
    "www.googletagmanager.com",
  ]);

  // Поддержка поддоменов googleusercontent.com
  const isAllowed = !host
    ? true
    : allowHosts.has(host) || host.endsWith(".googleusercontent.com");

  const doOpen = () => {
    try {
      if (tg?.openLink) tg.openLink(href);
      else if (tg?.openTelegramLink && href.startsWith("https://t.me/")) tg.openTelegramLink(href);
      else window.open(href, "_blank", "noopener,noreferrer");
    } catch {
      try { window.open(href, "_blank", "noopener,noreferrer"); } catch {}
    }
  };

  // Если домен неизвестен — аккуратно спрашиваем подтверждение
  if (!isAllowed) {
    const title = "Открыть внешнюю ссылку?";
    const msg = host ? `Домен: ${host}` : "Ссылка выглядит нестандартно.";
    if (tg?.showConfirm) {
      try {
        tg.showConfirm(`${title}\n${msg}`, (ok) => { if (ok) doOpen(); });
        return;
      } catch {}
    }
    try {
      if (window.confirm(`${title}\n${msg}`)) doOpen();
    } catch {
      // если confirm заблокирован WebView — просто откроем, но предупредим
      toast("Открываю внешнюю ссылку…", "");
      doOpen();
    }
    return;
  }

  doOpen();
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
    try {
      const r = handler(e);
      if (r && typeof r.then === "function") {
        r.catch((err) => {
          console.error(err);
          toast("Ошибка действия", "warn");
        });
      }
    } catch (err) {
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
// Render epoch (protect against async race)
// =====================
let renderEpoch = 0;

// =====================
// Init
// =====================

function renderLoading() {
  view.innerHTML = `
    <div class="card">
      <div class="h2">Загрузка каталога…</div>
      <div class="small">Секундочку ✨</div>
      <div class="sp12"></div>
      <div class="spinner" aria-hidden="true"></div>
      <div class="sp10"></div>
      <div class="small">Если интернет слабый — можно подождать или нажать «Повторить» на экране ошибки.</div>
    </div>
  `;
  syncNav();
  syncBottomSpace();
}

async function init() {
  const myEpoch = ++renderEpoch;

  // FIX: blur search as early as possible on nav taps (prevents backspace-like behavior)
  try {
    const earlyBlur = () => {
      try {
        if (document.activeElement === globalSearch) globalSearch.blur();
      } catch {}
    };
    navBack?.addEventListener("pointerdown", earlyBlur, { passive: true });
    navBack?.addEventListener("touchstart", earlyBlur, { passive: true });
    navHome?.addEventListener("pointerdown", earlyBlur, { passive: true });
    navHome?.addEventListener("touchstart", earlyBlur, { passive: true });
    navFav?.addEventListener("pointerdown", earlyBlur, { passive: true });
    navFav?.addEventListener("touchstart", earlyBlur, { passive: true });
    navCart?.addEventListener("pointerdown", earlyBlur, { passive: true });
    navCart?.addEventListener("touchstart", earlyBlur, { passive: true });
} catch {}
  try {
    bindTap(navBack, () => {
      // FIX: если фокус в глобальном поиске, Telegram WebView может трактовать "Назад"
      // как backspace и удалять текст по букве. Нам нужно: 1) снять фокус, 2) очистить поле,
      // 3) выполнить навигацию назад.
      try {
        // Важно: НЕ чистим поле и НЕ триггерим input — это может сбросить экран/скролл и сломать back-стек.
        if (globalSearch) globalSearch.blur();
      } catch {}
      goBack();
    });
    bindTap(navHome, () => resetToHome());
    bindTap(navFav, () => openPage(renderFavorites, { route: { page: "favorites" } }));
    bindTap(navCart, () => openPage(renderCart, { route: { page: "cart" } }));

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

    const hadCatalogFromCache = (Array.isArray(fandoms) && fandoms.length) || (Array.isArray(products) && products.length);
    if (!hadCatalogFromCache) renderLoading();
    else resetToHome(); // уже можно открыть меню

    gaAppOpen();

    // Параллельно грузим свежие CSV (быстрее, чем по очереди)
    const [fFresh, pFresh, sFresh, rFresh] = await Promise.all([
      fetchCSVWithCache(CSV_FANDOMS_URL, LS_CSV_CACHE_FANDOMS),
      fetchCSVWithCache(CSV_PRODUCTS_URL, LS_CSV_CACHE_PRODUCTS),
      fetchCSVWithCache(CSV_SETTINGS_URL, LS_CSV_CACHE_SETTINGS),
      CSV_REVIEWS_URL ? fetchCSVWithCache(CSV_REVIEWS_URL, LS_CSV_CACHE_REVIEWS) : Promise.resolve([]),
    ]);

    // If another init/render cycle started while we were fetching — ignore stale result.
    if (myEpoch !== renderEpoch) return;

    fandoms = sanitizeFandoms(fFresh || []);
    products = sanitizeProducts(pFresh || []);
    // after catalog refresh we can safely prune state against real product ids
    updateBadges();


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

    // Restore last open section after refresh (only if user has no active search)
    try {
      if (!currentRender || currentRender === renderHome) {
        if (restoreLastRouteIfAny()) {
          // restored
        }
      }
    } catch {}

    const shouldKickHomeAfterLoad = (!currentRender || currentRender === renderHome);
    if (shouldKickHomeAfterLoad) {
      try {
        const q = String(globalSearch?.value || "").trim();
        if (!q) resetToHome();
      } catch {}
    }

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
        <div class="sp10"></div>
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
    try { 
// =====================
// CloudStorage: принудительный flush при уходе/сворачивании (чтобы не потерять быстрые изменения)
// =====================
function cloudFlushAll() {
  try {
    Array.from(__cloudPending.keys()).forEach((k) => {
      try { __cloudFlushKey(k); } catch {}
    });
  } catch {}
}

try {
  document.addEventListener("visibilitychange", () => {
    try { if (document.hidden) cloudFlushAll(); } catch {}
  });
  window.addEventListener("pagehide", () => {
    try { cloudFlushAll(); } catch {}
  });
} catch {}

init(); } catch (e) {
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
    bindTap(el, () => openPage(() => renderFandomList(el.dataset.type), { route: { page: "category", type: String(el.dataset.type) } }));
  });

  syncNav();
  syncBottomSpace();
}

// =====================
// Список фандомов (алфавит + цифры в конце)
// =====================
function renderFandomList(type) {
  // Спец-логика: "Что-то тематическое" — показываем товары сразу, без выбора фандома
  if (isThematicTypeLabel(type) || String(type || "") === "Что-то тематическое") {
    return renderThematicPage();
  }
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

      ${digits.length ? `<hr><div class="small mt6">0–9</div>${renderGrid(digits)}` : ``}
    </div>
  `;

  view.querySelectorAll("[data-id]").forEach((el) => {
    bindTap(el, () => openPage(() => renderFandomPage(el.dataset.id)));
  });

  syncNav();
  syncBottomSpace();
}

// =====================

// =====================
// Быстрый просмотр по типам (чипсы) — по 20 товаров + "Показать ещё"
// =====================
const TYPE_BROWSE_PAGE_SIZE = 20;
let typeBrowseState = { key: "", title: "", offset: 0 };

function typeTitleByKey(k) {
  const key = String(k || "");
  if (key === "sticker") return "Наклейки";
  if (key === "poster") return "Постеры";
  if (key === "box") return "Боксы";
  if (key === "pin_single") return "Значки поштучно";
  if (key === "pin_set") return "Наборы значков";
  return "Товары";
}

function openTypeBrowse(typeKey, title) {
  typeBrowseState = { key: String(typeKey || ""), title: String(title || typeTitleByKey(typeKey)), offset: 0 };
  openPage(() => renderTypeBrowsePage());
}

function renderTypeBrowsePage() {
  const key = String(typeBrowseState.key || "");
  const title = String(typeBrowseState.title || typeTitleByKey(key));
  try { setCurrentRoute({ page: "type", key }); } catch {}

  const all = (products || [])
    .filter((p) => isActiveOrMissingFlag(p?.is_active))
    .filter((p) => typeGroupKey(p) === key);

  // analytics
  try { gaViewItemList(`type:${key}`, all); } catch {}

  const start = 0;
  const end = Math.min(all.length, (typeBrowseState.offset || 0) + TYPE_BROWSE_PAGE_SIZE);
  const shown = all.slice(start, end);

  view.innerHTML = `
    <div class="card">
      <div class="h2">${h(title)}</div>
      <div class="small">Показано ${shown.length} из ${all.length}</div>
    </div>

    ${all.length ? `
      <div class="card">
        <div class="grid2">
          ${shown.map((p) => `
            <div class="pcard" id="p_${p.id}" data-id="${p.id}">
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
          `).join("")}
        </div>

        ${(end < all.length) ? `
          <div class="mt12" style="display:flex; justify-content:center;">
            <button class="btn" id="typeShowMore" type="button">Показать ещё</button>
          </div>
        ` : ``}
      </div>
    ` : `
      <div class="card"><div class="small">Пока нет товаров этого типа.</div></div>
    `}
  `;

  // bind cards
  view.querySelectorAll(".pcard[data-id]").forEach((el) => {
    bindTap(el, (e) => {
      const t = e?.target;
      if (t && (t.closest("button") || t.tagName === "BUTTON")) return;
      const pid = String(el.dataset.id || "");
      openPage(() => renderProduct(pid), { anchorId: String(el.id || `p_${pid}`) });
    });
  });

  // actions
  view.querySelectorAll("[data-fav]").forEach((b) => {
    bindTap(b, (e) => {
      try { e?.stopPropagation?.(); } catch {}
      const id = String(b.dataset.fav || "");
      toggleFav(id);
      try {
        const heart = b.querySelector(".heartGlyph");
        if (heart) heart.textContent = isFavId(id) ? "♥" : "♡";
        b.classList.toggle("is-active", isFavId(id));
      } catch {}
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

  const moreBtn = view.querySelector("#typeShowMore");
  if (moreBtn) {
    bindTap(moreBtn, () => {
      typeBrowseState.offset = (typeBrowseState.offset || 0) + TYPE_BROWSE_PAGE_SIZE;
      renderTypeBrowsePage();
    });
  }

  syncNav();
  syncBottomSpace();
}
// =====================
// "Что-то тематическое" -> товары сразу (без выбора фандома)
// =====================
function renderThematicPage() {
  try { setCurrentRoute({ page: "thematic" }); } catch {}

  const WANT_TYPE = "Что-то тематическое";
  const norm = (v) => String(v ?? "").trim();
  const normSpace = (s) => norm(s).replace(/\s+/g, " ").trim();
  const isThematicType = (v) => normSpace(v).toLowerCase() === normSpace(WANT_TYPE).toLowerCase();

  // Таблицы — источник истины:
  // находим фандом(ы) с fandom_type="Что-то тематическое" и показываем ТОЛЬКО товары, привязанные к ним через fandom_id.
  const thematicIds = new Set(
    (fandoms || [])
      .filter((f) => isThematicType(f?.fandom_type))
      .map((f) => String(f?.fandom_id || f?.id || "").trim())
      .filter(Boolean)
  );

  const allRaw = (products || [])
    .filter((p) => isActiveOrMissingFlag(p?.is_active))
    .filter((p) => thematicIds.has(String(p?.fandom_id || "").trim()));

  // Analytics: list view
  try { gaViewItemList("thematic", allRaw); } catch {}

  const groupsOrder = [
    { key: "sticker", title: "Наклейки" },
    { key: "pin_set", title: "Наборы значков" },
    { key: "pin_single", title: "Значки поштучно" },
    { key: "poster", title: "Постеры" },
    { key: "box", title: "Боксы / конверты" },
  ];

  const grouped = groupsOrder
    .map((g) => ({ ...g, items: allRaw.filter((p) => typeGroupKey(p) === g.key) }))
    .filter((g) => g.items.length > 0);

  view.innerHTML = `
    <div class="card">
      <div class="h2">Что-то тематическое <span class="inlineBadge">витрина</span></div>
      <div class="small">Товары по группам</div>
    </div>

    ${grouped.length ? grouped.map((g) => `
      <div class="card">
        <div class="h3">${h(g.title)}</div>
        <div class="grid2 mt12">
          ${g.items.map((p) => `
            <div class="pcard" id="p_${p.id}" data-id="${p.id}">
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
          `).join("")}
        </div>
      </div>
    `).join("") : `
      <div class="card"><div class="small">Пока нет товаров в этой категории.</div></div>
    `}
  `;

  // bind cards
  view.querySelectorAll(".pcard[data-id]").forEach((el) => {
    bindTap(el, (e) => {
      const t = e?.target;
      if (t && (t.closest("button") || t.tagName === "BUTTON")) return;
      const pid = String(el.dataset.id || "");
      openPage(() => renderProduct(pid), { anchorId: String(el.id || `p_${pid}`) });
    });
  });

  // actions
  view.querySelectorAll("[data-fav]").forEach((b) => {
    bindTap(b, (e) => {
      try { e?.stopPropagation?.(); } catch {}
      const id = String(b.dataset.fav || "");
      toggleFav(id);
      // обновим сердечки без полной перерисовки
      view.querySelectorAll(`[data-fav="${id}"]`).forEach((x) => {
        const active = isFavId(id);
        x.classList.toggle("is-active", active);
        const g = x.querySelector(".heartGlyph");
        if (g) g.textContent = active ? "♥" : "♡";
      });
    });
  });
  view.querySelectorAll("[data-add]").forEach((b) => {
    bindTap(b, (e) => {
      try { e?.stopPropagation?.(); } catch {}
      const id = String(b.dataset.add || "");
      addToCartById(id);
      toast("Добавлено в корзину", "good");
      // лёгкое обновление бейджей
      syncNav();
    });
  });

  syncNav();
  syncBottomSpace();
}


// Страница фандома -> товары сеткой 2x (с фото)
// =====================
function renderFandomPage(fandomId) {
  try { setCurrentRoute({ page: "fandom", id: String(fandomId || "") }); } catch {}
  const f = getFandomById(fandomId);
  const all = products.filter((p) => p.fandom_id === fandomId);

  // Analytics: list view
  try { gaViewItemList(`fandom:${String(f?.fandom_name || f?.name || fandomId || "")}`, all); } catch {}

const groupsOrder = [
  { key: "sticker", title: "Наклейки" },
  { key: "pin_set", title: "Наборы значков" },
  { key: "pin_single", title: "Значки поштучно" },
  { key: "poster", title: "Постеры" },
  { key: "box", title: "Боксы / конверты" },
];
  const knownKeys = new Set(groupsOrder.map((g) => g.key));

  const grouped = groupsOrder
    .map((g) => ({ ...g, items: all.filter((p) => typeGroupKey(p) === g.key) }))
    .filter((g) => g.items.length > 0);

  const pinSingleIds = (grouped.find((g) => g.key === "pin_single")?.items || []).map((x) => String(x.id));

  const other = all.filter((p) => !knownKeys.has(typeGroupKey(p)));
  if (other.length) grouped.push({ key: "other", title: "Другое", items: other });

  const sectionHtml = (title, items) => {
    const cards = items
      .map(
        (p) => `
          <div class="pcard" id="p_${p.id}" data-id="${p.id}">
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
        <div class="grid2 mt10">${cards}</div>
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

      // Analytics: select item
      try {
        const pid = String(el.dataset.id || "");
        const pp = getProductById(pid);
        gaSelectItem(`fandom:${String(f?.fandom_name || f?.name || fandomId || "")}`, pp);
      } catch {}

      // Контекст листания: только для «значков поштучно»
      try {
        const pid = String(el.dataset.id || "");
        const pp = getProductById(pid);
        if (pp && typeGroupKey(pp) === "pin_single") setPinSingleSwipeContext(pinSingleIds, pid, `fandom:${String(f?.fandom_name || f?.name || fandomId || "")}`);
        else clearPinSingleSwipeContext();
      } catch { clearPinSingleSwipeContext(); }

      const pid = String(el.dataset.id || "");
      openPage(() => renderProduct(pid), { anchorId: String(el.id || `p_${pid}`) });
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
        const active = isFavId(id);
        x.classList.toggle("is-active", active);
        try { x.setAttribute("aria-pressed", active ? "true" : "false"); } catch {}
        const g = x.querySelector(".heartGlyph");
        if (g) g.textContent = active ? "♥" : "♡";
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
  try { localStorage.setItem(LS_INFO_VIEWED, IMPORTANT_INFO_VERSION); } catch {}
  cloudSet(CS_INFO_VIEWED, JSON.stringify({ v: IMPORTANT_INFO_VERSION })).catch(() => {});
  view.innerHTML = `
    <div class="card">
      <div class="h2">Важная информация</div>
      <div class="small infoLead">Пожалуйста, ознакомься с этой информацией перед оформлением заказа.</div>

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
            <li>Менеджерка проверяет состав заказа, варианты покрытия и доставку.</li>
            <li>После проверки ты получаешь сообщение с <b>итоговой суммой оплаты, включая доставку</b>.</li>
            <li><b>Оплата производится только после этого сообщения.</b></li>
          </ul>
        
        <div class="infoSection">
          <div class="infoTitle">Оплата и валюта</div>
          <ul class="infoList">
            <li>Цены в приложении указаны <b>в российских рублях</b>.</li>
            <li>Для заказов из других стран итоговая сумма к оплате рассчитывается менеджеркой индивидуально.</li>
            <li><b>Для заказов из других стран способ оплаты согласуется с менеджеркой индивидуально.</b></li>
          </ul>
        </div>
</div>

        <div class="infoSection">
          <div class="infoTitle">Сроки изготовления и доставки</div>
          <ul class="infoList">
            <li>Сборка заказа: <b>4–7 дней</b> (зависит от объёма заказа и от загруженности).</li>
            <li>Доставка: <b>от 7 дней</b> (зависит от расстояния между городами; более точный срок можно уточнить у менеджерки).</li>
          </ul>
          <div class="infoNote">Сроки могут немного меняться в периоды повышенной нагрузки.</div>
        </div>

        <div class="infoSection">
          <div class="infoTitle">Доставка и пункты выдачи</div>
          <div class="infoNote">Мы отправляем заказы через выбранный при оформлении пункт выдачи.</div>
          <ul class="infoList">
            <li>Пункты выдачи: <b>Яндекс / 5Post / Ozon / Wildberries</b></li>
            <li>Срок хранения заказа в пункте выдачи — <b>6 дней</b> (может зависеть от выбранного сервиса).</li>
          </ul>
        </div>

        <div class="infoSection">
          <div class="infoTitle">Ozon и Wildberries</div>
          <ul class="infoList">
            <li>Для Ozon/Wildberries <b>обязательно</b> укажи <b>страну доставки</b>.</li>
            <li>Для Ozon/Wildberries <b>обязательно</b> укажи <b>номер телефона</b>, на который зарегистрирован аккаунт получателя.</li>
            <li>Этот номер используется для оформления и получения заказа.</li>
          </ul>
          <div class="infoNote">Если номер телефона не соответствует аккаунту получателя в выбранном ПВЗ, получение заказа может быть невозможно.</div>
        </div>

        <div class="infoSection">
          <div class="infoTitle">Номер телефона</div>
          <ul class="infoList">
            <li>Номер телефона <b>обязателен</b>.</li>
            <li>Указывается в <b>международном формате</b> с кодом страны.</li>
            <li>Для Ozon/Wildberries номер должен совпадать с номером аккаунта получателя.</li>
          </ul>
        </div>

        <div class="infoSection">
          <div class="infoTitle">Страны доставки (Ozon / Wildberries)</div>
          <ul class="infoList">
            <li>Россия</li>
            <li>Казахстан</li>
            <li>Беларусь</li>
            <li>Армения</li>
            <li>Кыргызстан</li>
            <li>Узбекистан</li>
          </ul>
          <div class="infoNote">Выбор страны доставки обязателен.</div>
        </div>

        <div class="infoSection">
          <div class="infoTitle">Возврат и обмен</div>
          <ul class="infoList">
            <li>Все изделия изготавливаются <b>под заказ</b>, стандартный возврат не предусмотрен.</li>
            <li>Если возникнут вопросы по качеству — мы обязательно обсудим ситуацию и постараемся найти решение.</li>
          </ul>
        </div>

        <div class="infoSection">
          <div class="infoTitle">Печать и внешний вид изделий</div>
          <ul class="infoList">
            <li>Печать выполняется <b>струйным способом</b>.</li>
            <li>Цвета на экране и вживую могут немного отличаться.</li>
            <li>При длительном воздействии света печать со временем может терять насыщенность — это не считается браком.</li>
          </ul>
        </div>

        <div class="infoSection">
          <div class="infoTitle">Индивидуальные заказы и вопросы</div>
          <ul class="infoList">
            <li>Если ты ищешь товары с фандомом, которого нет в ассортименте, мы можем сделать их <b>под заказ</b>.</li>
            <li>По любым вопросам можно написать менеджерке.</li>
          </ul>
          <button class="btn btnInline" id="btnManager">Написать менеджерке</button>

        </div>
      </div>

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
  let mode = (lastReviewsMode || "all"); // all | photos | 5

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
                     <img class="reviewPhoto" src="${safeImgUrl(r.photo_url)}" alt="Фото отзыва" loading="lazy" decoding="async" data-hide-onerror="1">
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
                          const txtHtml = escapeHTML(txt).replace(/\n/g, "<br>");
                          const showMore = txt.length > 180; // эвристика: если отзыв длинный — показываем подсказку
                          return `
                            <div class="reviewTextWrap">
                              <div class="reviewText" data-expand="${idx}">${txtHtml}</div>
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
      : `<div class="small mt6">Пока нет отзывов для отображения в этом режиме.</div>`;

    const moreBtn =
      (mode === "all" ? reviewsVisibleCount < all.length : reviewsVisibleCount < all.filter((r) => (mode === "photos" ? !!r.photo_url : (Number(r.rating) || 0) >= 5)).length)
        ? `<button class="btn" id="revMore">Показать ещё</button>`
        : `
          <div class="emptyState">
            <div class="emptyTitle">${(Array.isArray(reviews) && reviews.length) ? "Ничего не найдено по фильтру" : "Отзывов пока нет"}</div>
            <div class="emptyText small">${(Array.isArray(reviews) && reviews.length) ? "Попробуй другой фильтр или сбрось его." : "Если ты уже покупала — очень поможешь, если оставишь отзыв 💜"}</div>
            ${mode !== "all" ? `<div class="sp12"></div><button class="btn is-active" id="revReset" type="button">Сбросить фильтр</button>` : ``}
          </div>
        `;

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
            : `<div class="small mt10">Подключи CSV-лист reviews — и отзывы будут отображаться прямо здесь.</div>`
        }

        ${listHtml}

        ${moreBtn ? `<div class="row mt12">${moreBtn}</div>` : ``}

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
        lastReviewsMode = mode;
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

    document.getElementById("revReset")?.addEventListener("click", () => {
      mode = "all";
      reviewsVisibleCount = 8;
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
            ? `<img class="exImg" src="${safeImgUrl(img)}" alt="${h(ex.title)}" loading="lazy" decoding="async" data-hide-onerror="1">`
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
      <div class="small mt6">Основа наклейки: задаёт блеск, текстуру и «характер» сразу.</div>
      ${renderGrid(films)}

      <hr>
      <div class="h3">Ламинация</div>
      <div class="small mt6">Прозрачное покрытие сверху — добавляет эффект и защищает поверхность.</div>
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
      ${ex.description ? `<div class="small mt8">${h(ex.description)}</div>` : ``}

      <hr>

      ${
        imgs.length
          ? `<div class="exBig">
              ${imgs
                .map(
                  (u) => `
                <div class="exBigBtn cursorDefault">
                  <img class="exBigImg" src="${safeImgUrl(u)}" alt="${h(ex.title)}" loading="lazy" decoding="async" data-hide-onerror="1">
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
  const queryRaw = (q || "").trim();
  const query = queryRaw.toLowerCase().trim();

  // Treat "Значки/Боксы/Наклейки/Постеры" (любой язык/форма) as type-filter searches.
  // Important: we only accept known type keys, otherwise it would hijack normal searches.
  const qKey = normalizeTypeKey(query);
  const isTypeQuery = qKey === "sticker" || qKey === "pin" || qKey === "poster" || qKey === "box";

  const shortQuery = !isTypeQuery && query.length < 3;

  const fHits =
    shortQuery || isTypeQuery
      ? []
      : fandoms
          .filter((f) => truthy(f.is_active))
          .filter((f) => (f.fandom_name || "").toLowerCase().includes(query))
          .slice(0, 20);

  const rawPHits = shortQuery
    ? []
    : products
        .filter((p) => {
          if (isTypeQuery) return normalizeTypeKey(p.product_type) === qKey;

          const typeName = String(p.product_type || "");
          const typeRu = `${typeLabel(typeName)} ${typeLabelDetailed(typeName)}`;
          const hay = `${p.name || ""} ${p.description_short || ""} ${p.tags || ""} ${typeName} ${typeRu}`.toLowerCase();
          return hay.includes(query);
        })
        .slice(0, isTypeQuery ? 300 : 120);

  // Analytics: list view (search)
  try { if (!shortQuery) gaViewItemList(`search:${query}`, rawPHits); } catch {}
  try { if (!shortQuery) gaSearch(queryRaw, (fHits.length + rawPHits.length)); } catch {}

const groupsOrder = [
  { key: "sticker", title: "Наклейки" },
  { key: "pin_set", title: "Наборы значков" },
  { key: "pin_single", title: "Значки поштучно" },
  { key: "poster", title: "Постеры" },
  { key: "box", title: "Боксы / конверты" },
];
  const knownKeys = new Set(groupsOrder.map((g) => g.key));

  const grouped = groupsOrder
    .map((g) => ({ ...g, items: rawPHits.filter((p) => typeGroupKey(p) === g.key) }))
    .filter((g) => g.items.length > 0);

  const pinSingleIds = (grouped.find((g) => g.key === "pin_single")?.items || []).map((x) => String(x.id));

  const other = rawPHits.filter((p) => !knownKeys.has(typeGroupKey(p)));
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
      <div class="fGroup mt12">
        <div class="h3">${title}</div>
        <div class="grid2 mt10">${cards}</div>
      </div>
    `;
  };

  view.innerHTML = `
    <div class="card">
      <div class="h2">Поиск: “${h(q)}”</div>
      ${shortQuery ? `
        <div class="emptyState">
          <div class="emptyTitle">Введи минимум 3 символа</div>
          <div class="emptyText small">Так поиск будет точнее и не будет лагать на больших списках.</div>
          <div class="chips mt12">
            <button class="chip" data-type="sticker" type="button">Наклейки</button>
            <button class="chip" data-type="pin_single" type="button">Значки поштучно</button>
            <button class="chip" data-type="pin_set" type="button">Наборы значков</button>
            <button class="chip" data-type="poster" type="button">Постеры</button>
            <button class="chip" data-type="box" type="button">Боксы</button>
          </div>
        </div>
      ` : ``}
      ${(!fHits.length && !rawPHits.length) ? `
        <div class="emptyState">
          <div class="emptyTitle">Ничего не найдено</div>
          <div class="emptyText small">Попробуй другое слово или проверь раскладку. Можно искать по фандому, названию товара или ключевым словам.</div>
        </div>
      ` : ``}

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
      openPage(() => renderProduct(String(el.dataset.id||"")), { anchorId: String(el.id || (`p_${String(el.dataset.id||"")}`)) });
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

  // быстрые чипсы поиска
  view.querySelectorAll("[data-sq]").forEach((b) => {
    bindTap(b, (e) => {
      e.stopPropagation();
      const q2 = String(b.dataset.sq || "");
      if (!q2) return;
      try { globalSearch.value = q2; } catch {}
      try {
        if (searchWrap) searchWrap.classList.add("hasText");
      } catch {}
      try { globalSearch.dispatchEvent(new Event("input", { bubbles: true })); } catch {
        openPage(() => renderSearch(q2));
      }
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

  

  // быстрые чипсы типов товаров (на экране поиска/пустых состояний)
  view.querySelectorAll(".chip[data-type]").forEach((btn) => {
    bindTap(btn, (e) => {
      try { e?.stopPropagation?.(); } catch {}
      const key = String(btn.dataset.type || "").trim();
      if (!key) return;
      openTypeBrowse(key, (btn.textContent || "").trim());
    });
  });
  // открыть похожие товары
  view.querySelectorAll(".pcard[data-id]").forEach((el) => {
    bindTap(el, (e) => {
      const t = e.target;
      if (t && (t.closest("button") || t.tagName === "BUTTON")) return;
      const id = String(el.dataset.id || "");
      if (!id) return;
      openPage(() => renderProduct(String(id||"")), { anchorId: String(el?.id || (`p_${String(id||"")}`)) });
    });
  });

syncNav();
  syncBottomSpace();
}


// =====================
// Product page (полная карточка)
// =====================
function renderProduct(productId, prefill) {
  try { setCurrentRoute({ page: "product", id: String(arguments[0] || "") }); } catch {}
  try {
  const p = getProductById(productId);
  if (!p) {
    view.innerHTML = `<div class="card"><div class="h2">Товар не найден</div></div>`;
    syncNav();
    syncBottomSpace();
    return;
  }

  // Analytics
  try {
    gaViewItem(p, prefill || {});
  } catch {}
const fandom = getFandomById(p.fandom_id);
  const img = firstImageUrl(p);

  const overlayDelta = Number(settings.overlay_price_delta) || 100;
  const holoDelta = Number(settings.holo_base_price_delta) || 100;

  const groupKey = typeGroupKey(p); // sticker | pin_set | pin_single | poster | box | ...
  const baseKey = normalizeTypeKey(p?.product_type); // sticker | pin | poster | box | ...
  const isSticker = groupKey === "sticker";
  // Похожие товары: из этого же фандома и/или этого же типа
  const sameFandom = (products || []).filter((x) => String(x.fandom_id) === String(p.fandom_id) && String(x.id) !== String(p.id));
  const sameType = (products || []).filter((x) => typeGroupKey(x) === groupKey && String(x.id) !== String(p.id));
  const pickFew = (arr, n) => arr.slice(0, n);
  const similarFandom = pickFew(shuffleArray(sameFandom), 4);
  const similarType = pickFew(shuffleArray(sameType.filter((x)=> String(x.fandom_id) !== String(p.fandom_id))), 4);

  const isPin = baseKey === "pin";
  const isPinSingle = groupKey === "pin_single";
  const isPinSet = groupKey === "pin_set";
  const isPoster = groupKey === "poster";

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


  const { FILM_OPTIONS, STICKER_LAM_OPTIONS, PIN_LAM_OPTIONS } = getOptionDefs(overlayDelta, holoDelta);
  const PIN_LAM_OPTIONS_EFFECTIVE = isPinSingle ? PIN_LAM_OPTIONS.map(([k,l,_d]) => [k,l,0]) : PIN_LAM_OPTIONS;

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
      const lamOpt = PIN_LAM_OPTIONS_EFFECTIVE.find((x) => x[0] === selectedPinLam);
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

  function renderOptionPanel(title, rows, selectedKey, hintText) {
    return `
      <div class="optPanel">
        <div class="optTitle"><b>${title}</b></div>
        ${hintText ? `<div class="optHint">${hintText}</div>` : ``}
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

  function pulsePriceUI() {
    try {
      const priceEl = document.getElementById("prodPriceVal");
      const btnEl = document.getElementById("btnCart");
      if (priceEl) {
        priceEl.classList.remove("pricePulse");
        void priceEl.offsetWidth;
        priceEl.classList.add("pricePulse");
        setTimeout(() => { try { priceEl.classList.remove("pricePulse"); } catch {} }, 340);
      }
      if (btnEl) {
        btnEl.classList.remove("pricePulseBtn");
        void btnEl.offsetWidth;
        btnEl.classList.add("pricePulseBtn");
        setTimeout(() => { try { btnEl.classList.remove("pricePulseBtn"); } catch {} }, 340);
      }
    } catch {}
  }

  function render(pulse = false) {
    const inFavNow = isFavId(p.id);
    const priceNow = calcPrice();

    view.innerHTML = `
      <div class="card">
        <div class=\"prodHead\">
          <div>
            <div class=\"h2\">${h(p.name)}</div>
            <div class=\"small\">${fandom?.fandom_name ? `<b>${h(fandom.fandom_name)}</b> · ` : ""}${typeLabelDetailed(p.product_type)}</div>
          </div>
          ${ (isPinSingle && canSwipePinSingles(p.id)) ? `
            <div class=\"prodSwipeCtrls\" aria-label=\"Листать значки\">
              <button class=\"prodSwipeBtn\" id=\"prodPrev\" type=\"button\" aria-label=\"Предыдущий значок\">‹</button>
              <button class=\"prodSwipeBtn\" id=\"prodNext\" type=\"button\" aria-label=\"Следующий значок\">›</button>
            </div>
          ` : `` }
        </div>
        ${ (isPinSingle && canSwipePinSingles(p.id) && !loadJSON("lespaw_pin_swipe_hint_v1", false)) ? `<div class=\"swipeHint\" id=\"pinSwipeHint\">Свайпни ← → чтобы листать значки</div>` : `` }

        <div class="prodPrice" id="prodPriceVal">${money(priceNow)}</div>

        ${img ? `<img class=\"thumb mt12\" id=\"prodMainImg\" src=\"${safeImgUrl(img)}\" alt=\"${escapeHTML('Фото: ' + (p?.name || 'товар'))}\" loading=\"lazy\" decoding=\"async\" data-hide-onerror=\"1\">` : ''}

        ${getFullDesc(p) ? `<div class="descBlocks mt10">${renderTextBlocks(isPoster ? stripPosterStaticChoiceBlocks(getFullDesc(p)) : getFullDesc(p))}</div>` : ""}

        ${
          isPoster
            ? `
              <div class="sp10"></div>
              ${renderOptionPanel("Варианты наборов", POSTER_PACKS, selectedPosterPack)}
              <div class="sp10"></div>
              ${renderOptionPanel("Бумага для печати", POSTER_PAPERS, selectedPosterPaper)}
            `
            : ""
        }

        ${(isSticker || isPin || isPoster) ? `<hr>` : ``}

        ${
          isSticker
            ? `
              ${renderOptionPanel("Плёнка", FILM_OPTIONS, selectedFilm)}
              <div class="sp10"></div>
              ${renderOptionPanel("Ламинация", STICKER_LAM_OPTIONS, selectedStickerLam)}
              <div class="sp10"></div>
              <button class="btn btnGhost" id="btnExamples" type="button">Посмотреть примеры плёнки и ламинации</button>
            `
            : ""
        }

        ${
          isPin
            ? `
              ${renderOptionPanel("Ламинация", PIN_LAM_OPTIONS_EFFECTIVE, selectedPinLam, isPinSingle ? "Ламинация для поштучных значков бесплатная — можно выбрать эффект дополнительно ✨" : "")}
              <div class="sp10"></div>
              <button class="btn btnGhost" id="btnExamples" type="button">Посмотреть примеры ламинации</button>
            `
            : ""
        }

        <hr>

        <div class="row gap10">
  <button class="btn btnIcon" id="btnFav" type="button" aria-label="В избранное" aria-pressed="${inFavNow ? "true" : "false"}">
    <span class="heartGlyph">${inFavNow ? "♥" : "♡"}</span>
  </button>
  <button class="btn is-active" id="btnCart" type="button">Добавить в корзину · ${money(priceNow)}</button>
</div>
      </div>
    `;

    const btnFav = document.getElementById("btnFav");
    const btnCart = document.getElementById("btnCart");
    const btnExamples = document.getElementById("btnExamples");

    if (pulse) {
      haptic("select");
      pulsePriceUI();
    }

    if (btnFav) {
      bindTap(btnFav, () => {
        toggleFavAny(p.id, currentOpts());
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
          const before = calcPrice();
          const key = b.dataset.opt;
          if (isSticker && title === "Плёнка") selectedFilm = key;
          else if (isSticker && title === "Ламинация") selectedStickerLam = key;
          else if (isPin && title === "Ламинация") selectedPinLam = key;
          else if (isPoster && title === "Варианты наборов") selectedPosterPack = key;
          else if (isPoster && title === "Бумага для печати") selectedPosterPaper = key;
          const after = calcPrice();
          render(after !== before);
        });
      });
    });

    if (btnExamples) {
      bindTap(btnExamples, () => openExamples());
    }

    const prodImgEl = document.getElementById('prodMainImg');
    if (prodImgEl && img) {
      bindTap(prodImgEl, () => openImageViewer([img], 0));
    }

    // Swipe between PRODUCTS (only for pin_single)
    if (isPinSingle && canSwipePinSingles(p.id)) {
      const goNeighbor = (dir) => {
        const nid = nextPinSingleId(p.id, dir);
        if (!nid || nid === String(p.id)) return;
        try { localStorage.setItem('lespaw_pin_swipe_hint_v1', JSON.stringify(true)); } catch {}
        replaceCurrentPage(() => renderProduct(nid), { scrollTop: true });
      };

      const btnPrev = document.getElementById('prodPrev');
      const btnNext = document.getElementById('prodNext');
      if (btnPrev) bindTap(btnPrev, (e) => { try { e?.stopPropagation?.(); } catch {} goNeighbor(-1); });
      if (btnNext) bindTap(btnNext, (e) => { try { e?.stopPropagation?.(); } catch {} goNeighbor(+1); });

      const hintEl = document.getElementById('pinSwipeHint');
      if (hintEl) {
        try {
          setTimeout(() => { try { hintEl.classList.add('is-hide'); } catch {} }, 1600);
          setTimeout(() => { try { hintEl.remove(); } catch {} }, 2400);
          try { localStorage.setItem('lespaw_pin_swipe_hint_v1', JSON.stringify(true)); } catch {}
        } catch {}
      }

      const rootCard = document.querySelector('.card');
      if (rootCard) {
        let sx = 0, sy = 0, active = false;
        rootCard.addEventListener('touchstart', (e) => {
          const t = e.target;
          if (t && (t.closest?.('button') || t.closest?.('.optPanel') || t.closest?.('.thumb') || t.closest?.('input') || t.closest?.('select') || t.closest?.('textarea'))) {
            active = false;
            return;
          }
          const p0 = e.touches && e.touches[0];
          if (!p0) return;
          sx = p0.clientX; sy = p0.clientY; active = true;
        }, { passive: true });
        rootCard.addEventListener('touchend', (e) => {
          if (!active) return;
          const p1 = e.changedTouches && e.changedTouches[0];
          if (!p1) return;
          const dx = p1.clientX - sx;
          const dy = p1.clientY - sy;
          if (Math.abs(dx) < 55 || Math.abs(dx) < Math.abs(dy) * 1.2) return;
          if (dx < 0) goNeighbor(+1);
          else goNeighbor(-1);
        }, { passive: true });
      }
    }

    syncNav();
    syncBottomSpace();
  }
  render();
  } catch (err) {
    try { console.error(err); } catch {}
    try {
      const msg = String(err?.message || err || '');
      toast(debugEnabled() ? ('Ошибка товара: ' + msg) : 'Ошибка экрана', 'warn');
    } catch {}
    try {
      view.innerHTML = `<div class="card"><div class="h2">Ошибка товара</div><div class="small">${escapeHTML(String(err?.message || err || ''))}</div><div class="sp10"></div><button class="btn is-active" id="backHomeAfterProdErr" type="button">На главную</button></div>`;
      const b = document.getElementById('backHomeAfterProdErr');
      if (b) bindTap(b, () => resetToHome());
      syncNav();
      syncBottomSpace();
    } catch {}
  }
}

// =====================
// Favorites
// =====================
function renderFavorites() {
  const items = (fav || []).map(normalizeFavItem).filter((x) => getProductById(x.id));

  view.innerHTML = `
    <div class="card">
      <div class="row rowBetween">
        <div class="h2">Избранное</div>
        ${items.length ? `<button class="btn btnGhost" id="btnClearFav" type="button">Очистить</button>` : ``}
      </div>
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
                        ${img ? `<img class="miniThumb" src="${safeImgUrl(img)}" alt="${escapeHTML("Фото: " + (p?.name || "товар"))}" loading="lazy" decoding="async" data-hide-onerror="1">` : `<div class="miniThumbStub"></div>`}
                        <div class="miniBody">
                          <div class="title">${h(p.name)}</div>
                          <div class="miniPrice">${money(unit)}</div>
                          ${optionPairsHTML(pairs)}

                          <div class="row mt12">
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
                <div class="small mt6">Выбери что-то, что тебе понравится — и нажми сердечко.</div>
                <div class="sp10"></div>
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
      try { clearPinSingleSwipeContext(); } catch {}
      openPage(() => renderProduct(el.dataset.open, fi));
    });
  });

  const goCats = document.getElementById("goCatsFromEmptyFav");
  if (goCats) bindTap(goCats, () => openPage(renderFandomTypes));

const btnClearFav = document.getElementById("btnClearFav");
if (btnClearFav) {
  bindTap(btnClearFav, (e) => {
    try { e?.stopPropagation?.(); } catch {}
    const prev = [...(fav || [])];
    if (!prev.length) return;
    setFav([]);
    toast("Избранное очищено", "warn");
    haptic("light");
    renderFavorites();
    showUndoBar("Избранное очищено", () => {
      setFav(prev);
      renderFavorites();
      toast("Возвращено", "ok");
      haptic("success");
    });
  });
}

  view.querySelectorAll("[data-remove]").forEach((b) => {
    bindTap(b, (e) => {
      e.stopPropagation();
      const i = Number(b.dataset.remove);
      const prev = [...(fav || [])];
      const removed = prev[i];
      if (removed == null) return;

      const next = [...prev];
      next.splice(i, 1);
      setFav(next);
      toast("Убрано из избранного", "warn");
      haptic("light");
      renderFavorites();

      showUndoBar("Убрано из избранного", () => {
        const cur = [...(fav || [])];
        // если уже вернули — не дублируем
        try {
          const ri = normalizeFavItem(removed);
          const key = favKey(ri.id, ri);
          if (favIndexByKey(key) >= 0) return;
        } catch {}
        const restored = [...cur];
        restored.splice(Math.min(i, restored.length), 0, removed);
        setFav(restored);
        renderFavorites();
        toast("Возвращено", "ok");
        haptic("success");
      });
    });
  });

view.querySelectorAll("[data-to-cart]").forEach((b) => {
    bindTap(b, (e) => {
      e.stopPropagation();
      const i = Number(b.dataset.toCart);
      const fi = items[i];
      if (!fi || !fi.id) return;

      // add with the same options variant
      addToCartById(fi.id, fi);
      toast("Добавлено в корзину", "good");

      // remove this exact variant from favorites (so it doesn't stay there)
      try {
        const key = favKey(fi.id, fi);
        const idx = favIndexByKey(key);
        if (idx >= 0) {
          const next = [...(fav || [])];
          next.splice(idx, 1);
          setFav(next);
        }
      } catch {}

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
    if (lam !== "pin_base" && !isPinSingleType(p?.product_type)) price += overlayDelta;
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
                        ${img ? `<img class="miniThumb" src="${safeImgUrl(img)}" alt="${escapeHTML("Фото: " + (p?.name || "товар"))}" loading="lazy" decoding="async" data-hide-onerror="1">` : `<div class="miniThumbStub"></div>`}
                        <div class="miniBody">
                          <div class="title">${h(p.name)}</div>
                          <div class="miniPrice">${money(unit)}${(Number(ci.qty)||1) > 1 ? ` <span class="miniQty">× ${Number(ci.qty)||1}</span>` : ``}</div>
                          ${optionPairsHTML(pairs)}
                        </div>
                      </div>

                      <div class="row miniIndentRow row miniIndentRow mt12 aiCenter">
                        <button class="btn" data-dec="${idx}">−</button>
                        <div class="small small minw34 taCenter"><b>${Number(ci.qty) || 1}</b></div>
                        <button class="btn" data-inc="${idx}">+</button>
                      </div>
                    </div>
                  `;
                })
                .join("")
            : `
              <div class="emptyBox">
                <div class="small">Корзина пока пустая ✨</div>
                <div class="sp10"></div>

                <div class="chips flexWrap">
                  <button class="chip" data-etype="Наклейки" type="button">Наклейки</button>
                  <button class="chip" data-etype="Значки" type="button">Значки</button>
                  <button class="chip" data-etype="Постеры" type="button">Постеры</button>
                  <button class="chip" data-etype="Боксы" type="button">Боксы</button>
                </div>

                <div class="sp10"></div>
                <button class="btn is-active" id="goCatsFromEmptyCart" type="button">Перейти в категории</button>
                <button class="btn" id="focusSearchFromEmptyCart" type="button">Открыть поиск</button>
              </div>
            `
        }
      </div>
      ${items.length ? `
        <hr>
        <div class="cartSummary">
          <div class="cartSummaryLeft">
            <div class="cartSummarySum">Итого: <b>${money(calcCartTotal())}</b></div>
            <div class="cartSummaryNote small">Без учёта доставки — она рассчитывается менеджеркой индивидуально.</div>
          </div>
          <div class="cartSummaryActions">
            <button class="btn" id="btnClear" type="button">Очистить</button>
            <button class="btn is-active" id="btnCheckout" type="button">Оформить</button>
          </div>
        </div>
      ` : ``}

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
      const removed = next[i] ? { ...next[i] } : null;

      const q = (Number(next[i]?.qty) || 1) - 1;
      if (q <= 0) {
        next.splice(i, 1);
        setCart(next);

        if (removed) {
          showUndoBar("Позиция удалена из корзины", () => {
            const restored = [...cart];
            const idx = Math.min(Math.max(i, 0), restored.length);
            restored.splice(idx, 0, removed);
            setCart(restored);
            toast("Возвращено в корзину", "good");
            renderCart();
          });
        }
      } else {
        next[i].qty = q;
        setCart(next);
      }

      try {
        const rp = getProductById(String(removed?.id || ""));
        gaRemoveFromCart(rp, removed || {}, 1);
      } catch {}

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
    try { clearPinSingleSwipeContext(); } catch {}
    openPage(() => renderProduct(ci.id, ci));
  });
});

const goCats = document.getElementById("goCatsFromEmptyCart");
  if (goCats) bindTap(goCats, () => openPage(renderFandomTypes));
  const focusSearch = document.getElementById("focusSearchFromEmptyCart");
  if (focusSearch) bindTap(focusSearch, () => {
    try { globalSearch?.focus?.(); } catch {}
  });

  // Быстрые чипсы по типам — просто подставляем в поиск (так не нужно плодить отдельные роуты)
  try {
    Array.from(view.querySelectorAll('[data-etype]')).forEach((btn) => {
      bindTap(btn, () => {
        const t = btn.getAttribute("data-etype") || "";
        try { globalSearch.value = t; } catch {}
        try { if (searchWrap) searchWrap.classList.add("hasText"); } catch {}
        openPage(() => renderSearch(t));
      });
    });
  } catch {}

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


// Версия "Важной информации".
// ВАЖНО: когда вы меняете текст/условия во вкладке "Важная информация", просто увеличьте версию ниже.
// Тогда у всех клиенток статус "прочитано" автоматически сбросится.
const CLOUD_CHECKOUT = "lespaw_checkout_cloud_v2";

// Миграция со старых полей (чтобы пользовательки не потеряли введённые данные)
const oldCheckout = loadJSON("lespaw_checkout_v1", null);

let checkout = loadJSON(LS_CHECKOUT, {
  fio: oldCheckout?.name || "",
  phone: oldCheckout?.contact || "",
  countryId: "ru", // only used for Ozon/Wildberries; otherwise forced to Russia
  pickupType: "yandex", // yandex | 5post | ozon | wildberries
  pickupAddress: (oldCheckout?.delivery || ""),
  comment: oldCheckout?.comment || "",
});

let checkoutCloudTimer = null;

async function openCheckout() {
  gaEvent("begin_checkout");
  // Если пользователька уже открывала «Важную информацию» ранее — считаем её прочитанной и в оформлении.
  // (Если хочет перечитать — кнопка «Открыть» рядом.)
  infoViewedThisSession = !!infoViewed;

  // CloudStorage может быть недоступен/падать. В таком случае не блокируем оформление:
  // просто открываем экран оформления с локальными данными.
  try {
    await syncCheckoutFromCloud();
  } catch (err) {
    console.error(err);
  }

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
  const { filmLabelByKey, stickerLamLabelByKey, pinLamLabelByKey } = getOptionDefs(overlayDelta, holoDelta);


  // Выделение "жирным" (симуляция): капс + двоеточие
  const H = (s) => String(s || "").toUpperCase(); // заголовок/лейбл
  const LBL = (s) => `${H(s)}:`; // лейбл с двоеточием

  // "Моно" (симуляция): заменяем цифры на математические моно-цифры + обрамляем скобками
  const formatPlainValue = (s) => String(s || "").trim();

  const formatPhoneForOrder = (s) => {
    const normalized = normalizePhoneE164(s, checkout.countryId || "ru");
    return normalized ? prettyPhone(normalized) : "";
  };

  const pt = ({
    yandex: "Яндекс",
    "5post": "5Post",
    ozon: "Ozon",
    wildberries: "Wildberries",
  }[checkout.pickupType] || "Яндекс");

  const needsCountry = (checkout.pickupType === "ozon" || checkout.pickupType === "wildberries");
  const countryName = getCountryById(checkout.countryId || "ru").name;


  // группируем товары по типам
  const groupsOrder = [
    { key: "sticker", title: H("Наклейки") + ":" },
    { key: "pin_single", title: H("Значки поштучно") + ":" },
    { key: "pin_set", title: H("Наборы значков") + ":" },
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

    const typeKey = typeGroupKey(p);
    if (!groupedItems.has(typeKey)) return;

    const groupKey = typeKey;
    const baseKey = normalizeTypeKey(p.product_type);

    const qty = Number(ci.qty) || 1;
    let unitPrice = Number(p.price) || 0;
  if (baseKey === "sticker") {
      const filmKey = pickStickerFilm(ci);
      const lamKey = pickStickerLam(ci);

      if (filmKey === "film_holo") unitPrice += holoDelta;

      // ламинации с доплатой: всё кроме "none"
      if (lamKey && lamKey !== "none") unitPrice += overlayDelta;
    }

    if (groupKey === "pin_set") {
      const lamKey = pickPinLam(ci);
      // Наборы значков: ламинация платная (всё кроме базовой)
      if (lamKey && lamKey !== "pin_base") unitPrice += overlayDelta;
    }
    if (groupKey === "pin_single") {
      // Значки поштучно: ламинация бесплатная (0 ₽)
      // (цена не меняется)
    }
  if (baseKey === "poster") {
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
      } else if (g.key === "pin_set" || g.key === "pin_single") {
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
if ((checkout.comment || "").trim()) {
    lines.push(`${LBL("Комментарий")} ${formatPlainValue(checkout.comment)}`);
  }
  lines.push("");
  lines.push(`${H("Данные для доставки")}:`);
  lines.push(`${LBL("ФИО")} ${checkout.fio || ""}`);
  lines.push(`${LBL("Телефон получателя")} ${formatPhoneForOrder(checkout.phone || "")}`);
  lines.push(`${LBL("Пункт выдачи")} ${pt}`);
  if (needsCountry) lines.push(`${LBL("Страна доставки")} ${countryName}`);
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

  const pickupType = checkout.pickupType || "yandex";
  const requiresCountry = (pickupType === "ozon" || pickupType === "wildberries");
  // Country is only needed for Ozon/WB; for other methods we keep Russia.
  if (!checkout.countryId) checkout.countryId = "ru";
  if (!requiresCountry) checkout.countryId = "ru";
  const selectedCountry = getCountryById(checkout.countryId);
  const phonePlaceholder = getPhonePlaceholder(selectedCountry.id);


  // Похожие товары в оформлении отключены (блок может быть включен позже осознанно).
  // Оставляем пустые массивы, чтобы избежать ReferenceError.
  const similarFandom = [];
  const similarType = [];

  view.innerHTML = `
    <div class="card">
      <div class="h2">Оформление заказа</div>
      <div class="small">Заполни данные и нажми «Оформить заказ».</div>
      <hr>

      <div class="small"><b>ФИО</b></div>
      <input class="searchInput" id="cFio" placeholder="Имя и фамилия" value="${safeVal(checkout.fio)}" aria-describedby="errFio" aria-invalid="false">
      
      <div class="fieldHelp small" id="errFio"></div>
<div class="sp10"></div>

      <div class="small"><b>Телефон получателя (обязательно)</b></div>
      <div class="small fieldHelp is-show mt6 opacity88">
        Номер должен быть тем, на который зарегистрирован аккаунт.
        ${requiresCountry ? "Для Ozon/Wildberries обязательно укажи страну доставки." : ""}
      </div>

      ${requiresCountry ? `
        <div class="sp10"></div>
        <div class="small"><b>Страна доставки (обязательно)</b></div>
        <select class="searchInput" id="cCountry">
          ${SHIPPING_COUNTRIES.map((c) => `<option value="${c.id}" ${checkout.countryId === c.id ? "selected" : ""}>${c.name}</option>`).join("")}
        </select>
      ` : ``}

      <div class="sp10"></div>
      <input class="searchInput" id="cPhone" type="tel" inputmode="tel" autocomplete="tel" placeholder="${phonePlaceholder}" value="${safeVal(checkout.phone)}" aria-describedby="errPhone" aria-invalid="false">

      <div class="fieldHelp small" id="errPhone"></div>
<div class="sp10"></div>

      <div class="small"><b>Пункт выдачи</b></div>
      <div class="row mt8 flexWrap">
        <button class="btn ${pickupType === "yandex" ? "is-active" : ""}" id="ptYandex" type="button">Яндекс</button>
        <button class="btn ${pickupType === "5post" ? "is-active" : ""}" id="pt5Post" type="button">5Post</button>
        <button class="btn ${pickupType === "ozon" ? "is-active" : ""}" id="ptOzon" type="button">Ozon</button>
        <button class="btn ${pickupType === "wildberries" ? "is-active" : ""}" id="ptWB" type="button">Wildberries</button>
      </div>
      <div class="sp10"></div>

      <div class="small"><b>Адрес пункта выдачи</b></div>
      <input class="searchInput" id="cPickupAddress" placeholder="Область, город, улица, дом" value="${safeVal(checkout.pickupAddress)}" aria-describedby="errPickup" aria-invalid="false">
      
      <div class="fieldHelp small" id="errPickup"></div>
<div class="sp10"></div>

      <div class="small"><b>Комментарий</b></div>
      <input class="searchInput" id="cComment" placeholder="необязательно" value="${safeVal(checkout.comment)}">

      <hr>

      <div class="checkoutSection">
        <div class="checkoutSectionTitle">Подтверждения</div>

        <div class="checkoutBlock" id="blockInfoGate">
          <div class="checkoutBlockTop">
            <div class="checkoutBlockTitle">Важная информация <span class="checkStatus">${infoViewedThisSession ? "прочитано ✓" : "не прочитано"}</span></div>
            <button class="btn btnGhost btnSmall" id="openInfoFromCheckout" type="button">Открыть</button>
          </div>
          <div class="checkoutBlockText small">
            Перед заказом открой «Важную информацию».
          </div>

          <div class="checkWrap">
            <label class="checkRow small" id="rowAgreeInfo">
              <input type="checkbox" id="agreeInfo" ${infoViewedThisSession ? "checked" : ""} ${infoViewedThisSession ? "" : "disabled"}>
              <span>
                Я ознакомилась с «Важной информацией».
                ${infoViewedThisSession ? "" : `<div class="checkSub">Сначала нажми «Открыть».</div>`}
              </span>
            </label>
          </div>
        </div>

        <div class="checkoutBlock" id="blockConfirmItems">
          <div class="checkoutBlockTitle">Проверка заказа</div>
          <div class="checkWrap">
            <label class="checkRow small" id="rowConfirmItems">
              <input type="checkbox" id="confirmItems">
              <span>Проверила заказ: количество и варианты — всё верно.</span>
            </label>
          </div>
        </div>
        <div class="checkoutNote">
          Нажмёшь <b>«Оформить заказ»</b> — откроется чат с менеджеркой с готовым текстом. Отправь его <b>без изменений</b>.
        </div>
      </div>

      <div class="sp12"></div>

      <div class="row">
        <button class="btn is-active" id="btnSend" type="button">Оформить заказ</button>
      </div>

      ${ (similarFandom.length || similarType.length) ? `
        <hr>
        <div class="h3">Похожие товары</div>
        ${similarFandom.length ? `
          <div class="small mt10"><b>Ещё из этого фандома</b></div>
          <div class="grid2 mt10">
            ${similarFandom.map((sp) => `
              <div class="pcard pcardSmall" data-id="${sp.id}">
                ${cardThumbHTML(sp)}
                <div class="pcardTitle">${h(sp.name)}</div>
                <div class="pcardPrice">${moneyDisplay(sp.price)}</div>
              </div>
            `).join("")}
          </div>
        ` : ``}
        ${similarType.length ? `
          <div class="small mt14"><b>Ещё такого типа</b></div>
          <div class="grid2 mt10">
            ${similarType.map((sp) => `
              <div class="pcard pcardSmall" data-id="${sp.id}">
                ${cardThumbHTML(sp)}
                <div class="pcardTitle">${h(sp.name)}</div>
                <div class="pcardPrice">${moneyDisplay(sp.price)}</div>
              </div>
            `).join("")}
          </div>
        ` : ``}
      ` : ``}
    </div>
  `;

  const cFio = document.getElementById("cFio");
  const cPhone = document.getElementById("cPhone");
  const cCountry = document.getElementById("cCountry");
  const cPickupAddress = document.getElementById("cPickupAddress");
  const cComment = document.getElementById("cComment");

  const errFio = document.getElementById("errFio");
  const errPhone = document.getElementById("errPhone");
  const errPickup = document.getElementById("errPickup");

  // phone mask context (RU by default; for Ozon/WB uses selected country)
  const activeCountryIdForPhone = (checkout.pickupType === "ozon" || checkout.pickupType === "wildberries") ? (checkout.countryId || "ru") : "ru";
  if (cPhone) {
    cPhone.dataset.countryId = activeCountryIdForPhone;
    // format immediately (in case value was stored unformatted)
    try { cPhone.value = formatPhoneByCountry(cPhone.value || "", activeCountryIdForPhone); } catch {}
  }
  if (cPhone) {
    const forcePhoneCaretEnd = () => {
      try {
        if (typeof cPhone.setSelectionRange !== "function") return;
        const end = (cPhone.value || "").length;
        cPhone.setSelectionRange(end, end);
      } catch {}
    };
    // Keep caret at end in Telegram WebView to avoid digits mixing into +CC prefix
    ["focus", "click", "touchstart", "mouseup"].forEach((ev) => {
      cPhone.addEventListener(ev, () => requestAnimationFrame(forcePhoneCaretEnd), { passive: true });
    });
    // Also on keydown, if user tries to move caret left/right, snap back
    cPhone.addEventListener("keydown", (e) => {
      const k = e.key;
      if (k === "ArrowLeft" || k === "ArrowRight" || k === "Home") {
        e.preventDefault();
        requestAnimationFrame(forcePhoneCaretEnd);
      }
    });
  }



  function syncCheckout() {
    saveCheckout({
      fio: cFio.value || "",
      phone: cPhone.value || "",
      countryId: (document.getElementById("cCountry") ? (document.getElementById("cCountry").value || "ru") : (checkout.countryId || "ru")),
      pickupType: pickupType || "yandex",
      pickupAddress: cPickupAddress.value || "",
      comment: cComment.value || "",
    });
  }
  [cFio, cPickupAddress, cComment, cCountry].filter(Boolean).forEach((el) => el.addEventListener("input", () => {
    el.classList.remove("field-error");
    // clear inline error text
    if (el === cFio && errFio) { errFio.textContent = ""; errFio.classList.remove("is-show"); }
    if (el === cFio) setAriaInvalid(cFio, false);
    if (el === cPickupAddress && errPickup) { errPickup.textContent = ""; errPickup.classList.remove("is-show"); }
    if (el === cPickupAddress) setAriaInvalid(cPickupAddress, false);
    syncCheckout();
  }));

  // Live phone mask with dashes + sync
  if (cPhone) {
    cPhone.addEventListener("input", () => {
      cPhone.classList.remove("field-error");
      if (errPhone) { errPhone.textContent = ""; errPhone.classList.remove("is-show"); }
      setAriaInvalid(cPhone, false);
      applyPhoneMask(cPhone, (cPhone?.dataset?.countryId || "ru"));
      syncCheckout();
    });
  }

  // Ensure phone stays formatted on blur
  if (cPhone) {
    cPhone.addEventListener("blur", () => {
      try {
        const f = formatPhoneByCountry(cPhone.value || "", (cPhone?.dataset?.countryId || "ru"));
        if (f !== (cPhone.value || "")) {
          cPhone.value = f;
          syncCheckout();
        }
      } catch {}
    });
  }

  const ptYandex = document.getElementById("ptYandex");
  const pt5Post = document.getElementById("pt5Post");
  const ptOzon = document.getElementById("ptOzon");
  const ptWB = document.getElementById("ptWB");

  const setPickupType = (t) => {
    checkout.pickupType = t;
    // For Ozon/WB we keep (or ask) country; for others force Russia.
    if (t !== "ozon" && t !== "wildberries") checkout.countryId = "ru";
    if (!checkout.countryId) checkout.countryId = "ru";
    saveCheckout(checkout);
    renderCheckout();
  };

  bindTap(ptYandex, () => setPickupType("yandex"));
  bindTap(pt5Post, () => setPickupType("5post"));
  bindTap(ptOzon, () => setPickupType("ozon"));
  bindTap(ptWB, () => setPickupType("wildberries"));

  // Country selector (only visible for Ozon/WB)
  if (cCountry) {
    cCountry.addEventListener("change", () => {
      checkout.countryId = cCountry.value || "ru";
      saveCheckout(checkout);
      renderCheckout(); // to update placeholder/hints
    });
  }

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
    if (_orderSubmitting) return;
    syncCheckout();

    // сброс подсветок
    [cFio, cPhone, cPickupAddress].forEach((el) => el?.classList.remove("field-error"));
    [errFio, errPhone, errPickup].forEach((el) => { if (!el) return; el.textContent = ""; el.classList.remove("is-show"); });
    rowAgreeInfo?.classList.remove("is-error");
    rowConfirmItems?.classList.remove("is-error");

    let ok = true;

    const fio = (cFio?.value || "").trim();
    const phone = (cPhone?.value || "").trim();
    const addr = (cPickupAddress?.value || "").trim();

    if (!fio) {
      cFio?.classList.add("field-error");
      if (errFio) { errFio.textContent = "Введите имя и фамилию."; errFio.classList.add("is-show"); }
      setAriaInvalid(cFio, true);
      ok = false;
    } else {
      setAriaInvalid(cFio, false);
    }
    if (!phone) {
      cPhone?.classList.add("field-error");
      if (errPhone) { errPhone.textContent = "Введите номер телефона."; errPhone.classList.add("is-show"); }
      setAriaInvalid(cPhone, true);
      ok = false;
    } else {
      const countryId = (checkout.countryId || "ru");
      const normalized = normalizePhoneE164(phone, countryId);

      if (!isPhoneE164Like(normalized)) {
        cPhone?.classList.add("field-error");
        if (errPhone) { errPhone.textContent = "Введите корректный номер телефона (желательно в формате +код страны …)."; errPhone.classList.add("is-show"); }
        setAriaInvalid(cPhone, true);
        ok = false;
      } else {
        // Save normalized value (so manager gets a valid number)
        checkout.phone = normalized;
        saveCheckout(checkout);
        setAriaInvalid(cPhone, false);
        try { const fmt = formatPhoneByCountry(normalized, checkout.shipCountry || checkout.countryId); if (cPhone && cPhone.value !== fmt) cPhone.value = fmt; } catch {}
      }
    }
    if (!addr) {
      cPickupAddress?.classList.add("field-error");
      if (errPickup) { errPickup.textContent = "Укажите адрес пункта выдачи."; errPickup.classList.add("is-show"); }
      setAriaInvalid(cPickupAddress, true);
      ok = false;
    } else {
      setAriaInvalid(cPickupAddress, false);
    }

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
      try {
        const focusEl = firstErr?.matches?.("input, textarea, select, button")
          ? firstErr
          : firstErr?.querySelector?.("input, textarea, select, button");
        focusEl?.focus?.({ preventScroll: true });
      } catch {}
      return;
    }

    const text = buildOrderText();
    try {
      gaEvent("generate_lead", {
        value: Number(calcCartTotal() || 0),
        currency: "RUB",
        item_count: Number((cart || []).reduce((s, ci) => s + (Number(ci.qty) || 1), 0) || 0),
      });
      gaEvent("submit_order", { value: Number(calcCartTotal() || 0), currency: "RUB" });
    } catch {}
    try {
      _orderSubmitting = true;
      try { btnSend?.classList?.add("is-disabled"); btnSend?.setAttribute?.("disabled","disabled"); } catch {}
      try { btnSend.textContent = "Открываю чат…"; } catch {}
    } catch {}

    openTelegramText(MANAGER_USERNAME, text);
    toast("Открываю чат с менеджеркой…", "good");

    try { setTimeout(() => { _orderSubmitting = false; try { btnSend?.classList?.remove("is-disabled"); btnSend?.removeAttribute?.("disabled"); } catch {} }, 1800); } catch {}
  });

  syncNav();
  syncBottomSpace();
}let _orderSubmitting = false;
