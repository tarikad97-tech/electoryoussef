/* ==========================================
   إلكترو يوسف - Script.js
   الإعدادات + الاتصال بالـ API + الجلسة + لوحة التحكم + المنتجات + رفع الصور
   ========================================== */

// ---------- الإعدادات (غيّر الرابط من هنا فقط) ----------
const API_URL = "https://script.google.com/macros/s/AKfycbyESdtw_rV1z2n-ZB2wQztbkrKX_llKpg-SV4uSO8reGr1SfBfJurXjWLl_YBgzVwGckQ/exec";
const SESSION_KEY = "electro_admin_session";
const SESSION_HOURS = 6; // يجب ألا تزيد عن مدة الجلسة في Apps Script

// إعدادات ضغط الصور قبل الرفع
const IMAGE_MAX_SIDE = 1000;   // أكبر بُعد بالبكسل
const IMAGE_QUALITY = 0.82;    // جودة JPEG
const IMAGE_KEYS = ["image1", "image2", "image3", "image4"];

// الوصف و GIF
const MAX_GIFS = 8;                    // أقصى عدد GIF لكل منتج
const GIF_MAX_BYTES = 5 * 1024 * 1024; // أقصى حجم لكل GIF (5 ميغابايت)

const ORDER_STATUS_LABELS = {
  new: "جديد",
  confirmed: "مؤكد",
  shipped: "تم الإرسال",
  delivered: "تم التوصيل",
  cancelled: "ملغى"
};

const PRODUCT_STATUS_LABELS = { active: "نشط", inactive: "غير نشط" };

// حقول المنتج كما في نموذج الإضافة/التعديل
const PRODUCT_FIELDS = [
  "name", "price", "oldPrice", "image1", "image2", "image3", "image4",
  "description", "stock", "status"
];

// ---------- دوال مساعدة ----------

// منع حقن HTML عند عرض البيانات
function esc(v) {
  return String(v == null ? "" : v).replace(/[&<>"']/g, c => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]
  ));
}

function formatMoney(n) {
  return (Number(n) || 0).toLocaleString("en-US") + " د.م";
}

// رابط صورة Google Drive بحجم مصغّر (أسرع بكثير في التحميل)
function imgUrl(url, width) {
  url = String(url || "");
  if (url.indexOf("lh3.googleusercontent.com/d/") > -1 && !/=[whs]\d/i.test(url)) {
    return url + "=w" + width;
  }
  return url;
}

// صور GIF تُخزَّن داخل عمود الوصف بصيغة [[gif:الرابط]] (لا حاجة لأعمدة جديدة)
function splitDescription(desc) {
  const gifs = [];
  const text = String(desc || "")
    .replace(/\[\[gif:(https?:\/\/[^\]\s]+)\]\]/g, (m, url) => { gifs.push(url); return ""; })
    .trim();
  return { text: text, gifs: gifs };
}

function joinDescription(text, gifs) {
  return [text.trim()]
    .concat(gifs.map(u => "[[gif:" + u + "]]"))
    .filter(Boolean)
    .join("\n\n");
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).split(",")[1]);
    reader.onerror = () => reject(new Error("تعذر قراءة الملف"));
    reader.readAsDataURL(file);
  });
}

// ---------- مكوّنات مشتركة للمتجر (الرئيسية + صفحة المنتج) ----------

// نسبة التخفيض إن وُجد سعر قديم أعلى من الحالي
function discountPercent(p) {
  const price = Number(p.price);
  const old = Number(p.oldPrice);
  if (!(old > price) || !(price > 0)) return 0;
  return Math.round((1 - price / old) * 100);
}

// بطاقة منتج في القوائم (index: ترتيبها، أول 4 صور تُحمَّل مباشرة والباقي كسول)
function productCardHtml(p, index) {
  const href = "Product.html?id=" + encodeURIComponent(p.id);
  const hasImg = /^https?:\/\//i.test(p.image1 || "");
  const off = discountPercent(p);
  const out = !(Number(p.stock) > 0);
  const wasPrice = off ? '<span class="shop-was">' + formatMoney(p.oldPrice) + "</span>" : "";
  const loading = index < 4 ? "" : ' loading="lazy"';

  return '<article class="shop-card' + (out ? " is-out" : "") + '">' +
    '<a class="shop-img' + (hasImg ? "" : " no-img") + '" href="' + href + '" tabindex="-1" aria-hidden="true">' +
      (hasImg
        ? '<img src="' + esc(imgUrl(p.image1, 400)) + '" alt="' + esc(p.name) +
          '" width="400" height="400"' + loading + ' decoding="async">'
        : "") +
      (off ? '<span class="shop-off">خصم ' + off + "%</span>" : "") +
    "</a>" +
    '<div class="shop-body">' +
      '<h3 class="shop-name"><a href="' + href + '">' + esc(p.name) + "</a></h3>" +
      '<div class="shop-price"><span class="shop-now">' + formatMoney(p.price) + "</span>" + wasPrice + "</div>" +
      '<div class="shop-stock ' + (out ? "is-out" : "is-in") + '">' + (out ? "نفد المخزون" : "متوفر") + "</div>" +
      '<a class="btn btn-gold shop-btn" href="' + href + '">عرض المنتج</a>' +
    "</div>" +
  "</article>";
}

