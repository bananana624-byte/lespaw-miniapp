// LesPaw Mini App — app.js (под новый современный UI с нижней нав-панелью)

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

// =====================
// Storage
// =====================
const LS_CART = "lespaw_cart_v3";
const LS_FAV = "lespaw_fav_v3";

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

let cart = loadJSON(LS_CART, []);
let fav = loadJSON(LS_FAV, []);

// =====================
// Toast
// =====================
function toast(msg, kind="") {
  const el = document.createElement("div");
  el.className = `toast ${kind}`.trim();
  el.textContent = msg;
  document.body.appendChild(el);
  setTimeout(() => el.remove(), 2200);
}

// =====================
// Navigation (страницы + назад снизу)
// =====================
const navStack = []; // хранит render-функции предыдущих страниц

function openPage(renderFn) {
  if (currentRender) navStack.push(currentRender);
  currentRender = renderFn;
  syncNav();
  renderFn();
}

function goBack() {
  const prev = navStack.pop();
  currentRender = prev || renderHome;
  syncNav();
  currentRender();
}

function resetToHome() {
  navStack.length = 0;
  currentRender = renderHome;
  syncNav();
  renderHome();
}

function syncNav() {
  // back активен только если есть история
  navBack.classList.toggle("is-active", navStack.length > 0);

  // active state для fav/cart (если открыта соответствующая страница)
  navFav.classList.toggle("is-active", currentRender === renderFavorites);
  navCart.classList.toggle("is-active", currentRender === renderCart);
}

let currentRender = null;

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
// CSV parser
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
        if (next === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else field += c;
    } else {
      if (c === '"') inQuotes = true;
      else if (c === ",") { row.push(field); field = ""; }
      else if (c === "\n") { row.push(field); rows.push(row); row = []; field = ""; }
      else field += c;
    }
  }
  row.push(field);
  rows.push(row);

  const cleaned = rows.filter(r => r.some(cell => String(cell).trim() !== ""));
  if (!cleaned.length) return [];

  const headers = cleaned[0].map(h => String(h).trim());
  return cleaned.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, idx) => obj[h] = (r[idx] ?? "").toString().trim());
    return obj;
  });
}

async function fetchCSV(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`CSV fetch failed (${res.status})`);
  return parseCSV(await res.text());
}

// =====================
// Helpers
// =====================
const FANDOM_TYPES = [
  "Фильмы","Игры","Сериалы","Актрисы и певицы","Аниме","Мультсериалы",
  "Манхвы / манги","Лакорны","Что-то тематическое"
];

const OVERLAY_OPTIONS = [
  ["none","Без покрытия"],
  ["sugar","Сахар"],
  ["stars","Звёздочки"],
  ["snowflakes_small","Маленькие снежинки"],
  ["stars_big","Большие звёзды"],
  ["holo_overlay","Голографическая ламинация"],
];
const OVERLAY_LABELS = Object.fromEntries(OVERLAY_OPTIONS);

function truthy(v){ return String(v||"").trim().toUpperCase() === "TRUE"; }
function money(n){ return `${Number(n)||0} ₽`; }
function splitList(s){ return (s||"").split(",").map(x=>x.trim()).filter(Boolean); }
function isDigitStart(name){ return /^[0-9]/.test((name||"").trim()); }

function getFandomById(id){ return fandoms.find(f => f.fandom_id === id); }
function getProductById(id){ return products.find(p => p.id === id); }

// badges
function updateBadges() {
  const favN = fav.length;
  const cartN = cart.reduce((sum,it)=>sum + (Number(it.qty)||0), 0);

  if (favN > 0) {
    favCount.style.display = "";
    favCount.textContent = String(favN);
  } else {
    favCount.style.display = "none";
  }

  if (cartN > 0) {
    cartCount.style.display = "";
    cartCount.textContent = String(cartN);
  } else {
    cartCount.style.display = "none";
  }
}

// cart helpers
function setCart(next){ cart = next; saveJSON(LS_CART, cart); updateBadges(); }
function setFav(next){ fav = next; saveJSON(LS_FAV, fav); updateBadges(); }

