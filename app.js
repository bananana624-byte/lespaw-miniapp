/* =========================================================
   LesPaw Mini App — app.js (FULL REDESIGN LOGIC)
   - Home: sticky search, categories, grid
   - Product page: mandatory options (lamination/film) for stickers & pins
   - Favorites + Cart: localStorage
   - Checkout: checkbox required + send to @LesPaw_manager with prefilled text (no edit)
   - Does NOT auto-open cart after adding
   - Background gradient fixed in CSS
   ========================================================= */

const MANAGER_USERNAME = "LesPaw_manager"; // without @
const STORAGE_KEY = "lespaw_state_v2";

/**
 * CSV source:
 * - If you already have CSV from Google Sheets on GitHub Pages, set it here.
 * - Example: "./data.csv" or "https://.../export?format=csv"
 */
const CSV_URL = "./products.csv"; // change if needed

// --- DOM ---
const el = (id) => document.getElementById(id);

const viewHome = el("viewHome");
const viewProduct = el("viewProduct");
const viewFav = el("viewFav");
const viewCart = el("viewCart");
const viewCheckout = el("viewCheckout");
const viewInfo = el("viewInfo");

const productGrid = el("productGrid");
const categoryChips = el("categoryChips");
const searchInput = el("searchInput");
const homeTitle = el("homeTitle");

const toastEl = el("toast");

// Product page
const productImage = el("productImage");
const productName = el("productName");
const productCategory = el("productCategory");
const productPrice = el("productPrice");
const productTags = el("productTags");
const productSpecs = el("productSpecs");
const productOptions = el("productOptions");
const btnFav = el("btnFav");
const btnCart = el("btnCart");

// Favorites/cart lists
const favList = el("favList");
const cartList = el("cartList");
const cartTotal = el("cartTotal");

// Checkout
const buyerName = el("buyerName");
const buyerContact = el("buyerContact");
const buyerCity = el("buyerCity");
const buyerDelivery = el("buyerDelivery");
const confirmCheck = el("confirmCheck");
const confirmRow = el("confirmRow");
const sendOrderBtn = el("sendOrderBtn");
const backToCartBtn = el("backToCartBtn");

// Nav
const navBack = el("navBack");
const navFav = el("navFav");
const navCart = el("navCart");
const favBadge = el("favBadge");
const cartBadge = el("cartBadge");

// Info
const infoBtn = el("infoBtn");
const closeInfoBtn = el("closeInfoBtn");

// Cart actions
const goCheckout = el("goCheckout");

// --- App state ---
let PRODUCTS = [];
let currentProduct = null;
let currentCategory = "Все";
let currentQuery = "";

let state = loadState();

// state shape
// {
//   favorites: { [productId]: true },
//   cart: { [key]: { productId, qty, selectedOptions } },
//   history: [] // simple view stack
// }

function defaultState() {
  return {
    favorites: {},
    cart: {},
    history: ["home"],
    form: {
      name: "",
      contact: "",
      city: "",
      delivery: "Почта",
      confirmed: false,
    },
  };
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  updateBadges();
}

function money(n) {
  const num = Number(n) || 0;
  return `${num.toLocaleString("ru-RU")} ₽`;
}

// --- Toast ---
let toastTimer = null;
function toast(msg, type = "") {
  toastEl.className = `toast ${type}`.trim();
  toastEl.textContent = msg;
  toastEl.classList.remove("hidden");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.add("hidden"), 2400);
}

// --- Routing / Views ---
function showView(name) {
  // Hide all
  [viewHome, viewProduct, viewFav, viewCart, viewCheckout, viewInfo].forEach(v => v.classList.add("hidden"));

  // Show requested
  if (name === "home") viewHome.classList.remove("hidden");
  if (name === "product") viewProduct.classList.remove("hidden");
  if (name === "fav") viewFav.classList.remove("hidden");
  if (name === "cart") viewCart.classList.remove("hidden");
  if (name === "checkout") viewCheckout.classList.remove("hidden");
  if (name === "info") viewInfo.classList.remove("hidden");

  // Nav active state (only for fav/cart; home has none)
  navFav.classList.toggle("active", name === "fav");
  navCart.classList.toggle("active", name === "cart" || name === "checkout");

  // Keep simple history (avoid duplicates)
  const last = state.history[state.history.length - 1];
  if (last !== name) state.history.push(name);
  saveState();
}

