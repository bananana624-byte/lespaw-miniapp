// === НАСТРОЙКИ: ВСТАВЬ СЮДА ===
// 1) Ссылки из Google Sheets "Publish to web" (CSV)
const CSV_FANDOMS_URL  = "PASTE_FANDOMS_CSV_URL_HERE";
const CSV_PRODUCTS_URL = "PASTE_PRODUCTS_CSV_URL_HERE";
const CSV_SETTINGS_URL = "PASTE_SETTINGS_CSV_URL_HERE";

// 2) Менеджерка
const MANAGER_USERNAME = "LesPaw_manager"; // без @

// === Telegram init ===
const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

// === Storage ===
const LS_CART = "lespaw_cart_v1";
const LS_FAV  = "lespaw_fav_v1";

// cart item: { productId, qty, base: 'standard'|'holo_base', overlay: 'none'|'sugar'... }
function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; } catch { return fallback; }
}
function saveJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }

let cart = loadJSON(LS_CART, []);
let fav  = loadJSON(LS_FAV,  []);

function setCart(cartNew){ cart = cartNew; saveJSON(LS_CART, cart); updateCartBadge(); }
function setFav(favNew){ fav = favNew; saveJSON(LS_FAV, fav); }

// === DOM ===
const view = document.getElementById("view");
const cartCount = document.getElementById("cartCount");

document.getElementById("btnCategories").onclick = () => renderFandomTypes();
document.getElementById("btnCart").onclick = () => renderCart();
document.getElementById("btnInfo").onclick = () => renderInfo();
document.getElementById("btnReviews").onclick = () => renderReviews();
document.getElementById("btnExamples").onclick = () => openExamples();
document.getElementById("globalSearch").oninput = (e) => renderSearch(e.target.value);

// === Data ===
let fandoms = [];
let products = [];
let settings = {
  overlay_price_delta: 100,
  holo_base_price_delta: 100,
  examples_url: ""
};

// === CSV utils ===
function parseCSV(text) {
  // простая CSV: разделитель запятая, без сложных кавычек
  // Если в описаниях у тебя запятые, лучше позже перейти на backend/JSON.
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",").map(s => s.trim());
  return lines.slice(1).map(line => {
    const cols = line.split(","); // MVP
    const obj = {};
    headers.forEach((h, i) => obj[h] = (cols[i] ?? "").trim());
    return obj;
  });
}

async function fetchCSV(url) {
  const res = await fetch(url);
  if(!res.ok) throw new Error("CSV fetch failed: " + res.status);
  const text = await res.text();
  return parseCSV(text);
}

async function init() {
  try {
    fandoms = await fetchCSV(CSV_FANDOMS_URL);
    products = await fetchCSV(CSV_PRODUCTS_URL);
    const s = await fetchCSV(CSV_SETTINGS_URL);
    // settings в виде key/value
    s.forEach(row => {
      const k = row.key;
      const v = row.value;
      if(!k) return;
      if(k === "overlay_price_delta" || k === "holo_base_price_delta") settings[k] = Number(v);
      else settings[k] = v;
    });

    updateCartBadge();
    renderFandomTypes();
  } catch (e) {
    view.innerHTML = `<div class="h2">Ошибка загрузки данных</div><div class="small">${String(e)}</div>
    <hr><div class="small">Проверь ссылки CSV и что таблицы опубликованы.</div>`;
  }
}
init();

// === Helpers ===
function updateCartBadge() {
  const totalQty = cart.reduce((sum, it) => sum + (Number(it.qty)||0), 0);
  cartCount.textContent = String(totalQty);
}

const FANDOM_TYPES = [
  "Фильмы","Игры","Сериалы","Актрисы и певицы","Аниме","Мультсериалы",
  "Манхвы / манги","Лакорны","Что-то тематическое"
];

function getFandomById(id){ return fandoms.find(f => f.fandom_id === id); }
function getProductById(id){ return products.find(p => p.id === id); }

function isDigitStart(name) {
  return /^[0-9]/.test((name||"").trim());
}