// =====================
// Init
// =====================
async function init() {
  try {
    fandoms = await fetchCSV(CSV_FANDOMS_URL);
    products = await fetchCSV(CSV_PRODUCTS_URL);

    const s = await fetchCSV(CSV_SETTINGS_URL);
    s.forEach(row => {
      const k = row.key;
      const v = row.value;
      if (!k) return;
      if (k === "overlay_price_delta" || k === "holo_base_price_delta") settings[k] = Number(v);
      else settings[k] = v;
    });

    updateBadges();

    navBack.onclick = () => goBack();
    navFav.onclick = () => openPage(renderFavorites);
    navCart.onclick = () => openPage(renderCart);

    globalSearch.oninput = (e) => {
      const q = e.target.value || "";
      if (q.trim()) openPage(() => renderSearch(q));
      else resetToHome();
    };

    resetToHome();
  } catch (e) {
    view.innerHTML = `
      <div class="card">
        <div class="h2">Ошибка загрузки данных</div>
        <div class="small">${String(e)}</div>
        <hr>
        <div class="small">Проверь публикацию таблиц и CSV-ссылки.</div>
      </div>
    `;
  }
}
init();

// =====================
// HOME — плитки
// =====================
function renderHome() {
  view.innerHTML = `
    <div class="grid2">
      <div class="tile" id="tCat">
        <div class="tileTitle">Категории</div>
        <div class="tileSub">Выбор фандома по типу</div>
      </div>

      <div class="tile" id="tInfo">
        <div class="tileTitle">Важная информация</div>
        <div class="tileSub">Оплата, сроки, доставка, возврат</div>
      </div>

      <div class="tile" id="tRev">
        <div class="tileTitle">Отзывы</div>
        <div class="tileSub">Пост с отзывами в Telegram</div>
      </div>

      <div class="tile" id="tEx">
        <div class="tileTitle">Примеры покрытий</div>
        <div class="tileSub">Как выглядит ламинация/голография</div>
      </div>
    </div>
  `;

  document.getElementById("tCat").onclick = () => openPage(renderFandomTypes);
  document.getElementById("tInfo").onclick = () => openPage(renderInfo);
  document.getElementById("tRev").onclick = () => openPage(renderReviews);
  document.getElementById("tEx").onclick = () => openExamples();

  syncNav();
}

// =====================
// Категории фандомов
// =====================
function renderFandomTypes() {
  view.innerHTML = `
    <div class="card">
      <div class="h2">Категории</div>
      <div class="small">Выбери тип фандома</div>
      <hr>
      <div class="list">
        ${FANDOM_TYPES.map(t => `
          <div class="item" data-type="${t}">
            <div class="title">${t}</div>
            <div class="meta">Открыть список фандомов</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  view.querySelectorAll("[data-type]").forEach(el => {
    el.onclick = () => openPage(() => renderFandomList(el.dataset.type));
  });

  syncNav();
}

function renderFandomList(type) {
  const list = fandoms
    .filter(f => truthy(f.is_active))
    .filter(f => f.fandom_type === type)
    .sort((a,b) => (a.fandom_name||"").localeCompare(b.fandom_name||"", "ru"));

  const letters = list.filter(f => !isDigitStart(f.fandom_name));
  const digits  = list.filter(f =>  isDigitStart(f.fandom_name));

  view.innerHTML = `
    <div class="card">
      <div class="h2">${type}</div>
      <div class="small">Фандомы по алфавиту</div>
      <hr>
      <div class="list">
        ${letters.map(f => `
          <div class="item" data-id="${f.fandom_id}">
            <div class="title">${f.fandom_name}</div>
            <div class="meta">Открыть товары фандома</div>
          </div>
        `).join("")}

        ${digits.length ? `<div class="small">0–9</div>` : ""}

        ${digits.map(f => `
          <div class="item" data-id="${f.fandom_id}">
            <div class="title">${f.fandom_name}</div>
            <div class="meta">Открыть товары фандома</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  view.querySelectorAll("[data-id]").forEach(el => {
    el.onclick = () => openPage(() => renderFandomPage(el.dataset.id));
  });

  syncNav();
}