function back() {
  // pop current
  state.history.pop();
  const prev = state.history[state.history.length - 1] || "home";
  saveState();
  showView(prev);
}

// --- CSV loading ---
function parseCSV(text) {
  // Very small CSV parser (handles commas inside quotes)
  const rows = [];
  let row = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    const next = text[i + 1];

    if (ch === '"' && inQuotes && next === '"') {
      cur += '"';
      i++;
      continue;
    }

    if (ch === '"') {
      inQuotes = !inQuotes;
      continue;
    }

    if (ch === "," && !inQuotes) {
      row.push(cur);
      cur = "";
      continue;
    }

    if ((ch === "\n" || ch === "\r") && !inQuotes) {
      if (ch === "\r" && next === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.length > 1 || (row.length === 1 && row[0].trim() !== "")) rows.push(row);
      row = [];
      continue;
    }

    cur += ch;
  }

  if (cur.length || row.length) {
    row.push(cur);
    rows.push(row);
  }

  if (!rows.length) return [];

  const headers = rows[0].map(h => (h || "").trim());
  const items = [];

  for (let r = 1; r < rows.length; r++) {
    const obj = {};
    for (let c = 0; c < headers.length; c++) {
      obj[headers[c]] = (rows[r][c] ?? "").trim();
    }
    items.push(obj);
  }
  return items;
}

/**
 * Expected (recommended) CSV columns:
 * id, title, price, image, category, type, size, material, note,
 * lamination_options, film_options
 *
 * where:
 * type: "sticker" | "pin" | "other"
 * lamination_options example: "Глянцевая|Матовая"
 * film_options example: "Стандарт|Усиленная"
 *
 * If absent, app uses defaults:
 * stickers: lamination required
 * pins: film required
 */
function normalizeProduct(p) {
  const id = p.id || p.ID || p.Id || p.sku || p.SKU || p.title;
  const title = p.title || p.name || p.Name || "Без названия";
  const price = Number((p.price || p.Price || "0").replace(/[^\d.]/g, "")) || 0;
  const image = p.image || p.img || p.Image || "";
  const category = p.category || p.Category || "Другое";
  const typeRaw = (p.type || p.Type || "").toLowerCase();
  const type = typeRaw.includes("sticker") || category.toLowerCase().includes("накле") ? "sticker"
            : typeRaw.includes("pin") || category.toLowerCase().includes("знач") ? "pin"
            : (typeRaw || "other");

  const size = p.size || p.Size || "";
  const material = p.material || p.Material || "";
  const note = p.note || p.Note || "";

  const lamination_options = (p.lamination_options || p.lamination || p.Lamination || "")
    .split("|").map(s => s.trim()).filter(Boolean);

  const film_options = (p.film_options || p.film || p.Film || "")
    .split("|").map(s => s.trim()).filter(Boolean);

  // Defaults if missing
  const lamination = lamination_options.length ? lamination_options
    : (type === "sticker" ? ["Глянцевая", "Матовая"] : []);

  const film = film_options.length ? film_options
    : (type === "pin" ? ["Стандарт", "Усиленная"] : []);

  // Requirements
  const requiresLamination = type === "sticker";
  const requiresFilm = type === "pin";

  return {
    id: String(id),
    title,
    price,
    image,
    category,
    type,
    size,
    material,
    note,
    laminationOptions: lamination,
    filmOptions: film,
    requiresLamination,
    requiresFilm,
  };
}

async function loadProducts() {
  try {
    const res = await fetch(CSV_URL, { cache: "no-store" });
    if (!res.ok) throw new Error("CSV not found");
    const text = await res.text();
    const rawItems = parseCSV(text);
    const items = rawItems
      .filter(x => Object.keys(x).some(k => String(x[k] || "").trim() !== ""))
      .map(normalizeProduct);

    // Filter empty IDs just in case
    PRODUCTS = items.filter(p => p.id && p.title);
  } catch (e) {
    // Fallback demo products (so app doesn't die)
    PRODUCTS = [
      normalizeProduct({
        id: "demo-sticker-1",
        title: "Стикерпак «Аватар»",
        price: "390",
        image: "",
        category: "Наклейки",
        type: "sticker",
        size: "16×25 см",
        material: "плёнка (глянцевая)",
        note: "Струйная печать, цвета могут незначительно отличаться от экрана.",
        lamination_options: "Глянцевая|Матовая",
      }),
      normalizeProduct({
        id: "demo-pin-1",
        title: "Значок «Луна»",
        price: "250",
        image: "",
        category: "Значки",
        type: "pin",
        size: "38 мм",
        material: "металл",
        film_options: "Стандарт|Усиленная",
      })
    ];
  }
}