function money(n){ return `${n} ₽`; }

// === Views ===
function renderFandomTypes(){
  view.innerHTML = `
    <div class="h2">Категории</div>
    <div class="small">Выбери тип фандома</div>
    <hr>
    <div class="list">
      ${FANDOM_TYPES.map(t => `<div class="item" data-type="${t}">${t}</div>`).join("")}
    </div>
    <hr>
    <div class="row">
      <button class="btn" id="btnFav">Избранное</button>
    </div>
  `;
  view.querySelectorAll(".item").forEach(el => {
    el.onclick = () => renderFandomList(el.dataset.type);
  });
  document.getElementById("btnFav").onclick = () => renderFavorites();
}

function renderFandomList(type){
  const list = fandoms
    .filter(f => (f.is_active||"").toUpperCase() === "TRUE")
    .filter(f => f.fandom_type === type)
    .sort((a,b) => (a.fandom_name||"").localeCompare(b.fandom_name||"", "ru"));

  const letters = list.filter(f => !isDigitStart(f.fandom_name));
  const digits  = list.filter(f =>  isDigitStart(f.fandom_name));

  view.innerHTML = `
    <div class="h2">${type}</div>
    <input class="input" id="fandomSearch" placeholder="Поиск фандома внутри категории…" />
    <hr>
    <div class="list" id="fandomList">
      ${letters.map(f => `<div class="item" data-id="${f.fandom_id}">${f.fandom_name}</div>`).join("")}
      ${digits.length ? `<div class="small">0–9</div>` : ""}
      ${digits.map(f => `<div class="item" data-id="${f.fandom_id}">${f.fandom_name}</div>`).join("")}
    </div>
    <hr>
    <button class="btn" id="back">← Назад</button>
  `;

  const fandomListEl = document.getElementById("fandomList");
  fandomListEl.querySelectorAll(".item").forEach(el => {
    el.onclick = () => renderFandomPage(el.dataset.id);
  });

  document.getElementById("back").onclick = () => renderFandomTypes();

  document.getElementById("fandomSearch").oninput = (e) => {
    const q = e.target.value.toLowerCase().trim();
    fandomListEl.querySelectorAll(".item").forEach(el => {
      const name = el.textContent.toLowerCase();
      el.style.display = name.includes(q) ? "" : "none";
    });
  };
}

function renderFandomPage(fandomId){
  const f = getFandomById(fandomId);
  const all = products.filter(p => p.fandom_id === fandomId);

  // фильтр по типу товара внутри фандома
  const typeTabs = ["all","sticker","pin","poster","box"];
  const tabNames = { all:"Все", sticker:"Наклейки", pin:"Значки", poster:"Постеры", box:"Боксы" };

  view.innerHTML = `
    <div class="h2">${f?.fandom_name || "Фандом"}</div>
    <div class="row" id="tabs">
      ${typeTabs.map(t => `<button class="btn" data-t="${t}">${tabNames[t]}</button>`).join("")}
    </div>
    <input class="input" id="inFandomSearch" placeholder="Поиск по товарам этого фандома…" />
    <hr>
    <div class="list" id="prodList"></div>
    <hr>
    <button class="btn" id="back">← Назад</button>
  `;

  let currentTab = "all";
  const prodList = document.getElementById("prodList");

  function renderList(){
    const q = document.getElementById("inFandomSearch").value.toLowerCase().trim();
    const filtered = all.filter(p => {
      if(currentTab !== "all" && p.product_type !== currentTab) return false;
      const hay = `${p.name||""} ${p.description_short||""} ${p.tags||""}`.toLowerCase();
      return hay.includes(q);
    });

    prodList.innerHTML = filtered.map(p => `
      <div class="item" data-id="${p.id}">
        <div><b>${p.name}</b></div>
        <div class="muted">${money(Number(p.price)||0)} · ${p.product_type}</div>
      </div>
    `).join("") || `<div class="small">Пока нет товаров в этом фандоме.</div>`;

    prodList.querySelectorAll(".item").forEach(el => {
      el.onclick = () => renderProduct(el.dataset.id);
    });
  }

  document.querySelectorAll("#tabs .btn").forEach(btn => {
    btn.onclick = () => { currentTab = btn.dataset.t; renderList(); };
  });

  document.getElementById("inFandomSearch").oninput = () => renderList();
  document.getElementById("back").onclick = () => renderFandomList(f.fandom_type);

  renderList();
}

