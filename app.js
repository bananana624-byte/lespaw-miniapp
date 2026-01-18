// LesPaw Mini App — app.js (финальная версия, с твоими CSV-ссылками)
// Работает на GitHub Pages + Google Sheets (Publish to web → CSV)

// =====================
// НАСТРОЙКИ (твои)
// =====================
const CSV_FANDOMS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ_WJrd_-W-ZSVqZqUs8YhumHkSjfHrt4xBV3nZEcUTRVyPeF15taLFiaw1gzJcK7m33sLjmkhP-Zk/pub?gid=0&single=true&output=csv";

const CSV_PRODUCTS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ_WJrd_-W-ZSVqZqUs8YhumHkSjfHrt4xBV3nZEcUTRVyPeF15taLFiaw1gzJcK7m33sLjmkhP-Zk/pub?gid=636991555&single=true&output=csv";

const CSV_SETTINGS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ_WJrd_-W-ZSVqZqUs8YhumHkSjfHrt4xBV3nZEcUTRVyPeF15taLFiaw1gzJcK7m33sLjmkhP-Zk/pub?gid=2041657059&single=true&output=csv";

// менеджерка (ВАЖНО: без @)
const MANAGER_USERNAME = "LesPaw_manager";

// =====================
// Telegram WebApp init
// =====================
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

// =====================
// Storage keys
// =====================
const LS_CART = "lespaw_cart_v1";
const LS_FAV = "lespaw_fav_v1";

// cart item: { productId, qty, base: 'standard'|'holo_base', overlay: 'none'|'sugar'... }
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

function setCart(cartNew) {
  cart = cartNew;
  saveJSON(LS_CART, cart);
  updateCartBadge();
}
function setFav(favNew) {
  fav = favNew;
  saveJSON(LS_FAV, fav);
}

// =====================
// DOM
// =====================
const view = document.getElementById("view");
const cartCount = document.getElementById("cartCount");

document.getElementById("btnCategories").onclick = () => renderFandomTypes();
document.getElementById("btnCart").onclick = () => renderCart();
document.getElementById("btnInfo").onclick = () => renderInfo();
document.getElementById("btnReviews").onclick = () => renderReviews();
document.getElementById("btnExamples").onclick = () => openExamples();
document.getElementById("globalSearch").oninput = (e) => renderSearch(e.target.value);

// =====================
// Data
// =====================
let fandoms = [];
let products = [];
let settings = {
  overlay_price_delta: 100,
  holo_base_price_delta: 100,
  examples_url: "",
};

// =====================
// CSV parsing (нормальный, с кавычками и запятыми внутри полей)
// =====================
function parseCSV(text) {
  // RFC4180-ish parser: поддерживает кавычки, запятые внутри кавычек, переносы строк
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
          field += '"'; // экранированная кавычка
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else {
      if (c === '"') {
        inQuotes = true;
      } else if (c === ",") {
        row.push(field);
        field = "";
      } else if (c === "\n") {
        row.push(field);
        rows.push(row);
        row = [];
        field = "";
      } else {
        field += c;
      }
    }
  }
  // последний field
  row.push(field);
  rows.push(row);

  // удалим пустые хвостовые строки
  const cleaned = rows.filter((r) => r.some((cell) => String(cell).trim() !== ""));
  if (!cleaned.length) return [];

  const headers = cleaned[0].map((h) => String(h).trim());
  return cleaned.slice(1).map((r) => {
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = (r[idx] ?? "").toString().trim();
    });
    return obj;
  });
}