// --- UI builders ---
function buildCategoryChips() {
  const cats = new Set(["Все"]);
  PRODUCTS.forEach(p => cats.add(p.category));
  const list = Array.from(cats);

  categoryChips.innerHTML = "";
  list.forEach(cat => {
    const btn = document.createElement("button");
    btn.className = "chip" + (cat === currentCategory ? " active" : "");
    btn.textContent = cat;
    btn.addEventListener("click", () => {
      currentCategory = cat;
      buildCategoryChips();
      renderHome();
    });
    categoryChips.appendChild(btn);
  });
}

function matchesFilters(p) {
  const q = (currentQuery || "").trim().toLowerCase();
  const inCat = currentCategory === "Все" || p.category === currentCategory;
  if (!inCat) return false;
  if (!q) return true;
  return (p.title || "").toLowerCase().includes(q);
}

function renderHome() {
  const items = PRODUCTS.filter(matchesFilters);

  homeTitle.textContent = currentCategory === "Все"
    ? (currentQuery ? `Результаты: «${currentQuery}»` : "Товары")
    : (currentQuery ? `${currentCategory}: «${currentQuery}»` : currentCategory);

  productGrid.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "panel compact";
    empty.innerHTML = `
      <div class="section-title">Ничего не найдено</div>
      <div class="small">Попробуй другое слово или выбери категорию «Все».</div>
    `;
    productGrid.appendChild(empty);
    return;
  }

  items.forEach(p => {
    const card = document.createElement("div");
    card.className = "product-card";
    card.innerHTML = `
      <img class="product-thumb" src="${escapeAttr(p.image)}" alt="${escapeAttr(p.title)}" onerror="this.style.opacity=0.25; this.alt='';" />
      <div class="product-body">
        <div class="product-name">${escapeHtml(p.title)}</div>
        <div class="product-meta">
          <div class="price">${money(p.price)}</div>
          <div class="tag ${p.requiresLamination || p.requiresFilm ? "options" : ""}">
            ${p.requiresLamination ? "Ламинация" : p.requiresFilm ? "Плёнка" : " "}
          </div>
        </div>
      </div>
    `;
    card.addEventListener("click", () => openProduct(p.id));
    productGrid.appendChild(card);
  });
}

function renderFavorites() {
  const favIds = Object.keys(state.favorites).filter(id => state.favorites[id]);
  favList.innerHTML = "";

  if (!favIds.length) {
    favList.innerHTML = `
      <div class="panel compact">
        <div class="section-title">Пока пусто</div>
        <div class="small">Добавляй товары в избранное сердечком ⭐</div>
      </div>
    `;
    return;
  }

  favIds
    .map(id => PRODUCTS.find(p => p.id === id))
    .filter(Boolean)
    .forEach(p => {
      const item = document.createElement("div");
      item.className = "list-item";
      item.innerHTML = `
        <img src="${escapeAttr(p.image)}" alt="${escapeAttr(p.title)}" onerror="this.style.opacity=0.25;" />
        <div>
          <div class="title">${escapeHtml(p.title)}</div>
          <div class="meta">
            <div>${escapeHtml(p.category)}</div>
            <div><b>${money(p.price)}</b></div>
          </div>

          <div class="qty-row">
            <button class="btn-secondary" data-action="open">Открыть</button>
            <button class="btn-secondary" data-action="remove">Убрать</button>
          </div>
        </div>
      `;
      item.querySelector('[data-action="open"]').addEventListener("click", () => openProduct(p.id));
      item.querySelector('[data-action="remove"]').addEventListener("click", () => {
        delete state.favorites[p.id];
        saveState();
        renderFavorites();
        toast("Убрала из избранного");
      });
      favList.appendChild(item);
    });
}

function cartKey(productId, selectedOptions) {
  // stable key including options so same product with different options becomes separate line
  const opt = JSON.stringify(selectedOptions || {});
  return `${productId}__${opt}`;
}