function renderFandomPage(fandomId) {
  const f = getFandomById(fandomId);
  const all = products.filter(p => p.fandom_id === fandomId);

  const typeTabs = ["all","sticker","pin","poster","box"];
  const tabNames = { all:"Все", sticker:"Наклейки", pin:"Значки", poster:"Постеры", box:"Боксы" };

  view.innerHTML = `
    <div class="card">
      <div class="h2">${f?.fandom_name || "Фандом"}</div>
      <div class="row" id="tabs">
        ${typeTabs.map(t => `<button class="btn" data-t="${t}">${tabNames[t]}</button>`).join("")}
      </div>
      <hr>
      <div class="list" id="prodList"></div>
    </div>
  `;

  let currentTab = "all";

  function setActiveTab(){
    document.querySelectorAll("#tabs .btn").forEach(b => {
      b.classList.toggle("is-active", b.dataset.t === currentTab);
    });
  }

  function renderList(){
    const filtered = all.filter(p => currentTab === "all" ? true : p.product_type === currentTab);
    const prodList = document.getElementById("prodList");

    prodList.innerHTML = filtered.length ? filtered.map(p => `
      <div class="item" data-id="${p.id}">
        <div class="title">${p.name}</div>
        <div class="meta">${money(p.price)} · ${p.product_type}</div>
      </div>
    `).join("") : `<div class="small">Пока нет товаров.</div>`;

    prodList.querySelectorAll("[data-id]").forEach(el => {
      el.onclick = () => openPage(() => renderProduct(el.dataset.id));
    });
  }

  document.querySelectorAll("#tabs .btn").forEach(btn => {
    btn.onclick = () => { currentTab = btn.dataset.t; setActiveTab(); renderList(); };
  });

  setActiveTab();
  renderList();
  syncNav();
}

// =====================
// Товар
// =====================
function renderProduct(productId) {
  const p = getProductById(productId);
  if (!p) return;

  const isSticker = p.product_type === "sticker";
  const enableBase = truthy(p.enable_print_base);
  const enableOverlay = truthy(p.enable_overlay);

  let selBase = "standard";
  let selOverlay = "none";

  function calcUnitPrice(){
    let total = Number(p.price)||0;
    if (isSticker && enableBase && selBase === "holo_base") total += settings.holo_base_price_delta;
    if (isSticker && enableOverlay && selOverlay !== "none") total += settings.overlay_price_delta;
    return total;
  }

  function render(){
    const unit = calcUnitPrice();
    const imgs = splitList(p.images);
    const favOn = fav.includes(productId);

    const gallery = imgs.length ? `
      <div class="list">
        ${imgs.map(u => `
          <div class="item" style="cursor:default; padding:10px;">
            <img class="thumb" src="${u}" alt="Фото товара">
          </div>
        `).join("")}
      </div>
      <hr>
    ` : "";

    view.innerHTML = `
      <div class="card">
        <div class="h2">${p.name}</div>
        <div class="small"><b>${money(unit)}</b></div>
        <hr>

        ${gallery}

        ${isSticker ? `
          <div class="small"><b>Опции наклеек</b></div>

          ${enableBase ? `
            <div class="row">
              <button class="btn ${selBase==="standard"?"is-active":""}" id="baseStd">Стандарт (+0)</button>
              <button class="btn ${selBase==="holo_base"?"is-active":""}" id="baseHolo">Голографическая основа (+${settings.holo_base_price_delta})</button>
            </div>
          ` : ""}

          ${enableOverlay ? `
            <div class="row" id="ovRow" style="margin-top:10px;">
              ${OVERLAY_OPTIONS.map(([id,label]) => `
                <button class="btn ${selOverlay===id?"is-active":""}" data-ov="${id}">
                  ${label}${id==="none" ? " (+0)" : ` (+${settings.overlay_price_delta})`}
                </button>
              `).join("")}
            </div>

            <div class="row" style="margin-top:10px;">
              <button class="btn" id="btnExamples2">Примеры покрытий</button>
            </div>
          ` : ""}

          <hr>
        ` : ""}

        <div class="small"><b>Характеристики</b></div>
        <div class="small">Размер: ${p.size || "—"}</div>
        <div class="small">Материал: ${p.material || "—"} (${p.material_type || "—"})</div>
        <hr>

        <div class="small">${p.description_full || p.description_short || ""}</div>
        <hr>

        <div class="row">
          <button class="btn ${favOn ? "is-active":""}" id="btnFav">${favOn ? "★ В избранном" : "☆ В избранное"}</button>
          <button class="btn" id="btnAdd">Добавить в корзину</button>
        </div>
      </div>
    `;

    if (isSticker && enableBase){
      document.getElementById("baseStd").onclick = () => { selBase="standard"; render(); };
      document.getElementById("baseHolo").onclick = () => { selBase="holo_base"; render(); };
    }

    if (isSticker && enableOverlay){
      view.querySelectorAll("[data-ov]").forEach(b => {
        b.onclick = () => { selOverlay = b.dataset.ov; render(); };
      });
      document.getElementById("btnExamples2").onclick = () => openExamples();
    }

    document.getElementById("btnFav").onclick = () => {
      const next = fav.includes(productId) ? fav.filter(x=>x!==productId) : [...fav, productId];
      setFav(next);
      toast(next.includes(productId) ? "Добавлено в избранное ✨" : "Убрано из избранного", "good");
      render();
    };

    document.getElementById("btnAdd").onclick = () => {
      const key = `${productId}::${selBase}::${selOverlay}`;
      const existing = cart.find(it => `${it.productId}::${it.base}::${it.overlay}` === key);

      if (existing) existing.qty = (Number(existing.qty)||1) + 1;
      else cart.push({ productId, qty: 1, base: selBase, overlay: selOverlay });

      setCart([...cart]);
      toast("Добавлено в корзину ✨", "good");
    };

    syncNav();
  }

  render();
}

