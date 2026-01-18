/* LesPaw Mini App — modern UI + bottom nav + glowing badges */

const TG = window.Telegram?.WebApp;

const STORE_KEYS = {
  fav: "lespaw_favorites_v1",
  cart: "lespaw_cart_v1",
};

// ----- Demo data (замени на свои данные из Google Sheets/CSV) -----
const CATEGORIES = [
  { id: "stickers", title: "Наклейки", subtitle: "сетики и штучки" },
  { id: "pins", title: "Значки", subtitle: "металл / акрил" },
  { id: "keychains", title: "Брелоки", subtitle: "милые лапки" },
  { id: "other", title: "Другое", subtitle: "всякое фандомное" },
];

const REVIEWS = [
  { name: "Крис", stars: 5, text: "Пришло быстро, качество супер, цвета прям 🔥" },
  { name: "Маша", stars: 5, text: "Упаковка такая заботливая, я растрогалась 🥺" },
  { name: "Лёля", stars: 5, text: "Наклейки держатся идеально, покрытие гладкое!" },
];

const COVERAGE_EXAMPLES = [
  { title: "Матовый ламинат", desc: "мягкий блеск, приятная текстура, меньше бликов" },
  { title: "Глянец", desc: "ярче цвета, заметный блеск, эффект “вау”" },
  { title: "Усиленная защита", desc: "для частого использования (телефон/ноут)" },
  { title: "Водостойкость", desc: "для бутылок/папок (аккуратно, без кипятка)" },
];

// Пример товаров (замени на парсинг CSV)
const PRODUCTS = [
  { id: "p1", title: "Стикерпак “Moon WLW”", price: 6.5, category: "stickers", tag: "новинка" },
  { id: "p2", title: "Значок “Cosmo Paw”", price: 8.0, category: "pins", tag: "хит" },
  { id: "p3", title: "Брелок “Neon Howl”", price: 9.5, category: "keychains", tag: "лимит" },
  { id: "p4", title: "Наклейка “Stardust”", price: 2.0, category: "stickers", tag: "штучно" },
  { id: "p5", title: "Значок “WLW Moon”", price: 7.0, category: "pins", tag: "классика" },
  { id: "p6", title: "Брелок “Night Pack”", price: 10.0, category: "keychains", tag: "сияние" },
];

// ----- State -----
let state = {
  selectedCategory: null,
  search: "",
  favorites: loadSet(STORE_KEYS.fav),
  cart: loadCart(STORE_KEYS.cart), // { [id]: qty }
};

// ----- Init -----
document.addEventListener("DOMContentLoaded", () => {
  setupTelegram();
  bindUI();
  renderAll();
});

function setupTelegram() {
  try {
    TG?.ready();
    TG?.expand();
    // Цвета телеги можно читать, но мы делаем свой неон-стиль
  } catch (e) {}
}

function bindUI() {
  const search = $("#globalSearch");
  search.addEventListener("input", (e) => {
    state.search = e.target.value.trim().toLowerCase();
    renderProducts();
  });

  $("#navBack").addEventListener("click", () => {
    // В телеге можно закрыть мини-апп
    if (TG) TG.close();
    else history.back();
  });

  $("#navFav").addEventListener("click", () => {
    // Быстро скроллим к товарам и фильтруем "избранное"
    state.selectedCategory = null;
    state.search = "";
    $("#globalSearch").value = "";
    renderProducts({ onlyFavorites: true });
    scrollToSection("products");
  });

  $("#navCart").addEventListener("click", () => {
    // Не открываем “корзину” после добавления — по твоему требованию.
    // Но по нажатию на иконку корзины — покажем аккуратный список через alert/Telegram popup.
    openCartQuickView();
  });

  $("#checkoutBtn").addEventListener("click", onCheckout);
  $("#agree").addEventListener("change", () => $("#agreeHint").classList.add("hidden"));
}

function renderAll() {
  renderCategories();
  renderReviews();
  renderCoverage();
  renderProducts();
  refreshBadges();
}

// ----- Render: Categories -----
function renderCategories() {
  const wrap = $("#categories");
  wrap.innerHTML = "";

  CATEGORIES.forEach(cat => {
    const el = document.createElement("div");
    el.className = "cat-card";
    el.innerHTML = `
      <div>
        <div class="cat-title">${escapeHtml(cat.title)}</div>
        <div class="cat-sub">${escapeHtml(cat.subtitle)}</div>
      </div>
      <div class="cat-right" aria-hidden="true">
        <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
          <path d="M9 18l6-6-6-6"></path>
        </svg>
      </div>
    `;

    el.addEventListener("click", () => {
      state.selectedCategory = cat.id;
      renderProducts();
      scrollToSection("products");
    });

    wrap.appendChild(el);
  });
}