async function fetchCSV(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CSV fetch failed (${res.status})`);
  const text = await res.text();
  return parseCSV(text);
}

// =====================
// Helpers
// =====================
function updateCartBadge() {
  const totalQty = cart.reduce((sum, it) => sum + (Number(it.qty) || 0), 0);
  cartCount.textContent = String(totalQty);
}

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

function getFandomById(id) {
  return fandoms.find((f) => f.fandom_id === id);
}
function getProductById(id) {
  return products.find((p) => p.id === id);
}

function isDigitStart(name) {
  return /^[0-9]/.test((name || "").trim());
}

function money(n) {
  const num = Number(n) || 0;
  return `${num} ₽`;
}

function truthy(v) {
  return String(v || "").trim().toUpperCase() === "TRUE";
}

function cleanListCSV(s) {
  // для images/tags: "a,b,c" -> ["a","b","c"]
  return (s || "")
    .split(",")
    .map((x) => x.trim())
    .filter(Boolean);
}

const OVERLAY_LABELS = {
  none: "Без покрытия",
  sugar: "Сахар",
  stars: "Звёздочки",
  snowflakes_small: "Маленькие снежинки",
  stars_big: "Большие звёзды",
  holo_overlay: "Голографическая ламинация",
};

// =====================
// Init
// =====================
async function init() {
  try {
    fandoms = await fetchCSV(CSV_FANDOMS_URL);
    products = await fetchCSV(CSV_PRODUCTS_URL);

    // settings key/value
    const s = await fetchCSV(CSV_SETTINGS_URL);
    s.forEach((row) => {
      const k = row.key;
      const v = row.value;
      if (!k) return;
      if (k === "overlay_price_delta" || k === "holo_base_price_delta") settings[k] = Number(v);
      else settings[k] = v;
    });

    updateCartBadge();
    renderFandomTypes();
  } catch (e) {
    view.innerHTML = `
      <div class="h2">Ошибка загрузки данных</div>
      <div class="small">${String(e)}</div>
      <hr>
      <div class="small">
        Проверь:\n
        1) что CSV-ссылки верные,\n
        2) что вкладки опубликованы,\n
        3) что в таблице нет битых ссылок.
      </div>
    `;
  }
}
init();

// =====================
// Views
// =====================
function renderFandomTypes() {
  view.innerHTML = `
    <div class="h2">Категории</div>
    <div class="small">Выбери тип фандома</div>
    <hr>
    <div class="list">
      ${FANDOM_TYPES.map((t) => `<div class="item" data-type="${t}">${t}</div>`).join("")}
    </div>
    <hr>
    <div class="row">
      <button class="btn" id="btnFav">Избранное</button>
    </div>
  `;

  view.querySelectorAll(".item").forEach((el) => {
    el.onclick = () => renderFandomList(el.dataset.type);
  });
  document.getElementById("btnFav").onclick = () => renderFavorites();
}

function renderFandomList(type) {
  const list = fandoms
    .filter((f) => truthy(f.is_active))
    .filter((f) => f.fandom_type === type)
    .sort((a, b) => (a.fandom_name || "").localeCompare(b.fandom_name || "", "ru"));

  const letters = list.filter((f) => !isDigitStart(f.fandom_name));
  const digits = list.filter((f) => isDigitStart(f.fandom_name));

  view.innerHTML = `
    <div class="h2">${type}</div>
    <input class="input" id="fandomSearch" placeholder="Поиск фандома внутри категории…" />
    <hr>
    <div class="list" id="fandomList">
      ${letters.map((f) => `<div class="item" data-id="${f.fandom_id}">${f.fandom_name}</div>`).join("")}
      ${digits.length ? `<div class="small">0–9</div>` : ""}
      ${digits.map((f) => `<div class="item" data-id="${f.fandom_id}">${f.fandom_name}</div>`).join("")}
    </div>
    <hr>
    <button class="btn" id="back">← Назад</button>
  `;

  const fandomListEl = document.getElementById("fandomList");
  fandomListEl.querySelectorAll(".item").forEach((el) => {
    el.onclick = () => renderFandomPage(el.dataset.id);
  });

  document.getElementById("back").onclick = () => renderFandomTypes();

  document.getElementById("fandomSearch").oninput = (e) => {
    const q = e.target.value.toLowerCase().trim();
    fandomListEl.querySelectorAll(".item").forEach((el) => {
      const name = el.textContent.toLowerCase();
      el.style.display = name.includes(q) ? "" : "none";
    });
  };
}

function renderFandomPage(fandomId) {
  const f = getFandomById(fandomId);
  const all = products.filter((p) => p.fandom_id === fandomId);

  const typeTabs = ["all", "sticker", "pin", "poster", "box"];
  const tabNames = { all: "Все", sticker: "Наклейки", pin: "Значки", poster: "Постеры", box: "Боксы" };

  view.innerHTML = `
    <div class="h2">${f?.fandom_name || "Фандом"}</div>
    <div class="row" id="tabs">
      ${typeTabs.map((t) => `<button class="btn" data-t="${t}">${tabNames[t]}</button>`).join("")}
    </div>
    <input class="input" id="inFandomSearch" placeholder="Поиск по товарам этого фандома…" />
    <hr>
    <div class="list" id="prodList"></div>
    <hr>
    <button class="btn" id="back">← Назад</button>
  `;

  let currentTab = "all";
  const prodList = document.getElementById("prodList");

  function renderList() {
    const q = document.getElementById("inFandomSearch").value.toLowerCase().trim();
    const filtered = all.filter((p) => {
      if (currentTab !== "all" && p.product_type !== currentTab) return false;
      const hay = `${p.name || ""} ${p.description_short || ""} ${p.tags || ""}`.toLowerCase();
      return hay.includes(q);
    });

    prodList.innerHTML =
      filtered
        .map(
          (p) => `
        <div class="item" data-id="${p.id}">
          <div><b>${p.name}</b></div>
          <div class="muted">${money(Number(p.price) || 0)} · ${p.product_type}</div>
        </div>
      `
        )
        .join("") || `<div class="small">Пока нет товаров в этом фандоме.</div>`;

    prodList.querySelectorAll(".item").forEach((el) => {
      el.onclick = () => renderProduct(el.dataset.id);
    });
  }

  document.querySelectorAll("#tabs .btn").forEach((btn) => {
    btn.onclick = () => {
      currentTab = btn.dataset.t;
      renderList();
    };
  });

  document.getElementById("inFandomSearch").oninput = () => renderList();
  document.getElementById("back").onclick = () => renderFandomList(f.fandom_type);

  renderList();
}

function renderProduct(productId) {
  const p = getProductById(productId);
  if (!p) return;

  const isSticker = p.product_type === "sticker";
  const enableBase = truthy(p.enable_print_base);
  const enableOverlay = truthy(p.enable_overlay);

  let selBase = "standard";
  let selOverlay = "none";

  const isFav = fav.includes(productId);

  function calcUnitPrice() {
    let total = Number(p.price) || 0;
    if (isSticker && enableBase && selBase === "holo_base") total += settings.holo_base_price_delta;
    if (isSticker && enableOverlay && selOverlay !== "none") total += settings.overlay_price_delta;
    return total;
  }

  function render() {
    const unitPrice = calcUnitPrice();

    // картинки
    const imgs = cleanListCSV(p.images);
    const imgBlock = imgs.length
      ? `<div class="list">
          ${imgs
            .slice(0, 6)
            .map(
              (u) =>
                `<div class="item" style="cursor:default">
                  <div class="small" style="word-break:break-all">${u}</div>
                </div>`
            )
            .join("")}
        </div><hr>`
      : "";

    view.innerHTML = `
      <div class="h2">${p.name}</div>
      <div class="small"><b>${money(unitPrice)}</b></div>
      <hr>

      ${imgBlock}

      ${
        isSticker
          ? `
        <div class="small"><b>Опции наклеек</b></div>

        ${
          enableBase
            ? `
          <div class="small">Основа печати:</div>
          <div class="row">
            <button class="btn" id="baseStd">Стандарт (+0)</button>
            <button class="btn" id="baseHolo">Голографическая основа (+${settings.holo_base_price_delta})</button>
          </div>
        `
            : ""
        }

        ${
          enableOverlay
            ? `
          <div class="small">Покрытие:</div>
          <div class="row" id="ovRow">
            ${[
              ["none", `${OVERLAY_LABELS.none} (+0)`],
              ["sugar", `${OVERLAY_LABELS.sugar} (+${settings.overlay_price_delta})`],
              ["stars", `${OVERLAY_LABELS.stars} (+${settings.overlay_price_delta})`],
              ["snowflakes_small", `${OVERLAY_LABELS.snowflakes_small} (+${settings.overlay_price_delta})`],
              ["stars_big", `${OVERLAY_LABELS.stars_big} (+${settings.overlay_price_delta})`],
              ["holo_overlay", `${OVERLAY_LABELS.holo_overlay} (+${settings.overlay_price_delta})`],
            ]
              .map(([id, label]) => `<button class="btn" data-ov="${id}">${label}</button>`)
              .join("")}
          </div>
          <div class="row">
            <button class="btn" id="btnExamples2">Как выглядит?</button>
          </div>
        `
            : ""
        }
        <hr>
      `
          : ""
      }

      <div class="small"><b>Характеристики</b></div>
      <div class="small">Размер: ${p.size || "—"}</div>
      <div class="small">Материал: ${p.material || "—"} (${p.material_type || "—"})</div>
      <hr>

      <div class="small">${p.description_full || p.description_short || ""}</div>
      <hr>

      <div class="row">
        <button class="btn" id="btnFav">${isFav ? "★ Убрать из избранного" : "☆ В избранное"}</button>
        <button class="btn" id="btnAdd">Добавить в корзину</button>
      </div>
      <hr>

      <button class="btn" id="back">← Назад</button>
    `;

    if (isSticker && enableBase) {
      document.getElementById("baseStd").onclick = () => {
        selBase = "standard";
        render();
      };
      document.getElementById("baseHolo").onclick = () => {
        selBase = "holo_base";
        render();
      };
    }

    if (isSticker && enableOverlay) {
      view.querySelectorAll("[data-ov]").forEach((b) => {
        b.onclick = () => {
          selOverlay = b.dataset.ov;
          render();
        };
      });
      document.getElementById("btnExamples2").onclick = () => openExamples();
    }

    document.getElementById("btnFav").onclick = () => {
      const newFav = fav.includes(productId) ? fav.filter((x) => x !== productId) : [...fav, productId];
      setFav(newFav);
      renderProduct(productId);
    };

    document.getElementById("btnAdd").onclick = () => {
      const key = `${productId}::${selBase}::${selOverlay}`;
      const existing = cart.find((it) => `${it.productId}::${it.base}::${it.overlay}` === key);
      if (existing) {
        existing.qty = (Number(existing.qty) || 1) + 1;
        setCart([...cart]);
      } else {
        setCart([...cart, { productId, qty: 1, base: selBase, overlay: selOverlay }]);
      }
      renderCart();
    };

    document.getElementById("back").onclick = () => renderFandomPage(p.fandom_id);
  }

  render();
}

function renderCart() {
  if (!cart.length) {
    view.innerHTML = `
      <div class="h2">Корзина</div>
      <div class="small">В корзине пока пусто.</div>
      <hr>
      <button class="btn" id="back">← Назад</button>`;
    document.getElementById("back").onclick = () => renderFandomTypes();
    return;
  }

  let total = 0;

  const rows = cart.map((it, idx) => {
    const p = getProductById(it.productId);
    const isSticker = p?.product_type === "sticker";

    let unit = Number(p?.price) || 0;
    if (isSticker && truthy(p.enable_print_base) && it.base === "holo_base") unit += settings.holo_base_price_delta;
    if (isSticker && truthy(p.enable_overlay) && it.overlay !== "none") unit += settings.overlay_price_delta;

    const qty = Number(it.qty) || 1;
    const line = unit * qty;
    total += line;

    const f = getFandomById(p.fandom_id);

    const overlayText =
      it.overlay === "none" ? "без" : `${OVERLAY_LABELS[it.overlay] || it.overlay} (+${settings.overlay_price_delta})`;

    return `
      <div class="item">
        <div><b>${p?.name || it.productId}</b></div>
        <div class="muted">${f?.fandom_name || ""} · ${p?.product_type || ""}</div>
        ${
          isSticker
            ? `<div class="muted">Основа: ${
                it.base === "holo_base" ? `голографическая (+${settings.holo_base_price_delta})` : "стандарт"
              }</div>`
            : ""
        }
        ${isSticker ? `<div class="muted">Покрытие: ${overlayText}</div>` : ""}
        <div class="muted">Цена за 1: ${money(unit)} · Кол-во: ${qty} · Сумма: ${money(line)}</div>
        <div class="row">
          <button class="btn" data-dec="${idx}">➖</button>
          <button class="btn" data-inc="${idx}">➕</button>
          <button class="btn" data-del="${idx}">Удалить</button>
        </div>
      </div>
    `;
  });

  view.innerHTML = `
    <div class="h2">Корзина</div>
    <div class="list">${rows.join("")}</div>
    <hr>
    <div class="small"><b>Итого: ${money(total)}</b></div>
    <hr>
    <button class="btn" id="checkout">Оформить заказ</button>
    <button class="btn" id="back">← Назад</button>
  `;

  view.querySelectorAll("[data-dec]").forEach((b) => {
    b.onclick = () => {
      const i = Number(b.dataset.dec);
      const it = cart[i];
      it.qty = Math.max(1, (Number(it.qty) || 1) - 1);
      setCart([...cart]);
      renderCart();
    };
  });
  view.querySelectorAll("[data-inc]").forEach((b) => {
    b.onclick = () => {
      const i = Number(b.dataset.inc);
      const it = cart[i];
      it.qty = (Number(it.qty) || 1) + 1;
      setCart([...cart]);
      renderCart();
    };
  });
  view.querySelectorAll("[data-del]").forEach((b) => {
    b.onclick = () => {
      const i = Number(b.dataset.del);
      setCart(cart.filter((_, idx) => idx !== i));
      renderCart();
    };
  });

  document.getElementById("checkout").onclick = () => renderCheckout(total);
  document.getElementById("back").onclick = () => renderFandomTypes();
}

function renderCheckout(total) {
  view.innerHTML = `
    <div class="h2">Оформление</div>
    <div class="small">
      ⚠️ После нажатия кнопки вас перебросит в Telegram-диалог с уже собранным текстом.
      Пожалуйста, отправьте сообщение <b>без изменений</b>.
    </div>
    <hr>

    <div class="small"><b>Важная информация</b></div>
    <div class="small">
      💳 Заказ собирается после 100% предоплаты (Т-Банк).<br>
      ⏳ Сборка и отправка — 4–5 дней.<br>
      📦 Доставка: Яндекс (ПВЗ) / 5post в «Пятёрочке».<br>
      ❌ Возврат невозможен (индивидуально под заказ).
    </div>

    <hr>
    <label class="small"><input type="checkbox" id="agree" /> Я ознакомилась с важной информацией</label>
    <hr>

    <input class="input" id="fio" placeholder="ФИО *" />
    <div style="height:8px"></div>
    <input class="input" id="phone" placeholder="Номер телефона *" />
    <div style="height:8px"></div>
    <input class="input" id="pvz" placeholder="Адрес ПВЗ Яндекс / 5post *" />
    <div style="height:8px"></div>
    <input class="input" id="comment" placeholder="Комментарий (необязательно)" />

    <hr>
    <button class="btn" id="send" disabled>Перейти к менеджерке</button>
    <button class="btn" id="back">← Назад</button>
  `;

  const agree = document.getElementById("agree");
  const send = document.getElementById("send");

  function validate() {
    const ok =
      agree.checked &&
      document.getElementById("fio").value.trim() &&
      document.getElementById("phone").value.trim() &&
      document.getElementById("pvz").value.trim();
    send.disabled = !ok;
  }

  agree.addEventListener("change", validate);
  ["fio", "phone", "pvz", "comment"].forEach((id) => {
    document.getElementById(id).addEventListener("input", validate);
  });

  send.onclick = () => {
    const fio = document.getElementById("fio").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const pvz = document.getElementById("pvz").value.trim();
    const comment = document.getElementById("comment").value.trim();

    const lines = [];
    lines.push("🛒 Заказ LesPaw");
    lines.push("");
    lines.push(`👤 ФИО: ${fio}`);
    lines.push(`📞 Телефон: ${phone}`);
    lines.push(`📍 ПВЗ Яндекс / 5post: ${pvz}`);
    lines.push("");
    lines.push("📦 Заказ:");

    cart.forEach((it, idx) => {
      const p = getProductById(it.productId);
      const isSticker = p?.product_type === "sticker";

      let unit = Number(p?.price) || 0;
      if (isSticker && truthy(p.enable_print_base) && it.base === "holo_base") unit += settings.holo_base_price_delta;
      if (isSticker && truthy(p.enable_overlay) && it.overlay !== "none") unit += settings.overlay_price_delta;

      const qty = Number(it.qty) || 1;
      const lineTotal = unit * qty;

      lines.push(`${idx + 1}) ${p?.name || it.productId} ×${qty} — ${money(lineTotal)}`);

      if (isSticker) {
        lines.push(`   Основа: ${it.base === "holo_base" ? `голографическая (+${settings.holo_base_price_delta} ₽)` : "стандарт"}`);
        const ov = it.overlay === "none" ? "без" : `${OVERLAY_LABELS[it.overlay] || it.overlay} (+${settings.overlay_price_delta} ₽)`;
        lines.push(`   Покрытие: ${ov}`);
      }
    });

    lines.push("");
    lines.push(`💰 Итого: ${money(total)}`);
    lines.push("");
    lines.push("💬 Комментарий:");
    lines.push(comment || "—");

    const orderText = lines.join("\n");
    const url = `https://t.me/${MANAGER_USERNAME}?text=${encodeURIComponent(orderText)}`;
    tg?.openTelegramLink(url);
  };

  document.getElementById("back").onclick = () => renderCart();
}