// =====================
// Корзина
// =====================
function calcUnitForCartItem(it){
  const p = getProductById(it.productId);
  if(!p) return 0;

  const isSticker = p.product_type === "sticker";
  let unit = Number(p.price)||0;

  if (isSticker && truthy(p.enable_print_base) && it.base==="holo_base") unit += settings.holo_base_price_delta;
  if (isSticker && truthy(p.enable_overlay) && it.overlay!=="none") unit += settings.overlay_price_delta;

  return unit;
}

function renderCart(){
  if(!cart.length){
    view.innerHTML = `
      <div class="card">
        <div class="h2">Корзина</div>
        <div class="small">Пока пусто.</div>
      </div>
    `;
    syncNav();
    return;
  }

  let total = 0;

  const rows = cart.map((it, idx) => {
    const p = getProductById(it.productId);
    const f = p ? getFandomById(p.fandom_id) : null;

    const unit = calcUnitForCartItem(it);
    const qty = Number(it.qty)||1;
    const line = unit * qty;
    total += line;

    const isSticker = p?.product_type === "sticker";
    const overlayText =
      it.overlay === "none"
        ? "без"
        : `${OVERLAY_LABELS[it.overlay] || it.overlay} (+${settings.overlay_price_delta})`;

    return `
      <div class="item" style="cursor:default">
        <div class="title">${p?.name || it.productId}</div>
        <div class="meta">${f?.fandom_name || ""} · ${p?.product_type || ""}</div>
        ${isSticker ? `<div class="meta">Основа: ${it.base==="holo_base" ? `голографическая (+${settings.holo_base_price_delta})` : "стандарт"}</div>` : ""}
        ${isSticker ? `<div class="meta">Покрытие: ${overlayText}</div>` : ""}
        <div class="meta">Цена за 1: ${money(unit)} · Кол-во: ${qty} · Сумма: ${money(line)}</div>
        <div class="row">
          <button class="btn" data-dec="${idx}">➖</button>
          <button class="btn" data-inc="${idx}">➕</button>
          <button class="btn" data-del="${idx}">Удалить</button>
        </div>
      </div>
    `;
  });

  view.innerHTML = `
    <div class="card">
      <div class="h2">Корзина</div>
      <div class="list">${rows.join("")}</div>
      <hr>
      <div class="small"><b>Итого: ${money(total)}</b></div>
      <hr>
      <button class="btn" id="checkout">Оформить заказ</button>
    </div>
  `;

  view.querySelectorAll("[data-dec]").forEach(b => b.onclick = () => {
    const i = Number(b.dataset.dec);
    const it = cart[i];
    it.qty = Math.max(1, (Number(it.qty)||1) - 1);
    setCart([...cart]);
    renderCart();
  });

  view.querySelectorAll("[data-inc]").forEach(b => b.onclick = () => {
    const i = Number(b.dataset.inc);
    const it = cart[i];
    it.qty = (Number(it.qty)||1) + 1;
    setCart([...cart]);
    renderCart();
  });

  view.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    const i = Number(b.dataset.del);
    setCart(cart.filter((_,idx)=>idx!==i));
    renderCart();
  });

  document.getElementById("checkout").onclick = () => openPage(() => renderCheckout(total));
  syncNav();
}