function getCartItems() {
  return Object.values(state.cart || {});
}

function renderCart() {
  const items = getCartItems();
  cartList.innerHTML = "";

  if (!items.length) {
    cartList.innerHTML = `
      <div class="panel compact">
        <div class="section-title">Корзина пустая</div>
        <div class="small">Открой товар → выбери варианты → добавь в корзину ✨</div>
      </div>
    `;
    cartTotal.textContent = money(0);
    return;
  }

  let total = 0;

  items.forEach(line => {
    const p = PRODUCTS.find(x => x.id === line.productId);
    if (!p) return;

    total += (p.price * line.qty);

    const optText = formatOptions(line.selectedOptions);

    const row = document.createElement("div");
    row.className = "cart-item";
    row.innerHTML = `
      <img src="${escapeAttr(p.image)}" alt="${escapeAttr(p.title)}" onerror="this.style.opacity=0.25;" />
      <div>
        <div class="title">${escapeHtml(p.title)}</div>
        <div class="meta">
          <div>${escapeHtml(p.category)}${optText ? ` · ${escapeHtml(optText)}` : ""}</div>
          <div><b>${money(p.price)}</b></div>
        </div>

        <div class="qty-row">
          <button class="qty-btn" data-action="minus">−</button>
          <div class="qty-value">${line.qty}</div>
          <button class="qty-btn" data-action="plus">+</button>
          <button class="btn-secondary" data-action="remove" style="margin-left:auto;">Удалить</button>
        </div>
      </div>
    `;

    row.querySelector('[data-action="minus"]').addEventListener("click", () => changeQty(line.key, -1));
    row.querySelector('[data-action="plus"]').addEventListener("click", () => changeQty(line.key, +1));
    row.querySelector('[data-action="remove"]').addEventListener("click", () => removeFromCart(line.key));

    cartList.appendChild(row);
  });

  cartTotal.textContent = money(total);
}

function formatOptions(opts) {
  if (!opts) return "";
  const parts = [];
  if (opts.lamination) parts.push(`Ламинация: ${opts.lamination}`);
  if (opts.film) parts.push(`Плёнка: ${opts.film}`);
  return parts.join(", ");
}

function changeQty(key, delta) {
  const line = state.cart[key];
  if (!line) return;
  line.qty += delta;
  if (line.qty <= 0) delete state.cart[key];
  saveState();
  renderCart();
}

function removeFromCart(key) {
  delete state.cart[key];
  saveState();
  renderCart();
  toast("Убрала из корзины");
}

// --- Product page ---
function openProduct(productId) {
  const p = PRODUCTS.find(x => x.id === productId);
  if (!p) return;

  currentProduct = {
    ...p,
    selectedOptions: {
      lamination: "",
      film: ""
    }
  };

  // Fill UI
  productImage.src = p.image || "";
  productImage.alt = p.title;

  productName.textContent = p.title;
  productCategory.textContent = p.category;
  productPrice.textContent = money(p.price);

  // Tags
  productTags.innerHTML = "";
  if (p.requiresLamination) addTag("Ламинация обязательна");
  if (p.requiresFilm) addTag("Плёнка обязательна");
  if (!p.requiresLamination && !p.requiresFilm) addTag("Без вариантов");

  // Specs
  productSpecs.innerHTML = "";
  addSpec("Размер", p.size || "—");
  addSpec("Материал", p.material || "—");

  // Note override
  const note = p.note || "Струйная печать, цвета могут незначительно отличаться от экрана.";
  el("productNote").textContent = note;

  // Options
  productOptions.innerHTML = "";
  if (p.requiresLamination) {
    productOptions.appendChild(buildOptionGroup({
      id: "lamination",
      title: "Ламинация",
      options: p.laminationOptions,
      onSelect: (val) => {
        currentProduct.selectedOptions.lamination = val;
        validateProductOptions();
      }
    }));
  }
  if (p.requiresFilm) {
    productOptions.appendChild(buildOptionGroup({
      id: "film",
      title: "Плёнка",
      options: p.filmOptions,
      onSelect: (val) => {
        currentProduct.selectedOptions.film = val;
        validateProductOptions();
      }
    }));
  }

  // Fav button state
  syncFavButton();

  // Cart button state (must validate)
  validateProductOptions();

  // Bind actions
  btnFav.onclick = () => toggleFavorite(p.id);
  btnCart.onclick = () => addCurrentToCart();

  showView("product");
}

