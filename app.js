// LesPaw Mini App — app.js (финальная версия под твой UX)

// =====================
// НАСТРОЙКИ (твои CSV)
// =====================
const CSV_FANDOMS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ_WJrd_-W-ZSVqZqUs8YhumHkSjfHrt4xBV3nZEcUTRVyPeF15taLFiaw1gzJcK7m33sLjmkhP-Zk/pub?gid=0&single=true&output=csv";

const CSV_PRODUCTS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ_WJrd_-W-ZSVqZqUs8YhumHkSjfHrt4xBV3nZEcUTRVyPeF15taLFiaw1gzJcK7m33sLjmkhP-Zk/pub?gid=636991555&single=true&output=csv";

const CSV_SETTINGS_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSJ_WJrd_-W-ZSVqZqUs8YhumHkSjfHrt4xBV3nZEcUTRVyPeF15taLFiaw1gzJcK7m33sLjmkhP-Zk/pub?gid=2041657059&single=true&output=csv";

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
const cartCount = document.getElementById("cartCount");

const btnBack = document.getElementById("btnBack");
const btnFavTop = document.getElementById("btnFavTop");
const btnCartTop = document.getElementById("btnCartTop");

const btnCategories = document.getElementById("btnCategories");
const btnInfo = document.getElementById("btnInfo");
const btnReviews = document.getElementById("btnReviews");
const btnExamples = document.getElementById("btnExamples");
const globalSearch = document.getElementById("globalSearch");

// =====================
// Storage
// =====================
const LS_CART = "lespaw_cart_v2";
const LS_FAV = "lespaw_fav_v2";

