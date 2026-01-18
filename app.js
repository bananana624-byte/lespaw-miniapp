// app.js
(() => {
  // Telegram Mini App friendly init (safe if opened in browser)
  const tg = window.Telegram?.WebApp;
  try {
    tg?.ready?.();
    tg?.expand?.();
  } catch (_) {}

  const $ = (sel) => document.querySelector(sel);

  const toastEl = $("#toast");
  const searchInput = $("#globalSearch");
  const searchBtn = $("#searchBtn");

  const favBadge = $("#favBadge");
  const cartBadge = $("#cartBadge");

  // --- Simple state (replace later with your real logic/storage) ---
  const state = {
    favCount: Number(localStorage.getItem("lespaw_fav") || 0),
    cartCount: Number(localStorage.getItem("lespaw_cart") || 0),
  };

  function setBadge(el, count) {
    if (!el) return;
    if (!count) {
      el.hidden = true;
      el.textContent = "0";
      el.classList.remove("glow");
      return;
    }
    el.hidden = false;
    el.textContent = String(count);
    el.classList.add("glow");
  }

  function saveState() {
    localStorage.setItem("lespaw_fav", String(state.favCount));
    localStorage.setItem("lespaw_cart", String(state.cartCount));
  }

  function toast(msg) {
    if (!toastEl) return;
    toastEl.textContent = msg;
    toastEl.classList.add("show");
    clearTimeout(toastEl.__t);
    toastEl.__t = setTimeout(() => toastEl.classList.remove("show"), 1600);
  }

  // init badges
  setBadge(favBadge, state.favCount);
  setBadge(cartBadge, state.cartCount);

  // --- Actions (stub navigation) ---
  function go(action) {
    // Тут ты потом подцепишь реальные экраны/роутинг.
    const map = {
      categories: "Открываю «Категории»…",
      lamination: "Открываю «Примеры ламинации и плёнки»…",
      reviews: "Открываю «Отзывы»…",
      info: "Открываю «Важная информация»…",
      fav: "Открываю «Избранное»…",
      cart: "Открываю «Корзина»…",
    };

    toast(map[action] || "Открываю…");

    // Example: if you use hash routing later
    // location.hash = action;
  }

  // cards click
  document.querySelectorAll(".card").forEach((btn) => {
    btn.addEventListener("click", () => go(btn.dataset.action));
  });

  // bottom nav
  $("#btnBack")?.addEventListener("click", () => {
    // Telegram back if inside webapp
    if (tg?.BackButton) {
      // If you manage your own stack, wire it here. For now, just close or history back.
      if (history.length > 1) history.back();
      else tg.close?.();
      return;
    }
    if (history.length > 1) history.back();
  });

  $("#btnFav")?.addEventListener("click", () => go("fav"));
  $("#btnCart")?.addEventListener("click", () => go("cart"));

  // search
  function runSearch() {
    const q = (searchInput?.value || "").trim();
    if (!q) return toast("Введите запрос для поиска");
    toast(`Ищу: «${q}»`);
    // later: filter catalog, open results page etc.
  }

  searchBtn?.addEventListener("click", runSearch);
  searchInput?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") runSearch();
  });

  // --- Dev helpers (you can delete) ---
  // Long-press badges to test glow/count quickly
  let pressTimer = null;

  function attachLongPress(el, onLong) {
    if (!el) return;
    const start = () => {
      clearTimeout(pressTimer);
      pressTimer = setTimeout(onLong, 420);
    };
    const cancel = () => clearTimeout(pressTimer);

    el.addEventListener("pointerdown", start);
    el.addEventListener("pointerup", cancel);
    el.addEventListener("pointercancel", cancel);
    el.addEventListener("pointerleave", cancel);
  }

  attachLongPress($("#btnFav"), () => {
    state.favCount = (state.favCount + 1) % 10;
    setBadge(favBadge, state.favCount);
    saveState();
    toast("Тест: избранное +1");
  });

  attachLongPress($("#btnCart"), () => {
    state.cartCount = (state.cartCount + 1) % 10;
    setBadge(cartBadge, state.cartCount);
    saveState();
    toast("Тест: корзина +1");
  });
})();