// ---------- تخزين مؤقت في المتصفح (يعرض البيانات فورًا ثم يحدّثها) ----------
// sessionStorage: يُمسح عند إغلاق التبويب وعند تسجيل الخروج

function cacheSave(key, value) {
  try { sessionStorage.setItem("electro_" + key, JSON.stringify(value)); } catch (e) { /* تجاهل */ }
}

function cacheLoad(key) {
  try { return JSON.parse(sessionStorage.getItem("electro_" + key)); } catch (e) { return null; }
}

function cacheClearAll() {
  try {
    Object.keys(sessionStorage)
      .filter(k => k.indexOf("electro_") === 0)
      .forEach(k => sessionStorage.removeItem(k));
  } catch (e) { /* تجاهل */ }
}

// ---------- الاتصال بالـ API ----------

// قراءة الرد والتحقق من نجاحه
async function parseResponse(res) {
  let json;
  const text = await res.text();
  try {
    json = JSON.parse(text);
  } catch (e) {
    // للفحص فقط: يعرض الرد الحقيقي في Console (F12)
    console.error("رد غير متوقع من الخادم:", res.status, text.slice(0, 500));
    throw new Error("حدث خطأ في الاتصال بالخادم");
  }
  if (!json.success) {
    const err = new Error(json.message || "حدث خطأ");
    err.auth = /انتهت الجلسة/.test(err.message); // خطأ جلسة منتهية
    throw err;
  }
  return json.data;
}

// طلب GET: apiGet({ action: "products" })
async function apiGet(params) {
  try {
    const res = await fetch(API_URL + "?" + new URLSearchParams(params));
    return await parseResponse(res);
  } catch (e) {
    throw normalizeError(e);
  }
}

// طلب POST: apiPost({ action: "login", ... })
// نستخدم text/plain لتجنب مشاكل CORS مع Apps Script
async function apiPost(body) {
  try {
    const res = await fetch(API_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain;charset=utf-8" },
      body: JSON.stringify(body)
    });
    return await parseResponse(res);
  } catch (e) {
    throw normalizeError(e);
  }
}

// أخطاء الشبكة تظهر بالعربية
function normalizeError(e) {
  if (e instanceof TypeError) return new Error("تعذر الاتصال بالخادم، تحقق من الإنترنت");
  return e;
}

// ---------- الجلسة ----------

function saveSession(data) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({
    token: data.token,
    username: data.username,
    expires: Date.now() + SESSION_HOURS * 3600 * 1000
  }));
}

// تعيد الجلسة أو null إذا لم تكن موجودة أو انتهت
function getSession() {
  try {
    const s = JSON.parse(localStorage.getItem(SESSION_KEY));
    if (s && s.token && s.expires > Date.now()) return s;
  } catch (e) { /* تجاهل */ }
  localStorage.removeItem(SESSION_KEY);
  return null;
}

function clearSession() {
  localStorage.removeItem(SESSION_KEY);
  cacheClearAll();
}

// معاملات الطلبات الإدارية (تتضمن الـ token)
function authParams(action) {
  const s = getSession();
  if (!s) {
    const err = new Error("انتهت الجلسة، يرجى تسجيل الدخول من جديد");
    err.auth = true;
    throw err;
  }
  return { action: action, token: s.token };
}

// ---------- تسجيل الدخول والخروج ----------

async function login(username, password) {
  const data = await apiPost({ action: "login", username: username, password: password });
  saveSession(data);
  return data;
}

function logout() {
  clearSession();
  location.reload();
}

// ---------- دوال البيانات الإدارية ----------

// قائمة خفيفة بدون الوصف الطويل (أسرع)، والوصف الكامل يُجلب عند التعديل
function getProducts() { return apiGet(Object.assign(authParams("products"), { light: "1" })); }
function getProduct(id) { return apiGet(Object.assign(authParams("product"), { id: id })); }
function getOrders()    { return apiGet(authParams("orders")); }
function getDashboard() { return apiGet(authParams("dashboard")); } // إحصائيات + آخر الطلبات في طلب واحد

// تغيير حالة الطلب: confirmed / shipped / delivered
function updateOrder(id, status) {
  return apiPost(Object.assign({}, authParams("updateOrder"), { id: id, status: status }));
}

// حذف الطلب نهائيًا (من Google Sheets أيضًا)
function deleteOrder(id) {
  return apiPost(Object.assign({}, authParams("deleteOrder"), { id: id }));
}

function addProduct(product) {
  return apiPost(Object.assign({}, authParams("addProduct"), product));
}