// ----- Render: Reviews -----
function renderReviews() {
  const wrap = $("#reviews");
  wrap.innerHTML = "";

  REVIEWS.forEach(r => {
    const el = document.createElement("div");
    el.className = "review";
    el.innerHTML = `
      <div class="review-top">
        <div class="review-name">${escapeHtml(r.name)}</div>
        <div class="review-stars">${"★".repeat(r.stars)}${"☆".repeat(5-r.stars)}</div>
      </div>
      <div class="review-text">${escapeHtml(r.text)}</div>
    `;
    wrap.appendChild(el);
  });
}

// ----- Render: Coverage -----
function renderCoverage() {
  const wrap = $("#coverage");
  wrap.innerHTML = "";

  COVERAGE_EXAMPLES.forEach(c => {
    const el = document.createElement("div");
    el.className = "cover-card";
    el.innerHTML = `
      <div class="cover-title">${escapeHtml(c.title)}</div>
      <div class="cover-desc">${escapeHtml(c.desc)}</div>
      <div class="cover-glow" aria-hidden="true"></div>
    `;
    wrap.appendChild(el);
  });
}

// ----- Render: Products -----
function renderProducts(opts = {}) {
  const wrap = $("#products");
  wrap.innerHTML = "";

  const onlyFavorites = !!opts.onlyFavorites;

  const filtered = PRODUCTS.filter(p => {
    if (state.selectedCategory && p.category !== state.selectedCategory) return false;
    if (state.search) {
      const hay = (p.title + " " + p.category).toLowerCase();
      if (!hay.includes(state.search)) return false;
    }
    if (onlyFavorites && !state.favorites.has(p.id)) return false;
    return true;
  });

  $("#countLabel").textContent = String(filtered.length);

  filtered.forEach(p => {
    const isFav = state.favorites.has(p.id);
    const qty = state.cart[p.id] || 0;

    const el = document.createElement("div");
    el.className = "product";

    el.innerHTML = `
      <div class="p-tag">${escapeHtml(p.tag || "товар")}</div>

      <div class="p-title">${escapeHtml(p.title)}</div>

      <div class="p-meta">
        <div>${escapeHtml(categoryName(p.category))}</div>
        <div class="p-price">${formatPrice(p.price)}</div>
      </div>

      <div class="p-actions">
        <button class="btn btn-primary" type="button" data-add="${p.id}">
          ${qty > 0 ? `Добавить ещё (${qty})` : "В корзину"}
        </button>

        <button class="btn btn-ghost" type="button" data-fav="${p.id}" aria-label="В избранное">
          ${heartIcon(isFav)}
        </button>
      </div>
    `;

    wrap.appendChild(el);
  });

  // bind buttons (event delegation simple variant)
  wrap.querySelectorAll("[data-add]").forEach(btn => {
    btn.addEventListener("click", () => addToCart(btn.dataset.add));
  });

  wrap.querySelectorAll("[data-fav]").forEach(btn => {
    btn.addEventListener("click", () => toggleFav(btn.dataset.fav));
  });
}

// ----- Actions -----
function toggleFav(id) {
  if (state.favorites.has(id)) state.favorites.delete(id);
  else state.favorites.add(id);

  saveSet(STORE_KEYS.fav, state.favorites);
  renderProducts();
  refreshBadges();

  haptic("impact", "light");
}

function addToCart(id) {
  state.cart[id] = (state.cart[id] || 0) + 1;
  saveCart(STORE_KEYS.cart, state.cart);

  // важно: НЕ открываем корзину автоматически
  renderProducts();
  refreshBadges();

  haptic("impact", "medium");
  toast("Добавлено в корзину");
}

function openCartQuickView() {
  const items = Object.entries(state.cart).filter(([,q]) => q > 0);
  if (!items.length) {
    toast("Корзина пустая");
    return;
  }

  const lines = items.map(([id, qty]) => {
    const p = PRODUCTS.find(x => x.id === id);
    const title = p ? p.title : id;
    return `• ${title} × ${qty}`;
  });

  const text = `Корзина:\n\n${lines.join("\n")}\n\nНажми “Отправить заказ менеджерке” ниже, чтобы оформить.`;

  // В Telegram можно показать popup, иначе обычный alert
  if (TG?.showPopup) {
    TG.showPopup({
      title: "Корзина",
      message: text,
      buttons: [{ id: "ok", type: "ok", text: "Ок" }]
    });
  } else {
    alert(text);
  }
}

function onCheckout() {
  const agree = $("#agree").checked;
  const hint = $("#agreeHint");

  if (!agree) {
    hint.classList.remove("hidden");
    haptic("notification", "warning");
    return;
  }

  const items = Object.entries(state.cart).filter(([,q]) => q > 0);
  if (!items.length) {
    toast("В корзине ничего нет");
    haptic("notification", "warning");
    return;
  }

  const orderText = buildOrderText(items);

  // Открываем чат с менеджеркой + предзаполненный текст
  // Важно: Telegram на стороне клиента может позволить редактирование текста в поле ввода — мы это контролировать не можем.
  const username = "LesPaw_manager";
  const url = `https://t.me/${username}?text=${encodeURIComponent(orderText)}`;

  if (TG?.openTelegramLink) TG.openTelegramLink(url);
  else window.open(url, "_blank");

  haptic("notification", "success");
}