function renderFavorites() {
  if (!fav.length) {
    view.innerHTML = `
      <div class="h2">Избранное</div>
      <div class="small">Пока ничего не добавлено.</div>
      <hr>
      <button class="btn" id="back">← Назад</button>`;
    document.getElementById("back").onclick = () => renderFandomTypes();
    return;
  }

  const items = fav.map((pid) => getProductById(pid)).filter(Boolean);

  view.innerHTML = `
    <div class="h2">Избранное</div>
    <div class="list">
      ${items
        .map(
          (p) => `
        <div class="item" data-id="${p.id}">
          <div><b>${p.name}</b></div>
          <div class="muted">${money(Number(p.price) || 0)} · ${p.product_type}</div>
        </div>`
        )
        .join("")}
    </div>
    <hr>
    <button class="btn" id="back">← Назад</button>
  `;

  view.querySelectorAll(".item").forEach((el) => (el.onclick = () => renderProduct(el.dataset.id)));
  document.getElementById("back").onclick = () => renderFandomTypes();
}

function renderInfo() {
  view.innerHTML = `
    <div class="h2">Важная информация</div>
    <div class="small">
      💳 Заказ собирается после <b>100% предоплаты</b>. Оплата на карту Т-Банка.<br><br>

      ⏳ Сборка и отправка — <b>4–5 дней</b>.<br>
      🚚 Доставка — <b>5–15 дней</b> (в зависимости от города).<br><br>

      📦 Доставка через Яндекс Доставку (ПВЗ Яндекс / 5post «Пятёрочка»).<br>
      💰 Стоимость доставки рассчитывается при оформлении.<br>
      ⏳ Срок хранения в ПВЗ — <b>6 дней</b>.<br><br>

      ❌ Возврат невозможен — товар изготавливается индивидуально под заказ.<br><br>

      🖨 Печать струйная, цвета могут незначительно отличаться от экрана.<br>
      ✂️ Наклейки не вырезаны по контуру — вырезаются самостоятельно.
    </div>
    <hr>
    <button class="btn" id="back">← Назад</button>
  `;
  document.getElementById("back").onclick = () => renderFandomTypes();
}

