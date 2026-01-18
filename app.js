(function () {
  // Telegram Mini App init (не ломает обычный браузер)
  var tg = (window.Telegram && window.Telegram.WebApp) ? window.Telegram.WebApp : null;
  try {
    if (tg && typeof tg.ready === "function") tg.ready();
    if (tg && typeof tg.expand === "function") tg.expand();
  } catch (e) {}

  function $(sel) { return document.querySelector(sel); }

  var toastEl = $("#toast");
  var searchInput = $("#globalSearch");
  var searchBtn = $("#searchBtn");

  var favBadge = $("#favBadge");
  var cartBadge = $("#cartBadge");

  var btnBack = $("#btnBack");
  var btnFav = $("#btnFav");
  var btnCart = $("#btnCart");

  // Безопасное чтение чисел
  function toInt(v) {
    var n = parseInt(v, 10);
    return isNaN(n) ? 0 : n;
  }

  // State (пока заглушка: localStorage; потом заменишь на реальный стор)
  var state = {
    favCount: toInt(localStorage.getItem("lespaw_fav")),
    cartCount: toInt(localStorage.getItem("lespaw_cart"))
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
    if (toastEl._t) clearTimeout(toastEl._t);
    toastEl._t = setTimeout(function () {
      toastEl.classList.remove("show");
    }, 1600);
  }

  // Init badges
  setBadge(favBadge, state.favCount);
  setBadge(cartBadge, state.cartCount);

  // Навигационные действия (заглушки)
  function go(action) {
    var map = {
      categories: "Открываю «Категории»…",
      lamination: "Открываю «Примеры ламинации и плёнки»…",
      reviews: "Открываю «Отзывы»…",
      info: "Открываю «Важная информация»…",
      fav: "Открываю «Избранное»…",
      cart: "Открываю «Корзина»…"
    };
    toast(map[action] || "Открываю…");
    // Если у тебя есть роутинг — сюда можно поставить location.hash = action;
  }

  // Cards click
  var cards = document.querySelectorAll(".card");
  for (var i = 0; i < cards.length; i++) {
    (function (btn) {
      btn.addEventListener("click", function () {
        go(btn.getAttribute("data-action"));
      });
    })(cards[i]);
  }

  // Bottom nav
  if (btnBack) {
    btnBack.addEventListener("click", function () {
      // Если есть история — назад, иначе (в TG) закрыть
      if (window.history && window.history.length > 1) {
        window.history.back();
      } else if (tg && typeof tg.close === "function") {
        tg.close();
      }
    });
  }

  if (btnFav) btnFav.addEventListener("click", function () { go("fav"); });
  if (btnCart) btnCart.addEventListener("click", function () { go("cart"); });

  // Search
  function runSearch() {
    var q = searchInput ? String(searchInput.value || "").trim() : "";
    if (!q) return toast("Введите запрос для поиска");
    toast("Ищу: «" + q + "»");
  }

  if (searchBtn) searchBtn.addEventListener("click", runSearch);
  if (searchInput) {
    searchInput.addEventListener("keydown", function (e) {
      if (e && e.key === "Enter") runSearch();
    });
  }

  // DEV: long-press для быстрого теста бейджей (можешь удалить)
  var pressTimer = null;

  function attachLongPress(el, onLong) {
    if (!el) return;

    function start() {
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = setTimeout(function () {
        onLong();
      }, 420);
    }

    function cancel() {
      if (pressTimer) clearTimeout(pressTimer);
      pressTimer = null;
    }

    el.addEventListener("pointerdown", start);
    el.addEventListener("pointerup", cancel);
    el.addEventListener("pointercancel", cancel);
    el.addEventListener("pointerleave", cancel);
  }

  attachLongPress(btnFav, function () {
    state.favCount = (state.favCount + 1) % 10;
    setBadge(favBadge, state.favCount);
    saveState();
    toast("Тест: избранное +1");
  });

  attachLongPress(btnCart, function () {
    state.cartCount = (state.cartCount + 1) % 10;
    setBadge(cartBadge, state.cartCount);
    saveState();
    toast("Тест: корзина +1");
  });
})();