function renderProduct(productId){
  const p = getProductById(productId);
  if(!p) return;

  const isSticker = p.product_type === "sticker";
  const enableBase = (p.enable_print_base||"").toUpperCase() === "TRUE";
  const enableOverlay = (p.enable_overlay||"").toUpperCase() === "TRUE";

  // default selections
  let selBase = "standard";
  let selOverlay = "none";

  const isFav = fav.includes(productId);

  function calcPrice(){
    let total = Number(p.price)||0;
    if(isSticker && enableBase && selBase === "holo_base") total += settings.holo_base_price_delta;
    if(isSticker && enableOverlay && selOverlay !== "none") total += settings.overlay_price_delta;
    return total;
  }

  function render(){
    view.innerHTML = `
      <div class="h2">${p.name}</div>
      <div class="small">${money(calcPrice())}</div>
      <hr>

      ${isSticker ? `
        <div class="small"><b>Опции наклеек</b></div>
        ${enableBase ? `
          <div class="small">Основа печати:</div>
          <div class="row">
            <button class="btn" id="baseStd">Стандарт (+0)</button>
            <button class="btn" id="baseHolo">Голографическая основа (+${settings.holo_base_price_delta})</button>
          </div>
        ` : ""}

        ${enableOverlay ? `
          <div class="small">Покрытие:</div>
          <div class="row" id="ovRow">
            ${[
              ["none","Без покрытия (+0)"],
              ["sugar","Сахар (+100)"],
              ["stars","Звёздочки (+100)"],
              ["snowflakes_small","Маленькие снежинки (+100)"],
              ["stars_big","Большие звёзды (+100)"],
              ["holo_overlay","Голографическая ламинация (+100)"],
            ].map(([id,label]) => `<button class="btn" data-ov="${id}">${label}</button>`).join("")}
          </div>
          <div class="row">
            <button class="btn" id="btnExamples2">Как выглядит?</button>
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
        <button class="btn" id="btnFav">${isFav ? "★ Убрать из избранного" : "☆ В избранное"}</button>
        <button class="btn" id="btnAdd">Добавить в корзину</button>
      </div>
      <hr>
      <button class="btn" id="back">← Назад</button>
    `;

    if(isSticker && enableBase){
      document.getElementById("baseStd").onclick = () => { selBase="standard"; render(); };
      document.getElementById("baseHolo").onclick = () => { selBase="holo_base"; render(); };
    }
    if(isSticker && enableOverlay){
      view.querySelectorAll("[data-ov]").forEach(b => {
        b.onclick = () => { selOverlay = b.dataset.ov; render(); };
      });
      document.getElementById("btnExamples2").onclick = () => openExamples();
    }

    document.getElementById("btnFav").onclick = () => {
      const newFav = fav.includes(productId) ? fav.filter(x => x !== productId) : [...fav, productId];
      setFav(newFav);
      renderProduct(productId);
    };

    document.getElementById("btnAdd").onclick = () => {
      const key = `${productId}::${selBase}::${selOverlay}`;
      const existing = cart.find(it => `${it.productId}::${it.base}::${it.overlay}` === key);
      if(existing){
        existing.qty = (Number(existing.qty)||1) + 1;
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

function renderCart(){
  if(!cart.length){
    view.innerHTML = `<div class="h2">Корзина</div><div class="small">В корзине пока пусто.</div><hr><button class="btn" id="back">← Назад</button>`;
    document.getElementById("back").onclick = () => renderFandomTypes();
    return;
  }

  let total = 0;
  const rows = cart.map((it, idx) => {
    const p = getProductById(it.productId);
    const isSticker = p?.product_type === "sticker";
    let price = Number(p?.price)||0;
    if(isSticker && (p.enable_print_base||"").toUpperCase()==="TRUE" && it.base==="holo_base") price += settings.holo_base_price_delta;
    if(isSticker && (p.enable_overlay||"").toUpperCase()==="TRUE" && it.overlay!=="none") price += settings.overlay_price_delta;
    const line = price * (Number(it.qty)||1);
    total += line;

    const f = getFandomById(p.fandom_id);
    const overlayName = it.overlay;

    return `
      <div class="item">
        <div><b>${p?.name || it.productId}</b></div>
        <div class="muted">${f?.fandom_name || ""} · ${p?.product_type || ""}</div>
        ${isSticker ? `<div class="muted">Основа: ${it.base === "holo_base" ? "голографическая (+100)" : "стандарт"}</div>` : ""}
        ${isSticker ? `<div class="muted">Покрытие: ${it.overlay === "none" ? "без" : overlayName + " (+100)"}</div>` : ""}
        <div class="muted">Цена за 1: ${money(price)} · Кол-во: ${it.qty} · Сумма: ${money(line)}</div>
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

  view.querySelectorAll("[data-dec]").forEach(b => b.onclick = () => {
    const i = Number(b.dataset.dec);
    const it = cart[i];
    it.qty = Math.max(1, (Number(it.qty)||1) - 1);
    setCart([...cart]); renderCart();
  });
  view.querySelectorAll("[data-inc]").forEach(b => b.onclick = () => {
    const i = Number(b.dataset.inc);
    const it = cart[i];
    it.qty = (Number(it.qty)||1) + 1;
    setCart([...cart]); renderCart();
  });
  view.querySelectorAll("[data-del]").forEach(b => b.onclick = () => {
    const i = Number(b.dataset.del);
    setCart(cart.filter((_,idx)=>idx!==i)); renderCart();
  });

  document.getElementById("checkout").onclick = () => renderCheckout(total);
  document.getElementById("back").onclick = () => renderFandomTypes();
}

function renderCheckout(total){
  view.innerHTML = `
    <div class="h2">Оформление</div>
    <div class="small">⚠️ После нажатия кнопки вас перебросит в Telegram-диалог с уже собранным текстом. Пожалуйста, отправьте сообщение <b>без изменений</b>.</div>
    <hr>
    <div class="small"><b>Важная информация</b></div>
    <div class="small">Заказ собирается после 100% предоплаты. Сборка 4–5 дней. Доставка Яндекс (ПВЗ/5post). Возврат невозможен (под заказ).</div>
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

  function validate(){
    const ok = agree.checked
      && document.getElementById("fio").value.trim()
      && document.getElementById("phone").value.trim()
      && document.getElementById("pvz").value.trim();
    send.disabled = !ok;
  }
  ["change","input"].forEach(evt => {
    agree.addEventListener(evt, validate);
    ["fio","phone","pvz","comment"].forEach(id => document.getElementById(id).addEventListener(evt, validate));
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
      let price = Number(p?.price)||0;
      if(isSticker && (p.enable_print_base||"").toUpperCase()==="TRUE" && it.base==="holo_base") price += settings.holo_base_price_delta;
      if(isSticker && (p.enable_overlay||"").toUpperCase()==="TRUE" && it.overlay!=="none") price += settings.overlay_price_delta;

      const qty = Number(it.qty)||1;
      const lineTotal = price * qty;

      const extra = [];
      if(isSticker) extra.push(`Основа: ${it.base==="holo_base" ? "голографическая (+100 ₽)" : "стандарт"}`);
      if(isSticker) extra.push(`Покрытие: ${it.overlay==="none" ? "без" : it.overlay + " (+100 ₽)"}`);

      lines.push(`${idx+1}) ${p?.name || it.productId} ×${qty} — ${money(lineTotal)}`);
      extra.forEach(x => lines.push(`   ${x}`));
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

function renderFavorites(){
  if(!fav.length){
    view.innerHTML = `<div class="h2">Избранное</div><div class="small">Пока ничего не добавлено.</div><hr><button class="btn" id="back">← Назад</button>`;
    document.getElementById("back").onclick = () => renderFandomTypes();
    return;
  }

  const items = fav.map(pid => getProductById(pid)).filter(Boolean);
  view.innerHTML = `
    <div class="h2">Избранное</div>
    <div class="list">
      ${items.map(p => `
        <div class="item" data-id="${p.id}">
          <div><b>${p.name}</b></div>
          <div class="muted">${money(Number(p.price)||0)} · ${p.product_type}</div>
        </div>
      `).join("")}
    </div>
    <hr>
    <button class="btn" id="back">← Назад</button>
  `;
  view.querySelectorAll(".item").forEach(el => el.onclick = () => renderProduct(el.dataset.id));
  document.getElementById("back").onclick = () => renderFandomTypes();
}

function renderInfo(){
  // MVP: просто открываем текст/страницу, позже подтянем из pages.json
  view.innerHTML = `
    <div class="h2">Важная информация</div>
    <div class="small">
      💳 Заказ собирается после 100% предоплаты (Т-Банк).<br><br>
      ⏳ Сборка и отправка — 4–5 дней.<br>
      🚚 Доставка — 5–15 дней.<br><br>
      📦 Доставка: Яндекс (ПВЗ) / 5post в «Пятёрочке».<br>
      ⏳ Хранение в ПВЗ — 6 дней.<br><br>
      ❌ Возврат невозможен (индивидуально под заказ).<br><br>
      🖨 Печать струйная, цвета могут немного отличаться от экрана.<br>
      ✂️ Наклейки нужно вырезать по контуру самостоятельно.
    </div>
    <hr>
    <button class="btn" id="back">← Назад</button>
  `;
  document.getElementById("back").onclick = () => renderFandomTypes();
}

function renderReviews(){
  // MVP: кнопка на телеграм-пост
  view.innerHTML = `
    <div class="h2">Отзывы</div>
    <div class="small">Все отзывы в Telegram:</div>
    <hr>
    <button class="btn" id="open">Открыть отзывы</button>
    <button class="btn" id="back">← Назад</button>
  `;
  document.getElementById("open").onclick = () => {
    tg?.openTelegramLink("https://t.me/LesPaw/114");
  };
  document.getElementById("back").onclick = () => renderFandomTypes();
}

function openExamples(){
  const url = settings.examples_url || "https://t.me/LesPaw";
  tg?.openTelegramLink(url);
}

function renderSearch(q){
  const query = (q||"").toLowerCase().trim();
  if(!query){
    renderFandomTypes();
    return;
  }

  // ищем фандомы по имени
  const fHits = fandoms
    .filter(f => (f.is_active||"").toUpperCase() === "TRUE")
    .filter(f => (f.fandom_name||"").toLowerCase().includes(query))
    .slice(0, 10);

  // ищем товары по имени/описанию/тегам
  const pHits = products
    .filter(p => {
      const hay = `${p.name||""} ${p.description_short||""} ${p.tags||""}`.toLowerCase();
      return hay.includes(query);
    })
    .slice(0, 20);

  view.innerHTML = `
    <div class="h2">Поиск: “${q}”</div>
    <div class="small"><b>Фандомы</b></div>
    <div class="list">
      ${fHits.map(f => `<div class="item" data-fid="${f.fandom_id}">${f.fandom_name} <span class="muted">· ${f.fandom_type}</span></div>`).join("") || `<div class="small">Ничего не найдено</div>`}
    </div>
    <hr>
    <div class="small"><b>Товары</b></div>
    <div class="list">
      ${pHits.map(p => `<div class="item" data-pid="${p.id}"><b>${p.name}</b><div class="muted">${money(Number(p.price)||0)} · ${p.product_type}</div></div>`).join("") || `<div class="small">Ничего не найдено</div>`}
    </div>
  `;

  view.querySelectorAll("[data-fid]").forEach(el => el.onclick = () => renderFandomPage(el.dataset.fid));
  view.querySelectorAll("[data-pid]").forEach(el => el.onclick = () => renderProduct(el.dataset.pid));
}