function buildOrderText(items) {
  const rows = items.map(([id, qty]) => {
    const p = PRODUCTS.find(x => x.id === id);
    const title = p ? p.title : id;
    const price = p ? p.price : 0;
    return `• ${title} × ${qty} = ${formatPrice(price * qty)}`;
  });

  const total = items.reduce((sum,[id,qty]) => {
    const p = PRODUCTS.find(x => x.id === id);
    return sum + (p ? p.price * qty : 0);
  }, 0);

  return [
    "Заказ из Mini App LesPaw:",
    "",
    ...rows,
    "",
    `Итого: ${formatPrice(total)}`,
    "",
    "Контакты/доставка: (напиши удобный способ и город)",
  ].join("\n");
}

// ----- Badges -----
function refreshBadges() {
  const favCount = state.favorites.size;
  const cartCount = Object.values(state.cart).reduce((a,b)=>a+b,0);

  setBadge($("#favBadge"), favCount);
  setBadge($("#cartBadge"), cartCount);
}

function setBadge(el, n) {
  if (!el) return;
  el.textContent = String(n);
  el.setAttribute("aria-label", String(n));
  if (n > 0) {
    el.classList.remove("hidden");
    el.classList.add("is-on");
  } else {
    el.classList.add("hidden");
    el.classList.remove("is-on");
  }
}

// ----- Utils -----
function $(sel){ return document.querySelector(sel); }

function categoryName(id){
  return (CATEGORIES.find(c=>c.id===id)?.title) || "Категория";
}

function formatPrice(x){
  // EUR style? Можно поменять под твою валюту.
  // Сделала нейтрально: "€12.50"
  const v = Math.round(x * 100) / 100;
  return `€${v.toFixed(2)}`;
}

function heartIcon(active){
  // minimal inline SVG (filled by gradient-ish via opacity)
  return active
    ? `<svg viewBox="0 0 24 24" width="20" height="20" fill="currentColor" style="opacity:.95">
         <path d="M12 21s-7.3-4.8-9.6-9C.7 8.1 3 4.6 6.8 4.2 9 4 10.8 5 12 6.6 13.2 5 15 4 17.2 4.2 21 4.6 23.3 8.1 21.6 12c-2.3 4.2-9.6 9-9.6 9z"/>
       </svg>`
    : `<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
         <path d="M20.8 4.6c-1.4-1.6-3.7-1.9-5.4-.7-.7.5-1.3 1.2-1.6 2-.3-.8-.9-1.5-1.6-2-1.7-1.2-4-.9-5.4.7-1.6 1.9-1.3 4.7.7 6.5l6.3 5.7 6.3-5.7c2-1.8 2.3-4.6.7-6.5z"></path>
       </svg>`;
}

function escapeHtml(s){
  return String(s)
    .replaceAll("&","&amp;")
    .replaceAll("<","&lt;")
    .replaceAll(">","&gt;")
    .replaceAll('"',"&quot;")
    .replaceAll("'","&#039;");
}

function loadSet(key){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  }catch{
    return new Set();
  }
}
function saveSet(key, set){
  localStorage.setItem(key, JSON.stringify(Array.from(set)));
}

function loadCart(key){
  try{
    const raw = localStorage.getItem(key);
    if(!raw) return {};
    const obj = JSON.parse(raw);
    return (obj && typeof obj === "object") ? obj : {};
  }catch{
    return {};
  }
}
function saveCart(key, cart){
  localStorage.setItem(key, JSON.stringify(cart));
}

function scrollToSection(id){
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior:"smooth", block:"start" });
}

function toast(msg){
  // микро-тост без библиотек
  const t = document.createElement("div");
  t.textContent = msg;
  t.style.position = "fixed";
  t.style.left = "14px";
  t.style.right = "14px";
  t.style.bottom = "90px";
  t.style.padding = "12px 14px";
  t.style.borderRadius = "16px";
  t.style.border = "1px solid rgba(255,255,255,.12)";
  t.style.background = "rgba(10,10,26,.78)";
  t.style.backdropFilter = "blur(12px)";
  t.style.color = "rgba(255,255,255,.92)";
  t.style.boxShadow = "0 18px 60px rgba(0,0,0,.45)";
  t.style.zIndex = "999";
  document.body.appendChild(t);

  setTimeout(()=> {
    t.style.transition = "opacity .25s ease";
    t.style.opacity = "0";
    setTimeout(()=> t.remove(), 260);
  }, 900);
}

function haptic(type, style){
  try{
    const h = TG?.HapticFeedback;
    if(!h) return;
    if(type === "impact") h.impactOccurred(style || "light");
    if(type === "notification") h.notificationOccurred(style || "success");
  }catch{}
}