function renderReviews() {
  view.innerHTML = `
    <div class="h2">Отзывы</div>
    <div class="small">Все отзывы в Telegram:</div>
    <hr>
    <button class="btn" id="open">Открыть отзывы</button>
    <button class="btn" id="back">← Назад</button>
  `;
  document.getElementById("open").onclick = () => tg?.openTelegramLink("https://t.me/LesPaw/114");
  document.getElementById("back").onclick = () => renderFandomTypes();
}

function openExamples() {
  const url = settings.examples_url || "https://t.me/LesPaw";
  tg?.openTelegramLink(url);
}

function renderSearch(q) {
  const query = (q || "").toLowerCase().trim();
  if (!query) {
    renderFandomTypes();
    return;
  }

  const fHits = fandoms
    .filter((f) => truthy(f.is_active))
    .filter((f) => (f.fandom_name || "").toLowerCase().includes(query))
    .slice(0, 12);

  const pHits = products
    .filter((p) => {
      const hay = `${p.name || ""} ${p.description_short || ""} ${p.tags || ""}`.toLowerCase();
      return hay.includes(query);
    })
    .slice(0, 30);

  view.innerHTML = `
    <div class="h2">Поиск: “${q}”</div>

    <div class="small"><b>Фандомы</b></div>
    <div class="list">
      ${
        fHits
          .map(
            (f) =>
              `<div class="item" data-fid="${f.fandom_id}">${f.fandom_name} <span class="muted">· ${f.fandom_type}</span></div>`
          )
          .join("") || `<div class="small">Ничего не найдено</div>`
      }
    </div>

    <hr>

    <div class="small"><b>Товары</b></div>
    <div class="list">
      ${
        pHits
          .map(
            (p) =>
              `<div class="item" data-pid="${p.id}"><b>${p.name}</b><div class="muted">${money(
                Number(p.price) || 0
              )} · ${p.product_type}</div></div>`
          )
          .join("") || `<div class="small">Ничего не найдено</div>`
      }
    </div>
  `;

  view.querySelectorAll("[data-fid]").forEach((el) => (el.onclick = () => renderFandomPage(el.dataset.fid)));
  view.querySelectorAll("[data-pid]").forEach((el) => (el.onclick = () => renderProduct(el.dataset.pid)));
}