// =====================
// Оформление
// =====================
function renderCheckout(total){
  view.innerHTML = `
    <div class="card">
      <div class="h2">Оформление</div>
      <div class="small">
        ⚠️ После нажатия кнопки вас перебросит в Telegram-диалог с уже собранным текстом.
        Пожалуйста, отправьте сообщение <b>без изменений</b>.
      </div>
      <hr>

      <div class="small"><b>Важная информация</b></div>
      <div class="small">
        💳 Заказ собирается после <b>100% предоплаты</b> (Т-Банк).<br>
        ⏳ Сборка и отправка — <b>4–5 дней</b>.<br>
        📦 Доставка: Яндекс (ПВЗ) / 5post («Пятёрочка»).<br>
        ❌ Возврат невозможен (под заказ).
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
      <button class="btn" id="send">Перейти к менеджерке</button>
    </div>
  `;

  document.getElementById("send").onclick = () => {
    const agree = document.getElementById("agree").checked;
    const fio = document.getElementById("fio").value.trim();
    const phone = document.getElementById("phone").value.trim();
    const pvz = document.getElementById("pvz").value.trim();
    const comment = document.getElementById("comment").value.trim();

    if(!agree){
      toast("Поставь галочку и ознакомься с важной информацией 💚", "warn");
      return;
    }
    if(!fio || !phone || !pvz){
      toast("Заполни обязательные поля: ФИО, телефон и ПВЗ ✍️", "warn");
      return;
    }

    const lines = [];
    lines.push("🛒 Заказ LesPaw");
    lines.push("");
    lines.push(`👤 ФИО: ${fio}`);
    lines.push(`📞 Телефон: ${phone}`);
    lines.push(`📍 ПВЗ Яндекс / 5post: ${pvz}`);
    lines.push("");
    lines.push("📦 Заказ:");

    let computedTotal = 0;

    cart.forEach((it, idx) => {
      const p = getProductById(it.productId);
      const isSticker = p?.product_type === "sticker";

      const unit = calcUnitForCartItem(it);
      const qty = Number(it.qty)||1;
      const lineTotal = unit * qty;
      computedTotal += lineTotal;

      lines.push(`${idx+1}) ${p?.name || it.productId} ×${qty} — ${money(lineTotal)}`);

      if(isSticker){
        lines.push(`   Основа: ${it.base==="holo_base" ? `голографическая (+${settings.holo_base_price_delta} ₽)` : "стандарт"}`);
        const ov = it.overlay==="none" ? "без" : `${OVERLAY_LABELS[it.overlay] || it.overlay} (+${settings.overlay_price_delta} ₽)`;
        lines.push(`   Покрытие: ${ov}`);
      }
    });

    lines.push("");
    lines.push(`💰 Итого: ${money(computedTotal || total)}`);
    lines.push("");
    lines.push("💬 Комментарий:");
    lines.push(comment || "—");

    const orderText = lines.join("\n");
    const url = `https://t.me/${MANAGER_USERNAME}?text=${encodeURIComponent(orderText)}`;
    tg?.openTelegramLink(url);
  };

  syncNav();
}