function addTag(text) {
  const span = document.createElement("span");
  span.className = "badge options";
  span.textContent = text;
  productTags.appendChild(span);
}

function addSpec(k, v) {
  const li = document.createElement("li");
  li.innerHTML = `<strong>${escapeHtml(k)}</strong><span>${escapeHtml(v)}</span>`;
  productSpecs.appendChild(li);
}

function buildOptionGroup({ id, title, options, onSelect }) {
  const wrap = document.createElement("div");
  wrap.className = "option-group";
  wrap.dataset.group = id;

  const h = document.createElement("div");
  h.className = "option-title";
  h.textContent = title;

  const row = document.createElement("div");
  row.className = "options";

  options.forEach(opt => {
    const b = document.createElement("button");
    b.className = "option-btn";
    b.type = "button";
    b.textContent = opt;
    b.setAttribute("aria-pressed", "false");
    b.addEventListener("click", () => {
      // toggle active within group
      row.querySelectorAll("button").forEach(x => {
        x.classList.remove("active");
        x.setAttribute("aria-pressed", "false");
      });
      b.classList.add("active");
      b.setAttribute("aria-pressed", "true");
      onSelect(opt);
    });
    row.appendChild(b);
  });

  wrap.appendChild(h);
  wrap.appendChild(row);
  return wrap;
}

function validateProductOptions() {
  if (!currentProduct) return;

  let ok = true;

  // remove invalid visuals
  productOptions.querySelectorAll(".option-group").forEach(g => g.classList.remove("invalid"));

  if (currentProduct.requiresLamination && !currentProduct.selectedOptions.lamination) {
    ok = false;
    const g = productOptions.querySelector('[data-group="lamination"]');
    g && g.classList.add("invalid");
  }
  if (currentProduct.requiresFilm && !currentProduct.selectedOptions.film) {
    ok = false;
    const g = productOptions.querySelector('[data-group="film"]');
    g && g.classList.add("invalid");
  }

  btnCart.disabled = !ok;
  btnCart.textContent = ok ? "Добавить в корзину" : "Выбери варианты";

  return ok;
}

function addCurrentToCart() {
  if (!currentProduct) return;
  if (!validateProductOptions()) {
    toast("Сначала выбери обязательные варианты 💜", "warn");
    return;
  }

  const selectedOptions = {};

  if (currentProduct.requiresLamination) selectedOptions.lamination = currentProduct.selectedOptions.lamination;
  if (currentProduct.requiresFilm) selectedOptions.film = currentProduct.selectedOptions.film;

  const key = cartKey(currentProduct.id, selectedOptions);

  if (!state.cart[key]) {
    state.cart[key] = {
      key,
      productId: currentProduct.id,
      qty: 1,
      selectedOptions
    };
  } else {
    state.cart[key].qty += 1;
  }

  saveState();
  toast("Добавлено в корзину ✨", "good");

  // IMPORTANT: do NOT open cart automatically
}

// --- Favorites ---
function toggleFavorite(productId) {
  const isFav = !!state.favorites[productId];
  if (isFav) delete state.favorites[productId];
  else state.favorites[productId] = true;

  saveState();
  syncFavButton();
  toast(isFav ? "Убрала из избранного" : "Добавлено в избранное", "good");
}

function syncFavButton() {
  if (!currentProduct) return;
  const isFav = !!state.favorites[currentProduct.id];
  btnFav.textContent = isFav ? "★ В избранном" : "☆ В избранное";
}

// --- Badges ---
function updateBadges() {
  const favCount = Object.keys(state.favorites).filter(id => state.favorites[id]).length;
  const cartCount = getCartItems().reduce((sum, x) => sum + (x.qty || 0), 0);

  if (favCount > 0) {
    favBadge.textContent = String(favCount);
    favBadge.classList.remove("hidden");
    navFav.classList.add("has-items");
  } else {
    favBadge.classList.add("hidden");
    navFav.classList.remove("has-items");
  }

  if (cartCount > 0) {
    cartBadge.textContent = String(cartCount);
    cartBadge.classList.remove("hidden");
    navCart.classList.add("has-items");
  } else {
    cartBadge.classList.add("hidden");
    navCart.classList.remove("has-items");
  }
}