function updateProduct(id, product) {
  return apiPost(Object.assign({}, authParams("updateProduct"), { id: id }, product));
}

// حذف المنتج نهائيًا (مع صوره)
function deleteProduct(id) {
  return apiPost(Object.assign({}, authParams("deleteProduct"), { id: id, hard: true }));
}

// تفعيل/تعطيل المنتج فقط
function setProductStatus(id, status) {
  return apiPost(Object.assign({}, authParams("setProductStatus"), { id: id, status: status }));
}

function uploadImage(base64, mime) {
  return apiPost(Object.assign({}, authParams("uploadImage"), { data: base64, mime: mime }));
}

// التحقق من بيانات المنتج قبل الإرسال (يعيد نص الخطأ أو "")
function validateProduct(v) {
  if (!v.name || !v.price) return "يرجى ملء جميع الحقول";
  if (!(Number(v.price) > 0)) return "السعر غير صحيح";
  if (v.oldPrice !== "" && !(Number(v.oldPrice) >= 0)) return "السعر القديم غير صحيح";
  if (v.stock !== "" && !(Number.isInteger(Number(v.stock)) && Number(v.stock) >= 0)) {
    return "المخزون غير صحيح";
  }
  return "";
}

// تحويل قيم النموذج إلى شكل المنتج المحفوظ (لتحديث القائمة دون إعادة تحميلها)
function normalizeProduct(v) {
  return {
    name: v.name,
    price: Number(v.price),
    oldPrice: v.oldPrice === "" ? "" : Number(v.oldPrice),
    image1: v.image1, image2: v.image2, image3: v.image3, image4: v.image4,
    description: v.description,
    stock: v.stock === "" ? 0 : Number(v.stock),
    status: v.status || "active"
  };
}

// ---------- ضغط الصور في المتصفح قبل الرفع ----------

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error("تعذر قراءة الصورة")); };
    img.src = url;
  });
}

async function prepareImage(file) {
  const img = await loadImage(file);
  const scale = Math.min(1, IMAGE_MAX_SIDE / Math.max(img.naturalWidth, img.naturalHeight));
  const w = Math.round(img.naturalWidth * scale);
  const h = Math.round(img.naturalHeight * scale);

  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#ffffff"; // خلفية بيضاء للصور الشفافة
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(img, 0, 0, w, h);

  const dataUrl = canvas.toDataURL("image/jpeg", IMAGE_QUALITY);
  return { base64: dataUrl.split(",")[1], mime: "image/jpeg", preview: dataUrl };
}

// ---------- منطق صفحة Admin.html ----------