function loadJSON(key, fallback) {
  try { return JSON.parse(localStorage.getItem(key)) ?? fallback; }
  catch { return fallback; }
}
function saveJSON(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

let cart = loadJSON(LS_CART, []);
let fav = loadJSON(LS_FAV, []);

function setCart(next) {
  cart = next;
  saveJSON(LS_CART, cart);
  updateCartBadge();
}
function setFav(next) {
  fav = next;
  saveJSON(LS_FAV, fav);
  updateFavBadge();
}

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
// Navigation
// =====================
let navStack = [];
let currentPageFn = null;

function syncBackButton() {
  btnBack.style.display = navStack.length ? "" : "none";
}
function openPage(renderFn) {
  if (currentPageFn) navStack.push(currentPageFn);
  currentPageFn = renderFn;
  syncBackButton();
  renderFn();
}
function goHome() {
  navStack = [];
  currentPageFn = renderFandomTypes;
  syncBackButton();
  renderFandomTypes();
}
function goBack() {
  const prev = navStack.pop();
  currentPageFn = prev || renderFandomTypes;
  syncBackButton();
  currentPageFn();
}
btnBack.onclick = () => goBack();

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
        if (s[i + 1] === '"') { field += '"'; i++; }
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

function firstImageUrl(p){
  const imgs = splitList(p?.images);
  return imgs[0] || "";
}

function updateCartBadge(){
  cartCount.textContent = cart.reduce((s,it)=>s+(Number(it.qty)||0),0);
}
function updateFavBadge(){
  btnFavTop.textContent = `Избранное (${fav.length})`;
}

// =====================
// Init
// =====================
async function init(){
  try{
    fandoms = await fetchCSV(CSV_FANDOMS_URL);
    products = await fetchCSV(CSV_PRODUCTS_URL);

    const s = await fetchCSV(CSV_SETTINGS_URL);
    s.forEach(row => {
      if(row.key){
        settings[row.key] =
          row.key.includes("delta") ? Number(row.value) : row.value;
      }
    });

    updateCartBadge();
    updateFavBadge();

    btnCartTop.onclick = () => openPage(renderCart);
    btnFavTop.onclick = () => openPage(renderFavorites);

    btnCategories.onclick = () => goHome();
    btnInfo.onclick = () => openPage(renderInfo);
    btnReviews.onclick = () => openPage(renderReviews);
    btnExamples.onclick = () => openExamples();

    globalSearch.oninput = e => {
      const q = e.target.value.trim();
      q ? openPage(()=>renderSearch(q)) : goHome();
    };

    goHome();
  } catch(e){
    view.innerHTML = `<div class="h2">Ошибка загрузки</div><div class="small">${e}</div>`;
  }
}
init();

// =====================
// Pages
// =====================
function renderFandomTypes(){
  view.innerHTML = `
    <div class="h2">Категории</div><hr>
    <div class="list">
      ${FANDOM_TYPES.map(t=>`
        <div class="item" data-t="${t}">
          <div class="title">${t}</div>
        </div>`).join("")}
    </div>`;
  view.querySelectorAll("[data-t]").forEach(el=>{
    el.onclick=()=>openPage(()=>renderFandomList(el.dataset.t));
  });
}

function renderFandomList(type){
  const list = fandoms
    .filter(f=>truthy(f.is_active)&&f.fandom_type===type)
    .sort((a,b)=>(a.fandom_name||"").localeCompare(b.fandom_name||"","ru"));

  const letters = list.filter(f=>!isDigitStart(f.fandom_name));
  const digits = list.filter(f=>isDigitStart(f.fandom_name));

  view.innerHTML = `
    <div class="h2">${type}</div><hr>
    <div class="list">
      ${letters.map(f=>`
        <div class="item" data-id="${f.fandom_id}">
          <div class="title">${f.fandom_name}</div>
        </div>`).join("")}
      ${digits.length?`<div class="small">0–9</div>`:""}
      ${digits.map(f=>`
        <div class="item" data-id="${f.fandom_id}">
          <div class="title">${f.fandom_name}</div>
        </div>`).join("")}
    </div>`;
  view.querySelectorAll("[data-id]").forEach(el=>{
    el.onclick=()=>openPage(()=>renderFandomPage(el.dataset.id));
  });
}

function renderFandomPage(fid){
  const f = getFandomById(fid);
  const all = products.filter(p=>p.fandom_id===fid);

  const tabs = ["all","sticker","pin","poster","box"];
  const names = {all:"Все",sticker:"Наклейки",pin:"Значки",poster:"Постеры",box:"Боксы"};

  view.innerHTML = `
    <div class="h2">${f?.fandom_name}</div>
    <div class="row" id="tabs">
      ${tabs.map(t=>`<button class="btn" data-t="${t}">${names[t]}</button>`).join("")}
    </div>
    <hr>
    <div class="list" id="prodList"></div>`;

  let cur="all";
  function setTabs(){
    document.querySelectorAll("#tabs .btn").forEach(b=>{
      b.classList.toggle("is-active",b.dataset.t===cur);
    });
  }
  function render(){
    const list = all.filter(p=>cur==="all"||p.product_type===cur);
    const el=document.getElementById("prodList");
    el.innerHTML = list.length?list.map(p=>{
      const img=firstImageUrl(p);
      return `
        <div class="item" data-id="${p.id}">
          <div class="prod-mini">
            <div class="thumb-mini">
              ${img?`<img src="${img}">`:`<div class="ph">🖼️</div>`}
            </div>
            <div class="text">
              <div class="title">${p.name}</div>
              <div class="meta">${money(p.price)} · ${p.product_type}</div>
            </div>
          </div>
        </div>`;
    }).join(""):`<div class="small">Пока нет товаров</div>`;
    el.querySelectorAll("[data-id]").forEach(i=>{
      i.onclick=()=>openPage(()=>renderProduct(i.dataset.id));
    });
  }
  document.querySelectorAll("#tabs .btn").forEach(b=>{
    b.onclick=()=>{cur=b.dataset.t;setTabs();render();};
  });
  setTabs();render();
}

/* ---- дальше renderProduct, renderCart, renderCheckout, renderFavorites,
   renderInfo, renderReviews, renderSearch, openExamples
   ОСТАЮТСЯ ТВОИ, БЕЗ ИЗМЕНЕНИЙ ---- */