// --- Checkout ---
function openCheckout() {
  // fill form from state
  buyerName.value = state.form?.name || "";
  buyerContact.value = state.form?.contact || "";
  buyerCity.value = state.form?.city || "";
  buyerDelivery.value = state.form?.delivery || "Почта";

  confirmCheck.checked = !!state.form?.confirmed;
  updateCheckoutButton();

  showView("checkout");
}

function updateCheckoutButton() {
  const ok = confirmCheck.checked;
  sendOrderBtn.disabled = !ok;

  confirmRow.style.borderColor = ok
    ? "rgba(68,255,176,0.28)"
    : "rgba(255,255,255,0.10)";
}

function saveFormToState() {
  state.form = {
    name: buyerName.value.trim(),
    contact: buyerContact.value.trim(),
    city: buyerCity.value.trim(),
    delivery: buyerDelivery.value,
    confirmed: confirmCheck.checked
  };
  saveState();
}

function buildOrderText() {
  const items = getCartItems();
  const lines = [];

  lines.push("🛒 Заказ LesPaw");
  lines.push("");
  lines.push(`Имя: ${buyerName.value.trim() || "—"}`);
  lines.push(`Контакт: ${buyerContact.value.trim() || "—"}`);
  lines.push(`Город: ${buyerCity.value.trim() || "—"}`);
  lines.push(`Доставка: ${buyerDelivery.value || "—"}`);
  lines.push("");
  lines.push("Товары:");

  let total = 0;

  items.forEach(line => {
    const p = PRODUCTS.find(x => x.id === line.productId);
    if (!p) return;

    const optText = formatOptions(line.selectedOptions);
    const one = p.price * line.qty;
    total += one;

    lines.push(`• ${p.title} ×${line.qty} — ${money(one)}${optText ? ` (${optText})` : ""}`);
  });

  lines.push("");
  lines.push(`Итого: ${money(total)}`);
  lines.push("");
  lines.push("✅ Подтверждаю заказ.");

  return lines.join("\n");
}

function sendOrder() {
  const items = getCartItems();
  if (!items.length) {
    toast("Корзина пустая 🙃", "warn");
    return;
  }
  if (!confirmCheck.checked) {
    toast("Поставь галочку подтверждения", "warn");
    return;
  }

  saveFormToState();

  const text = buildOrderText();
  const encoded = encodeURIComponent(text);

  // no edit: open direct TG link with prefilled text
  const url = `https://t.me/${MANAGER_USERNAME}?text=${encoded}`;

  // Telegram WebApp preferred
  if (window.TG && typeof window.TG.openTelegramLink === "function") {
    window.TG.openTelegramLink(url);
  } else if (window.TG && typeof window.TG.openLink === "function") {
    window.TG.openLink(url);
  } else {
    window.open(url, "_blank");
  }
}

// --- Helpers ---
function escapeHtml(s) {
  return String(s ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
function escapeAttr(s) {
  // attribute-safe (basic)
  return escapeHtml(s);
}

// --- Event listeners ---
searchInput.addEventListener("input", (e) => {
  currentQuery = e.target.value;
  renderHome();
});

navBack.addEventListener("click", () => back());
navFav.addEventListener("click", () => {
  renderFavorites();
  showView("fav");
});
navCart.addEventListener("click", () => {
  renderCart();
  showView("cart");
});

infoBtn.addEventListener("click", () => showView("info"));
closeInfoBtn.addEventListener("click", () => showView("home"));

goCheckout.addEventListener("click", () => openCheckout());
backToCartBtn.addEventListener("click", () => {
  renderCart();
  showView("cart");
});

confirmCheck.addEventListener("change", () => {
  updateCheckoutButton();
  saveFormToState();
});

[buyerName, buyerContact, buyerCity, buyerDelivery].forEach(inp => {
  inp.addEventListener("change", saveFormToState);
  inp.addEventListener("input", () => {
    // keep state fresh but lightweight
    saveFormToState();
  });
});

sendOrderBtn.addEventListener("click", () => sendOrder());

// --- Init ---
(async function init() {
  updateBadges();

  await loadProducts();

  buildCategoryChips();
  renderHome();
  showView("home");

  // If TG: expand view
  try { window.TG && window.TG.expand && window.TG.expand(); } catch(e) {}
})();