// =====================
// Избранное
// =====================
function renderFavorites(){
  if(!fav.length){
    view.innerHTML = `
      <div class="card">
        <div class="h2">Избранное</div>
        <div class="small">Пока ничего нет.</div>
      </div>
    `;
    syncNav();
    return;
  }

  const items = fav.map(pid => getProductById(pid)).filter(Boolean);

  view.innerHTML = `
    <div class="card">
      <div class="h2">Избранное</div>
      <div class="list">
        ${items.map(p => `
          <div class="item" data-id="${p.id}">
            <div class="title">${p.name}</div>
            <div class="meta">${money(p.price)} · ${p.product_type}</div>
          </div>
        `).join("")}
      </div>
    </div>
  `;

  view.querySelectorAll("[data-id]").forEach(el => {
    el.onclick = () => openPage(() => renderProduct(el.dataset.id));
  });

  syncNav();
}

// =====================
// Инфо / отзывы / примеры
// =====================
function renderInfo(){
  view.innerHTML = `
    <div class="card">
      <div class="h2">Важная информация</div>
      <div class="small">
        💳 Заказ собирается после <b>100% предоплаты</b>. Оплата на карту Т-Банка.<br><br>

        ⏳ Сборка и отправка — <b>4–5 дней</b>.<br>
        🚚 Доставка — <b>5–15 дней</b> (в зависимости от города).<br><br>

        📦 Доставка через Яндекс Доставку:<br>
        — ПВЗ Яндекс<br>
        — 5post в «Пятёрочке»<br><br>

        💰 Стоимость доставки рассчитывается при оформлении.<br>
        ⏳ Хранение в ПВЗ — <b>6 дней</b>.<br><br>

        ❌ Возврат невозможен (изготовление под заказ).<br><br>

        🖨 Печать струйная — цвета могут немного отличаться от экрана.<br>
        ✂️ Наклейки нужно вырезать самостоятельно.<br><br>

        Индивидуальный заказ: <b>@LesPaw_manager</b>
      </div>
    </div>
  `;
  syncNav();
}

function renderReviews(){
  view.innerHTML = `
    <div class="card">
      <div class="h2">Отзывы</div>
      <div class="small">Откроется пост с отзывами в Telegram.</div>
      <hr>
      <button class="btn" id="openReviews">Открыть отзывы</button>
    </div>
  `;
  document.getElementById("openReviews").onclick = () => tg?.openTelegramLink("https://t.me/LesPaw/114");
  syncNav();
}

function openExamples(){
  const url = settings.examples_url || "https://t.me/LesPaw";
  tg?.openTelegramLink(url);
}

// =====================
// Поиск (только сверху)
// =====================
function renderSearch(q){
  const query = (q||"").toLowerCase().trim();

  const fHits = fandoms
    .filter(f => truthy(f.is_active))
    .filter(f => (f.fandom_name||"").toLowerCase().includes(query))
    .slice(0, 12);

  const pHits = products
    .filter(p => {
      const typeName = (p.product_type || "").toLowerCase();
      const hay = `${p.name||""} ${p.description_short||""} ${p.tags||""} ${typeName}`.toLowerCase();
      return hay.includes(query);
    })
    .slice(0, 30);

  view.innerHTML = `
    <div class="card">
      <div class="h2">Поиск: “${q}”</div>

      <div class="small"><b>Фандомы</b></div>
      <div class="list">
        ${fHits.length ? fHits.map(f => `
          <div class="item" data-fid="${f.fandom_id}">
            <div class="title">${f.fandom_name}</div>
            <div class="meta">${f.fandom_type}</div>
          </div>
        `).join("") : `<div class="small">Ничего не найдено</div>`}
      </div>

      <hr>

      <div class="small"><b>Товары</b></div>
      <div class="list">
        ${pHits.length ? pHits.map(p => `
          <div class="item" data-pid="${p.id}">
            <div class="title">${p.name}</div>
            <div class="meta">${money(p.price)} · ${p.product_type}</div>
          </div>
        `).join("") : `<div class="small">Ничего не найдено</div>`}
      </div>
    </div>
  `;

  view.querySelectorAll("[data-fid]").forEach(el => el.onclick = () => openPage(() => renderFandomPage(el.dataset.fid)));
  view.querySelectorAll("[data-pid]").forEach(el => el.onclick = () => openPage(() => renderProduct(el.dataset.pid)));

  syncNav();
}
