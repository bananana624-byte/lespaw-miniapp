/* app.js — LesPaw Mini App (Home / Categories / Products / Modals / Cart+Fav / Checkout) */

(() => {
  "use strict";

  /* -----------------------------
    Telegram WebApp (optional)
  ----------------------------- */
  const TG = window.Telegram?.WebApp || null;
  try {
    TG?.ready?.();
    TG?.expand?.();
  } catch (_) {}

  /* -----------------------------
    DOM
  ----------------------------- */
  const el = (id) => document.getElementById(id);

  const searchInput = el("searchInput");
  const searchClear = el("searchClear");
  const searchWrap = searchInput?.closest(".search");

  const homeBlocks = el("homeBlocks");
  const viewCategories = el("viewCategories");
  const viewProducts = el("viewProducts");
  const viewPage = el("viewPage");

  const categoriesGrid = el("categoriesGrid");
  const productsGrid = el("productsGrid");
  const emptyState = el("emptyState");
  const productsTitle = el("productsTitle");
  const productsHint = el("productsHint");

  const pageTitle = el("pageTitle");
  const pageSubtitle = el("pageSubtitle");
  const pageContent = el("pageContent");

  const navBack = el("navBack");
  const navFav = el("navFav");
  const navCart = el("navCart");
  const badgeFav = el("badgeFav");
  const badgeCart = el("badgeCart");

  // Product modal
  const productModal = el("productModal");
  const modalTitle = el("modalTitle");
  const modalMeta = el("modalMeta");
  const modalHero = el("modalHero");
  const modalPrice = el("modalPrice");
  const modalStock = el("modalStock");
  const modalDesc = el("modalDesc");
  const modalFav = el("modalFav");
  const modalAdd = el("modalAdd");

  // Favorites modal
  const favModal = el("favModal");
  const favList = el("favList");
  const favEmpty = el("favEmpty");

  // Cart modal
  const cartModal = el("cartModal");
  const cartList = el("cartList");
  const cartEmpty = el("cartEmpty");
  const cartTotal = el("cartTotal");
  const cartMeta = el("cartMeta");
  const agreeCheck = el("agreeCheck");
  const checkoutBtn = el("checkoutBtn");

  // Toast
  const toast = el("toast");

  /* -----------------------------
    State
  ----------------------------- */
  const LS = {
    fav: "lespaw_fav_v1",
    cart: "lespaw_cart_v1",
    lastCat: "lespaw_last_cat_v1",
  };

  /** @type {Array<Product>} */
  let PRODUCTS = [];
  /** @type {Map<string, Product>} */
  let BY_ID = new Map();

  let activeCategory = null; // string | null
  let lastProductsTitle = "Товары";

  // history stack: {screen, payload}
  const historyStack = [];

  const state = {
    fav: new Set(loadJSON(LS.fav, [])),
    cart: loadJSON(LS.cart, {}), // { [id]: qty }
    query: "",
    currentProductId: null,
  };

  /* -----------------------------
    Types (doc only)
  ----------------------------- */
  /**
   * @typedef {Object} Product
   * @property {string} id
   * @property {string} title
   * @property {string} fandom
   * @property {string} category
   * @property {string} type
   * @property {number} price
   * @property {string} currency
   * @property {string} image
   * @property {string} desc
   * @property {string} stock
   * @property {string[]} tags
   */

  /* -----------------------------
    Helpers
  ----------------------------- */
  function clamp(n, min, max) {
    return Math.max(min, Math.min(max, n));
  }

  function loadJSON(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (_) {
      return fallback;
    }
  }

  function saveJSON(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (_) {}
  }

  function formatPrice(n, currency = "₽") {
    const val = Number(n || 0);
    // без "Intl" чтобы везде было одинаково и компактно
    const parts = Math.round(val).toString().split("");
    // простая группировка
    let out = "";
    for (let i = 0; i < parts.length; i++) {
      const idx = parts.length - i;
      out += parts[i];
      if (idx > 1 && idx % 3 === 1) out += " ";
    }
    return `${out} ${currency}`.replace(/\s+/g, " ").trim();
  }

  function normalize(s) {
    return (s || "")
      .toString()
      .toLowerCase()
      .replace(/ё/g, "е")
      .replace(/\s+/g, " ")
      .trim();
  }

  function toastShow(text) {
    if (!toast) return;
    toast.textContent = text;
    toast.classList.remove("hidden");
    clearTimeout(toast._t);
    toast._t = setTimeout(() => toast.classList.add("hidden"), 1600);
  }

  function setBadge(badgeEl, value) {
    if (!badgeEl) return;
    const n = Number(value || 0);
    badgeEl.textContent = String(n);

    if (n > 0) {
      badgeEl.classList.remove("hidden");
      badgeEl.classList.add("glow");
    } else {
      badgeEl.classList.add("hidden");
      badgeEl.classList.remove("glow");
    }
  }

  function cartCount() {
    return Object.values(state.cart).reduce((sum, q) => sum + Number(q || 0), 0);
  }

  function favCount() {
    return state.fav.size;
  }

  function persist() {
    saveJSON(LS.fav, Array.from(state.fav));
    saveJSON(LS.cart, state.cart);
  }

  function closeAllModals() {
    [productModal, favModal, cartModal].forEach((m) => m?.classList.add("hidden"));
    document.body.style.overflow = "";
  }

  function openModal(modalEl) {
    if (!modalEl) return;
    modalEl.classList.remove("hidden");
    document.body.style.overflow = "hidden";
  }

  function setView(which) {
    // hide all views
    [homeBlocks, viewCategories, viewProducts, viewPage].forEach((v) =>
      v?.classList.add("hidden")
    );
    which?.classList.remove("hidden");
  }

  function pushHistory(screen, payload = {}) {
    historyStack.push({ screen, payload });
  }

  function popHistory() {
    return historyStack.pop() || null;
  }

  function currentScreen() {
    return historyStack.length ? historyStack[historyStack.length - 1].screen : "home";
  }

  function setSearchValue(v) {
    state.query = v || "";
    if (searchInput) searchInput.value = state.query;
    if (searchWrap) {
      if (state.query.trim()) searchWrap.classList.add("hasValue");
      else searchWrap.classList.remove("hasValue");
    }
  }

  /* -----------------------------
    Data loading (CSV)
  ----------------------------- */
  async function loadProducts() {
    // 1) пробуем products.csv рядом
    const tryPaths = [
      "products.csv",
      "./products.csv",
      "data/products.csv",
      "./data/products.csv",
    ];

    for (const path of tryPaths) {
      try {
        const res = await fetch(path, { cache: "no-store" });
        if (!res.ok) continue;
        const text = await res.text();
        const parsed = parseCSV(text);
        const normalized = normalizeProducts(parsed);
        if (normalized.length) return normalized;
      } catch (_) {}
    }

    // 2) демо-данные, чтобы всё работало сразу
    return demoProducts();
  }

  function parseCSV(text) {
    // простой CSV parser с кавычками
    const rows = [];
    let row = [];
    let cell = "";
    let inQuotes = false;

    const pushCell = () => {
      row.push(cell);
      cell = "";
    };
    const pushRow = () => {
      // игнор пустых строк
      if (row.some((c) => (c || "").trim() !== "")) rows.push(row);
      row = [];
    };

    for (let i = 0; i < text.length; i++) {
      const ch = text[i];

      if (ch === '"') {
        if (inQuotes && text[i + 1] === '"') {
          cell += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
        continue;
      }

      if (!inQuotes && (ch === "," || ch === ";")) {
        pushCell();
        continue;
      }

      if (!inQuotes && (ch === "\n" || ch === "\r")) {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        pushCell();
        pushRow();
        continue;
      }

      cell += ch;
    }

    // last
    pushCell();
    pushRow();

    if (!rows.length) return [];

    // header
    const header = rows[0].map((h) => normalize(h));
    const out = [];

    for (let r = 1; r < rows.length; r++) {
      const obj = {};
      for (let c = 0; c < header.length; c++) {
        obj[header[c] || `col_${c}`] = (rows[r][c] ?? "").toString().trim();
      }
      out.push(obj);
    }

    return out;
  }

  function normalizeProducts(rawRows) {
    // принимаем много вариантов названий колонок
    const pick = (obj, keys, fallback = "") => {
      for (const k of keys) {
        const nk = normalize(k);
        for (const ok of Object.keys(obj)) {
          if (normalize(ok) === nk) return (obj[ok] ?? "").toString().trim();
        }
        // а если уже нормализованный ключ
        if (obj[nk] != null) return (obj[nk] ?? "").toString().trim();
      }
      return fallback;
    };

    const out = [];
    for (const r of rawRows) {
      const id =
        pick(r, ["id", "uid", "sku"]) ||
        `${normalize(pick(r, ["title", "name", "товар", "название"]))}_${Math.random()
          .toString(16)
          .slice(2, 8)}`;

      const title = pick(r, ["title", "name", "название", "товар"], "Без названия");
      const fandom = pick(r, ["fandom", "фандом"], "");
      const category = pick(r, ["category", "категория", "group", "группа"], "Разное");
      const type = pick(r, ["type", "тип"], category);
      const priceRaw = pick(r, ["price", "цена"], "0").replace(",", ".");
      const price = Number(priceRaw) || 0;
      const currency = pick(r, ["currency", "валюта"], "₽") || "₽";
      const image = pick(r, ["image", "img", "photo", "картинка", "изображение", "url"], "");
      const desc = pick(r, ["desc", "description", "описание"], "");
      const stock = pick(r, ["stock", "остаток", "наличие"], "");
      const tagsRaw = pick(r, ["tags", "теги"], "");
      const tags = tagsRaw
        ? tagsRaw
            .split(/[,;|]/g)
            .map((t) => t.trim())
            .filter(Boolean)
        : [];

      out.push({
        id: String(id),
        title: String(title),
        fandom: String(fandom),
        category: String(category),
        type: String(type),
        price,
        currency,
        image: String(image),
        desc: String(desc),
        stock: String(stock),
        tags,
      });
    }
    return out;
  }

  function demoProducts() {
    return [
      {
        id: "demo_1",
        title: "Наклейка «Луна»",
        fandom: "Ориджинал",
        category: "Наклейки",
        type: "Наклейки",
        price: 120,
        currency: "₽",
        image: "",
        desc: "Демо-товар. Заменится, когда подключишь products.csv.\n\nМатериал: винил\nРазмер: ~6 см",
        stock: "В наличии",
        tags: ["винил", "луна"],
      },
      {
        id: "demo_2",
        title: "Значок «Неон»",
        fandom: "Ориджинал",
        category: "Значки",
        type: "Значки",
        price: 280,
        currency: "₽",
        image: "",
        desc: "Демо-товар.\n\nКрепление: бабочка\nДиаметр: 32 мм",
        stock: "Мало",
        tags: ["значок", "неон"],
      },
      {
        id: "demo_3",
        title: "Открытка «Космос»",
        fandom: "Ориджинал",
        category: "Открытки",
        type: "Открытки",
        price: 90,
        currency: "₽",
        image: "",
        desc: "Демо-товар.\n\nПлотная бумага, матовая.",
        stock: "В наличии",
        tags: ["открытка"],
      },
    ];
  }

  /* -----------------------------
    Rendering
  ----------------------------- */
  function rebuildIndex() {
    BY_ID = new Map(PRODUCTS.map((p) => [p.id, p]));
  }

  function uniqueCategories() {
    // категории для выбора — по полю category
    const map = new Map();
    for (const p of PRODUCTS) {
      const key = (p.category || "Разное").trim();
      map.set(key, (map.get(key) || 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ru"))
      .map(([name, count]) => ({ name, count }));
  }

  function renderCategories() {
    if (!categoriesGrid) return;
    const cats = uniqueCategories();

    categoriesGrid.innerHTML = cats
      .map(
        (c) => `
        <button class="chip ${activeCategory === c.name ? "isActive" : ""}" data-cat="${escapeAttr(
          c.name
        )}">
          <strong>${escapeHtml(c.name)}</strong>&nbsp; <span style="opacity:.8">(${c.count})</span>
        </button>
      `
      )
      .join("");

    categoriesGrid.querySelectorAll(".chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const cat = btn.getAttribute("data-cat");
        openProductsByCategory(cat);
      });
    });
  }

  function matchesQuery(p, q) {
    if (!q) return true;
    const blob = normalize(
      [
        p.title,
        p.fandom,
        p.category,
        p.type,
        p.desc,
        (p.tags || []).join(" "),
        p.stock,
      ].join(" ")
    );
    return blob.includes(q);
  }

  function filterProducts() {
    const q = normalize(state.query);
    return PRODUCTS.filter((p) => {
      const catOk = activeCategory ? (p.category || "").trim() === activeCategory : true;
      const qOk = matchesQuery(p, q);
      return catOk && qOk;
    });
  }

  function renderProducts() {
    if (!productsGrid) return;

    const list = filterProducts();
    productsGrid.innerHTML = list
      .map((p) => {
        const price = formatPrice(p.price, p.currency);
        const tag = (p.fandom || p.category || "").trim();
        const img = p.image?.trim();

        return `
        <button class="card" data-id="${escapeAttr(p.id)}">
          <div class="thumb">
            ${
              img
                ? `<img src="${escapeAttr(img)}" alt="${escapeAttr(p.title)}" loading="lazy" />`
                : `<div class="ph">PHOTO</div>`
            }
          </div>
          <div class="card__title">${escapeHtml(p.title)}</div>
          <div class="card__meta">
            <div class="card__price">${escapeHtml(price)}</div>
            ${tag ? `<div class="tag">${escapeHtml(tag)}</div>` : ""}
          </div>
        </button>
      `;
      })
      .join("");

    productsGrid.querySelectorAll(".card").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.getAttribute("data-id");
        openProductModal(id);
      });
    });

    if (emptyState) {
      if (!list.length) emptyState.classList.remove("hidden");
      else emptyState.classList.add("hidden");
    }
  }

  function renderFavModal() {
    if (!favList || !favEmpty) return;
    const ids = Array.from(state.fav).filter((id) => BY_ID.has(id));
    favEmpty.classList.toggle("hidden", ids.length > 0);

    favList.innerHTML = ids
      .map((id) => {
        const p = BY_ID.get(id);
        const img = p.image?.trim();
        return `
        <div class="item" data-id="${escapeAttr(p.id)}" role="button" tabindex="0">
          <div class="item__img">
            ${
              img
                ? `<img src="${escapeAttr(img)}" alt="${escapeAttr(p.title)}" loading="lazy" />`
                : `<div class="ph">PHOTO</div>`
            }
          </div>
          <div class="item__body">
            <div class="item__title">${escapeHtml(p.title)}</div>
            <div class="item__meta">
              <div class="item__price">${escapeHtml(formatPrice(p.price, p.currency))}</div>
              <div class="tag">${escapeHtml((p.fandom || p.category || " ") + "")}</div>
            </div>
          </div>
        </div>
      `;
      })
      .join("");

    favList.querySelectorAll(".item").forEach((row) => {
      const open = () => {
        const id = row.getAttribute("data-id");
        closeAllModals();
        openProductModal(id);
      };
      row.addEventListener("click", open);
      row.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") open();
      });
    });
  }

  function renderCartModal() {
    if (!cartList || !cartEmpty || !cartTotal || !cartMeta) return;

    const entries = Object.entries(state.cart)
      .map(([id, qty]) => ({ id, qty: Number(qty || 0) }))
      .filter((x) => x.qty > 0 && BY_ID.has(x.id));

    cartEmpty.classList.toggle("hidden", entries.length > 0);

    // meta hint
    if (entries.length > 0) {
      cartMeta.textContent = "Управляй количеством кнопками +/−";
    } else {
      cartMeta.textContent = "";
    }

    cartList.innerHTML = entries
      .map(({ id, qty }) => {
        const p = BY_ID.get(id);
        const img = p.image?.trim();
        return `
        <div class="item" data-id="${escapeAttr(id)}">
          <div class="item__img" data-open="${escapeAttr(id)}" role="button" tabindex="0" title="Открыть карточку">
            ${
              img
                ? `<img src="${escapeAttr(img)}" alt="${escapeAttr(p.title)}" loading="lazy" />`
                : `<div class="ph">PHOTO</div>`
            }
          </div>
          <div class="item__body">
            <div class="item__title" data-open="${escapeAttr(id)}" role="button" tabindex="0">
              ${escapeHtml(p.title)}
            </div>
            <div class="item__meta">
              <div class="item__price">${escapeHtml(formatPrice(p.price, p.currency))}</div>

              <div class="qty" aria-label="Количество">
                <button class="qty__minus" data-action="minus" aria-label="Уменьшить">−</button>
                <span>${qty}</span>
                <button class="qty__plus" data-action="plus" aria-label="Увеличить">+</button>
              </div>
            </div>
          </div>
        </div>
      `;
      })
      .join("");

    // open card from cart (image/title)
    cartList.querySelectorAll("[data-open]").forEach((node) => {
      const open = () => {
        const id = node.getAttribute("data-open");
        closeAllModals();
        openProductModal(id);
      };
      node.addEventListener("click", open);
      node.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") open();
      });
    });

    // qty handlers
    cartList.querySelectorAll(".item").forEach((row) => {
      const id = row.getAttribute("data-id");
      row.querySelectorAll("button[data-action]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const act = btn.getAttribute("data-action");
          if (act === "plus") setCartQty(id, (state.cart[id] || 0) + 1);
          if (act === "minus") setCartQty(id, (state.cart[id] || 0) - 1);
          renderCartModal();
          syncBadges();
        });
      });
    });

    // total
    const total = entries.reduce((sum, { id, qty }) => sum + BY_ID.get(id).price * qty, 0);
    cartTotal.textContent = formatPrice(total, "₽"); // общий итог в ₽ (как в твоём макете)
  }

  function syncBadges() {
    setBadge(badgeFav, favCount());
    setBadge(badgeCart, cartCount());
  }

  /* -----------------------------
    Navigation / screens
  ----------------------------- */
  function goHome({ resetSearch = false } = {}) {
    closeAllModals();
    activeCategory = null;
    if (resetSearch) setSearchValue("");
    setView(homeBlocks);
    pushHistory("home");
    renderCategories(); // на всякий
    syncBadges();
  }

  function openCategories() {
    closeAllModals();
    setView(viewCategories);
    pushHistory("categories");
    renderCategories();
    syncBadges();
  }

  function openProductsByCategory(catName) {
    closeAllModals();
    activeCategory = catName || null;

    if (activeCategory) localStorage.setItem(LS.lastCat, activeCategory);

    lastProductsTitle = activeCategory ? activeCategory : "Товары";
    if (productsTitle) productsTitle.textContent = lastProductsTitle;

    if (productsHint) {
      const q = state.query.trim();
      productsHint.textContent = q
        ? `Показаны результаты по категории и поиску: «${q}»`
        : activeCategory
          ? "Можно искать по названию, фандому, тегам."
          : "Можно искать по названию, фандому, тегам.";
    }

    setView(viewProducts);
    pushHistory("products", { category: activeCategory });
    renderProducts();
    syncBadges();
  }

  function openPage(key) {
    closeAllModals();
    const pages = getPages();
    const p = pages[key] || pages.info;

    pageTitle.textContent = p.title;
    pageSubtitle.textContent = p.subtitle || "";
    pageContent.textContent = p.content || "";

    setView(viewPage);
    pushHistory("page", { key });
    syncBadges();
  }

  function goBack() {
    closeAllModals();

    // сносим текущий экран
    popHistory();

    const prev = historyStack.length ? historyStack[historyStack.length - 1] : null;

    if (!prev) {
      goHome();
      return;
    }

    if (prev.screen === "home") {
      setView(homeBlocks);
      activeCategory = null;
      renderCategories();
      renderProducts();
      return;
    }

    if (prev.screen === "categories") {
      setView(viewCategories);
      renderCategories();
      return;
    }

    if (prev.screen === "products") {
      activeCategory = prev.payload?.category || null;
      if (productsTitle) productsTitle.textContent = activeCategory || "Товары";
      setView(viewProducts);
      renderProducts();
      return;
    }

    if (prev.screen === "page") {
      setView(viewPage);
      const pages = getPages();
      const p = pages[prev.payload?.key] || pages.info;
      pageTitle.textContent = p.title;
      pageSubtitle.textContent = p.subtitle || "";
      pageContent.textContent = p.content || "";
      return;
    }

    // fallback
    goHome();
  }

  /* -----------------------------
    Product modal actions
  ----------------------------- */
  function openProductModal(id) {
    const p = BY_ID.get(id);
    if (!p) return;

    state.currentProductId = id;

    modalTitle.textContent = p.title;
    modalMeta.textContent = [p.fandom, p.category].filter(Boolean).join(" • ");
    modalPrice.textContent = formatPrice(p.price, p.currency);

    const stockText = (p.stock || "").trim();
    modalStock.textContent = stockText ? stockText : "Уточнить наличие";
    modalDesc.textContent = p.desc || "";

    // hero
    const img = p.image?.trim();
    modalHero.innerHTML = img
      ? `<img src="${escapeAttr(img)}" alt="${escapeAttr(p.title)}" />`
      : `<div class="ph">PHOTO</div>`;

    // fav button
    const isFav = state.fav.has(id);
    modalFav.textContent = isFav ? "В избранном" : "В избранное";
    modalFav.classList.toggle("btn--solid", isFav);
    modalFav.classList.toggle("btn--ghost", !isFav);

    openModal(productModal);
  }

  function toggleFav(id) {
    if (!id) return;
    if (state.fav.has(id)) {
      state.fav.delete(id);
      toastShow("Убрано из избранного");
    } else {
      state.fav.add(id);
      toastShow("Добавлено в избранное 💜");
    }
    persist();
    syncBadges();
  }

  function setCartQty(id, qty) {
    const q = clamp(Number(qty || 0), 0, 999);
    if (q <= 0) delete state.cart[id];
    else state.cart[id] = q;
    persist();
    syncBadges();
  }

  function addToCart(id, qty = 1) {
    const cur = Number(state.cart[id] || 0);
    setCartQty(id, cur + Number(qty || 1));
    toastShow("Добавлено в корзину 🛒");
  }

  /* -----------------------------
    Checkout
  ----------------------------- */
  function buildOrderText() {
    const entries = Object.entries(state.cart)
      .map(([id, qty]) => ({ id, qty: Number(qty || 0) }))
      .filter((x) => x.qty > 0 && BY_ID.has(x.id));

    const lines = [];
    lines.push("🛍️ Заказ LesPaw");
    lines.push("");

    let total = 0;
    for (const { id, qty } of entries) {
      const p = BY_ID.get(id);
      const sum = p.price * qty;
      total += sum;

      const meta = [p.fandom, p.category].filter(Boolean).join(" • ");
      lines.push(`• ${p.title}${meta ? ` (${meta})` : ""}`);
      lines.push(`  Кол-во: ${qty}`);
      lines.push(`  Цена: ${formatPrice(p.price, p.currency)} / шт`);
      lines.push(`  Сумма: ${formatPrice(sum, p.currency)}`);
      lines.push("");
    }

    lines.push(`Итого: ${formatPrice(total, "₽")}`);
    lines.push("");
    lines.push("Пожалуйста, напишите мне способы оплаты/доставки и сроки 💜");

    return lines.join("\n");
  }

  async function openManagerChatWithText(text) {
    const username = "LesPaw_manager";
    const url = `https://t.me/${username}?text=${encodeURIComponent(text)}`;

    // 1) Telegram WebApp way (best inside mini app)
    try {
      if (TG?.openTelegramLink) {
        TG.openTelegramLink(url);
        return true;
      }
    } catch (_) {}

    // 2) fallback
    try {
      window.open(url, "_blank", "noopener,noreferrer");
      return true;
    } catch (_) {}

    return false;
  }

  async function copyToClipboardSafe(text) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch (_) {
      // fallback
      try {
        const ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.position = "fixed";
        ta.style.left = "-9999px";
        document.body.appendChild(ta);
        ta.select();
        document.execCommand("copy");
        document.body.removeChild(ta);
        return true;
      } catch (_) {
        return false;
      }
    }
  }

  async function checkout() {
    const count = cartCount();
    if (!count) {
      toastShow("Корзина пустая 😼");
      return;
    }

    if (!agreeCheck?.checked) {
      toastShow("Поставь галочку про важную информацию 🙏");
      // лёгкий “пинок” к чекбоксу
      try {
        agreeCheck?.focus?.();
      } catch (_) {}
      return;
    }

    const text = buildOrderText();

    // ВАЖНО: "без редактирования" в Telegram технически не гарантируется ссылкой,
    // но мы делаем максимально “жёстко”: открываем чат + копируем текст.
    const copied = await copyToClipboardSafe(text);
    const opened = await openManagerChatWithText(text);

    if (copied && opened) {
      toastShow("Заказ открыт у менеджерки + текст скопирован 💜");
    } else if (opened) {
      toastShow("Открыла чат менеджерки 💜");
    } else if (copied) {
      toastShow("Текст заказа скопирован 💜");
    } else {
      toastShow("Не получилось отправить — попробуй ещё раз 🥲");
      return;
    }

    // по желанию: НЕ очищаем корзину автоматически
    // если хочешь — раскомментируй:
    // state.cart = {};
    // persist(); syncBadges(); renderCartModal();
  }

  /* -----------------------------
    Pages content
  ----------------------------- */
  function getPages() {
    return {
      examples: {
        title: "Примеры ламинации и пленки",
        subtitle: "Как выглядит",
        content:
          "✨ Здесь будут фото/примеры ламинации, покрытий и плёнки.\n\n— Матовая / глянцевая\n— Плотность\n— Сравнение в жизни\n\n(Пока заглушка — скажешь текст/ссылки, красиво оформлю.)",
      },
      reviews: {
        title: "Отзывы",
        subtitle: "Отзывы от наших прекрасных покупательниц",
        content:
          "💜 Тут будут отзывы: скриншоты, цитаты, ссылки на посты.\n\n(Пока заглушка — дашь материалы, соберу блок аккуратно.)",
      },
      info: {
        title: "Важная информация",
        subtitle: "Оплата, сроки, доставка",
        content:
          "📌 Важное:\n\n• Оплата: ...\n• Сроки изготовления: ...\n• Доставка: ...\n• Возврат/обмен: ...\n\n(Пока заглушка — вставь свой актуальный текст.)",
      },
    };
  }

  /* -----------------------------
    Escaping
  ----------------------------- */
  function escapeHtml(s) {
    return (s ?? "")
      .toString()
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function escapeAttr(s) {
    return escapeHtml(s).replaceAll("\n", " ").replaceAll("\r", " ");
  }

  /* -----------------------------
    Events
  ----------------------------- */
  function bindModalClosers() {
    document.querySelectorAll("[data-close]").forEach((node) => {
      node.addEventListener("click", () => closeAllModals());
    });

    // close on ESC
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeAllModals();
    });
  }

  function bindHomeBlocks() {
    if (!homeBlocks) return;
    homeBlocks.querySelectorAll(".block").forEach((btn) => {
      btn.addEventListener("click", () => {
        const open = btn.getAttribute("data-open");
        if (open === "categories") openCategories();
        if (open === "examples") openPage("examples");
        if (open === "reviews") openPage("reviews");
        if (open === "info") openPage("info");
      });
    });
  }

  function bindSearch() {
    if (!searchInput) return;

    const apply = () => {
      setSearchValue(searchInput.value);
      // если мы на хоуме — просто остаёмся на хоуме (как витрина),
      // но поиск влияет на "Товары", когда пользователь откроет категорию/товары.
      if (currentScreen() === "products") {
        if (productsHint) {
          const q = state.query.trim();
          productsHint.textContent = q
            ? `Показаны результаты по категории и поиску: «${q}»`
            : activeCategory
              ? "Можно искать по названию, фандому, тегам."
              : "Можно искать по названию, фандому, тегам.";
        }
        renderProducts();
      }
      // если стоим в категориях — можно подсказать, но без лишнего
      if (currentScreen() === "categories") {
        // ничего
      }
    };

    searchInput.addEventListener("input", apply);
    searchInput.addEventListener("search", apply);

    searchClear?.addEventListener("click", () => {
      setSearchValue("");
      if (currentScreen() === "products") {
        if (productsHint) productsHint.textContent = activeCategory ? "Можно искать по названию, фандому, тегам." : "Можно искать по названию, фандому, тегам.";
        renderProducts();
      }
      searchInput.focus();
    });

    // init wrap state
    setSearchValue(searchInput.value || "");
  }

  function bindBottomNav() {
    navBack?.addEventListener("click", () => goBack());

    navFav?.addEventListener("click", () => {
      renderFavModal();
      openModal(favModal);
    });

    navCart?.addEventListener("click", () => {
      renderCartModal();
      openModal(cartModal);
    });
  }

  function bindProductModal() {
    modalFav?.addEventListener("click", () => {
      const id = state.currentProductId;
      if (!id) return;
      toggleFav(id);

      // обновим кнопку
      const isFav = state.fav.has(id);
      modalFav.textContent = isFav ? "В избранном" : "В избранное";
      modalFav.classList.toggle("btn--solid", isFav);
      modalFav.classList.toggle("btn--ghost", !isFav);
    });

    modalAdd?.addEventListener("click", () => {
      const id = state.currentProductId;
      if (!id) return;
      addToCart(id, 1);
      // IMPORTANT: по требованиям — НЕ открываем корзину после добавления
      // просто оставляем модалку товара открытой
      renderCartModal(); // на всякий, чтобы если откроют — было актуально
    });
  }

  function bindCheckout() {
  function bindCheckout() {
    checkoutBtn?.addEventListener("click", () => checkout());
  }

  /* -----------------------------
    Init + Global bindings
  ----------------------------- */
  async function init() {
    // Load products
    PRODUCTS = await loadProducts();
    rebuildIndex();

    // Restore last category (optional)
    try {
      const last = localStorage.getItem(LS.lastCat);
      if (last) activeCategory = last;
    } catch (_) {}

    // Bind UI
    bindModalClosers();
    bindHomeBlocks();
    bindSearch();
    bindBottomNav();
    bindProductModal();
    bindCheckout();

    // Initial state
    syncBadges();

    // Start at home with clean history
    historyStack.length = 0;
    setView(homeBlocks);
    pushHistory("home");

    // Pre-render categories (so it’s instant when opened)
    renderCategories();
  }

  /* -----------------------------
    Click outside sheets? (backdrop already handled by [data-close])
  ----------------------------- */

  /* -----------------------------
    Keyboard accessibility: close modals on backdrop click already
  ----------------------------- */

  /* -----------------------------
    Deep links / quick open (optional)
  ----------------------------- */
  // if you ever want to auto-open products when user starts typing on home:
  // not doing it now to match your “home as menu” UX.

  /* -----------------------------
    Run
  ----------------------------- */
  init();

})();