document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("loginForm");
  if (!form) return; // ليست صفحة الإدارة

  const $ = id => document.getElementById(id);
  const loginView = $("loginView");
  const appView = $("appView");
  const msgBox = $("loginMessage");
  const btn = $("loginBtn");
  const passInput = $("password");
  const sidebar = $("sidebar");
  const overlay = $("overlay");

  let products = [];       // المنتجات المعروضة في قسم المنتجات
  let editingId = null;    // رقم المنتج قيد التعديل (null = إضافة)
  let deletingId = null;   // رقم العنصر المطلوب حذفه (منتج أو طلب)
  let deleteKind = "product"; // نوع الحذف: product أو order
  let dashStale = false;   // هل الإحصائيات تحتاج تحديثًا؟
  let busy = false;        // منع الضغط المزدوج أثناء الطلبات
  let pendingUploads = 0;  // عدد الصور قيد الرفع
  let descGifs = [];       // روابط GIF الخاصة بوصف المنتج الحالي
  let descLoading = false; // جاري تحميل الوصف الكامل للتعديل

  function showMessage(text, type) {
    msgBox.textContent = text;
    msgBox.className = "message " + type;
    msgBox.hidden = false;
  }

  let toastTimer;
  function showToast(text, type) {
    const t = $("toast");
    t.textContent = text;
    t.className = "toast show" + (type === "error" ? " error" : "");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => { t.className = "toast"; }, 3200);
  }

  // إذا انتهت الجلسة: العودة لتسجيل الدخول (يعيد true إن عولج الخطأ)
  function handleAuthError(err) {
    if (!err.auth) return false;
    clearSession();
    closeModals();
    render();
    showMessage(err.message, "error");
    return true;
  }

  // عرض الشاشة المناسبة حسب حالة الجلسة
  function render() {
    const session = getSession();
    loginView.hidden = !!session;
    appView.hidden = !session;
    if (session) {
      $("adminName").textContent = session.username;
      loadDashboard();
    }
  }

  // ----- تسجيل الدخول -----
  $("togglePassword").addEventListener("click", (e) => {
    const show = passInput.type === "password";
    passInput.type = show ? "text" : "password";
    e.target.textContent = show ? "إخفاء" : "إظهار";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    msgBox.hidden = true;

    const username = $("username").value.trim();
    const password = passInput.value;
    if (!username || !password) {
      showMessage("يرجى ملء جميع الحقول", "error");
      return;
    }

    btn.disabled = true;
    btn.textContent = "جاري تسجيل الدخول...";
    try {
      await login(username, password);
      showMessage("تم تسجيل الدخول بنجاح", "success");
      setTimeout(() => { passInput.value = ""; render(); }, 400);
    } catch (err) {
      showMessage(err.message, "error");
    } finally {
      btn.disabled = false;
      btn.textContent = "تسجيل الدخول";
    }
  });

  // ----- التنقل بين الأقسام -----
  const TITLES = { home: "الرئيسية", products: "المنتجات", orders: "الطلبات" };

  function openMenu(open) {
    sidebar.classList.toggle("open", open);
    overlay.classList.toggle("show", open);
  }

  function showSection(name) {
    Object.keys(TITLES).forEach(key => { $("sec-" + key).hidden = key !== name; });
    document.querySelectorAll(".nav-btn[data-section]").forEach(b => {
      b.classList.toggle("active", b.dataset.section === name);
    });
    $("pageTitle").textContent = TITLES[name];
    openMenu(false);
    window.scrollTo(0, 0);

    if (name === "products") loadProducts();
    if (name === "orders") loadOrders();
    if (name === "home" && dashStale) loadDashboard();
  }

  document.querySelectorAll(".nav-btn[data-section]").forEach(b => {
    b.addEventListener("click", () => showSection(b.dataset.section));
  });
  $("menuBtn").addEventListener("click", () => openMenu(true));
  overlay.addEventListener("click", () => openMenu(false));
  $("logoutBtn").addEventListener("click", logout);
  $("retryBtn").addEventListener("click", loadDashboard);

  // ----- الرئيسية -----
  function setStats(p, o, n, s) {
    $("statProducts").textContent = p;
    $("statOrders").textContent = o;
    $("statNew").textContent = n;
    $("statSales").textContent = s;
  }

  function tableMessage(text) {
    $("latestOrders").innerHTML = '<tr><td colspan="6" class="state-msg">' + text + "</td></tr>";
  }

  function renderLatestOrders(latest) {
    if (!latest.length) {
      tableMessage("لا توجد طلبات بعد");
      return;
    }
    $("latestOrders").innerHTML = latest.map(o => (
      "<tr>" +
        "<td>#" + esc(o.id) + "</td>" +
        "<td>" + esc(o.customerName) + "</td>" +
        '<td class="cell-name">' + esc(o.productName) + "</td>" +
        "<td>" + esc(o.quantity) + "</td>" +
        "<td>" + formatMoney(o.total) + "</td>" +
        '<td><span class="badge badge-' + esc(o.status) + '">' +
          esc(ORDER_STATUS_LABELS[o.status] || o.status) + "</span></td>" +
      "</tr>"
    )).join("");
  }

  function renderDashboard(d) {
    setStats(d.products, d.orders, d.newOrders, formatMoney(d.sales));
    renderLatestOrders(d.latest || []);
  }

  // يعرض النسخة المحفوظة فورًا ثم يحدّثها من الخادم
  async function loadDashboard() {
    $("dashError").hidden = true;
    const cached = cacheLoad("dashboard");
    if (cached) {
      renderDashboard(cached);
    } else {
      setStats("-", "-", "-", "-");
      tableMessage("جاري تحميل الطلبات...");
    }

    try {
      const data = await getDashboard();
      cacheSave("dashboard", data);
      renderDashboard(data);
      dashStale = false;
    } catch (err) {
      if (handleAuthError(err)) return;
      if (cached) {
        showToast(err.message, "error");
      } else {
        $("dashErrorText").textContent = err.message;
        $("dashError").hidden = false;
        tableMessage("تعذر تحميل الطلبات");
      }
    }
  }

  // ----- المنتجات: العرض -----
  function productCard(p) {
    const off = p.status !== "active";
    const hasImg = /^https?:\/\//i.test(p.image1 || "");
    const old = Number(p.oldPrice) > Number(p.price)
      ? '<span class="pold">' + formatMoney(p.oldPrice) + "</span>" : "";
    const id = esc(p.id);
    const editBtn = '<button type="button" class="btn btn-outline btn-mini" data-action="edit" data-id="' + id + '">تعديل</button>';
    const activateBtn = off
      ? '<button type="button" class="btn btn-gold btn-mini" data-action="activate" data-id="' + id + '">تفعيل</button>'
      : "";
    const deleteBtn = '<button type="button" class="btn btn-outline danger btn-mini" data-action="delete" data-id="' + id + '">حذف</button>';
    const actions = editBtn + activateBtn + deleteBtn;

    return '<article class="pcard' + (off ? " is-off" : "") + '">' +
      '<div class="pimg' + (hasImg ? "" : " no-img") + '">' +
        (hasImg ? '<img src="' + esc(imgUrl(p.image1, 400)) + '" alt="' + esc(p.name) + '" loading="lazy" decoding="async">' : "") +
        '<span class="badge badge-' + esc(p.status) + '">' + esc(PRODUCT_STATUS_LABELS[p.status] || p.status) + "</span>" +
      "</div>" +
      '<div class="pinfo">' +
        '<h3 class="pname">' + esc(p.name) + "</h3>" +
        '<div class="pprice">' + formatMoney(p.price) + old + "</div>" +
        '<div class="pstock">المخزون: ' + esc(p.stock) + "</div>" +
      "</div>" +
      '<div class="pactions">' + actions + "</div>" +
    "</article>";
  }

  function renderProducts() {
    const grid = $("productsGrid");
    const state = $("productsState");
    if (!products.length) {
      grid.innerHTML = "";
      state.textContent = "لا توجد منتجات بعد. اضغط «+ إضافة منتج» لإضافة أول منتج.";
      state.hidden = false;
      return;
    }
    state.hidden = true;
    grid.innerHTML = products.map(productCard).join("");
    // إذا فشل تحميل صورة نعرض نص "لا توجد صورة"
    grid.querySelectorAll(".pimg img").forEach(img => {
      img.addEventListener("error", () => {
        img.parentElement.classList.add("no-img");
        img.remove();
      });
    });
  }

  // تحديث القائمة محليًا بعد أي تغيير (أسرع من إعادة التحميل من الخادم)
  function commitProducts(list) {
    products = list;
    cacheSave("products", products);
    renderProducts();
    dashStale = true;
  }

  // يعرض النسخة المحفوظة فورًا ثم يحدّثها من الخادم
  async function loadProducts() {
    const state = $("productsState");
    const cached = cacheLoad("products");
    if (cached) {
      products = cached;
      renderProducts();
    } else {
      $("productsGrid").innerHTML = "";
      state.textContent = "جاري تحميل المنتجات...";
      state.hidden = false;
    }

    try {
      products = await getProducts();
      cacheSave("products", products);
      renderProducts();
    } catch (err) {
      if (handleAuthError(err)) return;
      if (cached) {
        showToast(err.message, "error");
      } else {
        state.textContent = "حدث خطأ أثناء تحميل المنتجات: " + err.message;
      }
    }
  }

  $("refreshProducts").addEventListener("click", loadProducts);

  // ----- الطلبات -----
  const ORDER_CHOICES = ["confirmed", "shipped", "delivered"]; // الحالات التي يختارها المدير
  let orders = [];

  // قائمة الحالة: الطلب الجديد يظهر "جديد" (غير قابلة للاختيار) إلى أن يختار المدير حالة
  function statusSelect(o) {
    const isChoice = ORDER_CHOICES.indexOf(o.status) >= 0;
    const current = isChoice ? "" :
      '<option value="' + esc(o.status) + '" selected disabled>' +
      esc(ORDER_STATUS_LABELS[o.status] || o.status) + "</option>";
    const options = ORDER_CHOICES.map(s =>
      '<option value="' + s + '"' + (s === o.status ? " selected" : "") + ">" +
      ORDER_STATUS_LABELS[s] + "</option>").join("");
    return '<select class="status-select st-' + esc(o.status) + '" data-id="' + esc(o.id) +
      '" data-prev="' + esc(o.status) + '" aria-label="حالة الطلب">' + current + options + "</select>";
  }

  function ordersMessage(text) {
    $("ordersBody").innerHTML = '<tr><td colspan="12" class="state-msg">' + text + "</td></tr>";
  }

  function renderOrders() {
    if (!orders.length) {
      ordersMessage("لا توجد طلبات بعد");
      return;
    }
    $("ordersBody").innerHTML = orders.map(o => {
      let phone = String(o.phone || "");
      if (/^[5-7]\d{8}$/.test(phone)) phone = "0" + phone; // استعادة الصفر إن حُذف
      const tel = phone.replace(/[^\d+]/g, "");
      return "<tr>" +
        "<td>#" + esc(o.id) + "</td>" +
        "<td>" + esc(o.date) + "</td>" +
        '<td class="cell-name">' + esc(o.productName) + "</td>" +
        "<td>" + esc(o.customerName) + "</td>" +
        '<td class="cell-phone"><a href="tel:' + esc(tel) + '">' + esc(phone) + "</a></td>" +
        "<td>" + esc(o.city) + "</td>" +
        '<td class="cell-wrap">' + esc(o.address) + "</td>" +
        "<td>" + esc(o.quantity) + "</td>" +
        "<td>" + formatMoney(o.price) + "</td>" +
        "<td>" + formatMoney(o.total) + "</td>" +
        "<td>" + statusSelect(o) + "</td>" +
        '<td><button type="button" class="btn btn-outline danger order-del" data-del="' + esc(o.id) + '">حذف</button></td>' +
      "</tr>";
    }).join("");
  }

  // يعرض النسخة المحفوظة فورًا ثم يحدّثها من الخادم
  async function loadOrders() {
    const cached = cacheLoad("orders");
    if (cached) {
      orders = cached;
      renderOrders();
    } else {
      ordersMessage("جاري تحميل الطلبات...");
    }
    try {
      orders = await getOrders();
      cacheSave("orders", orders);
      renderOrders();
    } catch (err) {
      if (handleAuthError(err)) return;
      if (cached) showToast(err.message, "error");
      else ordersMessage("حدث خطأ أثناء تحميل الطلبات: " + esc(err.message));
    }
  }

  $("refreshOrders").addEventListener("click", loadOrders);

  // تغيير حالة الطلب
  $("ordersBody").addEventListener("change", async (e) => {
    const sel = e.target.closest("select.status-select");
    if (!sel) return;
    const id = sel.dataset.id;
    const prev = sel.dataset.prev;
    const status = sel.value;
    if (status === prev) return;
    if (busy) { sel.value = prev; return; }

    busy = true;
    sel.disabled = true;
    try {
      await updateOrder(id, status);
      orders = orders.map(o => String(o.id) === String(id) ? Object.assign({}, o, { status: status }) : o);
      cacheSave("orders", orders);
      dashStale = true;
      renderOrders();
      showToast("تم تحديث حالة الطلب بنجاح");
    } catch (err) {
      if (handleAuthError(err)) return;
      sel.value = prev;
      sel.disabled = false;
      showToast(err.message, "error");
    } finally {
      busy = false;
    }
  });

  // حذف طلب: يفتح نافذة التأكيد
  $("ordersBody").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-del]");
    if (!b || busy) return;
    const o = orders.find(x => String(x.id) === b.dataset.del);
    if (!o) return;
    deletingId = o.id;
    deleteKind = "order";
    $("confirmTitle").textContent = "حذف الطلب";
    $("confirmText").textContent =
      "هل أنت متأكد من حذف الطلب #" + o.id + " الخاص بـ «" + o.customerName +
      "» نهائيًا من الجدول؟ لا يمكن التراجع عن هذه العملية.";
    openModal("confirmModal");
  });

  // ----- النوافذ المنبثقة -----
  function openModal(id) {
    $(id).hidden = false;
    document.body.classList.add("no-scroll");
  }

  function closeModals() {
    $("productModal").hidden = true;
    $("confirmModal").hidden = true;
    document.body.classList.remove("no-scroll");
    editingId = null;
    deletingId = null;
  }

  // زر الإغلاق/الإلغاء، والضغط على الخلفية، ومفتاح Esc
  document.querySelectorAll(".modal").forEach(m => {
    m.addEventListener("click", (e) => {
      if (e.target === m || e.target.closest("[data-close]")) closeModals();
    });
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") { openMenu(false); closeModals(); }
  });

  // ----- المنتجات: خانات رفع الصور -----
  const pForm = $("productForm");
  const pMsg = $("productMessage");
  const uploads = $("uploads");
  const saveBtn = $("saveProductBtn");

  IMAGE_KEYS.forEach((key, i) => {
    uploads.insertAdjacentHTML("beforeend",
      '<div class="uslot" data-key="' + key + '">' +
        '<button type="button" class="uframe" aria-label="اختيار صورة">' +
          '<img alt="" hidden><span class="uplus" aria-hidden="true">+</span>' +
          '<span class="ustatus" hidden></span>' +
        "</button>" +
        '<button type="button" class="uremove" aria-label="حذف الصورة" hidden>×</button>' +
        '<input type="file" accept="image/*" hidden>' +
        '<input type="hidden" name="' + key + '">' +
        '<span class="ucap">' + (i === 0 ? "الصورة الرئيسية" : "صورة " + (i + 1)) + "</span>" +
      "</div>");
  });

  function slotEl(key) { return uploads.querySelector('[data-key="' + key + '"]'); }

  // عرض الصورة في الخانة وحفظ رابطها في الحقل المخفي
  function setSlot(key, url, preview) {
    const slot = slotEl(key);
    const img = slot.querySelector("img");
    slot.querySelector('input[type="hidden"]').value = url || "";
    if (url) {
      img.src = preview || imgUrl(url, 200);
      img.hidden = false;
    } else {
      img.removeAttribute("src");
      img.hidden = true;
    }
    slot.classList.toggle("has-img", !!url);
    slot.querySelector(".uremove").hidden = !url;
  }

  function setSlotStatus(key, text) {
    const st = slotEl(key).querySelector(".ustatus");
    st.textContent = text || "";
    st.hidden = !text;
  }

  function updateSaveState() {
    saveBtn.disabled = busy || pendingUploads > 0 || descLoading;
    saveBtn.textContent = pendingUploads > 0 ? "جاري رفع الصور..."
      : descLoading ? "جاري تحميل الوصف..." : "حفظ";
  }

  async function handleFile(key, file) {
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      pMsg.textContent = "يرجى اختيار ملف صورة";
      pMsg.hidden = false;
      return;
    }
    pMsg.hidden = true;
    const previous = slotEl(key).querySelector('input[type="hidden"]').value;
    pendingUploads++;
    updateSaveState();
    setSlotStatus(key, "جاري الرفع...");
    try {
      const img = await prepareImage(file);
      setSlot(key, previous, img.preview); // معاينة فورية
      const res = await uploadImage(img.base64, img.mime);
      setSlot(key, res.url, img.preview);
    } catch (err) {
      if (handleAuthError(err)) return;
      setSlot(key, previous);
      pMsg.textContent = err.message || "تعذر رفع الصورة";
      pMsg.hidden = false;
    } finally {
      pendingUploads--;
      setSlotStatus(key, "");
      updateSaveState();
    }
  }

  uploads.addEventListener("click", (e) => {
    const slot = e.target.closest(".uslot");
    if (!slot) return;
    if (e.target.closest(".uremove")) {
      setSlot(slot.dataset.key, "");
    } else if (e.target.closest(".uframe")) {
      slot.querySelector('input[type="file"]').click();
    }
  });

  uploads.addEventListener("change", (e) => {
    const input = e.target;
    if (input.type !== "file") return;
    handleFile(input.closest(".uslot").dataset.key, input.files[0]);
    input.value = ""; // للسماح باختيار نفس الملف مرة أخرى
  });

  // ----- المنتجات: نموذج الإضافة/التعديل -----
  const descBox = pForm.elements.description;
  const DESC_PLACEHOLDER = descBox.placeholder;

  function renderGifs() {
    $("gifList").innerHTML = descGifs.map((u, i) =>
      '<div class="gitem"><img src="' + esc(u) + '" alt="" loading="lazy">' +
      '<button type="button" class="uremove" data-i="' + i + '" aria-label="حذف الـ GIF">×</button></div>'
    ).join("");
    $("addGifBtn").hidden = descGifs.length >= MAX_GIFS;
  }

  $("gifList").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-i]");
    if (!b) return;
    descGifs.splice(Number(b.dataset.i), 1);
    renderGifs();
  });

  $("addGifBtn").addEventListener("click", () => $("gifInput").click());
  $("gifInput").addEventListener("change", (e) => {
    handleGifs(Array.from(e.target.files));
    e.target.value = "";
  });

  // رفع ملف GIF أو أكثر دون ضغط (حتى لا تفقد حركتها)
  async function handleGifs(files) {
    for (const file of files) {
      if (descGifs.length >= MAX_GIFS) {
        pMsg.textContent = "الحد الأقصى " + MAX_GIFS + " صور GIF";
        pMsg.hidden = false;
        break;
      }
      if (file.type !== "image/gif") {
        pMsg.textContent = "يرجى اختيار ملف بصيغة GIF";
        pMsg.hidden = false;
        continue;
      }
      if (file.size > GIF_MAX_BYTES) {
        pMsg.textContent = "حجم الـ GIF كبير، الحد الأقصى 5 ميغابايت";
        pMsg.hidden = false;
        continue;
      }
      pMsg.hidden = true;
      pendingUploads++;
      updateSaveState();
      $("addGifBtn").textContent = "جاري رفع GIF...";
      try {
        const res = await uploadImage(await fileToBase64(file), "image/gif");
        descGifs.push(res.url);
        renderGifs();
      } catch (err) {
        if (handleAuthError(err)) return;
        pMsg.textContent = err.message || "تعذر رفع الـ GIF";
        pMsg.hidden = false;
      } finally {
        pendingUploads--;
        $("addGifBtn").textContent = "+ إضافة GIF";
        updateSaveState();
      }
    }
  }

  // القائمة لا تحمل الوصف، فنجلبه كاملًا عند فتح التعديل
  async function loadFullProduct(id) {
    descLoading = true;
    descBox.disabled = true;
    descBox.placeholder = "جاري تحميل الوصف...";
    updateSaveState();

    let full;
    try {
      full = await getProduct(id);
    } catch (err) {
      if (handleAuthError(err)) return;
      if (String(editingId) === String(id)) { // يبقى الحفظ معطلًا حتى لا يُمسح الوصف
        pMsg.textContent = "تعذر تحميل وصف المنتج، أغلق النافذة وحاول مرة أخرى";
        pMsg.hidden = false;
      }
      return;
    }
    if (String(editingId) !== String(id)) return; // أُغلقت النافذة أثناء التحميل

    const d = splitDescription(full.description);
    descBox.value = d.text;
    descGifs = d.gifs;
    renderGifs();
    descLoading = false;
    descBox.disabled = false;
    descBox.placeholder = DESC_PLACEHOLDER;
    updateSaveState();
  }

  function openProductModal(p) {
    editingId = p ? p.id : null;
    $("modalTitle").textContent = p ? "تعديل المنتج" : "إضافة منتج";
    pMsg.hidden = true;
    PRODUCT_FIELDS.forEach(k => {
      if (IMAGE_KEYS.indexOf(k) >= 0 || k === "description") return;
      const val = p && p[k] !== undefined && p[k] !== null ? p[k] : "";
      pForm.elements[k].value = k === "status" && val === "" ? "active" : val;
    });
    IMAGE_KEYS.forEach(k => setSlot(k, p && p[k] ? p[k] : ""));
    descBox.value = "";
    descBox.disabled = false;
    descBox.placeholder = DESC_PLACEHOLDER;
    descLoading = false;
    descGifs = [];
    renderGifs();
    updateSaveState();
    openModal("productModal");
    pForm.elements.name.focus();
    if (p) loadFullProduct(p.id);
  }

  $("addProductBtn").addEventListener("click", () => openProductModal(null));

  function readProductForm() {
    const v = {};
    PRODUCT_FIELDS.forEach(k => { v[k] = pForm.elements[k].value.trim(); });
    v.description = joinDescription(v.description, descGifs); // النص + روابط GIF
    return v;
  }

  pForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    pMsg.hidden = true;

    if (pendingUploads > 0) {
      pMsg.textContent = "يرجى انتظار اكتمال رفع الصور";
      pMsg.hidden = false;
      return;
    }
    const values = readProductForm();
    const problem = validateProduct(values);
    if (problem) {
      pMsg.textContent = problem;
      pMsg.hidden = false;
      return;
    }

    const id = editingId;
    const isEdit = id !== null;
    busy = true;
    saveBtn.disabled = true;
    saveBtn.textContent = "جاري الحفظ...";
    try {
      const res = isEdit ? await updateProduct(id, values) : await addProduct(values);
      const local = normalizeProduct(values);
      delete local.description; // القائمة خفيفة بدون الوصف
      if (isEdit) {
        commitProducts(products.map(p =>
          String(p.id) === String(id) ? Object.assign({}, p, local) : p));
      } else {
        commitProducts([Object.assign({ id: res.id, createdAt: "" }, local)].concat(products));
      }
      closeModals();
      showToast(isEdit ? "تم تعديل المنتج بنجاح" : "تمت إضافة المنتج بنجاح");
    } catch (err) {
      if (handleAuthError(err)) return;
      pMsg.textContent = err.message;
      pMsg.hidden = false;
    } finally {
      busy = false;
      updateSaveState();
    }
  });

  // ----- المنتجات: أزرار البطاقات (تعديل / حذف / تفعيل) -----
  $("productsGrid").addEventListener("click", async (e) => {
    const b = e.target.closest("button[data-action]");
    if (!b || busy) return;
    const p = products.find(x => String(x.id) === b.dataset.id);
    if (!p) return;

    if (b.dataset.action === "edit") {
      openProductModal(p);
    } else if (b.dataset.action === "delete") {
      deletingId = p.id;
      deleteKind = "product";
      $("confirmTitle").textContent = "حذف المنتج";
      $("confirmText").textContent =
        "هل أنت متأكد من حذف «" + p.name + "» نهائيًا مع صوره؟ لا يمكن التراجع عن هذه العملية. " +
        "وإن أردت إخفاءه مؤقتًا فقط فغيّر حالته إلى «غير نشط» من زر التعديل.";
      openModal("confirmModal");
    } else if (b.dataset.action === "activate") {
      busy = true;
      b.disabled = true;
      try {
        await setProductStatus(p.id, "active");
        commitProducts(products.map(x =>
          String(x.id) === String(p.id) ? Object.assign({}, x, { status: "active" }) : x));
        showToast("تم تفعيل المنتج بنجاح");
      } catch (err) {
        if (!handleAuthError(err)) { showToast(err.message, "error"); b.disabled = false; }
      } finally {
        busy = false;
      }
    }
  });

  // تأكيد الحذف (تعطيل المنتج)
  $("confirmYes").addEventListener("click", async () => {
    if (busy || deletingId === null) return;
    const yes = $("confirmYes");
    const id = deletingId;
    busy = true;
    yes.disabled = true;
    yes.textContent = "جاري الحذف...";
    try {
      if (deleteKind === "order") {
        await deleteOrder(id);
        orders = orders.filter(x => String(x.id) !== String(id));
        cacheSave("orders", orders);
        dashStale = true;
        renderOrders();
        closeModals();
        showToast("تم حذف الطلب بنجاح");
      } else {
        await deleteProduct(id);
        commitProducts(products.filter(x => String(x.id) !== String(id)));
        closeModals();
        showToast("تم حذف المنتج بنجاح");
      }
    } catch (err) {
      if (handleAuthError(err)) return;
      closeModals();
      showToast(err.message, "error");
    } finally {
      busy = false;
      yes.disabled = false;
      yes.textContent = "نعم، احذف نهائيًا";
    }
  });

  render();
});